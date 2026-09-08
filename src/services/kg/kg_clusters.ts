/**
 * KG Cluster → Diagnosis Mapping
 *
 * Single source of truth for which diagnoses belong to each clinical cluster.
 * This consolidates duplicate mappings previously scattered across:
 *   - failure_derived_rules.ts (direct injection)
 *   - context_candidate_expander.ts (phenotype/rare hints)
 *   - candidate_fallback_v2.ts (weighted rules)
 *
 * DB tables `cluster_nodes` + `cluster_disease_edges` are used server-side by DDX.
 * This client-side mapping mirrors them for pre-DDX candidate generation.
 */

export interface ClusterDiagnosis {
  diagnosis_name: string;
  /** Base relevance within this cluster (0–1). Modulated by activation weight. */
  base_relevance: number;
  must_not_miss: boolean;
  category: string;
  /**
   * A7.1 additive fields (optional, dormant).
   * Populated from `public.kg_concept_bindings` when
   * `enable_kg_terminology_binding` is on. UNUSED by reasoning today —
   * kept to avoid a second type migration in A7.2.
   */
  canonical_id?: string;
  snomed_id?: string;
}

export interface ClusterDefinition {
  cluster_id: string;
  cluster_name: string;
  diagnoses: ClusterDiagnosis[];
}

// ── Cluster Registry ──

