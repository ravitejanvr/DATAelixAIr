/**
 * Knowledge Extraction Pipeline — Public API
 */
export {
  runKnowledgeExtraction,
  getGraphCoverage,
  getUnderconnectedDiseases,
} from "./client";

export type {
  ExtractionPipelineResult,
  ExtractionPipelineStat,
  DiseaseExtractionResult,
  ExtractionInsertCounts,
} from "./client";
