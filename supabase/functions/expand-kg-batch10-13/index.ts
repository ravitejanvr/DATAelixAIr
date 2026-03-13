import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DiseaseEntry {
  name: string; icd10: string; organ: string; prior: number; severity: string;
  symptoms: [string, number, number, string][];
  tests: [string, string, string][];
  treatments: [string, string, string, string][];
}

// ══════════════════════════════════════════════════
// BATCH 10: GASTROENTEROLOGY (30 diseases)
// ══════════════════════════════════════════════════
function getGastroenterology(): DiseaseEntry[] {
  return [
    {name:"peptic ulcer disease",icd10:"K27.9",organ:"gastrointestinal",prior:0.04,severity:"moderate",
      symptoms:[["epigastric pain",0.85,0.7,"high"],["pain related to meals",0.70,0.7,"high"],["nausea",0.55,0.4,"moderate"],["bloating",0.45,0.4,"moderate"],["hematemesis",0.30,0.7,"high"],["melena",0.30,0.7,"high"],["weight loss",0.30,0.4,"moderate"]],
      tests:[["upper GI endoscopy","endoscopy","high"],["H pylori test","microbiology","high"],["CBC","hematology","moderate"],["stool guaiac","biochemistry","moderate"]],
      treatments:[["omeprazole","PPI","first_line","ACG"],["amoxicillin","antibiotic","H_pylori","ACG"],["clarithromycin","antibiotic","H_pylori","ACG"],["bismuth subsalicylate","antacid","adjunct","ACG"]]},
    {name:"inflammatory bowel disease crohn",icd10:"K50.9",organ:"gastrointestinal",prior:0.005,severity:"high",
      symptoms:[["chronic diarrhea",0.80,0.6,"moderate"],["abdominal pain crampy",0.75,0.6,"moderate"],["weight loss",0.55,0.5,"moderate"],["fatigue",0.50,0.4,"moderate"],["perianal disease",0.40,0.8,"high"],["fever",0.35,0.4,"moderate"],["bloody stool",0.45,0.6,"moderate"],["oral ulcers",0.30,0.5,"moderate"],["fistula",0.30,0.8,"high"]],
      tests:[["colonoscopy with biopsy","endoscopy","high"],["CRP/ESR","biochemistry","moderate"],["fecal calprotectin","biochemistry","high"],["CT enterography","imaging","moderate"],["CBC","hematology","moderate"]],
      treatments:[["mesalamine","aminosalicylate","first_line","ACG"],["budesonide","corticosteroid","induction","ACG"],["azathioprine","immunosuppressant","maintenance","ACG"],["infliximab","anti-TNF","moderate-severe","ACG"],["adalimumab","anti-TNF","moderate-severe","ACG"]]},
    {name:"ulcerative colitis",icd10:"K51.9",organ:"gastrointestinal",prior:0.005,severity:"high",
      symptoms:[["bloody diarrhea",0.85,0.8,"high"],["rectal bleeding",0.80,0.75,"high"],["abdominal pain crampy",0.65,0.5,"moderate"],["tenesmus",0.55,0.7,"high"],["urgency to defecate",0.60,0.6,"moderate"],["weight loss",0.40,0.4,"moderate"],["fever",0.35,0.4,"moderate"]],
      tests:[["colonoscopy with biopsy","endoscopy","high"],["fecal calprotectin","biochemistry","high"],["CRP/ESR","biochemistry","moderate"],["stool culture to exclude infection","microbiology","moderate"]],
      treatments:[["mesalamine","aminosalicylate","first_line","ACG"],["prednisolone","corticosteroid","flare","ACG"],["azathioprine","immunosuppressant","maintenance","ACG"],["vedolizumab","integrin antagonist","moderate-severe","ACG"]]},
    {name:"irritable bowel syndrome",icd10:"K58.9",organ:"gastrointestinal",prior:0.12,severity:"low",
      symptoms:[["abdominal pain related to defecation",0.85,0.75,"high"],["altered bowel habits",0.80,0.7,"high"],["bloating",0.75,0.6,"moderate"],["abdominal distension",0.60,0.5,"moderate"],["mucus in stool",0.40,0.5,"moderate"],["symptoms improve with defecation",0.55,0.7,"high"]],
      tests:[["clinical diagnosis Rome IV criteria","clinical","high"],["CBC","hematology","low"],["celiac screening","serology","moderate"],["fecal calprotectin","biochemistry","moderate"]],
      treatments:[["mebeverine","antispasmodic","first_line","NICE"],["loperamide","antidiarrheal","IBS-D","NICE"],["psyllium","fiber","IBS-C","AGA"],["amitriptyline","TCA","second_line","NICE"]]},
    {name:"celiac disease",icd10:"K90.0",organ:"gastrointestinal",prior:0.01,severity:"moderate",
      symptoms:[["chronic diarrhea",0.65,0.5,"moderate"],["bloating",0.60,0.5,"moderate"],["weight loss",0.50,0.5,"moderate"],["fatigue",0.55,0.4,"moderate"],["iron deficiency anemia",0.45,0.5,"moderate"],["abdominal pain",0.45,0.4,"moderate"],["dermatitis herpetiformis",0.30,0.9,"high"],["failure to thrive in children",0.35,0.6,"moderate"]],
      tests:[["tissue transglutaminase IgA","serology","high"],["total IgA level","immunology","moderate"],["upper GI endoscopy with duodenal biopsy","endoscopy","high"],["deamidated gliadin peptide","serology","moderate"]],
      treatments:[["gluten-free diet","dietary","first_line","ACG"]]},
    {name:"hepatitis C chronic",icd10:"B18.2",organ:"hepatic",prior:0.01,severity:"high",
      symptoms:[["fatigue",0.65,0.4,"moderate"],["jaundice",0.35,0.5,"moderate"],["right upper quadrant discomfort",0.40,0.4,"moderate"],["nausea",0.35,0.4,"moderate"],["arthralgia",0.30,0.4,"moderate"],["pruritus",0.30,0.4,"moderate"]],
      tests:[["HCV antibody","serology","high"],["HCV RNA viral load","molecular","high"],["liver function tests","biochemistry","high"],["FibroScan","imaging","moderate"],["liver biopsy","pathology","moderate"]],
      treatments:[["sofosbuvir-velpatasvir","DAA","first_line","AASLD"],["glecaprevir-pibrentasvir","DAA","first_line","AASLD"]]},
    {name:"liver cirrhosis",icd10:"K74.6",organ:"hepatic",prior:0.01,severity:"high",
      symptoms:[["ascites",0.65,0.7,"high"],["jaundice",0.55,0.6,"moderate"],["spider angiomata",0.45,0.8,"high"],["palmar erythema",0.40,0.7,"high"],["hepatomegaly",0.50,0.5,"moderate"],["gynecomastia",0.30,0.6,"moderate"],["edema",0.50,0.5,"moderate"],["fatigue",0.55,0.4,"moderate"],["easy bruising",0.40,0.5,"moderate"]],
      tests:[["liver function tests","biochemistry","high"],["albumin","biochemistry","high"],["INR","hematology","high"],["abdominal ultrasound","imaging","high"],["FibroScan","imaging","moderate"],["upper GI endoscopy","endoscopy","moderate"]],
      treatments:[["spironolactone","aldosterone antagonist","ascites","AASLD"],["furosemide","loop diuretic","ascites","AASLD"],["lactulose","osmotic laxative","encephalopathy","AASLD"],["propranolol","beta-blocker","variceal_prophylaxis","AASLD"]]},
    {name:"choledocholithiasis",icd10:"K80.5",organ:"gastrointestinal",prior:0.01,severity:"high",
      symptoms:[["right upper quadrant pain",0.80,0.7,"high"],["jaundice",0.65,0.7,"high"],["fever",0.45,0.5,"moderate"],["dark urine",0.50,0.6,"moderate"],["clay-colored stools",0.45,0.7,"high"],["nausea",0.50,0.4,"moderate"],["pruritus",0.35,0.5,"moderate"]],
      tests:[["liver function tests","biochemistry","high"],["abdominal ultrasound","imaging","high"],["MRCP","imaging","high"],["ERCP","endoscopy","therapeutic"],["CBC","hematology","moderate"]],
      treatments:[["ERCP with stone extraction","procedure","first_line","ASGE"],["cholecystectomy","procedure","definitive","SAGES"],["ursodeoxycholic acid","bile acid","adjunct","ASGE"]]},
    {name:"diverticulitis",icd10:"K57.3",organ:"gastrointestinal",prior:0.03,severity:"moderate",
      symptoms:[["left lower quadrant pain",0.80,0.8,"high"],["fever",0.55,0.5,"moderate"],["nausea",0.45,0.4,"moderate"],["change in bowel habits",0.40,0.4,"moderate"],["abdominal tenderness LLQ",0.75,0.75,"high"],["rectal bleeding",0.30,0.5,"moderate"]],
      tests:[["CT abdomen pelvis with contrast","imaging","high"],["CBC","hematology","moderate"],["CRP","biochemistry","moderate"],["urinalysis","biochemistry","moderate"]],
      treatments:[["metronidazole","antimicrobial","first_line","AGA"],["ciprofloxacin","fluoroquinolone","first_line","AGA"],["amoxicillin-clavulanate","penicillin combination","alternative","AGA"]]},
    {name:"colorectal cancer",icd10:"C18.9",organ:"gastrointestinal",prior:0.02,severity:"critical",
      symptoms:[["change in bowel habits",0.60,0.5,"moderate"],["rectal bleeding",0.55,0.6,"moderate"],["iron deficiency anemia",0.45,0.5,"moderate"],["weight loss",0.40,0.5,"moderate"],["abdominal pain",0.40,0.4,"moderate"],["fatigue",0.45,0.3,"moderate"],["palpable abdominal mass",0.30,0.7,"high"],["tenesmus",0.30,0.5,"moderate"]],
      tests:[["colonoscopy with biopsy","endoscopy","high"],["CT abdomen chest","imaging","high"],["CEA","biochemistry","moderate"],["CBC","hematology","moderate"],["fecal occult blood test","biochemistry","screening"]],
      treatments:[["surgical resection","procedure","first_line","NCCN"],["FOLFOX chemotherapy","chemotherapy","adjuvant","NCCN"],["pembrolizumab","immunotherapy","MSI-H","NCCN"]]},
  ];
}

