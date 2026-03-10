/**
 * Clinical Pipeline Orchestrator
 * 
 * Modular pipeline that coordinates all service layers in sequence.
 * Each stage is optional and logged. The orchestrator checks the
 * feature flag before running — if disabled, it no-ops gracefully.
 * 
 * Pipeline stages:
 *   1. build_context()        → Clinical Context Engine
 *   2. generate_hypotheses()  → Diagnostic Hypothesis Engine
 *   3. retrieve_guidelines()  → Guideline Alignment Engine
 *   4. validate_safety()      → Existing clinical-safety edge function
 *   5. generate_suggestions() → Existing smart-suggestions edge function
 *   6. oversight_report()     → Clinical Oversight Engine
 */

import { isNewPipelineEnabled } from "@/services/feature_flags";
import { withStageLogging, clearPipelineLogs, getPipelineLogs } from "@/services/pipeline_logger";
import { 
  buildEnrichedContext, 
  validateContextCompleteness,
  type EnrichedClinicalContext 
} from "@/services/clinical_context";
import type { ClinicalContext } from "@/lib/clinical-context";
import { generateHypotheses, type HypothesisResult } from "@/services/hypothesis_engine";
import { evaluateGuidelineAlignment, type GuidelineAlignmentResult } from "@/services/guideline_engine";
import { 
  recordOversightEvent, 
  generateOversightReport, 
  clearOversightEvents,
  type OversightReport 
} from "@/services/oversight_engine";
import { queryEvidence, type EvidenceQueryResult } from "@/services/knowledge_ingestion";

export interface PipelineInput {
  clinical_context: ClinicalContext;
  visit_id?: string | null;
  consultation_id?: string | null;
  clinic_id?: string | null;
  intake_approved?: boolean;
  /** Optional: pre-extracted recommendations to evaluate */
  recommendations?: {
    diagnosis?: string;
    drugs?: string[];
    labs?: string[];
    care_plan?: string;
  };
}

export interface PipelineResult {
  enabled: boolean;
  enriched_context: EnrichedClinicalContext | null;
  hypotheses: HypothesisResult | null;
  guideline_alignment: GuidelineAlignmentResult | null;
  evidence: EvidenceQueryResult | null;
  oversight: OversightReport | null;
  /** Structured guideline output for downstream consumers */
  guideline_summary: {
    guideline_sources_used: string[];
    guideline_compliance_score: number;
    conflicts_detected: Array<{ recommendation: string; conflicting_guideline: string; organization: string; severity: string; explanation: string }>;
  } | null;
  logs: ReturnType<typeof getPipelineLogs>;
}

/**
 * Run the full clinical pipeline.
 * Returns immediately with { enabled: false } if the feature flag is off.
 */
export async function runClinicalPipeline(input: PipelineInput): Promise<PipelineResult> {
  if (!isNewPipelineEnabled()) {
    console.log("[Pipeline] New clinical pipeline is disabled. Using legacy flow.");
    return {
      enabled: false,
      enriched_context: null,
      hypotheses: null,
      guideline_alignment: null,
      evidence: null,
      oversight: null,
      guideline_summary: null,
      logs: [],
    };
  }

  clearPipelineLogs();
  clearOversightEvents();
  console.log("[Pipeline] Starting modular clinical pipeline...");

  // Stage 1: Build Context
  const enrichedContext = await withStageLogging("build_context", async () => {
    const ctx = buildEnrichedContext(input.clinical_context, {
      visit_id: input.visit_id,
      consultation_id: input.consultation_id,
      clinic_id: input.clinic_id,
      intake_approved: input.intake_approved,
    });

    const missing = validateContextCompleteness(input.clinical_context);
    if (missing.length > 0) {
      recordOversightEvent({
        event_type: "context_incomplete",
        severity: missing.includes("chief_complaint") ? "warning" : "info",
        stage: "build_context",
        message: `Missing fields: ${missing.join(", ")}`,
        metadata: { missing_fields: missing },
      });
    }

    return ctx;
  });

  // Stage 2: Generate Hypotheses
  let hypotheses: HypothesisResult | null = null;
  try {
    hypotheses = await withStageLogging("generate_hypotheses", async () => {
      const result = await generateHypotheses(enrichedContext);
      if (result.hypotheses.length === 0) {
        recordOversightEvent({
          event_type: "hypothesis_low_confidence",
          severity: "info",
          stage: "generate_hypotheses",
          message: "No hypotheses generated (stub mode or insufficient data)",
        });
      }
      return result;
    });
  } catch {
    hypotheses = null;
  }

  // Stage 3: Retrieve Evidence
  let evidence: EvidenceQueryResult | null = null;
  if (input.clinical_context.chief_complaint) {
    try {
      evidence = await withStageLogging("retrieve_evidence", async () => {
        return await queryEvidence(input.clinical_context.chief_complaint, { maxResults: 5 });
      });
    } catch {
      evidence = null;
    }
  }

  // Stage 4: Guideline Alignment
  let guidelineAlignment: GuidelineAlignmentResult | null = null;
  if (input.recommendations) {
    try {
      guidelineAlignment = await withStageLogging("retrieve_guidelines", async () => {
        return await evaluateGuidelineAlignment(input.recommendations!, enrichedContext);
      });
    } catch {
      guidelineAlignment = null;
    }
  }

  // Stage 5: Oversight Report
  const oversight = await withStageLogging("oversight_report", async () => {
    return generateOversightReport(
      input.visit_id ?? null,
      input.consultation_id ?? null
    );
  });

  console.log(`[Pipeline] Complete. Safety score: ${oversight.safety_score}/100`);

  // Build guideline summary for downstream consumers
  const guideline_summary = guidelineAlignment
    ? {
        guideline_sources_used: guidelineAlignment.guideline_sources_used,
        guideline_compliance_score: guidelineAlignment.guideline_compliance_score,
        conflicts_detected: guidelineAlignment.conflicts_detected,
      }
    : null;

  return {
    enabled: true,
    enriched_context: enrichedContext,
    hypotheses,
    guideline_alignment: guidelineAlignment,
    evidence,
    oversight,
    guideline_summary,
    logs: getPipelineLogs(),
  };
}
