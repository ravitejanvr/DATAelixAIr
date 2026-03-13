import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ══════════════════════════════════════════════════
// PHYSIOLOGY EXPANSION
// Adds new physiological states + symptom→physiology + physiology→diagnosis mappings
// ══════════════════════════════════════════════════

interface PhysioState {
  state_name: string;
  organ_system: string;
  description: string;
}

interface SymptomPhysioLink {
  symptom_name: string;
  state_name: string;
  strength: number;
}

interface PhysioDiagLink {
  state_name: string;
  diagnosis_name: string;
  strength: number;
}

function getNewPhysiologicalStates(): PhysioState[] {
  return [
    // Cardiovascular
    {state_name:"myocardial ischemia",organ_system:"cardiovascular",description:"Reduced blood flow to heart muscle causing oxygen deprivation"},
    {state_name:"myocardial infarction process",organ_system:"cardiovascular",description:"Irreversible necrosis of heart muscle due to prolonged ischemia"},
    {state_name:"heart failure pathophysiology",organ_system:"cardiovascular",description:"Inability of the heart to pump sufficient blood to meet metabolic demands"},
    {state_name:"cardiac arrhythmia mechanism",organ_system:"cardiovascular",description:"Abnormal electrical conduction in the heart causing irregular rhythm"},
    {state_name:"aortic wall dissection",organ_system:"cardiovascular",description:"Tear in the intimal layer of the aorta allowing blood between layers"},
    {state_name:"venous thrombosis",organ_system:"cardiovascular",description:"Clot formation in deep veins due to Virchow triad factors"},
    {state_name:"pulmonary vascular occlusion",organ_system:"cardiovascular",description:"Obstruction of pulmonary arteries by emboli"},
    {state_name:"valvular stenosis",organ_system:"cardiovascular",description:"Narrowing of heart valve restricting blood flow"},
    {state_name:"pericardial inflammation",organ_system:"cardiovascular",description:"Inflammation of the pericardium causing friction and fluid accumulation"},
    {state_name:"arterial atherosclerosis",organ_system:"cardiovascular",description:"Plaque buildup in arterial walls causing stenosis"},
    {state_name:"endocardial infection",organ_system:"cardiovascular",description:"Bacterial colonization of heart valve surfaces"},
    {state_name:"cardiac tamponade physiology",organ_system:"cardiovascular",description:"Fluid accumulation in pericardium compressing the heart"},
    // Respiratory
    {state_name:"airway hyperreactivity",organ_system:"respiratory",description:"Exaggerated bronchoconstriction response to stimuli"},
    {state_name:"alveolar destruction",organ_system:"respiratory",description:"Progressive loss of alveolar surface area reducing gas exchange"},
    {state_name:"pulmonary consolidation",organ_system:"respiratory",description:"Alveolar spaces filled with inflammatory exudate"},
    {state_name:"pleural space disruption",organ_system:"respiratory",description:"Air or fluid entering the pleural cavity"},
    {state_name:"pulmonary fibrotic remodeling",organ_system:"respiratory",description:"Progressive scarring of lung interstitium"},
    {state_name:"upper airway obstruction mechanism",organ_system:"respiratory",description:"Mechanical or inflammatory narrowing of upper airways"},
    {state_name:"alveolar-capillary membrane damage",organ_system:"respiratory",description:"Damage to gas exchange interface causing ARDS"},
    {state_name:"bronchial infection",organ_system:"respiratory",description:"Infection of bronchial tree causing inflammation and mucus production"},
    {state_name:"granulomatous lung disease",organ_system:"respiratory",description:"Non-caseating granuloma formation in lung parenchyma"},
    {state_name:"mycobacterial infection",organ_system:"respiratory",description:"Chronic granulomatous infection by Mycobacterium tuberculosis"},
    // Neurological
    {state_name:"cerebral ischemia",organ_system:"neurological",description:"Reduced blood flow to brain tissue causing infarction"},
    {state_name:"intracranial hemorrhage mechanism",organ_system:"neurological",description:"Bleeding within cranial vault from ruptured vessels"},
    {state_name:"meningeal inflammation",organ_system:"neurological",description:"Infection or inflammation of meninges"},
    {state_name:"cortical spreading depression",organ_system:"neurological",description:"Wave of neuronal depolarization causing migraine aura"},
    {state_name:"seizure focus activation",organ_system:"neurological",description:"Abnormal synchronized neuronal firing"},
    {state_name:"dopaminergic neurodegeneration",organ_system:"neurological",description:"Progressive loss of dopamine-producing neurons in substantia nigra"},
    {state_name:"demyelination",organ_system:"neurological",description:"Immune-mediated destruction of myelin sheaths"},
    {state_name:"cholinergic neuromuscular junction blockade",organ_system:"neurological",description:"Antibody-mediated blockade of acetylcholine receptors"},
    {state_name:"ascending peripheral nerve demyelination",organ_system:"neurological",description:"Immune-mediated peripheral nerve demyelination"},
    {state_name:"neuronal amyloid accumulation",organ_system:"neurological",description:"Progressive amyloid plaque and tau tangle deposition"},
    {state_name:"trigeminal nerve compression",organ_system:"neurological",description:"Vascular compression of trigeminal nerve root"},
    // Gastrointestinal
    {state_name:"gastric acid reflux",organ_system:"gastrointestinal",description:"Retrograde flow of stomach contents into esophagus"},
    {state_name:"mucosal ulceration gastric",organ_system:"gastrointestinal",description:"Breach in gastric/duodenal mucosa from acid or H. pylori"},
    {state_name:"pancreatic autodigestion",organ_system:"gastrointestinal",description:"Premature activation of pancreatic enzymes causing self-digestion"},
    {state_name:"biliary obstruction",organ_system:"gastrointestinal",description:"Blockage of bile flow from gallstones or stricture"},
    {state_name:"gallbladder inflammation",organ_system:"gastrointestinal",description:"Acute inflammation of gallbladder wall from stone impaction"},
    {state_name:"intestinal mucosal inflammation",organ_system:"gastrointestinal",description:"Chronic immune-mediated inflammation of bowel mucosa"},
    {state_name:"appendiceal obstruction",organ_system:"gastrointestinal",description:"Luminal obstruction of appendix causing inflammation"},
    {state_name:"hepatic fibrosis",organ_system:"gastrointestinal",description:"Progressive scarring of liver parenchyma"},
    {state_name:"gut dysmotility",organ_system:"gastrointestinal",description:"Disordered intestinal motility and visceral hypersensitivity"},
    {state_name:"intestinal malabsorption",organ_system:"gastrointestinal",description:"Impaired nutrient absorption from villous atrophy"},
    // Endocrine
    {state_name:"insulin resistance",organ_system:"endocrine",description:"Reduced cellular sensitivity to insulin signaling"},
    {state_name:"absolute insulin deficiency",organ_system:"endocrine",description:"Autoimmune destruction of pancreatic beta cells"},
    {state_name:"ketoacidosis metabolic",organ_system:"endocrine",description:"Metabolic acidosis from ketone body accumulation"},
    {state_name:"thyroid hormone deficiency",organ_system:"endocrine",description:"Insufficient thyroid hormone production"},
    {state_name:"thyroid hormone excess",organ_system:"endocrine",description:"Excessive thyroid hormone production or release"},
    {state_name:"cortisol excess",organ_system:"endocrine",description:"Chronic hypercortisolism from any cause"},
    {state_name:"adrenal insufficiency",organ_system:"endocrine",description:"Inadequate cortisol and aldosterone production"},
    {state_name:"catecholamine excess",organ_system:"endocrine",description:"Excessive catecholamine secretion from adrenal medulla"},
    {state_name:"parathyroid hormone excess",organ_system:"endocrine",description:"Excess PTH causing hypercalcemia"},
    {state_name:"androgen excess",organ_system:"endocrine",description:"Elevated androgen levels causing virilization"},
    // Hematological
    {state_name:"iron depletion",organ_system:"hematological",description:"Insufficient iron stores for erythropoiesis"},
    {state_name:"hemoglobin S polymerization",organ_system:"hematological",description:"Sickling of red blood cells under low oxygen conditions"},
    {state_name:"platelet destruction immune",organ_system:"hematological",description:"Antibody-mediated platelet destruction"},
    {state_name:"coagulation cascade activation",organ_system:"hematological",description:"Uncontrolled systemic activation of coagulation and fibrinolysis"},
    {state_name:"clotting factor deficiency",organ_system:"hematological",description:"Deficiency of coagulation factors causing bleeding"},
    {state_name:"ineffective erythropoiesis",organ_system:"hematological",description:"Impaired red blood cell production from globin chain imbalance"},
    // Immune/Inflammatory
    {state_name:"systemic inflammatory response",organ_system:"immune",description:"Dysregulated host immune response to infection"},
    {state_name:"autoimmune joint destruction",organ_system:"immune",description:"Immune-mediated synovitis and joint damage"},
    {state_name:"autoimmune multisystem inflammation",organ_system:"immune",description:"Systemic autoimmune inflammation affecting multiple organs"},
    {state_name:"crystal deposition arthritis",organ_system:"immune",description:"Monosodium urate crystal deposition in joints"},
    {state_name:"granulomatous vasculitis",organ_system:"immune",description:"Large vessel vasculitis with granulomatous inflammation"},
    {state_name:"central pain sensitization",organ_system:"immune",description:"Altered CNS pain processing causing widespread pain"},
    // Infectious
    {state_name:"parasitic erythrocyte invasion",organ_system:"infectious",description:"Plasmodium parasites invading and destroying red blood cells"},
    {state_name:"viral hemorrhagic mechanism",organ_system:"infectious",description:"Endothelial damage and capillary leak from dengue virus"},
    {state_name:"enteric bacterial infection",organ_system:"infectious",description:"Bacterial invasion of intestinal mucosa"},
    // Dermatological
    {state_name:"keratinocyte hyperproliferation",organ_system:"dermatological",description:"Accelerated epidermal turnover with abnormal keratinization"},
    {state_name:"epidermal barrier dysfunction",organ_system:"dermatological",description:"Impaired skin barrier with filaggrin deficiency"},
    {state_name:"dermatomal viral reactivation",organ_system:"dermatological",description:"VZV reactivation along sensory nerve distribution"},
    {state_name:"keratinocyte apoptosis immune",organ_system:"dermatological",description:"Drug-induced immune-mediated keratinocyte destruction"},
    // Renal
    {state_name:"glomerular filtration decline",organ_system:"renal",description:"Progressive loss of nephron function"},
    {state_name:"renal tubular obstruction",organ_system:"renal",description:"Calculus obstruction of renal collecting system"},
    // Musculoskeletal
    {state_name:"cartilage degeneration",organ_system:"musculoskeletal",description:"Progressive wear of articular cartilage"},
    {state_name:"entheseal inflammation",organ_system:"musculoskeletal",description:"Inflammation at tendon and ligament insertion sites"},
    // Ophthalmologic
    {state_name:"intraocular pressure elevation",organ_system:"ophthalmologic",description:"Acute increase in aqueous humor pressure"},
    {state_name:"retinal detachment mechanism",organ_system:"ophthalmologic",description:"Separation of neurosensory retina from RPE"},
    {state_name:"retinal vascular occlusion",organ_system:"ophthalmologic",description:"Obstruction of retinal arterial blood supply"},
    {state_name:"retinal microvascular damage",organ_system:"ophthalmologic",description:"Diabetic damage to retinal capillaries"},
    // Pediatric
    {state_name:"small airway viral inflammation",organ_system:"pediatric",description:"RSV-induced inflammation and mucus plugging of bronchioles"},
    {state_name:"subglottic edema",organ_system:"pediatric",description:"Parainfluenza-induced subglottic swelling"},
    {state_name:"systemic vasculitis pediatric",organ_system:"pediatric",description:"Medium vessel vasculitis with coronary artery involvement"},
    {state_name:"ileocolic intussusception",organ_system:"pediatric",description:"Telescoping of ileum into colon"},
  ];
}