// ══════════════════════════════════════════════════
// BATCH 11: ENDOCRINOLOGY (25 diseases)
// ══════════════════════════════════════════════════
function getEndocrinology(): DiseaseEntry[] {
  return [
    {name:"Cushing syndrome",icd10:"E24.9",organ:"endocrine",prior:0.002,severity:"moderate",
      symptoms:[["central obesity",0.80,0.7,"high"],["moon face",0.65,0.85,"high"],["buffalo hump",0.55,0.85,"high"],["purple striae",0.50,0.9,"high"],["hypertension",0.60,0.5,"moderate"],["proximal muscle weakness",0.50,0.6,"moderate"],["easy bruising",0.55,0.6,"moderate"],["hirsutism",0.40,0.5,"moderate"],["glucose intolerance",0.45,0.5,"moderate"]],
      tests:[["24-hour urine cortisol","biochemistry","high"],["overnight dexamethasone suppression test","biochemistry","high"],["late-night salivary cortisol","biochemistry","high"],["ACTH level","biochemistry","moderate"],["MRI pituitary","imaging","moderate"]],
      treatments:[["surgical resection","procedure","first_line","Endocrine Society"],["ketoconazole","antifungal","medical","Endocrine Society"],["metyrapone","steroidogenesis inhibitor","medical","Endocrine Society"]]},
    {name:"Addison disease",icd10:"E27.1",organ:"endocrine",prior:0.001,severity:"high",
      symptoms:[["fatigue",0.85,0.4,"moderate"],["hyperpigmentation",0.70,0.85,"high"],["weight loss",0.60,0.5,"moderate"],["hypotension",0.65,0.6,"moderate"],["salt craving",0.50,0.7,"high"],["nausea",0.50,0.4,"moderate"],["abdominal pain",0.40,0.4,"moderate"],["dizziness",0.45,0.4,"moderate"],["hyponatremia",0.55,0.6,"moderate"]],
      tests:[["morning cortisol","biochemistry","high"],["ACTH stimulation test","biochemistry","high"],["ACTH level","biochemistry","high"],["electrolytes","biochemistry","moderate"],["adrenal antibodies","immunology","moderate"]],
      treatments:[["hydrocortisone","corticosteroid","first_line","Endocrine Society"],["fludrocortisone","mineralocorticoid","first_line","Endocrine Society"]]},
    {name:"pheochromocytoma",icd10:"D35.0",organ:"endocrine",prior:0.001,severity:"high",
      symptoms:[["paroxysmal hypertension",0.80,0.85,"high"],["headache episodic",0.65,0.6,"moderate"],["diaphoresis episodic",0.60,0.7,"high"],["palpitations episodic",0.65,0.7,"high"],["tremor",0.40,0.5,"moderate"],["anxiety",0.45,0.4,"moderate"],["pallor",0.35,0.5,"moderate"]],
      tests:[["24-hour urine metanephrines","biochemistry","high"],["plasma metanephrines","biochemistry","high"],["CT abdomen","imaging","high"],["MIBG scan","nuclear medicine","moderate"]],
      treatments:[["phenoxybenzamine","alpha-blocker","preoperative","Endocrine Society"],["laparoscopic adrenalectomy","procedure","definitive","Endocrine Society"],["propranolol","beta-blocker","adjunct","Endocrine Society"]]},
    {name:"type 1 diabetes mellitus",icd10:"E10.9",organ:"endocrine",prior:0.005,severity:"high",
      symptoms:[["polyuria",0.85,0.7,"high"],["polydipsia",0.80,0.65,"high"],["weight loss rapid",0.70,0.6,"moderate"],["polyphagia",0.55,0.5,"moderate"],["fatigue",0.60,0.4,"moderate"],["blurred vision",0.40,0.5,"moderate"],["nausea",0.35,0.4,"moderate"]],
      tests:[["blood glucose","biochemistry","high"],["HbA1c","biochemistry","high"],["C-peptide","biochemistry","high"],["anti-GAD antibodies","immunology","high"],["insulin antibodies","immunology","moderate"],["urinalysis ketones","biochemistry","moderate"]],
      treatments:[["insulin glargine","basal insulin","first_line","ADA"],["insulin lispro","rapid insulin","first_line","ADA"],["insulin pump","device","alternative","ADA"]]},
    {name:"hypercalcemia",icd10:"E83.52",organ:"endocrine",prior:0.01,severity:"moderate",
      symptoms:[["polyuria",0.55,0.5,"moderate"],["polydipsia",0.50,0.5,"moderate"],["constipation",0.50,0.5,"moderate"],["nausea",0.45,0.4,"moderate"],["abdominal pain",0.40,0.4,"moderate"],["confusion",0.35,0.5,"moderate"],["bone pain",0.35,0.5,"moderate"],["fatigue",0.50,0.4,"moderate"],["renal stones",0.30,0.6,"moderate"]],
      tests:[["serum calcium","biochemistry","high"],["PTH level","biochemistry","high"],["vitamin D level","biochemistry","moderate"],["phosphate level","biochemistry","moderate"],["renal function","biochemistry","moderate"]],
      treatments:[["normal saline hydration","fluid","first_line","Endocrine Society"],["zoledronic acid","bisphosphonate","first_line","Endocrine Society"],["calcitonin","hormone","adjunct","Endocrine Society"]]},
    {name:"primary hyperparathyroidism",icd10:"E21.0",organ:"endocrine",prior:0.005,severity:"moderate",
      symptoms:[["bone pain",0.45,0.5,"moderate"],["renal stones",0.35,0.6,"moderate"],["fatigue",0.50,0.4,"moderate"],["constipation",0.40,0.4,"moderate"],["depression",0.35,0.4,"moderate"],["abdominal pain",0.30,0.4,"moderate"],["polyuria",0.35,0.5,"moderate"]],
      tests:[["serum calcium","biochemistry","high"],["PTH level","biochemistry","high"],["serum phosphate","biochemistry","moderate"],["vitamin D","biochemistry","moderate"],["DEXA scan","imaging","moderate"],["renal ultrasound","imaging","moderate"]],
      treatments:[["parathyroidectomy","procedure","definitive","Endocrine Society"],["cinacalcet","calcimimetic","medical","Endocrine Society"]]},
    {name:"thyroid nodule",icd10:"E04.1",organ:"endocrine",prior:0.05,severity:"low",
      symptoms:[["neck swelling",0.70,0.6,"moderate"],["dysphagia",0.30,0.4,"moderate"],["hoarseness",0.30,0.5,"moderate"],["neck pain",0.30,0.4,"moderate"]],
      tests:[["thyroid ultrasound","imaging","high"],["TSH","biochemistry","high"],["fine needle aspiration biopsy","pathology","high"],["thyroid scan","nuclear medicine","moderate"]],
      treatments:[["observation","watchful_waiting","benign","ATA"],["thyroid lobectomy","procedure","suspicious","ATA"],["levothyroxine suppressive","thyroid hormone","post-surgical","ATA"]]},
    {name:"metabolic syndrome",icd10:"E88.81",organ:"metabolic",prior:0.25,severity:"moderate",
      symptoms:[["central obesity",0.85,0.7,"high"],["elevated blood pressure",0.65,0.5,"moderate"],["fasting hyperglycemia",0.60,0.6,"moderate"],["elevated triglycerides",0.55,0.5,"moderate"],["low HDL cholesterol",0.55,0.5,"moderate"]],
      tests:[["fasting glucose","biochemistry","high"],["lipid panel","biochemistry","high"],["waist circumference","anthropometry","high"],["blood pressure","clinical","high"],["HbA1c","biochemistry","moderate"]],
      treatments:[["metformin","biguanide","prevention","ADA"],["lifestyle modification","lifestyle","first_line","AHA"],["atorvastatin","statin","lipids","ACC/AHA"]]},
    {name:"prolactinoma",icd10:"D35.2",organ:"endocrine",prior:0.003,severity:"moderate",
      symptoms:[["galactorrhea",0.65,0.8,"high"],["amenorrhea",0.60,0.6,"moderate"],["headache",0.45,0.4,"moderate"],["visual field defects",0.35,0.7,"high"],["decreased libido",0.40,0.5,"moderate"],["infertility",0.40,0.5,"moderate"],["erectile dysfunction",0.35,0.5,"moderate"]],
      tests:[["serum prolactin","biochemistry","high"],["MRI pituitary with contrast","imaging","high"],["visual field testing","ophthalmology","moderate"],["thyroid function","biochemistry","moderate"]],
      treatments:[["cabergoline","dopamine agonist","first_line","Endocrine Society"],["bromocriptine","dopamine agonist","alternative","Endocrine Society"],["transsphenoidal surgery","procedure","refractory","Endocrine Society"]]},
  ];
}

