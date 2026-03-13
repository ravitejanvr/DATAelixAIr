import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const results: string[] = [];

  // Helper: get or create symptom
  async function getOrCreateSymptom(name: string, category = "general"): Promise<string | null> {
    const { data } = await supabase.from("symptoms").select("id").ilike("symptom_name", name).limit(1);
    if (data?.length) return data[0].id;
    const { data: ins, error } = await supabase.from("symptoms").insert({ symptom_name: name, category }).select("id").single();
    if (error) { results.push(`Symptom err: ${name}: ${error.message}`); return null; }
    return ins?.id || null;
  }

  // Helper: get diagnosis by name
  async function getDiagnosis(name: string): Promise<string | null> {
    const { data } = await supabase.from("diagnoses").select("id").ilike("diagnosis_name", name).limit(1);
    return data?.[0]?.id || null;
  }

  // Helper: get or create diagnosis
  async function getOrCreateDiagnosis(name: string, category: string): Promise<string | null> {
    const id = await getDiagnosis(name);
    if (id) return id;
    const { data, error } = await supabase.from("diagnoses").insert({ diagnosis_name: name, category }).select("id").single();
    if (error) { results.push(`Diag err: ${name}: ${error.message}`); return null; }
    return data?.id || null;
  }

  // Define disease-symptom maps with likelihoods
  // Format: [disease_name, category, [[symptom, likelihood], ...]]
  type DiseaseEntry = [string, string, [string, number][]];

  const cardiology: DiseaseEntry[] = [
    ["Myocardial Infarction", "cardiology", [
      ["chest pain", 0.95], ["crushing chest pain", 0.85], ["radiating arm pain", 0.7],
      ["diaphoresis", 0.8], ["dyspnea", 0.7], ["nausea", 0.6], ["jaw pain", 0.5],
      ["fatigue", 0.5], ["dizziness", 0.4], ["anxiety", 0.5], ["palpitations", 0.3],
      ["epigastric pain", 0.35], ["syncope", 0.3], ["weakness", 0.5]
    ]],
    ["Unstable Angina", "cardiology", [
      ["chest pain", 0.95], ["chest tightness", 0.8], ["exertional chest pain", 0.85],
      ["radiating arm pain", 0.6], ["dyspnea", 0.6], ["diaphoresis", 0.5],
      ["fatigue", 0.5], ["anxiety", 0.4], ["nausea", 0.35], ["dizziness", 0.3],
      ["palpitations", 0.3], ["jaw pain", 0.35], ["shoulder pain", 0.4]
    ]],
    ["Stable Angina", "cardiology", [
      ["exertional chest pain", 0.9], ["chest tightness", 0.8], ["chest pain", 0.85],
      ["dyspnea on exertion", 0.7], ["radiating arm pain", 0.5], ["fatigue", 0.5],
      ["jaw pain", 0.3], ["shoulder pain", 0.35], ["dizziness", 0.3]
    ]],
    ["Pericarditis", "cardiology", [
      ["pleuritic chest pain", 0.9], ["chest pain worse lying down", 0.85],
      ["pain relieved by leaning forward", 0.8], ["fever", 0.6], ["pericardial friction rub", 0.7],
      ["dyspnea", 0.5], ["malaise", 0.4], ["cough", 0.3], ["tachycardia", 0.5],
      ["chest pain", 0.8], ["myalgia", 0.35]
    ]],
    ["Cardiac Tamponade", "cardiology", [
      ["hypotension", 0.85], ["jugular venous distension", 0.8], ["muffled heart sounds", 0.75],
      ["tachycardia", 0.8], ["dyspnea", 0.8], ["chest pain", 0.6], ["anxiety", 0.5],
      ["pulsus paradoxus", 0.7], ["syncope", 0.4], ["weakness", 0.5]
    ]],
    ["Congestive Heart Failure", "cardiology", [
      ["dyspnea", 0.9], ["orthopnea", 0.85], ["paroxysmal nocturnal dyspnea", 0.8],
      ["peripheral edema", 0.85], ["fatigue", 0.8], ["weight gain", 0.7],
      ["cough", 0.5], ["jugular venous distension", 0.6], ["hepatomegaly", 0.4],
      ["nocturia", 0.5], ["exercise intolerance", 0.8], ["wheezing", 0.35],
      ["tachycardia", 0.5], ["abdominal distension", 0.4]
    ]],
    ["Atrial Fibrillation", "cardiology", [
      ["palpitations", 0.9], ["irregular heartbeat", 0.9], ["dyspnea", 0.6],
      ["fatigue", 0.7], ["dizziness", 0.6], ["chest pain", 0.4], ["syncope", 0.3],
      ["exercise intolerance", 0.5], ["anxiety", 0.4], ["weakness", 0.4]
    ]],
    ["Aortic Dissection", "cardiology", [
      ["tearing chest pain", 0.9], ["sudden severe chest pain", 0.85],
      ["back pain", 0.7], ["radiating back pain", 0.75], ["hypertension", 0.6],
      ["pulse deficit", 0.5], ["syncope", 0.3], ["diaphoresis", 0.6],
      ["aortic regurgitation murmur", 0.4], ["hypotension", 0.4], ["dyspnea", 0.4]
    ]],
    ["Aortic Stenosis", "cardiology", [
      ["exertional dyspnea", 0.85], ["syncope", 0.7], ["angina", 0.65],
      ["heart murmur", 0.9], ["fatigue", 0.6], ["dizziness", 0.5],
      ["exercise intolerance", 0.7], ["palpitations", 0.3], ["chest pain", 0.5]
    ]],
    ["Mitral Valve Prolapse", "cardiology", [
      ["palpitations", 0.7], ["chest pain", 0.5], ["fatigue", 0.5],
      ["dizziness", 0.4], ["dyspnea", 0.35], ["anxiety", 0.4],
      ["heart murmur", 0.8], ["syncope", 0.3]
    ]],
    ["Hypertensive Crisis", "cardiology", [
      ["severe headache", 0.85], ["hypertension", 0.95], ["visual disturbance", 0.6],
      ["chest pain", 0.5], ["dyspnea", 0.5], ["nausea", 0.4], ["vomiting", 0.35],
      ["anxiety", 0.5], ["nosebleed", 0.3], ["confusion", 0.4], ["seizure", 0.3]
    ]],
    ["Infective Endocarditis", "cardiology", [
      ["fever", 0.9], ["heart murmur", 0.85], ["fatigue", 0.7], ["night sweats", 0.6],
      ["weight loss", 0.5], ["petechiae", 0.4], ["splinter hemorrhages", 0.35],
      ["splenomegaly", 0.35], ["janeway lesions", 0.3], ["osler nodes", 0.3],
      ["arthralgia", 0.4], ["malaise", 0.6], ["chills", 0.5]
    ]],
    ["Myocarditis", "cardiology", [
      ["chest pain", 0.7], ["dyspnea", 0.7], ["palpitations", 0.6],
      ["fatigue", 0.7], ["fever", 0.5], ["tachycardia", 0.7], ["myalgia", 0.4],
      ["syncope", 0.3], ["edema", 0.35], ["recent viral illness", 0.6]
    ]],
    ["Pulmonary Embolism", "cardiology", [
      ["sudden dyspnea", 0.85], ["pleuritic chest pain", 0.75], ["tachycardia", 0.8],
      ["hemoptysis", 0.3], ["calf swelling", 0.5], ["leg pain", 0.5],
      ["anxiety", 0.4], ["syncope", 0.3], ["hypoxia", 0.7], ["tachypnea", 0.7],
      ["chest pain", 0.7], ["cough", 0.35], ["diaphoresis", 0.4]
    ]],
    ["Deep Vein Thrombosis", "cardiology", [
      ["calf swelling", 0.85], ["leg pain", 0.8], ["unilateral leg edema", 0.9],
      ["warmth in leg", 0.7], ["redness in leg", 0.6], ["tenderness", 0.7],
      ["positive homan sign", 0.4], ["pain on dorsiflexion", 0.5]
    ]],
    ["Supraventricular Tachycardia", "cardiology", [
      ["palpitations", 0.9], ["rapid heartbeat", 0.9], ["dizziness", 0.6],
      ["chest discomfort", 0.5], ["dyspnea", 0.5], ["anxiety", 0.5],
      ["syncope", 0.3], ["weakness", 0.4], ["diaphoresis", 0.3]
    ]],
    ["Ventricular Tachycardia", "cardiology", [
      ["palpitations", 0.85], ["dizziness", 0.7], ["syncope", 0.6],
      ["chest pain", 0.5], ["dyspnea", 0.6], ["hypotension", 0.5],
      ["cardiac arrest", 0.4], ["anxiety", 0.4], ["diaphoresis", 0.5]
    ]],
    ["Peripheral Artery Disease", "cardiology", [
      ["intermittent claudication", 0.9], ["leg pain on walking", 0.85],
      ["cold extremities", 0.6], ["weak pulses", 0.7], ["non-healing ulcers", 0.5],
      ["numbness in feet", 0.5], ["skin color changes", 0.4], ["hair loss on legs", 0.35],
      ["erectile dysfunction", 0.3], ["muscle atrophy", 0.3]
    ]],
  ];

  const pulmonology: DiseaseEntry[] = [
    ["Pneumonia", "pulmonology", [
      ["cough", 0.9], ["fever", 0.85], ["dyspnea", 0.7], ["productive cough", 0.8],
      ["chest pain", 0.5], ["chills", 0.6], ["tachypnea", 0.6], ["fatigue", 0.6],
      ["pleuritic chest pain", 0.5], ["crackles on auscultation", 0.7],
      ["malaise", 0.5], ["night sweats", 0.35], ["hemoptysis", 0.3]
    ]],
    ["Asthma", "pulmonology", [
      ["wheezing", 0.9], ["dyspnea", 0.85], ["cough", 0.8], ["chest tightness", 0.75],
      ["nocturnal cough", 0.6], ["exercise-induced symptoms", 0.6],
      ["tachypnea", 0.5], ["accessory muscle use", 0.4], ["prolonged expiration", 0.6],
      ["allergic rhinitis", 0.4], ["atopy", 0.3]
    ]],
    ["COPD", "pulmonology", [
      ["dyspnea", 0.9], ["chronic cough", 0.85], ["productive cough", 0.8],
      ["wheezing", 0.7], ["barrel chest", 0.5], ["exercise intolerance", 0.8],
      ["weight loss", 0.4], ["fatigue", 0.6], ["tachypnea", 0.5],
      ["pursed lip breathing", 0.5], ["cyanosis", 0.3], ["peripheral edema", 0.35]
    ]],
    ["Pulmonary Tuberculosis", "pulmonology", [
      ["chronic cough", 0.9], ["hemoptysis", 0.6], ["night sweats", 0.8],
      ["weight loss", 0.8], ["fever", 0.7], ["fatigue", 0.7], ["loss of appetite", 0.6],
      ["chest pain", 0.4], ["lymphadenopathy", 0.4], ["productive cough", 0.7]
    ]],
    ["Pleural Effusion", "pulmonology", [
      ["dyspnea", 0.85], ["pleuritic chest pain", 0.7], ["decreased breath sounds", 0.8],
      ["dullness to percussion", 0.75], ["cough", 0.5], ["fever", 0.4],
      ["chest heaviness", 0.6], ["tachypnea", 0.5], ["weight loss", 0.3]
    ]],
    ["Pneumothorax", "pulmonology", [
      ["sudden chest pain", 0.9], ["dyspnea", 0.85], ["decreased breath sounds", 0.8],
      ["tachycardia", 0.6], ["tachypnea", 0.6], ["subcutaneous emphysema", 0.4],
      ["hyperresonance to percussion", 0.7], ["anxiety", 0.4], ["pleuritic chest pain", 0.7]
    ]],
    ["Acute Bronchitis", "pulmonology", [
      ["cough", 0.95], ["productive cough", 0.7], ["chest discomfort", 0.5],
      ["low-grade fever", 0.4], ["fatigue", 0.5], ["sore throat", 0.4],
      ["rhinorrhea", 0.4], ["wheezing", 0.35], ["myalgia", 0.3], ["malaise", 0.5]
    ]],
    ["Bronchiectasis", "pulmonology", [
      ["chronic productive cough", 0.9], ["hemoptysis", 0.6], ["recurrent infections", 0.7],
      ["dyspnea", 0.6], ["wheezing", 0.4], ["fatigue", 0.5],
      ["weight loss", 0.35], ["finger clubbing", 0.4], ["crackles on auscultation", 0.6]
    ]],
    ["Lung Cancer", "pulmonology", [
      ["chronic cough", 0.8], ["hemoptysis", 0.5], ["weight loss", 0.7],
      ["dyspnea", 0.6], ["chest pain", 0.5], ["hoarseness", 0.4],
      ["loss of appetite", 0.6], ["fatigue", 0.7], ["recurrent pneumonia", 0.35],
      ["bone pain", 0.3], ["finger clubbing", 0.3]
    ]],
    ["Interstitial Lung Disease", "pulmonology", [
      ["progressive dyspnea", 0.9], ["dry cough", 0.8], ["fatigue", 0.6],
      ["exercise intolerance", 0.7], ["finger clubbing", 0.5],
      ["crackles on auscultation", 0.7], ["weight loss", 0.4], ["cyanosis", 0.3]
    ]],
    ["Acute Respiratory Distress Syndrome", "pulmonology", [
      ["severe dyspnea", 0.95], ["tachypnea", 0.9], ["hypoxia", 0.95],
      ["cyanosis", 0.6], ["tachycardia", 0.7], ["accessory muscle use", 0.7],
      ["crackles on auscultation", 0.6], ["confusion", 0.4], ["diaphoresis", 0.4]
    ]],
    ["Pulmonary Hypertension", "pulmonology", [
      ["dyspnea on exertion", 0.9], ["fatigue", 0.8], ["chest pain", 0.5],
      ["syncope", 0.5], ["peripheral edema", 0.6], ["palpitations", 0.4],
      ["dizziness", 0.4], ["cyanosis", 0.3], ["jugular venous distension", 0.5]
    ]],
  ];

  // Process all entries
  const allEntries = [...cardiology, ...pulmonology];
  let totalInserted = 0;
  let totalErrors = 0;

  for (const [diseaseName, category, symptoms] of allEntries) {
    const diagId = await getOrCreateDiagnosis(diseaseName, category);
    if (!diagId) { totalErrors++; continue; }

    const rows: { symptom_id: string; diagnosis_id: string; likelihood_value: number }[] = [];

    for (const [symptomName, likelihood] of symptoms) {
      if (likelihood < 0.3) continue; // Reject weak signals
      const symId = await getOrCreateSymptom(symptomName, category);
      if (!symId) continue;
      rows.push({ symptom_id: symId, diagnosis_id: diagId, likelihood_value: likelihood });
    }

    if (rows.length > 0) {
      const { error } = await supabase.from("symptom_likelihoods")
        .upsert(rows, { onConflict: "symptom_id,diagnosis_id", ignoreDuplicates: false });
      if (error) {
        results.push(`Upsert err ${diseaseName}: ${error.message}`);
        totalErrors++;
      } else {
        totalInserted += rows.length;
      }
    }
  }

  // Get counts
  const { count: likCount } = await supabase.from("symptom_likelihoods").select("*", { count: "exact", head: true });
  const { count: symCount } = await supabase.from("symptoms").select("*", { count: "exact", head: true });
  const { count: diagCount } = await supabase.from("diagnoses").select("*", { count: "exact", head: true });

  return new Response(JSON.stringify({
    batch: "cardio-pulm",
    diseases_processed: allEntries.length,
    likelihoods_upserted: totalInserted,
    errors: totalErrors,
    error_details: results.slice(0, 20),
    graph_counts: { diagnoses: diagCount, symptoms: symCount, symptom_likelihoods: likCount }
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
