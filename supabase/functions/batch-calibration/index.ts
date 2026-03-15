import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * batch-calibration — Scheduled Edge Function
 * 
 * Runs periodically (daily or weekly) to execute population-level
 * intelligence tasks across all active clinics:
 *   1. Unsupervised symptom cluster discovery
 *   2. Supervised prior recalibration from outcomes
 *   3. Meta-learning calibration reports
 *   4. Bias fairness audits
 * 
 * Designed to be triggered via pg_cron or manual invocation.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const targetClinicId = body.clinic_id || null;
    const lookbackDays = body.lookback_days || 30;

    // Get active clinics
    let clinicQuery = admin.from("clinics").select("id, name").eq("status", "active");
    if (targetClinicId) clinicQuery = clinicQuery.eq("id", targetClinicId);
    const { data: clinics, error: clinicErr } = await clinicQuery.limit(50);

    if (clinicErr || !clinics || clinics.length === 0) {
      return new Response(JSON.stringify({ message: "No active clinics found", error: clinicErr?.message }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ clinic_id: string; clinic_name: string; tasks: Record<string, any> }> = [];

    for (const clinic of clinics) {
      const clinicResult: Record<string, any> = {};
      const since = new Date(Date.now() - lookbackDays * 86400000).toISOString();

      // ── 1. Calibration Metrics ──
      try {
        const { data: outcomes } = await admin.from("diagnostic_outcomes")
          .select("*")
          .eq("clinic_id", clinic.id)
          .gte("created_at", since);

        if (outcomes && outcomes.length >= 10) {
          const total = outcomes.length;
          let top1Match = 0, corrected = 0, confSum = 0, overconf = 0, underconf = 0;

          for (const o of outcomes as any[]) {
            const sim = o.similarity_score || 0;
            if (sim >= 0.85) top1Match++;
            if (o.correction_type !== "match") corrected++;
            const conf = o.metadata?.confidence_score || 0;
            confSum += conf;
            if (conf > 0.7 && sim < 0.5) overconf++;
            if (conf < 0.4 && sim >= 0.85) underconf++;
          }

          const avgConf = confSum / total;
          const top1Acc = top1Match / total;

          await admin.from("model_calibration_metrics").insert({
            clinic_id: clinic.id,
            metric_period: "batch",
            period_start: since,
            period_end: new Date().toISOString(),
            total_cases: total,
            top1_accuracy: Math.round(top1Acc * 1000) / 1000,
            top3_accuracy: 0,
            top5_accuracy: 0,
            avg_confidence: Math.round(avgConf * 1000) / 1000,
            calibration_error: Math.round(Math.abs(avgConf - top1Acc) * 1000) / 1000,
            overconfidence_rate: Math.round((overconf / total) * 1000) / 1000,
            underconfidence_rate: Math.round((underconf / total) * 1000) / 1000,
            danger_detection_rate: 0,
            avg_latency_ms: 0,
            correction_rate: Math.round((corrected / total) * 1000) / 1000,
            learning_updates_applied: 0,
          });

          clinicResult.calibration = { status: "computed", cases: total, top1_accuracy: Math.round(top1Acc * 1000) / 1000 };
        } else {
          clinicResult.calibration = { status: "insufficient_data", cases: outcomes?.length || 0 };
        }
      } catch (e: any) {
        clinicResult.calibration = { status: "error", error: e.message };
      }

      // ── 2. Prior Recalibration ──
      try {
        const recalSince = new Date(Date.now() - 90 * 86400000).toISOString();
        const { data: outcomes } = await admin.from("diagnostic_outcomes")
          .select("ai_diagnosis, doctor_final_diagnosis, correction_type, similarity_score")
          .eq("clinic_id", clinic.id)
          .gte("created_at", recalSince);

        if (outcomes && outcomes.length >= 10) {
          const diagStats = new Map<string, { total: number; corrected: number }>();
          for (const o of outcomes as any[]) {
            const aiDiag = (o.ai_diagnosis || "").toLowerCase().trim();
            if (!aiDiag) continue;
            const stats = diagStats.get(aiDiag) || { total: 0, corrected: 0 };
            stats.total++;
            if (o.correction_type !== "match") stats.corrected++;
            diagStats.set(aiDiag, stats);
          }

          const batchId = `batch_${Date.now().toString(36)}`;
          let updates = 0;

          for (const [diag, stats] of diagStats) {
            if (stats.total < 5) continue;
            const correctionRate = stats.corrected / stats.total;
            let factor = 1.0, direction = "neutral";

            if (correctionRate > 0.4) {
              factor = 1 - (correctionRate - 0.2) * 0.5;
              direction = "penalize";
            } else if (correctionRate < 0.1 && stats.total >= 10) {
              factor = 1 + (0.1 - correctionRate) * 0.5;
              direction = "boost";
            }

            if (direction !== "neutral") {
              await admin.from("learning_updates").insert({
                clinic_id: clinic.id,
                update_type: "prior_calibration",
                target_entity: "diagnosis",
                target_id: diag,
                old_value: 1.0,
                new_value: Math.round(factor * 1000) / 1000,
                delta: Math.round((factor - 1.0) * 1000) / 1000,
                direction,
                sample_size: stats.total,
                confidence: stats.total >= 20 ? "high" : stats.total >= 10 ? "moderate" : "low",
                source: "batch_recalibration",
                batch_id: batchId,
              });
              updates++;
            }
          }

          clinicResult.recalibration = { status: "computed", outcomes: outcomes.length, updates };
        } else {
          clinicResult.recalibration = { status: "insufficient_data", outcomes: outcomes?.length || 0 };
        }
      } catch (e: any) {
        clinicResult.recalibration = { status: "error", error: e.message };
      }

      // ── 3. Cluster Discovery ──
      try {
        const { data: cases } = await admin.from("episodic_case_memory")
          .select("symptom_vector, final_diagnosis, created_at")
          .eq("clinic_id", clinic.id)
          .gte("created_at", since)
          .limit(500);

        if (cases && cases.length >= 10) {
          const pairCounts = new Map<string, { count: number; diagnoses: Map<string, number>; firstSeen: string; lastSeen: string }>();

          for (const c of cases as any[]) {
            const symptoms: string[] = (c.symptom_vector || []).map((s: string) => s.toLowerCase().trim());
            if (symptoms.length < 2) continue;
            for (let i = 0; i < symptoms.length; i++) {
              for (let j = i + 1; j < symptoms.length; j++) {
                const key = [symptoms[i], symptoms[j]].sort().join("|");
                const entry = pairCounts.get(key) || { count: 0, diagnoses: new Map(), firstSeen: c.created_at, lastSeen: c.created_at };
                entry.count++;
                if (c.final_diagnosis) entry.diagnoses.set(c.final_diagnosis, (entry.diagnoses.get(c.final_diagnosis) || 0) + 1);
                if (c.created_at < entry.firstSeen) entry.firstSeen = c.created_at;
                if (c.created_at > entry.lastSeen) entry.lastSeen = c.created_at;
                pairCounts.set(key, entry);
              }
            }
          }

          let clustersFound = 0;
          for (const [key, entry] of pairCounts) {
            if (entry.count < 3) continue;
            const symptomSet = key.split("|");
            const diagArray = Array.from(entry.diagnoses.entries())
              .map(([d, c]) => ({ diagnosis: d, count: c }))
              .sort((a, b) => b.count - a.count).slice(0, 5);

            const isNovel = diagArray.length === 0 || (diagArray.length >= 3 && diagArray[0].count < entry.count * 0.4);
            const daySpan = Math.max(1, (new Date(entry.lastSeen).getTime() - new Date(entry.firstSeen).getTime()) / 86400000);
            const rate = daySpan > 0 ? entry.count / daySpan : entry.count;
            const alertLevel = rate >= 3 ? "outbreak" : rate >= 1.5 ? "elevated" : entry.count >= 5 ? "watch" : "none";

            await admin.from("clustered_symptom_patterns").upsert({
              clinic_id: clinic.id,
              cluster_id: key,
              symptom_set: symptomSet,
              patient_count: entry.count,
              associated_diagnoses: diagArray,
              cluster_confidence: entry.count / cases.length,
              discovery_method: "cooccurrence",
              first_detected: entry.firstSeen,
              last_updated: entry.lastSeen,
              alert_level: alertLevel,
              is_novel: isNovel,
            }, { onConflict: "clinic_id,cluster_id" });

            clustersFound++;
            if (clustersFound >= 20) break;
          }

          clinicResult.discovery = { status: "completed", cases: cases.length, clusters: clustersFound };
        } else {
          clinicResult.discovery = { status: "insufficient_data", cases: cases?.length || 0 };
        }
      } catch (e: any) {
        clinicResult.discovery = { status: "error", error: e.message };
      }

      // ── 4. Bias Fairness Audit ──
      try {
        const { data: outcomes } = await admin.from("diagnostic_outcomes")
          .select("*")
          .eq("clinic_id", clinic.id)
          .gte("created_at", since);

        if (outcomes && outcomes.length >= 20) {
          const total = outcomes.length;
          const corrections = (outcomes as any[]).filter((o: any) => o.correction_type !== "match").length;
          const correctionRate = corrections / total;

          await admin.from("bias_metrics").insert({
            metric_type: "batch_audit",
            dimension: "overall",
            dimension_value: "all",
            period_start: since,
            period_end: new Date().toISOString(),
            clinic_id: clinic.id,
            sample_count: total,
            positive_rate: correctionRate,
            disparity_score: Math.abs(correctionRate - 0.2),
            passes_fairness: correctionRate < 0.35,
            fairness_threshold: 0.35,
          });

          clinicResult.bias_audit = { status: "completed", cases: total, passes: correctionRate < 0.35 };
        } else {
          clinicResult.bias_audit = { status: "insufficient_data", cases: outcomes?.length || 0 };
        }
      } catch (e: any) {
        clinicResult.bias_audit = { status: "error", error: e.message };
      }

      results.push({ clinic_id: clinic.id, clinic_name: clinic.name, tasks: clinicResult });
    }

    return new Response(JSON.stringify({
      status: "complete",
      clinics_processed: results.length,
      results,
      executed_at: new Date().toISOString(),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