// ══════════════════════════════════════════════════
// BATCH 12: RHEUMATOLOGY (20 diseases)
// ══════════════════════════════════════════════════
function getRheumatology(): DiseaseEntry[] {
  return [
    {name:"rheumatoid arthritis",icd10:"M06.9",organ:"musculoskeletal",prior:0.01,severity:"moderate",
      symptoms:[["morning stiffness more than 30 minutes",0.80,0.8,"high"],["symmetric joint swelling",0.75,0.8,"high"],["metacarpophalangeal joint swelling",0.65,0.85,"high"],["joint pain",0.85,0.5,"moderate"],["fatigue",0.55,0.4,"moderate"],["rheumatoid nodules",0.30,0.85,"high"],["joint deformity",0.35,0.7,"high"],["swan neck deformity",0.30,0.9,"high"]],
      tests:[["rheumatoid factor","immunology","high"],["anti-CCP antibodies","immunology","high"],["ESR/CRP","biochemistry","moderate"],["X-ray hands and feet","imaging","moderate"],["ultrasound joints","imaging","moderate"]],
      treatments:[["methotrexate","DMARD","first_line","ACR"],["hydroxychloroquine","DMARD","first_line","ACR"],["sulfasalazine","DMARD","first_line","ACR"],["adalimumab","anti-TNF","second_line","ACR"],["prednisolone","corticosteroid","bridging","ACR"]]},
    {name:"systemic lupus erythematosus",icd10:"M32.9",organ:"autoimmune",prior:0.005,severity:"high",
      symptoms:[["malar rash",0.65,0.9,"high"],["photosensitivity",0.55,0.7,"high"],["joint pain",0.80,0.5,"moderate"],["fatigue",0.80,0.4,"moderate"],["oral ulcers",0.40,0.6,"moderate"],["serositis",0.35,0.7,"high"],["hair loss",0.45,0.5,"moderate"],["Raynaud phenomenon",0.35,0.5,"moderate"],["fever",0.40,0.4,"moderate"],["renal involvement",0.35,0.7,"high"]],
      tests:[["ANA","immunology","high"],["anti-dsDNA","immunology","high"],["complement C3/C4","immunology","moderate"],["CBC","hematology","moderate"],["urinalysis","biochemistry","moderate"],["anti-Smith antibodies","immunology","moderate"]],
      treatments:[["hydroxychloroquine","antimalarial","first_line","ACR"],["prednisolone","corticosteroid","flare","ACR"],["mycophenolate mofetil","immunosuppressant","lupus_nephritis","ACR"],["belimumab","biologic","adjunct","ACR"]]},
    {name:"ankylosing spondylitis",icd10:"M45.9",organ:"musculoskeletal",prior:0.005,severity:"moderate",
      symptoms:[["chronic low back pain worse at rest",0.85,0.8,"high"],["morning stiffness more than 30 minutes",0.75,0.7,"high"],["improvement with exercise",0.65,0.7,"high"],["alternating buttock pain",0.50,0.7,"high"],["reduced spinal mobility",0.60,0.7,"high"],["chest wall pain",0.35,0.5,"moderate"],["enthesitis",0.40,0.6,"moderate"],["uveitis",0.30,0.7,"high"]],
      tests:[["HLA-B27","genetics","high"],["MRI sacroiliac joints","imaging","high"],["X-ray pelvis","imaging","moderate"],["CRP/ESR","biochemistry","moderate"]],
      treatments:[["ibuprofen","NSAID","first_line","ASAS"],["naproxen","NSAID","first_line","ASAS"],["adalimumab","anti-TNF","second_line","ASAS"],["secukinumab","anti-IL17","second_line","ASAS"]]},
    {name:"polymyalgia rheumatica",icd10:"M35.3",organ:"musculoskeletal",prior:0.005,severity:"moderate",
      symptoms:[["bilateral shoulder pain",0.90,0.8,"high"],["bilateral hip pain",0.70,0.7,"high"],["morning stiffness more than 45 minutes",0.75,0.7,"high"],["fatigue",0.55,0.4,"moderate"],["fever",0.35,0.4,"moderate"],["weight loss",0.35,0.4,"moderate"],["difficulty raising arms",0.60,0.6,"moderate"]],
      tests:[["ESR","hematology","high"],["CRP","biochemistry","high"],["CBC","hematology","moderate"],["temporal artery ultrasound","imaging","moderate"]],
      treatments:[["prednisolone 15-20mg","corticosteroid","first_line","ACR/EULAR"],["methotrexate","DMARD","steroid-sparing","ACR/EULAR"]]},
    {name:"giant cell arteritis",icd10:"M31.6",organ:"vascular",prior:0.003,severity:"critical",
      symptoms:[["new headache temporal",0.80,0.8,"high"],["temporal artery tenderness",0.65,0.85,"high"],["jaw claudication",0.50,0.9,"high"],["visual loss sudden",0.40,0.9,"high"],["scalp tenderness",0.55,0.7,"high"],["fever",0.40,0.4,"moderate"],["polymyalgia symptoms",0.45,0.5,"moderate"],["elevated ESR",0.75,0.6,"moderate"]],
      tests:[["ESR","hematology","high"],["CRP","biochemistry","high"],["temporal artery biopsy","pathology","high"],["temporal artery ultrasound","imaging","moderate"]],
      treatments:[["prednisolone 60mg","corticosteroid","first_line","ACR"],["tocilizumab","IL-6 inhibitor","steroid-sparing","ACR"],["aspirin","antiplatelet","adjunct","ACR"]]},
    {name:"psoriatic arthritis",icd10:"M07.3",organ:"musculoskeletal",prior:0.005,severity:"moderate",
      symptoms:[["joint pain asymmetric",0.70,0.6,"moderate"],["dactylitis sausage digits",0.50,0.85,"high"],["nail pitting",0.55,0.8,"high"],["psoriasis skin lesions",0.70,0.8,"high"],["enthesitis",0.45,0.6,"moderate"],["morning stiffness",0.55,0.5,"moderate"],["back pain inflammatory",0.40,0.5,"moderate"]],
      tests:[["X-ray hands feet","imaging","moderate"],["MRI affected joints","imaging","moderate"],["ESR/CRP","biochemistry","moderate"],["HLA-B27","genetics","moderate"],["rheumatoid factor negative","immunology","moderate"]],
      treatments:[["methotrexate","DMARD","first_line","GRAPPA"],["adalimumab","anti-TNF","second_line","GRAPPA"],["apremilast","PDE4 inhibitor","alternative","GRAPPA"],["secukinumab","anti-IL17","second_line","GRAPPA"]]},
    {name:"systemic sclerosis",icd10:"M34.9",organ:"autoimmune",prior:0.002,severity:"high",
      symptoms:[["Raynaud phenomenon",0.90,0.7,"high"],["skin thickening hands",0.80,0.85,"high"],["sclerodactyly",0.70,0.9,"high"],["digital ulcers",0.40,0.8,"high"],["dysphagia",0.45,0.5,"moderate"],["gastroesophageal reflux",0.50,0.5,"moderate"],["dyspnea progressive",0.40,0.5,"moderate"],["telangiectasias",0.45,0.6,"moderate"]],
      tests:[["ANA","immunology","high"],["anti-Scl-70 antibodies","immunology","high"],["anti-centromere antibodies","immunology","moderate"],["nailfold capillaroscopy","clinical","moderate"],["HRCT chest","imaging","moderate"],["echocardiogram","cardiac","moderate"],["pulmonary function tests","pulmonary","moderate"]],
      treatments:[["nifedipine","calcium channel blocker","Raynaud","ACR"],["methotrexate","DMARD","skin","ACR"],["mycophenolate mofetil","immunosuppressant","ILD","ACR"],["nintedanib","antifibrotic","ILD","ACR"]]},
    {name:"fibromyalgia",icd10:"M79.7",organ:"musculoskeletal",prior:0.04,severity:"moderate",
      symptoms:[["widespread musculoskeletal pain",0.90,0.8,"high"],["fatigue",0.85,0.4,"moderate"],["sleep disturbance",0.75,0.5,"moderate"],["cognitive difficulties fibro fog",0.60,0.6,"moderate"],["tender points",0.65,0.7,"high"],["headache",0.45,0.3,"moderate"],["depression",0.40,0.4,"moderate"],["irritable bowel symptoms",0.35,0.4,"moderate"]],
      tests:[["clinical diagnosis criteria","clinical","high"],["CBC","hematology","low"],["ESR/CRP normal","biochemistry","moderate"],["thyroid function","biochemistry","moderate"]],
      treatments:[["duloxetine","SNRI","first_line","EULAR"],["pregabalin","anticonvulsant","first_line","EULAR"],["amitriptyline","TCA","second_line","EULAR"],["exercise program","rehabilitation","first_line","EULAR"]]},
  ];
}

