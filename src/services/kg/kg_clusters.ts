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
    { diagnosis_name: "Myocardial Infarction", base_relevance: 0.9, must_not_miss: true, category: "cardiovascular" },
    { diagnosis_name: "Cardiac Tamponade", base_relevance: 0.7, must_not_miss: true, category: "cardiovascular" },
    { diagnosis_name: "Complete Heart Block", base_relevance: 0.6, must_not_miss: true, category: "cardiovascular" },
    { diagnosis_name: "WPW Syndrome", base_relevance: 0.5, must_not_miss: false, category: "cardiovascular" },
    { diagnosis_name: "SVT", base_relevance: 0.5, must_not_miss: false, category: "cardiovascular" },
    { diagnosis_name: "Acute Coronary Syndrome", base_relevance: 0.85, must_not_miss: true, category: "cardiovascular" },
    { diagnosis_name: "Unstable Angina", base_relevance: 0.7, must_not_miss: true, category: "cardiovascular" },
    { diagnosis_name: "Infective Endocarditis", base_relevance: 0.6, must_not_miss: true, category: "cardiovascular" },
    { diagnosis_name: "Atrial Fibrillation", base_relevance: 0.55, must_not_miss: false, category: "cardiovascular" },
    { diagnosis_name: "Stable Angina", base_relevance: 0.5, must_not_miss: false, category: "cardiovascular" },
    { diagnosis_name: "Pericardial Effusion", base_relevance: 0.55, must_not_miss: false, category: "cardiovascular" },
    { diagnosis_name: "Heart Failure", base_relevance: 0.6, must_not_miss: false, category: "cardiovascular" },
  ],

  // ── Respiratory ──
  respiratory: [
    { diagnosis_name: "Pulmonary Embolism", base_relevance: 0.85, must_not_miss: true, category: "respiratory" },
    { diagnosis_name: "Asthma Exacerbation", base_relevance: 0.6, must_not_miss: false, category: "respiratory" },
    { diagnosis_name: "Pneumonia", base_relevance: 0.65, must_not_miss: false, category: "respiratory" },
    { diagnosis_name: "Pneumothorax", base_relevance: 0.6, must_not_miss: true, category: "respiratory" },
    { diagnosis_name: "COPD Exacerbation", base_relevance: 0.55, must_not_miss: false, category: "respiratory" },
    { diagnosis_name: "Lung Cancer", base_relevance: 0.35, must_not_miss: false, category: "oncological" },
    { diagnosis_name: "Pleural Effusion", base_relevance: 0.5, must_not_miss: false, category: "respiratory" },
    { diagnosis_name: "Vocal Cord Dysfunction", base_relevance: 0.4, must_not_miss: false, category: "respiratory" },
  ],

  // ── Neurological ──
  atypical_neuro: [
    { diagnosis_name: "Posterior Circulation Stroke", base_relevance: 0.75, must_not_miss: true, category: "neurological" },
    { diagnosis_name: "Epidural Hematoma", base_relevance: 0.7, must_not_miss: true, category: "neurological" },
    { diagnosis_name: "Non-Convulsive Status Epilepticus", base_relevance: 0.65, must_not_miss: true, category: "neurological" },
    { diagnosis_name: "Idiopathic Intracranial Hypertension", base_relevance: 0.5, must_not_miss: false, category: "neurological" },
    { diagnosis_name: "Stroke", base_relevance: 0.85, must_not_miss: true, category: "neurological" },
    { diagnosis_name: "Meningitis", base_relevance: 0.75, must_not_miss: true, category: "infectious" },
    { diagnosis_name: "Subarachnoid Hemorrhage", base_relevance: 0.7, must_not_miss: true, category: "neurological" },
    { diagnosis_name: "Giant Cell Arteritis", base_relevance: 0.55, must_not_miss: true, category: "neurological" },
    { diagnosis_name: "Guillain-Barré Syndrome", base_relevance: 0.5, must_not_miss: true, category: "neurological" },
    { diagnosis_name: "Normal Pressure Hydrocephalus", base_relevance: 0.5, must_not_miss: false, category: "neurological" },
    { diagnosis_name: "Myasthenia Gravis", base_relevance: 0.45, must_not_miss: false, category: "neurological" },
    { diagnosis_name: "Multiple Sclerosis", base_relevance: 0.45, must_not_miss: false, category: "neurological" },
    { diagnosis_name: "Status Epilepticus", base_relevance: 0.6, must_not_miss: true, category: "neurological" },
    { diagnosis_name: "Seizure", base_relevance: 0.5, must_not_miss: false, category: "neurological" },
    { diagnosis_name: "Conversion Disorder", base_relevance: 0.4, must_not_miss: false, category: "neurological" },
  ],

  // ── Rare Infectious / Airway ──
  rare_infectious: [
    { diagnosis_name: "Necrotizing Fasciitis", base_relevance: 0.85, must_not_miss: true, category: "surgical" },
    { diagnosis_name: "Epiglottitis", base_relevance: 0.75, must_not_miss: true, category: "infectious" },
    { diagnosis_name: "Meningococcal Septicemia", base_relevance: 0.8, must_not_miss: true, category: "infectious" },
    { diagnosis_name: "Peritonsillar Abscess", base_relevance: 0.6, must_not_miss: false, category: "infectious" },
    { diagnosis_name: "Infectious Mononucleosis", base_relevance: 0.45, must_not_miss: false, category: "infectious" },
  ],

  // ── Context-Dependent (History-Triggered) ──
  context_dependent: [
    { diagnosis_name: "Metastatic Spinal Cord Compression", base_relevance: 0.75, must_not_miss: true, category: "oncological" },
    { diagnosis_name: "Hypercalcemia of Malignancy", base_relevance: 0.7, must_not_miss: true, category: "oncological" },
    { diagnosis_name: "Paracetamol Hepatotoxicity", base_relevance: 0.8, must_not_miss: true, category: "toxicological" },
    { diagnosis_name: "Acute Liver Failure", base_relevance: 0.6, must_not_miss: true, category: "hepatological" },
    { diagnosis_name: "Upper Extremity DVT", base_relevance: 0.65, must_not_miss: false, category: "vascular" },
    { diagnosis_name: "Lymphoma", base_relevance: 0.5, must_not_miss: false, category: "oncological" },
  ],

  // ── Hemodynamic Instability ──
  hemodynamic_instability: [
    { diagnosis_name: "Ruptured AAA", base_relevance: 0.85, must_not_miss: true, category: "vascular" },
    { diagnosis_name: "Massive Pulmonary Embolism", base_relevance: 0.8, must_not_miss: true, category: "respiratory" },
    { diagnosis_name: "Ruptured Ectopic Pregnancy", base_relevance: 0.8, must_not_miss: true, category: "obstetric" },
    { diagnosis_name: "Adrenal Crisis", base_relevance: 0.75, must_not_miss: true, category: "endocrine" },
  ],

  // ── Pediatric/Surgical ──
  pediatric_surgical: [
    { diagnosis_name: "Strangulated Inguinal Hernia", base_relevance: 0.8, must_not_miss: true, category: "surgical" },
    { diagnosis_name: "Pyloric Stenosis", base_relevance: 0.7, must_not_miss: true, category: "surgical" },
    { diagnosis_name: "Intussusception", base_relevance: 0.7, must_not_miss: true, category: "surgical" },
    { diagnosis_name: "Compartment Syndrome", base_relevance: 0.75, must_not_miss: true, category: "surgical" },
    { diagnosis_name: "Non-Accidental Injury", base_relevance: 0.5, must_not_miss: true, category: "pediatric" },
  ],

  // ── Chronic/Subacute ──
  chronic_subacute: [
    { diagnosis_name: "Chronic Mesenteric Ischemia", base_relevance: 0.55, must_not_miss: true, category: "vascular" },
    { diagnosis_name: "Mesenteric Ischemia", base_relevance: 0.6, must_not_miss: true, category: "vascular" },
  ],

  // ── Toxicological ──
  toxicological: [
    { diagnosis_name: "Carbon Monoxide Poisoning", base_relevance: 0.8, must_not_miss: true, category: "toxicological" },
    { diagnosis_name: "Organophosphate Poisoning", base_relevance: 0.8, must_not_miss: true, category: "toxicological" },
    { diagnosis_name: "Lithium Toxicity", base_relevance: 0.7, must_not_miss: true, category: "toxicological" },
    { diagnosis_name: "Serotonin Syndrome", base_relevance: 0.7, must_not_miss: true, category: "toxicological" },
    { diagnosis_name: "Neuroleptic Malignant Syndrome", base_relevance: 0.65, must_not_miss: true, category: "neurological" },
  ],

  // ── Abdominal ──
  abdominal: [
    { diagnosis_name: "Appendicitis", base_relevance: 0.7, must_not_miss: true, category: "gastrointestinal" },
    { diagnosis_name: "Cholecystitis", base_relevance: 0.6, must_not_miss: false, category: "gastrointestinal" },
    { diagnosis_name: "Pancreatitis", base_relevance: 0.6, must_not_miss: false, category: "gastrointestinal" },
    { diagnosis_name: "Bowel Obstruction", base_relevance: 0.65, must_not_miss: true, category: "gastrointestinal" },
    { diagnosis_name: "Alcoholic Hepatitis", base_relevance: 0.5, must_not_miss: false, category: "gastrointestinal" },
    { diagnosis_name: "Acute Pancreatitis", base_relevance: 0.55, must_not_miss: false, category: "gastrointestinal" },
    { diagnosis_name: "Perforated Viscus", base_relevance: 0.6, must_not_miss: true, category: "gastrointestinal" },
  ],

  // ── Sepsis ──
  sepsis: [
    { diagnosis_name: "Sepsis", base_relevance: 0.9, must_not_miss: true, category: "infectious" },
    { diagnosis_name: "Urinary Tract Infection", base_relevance: 0.5, must_not_miss: false, category: "renal" },
    { diagnosis_name: "Opportunistic Infection", base_relevance: 0.45, must_not_miss: false, category: "infectious" },
    { diagnosis_name: "Tuberculosis", base_relevance: 0.4, must_not_miss: false, category: "infectious" },
  ],

  // ── Endocrine ──
  endocrine: [
    { diagnosis_name: "Diabetic Ketoacidosis", base_relevance: 0.8, must_not_miss: true, category: "endocrine" },
    { diagnosis_name: "Type 2 Diabetes Mellitus", base_relevance: 0.5, must_not_miss: false, category: "endocrine" },
    { diagnosis_name: "Hyperthyroidism", base_relevance: 0.4, must_not_miss: false, category: "endocrine" },
    { diagnosis_name: "Adrenal Insufficiency", base_relevance: 0.5, must_not_miss: false, category: "endocrine" },
    { diagnosis_name: "Cushing Syndrome", base_relevance: 0.4, must_not_miss: false, category: "endocrine" },
  ],

  // ── Allergic/Immunological ──
  allergic: [
    { diagnosis_name: "Anaphylaxis", base_relevance: 0.9, must_not_miss: true, category: "immunological" },
    { diagnosis_name: "Angioedema", base_relevance: 0.7, must_not_miss: true, category: "immunological" },
    { diagnosis_name: "Drug Reaction", base_relevance: 0.4, must_not_miss: false, category: "dermatological" },
    { diagnosis_name: "SLE", base_relevance: 0.45, must_not_miss: false, category: "immunological" },
  ],

  // ── Spinal ──
  spinal: [
    { diagnosis_name: "Cauda Equina Syndrome", base_relevance: 0.85, must_not_miss: true, category: "neurological" },
    { diagnosis_name: "Spinal Cord Compression", base_relevance: 0.75, must_not_miss: true, category: "neurological" },
    { diagnosis_name: "Spinal Stenosis", base_relevance: 0.5, must_not_miss: false, category: "neurological" },
  ],

  // ── Surgical ──
  surgical: [
    { diagnosis_name: "Fournier Gangrene", base_relevance: 0.8, must_not_miss: true, category: "surgical" },
    { diagnosis_name: "Testicular Torsion", base_relevance: 0.8, must_not_miss: true, category: "urological" },
    { diagnosis_name: "Epididymitis", base_relevance: 0.4, must_not_miss: false, category: "urological" },
  ],

  // ── Ophthalmological/Pediatric ──
  pediatric_ophtho: [
    { diagnosis_name: "Retinoblastoma", base_relevance: 0.8, must_not_miss: true, category: "oncological" },
    { diagnosis_name: "Congenital Cataract", base_relevance: 0.35, must_not_miss: false, category: "ophthalmological" },
    { diagnosis_name: "Kawasaki Disease", base_relevance: 0.5, must_not_miss: true, category: "immunological" },
    { diagnosis_name: "Measles", base_relevance: 0.35, must_not_miss: false, category: "infectious" },
  ],

  // ── Obstetric ──
  obstetric: [
    { diagnosis_name: "Pre-eclampsia", base_relevance: 0.8, must_not_miss: true, category: "obstetric" },
    { diagnosis_name: "HELLP Syndrome", base_relevance: 0.6, must_not_miss: true, category: "obstetric" },
    { diagnosis_name: "Ectopic Pregnancy", base_relevance: 0.7, must_not_miss: true, category: "obstetric" },
    { diagnosis_name: "Ovarian Torsion", base_relevance: 0.55, must_not_miss: true, category: "surgical" },
  ],

  // ── Vascular ──
  vascular: [
    { diagnosis_name: "Aortic Dissection", base_relevance: 0.85, must_not_miss: true, category: "vascular" },
    { diagnosis_name: "Hypertensive Emergency", base_relevance: 0.7, must_not_miss: true, category: "cardiovascular" },
    { diagnosis_name: "Deep Vein Thrombosis", base_relevance: 0.55, must_not_miss: false, category: "vascular" },
    { diagnosis_name: "Surgical Site Infection", base_relevance: 0.45, must_not_miss: false, category: "infectious" },
  ],

  // ── Diabetic ──
  diabetic: [
    { diagnosis_name: "Diabetic Foot Infection", base_relevance: 0.65, must_not_miss: false, category: "infectious" },
    { diagnosis_name: "Osteomyelitis", base_relevance: 0.5, must_not_miss: false, category: "infectious" },
  ],

  // ── Elderly ──
  elderly_confusion: [
    { diagnosis_name: "Urinary Tract Infection", base_relevance: 0.55, must_not_miss: false, category: "renal" },
    { diagnosis_name: "Delirium", base_relevance: 0.65, must_not_miss: false, category: "neurological" },
    { diagnosis_name: "Acute Kidney Injury", base_relevance: 0.5, must_not_miss: false, category: "renal" },
  ],

  // ── Pheochromocytoma (rare endocrine) ──
  pheochromocytoma: [
    { diagnosis_name: "Pheochromocytoma", base_relevance: 0.5, must_not_miss: false, category: "endocrine" },
  ],

  // ── Musculoskeletal / Rheumatological ──
  musculoskeletal: [
    { diagnosis_name: "Rheumatoid Arthritis", base_relevance: 0.5, must_not_miss: false, category: "rheumatological" },
    { diagnosis_name: "Septic Arthritis", base_relevance: 0.7, must_not_miss: true, category: "infectious" },
    { diagnosis_name: "Costochondritis", base_relevance: 0.4, must_not_miss: false, category: "musculoskeletal" },
  ],

  // ── Renal / GU ──
  renal_gu: [
    { diagnosis_name: "Prostatitis", base_relevance: 0.45, must_not_miss: false, category: "urological" },
    { diagnosis_name: "Acute Kidney Injury", base_relevance: 0.55, must_not_miss: false, category: "renal" },
  ],

  // ── Syncope / Autonomic ──
  syncope: [
    { diagnosis_name: "Vasovagal Syncope", base_relevance: 0.5, must_not_miss: false, category: "cardiovascular" },
    { diagnosis_name: "Orthostatic Hypotension", base_relevance: 0.45, must_not_miss: false, category: "cardiovascular" },
    { diagnosis_name: "BPPV", base_relevance: 0.45, must_not_miss: false, category: "neurological" },
  ],

  // ── Psychiatric / Functional ──
  psychiatric: [
    { diagnosis_name: "Panic Disorder", base_relevance: 0.4, must_not_miss: false, category: "psychiatric" },
    { diagnosis_name: "Panic Attack", base_relevance: 0.4, must_not_miss: false, category: "psychiatric" },
    { diagnosis_name: "Somatization Disorder", base_relevance: 0.4, must_not_miss: false, category: "psychiatric" },
    { diagnosis_name: "Generalized Anxiety Disorder", base_relevance: 0.35, must_not_miss: false, category: "psychiatric" },
  ],

  // ── Autoimmune / Connective Tissue ──
  autoimmune: [
    { diagnosis_name: "SLE", base_relevance: 0.5, must_not_miss: false, category: "immunological" },
    { diagnosis_name: "Rheumatoid Arthritis", base_relevance: 0.45, must_not_miss: false, category: "rheumatological" },
    { diagnosis_name: "Vasculitis", base_relevance: 0.4, must_not_miss: false, category: "immunological" },
    { diagnosis_name: "Sarcoidosis", base_relevance: 0.35, must_not_miss: false, category: "immunological" },
    { diagnosis_name: "Inflammatory Bowel Disease", base_relevance: 0.4, must_not_miss: false, category: "gastrointestinal" },
  ],

  // ── Malignancy / Oncological ──
  malignancy: [
    { diagnosis_name: "Lymphoma", base_relevance: 0.5, must_not_miss: false, category: "oncological" },
    { diagnosis_name: "Lung Cancer", base_relevance: 0.4, must_not_miss: false, category: "oncological" },
    { diagnosis_name: "Leukemia", base_relevance: 0.35, must_not_miss: false, category: "oncological" },
    { diagnosis_name: "Colorectal Cancer", base_relevance: 0.35, must_not_miss: false, category: "oncological" },
  ],

  // ── Metabolic / Renal ──
  metabolic: [
    { diagnosis_name: "Acute Kidney Injury", base_relevance: 0.55, must_not_miss: false, category: "renal" },
    { diagnosis_name: "Chronic Kidney Disease", base_relevance: 0.4, must_not_miss: false, category: "renal" },
    { diagnosis_name: "Hyponatremia", base_relevance: 0.4, must_not_miss: false, category: "metabolic" },
    { diagnosis_name: "Hypercalcemia", base_relevance: 0.4, must_not_miss: false, category: "metabolic" },
    { diagnosis_name: "Rhabdomyolysis", base_relevance: 0.45, must_not_miss: false, category: "metabolic" },
  ],

  // ── General Infectious ──
  general_infectious: [
    { diagnosis_name: "Upper Respiratory Tract Infection", base_relevance: 0.5, must_not_miss: false, category: "infectious" },
    { diagnosis_name: "Viral Syndrome", base_relevance: 0.45, must_not_miss: false, category: "infectious" },
    { diagnosis_name: "Cellulitis", base_relevance: 0.4, must_not_miss: false, category: "infectious" },
    { diagnosis_name: "Endocarditis", base_relevance: 0.4, must_not_miss: true, category: "infectious" },
  ],

  // ── Anemia / Hematological ──
  hematological: [
    { diagnosis_name: "Iron Deficiency Anemia", base_relevance: 0.5, must_not_miss: false, category: "hematological" },
    { diagnosis_name: "B12 Deficiency", base_relevance: 0.4, must_not_miss: false, category: "hematological" },
    { diagnosis_name: "Hemolytic Anemia", base_relevance: 0.35, must_not_miss: false, category: "hematological" },
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