const CLUSTER_REGISTRY: Record<string, ClusterDiagnosis[]> = {

  // ── Cardiac ──
  atypical_cardiac: [
    { diagnosis_name: "Myocardial Infarction", base_relevance: 0.9, must_not_miss: true, category: "cardiovascular", snomed_id: "22298006" },
    { diagnosis_name: "Cardiac Tamponade", base_relevance: 0.7, must_not_miss: true, category: "cardiovascular", snomed_id: "35304003" },
    { diagnosis_name: "Complete Heart Block", base_relevance: 0.6, must_not_miss: true, category: "cardiovascular", snomed_id: "27885002" },
    { diagnosis_name: "WPW Syndrome", base_relevance: 0.5, must_not_miss: false, category: "cardiovascular", snomed_id: "719020006" },
    { diagnosis_name: "SVT", base_relevance: 0.5, must_not_miss: false, category: "cardiovascular", snomed_id: "6456007" },
    { diagnosis_name: "Acute Coronary Syndrome", base_relevance: 0.85, must_not_miss: true, category: "cardiovascular", snomed_id: "394659003" },
    { diagnosis_name: "Unstable Angina", base_relevance: 0.7, must_not_miss: true, category: "cardiovascular", snomed_id: "4557003" },
    { diagnosis_name: "Infective Endocarditis", base_relevance: 0.6, must_not_miss: true, category: "cardiovascular", snomed_id: "233850007" },
  ],

  // ── Respiratory ──
  respiratory: [
    { diagnosis_name: "Pulmonary Embolism", base_relevance: 0.85, must_not_miss: true, category: "respiratory", snomed_id: "59282003" },
    { diagnosis_name: "Asthma Exacerbation", base_relevance: 0.6, must_not_miss: false, category: "respiratory", snomed_id: "281239006" },
    { diagnosis_name: "Pneumonia", base_relevance: 0.65, must_not_miss: false, category: "respiratory", snomed_id: "233604007" },
    { diagnosis_name: "Pneumothorax", base_relevance: 0.6, must_not_miss: true, category: "respiratory", snomed_id: "36118008" },
    { diagnosis_name: "COPD Exacerbation", base_relevance: 0.55, must_not_miss: false, category: "respiratory", snomed_id: "195951007" },
    { diagnosis_name: "Lung Cancer", base_relevance: 0.35, must_not_miss: false, category: "oncological", snomed_id: "363358000" },
  ],

  // ── Neurological ──
  atypical_neuro: [
    { diagnosis_name: "Posterior Circulation Stroke", base_relevance: 0.75, must_not_miss: true, category: "neurological", snomed_id: "230696001" },
    { diagnosis_name: "Epidural Hematoma", base_relevance: 0.7, must_not_miss: true, category: "neurological", snomed_id: "703861005" },
    { diagnosis_name: "Non-Convulsive Status Epilepticus", base_relevance: 0.65, must_not_miss: true, category: "neurological", snomed_id: "13973009" },
    { diagnosis_name: "Idiopathic Intracranial Hypertension", base_relevance: 0.5, must_not_miss: false, category: "neurological", snomed_id: "68267002" },
    { diagnosis_name: "Stroke", base_relevance: 0.85, must_not_miss: true, category: "neurological", snomed_id: "230690007" },
    { diagnosis_name: "Meningitis", base_relevance: 0.75, must_not_miss: true, category: "infectious", snomed_id: "7180009" },
    { diagnosis_name: "Subarachnoid Hemorrhage", base_relevance: 0.7, must_not_miss: true, category: "neurological", snomed_id: "21454007" },
    { diagnosis_name: "Giant Cell Arteritis", base_relevance: 0.55, must_not_miss: true, category: "neurological", snomed_id: "414341000" },
    { diagnosis_name: "Guillain-Barré Syndrome", base_relevance: 0.5, must_not_miss: true, category: "neurological", snomed_id: "40956001" },
    { diagnosis_name: "Normal Pressure Hydrocephalus", base_relevance: 0.5, must_not_miss: false, category: "neurological", snomed_id: "30753002" },
    { diagnosis_name: "Myasthenia Gravis", base_relevance: 0.45, must_not_miss: false, category: "neurological", snomed_id: "91637004" },
  ],

  // ── Rare Infectious / Airway ──
  rare_infectious: [
    { diagnosis_name: "Necrotizing Fasciitis", base_relevance: 0.85, must_not_miss: true, category: "surgical", snomed_id: "52486002" },
    { diagnosis_name: "Epiglottitis", base_relevance: 0.75, must_not_miss: true, category: "infectious", snomed_id: "80384002" },
    { diagnosis_name: "Meningococcal Septicemia", base_relevance: 0.8, must_not_miss: true, category: "infectious", snomed_id: "772165002" },
    { diagnosis_name: "Peritonsillar Abscess", base_relevance: 0.6, must_not_miss: false, category: "infectious", snomed_id: "15033003" },
  ],

  // ── Context-Dependent (History-Triggered) ──
  context_dependent: [
    { diagnosis_name: "Metastatic Spinal Cord Compression", base_relevance: 0.75, must_not_miss: true, category: "oncological", snomed_id: "713425003" },
    { diagnosis_name: "Hypercalcemia of Malignancy", base_relevance: 0.7, must_not_miss: true, category: "oncological", snomed_id: "47709007" },
    { diagnosis_name: "Paracetamol Hepatotoxicity", base_relevance: 0.8, must_not_miss: true, category: "toxicological", snomed_id: "295124009" },
    { diagnosis_name: "Acute Liver Failure", base_relevance: 0.6, must_not_miss: true, category: "hepatological", snomed_id: "197270009" },
    { diagnosis_name: "Upper Extremity DVT", base_relevance: 0.65, must_not_miss: false, category: "vascular", snomed_id: "53120007" },
  ],

  // ── Hemodynamic Instability ──
  hemodynamic_instability: [
    { diagnosis_name: "Ruptured AAA", base_relevance: 0.85, must_not_miss: true, category: "vascular", snomed_id: "14336007" },
    { diagnosis_name: "Massive Pulmonary Embolism", base_relevance: 0.8, must_not_miss: true, category: "respiratory", snomed_id: "233936003" },
    { diagnosis_name: "Ruptured Ectopic Pregnancy", base_relevance: 0.8, must_not_miss: true, category: "obstetric", snomed_id: "17433009" },
    { diagnosis_name: "Adrenal Crisis", base_relevance: 0.75, must_not_miss: true, category: "endocrine", snomed_id: "766986002" },
  ],

  // ── Pediatric/Surgical ──
  pediatric_surgical: [
    { diagnosis_name: "Strangulated Inguinal Hernia", base_relevance: 0.8, must_not_miss: true, category: "surgical", snomed_id: "236024003" },
    { diagnosis_name: "Pyloric Stenosis", base_relevance: 0.7, must_not_miss: true, category: "surgical", snomed_id: "367403001" },
    { diagnosis_name: "Intussusception", base_relevance: 0.7, must_not_miss: true, category: "surgical", snomed_id: "41444002" },
    { diagnosis_name: "Compartment Syndrome", base_relevance: 0.75, must_not_miss: true, category: "surgical", snomed_id: "111245009" },
  ],

  // ── Chronic/Subacute ──
  chronic_subacute: [
    { diagnosis_name: "Chronic Mesenteric Ischemia", base_relevance: 0.55, must_not_miss: true, category: "vascular", snomed_id: "111354009" },
  ],

  // ── Toxicological ──
  toxicological: [
    { diagnosis_name: "Carbon Monoxide Poisoning", base_relevance: 0.8, must_not_miss: true, category: "toxicological", snomed_id: "17383000" },
    { diagnosis_name: "Organophosphate Poisoning", base_relevance: 0.8, must_not_miss: true, category: "toxicological", snomed_id: "8260003" },
    { diagnosis_name: "Lithium Toxicity", base_relevance: 0.7, must_not_miss: true, category: "toxicological", snomed_id: "290802009" },
    { diagnosis_name: "Serotonin Syndrome", base_relevance: 0.7, must_not_miss: true, category: "toxicological", snomed_id: "371089000" },
    { diagnosis_name: "Neuroleptic Malignant Syndrome", base_relevance: 0.65, must_not_miss: true, category: "neurological", snomed_id: "15244003" },
  ],

  // ── Abdominal ──
  abdominal: [
    { diagnosis_name: "Appendicitis", base_relevance: 0.7, must_not_miss: true, category: "gastrointestinal", snomed_id: "74400008" },
    { diagnosis_name: "Cholecystitis", base_relevance: 0.6, must_not_miss: false, category: "gastrointestinal", snomed_id: "76581006" },
    { diagnosis_name: "Pancreatitis", base_relevance: 0.6, must_not_miss: false, category: "gastrointestinal", snomed_id: "75694006" },
    { diagnosis_name: "Bowel Obstruction", base_relevance: 0.65, must_not_miss: true, category: "gastrointestinal", snomed_id: "81060008" },
    { diagnosis_name: "Alcoholic Hepatitis", base_relevance: 0.5, must_not_miss: false, category: "gastrointestinal", snomed_id: "235875008" },
    { diagnosis_name: "Acute Pancreatitis", base_relevance: 0.55, must_not_miss: false, category: "gastrointestinal", snomed_id: "197456007" },
  ],

  // ── Sepsis ──
  sepsis: [
    { diagnosis_name: "Sepsis", base_relevance: 0.9, must_not_miss: true, category: "infectious", snomed_id: "91302008" },
    { diagnosis_name: "Urinary Tract Infection", base_relevance: 0.5, must_not_miss: false, category: "renal", snomed_id: "68566005" },
    { diagnosis_name: "Opportunistic Infection", base_relevance: 0.45, must_not_miss: false, category: "infectious", snomed_id: "1010268001" },
    { diagnosis_name: "Tuberculosis", base_relevance: 0.4, must_not_miss: false, category: "infectious", snomed_id: "56717001" },
  ],

  // ── Endocrine ──
  endocrine: [
    { diagnosis_name: "Diabetic Ketoacidosis", base_relevance: 0.8, must_not_miss: true, category: "endocrine", snomed_id: "420422005" },
    { diagnosis_name: "Type 2 Diabetes Mellitus", base_relevance: 0.5, must_not_miss: false, category: "endocrine", snomed_id: "44054006" },
    { diagnosis_name: "Hyperthyroidism", base_relevance: 0.4, must_not_miss: false, category: "endocrine", snomed_id: "34486009" },
    { diagnosis_name: "Adrenal Insufficiency", base_relevance: 0.5, must_not_miss: false, category: "endocrine", snomed_id: "386584007" },
    { diagnosis_name: "Cushing Syndrome", base_relevance: 0.4, must_not_miss: false, category: "endocrine", snomed_id: "47270006" },
  ],

  // ── Allergic/Immunological ──
  allergic: [
    { diagnosis_name: "Anaphylaxis", base_relevance: 0.9, must_not_miss: true, category: "immunological", snomed_id: "39579001" },
    { diagnosis_name: "Angioedema", base_relevance: 0.7, must_not_miss: true, category: "immunological", snomed_id: "846575004" },
    { diagnosis_name: "Drug Reaction", base_relevance: 0.4, must_not_miss: false, category: "dermatological", snomed_id: "62014003" },
  ],

  // ── Spinal ──
  spinal: [
    { diagnosis_name: "Cauda Equina Syndrome", base_relevance: 0.85, must_not_miss: true, category: "neurological", snomed_id: "192970008" },
    { diagnosis_name: "Spinal Cord Compression", base_relevance: 0.75, must_not_miss: true, category: "neurological", snomed_id: "71286001" },
  ],

  // ── Surgical ──
  surgical: [
    { diagnosis_name: "Fournier Gangrene", base_relevance: 0.8, must_not_miss: true, category: "surgical", snomed_id: "398318005" },
    { diagnosis_name: "Testicular Torsion", base_relevance: 0.8, must_not_miss: true, category: "urological", snomed_id: "81996005" },
    { diagnosis_name: "Epididymitis", base_relevance: 0.4, must_not_miss: false, category: "urological", snomed_id: "31070006" },
  ],

  // ── Ophthalmological/Pediatric ──
  pediatric_ophtho: [
    { diagnosis_name: "Retinoblastoma", base_relevance: 0.8, must_not_miss: true, category: "oncological", snomed_id: "370967009" },
    { diagnosis_name: "Congenital Cataract", base_relevance: 0.35, must_not_miss: false, category: "ophthalmological", snomed_id: "79410001" },
    { diagnosis_name: "Kawasaki Disease", base_relevance: 0.5, must_not_miss: true, category: "immunological", snomed_id: "75053002" },
    { diagnosis_name: "Measles", base_relevance: 0.35, must_not_miss: false, category: "infectious", snomed_id: "14189004" },
  ],

  // ── Obstetric ──
  obstetric: [
    { diagnosis_name: "Pre-eclampsia", base_relevance: 0.8, must_not_miss: true, category: "obstetric", snomed_id: "398254007" },
    { diagnosis_name: "HELLP Syndrome", base_relevance: 0.6, must_not_miss: true, category: "obstetric", snomed_id: "95605009" },
    { diagnosis_name: "Ectopic Pregnancy", base_relevance: 0.7, must_not_miss: true, category: "obstetric", snomed_id: "34801009" },
    { diagnosis_name: "Ovarian Torsion", base_relevance: 0.55, must_not_miss: true, category: "surgical", snomed_id: "13595002" },
  ],

  // ── Vascular ──
  vascular: [
    { diagnosis_name: "Aortic Dissection", base_relevance: 0.85, must_not_miss: true, category: "vascular", snomed_id: "308546005" },
    { diagnosis_name: "Hypertensive Emergency", base_relevance: 0.7, must_not_miss: true, category: "cardiovascular", snomed_id: "132721000119104" },
    { diagnosis_name: "Deep Vein Thrombosis", base_relevance: 0.55, must_not_miss: false, category: "vascular", snomed_id: "128053003" },
    { diagnosis_name: "Surgical Site Infection", base_relevance: 0.45, must_not_miss: false, category: "infectious", snomed_id: "433202001" },
  ],

  // ── Diabetic ──
  diabetic: [
    { diagnosis_name: "Diabetic Foot Infection", base_relevance: 0.65, must_not_miss: false, category: "infectious", snomed_id: "280137006" },
    { diagnosis_name: "Osteomyelitis", base_relevance: 0.5, must_not_miss: false, category: "infectious", snomed_id: "60168000" },
  ],

  // ── Elderly ──
  elderly_confusion: [
    { diagnosis_name: "Urinary Tract Infection", base_relevance: 0.55, must_not_miss: false, category: "renal", snomed_id: "68566005" },
    { diagnosis_name: "Delirium", base_relevance: 0.65, must_not_miss: false, category: "neurological", snomed_id: "2776000" },
  ],

  // ── Pheochromocytoma (rare endocrine) ──
  pheochromocytoma: [
    { diagnosis_name: "Pheochromocytoma", base_relevance: 0.5, must_not_miss: false, category: "endocrine", snomed_id: "302835009" },
  ],
};

/**
 * Look up diagnoses for a given cluster node.
 * Returns empty array if cluster is unknown (graceful degradation).
 */
export function getClusterDiagnoses(clusterId: string): ClusterDiagnosis[] {
  return CLUSTER_REGISTRY[clusterId] || [];
}

/**
 * Get all known cluster IDs.
 */
export function getAllClusterIds(): string[] {
  return Object.keys(CLUSTER_REGISTRY);
}

/**
 * Get total diagnosis count across all clusters (for audit).
 */
export function getClusterStats(): { clusters: number; total_diagnoses: number } {
  const clusters = Object.keys(CLUSTER_REGISTRY).length;
  const total_diagnoses = Object.values(CLUSTER_REGISTRY).reduce((sum, d) => sum + d.length, 0);
  return { clusters, total_diagnoses };
}