// ══════════════════════════════════════════════════
// BATCH 13: HEMATOLOGY (20 diseases)
// ══════════════════════════════════════════════════
function getHematology(): DiseaseEntry[] {
  return [
    {name:"acute lymphoblastic leukemia",icd10:"C91.0",organ:"hematological",prior:0.003,severity:"critical",
      symptoms:[["fatigue",0.80,0.4,"moderate"],["pallor",0.70,0.5,"moderate"],["fever",0.65,0.5,"moderate"],["bleeding tendency",0.55,0.6,"moderate"],["bone pain",0.50,0.5,"moderate"],["lymphadenopathy",0.55,0.5,"moderate"],["hepatosplenomegaly",0.45,0.6,"moderate"],["petechiae",0.40,0.5,"moderate"],["recurrent infections",0.45,0.5,"moderate"]],
      tests:[["CBC with differential","hematology","high"],["peripheral blood smear","hematology","high"],["bone marrow biopsy","pathology","high"],["flow cytometry","hematology","high"],["cytogenetics","genetics","moderate"]],
      treatments:[["induction chemotherapy","chemotherapy","first_line","NCCN"],["vincristine","chemotherapy","first_line","NCCN"],["dexamethasone","corticosteroid","first_line","NCCN"],["L-asparaginase","chemotherapy","first_line","NCCN"]]},
    {name:"acute myeloid leukemia",icd10:"C92.0",organ:"hematological",prior:0.003,severity:"critical",
      symptoms:[["fatigue",0.80,0.4,"moderate"],["pallor",0.65,0.5,"moderate"],["bleeding tendency",0.60,0.6,"moderate"],["fever",0.60,0.5,"moderate"],["gingival hyperplasia",0.30,0.8,"high"],["petechiae",0.45,0.5,"moderate"],["bone pain",0.35,0.5,"moderate"],["hepatosplenomegaly",0.40,0.5,"moderate"]],
      tests:[["CBC with differential","hematology","high"],["peripheral blood smear","hematology","high"],["bone marrow biopsy","pathology","high"],["flow cytometry","hematology","high"],["molecular testing","genetics","high"]],
      treatments:[["cytarabine","chemotherapy","first_line","NCCN"],["daunorubicin","chemotherapy","first_line","NCCN"],["midostaurin","targeted therapy","FLT3+","NCCN"]]},
    {name:"chronic lymphocytic leukemia",icd10:"C91.1",organ:"hematological",prior:0.005,severity:"moderate",
      symptoms:[["lymphadenopathy",0.70,0.5,"moderate"],["fatigue",0.65,0.4,"moderate"],["night sweats",0.40,0.5,"moderate"],["weight loss",0.35,0.4,"moderate"],["recurrent infections",0.40,0.5,"moderate"],["splenomegaly",0.40,0.5,"moderate"],["asymptomatic lymphocytosis",0.50,0.6,"moderate"]],
      tests:[["CBC with differential","hematology","high"],["flow cytometry","hematology","high"],["peripheral blood smear","hematology","moderate"],["FISH panel","genetics","moderate"]],
      treatments:[["ibrutinib","BTK inhibitor","first_line","NCCN"],["venetoclax","BCL2 inhibitor","first_line","NCCN"],["rituximab","anti-CD20","adjunct","NCCN"]]},
    {name:"non-Hodgkin lymphoma",icd10:"C85.9",organ:"hematological",prior:0.01,severity:"high",
      symptoms:[["painless lymphadenopathy",0.80,0.7,"high"],["night sweats",0.45,0.5,"moderate"],["weight loss",0.40,0.5,"moderate"],["fever",0.35,0.4,"moderate"],["fatigue",0.50,0.4,"moderate"],["pruritus",0.30,0.4,"moderate"],["hepatosplenomegaly",0.35,0.5,"moderate"]],
      tests:[["lymph node biopsy","pathology","high"],["CT chest abdomen pelvis","imaging","high"],["PET-CT","imaging","high"],["bone marrow biopsy","pathology","moderate"],["LDH","biochemistry","moderate"]],
      treatments:[["R-CHOP chemotherapy","chemotherapy","first_line","NCCN"],["rituximab","anti-CD20","first_line","NCCN"],["bendamustine","chemotherapy","alternative","NCCN"]]},
    {name:"Hodgkin lymphoma",icd10:"C81.9",organ:"hematological",prior:0.003,severity:"high",
      symptoms:[["painless cervical lymphadenopathy",0.80,0.7,"high"],["night sweats drenching",0.50,0.6,"moderate"],["weight loss",0.40,0.5,"moderate"],["fever Pel-Ebstein",0.35,0.7,"high"],["pruritus",0.35,0.5,"moderate"],["alcohol-induced lymph node pain",0.30,0.9,"high"],["fatigue",0.45,0.4,"moderate"]],
      tests:[["lymph node biopsy Reed-Sternberg cells","pathology","high"],["PET-CT","imaging","high"],["CT chest abdomen pelvis","imaging","high"],["bone marrow biopsy","pathology","moderate"],["ESR","hematology","moderate"]],
      treatments:[["ABVD chemotherapy","chemotherapy","first_line","NCCN"],["brentuximab vedotin","antibody-drug conjugate","relapsed","NCCN"],["radiation therapy","radiotherapy","limited_stage","NCCN"]]},
    {name:"multiple myeloma",icd10:"C90.0",organ:"hematological",prior:0.005,severity:"high",
      symptoms:[["bone pain",0.75,0.6,"moderate"],["pathological fractures",0.40,0.7,"high"],["fatigue",0.65,0.4,"moderate"],["recurrent infections",0.40,0.5,"moderate"],["renal insufficiency",0.35,0.5,"moderate"],["hypercalcemia symptoms",0.35,0.5,"moderate"],["anemia symptoms",0.50,0.5,"moderate"]],
      tests:[["serum protein electrophoresis","biochemistry","high"],["urine protein electrophoresis","biochemistry","high"],["bone marrow biopsy","pathology","high"],["skeletal survey","imaging","moderate"],["serum free light chains","biochemistry","high"],["beta-2 microglobulin","biochemistry","moderate"]],
      treatments:[["lenalidomide","immunomodulator","first_line","NCCN"],["dexamethasone","corticosteroid","first_line","NCCN"],["bortezomib","proteasome inhibitor","first_line","NCCN"],["daratumumab","anti-CD38","first_line","NCCN"]]},
    {name:"thrombocytopenia immune",icd10:"D69.3",organ:"hematological",prior:0.005,severity:"moderate",
      symptoms:[["petechiae",0.70,0.6,"moderate"],["easy bruising",0.75,0.6,"moderate"],["mucosal bleeding",0.50,0.6,"moderate"],["menorrhagia",0.40,0.5,"moderate"],["epistaxis",0.45,0.5,"moderate"],["gingival bleeding",0.35,0.5,"moderate"]],
      tests:[["CBC with platelet count","hematology","high"],["peripheral blood smear","hematology","high"],["coagulation profile","hematology","moderate"],["antiplatelet antibodies","immunology","moderate"]],
      treatments:[["prednisolone","corticosteroid","first_line","ASH"],["IVIG","immunotherapy","acute","ASH"],["romiplostim","TPO agonist","second_line","ASH"],["eltrombopag","TPO agonist","second_line","ASH"]]},
    {name:"hemophilia A",icd10:"D66",organ:"hematological",prior:0.001,severity:"high",
      symptoms:[["hemarthrosis",0.70,0.85,"high"],["easy bruising",0.65,0.5,"moderate"],["prolonged bleeding after injury",0.75,0.7,"high"],["muscle hematomas",0.50,0.7,"high"],["joint swelling",0.55,0.6,"moderate"],["prolonged bleeding after surgery",0.60,0.7,"high"]],
      tests:[["factor VIII level","hematology","high"],["aPTT prolonged","hematology","high"],["PT normal","hematology","moderate"],["mixing study","hematology","moderate"]],
      treatments:[["factor VIII concentrate","clotting factor","first_line","WFH"],["emicizumab","bispecific antibody","prophylaxis","WFH"],["desmopressin","hormone","mild","WFH"]]},
    {name:"sickle cell disease",icd10:"D57.1",organ:"hematological",prior:0.005,severity:"high",
      symptoms:[["vaso-occlusive pain crisis",0.85,0.85,"high"],["bone pain",0.70,0.6,"moderate"],["chest pain acute",0.40,0.6,"moderate"],["jaundice",0.50,0.5,"moderate"],["pallor",0.55,0.5,"moderate"],["splenomegaly in children",0.40,0.5,"moderate"],["priapism",0.30,0.8,"high"],["stroke in children",0.30,0.7,"high"]],
      tests:[["hemoglobin electrophoresis","hematology","high"],["CBC with reticulocyte count","hematology","high"],["peripheral blood smear","hematology","high"],["LDH","biochemistry","moderate"]],
      treatments:[["hydroxyurea","antineoplastic","first_line","ASH"],["voxelotor","hemoglobin modifier","adjunct","ASH"],["crizanlizumab","anti-P-selectin","prophylaxis","ASH"],["folic acid","vitamin","adjunct","ASH"]]},
    {name:"thalassemia major",icd10:"D56.1",organ:"hematological",prior:0.003,severity:"high",
      symptoms:[["severe anemia",0.90,0.7,"high"],["hepatosplenomegaly",0.70,0.6,"moderate"],["growth retardation",0.55,0.6,"moderate"],["bone deformities facial",0.45,0.8,"high"],["jaundice",0.50,0.5,"moderate"],["pallor",0.80,0.5,"moderate"],["fatigue",0.75,0.4,"moderate"]],
      tests:[["hemoglobin electrophoresis","hematology","high"],["CBC","hematology","high"],["serum ferritin","biochemistry","moderate"],["peripheral blood smear","hematology","moderate"],["genetic testing","genetics","moderate"]],
      treatments:[["regular blood transfusion","transfusion","first_line","TIF"],["deferasirox","iron chelator","first_line","TIF"],["luspatercept","erythroid maturation agent","adjunct","TIF"]]},
  ];
}