function getSymptomPhysioLinks(): SymptomPhysioLink[] {
  return [
    // Cardiovascular chains
    {symptom_name:"chest pain",state_name:"myocardial ischemia",strength:0.85},
    {symptom_name:"chest tightness",state_name:"myocardial ischemia",strength:0.80},
    {symptom_name:"left arm pain",state_name:"myocardial ischemia",strength:0.70},
    {symptom_name:"diaphoresis",state_name:"myocardial infarction process",strength:0.65},
    {symptom_name:"shortness of breath",state_name:"heart failure pathophysiology",strength:0.75},
    {symptom_name:"orthopnea",state_name:"heart failure pathophysiology",strength:0.80},
    {symptom_name:"paroxysmal nocturnal dyspnea",state_name:"heart failure pathophysiology",strength:0.85},
    {symptom_name:"peripheral edema",state_name:"heart failure pathophysiology",strength:0.70},
    {symptom_name:"palpitations",state_name:"cardiac arrhythmia mechanism",strength:0.80},
    {symptom_name:"irregular heartbeat",state_name:"cardiac arrhythmia mechanism",strength:0.90},
    {symptom_name:"tearing chest pain",state_name:"aortic wall dissection",strength:0.90},
    {symptom_name:"back pain sudden onset",state_name:"aortic wall dissection",strength:0.75},
    {symptom_name:"leg swelling unilateral",state_name:"venous thrombosis",strength:0.80},
    {symptom_name:"calf pain",state_name:"venous thrombosis",strength:0.70},
    {symptom_name:"sudden shortness of breath",state_name:"pulmonary vascular occlusion",strength:0.80},
    {symptom_name:"pleuritic chest pain",state_name:"pulmonary vascular occlusion",strength:0.65},
    {symptom_name:"sharp chest pain",state_name:"pericardial inflammation",strength:0.80},
    {symptom_name:"chest pain worse lying down",state_name:"pericardial inflammation",strength:0.85},
    {symptom_name:"intermittent claudication",state_name:"arterial atherosclerosis",strength:0.85},
    {symptom_name:"fever",state_name:"endocardial infection",strength:0.60},
    {symptom_name:"new heart murmur",state_name:"endocardial infection",strength:0.85},
    {symptom_name:"exertional dyspnea",state_name:"valvular stenosis",strength:0.75},
    {symptom_name:"syncope",state_name:"valvular stenosis",strength:0.65},
    // Respiratory chains
    {symptom_name:"wheezing",state_name:"airway hyperreactivity",strength:0.85},
    {symptom_name:"chronic cough",state_name:"alveolar destruction",strength:0.70},
    {symptom_name:"progressive dyspnea",state_name:"alveolar destruction",strength:0.80},
    {symptom_name:"sputum production",state_name:"alveolar destruction",strength:0.70},
    {symptom_name:"cough",state_name:"pulmonary consolidation",strength:0.75},
    {symptom_name:"crackles on auscultation",state_name:"pulmonary consolidation",strength:0.85},
    {symptom_name:"sudden chest pain",state_name:"pleural space disruption",strength:0.80},
    {symptom_name:"decreased breath sounds unilateral",state_name:"pleural space disruption",strength:0.85},
    {symptom_name:"velcro crackles",state_name:"pulmonary fibrotic remodeling",strength:0.85},
    {symptom_name:"finger clubbing",state_name:"pulmonary fibrotic remodeling",strength:0.70},
    {symptom_name:"stridor",state_name:"upper airway obstruction mechanism",strength:0.90},
    {symptom_name:"severe dyspnea",state_name:"alveolar-capillary membrane damage",strength:0.85},
    {symptom_name:"hypoxia refractory",state_name:"alveolar-capillary membrane damage",strength:0.90},
    {symptom_name:"hemoptysis",state_name:"mycobacterial infection",strength:0.65},
    {symptom_name:"night sweats",state_name:"mycobacterial infection",strength:0.70},
    {symptom_name:"snoring",state_name:"upper airway obstruction mechanism",strength:0.70},
    {symptom_name:"witnessed apneas",state_name:"upper airway obstruction mechanism",strength:0.85},
    // Neurological chains
    {symptom_name:"sudden weakness one side",state_name:"cerebral ischemia",strength:0.90},
    {symptom_name:"facial droop",state_name:"cerebral ischemia",strength:0.85},
    {symptom_name:"speech difficulty",state_name:"cerebral ischemia",strength:0.80},
    {symptom_name:"thunderclap headache",state_name:"intracranial hemorrhage mechanism",strength:0.90},
    {symptom_name:"worst headache of life",state_name:"intracranial hemorrhage mechanism",strength:0.90},
    {symptom_name:"neck stiffness",state_name:"meningeal inflammation",strength:0.85},
    {symptom_name:"photophobia",state_name:"meningeal inflammation",strength:0.65},
    {symptom_name:"unilateral headache",state_name:"cortical spreading depression",strength:0.75},
    {symptom_name:"visual aura",state_name:"cortical spreading depression",strength:0.85},
    {symptom_name:"seizures recurrent",state_name:"seizure focus activation",strength:0.90},
    {symptom_name:"resting tremor",state_name:"dopaminergic neurodegeneration",strength:0.85},
    {symptom_name:"bradykinesia",state_name:"dopaminergic neurodegeneration",strength:0.90},
    {symptom_name:"rigidity",state_name:"dopaminergic neurodegeneration",strength:0.80},
    {symptom_name:"optic neuritis",state_name:"demyelination",strength:0.80},
    {symptom_name:"Lhermitte sign",state_name:"demyelination",strength:0.85},
    {symptom_name:"ptosis",state_name:"cholinergic neuromuscular junction blockade",strength:0.80},
    {symptom_name:"fatigable weakness",state_name:"cholinergic neuromuscular junction blockade",strength:0.85},
    {symptom_name:"ascending weakness",state_name:"ascending peripheral nerve demyelination",strength:0.90},
    {symptom_name:"areflexia",state_name:"ascending peripheral nerve demyelination",strength:0.85},
    {symptom_name:"progressive memory loss",state_name:"neuronal amyloid accumulation",strength:0.85},
    {symptom_name:"severe facial pain",state_name:"trigeminal nerve compression",strength:0.85},
    {symptom_name:"electric shock-like facial pain",state_name:"trigeminal nerve compression",strength:0.90},
    // GI chains
    {symptom_name:"heartburn",state_name:"gastric acid reflux",strength:0.90},
    {symptom_name:"acid regurgitation",state_name:"gastric acid reflux",strength:0.85},
    {symptom_name:"epigastric pain",state_name:"mucosal ulceration gastric",strength:0.80},
    {symptom_name:"burning stomach pain",state_name:"mucosal ulceration gastric",strength:0.85},
    {symptom_name:"severe epigastric pain",state_name:"pancreatic autodigestion",strength:0.85},
    {symptom_name:"pain radiating to back",state_name:"pancreatic autodigestion",strength:0.80},
    {symptom_name:"right upper quadrant pain",state_name:"gallbladder inflammation",strength:0.80},
    {symptom_name:"Murphy sign positive",state_name:"gallbladder inflammation",strength:0.90},
    {symptom_name:"jaundice",state_name:"biliary obstruction",strength:0.80},
    {symptom_name:"dark urine",state_name:"biliary obstruction",strength:0.70},
    {symptom_name:"bloody diarrhea",state_name:"intestinal mucosal inflammation",strength:0.85},
    {symptom_name:"chronic diarrhea",state_name:"intestinal mucosal inflammation",strength:0.70},
    {symptom_name:"periumbilical pain migrating to RLQ",state_name:"appendiceal obstruction",strength:0.90},
    {symptom_name:"right lower quadrant pain",state_name:"appendiceal obstruction",strength:0.80},
    {symptom_name:"ascites",state_name:"hepatic fibrosis",strength:0.80},
    {symptom_name:"spider angiomas",state_name:"hepatic fibrosis",strength:0.75},
    {symptom_name:"bloating",state_name:"gut dysmotility",strength:0.75},
    {symptom_name:"altered bowel habits",state_name:"gut dysmotility",strength:0.80},
    {symptom_name:"malabsorption",state_name:"intestinal malabsorption",strength:0.85},
    {symptom_name:"iron deficiency anemia",state_name:"intestinal malabsorption",strength:0.65},
    // Endocrine chains
    {symptom_name:"polyuria",state_name:"insulin resistance",strength:0.70},
    {symptom_name:"polydipsia",state_name:"insulin resistance",strength:0.70},
    {symptom_name:"acanthosis nigricans",state_name:"insulin resistance",strength:0.80},
    {symptom_name:"fruity breath odor",state_name:"ketoacidosis metabolic",strength:0.90},
    {symptom_name:"Kussmaul respirations",state_name:"ketoacidosis metabolic",strength:0.90},
    {symptom_name:"cold intolerance",state_name:"thyroid hormone deficiency",strength:0.80},
    {symptom_name:"weight gain",state_name:"thyroid hormone deficiency",strength:0.70},
    {symptom_name:"heat intolerance",state_name:"thyroid hormone excess",strength:0.80},
    {symptom_name:"tremor",state_name:"thyroid hormone excess",strength:0.70},
    {symptom_name:"exophthalmos",state_name:"thyroid hormone excess",strength:0.85},
    {symptom_name:"moon face",state_name:"cortisol excess",strength:0.85},
    {symptom_name:"striae purple",state_name:"cortisol excess",strength:0.85},
    {symptom_name:"buffalo hump",state_name:"cortisol excess",strength:0.85},
    {symptom_name:"hyperpigmentation",state_name:"adrenal insufficiency",strength:0.85},
    {symptom_name:"salt craving",state_name:"adrenal insufficiency",strength:0.75},
    {symptom_name:"episodic headache",state_name:"catecholamine excess",strength:0.75},
    {symptom_name:"sweating paroxysmal",state_name:"catecholamine excess",strength:0.80},
    {symptom_name:"hirsutism",state_name:"androgen excess",strength:0.75},
    {symptom_name:"irregular menstruation",state_name:"androgen excess",strength:0.70},
    // Hematological chains
    {symptom_name:"pallor",state_name:"iron depletion",strength:0.70},
    {symptom_name:"koilonychia",state_name:"iron depletion",strength:0.85},
    {symptom_name:"pica",state_name:"iron depletion",strength:0.80},
    {symptom_name:"pain crisis",state_name:"hemoglobin S polymerization",strength:0.90},
    {symptom_name:"petechiae",state_name:"platelet destruction immune",strength:0.80},
    {symptom_name:"easy bruising",state_name:"platelet destruction immune",strength:0.75},
    {symptom_name:"bleeding from multiple sites",state_name:"coagulation cascade activation",strength:0.90},
    {symptom_name:"hemarthrosis",state_name:"clotting factor deficiency",strength:0.85},
    {symptom_name:"prolonged bleeding after injury",state_name:"clotting factor deficiency",strength:0.85},
    {symptom_name:"severe anemia",state_name:"ineffective erythropoiesis",strength:0.85},
    // Immune chains
    {symptom_name:"fever",state_name:"systemic inflammatory response",strength:0.70},
    {symptom_name:"hypotension",state_name:"systemic inflammatory response",strength:0.75},
    {symptom_name:"tachycardia",state_name:"systemic inflammatory response",strength:0.65},
    {symptom_name:"joint pain symmetric",state_name:"autoimmune joint destruction",strength:0.80},
    {symptom_name:"morning stiffness over 1 hour",state_name:"autoimmune joint destruction",strength:0.85},
    {symptom_name:"butterfly rash",state_name:"autoimmune multisystem inflammation",strength:0.90},
    {symptom_name:"acute joint pain",state_name:"crystal deposition arthritis",strength:0.80},
    {symptom_name:"first MTP joint involvement",state_name:"crystal deposition arthritis",strength:0.85},
    {symptom_name:"new onset headache temporal",state_name:"granulomatous vasculitis",strength:0.80},
    {symptom_name:"jaw claudication",state_name:"granulomatous vasculitis",strength:0.85},
    {symptom_name:"widespread pain",state_name:"central pain sensitization",strength:0.85},
    {symptom_name:"tender points",state_name:"central pain sensitization",strength:0.80},
    // Infectious chains
    {symptom_name:"fever cyclical",state_name:"parasitic erythrocyte invasion",strength:0.90},
    {symptom_name:"retro-orbital pain",state_name:"viral hemorrhagic mechanism",strength:0.80},
    {symptom_name:"step-ladder fever",state_name:"enteric bacterial infection",strength:0.85},
    // Dermatological chains
    {symptom_name:"erythematous plaques with silver scales",state_name:"keratinocyte hyperproliferation",strength:0.90},
    {symptom_name:"Auspitz sign",state_name:"keratinocyte hyperproliferation",strength:0.85},
    {symptom_name:"pruritus intense",state_name:"epidermal barrier dysfunction",strength:0.80},
    {symptom_name:"dry skin",state_name:"epidermal barrier dysfunction",strength:0.80},
    {symptom_name:"vesicular rash dermatomal",state_name:"dermatomal viral reactivation",strength:0.90},
    {symptom_name:"skin blistering",state_name:"keratinocyte apoptosis immune",strength:0.85},
    {symptom_name:"mucosal erosions",state_name:"keratinocyte apoptosis immune",strength:0.90},
    // Renal chains
    {symptom_name:"decreased urine output",state_name:"glomerular filtration decline",strength:0.75},
    {symptom_name:"severe flank pain",state_name:"renal tubular obstruction",strength:0.85},
    {symptom_name:"colicky pain",state_name:"renal tubular obstruction",strength:0.85},
    // Musculoskeletal chains
    {symptom_name:"joint pain worse with activity",state_name:"cartilage degeneration",strength:0.85},
    {symptom_name:"joint crepitus",state_name:"cartilage degeneration",strength:0.80},
    {symptom_name:"low back pain inflammatory",state_name:"entheseal inflammation",strength:0.80},
    {symptom_name:"sacroiliac joint pain",state_name:"entheseal inflammation",strength:0.85},
    // Ophthalmologic chains
    {symptom_name:"severe eye pain",state_name:"intraocular pressure elevation",strength:0.85},
    {symptom_name:"halos around lights",state_name:"intraocular pressure elevation",strength:0.80},
    {symptom_name:"curtain-like visual field loss",state_name:"retinal detachment mechanism",strength:0.90},
    {symptom_name:"sudden floaters",state_name:"retinal detachment mechanism",strength:0.80},
    {symptom_name:"sudden painless vision loss",state_name:"retinal vascular occlusion",strength:0.90},
    {symptom_name:"dark spots in vision",state_name:"retinal microvascular damage",strength:0.70},
    // Pediatric chains
    {symptom_name:"barking cough",state_name:"subglottic edema",strength:0.90},
    {symptom_name:"stridor inspiratory",state_name:"subglottic edema",strength:0.85},
    {symptom_name:"fever over 5 days",state_name:"systemic vasculitis pediatric",strength:0.85},
    {symptom_name:"colicky abdominal pain episodic",state_name:"ileocolic intussusception",strength:0.90},
    {symptom_name:"currant jelly stool",state_name:"ileocolic intussusception",strength:0.90},
    {symptom_name:"tachypnea",state_name:"small airway viral inflammation",strength:0.75},
  ];
}