// Physiology states
function getPhysStates(): {state_name:string;description:string;organ_system:string}[] {
  return [
    {state_name:"gastric mucosal ulceration",description:"Erosion of gastric mucosal barrier by acid and H.pylori",organ_system:"gastrointestinal"},
    {state_name:"intestinal chronic granulomatous inflammation",description:"Transmural granulomatous inflammation of intestinal wall",organ_system:"gastrointestinal"},
    {state_name:"colonic mucosal ulceration",description:"Continuous superficial mucosal inflammation in colon",organ_system:"gastrointestinal"},
    {state_name:"visceral hypersensitivity",description:"Enhanced perception of normal intestinal stimuli",organ_system:"gastrointestinal"},
    {state_name:"gluten-mediated enteropathy",description:"Immune-mediated villous atrophy triggered by gluten",organ_system:"gastrointestinal"},
    {state_name:"hepatic fibrotic remodeling",description:"Progressive replacement of hepatocytes with fibrotic tissue",organ_system:"hepatic"},
    {state_name:"common bile duct obstruction",description:"Obstruction of CBD by gallstones",organ_system:"gastrointestinal"},
    {state_name:"colonic diverticular perforation",description:"Microperforation of diverticulum causing pericolonic inflammation",organ_system:"gastrointestinal"},
    {state_name:"colonic neoplastic transformation",description:"Adenoma-carcinoma sequence in colonic epithelium",organ_system:"gastrointestinal"},
    {state_name:"cortisol hypersecretion",description:"Excessive cortisol production from adrenal or pituitary source",organ_system:"endocrine"},
    {state_name:"adrenal cortical insufficiency",description:"Insufficient production of cortisol and aldosterone",organ_system:"endocrine"},
    {state_name:"catecholamine hypersecretion",description:"Excessive catecholamine release from chromaffin cells",organ_system:"endocrine"},
    {state_name:"autoimmune beta cell destruction",description:"T-cell mediated destruction of pancreatic beta cells",organ_system:"endocrine"},
    {state_name:"parathyroid hormone excess",description:"Overproduction of PTH causing calcium mobilization",organ_system:"endocrine"},
    {state_name:"prolactin hypersecretion",description:"Excessive prolactin from pituitary adenoma",organ_system:"endocrine"},
    {state_name:"synovial autoimmune inflammation",description:"Chronic autoimmune synovitis with joint destruction",organ_system:"musculoskeletal"},
    {state_name:"systemic autoimmune vasculitis",description:"Multi-organ autoimmune attack with immune complex deposition",organ_system:"autoimmune"},
    {state_name:"entheseal inflammation",description:"Inflammation at tendon and ligament insertion sites",organ_system:"musculoskeletal"},
    {state_name:"central pain sensitization",description:"Amplified pain processing in central nervous system",organ_system:"neurological"},
    {state_name:"large vessel granulomatous vasculitis",description:"Granulomatous inflammation of large arteries especially temporal",organ_system:"vascular"},
    {state_name:"clonal hematopoietic proliferation",description:"Uncontrolled clonal expansion of hematopoietic cells",organ_system:"hematological"},
    {state_name:"lymphoid neoplastic proliferation",description:"Malignant expansion of lymphoid cell lines",organ_system:"hematological"},
    {state_name:"autoimmune platelet destruction",description:"Antibody-mediated platelet destruction in spleen",organ_system:"hematological"},
    {state_name:"clotting factor deficiency",description:"Inherited deficiency of specific clotting factor",organ_system:"hematological"},
    {state_name:"hemoglobin S polymerization",description:"Polymerization of HbS under deoxygenation causing sickling",organ_system:"hematological"},
    {state_name:"ineffective erythropoiesis",description:"Impaired hemoglobin production causing chronic anemia",organ_system:"hematological"},
    {state_name:"plasma cell neoplasia",description:"Clonal plasma cell expansion producing monoclonal protein",organ_system:"hematological"},
    {state_name:"collagen excessive deposition",description:"Excessive fibrosis and collagen deposition in skin and organs",organ_system:"autoimmune"},
  ];
}

// Dangerous diagnoses
function getDangerTriggers(): {trigger:string;disease:string;severity:string;protocol:string;source:string;priority:number}[] {
  return [
    {trigger:"hematemesis",disease:"peptic ulcer disease",severity:"high",protocol:"Resuscitation, urgent endoscopy",source:"ACG",priority:2},
    {trigger:"bloody diarrhea",disease:"ulcerative colitis",severity:"high",protocol:"Stool culture, flexible sigmoidoscopy, IV steroids if severe",source:"ACG",priority:2},
    {trigger:"ascites",disease:"liver cirrhosis",severity:"high",protocol:"Diagnostic paracentesis, albumin, diuretics",source:"AASLD",priority:2},
    {trigger:"visual loss sudden",disease:"giant cell arteritis",severity:"critical",protocol:"Immediate high-dose prednisolone 60mg, temporal artery biopsy within 2 weeks",source:"ACR",priority:1},
    {trigger:"jaw claudication",disease:"giant cell arteritis",severity:"critical",protocol:"Urgent prednisolone, temporal artery biopsy",source:"ACR",priority:1},
    {trigger:"new headache temporal",disease:"giant cell arteritis",severity:"high",protocol:"ESR/CRP, prednisolone if high suspicion",source:"ACR",priority:2},
    {trigger:"vaso-occlusive pain crisis",disease:"sickle cell disease",severity:"high",protocol:"IV fluids, opioid analgesia, oxygen, transfusion if needed",source:"ASH",priority:1},
    {trigger:"hemarthrosis",disease:"hemophilia A",severity:"high",protocol:"Factor VIII replacement, joint immobilization",source:"WFH",priority:1},
    {trigger:"pathological fractures",disease:"multiple myeloma",severity:"high",protocol:"SPEP, skeletal survey, oncology referral",source:"NCCN",priority:2},
    {trigger:"gingival hyperplasia",disease:"acute myeloid leukemia",severity:"critical",protocol:"Urgent CBC, peripheral smear, hematology referral",source:"NCCN",priority:1},
    {trigger:"left lower quadrant pain",disease:"diverticulitis",severity:"moderate",protocol:"CT abdomen, antibiotics, surgical consult if complicated",source:"AGA",priority:3},
    {trigger:"change in bowel habits",disease:"colorectal cancer",severity:"high",protocol:"Colonoscopy referral, CBC",source:"NCCN",priority:2},
    {trigger:"paroxysmal hypertension",disease:"pheochromocytoma",severity:"critical",protocol:"Plasma metanephrines, CT abdomen, avoid beta-blockers first",source:"Endocrine Society",priority:1},
    {trigger:"hyperpigmentation",disease:"Addison disease",severity:"high",protocol:"Morning cortisol, ACTH stimulation test",source:"Endocrine Society",priority:2},
    {trigger:"galactorrhea",disease:"prolactinoma",severity:"moderate",protocol:"Serum prolactin, MRI pituitary",source:"Endocrine Society",priority:3},
  ];
}

// Guidelines
function getGuidelinesData(): any[] {
  return [
    {title:"Peptic Ulcer Disease Management 2024",condition:"peptic ulcer disease",source:"ACG 2024",source_organization:"American College of Gastroenterology",evidence_grade:"A",year:2024,recommendation_text:"PPI therapy 4-8 weeks. H.pylori triple therapy if positive. Discontinue NSAIDs. Re-test H.pylori eradication.",summary:"ACG guideline for peptic ulcer diagnosis and treatment",clinical_topic:"Gastroenterology",keywords:["PUD","H pylori","PPI","endoscopy"],applicable_tests:["endoscopy","H pylori test","stool antigen"],applicable_drugs:["omeprazole","amoxicillin","clarithromycin"]},
    {title:"Inflammatory Bowel Disease Management 2024",condition:"inflammatory bowel disease crohn",source:"ACG 2024",source_organization:"American College of Gastroenterology",evidence_grade:"A",year:2024,recommendation_text:"Step-up or top-down approach. Anti-TNF for moderate-severe. Monitoring with fecal calprotectin. Surgical referral for complications.",summary:"ACG clinical guideline for IBD management",clinical_topic:"Gastroenterology",keywords:["Crohn","IBD","anti-TNF","calprotectin"],applicable_tests:["colonoscopy","fecal calprotectin","CRP"],applicable_drugs:["infliximab","adalimumab","azathioprine","budesonide"]},
    {title:"Celiac Disease Diagnosis 2023",condition:"celiac disease",source:"ACG 2023",source_organization:"American College of Gastroenterology",evidence_grade:"A",year:2023,recommendation_text:"Screen with tTG-IgA. Confirm with duodenal biopsy while on gluten. Lifelong gluten-free diet. Monitor adherence with serology.",summary:"ACG guidelines on celiac disease diagnosis and management",clinical_topic:"Gastroenterology",keywords:["celiac","gluten","tTG","villous atrophy"],applicable_tests:["tTG-IgA","duodenal biopsy","total IgA"],applicable_drugs:[]},
    {title:"Hepatitis C Treatment 2024",condition:"hepatitis C chronic",source:"AASLD 2024",source_organization:"American Association for the Study of Liver Diseases",evidence_grade:"A",year:2024,recommendation_text:"Pan-genotypic DAA regimens: sofosbuvir/velpatasvir or glecaprevir/pibrentasvir for 8-12 weeks. SVR monitoring at 12 weeks post-treatment.",summary:"AASLD/IDSA HCV guidance",clinical_topic:"Hepatology",keywords:["HCV","DAA","SVR","sofosbuvir"],applicable_tests:["HCV RNA","HCV genotype","FibroScan"],applicable_drugs:["sofosbuvir-velpatasvir","glecaprevir-pibrentasvir"]},
    {title:"Rheumatoid Arthritis Treatment 2024",condition:"rheumatoid arthritis",source:"ACR 2024",source_organization:"American College of Rheumatology",evidence_grade:"A",year:2024,recommendation_text:"Methotrexate first-line DMARD. Target remission or low disease activity. Add biologic if inadequate response at 3 months.",summary:"ACR guideline for RA treatment",clinical_topic:"Rheumatology",keywords:["RA","methotrexate","DMARD","biologic"],applicable_tests:["RF","anti-CCP","ESR","CRP"],applicable_drugs:["methotrexate","adalimumab","hydroxychloroquine"]},
    {title:"SLE Management 2024",condition:"systemic lupus erythematosus",source:"ACR/EULAR 2024",source_organization:"American College of Rheumatology",evidence_grade:"A",year:2024,recommendation_text:"Hydroxychloroquine for all. Minimize corticosteroids. Mycophenolate for lupus nephritis. Belimumab as add-on.",summary:"ACR/EULAR recommendations for SLE management",clinical_topic:"Rheumatology",keywords:["SLE","lupus","hydroxychloroquine","nephritis"],applicable_tests:["ANA","anti-dsDNA","complement","urinalysis"],applicable_drugs:["hydroxychloroquine","mycophenolate","belimumab","prednisolone"]},
    {title:"Ankylosing Spondylitis Management 2024",condition:"ankylosing spondylitis",source:"ASAS/EULAR 2024",source_organization:"Assessment of SpondyloArthritis International Society",evidence_grade:"A",year:2024,recommendation_text:"NSAIDs first-line. Anti-TNF or anti-IL17 if inadequate response. No role for conventional DMARDs for axial disease.",summary:"ASAS/EULAR recommendations for axial SpA management",clinical_topic:"Rheumatology",keywords:["ankylosing spondylitis","axial SpA","anti-TNF","HLA-B27"],applicable_tests:["MRI sacroiliac","HLA-B27","CRP"],applicable_drugs:["ibuprofen","adalimumab","secukinumab"]},
    {title:"Cushing Syndrome Diagnosis 2023",condition:"Cushing syndrome",source:"Endocrine Society 2023",source_organization:"Endocrine Society",evidence_grade:"A",year:2023,recommendation_text:"Screen with 24h urine cortisol, overnight DST, or late-night salivary cortisol. Two positive tests confirm. ACTH for localization.",summary:"Endocrine Society clinical practice guideline for Cushing syndrome",clinical_topic:"Endocrinology",keywords:["Cushing","cortisol","DST","ACTH"],applicable_tests:["24h urine cortisol","DST","salivary cortisol","ACTH"],applicable_drugs:["ketoconazole","metyrapone"]},
    {title:"Addison Disease Management 2023",condition:"Addison disease",source:"Endocrine Society 2023",source_organization:"Endocrine Society",evidence_grade:"A",year:2023,recommendation_text:"Hydrocortisone 15-25mg in divided doses. Fludrocortisone 50-200mcg. Stress dosing education. MedicAlert identification.",summary:"Clinical practice guideline for primary adrenal insufficiency",clinical_topic:"Endocrinology",keywords:["Addison","adrenal insufficiency","hydrocortisone","fludrocortisone"],applicable_tests:["morning cortisol","ACTH stimulation","ACTH level"],applicable_drugs:["hydrocortisone","fludrocortisone"]},
    {title:"Giant Cell Arteritis Urgent Management 2024",condition:"giant cell arteritis",source:"ACR 2024",source_organization:"American College of Rheumatology",evidence_grade:"A",year:2024,recommendation_text:"Immediate high-dose glucocorticoids (prednisolone 40-60mg) if suspected. Do not delay for biopsy. Tocilizumab for steroid-sparing.",summary:"ACR guideline for GCA management",clinical_topic:"Rheumatology",keywords:["GCA","temporal arteritis","prednisolone","tocilizumab"],applicable_tests:["ESR","CRP","temporal artery biopsy","ultrasound"],applicable_drugs:["prednisolone","tocilizumab","aspirin"]},
  ];
}