function getPhysioDiagLinks(): PhysioDiagLink[] {
  return [
    // Cardiovascular
    {state_name:"myocardial ischemia",diagnosis_name:"acute myocardial infarction",strength:0.90},
    {state_name:"myocardial ischemia",diagnosis_name:"unstable angina",strength:0.85},
    {state_name:"myocardial ischemia",diagnosis_name:"stable angina",strength:0.80},
    {state_name:"myocardial infarction process",diagnosis_name:"acute myocardial infarction",strength:0.95},
    {state_name:"heart failure pathophysiology",diagnosis_name:"congestive heart failure",strength:0.90},
    {state_name:"cardiac arrhythmia mechanism",diagnosis_name:"atrial fibrillation",strength:0.85},
    {state_name:"cardiac arrhythmia mechanism",diagnosis_name:"supraventricular tachycardia",strength:0.80},
    {state_name:"aortic wall dissection",diagnosis_name:"aortic dissection",strength:0.95},
    {state_name:"venous thrombosis",diagnosis_name:"deep vein thrombosis",strength:0.90},
    {state_name:"pulmonary vascular occlusion",diagnosis_name:"pulmonary embolism",strength:0.90},
    {state_name:"venous thrombosis",diagnosis_name:"pulmonary embolism",strength:0.75},
    {state_name:"valvular stenosis",diagnosis_name:"aortic stenosis",strength:0.85},
    {state_name:"pericardial inflammation",diagnosis_name:"pericarditis",strength:0.90},
    {state_name:"arterial atherosclerosis",diagnosis_name:"peripheral artery disease",strength:0.85},
    {state_name:"arterial atherosclerosis",diagnosis_name:"stable angina",strength:0.80},
    {state_name:"endocardial infection",diagnosis_name:"infective endocarditis",strength:0.90},
    // Respiratory
    {state_name:"airway hyperreactivity",diagnosis_name:"asthma",strength:0.90},
    {state_name:"alveolar destruction",diagnosis_name:"chronic obstructive pulmonary disease",strength:0.90},
    {state_name:"pulmonary consolidation",diagnosis_name:"community-acquired pneumonia",strength:0.85},
    {state_name:"pleural space disruption",diagnosis_name:"pneumothorax",strength:0.90},
    {state_name:"pleural space disruption",diagnosis_name:"pleural effusion",strength:0.80},
    {state_name:"pulmonary fibrotic remodeling",diagnosis_name:"pulmonary fibrosis",strength:0.90},
    {state_name:"alveolar-capillary membrane damage",diagnosis_name:"acute respiratory distress syndrome",strength:0.90},
    {state_name:"mycobacterial infection",diagnosis_name:"tuberculosis",strength:0.90},
    {state_name:"bronchial infection",diagnosis_name:"bronchiectasis",strength:0.75},
    {state_name:"granulomatous lung disease",diagnosis_name:"sarcoidosis",strength:0.85},
    {state_name:"upper airway obstruction mechanism",diagnosis_name:"obstructive sleep apnea",strength:0.80},
    // Neurological
    {state_name:"cerebral ischemia",diagnosis_name:"ischemic stroke",strength:0.95},
    {state_name:"intracranial hemorrhage mechanism",diagnosis_name:"hemorrhagic stroke",strength:0.90},
    {state_name:"intracranial hemorrhage mechanism",diagnosis_name:"subarachnoid hemorrhage",strength:0.90},
    {state_name:"meningeal inflammation",diagnosis_name:"meningitis bacterial",strength:0.90},
    {state_name:"cortical spreading depression",diagnosis_name:"migraine",strength:0.85},
    {state_name:"seizure focus activation",diagnosis_name:"epilepsy",strength:0.90},
    {state_name:"dopaminergic neurodegeneration",diagnosis_name:"Parkinson disease",strength:0.90},
    {state_name:"demyelination",diagnosis_name:"multiple sclerosis",strength:0.90},
    {state_name:"cholinergic neuromuscular junction blockade",diagnosis_name:"myasthenia gravis",strength:0.90},
    {state_name:"ascending peripheral nerve demyelination",diagnosis_name:"Guillain-Barre syndrome",strength:0.90},
    {state_name:"neuronal amyloid accumulation",diagnosis_name:"Alzheimer disease",strength:0.85},
    {state_name:"trigeminal nerve compression",diagnosis_name:"trigeminal neuralgia",strength:0.85},
    // GI
    {state_name:"gastric acid reflux",diagnosis_name:"gastroesophageal reflux disease",strength:0.90},
    {state_name:"mucosal ulceration gastric",diagnosis_name:"peptic ulcer disease",strength:0.90},
    {state_name:"pancreatic autodigestion",diagnosis_name:"acute pancreatitis",strength:0.90},
    {state_name:"gallbladder inflammation",diagnosis_name:"acute cholecystitis",strength:0.90},
    {state_name:"biliary obstruction",diagnosis_name:"choledocholithiasis",strength:0.85},
    {state_name:"biliary obstruction",diagnosis_name:"pancreatic cancer",strength:0.70},
    {state_name:"intestinal mucosal inflammation",diagnosis_name:"inflammatory bowel disease crohn",strength:0.85},
    {state_name:"intestinal mucosal inflammation",diagnosis_name:"inflammatory bowel disease ulcerative colitis",strength:0.85},
    {state_name:"appendiceal obstruction",diagnosis_name:"acute appendicitis",strength:0.90},
    {state_name:"hepatic fibrosis",diagnosis_name:"liver cirrhosis",strength:0.90},
    {state_name:"gut dysmotility",diagnosis_name:"irritable bowel syndrome",strength:0.85},
    {state_name:"intestinal malabsorption",diagnosis_name:"celiac disease",strength:0.85},
    // Endocrine
    {state_name:"insulin resistance",diagnosis_name:"type 2 diabetes mellitus",strength:0.85},
    {state_name:"insulin resistance",diagnosis_name:"polycystic ovary syndrome",strength:0.70},
    {state_name:"absolute insulin deficiency",diagnosis_name:"type 1 diabetes mellitus",strength:0.90},
    {state_name:"ketoacidosis metabolic",diagnosis_name:"diabetic ketoacidosis",strength:0.95},
    {state_name:"thyroid hormone deficiency",diagnosis_name:"hypothyroidism",strength:0.90},
    {state_name:"thyroid hormone excess",diagnosis_name:"hyperthyroidism",strength:0.90},
    {state_name:"cortisol excess",diagnosis_name:"Cushing syndrome",strength:0.90},
    {state_name:"adrenal insufficiency",diagnosis_name:"Addison disease",strength:0.90},
    {state_name:"catecholamine excess",diagnosis_name:"pheochromocytoma",strength:0.90},
    {state_name:"parathyroid hormone excess",diagnosis_name:"primary hyperparathyroidism",strength:0.85},
    {state_name:"androgen excess",diagnosis_name:"polycystic ovary syndrome",strength:0.80},
    // Hematological
    {state_name:"iron depletion",diagnosis_name:"iron deficiency anemia",strength:0.90},
    {state_name:"hemoglobin S polymerization",diagnosis_name:"sickle cell disease",strength:0.95},
    {state_name:"platelet destruction immune",diagnosis_name:"immune thrombocytopenia",strength:0.90},
    {state_name:"coagulation cascade activation",diagnosis_name:"disseminated intravascular coagulation",strength:0.90},
    {state_name:"clotting factor deficiency",diagnosis_name:"hemophilia A",strength:0.90},
    {state_name:"ineffective erythropoiesis",diagnosis_name:"thalassemia major",strength:0.85},
    // Immune
    {state_name:"systemic inflammatory response",diagnosis_name:"sepsis",strength:0.85},
    {state_name:"autoimmune joint destruction",diagnosis_name:"rheumatoid arthritis",strength:0.90},
    {state_name:"autoimmune multisystem inflammation",diagnosis_name:"systemic lupus erythematosus",strength:0.90},
    {state_name:"crystal deposition arthritis",diagnosis_name:"gout",strength:0.90},
    {state_name:"granulomatous vasculitis",diagnosis_name:"giant cell arteritis",strength:0.85},
    {state_name:"central pain sensitization",diagnosis_name:"fibromyalgia",strength:0.85},
    {state_name:"entheseal inflammation",diagnosis_name:"ankylosing spondylitis",strength:0.85},
    // Infectious
    {state_name:"parasitic erythrocyte invasion",diagnosis_name:"malaria",strength:0.90},
    {state_name:"viral hemorrhagic mechanism",diagnosis_name:"dengue fever",strength:0.85},
    {state_name:"enteric bacterial infection",diagnosis_name:"typhoid fever",strength:0.85},
    // Dermatological
    {state_name:"keratinocyte hyperproliferation",diagnosis_name:"psoriasis",strength:0.90},
    {state_name:"epidermal barrier dysfunction",diagnosis_name:"eczema atopic dermatitis",strength:0.85},
    {state_name:"dermatomal viral reactivation",diagnosis_name:"herpes zoster",strength:0.90},
    {state_name:"keratinocyte apoptosis immune",diagnosis_name:"Stevens-Johnson syndrome",strength:0.90},
    // Renal
    {state_name:"glomerular filtration decline",diagnosis_name:"chronic kidney disease",strength:0.85},
    {state_name:"renal tubular obstruction",diagnosis_name:"nephrolithiasis",strength:0.90},
    // Musculoskeletal
    {state_name:"cartilage degeneration",diagnosis_name:"osteoarthritis",strength:0.90},
    // Ophthalmologic
    {state_name:"intraocular pressure elevation",diagnosis_name:"acute angle-closure glaucoma",strength:0.90},
    {state_name:"retinal detachment mechanism",diagnosis_name:"retinal detachment",strength:0.90},
    {state_name:"retinal vascular occlusion",diagnosis_name:"central retinal artery occlusion",strength:0.90},
    {state_name:"retinal microvascular damage",diagnosis_name:"diabetic retinopathy",strength:0.85},
    // Pediatric
    {state_name:"small airway viral inflammation",diagnosis_name:"bronchiolitis",strength:0.85},
    {state_name:"subglottic edema",diagnosis_name:"croup",strength:0.90},
    {state_name:"systemic vasculitis pediatric",diagnosis_name:"Kawasaki disease",strength:0.90},
    {state_name:"ileocolic intussusception",diagnosis_name:"intussusception",strength:0.90},
  ];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const log: string[] = [];
  const addLog = (msg: string) => { log.push(msg); console.log(msg); };

  addLog("=== Physiology Layer Expansion ===");

  try {
    // STEP 1: Upsert physiological states
    const states = getNewPhysiologicalStates();
    addLog(`Upserting ${states.length} physiological states...`);
    for (let i = 0; i < states.length; i += 50) {
      const chunk = states.slice(i, i+50);
      const { error } = await supabase.from("physiological_states").upsert(chunk, { onConflict: "state_name", ignoreDuplicates: true });
      if (error) addLog(`  States error: ${error.message}`);
    }

    // Fetch all state IDs
    const stateIds: Record<string, string> = {};
    let offset = 0;
    while (true) {
      const { data } = await supabase.from("physiological_states").select("id, state_name").range(offset, offset+999);
      if (!data || data.length === 0) break;
      for (const r of data) stateIds[r.state_name] = r.id;
      offset += data.length;
      if (data.length < 1000) break;
    }
    addLog(`  Total states: ${Object.keys(stateIds).length}`);

    // Fetch all symptom IDs
    const symIds: Record<string, string> = {};
    offset = 0;
    while (true) {
      const { data } = await supabase.from("symptoms").select("id, symptom_name").range(offset, offset+999);
      if (!data || data.length === 0) break;
      for (const r of data) symIds[r.symptom_name] = r.id;
      offset += data.length;
      if (data.length < 1000) break;
    }

    // Fetch all diagnosis IDs
    const diagIds: Record<string, string> = {};
    offset = 0;
    while (true) {
      const { data } = await supabase.from("diagnoses").select("id, diagnosis_name").range(offset, offset+999);
      if (!data || data.length === 0) break;
      for (const r of data) diagIds[r.diagnosis_name] = r.id;
      offset += data.length;
      if (data.length < 1000) break;
    }

    // STEP 2: Symptom → Physiology links
    const symPhysLinks = getSymptomPhysioLinks();
    addLog(`Upserting ${symPhysLinks.length} symptom→physiology links...`);
    const spRows: any[] = [];
    let skippedSP = 0;
    for (const link of symPhysLinks) {
      const symId = symIds[link.symptom_name];
      const stateId = stateIds[link.state_name];
      if (!symId || !stateId) { skippedSP++; continue; }
      spRows.push({ symptom_id: symId, physiology_state_id: stateId, strength: link.strength });
    }
    addLog(`  Skipped (missing IDs): ${skippedSP}`);
    let spCount = 0;
    for (let i = 0; i < spRows.length; i += 200) {
      const { error } = await supabase.from("symptom_physiology_map").upsert(spRows.slice(i, i+200), { onConflict: "symptom_id,physiology_state_id", ignoreDuplicates: true });
      if (error) addLog(`  SP error: ${error.message}`);
      else spCount += spRows.slice(i, i+200).length;
    }
    addLog(`  Symptom→Physiology upserted: ${spCount}`);

    // STEP 3: Physiology → Diagnosis links
    const pdLinks = getPhysioDiagLinks();
    addLog(`Upserting ${pdLinks.length} physiology→diagnosis links...`);
    const pdRows: any[] = [];
    let skippedPD = 0;
    for (const link of pdLinks) {
      const stateId = stateIds[link.state_name];
      const diagId = diagIds[link.diagnosis_name];
      if (!stateId || !diagId) { skippedPD++; addLog(`  SKIP: ${link.state_name} → ${link.diagnosis_name}`); continue; }
      pdRows.push({ physiology_state_id: stateId, diagnosis_id: diagId, strength: link.strength });
    }
    addLog(`  Skipped (missing IDs): ${skippedPD}`);
    let pdCount = 0;
    for (let i = 0; i < pdRows.length; i += 200) {
      const { error } = await supabase.from("physiology_diagnosis_map").upsert(pdRows.slice(i, i+200), { onConflict: "physiology_state_id,diagnosis_id", ignoreDuplicates: true });
      if (error) addLog(`  PD error: ${error.message}`);
      else pdCount += pdRows.slice(i, i+200).length;
    }
    addLog(`  Physiology→Diagnosis upserted: ${pdCount}`);

    // VALIDATION
    addLog("=== VALIDATION ===");
    const counts: Record<string, number> = {};
    for (const table of ["physiological_states","symptom_physiology_map","physiology_diagnosis_map"]) {
      const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
      counts[table] = count || 0;
      addLog(`  ${table}: ${count}`);
    }

    return new Response(JSON.stringify({ success: true, counts, log }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    addLog(`FATAL: ${err.message}`);
    return new Response(JSON.stringify({ success: false, error: err.message, log }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