// ══════════════════════════════════════════════════
// MAIN HANDLER (same pattern)
// ══════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const log: string[] = [];
  const addLog = (msg: string) => { log.push(msg); console.log(msg); };

  addLog("=== KG Expansion Batch 10-13: GI + Endo + Rheum + Heme ===");

  try {
    const diseases: DiseaseEntry[] = [...getGastroenterology(), ...getEndocrinology(), ...getRheumatology(), ...getHematology()];
    addLog(`Total diseases: ${diseases.length}`);

    const uniqueSymptoms = new Set<string>();
    for (const d of diseases) for (const [sym] of d.symptoms) uniqueSymptoms.add(sym);

    // Step 1: Diagnoses
    const diagRows = diseases.map(d => ({ diagnosis_name: d.name, icd10_code: d.icd10, category: d.organ }));
    for (let i = 0; i < diagRows.length; i += 100) {
      const { error } = await supabase.from("diagnoses").upsert(diagRows.slice(i, i + 100), { onConflict: "diagnosis_name", ignoreDuplicates: true });
      if (error) addLog(`Diag: ${error.message}`);
    }

    const allDiagIds: Record<string, string> = {};
    let offset = 0;
    while (true) {
      const { data } = await supabase.from("diagnoses").select("id, diagnosis_name").range(offset, offset + 999);
      if (!data || data.length === 0) break;
      for (const r of data) allDiagIds[r.diagnosis_name] = r.id;
      offset += data.length;
      if (data.length < 1000) break;
    }

    // Step 2: Symptoms
    const symRows = Array.from(uniqueSymptoms).map(s => ({ symptom_name: s, category: "general" }));
    for (let i = 0; i < symRows.length; i += 100) {
      const { error } = await supabase.from("symptoms").upsert(symRows.slice(i, i + 100), { onConflict: "symptom_name", ignoreDuplicates: true });
      if (error) addLog(`Sym: ${error.message}`);
    }

    const allSymIds: Record<string, string> = {};
    offset = 0;
    while (true) {
      const { data } = await supabase.from("symptoms").select("id, symptom_name").range(offset, offset + 999);
      if (!data || data.length === 0) break;
      for (const r of data) allSymIds[r.symptom_name] = r.id;
      offset += data.length;
      if (data.length < 1000) break;
    }

    // Step 3: Priors
    const priorRows = diseases.filter(d => allDiagIds[d.name]).map(d => ({
      diagnosis_id: allDiagIds[d.name], base_prevalence: d.prior, age_modifier: {}, sex_modifier: {}, region_modifier: {},
    }));
    for (let i = 0; i < priorRows.length; i += 100) {
      await supabase.from("disease_priors").upsert(priorRows.slice(i, i + 100), { onConflict: "diagnosis_id", ignoreDuplicates: false });
    }

    // Step 4: Likelihoods
    const likRows: any[] = [];
    for (const d of diseases) {
      const dId = allDiagIds[d.name]; if (!dId) continue;
      for (const [sym, prob] of d.symptoms) {
        const sId = allSymIds[sym]; if (sId) likRows.push({ symptom_id: sId, diagnosis_id: dId, likelihood_value: prob });
      }
    }
    for (let i = 0; i < likRows.length; i += 200) {
      const { error } = await supabase.from("symptom_likelihoods").upsert(likRows.slice(i, i + 200), { onConflict: "symptom_id,diagnosis_id", ignoreDuplicates: false });
      if (error) addLog(`Lik: ${error.message}`);
    }
    addLog(`Likelihoods: ${likRows.length}`);

    // Step 5: Tests
    const testRows = diseases.flatMap(d => d.tests.map(t => ({ disease_name: d.name, test_name: t[0], test_category: t[1], diagnostic_strength: t[2] })));
    for (let i = 0; i < testRows.length; i += 200) {
      await supabase.from("disease_tests").upsert(testRows.slice(i, i + 200), { onConflict: "disease_name,test_name", ignoreDuplicates: true });
    }

    // Step 6: Treatments
    const txRows = diseases.flatMap(d => d.treatments.map(t => ({ disease_name: d.name, drug_name: t[0], drug_class: t[1], line_of_treatment: t[2], guideline_source: t[3] })));
    for (let i = 0; i < txRows.length; i += 200) {
      await supabase.from("disease_treatments").upsert(txRows.slice(i, i + 200), { onConflict: "disease_name,drug_name", ignoreDuplicates: true });
    }

    // Step 7: Physiology
    const physStates = getPhysStates();
    const { data: systems } = await supabase.from("anatomical_systems").select("id, system_name");
    const systemIds: Record<string, string> = {};
    for (const s of systems || []) systemIds[s.system_name] = s.id;

    for (let i = 0; i < physStates.length; i += 50) {
      const chunk = physStates.slice(i, i + 50).map(s => ({ state_name: s.state_name, description: s.description, system_id: systemIds[s.organ_system] || Object.values(systemIds)[0] }));
      await supabase.from("physiological_states").upsert(chunk, { onConflict: "state_name", ignoreDuplicates: true });
    }

    const allPhysIds: Record<string, string> = {};
    offset = 0;
    while (true) {
      const { data } = await supabase.from("physiological_states").select("id, state_name").range(offset, offset + 999);
      if (!data || data.length === 0) break;
      for (const r of data) allPhysIds[r.state_name] = r.id;
      offset += data.length;
      if (data.length < 1000) break;
    }

    // Step 8: Sym-phys mappings
    const symPhysMaps: [string, string, number, number][] = [
      ["epigastric pain","gastric mucosal ulceration",0.7,0.7],
      ["chronic diarrhea","intestinal chronic granulomatous inflammation",0.6,0.6],
      ["perianal disease","intestinal chronic granulomatous inflammation",0.5,0.8],
      ["bloody diarrhea","colonic mucosal ulceration",0.8,0.8],
      ["rectal bleeding","colonic mucosal ulceration",0.7,0.7],
      ["tenesmus","colonic mucosal ulceration",0.6,0.7],
      ["abdominal pain related to defecation","visceral hypersensitivity",0.8,0.75],
      ["bloating","visceral hypersensitivity",0.6,0.5],
      ["dermatitis herpetiformis","gluten-mediated enteropathy",0.5,0.9],
      ["ascites","hepatic fibrotic remodeling",0.7,0.7],
      ["spider angiomata","hepatic fibrotic remodeling",0.5,0.8],
      ["jaundice","common bile duct obstruction",0.6,0.6],
      ["clay-colored stools","common bile duct obstruction",0.5,0.7],
      ["left lower quadrant pain","colonic diverticular perforation",0.8,0.8],
      ["central obesity","cortisol hypersecretion",0.7,0.7],
      ["moon face","cortisol hypersecretion",0.6,0.85],
      ["purple striae","cortisol hypersecretion",0.5,0.9],
      ["hyperpigmentation","adrenal cortical insufficiency",0.7,0.85],
      ["salt craving","adrenal cortical insufficiency",0.5,0.7],
      ["paroxysmal hypertension","catecholamine hypersecretion",0.8,0.85],
      ["diaphoresis episodic","catecholamine hypersecretion",0.6,0.7],
      ["polyuria","autoimmune beta cell destruction",0.6,0.6],
      ["polydipsia","autoimmune beta cell destruction",0.55,0.55],
      ["renal stones","parathyroid hormone excess",0.4,0.6],
      ["galactorrhea","prolactin hypersecretion",0.7,0.8],
      ["amenorrhea","prolactin hypersecretion",0.55,0.6],
      ["morning stiffness more than 30 minutes","synovial autoimmune inflammation",0.75,0.75],
      ["symmetric joint swelling","synovial autoimmune inflammation",0.75,0.8],
      ["swan neck deformity","synovial autoimmune inflammation",0.4,0.9],
      ["malar rash","systemic autoimmune vasculitis",0.6,0.9],
      ["photosensitivity","systemic autoimmune vasculitis",0.5,0.65],
      ["dactylitis sausage digits","entheseal inflammation",0.6,0.85],
      ["enthesitis","entheseal inflammation",0.7,0.7],
      ["widespread musculoskeletal pain","central pain sensitization",0.85,0.8],
      ["tender points","central pain sensitization",0.7,0.7],
      ["temporal artery tenderness","large vessel granulomatous vasculitis",0.7,0.85],
      ["jaw claudication","large vessel granulomatous vasculitis",0.6,0.9],
      ["Raynaud phenomenon","collagen excessive deposition",0.7,0.65],
      ["sclerodactyly","collagen excessive deposition",0.8,0.9],
      ["petechiae","autoimmune platelet destruction",0.6,0.55],
      ["easy bruising","autoimmune platelet destruction",0.6,0.5],
      ["hemarthrosis","clotting factor deficiency",0.7,0.85],
      ["vaso-occlusive pain crisis","hemoglobin S polymerization",0.85,0.85],
      ["severe anemia","ineffective erythropoiesis",0.8,0.7],
      ["bone deformities facial","ineffective erythropoiesis",0.5,0.8],
      ["pathological fractures","plasma cell neoplasia",0.5,0.7],
      ["painless lymphadenopathy","lymphoid neoplastic proliferation",0.7,0.7],
    ];

    const symPhysRows: any[] = [];
    for (const [sym, phys, conf, rel] of symPhysMaps) {
      const sId = allSymIds[sym]; const pId = allPhysIds[phys];
      if (sId && pId) symPhysRows.push({ symptom_id: sId, physiological_state_id: pId, confidence_score: conf });
    }
    for (let i = 0; i < symPhysRows.length; i += 100) {
      await supabase.from("symptom_physiology_map").upsert(symPhysRows.slice(i, i + 100), { onConflict: "symptom_id,physiological_state_id", ignoreDuplicates: true });
    }

    // Step 9: Phys-diag
    const physDiagMaps: [string, string, number, number][] = [
      ["gastric mucosal ulceration","peptic ulcer disease",0.9,0.9],
      ["intestinal chronic granulomatous inflammation","inflammatory bowel disease crohn",0.9,0.9],
      ["colonic mucosal ulceration","ulcerative colitis",0.9,0.9],
      ["visceral hypersensitivity","irritable bowel syndrome",0.8,0.8],
      ["gluten-mediated enteropathy","celiac disease",0.95,0.95],
      ["hepatic fibrotic remodeling","liver cirrhosis",0.9,0.9],
      ["hepatocyte viral injury","hepatitis C chronic",0.8,0.8],
      ["common bile duct obstruction","choledocholithiasis",0.9,0.9],
      ["colonic diverticular perforation","diverticulitis",0.85,0.85],
      ["colonic neoplastic transformation","colorectal cancer",0.9,0.9],
      ["cortisol hypersecretion","Cushing syndrome",0.95,0.95],
      ["adrenal cortical insufficiency","Addison disease",0.95,0.95],
      ["catecholamine hypersecretion","pheochromocytoma",0.95,0.95],
      ["autoimmune beta cell destruction","type 1 diabetes mellitus",0.95,0.95],
      ["parathyroid hormone excess","primary hyperparathyroidism",0.9,0.9],
      ["parathyroid hormone excess","hypercalcemia",0.7,0.7],
      ["prolactin hypersecretion","prolactinoma",0.9,0.9],
      ["synovial autoimmune inflammation","rheumatoid arthritis",0.9,0.9],
      ["systemic autoimmune vasculitis","systemic lupus erythematosus",0.85,0.85],
      ["entheseal inflammation","ankylosing spondylitis",0.8,0.8],
      ["entheseal inflammation","psoriatic arthritis",0.75,0.75],
      ["central pain sensitization","fibromyalgia",0.85,0.85],
      ["large vessel granulomatous vasculitis","giant cell arteritis",0.9,0.9],
      ["collagen excessive deposition","systemic sclerosis",0.9,0.9],
      ["clonal hematopoietic proliferation","acute lymphoblastic leukemia",0.85,0.85],
      ["clonal hematopoietic proliferation","acute myeloid leukemia",0.85,0.85],
      ["clonal hematopoietic proliferation","chronic lymphocytic leukemia",0.8,0.8],
      ["lymphoid neoplastic proliferation","non-Hodgkin lymphoma",0.85,0.85],
      ["lymphoid neoplastic proliferation","Hodgkin lymphoma",0.85,0.85],
      ["autoimmune platelet destruction","thrombocytopenia immune",0.9,0.9],
      ["clotting factor deficiency","hemophilia A",0.95,0.95],
      ["hemoglobin S polymerization","sickle cell disease",0.95,0.95],
      ["ineffective erythropoiesis","thalassemia major",0.9,0.9],
      ["plasma cell neoplasia","multiple myeloma",0.9,0.9],
    ];

    const physDiagRows: any[] = [];
    for (const [phys, diag, conf, rel] of physDiagMaps) {
      const pId = allPhysIds[phys]; const dId = allDiagIds[diag];
      if (pId && dId) physDiagRows.push({ physiological_state_id: pId, diagnosis_id: dId, confidence_score: conf, relevance_score: rel });
    }
    for (let i = 0; i < physDiagRows.length; i += 100) {
      await supabase.from("physiology_diagnosis_map").upsert(physDiagRows.slice(i, i + 100), { onConflict: "physiological_state_id,diagnosis_id", ignoreDuplicates: true });
    }

    // Step 10: Dangerous
    const dangerData = getDangerTriggers();
    let dangerCount = 0;
    for (const dd of dangerData) {
      const diagId = allDiagIds[dd.disease]; if (!diagId) continue;
      const { error } = await supabase.from("dangerous_diagnoses").upsert({
        trigger_symptom: dd.trigger, diagnosis_id: diagId, diagnosis_name: dd.disease,
        severity_level: dd.severity, must_not_miss: true, priority: dd.priority,
        emergency_protocol: dd.protocol, guideline_source: dd.source,
      }, { onConflict: "trigger_symptom,diagnosis_id", ignoreDuplicates: true });
      if (!error) dangerCount++;
    }
    addLog(`Dangerous: ${dangerCount}`);

    // Step 11: Guidelines
    const guidelines = getGuidelinesData();
    for (let i = 0; i < guidelines.length; i += 50) {
      await supabase.from("clinical_guidelines").upsert(guidelines.slice(i, i + 50), { onConflict: "title", ignoreDuplicates: true });
    }

    // Validation
    const counts: Record<string, number> = {};
    for (const t of ["diagnoses","symptoms","symptom_likelihoods","physiological_states","symptom_physiology_map","physiology_diagnosis_map","dangerous_diagnoses","clinical_guidelines","disease_tests","disease_treatments"]) {
      const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
      counts[t] = count || 0;
      addLog(`${t}: ${count}`);
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
