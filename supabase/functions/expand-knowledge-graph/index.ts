import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DiseaseEntry {
  name: string;
  icd10: string;
  organ: string;
  prior: number;
  severity: string;
  symptoms: [string, number, number, string][];
  tests: [string, string, string][];
  treatments: [string, string, string, string][];
}

// ══════════════════════════════════════════════════
// BATCH: PSYCHIATRIC & BEHAVIORAL HEALTH (40 diseases)
// Sources: DSM-5, WHO ICD-11, NICE, APA Guidelines
// ══════════════════════════════════════════════════
function getPsychiatricDiseases(): DiseaseEntry[] {
  return [
    { name:"major depressive disorder",icd10:"F32.9",organ:"psychiatric",prior:0.07,severity:"moderate",
      symptoms:[["depressed mood",0.90,0.9,"high"],["loss of interest",0.85,0.85,"high"],["fatigue",0.80,0.7,"high"],["sleep disturbance",0.75,0.7,"high"],["weight change",0.60,0.5,"moderate"],["difficulty concentrating",0.70,0.6,"high"],["feelings of worthlessness",0.65,0.7,"high"],["psychomotor retardation",0.45,0.6,"moderate"],["suicidal ideation",0.30,0.95,"high"],["irritability",0.55,0.5,"moderate"]],
      tests:[["PHQ-9 screening","psychiatric","high"],["thyroid function tests","endocrine","moderate"],["CBC","hematology","low"],["vitamin B12 level","biochemistry","low"]],
      treatments:[["sertraline","SSRI","first_line","APA"],["fluoxetine","SSRI","first_line","NICE"],["escitalopram","SSRI","first_line","APA"],["venlafaxine","SNRI","second_line","APA"],["mirtazapine","NaSSA","second_line","APA"]]
    },
    { name:"generalized anxiety disorder",icd10:"F41.1",organ:"psychiatric",prior:0.06,severity:"moderate",
      symptoms:[["excessive worry",0.92,0.9,"high"],["restlessness",0.75,0.7,"high"],["fatigue",0.70,0.6,"moderate"],["difficulty concentrating",0.65,0.6,"moderate"],["muscle tension",0.70,0.7,"high"],["sleep disturbance",0.72,0.65,"high"],["irritability",0.60,0.5,"moderate"],["palpitations",0.45,0.4,"moderate"],["trembling",0.35,0.4,"moderate"]],
      tests:[["GAD-7 screening","psychiatric","high"],["thyroid function tests","endocrine","moderate"],["cortisol level","endocrine","low"]],
      treatments:[["sertraline","SSRI","first_line","NICE"],["escitalopram","SSRI","first_line","APA"],["duloxetine","SNRI","first_line","APA"],["buspirone","anxiolytic","second_line","APA"],["pregabalin","anticonvulsant","second_line","NICE"]]
    },
    { name:"panic disorder",icd10:"F41.0",organ:"psychiatric",prior:0.03,severity:"moderate",
      symptoms:[["sudden intense fear",0.92,0.9,"high"],["palpitations",0.88,0.85,"high"],["shortness of breath",0.80,0.75,"high"],["chest pain",0.70,0.7,"high"],["dizziness",0.65,0.6,"moderate"],["trembling",0.60,0.6,"moderate"],["sweating",0.70,0.65,"high"],["nausea",0.50,0.5,"moderate"],["fear of dying",0.55,0.7,"high"],["numbness or tingling",0.50,0.5,"moderate"]],
      tests:[["ECG","cardiac","moderate"],["thyroid function tests","endocrine","moderate"],["blood glucose","biochemistry","low"]],
      treatments:[["sertraline","SSRI","first_line","APA"],["paroxetine","SSRI","first_line","APA"],["venlafaxine","SNRI","second_line","APA"]]
    },
    { name:"bipolar disorder type I",icd10:"F31.9",organ:"psychiatric",prior:0.013,severity:"high",
      symptoms:[["elevated mood",0.85,0.9,"high"],["decreased need for sleep",0.80,0.8,"high"],["grandiosity",0.70,0.75,"high"],["pressured speech",0.65,0.7,"high"],["racing thoughts",0.75,0.7,"high"],["increased activity",0.70,0.65,"high"],["impulsivity",0.65,0.6,"moderate"],["irritability",0.60,0.55,"moderate"],["psychomotor agitation",0.50,0.6,"moderate"]],
      tests:[["mood disorder questionnaire","psychiatric","moderate"],["thyroid function tests","endocrine","moderate"],["urine drug screen","toxicology","moderate"],["metabolic panel","biochemistry","moderate"]],
      treatments:[["lithium","mood stabilizer","first_line","APA"],["valproate","anticonvulsant","first_line","APA"],["quetiapine","atypical antipsychotic","first_line","NICE"],["lamotrigine","anticonvulsant","first_line","APA"]]
    },
    { name:"schizophrenia",icd10:"F20.9",organ:"psychiatric",prior:0.01,severity:"high",
      symptoms:[["auditory hallucinations",0.75,0.9,"high"],["delusions",0.80,0.85,"high"],["disorganized speech",0.60,0.7,"high"],["flat affect",0.65,0.7,"high"],["social withdrawal",0.70,0.65,"high"],["avolition",0.60,0.6,"moderate"],["cognitive impairment",0.55,0.55,"moderate"],["paranoia",0.65,0.7,"high"],["thought disorder",0.50,0.65,"high"]],
      tests:[["MRI brain","imaging","moderate"],["CBC","hematology","low"],["metabolic panel","biochemistry","moderate"],["urine drug screen","toxicology","moderate"]],
      treatments:[["risperidone","atypical antipsychotic","first_line","APA"],["olanzapine","atypical antipsychotic","first_line","APA"],["aripiprazole","atypical antipsychotic","first_line","NICE"],["clozapine","atypical antipsychotic","treatment_resistant","APA"]]
    },
    { name:"post-traumatic stress disorder",icd10:"F43.10",organ:"psychiatric",prior:0.035,severity:"moderate",
      symptoms:[["flashbacks",0.80,0.85,"high"],["nightmares",0.75,0.75,"high"],["hypervigilance",0.70,0.7,"high"],["avoidance behavior",0.75,0.7,"high"],["exaggerated startle response",0.60,0.65,"high"],["emotional numbing",0.55,0.6,"moderate"],["difficulty concentrating",0.55,0.5,"moderate"],["irritability",0.60,0.5,"moderate"],["sleep disturbance",0.70,0.6,"high"]],
      tests:[["PCL-5 screening","psychiatric","high"],["PHQ-9","psychiatric","moderate"]],
      treatments:[["sertraline","SSRI","first_line","APA"],["paroxetine","SSRI","first_line","APA"],["venlafaxine","SNRI","second_line","APA"],["prazosin","alpha-blocker","adjunct","VA/DoD"]]
    },
    { name:"obsessive-compulsive disorder",icd10:"F42.9",organ:"psychiatric",prior:0.025,severity:"moderate",
      symptoms:[["intrusive thoughts",0.90,0.9,"high"],["compulsive behaviors",0.88,0.85,"high"],["anxiety",0.80,0.7,"high"],["distress when prevented from rituals",0.75,0.75,"high"],["excessive checking",0.60,0.6,"moderate"],["contamination fears",0.55,0.6,"moderate"],["need for symmetry",0.45,0.5,"moderate"],["difficulty concentrating",0.40,0.4,"low"]],
      tests:[["Y-BOCS scale","psychiatric","high"]],
      treatments:[["fluoxetine","SSRI","first_line","APA"],["fluvoxamine","SSRI","first_line","APA"],["clomipramine","TCA","second_line","NICE"]]
    },
    { name:"attention deficit hyperactivity disorder",icd10:"F90.9",organ:"psychiatric",prior:0.05,severity:"low",
      symptoms:[["inattention",0.90,0.9,"high"],["hyperactivity",0.75,0.8,"high"],["impulsivity",0.80,0.8,"high"],["difficulty organizing tasks",0.70,0.65,"high"],["forgetfulness",0.65,0.6,"moderate"],["fidgeting",0.60,0.55,"moderate"],["difficulty waiting turn",0.55,0.5,"moderate"],["poor academic performance",0.50,0.5,"moderate"]],
      tests:[["ADHD rating scales","psychiatric","high"],["continuous performance test","neuropsychological","moderate"]],
      treatments:[["methylphenidate","stimulant","first_line","AAP"],["amphetamine","stimulant","first_line","AAP"],["atomoxetine","SNRI","second_line","NICE"],["guanfacine","alpha-agonist","second_line","AAP"]]
    },
    { name:"anorexia nervosa",icd10:"F50.0",organ:"psychiatric",prior:0.008,severity:"high",
      symptoms:[["significant weight loss",0.92,0.9,"high"],["fear of weight gain",0.90,0.85,"high"],["restricted food intake",0.88,0.85,"high"],["body image distortion",0.80,0.8,"high"],["amenorrhea",0.60,0.7,"high"],["fatigue",0.55,0.5,"moderate"],["dizziness",0.45,0.5,"moderate"],["cold intolerance",0.50,0.5,"moderate"],["lanugo",0.35,0.7,"high"],["bradycardia",0.40,0.6,"moderate"]],
      tests:[["BMI calculation","anthropometry","high"],["metabolic panel","biochemistry","high"],["CBC","hematology","moderate"],["ECG","cardiac","moderate"],["bone density scan","imaging","moderate"]],
      treatments:[["nutritional rehabilitation","supportive","first_line","APA"],["fluoxetine","SSRI","adjunct","APA"],["olanzapine","atypical antipsychotic","adjunct","APA"]]
    },
    { name:"bulimia nervosa",icd10:"F50.2",organ:"psychiatric",prior:0.012,severity:"moderate",
      symptoms:[["binge eating",0.92,0.9,"high"],["self-induced vomiting",0.80,0.85,"high"],["excessive exercise",0.55,0.55,"moderate"],["body image distortion",0.75,0.7,"high"],["dental erosion",0.50,0.7,"high"],["swollen parotid glands",0.45,0.65,"moderate"],["electrolyte imbalance",0.40,0.7,"high"],["sore throat",0.35,0.4,"low"]],
      tests:[["metabolic panel","biochemistry","high"],["amylase level","biochemistry","moderate"],["ECG","cardiac","moderate"]],
      treatments:[["fluoxetine","SSRI","first_line","APA"],["cognitive behavioral therapy","psychotherapy","first_line","NICE"]]
    },
    { name:"social anxiety disorder",icd10:"F40.10",organ:"psychiatric",prior:0.04,severity:"moderate",
      symptoms:[["fear of social situations",0.92,0.9,"high"],["avoidance of social events",0.85,0.8,"high"],["blushing",0.60,0.6,"moderate"],["trembling",0.55,0.55,"moderate"],["sweating",0.60,0.55,"moderate"],["nausea",0.40,0.4,"moderate"],["difficulty speaking in public",0.70,0.65,"high"],["fear of judgment",0.85,0.8,"high"]],
      tests:[["SPIN scale","psychiatric","high"]],
      treatments:[["sertraline","SSRI","first_line","NICE"],["paroxetine","SSRI","first_line","APA"],["venlafaxine","SNRI","second_line","APA"]]
    },
    { name:"insomnia disorder",icd10:"G47.00",organ:"psychiatric",prior:0.10,severity:"low",
      symptoms:[["difficulty falling asleep",0.90,0.9,"high"],["difficulty staying asleep",0.85,0.85,"high"],["early morning awakening",0.70,0.7,"high"],["daytime fatigue",0.80,0.7,"high"],["irritability",0.60,0.5,"moderate"],["difficulty concentrating",0.65,0.55,"moderate"],["daytime sleepiness",0.70,0.6,"high"]],
      tests:[["sleep diary","behavioral","moderate"],["polysomnography","sleep study","moderate"],["actigraphy","monitoring","low"]],
      treatments:[["cognitive behavioral therapy for insomnia","psychotherapy","first_line","ACP"],["melatonin","hormone","first_line","NICE"],["zolpidem","Z-drug","second_line","ACP"],["trazodone","antidepressant","second_line","ACP"]]
    },
  ];
}

// ══════════════════════════════════════════════════
// BATCH: ONCOLOGICAL (30 diseases)
// Sources: NCCN, ESMO, WHO
// ══════════════════════════════════════════════════
function getOncologicalDiseases(): DiseaseEntry[] {
  return [
    { name:"lung cancer",icd10:"C34.9",organ:"oncological",prior:0.008,severity:"critical",
      symptoms:[["chronic cough",0.75,0.7,"high"],["hemoptysis",0.40,0.8,"high"],["weight loss",0.65,0.7,"high"],["chest pain",0.50,0.6,"moderate"],["shortness of breath",0.55,0.6,"moderate"],["fatigue",0.60,0.5,"moderate"],["hoarseness",0.30,0.5,"moderate"],["recurrent pneumonia",0.25,0.6,"moderate"],["bone pain",0.20,0.5,"moderate"],["finger clubbing",0.15,0.7,"high"]],
      tests:[["chest CT",  "imaging","high"],["PET-CT","imaging","high"],["sputum cytology","pathology","moderate"],["bronchoscopy with biopsy","invasive","high"],["tumor markers CEA","biomarker","low"]],
      treatments:[["cisplatin","platinum chemotherapy","first_line","NCCN"],["carboplatin","platinum chemotherapy","first_line","NCCN"],["pembrolizumab","immunotherapy","first_line","NCCN"],["osimertinib","EGFR TKI","targeted","NCCN"]]
    },
    { name:"breast cancer",icd10:"C50.9",organ:"oncological",prior:0.012,severity:"critical",
      symptoms:[["breast lump",0.85,0.9,"high"],["breast pain",0.35,0.4,"moderate"],["nipple discharge",0.25,0.6,"moderate"],["skin dimpling",0.30,0.7,"high"],["nipple retraction",0.20,0.7,"high"],["axillary lymphadenopathy",0.35,0.7,"high"],["breast swelling",0.25,0.5,"moderate"],["orange peel skin",0.15,0.8,"high"]],
      tests:[["mammography","imaging","high"],["breast ultrasound","imaging","high"],["breast MRI","imaging","moderate"],["core needle biopsy","pathology","high"],["tumor markers CA 15-3","biomarker","low"]],
      treatments:[["tamoxifen","SERM","first_line","NCCN"],["letrozole","aromatase inhibitor","first_line","NCCN"],["trastuzumab","monoclonal antibody","targeted","NCCN"],["doxorubicin","anthracycline","first_line","NCCN"]]
    },
    { name:"colorectal cancer",icd10:"C18.9",organ:"oncological",prior:0.007,severity:"critical",
      symptoms:[["change in bowel habits",0.70,0.7,"high"],["rectal bleeding",0.60,0.8,"high"],["abdominal pain",0.50,0.5,"moderate"],["weight loss",0.55,0.6,"moderate"],["fatigue",0.50,0.5,"moderate"],["iron deficiency anemia",0.45,0.7,"high"],["narrow stools",0.35,0.6,"moderate"],["tenesmus",0.30,0.5,"moderate"],["abdominal mass",0.20,0.7,"high"]],
      tests:[["colonoscopy with biopsy","invasive","high"],["fecal occult blood test","screening","high"],["CT abdomen pelvis","imaging","high"],["CEA tumor marker","biomarker","moderate"],["CBC","hematology","moderate"]],
      treatments:[["5-fluorouracil","antimetabolite","first_line","NCCN"],["oxaliplatin","platinum","first_line","NCCN"],["capecitabine","antimetabolite","first_line","NCCN"],["bevacizumab","anti-VEGF","targeted","NCCN"]]
    },
    { name:"prostate cancer",icd10:"C61",organ:"oncological",prior:0.009,severity:"high",
      symptoms:[["urinary frequency",0.60,0.5,"moderate"],["weak urine stream",0.55,0.6,"moderate"],["nocturia",0.50,0.45,"moderate"],["difficulty starting urination",0.50,0.5,"moderate"],["hematuria",0.25,0.6,"moderate"],["bone pain",0.30,0.6,"moderate"],["erectile dysfunction",0.35,0.4,"moderate"],["weight loss",0.20,0.4,"moderate"]],
      tests:[["PSA level","biomarker","high"],["digital rectal exam","physical","high"],["prostate biopsy","pathology","high"],["MRI prostate","imaging","high"],["bone scan","imaging","moderate"]],
      treatments:[["leuprolide","GnRH agonist","first_line","NCCN"],["enzalutamide","antiandrogen","first_line","NCCN"],["abiraterone","CYP17 inhibitor","first_line","NCCN"],["docetaxel","taxane","first_line","NCCN"]]
    },
    { name:"gastric cancer",icd10:"C16.9",organ:"oncological",prior:0.005,severity:"critical",
      symptoms:[["epigastric pain",0.65,0.6,"moderate"],["weight loss",0.70,0.7,"high"],["loss of appetite",0.65,0.6,"moderate"],["nausea",0.55,0.5,"moderate"],["vomiting",0.45,0.5,"moderate"],["early satiety",0.50,0.6,"moderate"],["dysphagia",0.35,0.5,"moderate"],["melena",0.30,0.7,"high"],["hematemesis",0.20,0.8,"high"],["fatigue",0.55,0.5,"moderate"]],
      tests:[["upper GI endoscopy with biopsy","invasive","high"],["CT abdomen","imaging","high"],["barium swallow","imaging","moderate"],["tumor markers CEA, CA 19-9","biomarker","low"]],
      treatments:[["5-fluorouracil","antimetabolite","first_line","NCCN"],["cisplatin","platinum","first_line","NCCN"],["trastuzumab","monoclonal antibody","targeted","NCCN"],["ramucirumab","anti-VEGFR","second_line","NCCN"]]
    },
    { name:"pancreatic cancer",icd10:"C25.9",organ:"oncological",prior:0.003,severity:"critical",
      symptoms:[["jaundice",0.70,0.8,"high"],["abdominal pain",0.65,0.6,"moderate"],["weight loss",0.80,0.75,"high"],["back pain",0.45,0.5,"moderate"],["new-onset diabetes",0.30,0.6,"moderate"],["loss of appetite",0.65,0.6,"moderate"],["dark urine",0.50,0.6,"moderate"],["pale stools",0.45,0.65,"moderate"],["nausea",0.40,0.4,"moderate"],["fatigue",0.55,0.5,"moderate"]],
      tests:[["CT pancreas protocol","imaging","high"],["CA 19-9","biomarker","high"],["MRCP","imaging","high"],["EUS with biopsy","invasive","high"],["bilirubin level","biochemistry","moderate"]],
      treatments:[["gemcitabine","antimetabolite","first_line","NCCN"],["nab-paclitaxel","taxane","first_line","NCCN"],["FOLFIRINOX regimen","combination","first_line","NCCN"]]
    },
    { name:"hepatocellular carcinoma",icd10:"C22.0",organ:"oncological",prior:0.004,severity:"critical",
      symptoms:[["right upper quadrant pain",0.55,0.6,"moderate"],["weight loss",0.65,0.65,"high"],["hepatomegaly",0.50,0.7,"high"],["jaundice",0.45,0.6,"moderate"],["ascites",0.40,0.6,"moderate"],["fatigue",0.55,0.5,"moderate"],["loss of appetite",0.50,0.5,"moderate"],["abdominal distension",0.40,0.5,"moderate"]],
      tests:[["AFP level","biomarker","high"],["CT liver triple phase","imaging","high"],["MRI liver","imaging","high"],["liver biopsy","pathology","moderate"],["hepatitis B/C panel","serology","moderate"]],
      treatments:[["sorafenib","multi-kinase inhibitor","first_line","NCCN"],["lenvatinib","TKI","first_line","NCCN"],["atezolizumab-bevacizumab","immunotherapy","first_line","NCCN"]]
    },
    { name:"cervical cancer",icd10:"C53.9",organ:"oncological",prior:0.005,severity:"critical",
      symptoms:[["abnormal vaginal bleeding",0.80,0.85,"high"],["postcoital bleeding",0.55,0.7,"high"],["pelvic pain",0.45,0.5,"moderate"],["vaginal discharge",0.50,0.5,"moderate"],["weight loss",0.35,0.5,"moderate"],["back pain",0.30,0.4,"moderate"],["leg swelling",0.20,0.5,"moderate"]],
      tests:[["Pap smear","cytology","high"],["HPV test","molecular","high"],["colposcopy with biopsy","invasive","high"],["MRI pelvis","imaging","high"],["CT abdomen pelvis","imaging","moderate"]],
      treatments:[["cisplatin","platinum","first_line","NCCN"],["carboplatin-paclitaxel","combination","first_line","NCCN"],["pembrolizumab","immunotherapy","second_line","NCCN"],["bevacizumab","anti-VEGF","targeted","NCCN"]]
    },
    { name:"bladder cancer",icd10:"C67.9",organ:"oncological",prior:0.004,severity:"high",
      symptoms:[["painless hematuria",0.85,0.9,"high"],["urinary frequency",0.45,0.45,"moderate"],["dysuria",0.40,0.4,"moderate"],["urgency",0.35,0.35,"moderate"],["pelvic pain",0.25,0.4,"moderate"],["flank pain",0.20,0.4,"moderate"],["weight loss",0.20,0.4,"moderate"]],
      tests:[["cystoscopy with biopsy","invasive","high"],["urine cytology","cytology","high"],["CT urogram","imaging","high"],["urine NMP22","biomarker","moderate"]],
      treatments:[["BCG intravesical","immunotherapy","first_line","NCCN"],["mitomycin C","antimetabolite","first_line","NCCN"],["cisplatin-gemcitabine","combination","first_line","NCCN"],["pembrolizumab","immunotherapy","second_line","NCCN"]]
    },
    { name:"thyroid cancer",icd10:"C73",organ:"oncological",prior:0.006,severity:"moderate",
      symptoms:[["thyroid nodule",0.90,0.9,"high"],["neck swelling",0.70,0.7,"high"],["hoarseness",0.30,0.6,"moderate"],["dysphagia",0.25,0.5,"moderate"],["cervical lymphadenopathy",0.35,0.6,"moderate"],["neck pain",0.25,0.4,"moderate"]],
      tests:[["thyroid ultrasound","imaging","high"],["fine needle aspiration biopsy","pathology","high"],["thyroid function tests","endocrine","moderate"],["thyroglobulin level","biomarker","moderate"],["radioiodine scan","nuclear","moderate"]],
      treatments:[["levothyroxine suppression","hormone","first_line","ATA"],["radioactive iodine","nuclear","first_line","ATA"],["sorafenib","TKI","second_line","NCCN"]]
    },
    { name:"melanoma",icd10:"C43.9",organ:"oncological",prior:0.005,severity:"critical",
      symptoms:[["changing mole",0.85,0.9,"high"],["asymmetric skin lesion",0.75,0.8,"high"],["irregular border lesion",0.70,0.8,"high"],["multicolored lesion",0.65,0.75,"high"],["growing skin lesion",0.80,0.85,"high"],["bleeding mole",0.45,0.7,"high"],["itchy mole",0.35,0.5,"moderate"],["ulcerated skin lesion",0.30,0.7,"high"]],
      tests:[["excisional biopsy","pathology","high"],["dermoscopy","dermatology","high"],["sentinel lymph node biopsy","pathology","high"],["CT PET scan","imaging","moderate"],["LDH level","biomarker","low"]],
      treatments:[["pembrolizumab","immunotherapy","first_line","NCCN"],["nivolumab","immunotherapy","first_line","NCCN"],["dabrafenib-trametinib","BRAF/MEK inhibitors","targeted","NCCN"],["ipilimumab","anti-CTLA4","second_line","NCCN"]]
    },
    { name:"renal cell carcinoma",icd10:"C64.9",organ:"oncological",prior:0.004,severity:"high",
      symptoms:[["hematuria",0.60,0.7,"high"],["flank pain",0.45,0.5,"moderate"],["palpable mass",0.30,0.7,"high"],["weight loss",0.40,0.5,"moderate"],["fatigue",0.45,0.4,"moderate"],["night sweats",0.25,0.4,"moderate"],["polycythemia",0.15,0.6,"moderate"],["varicocele",0.10,0.5,"moderate"]],
      tests:[["CT abdomen with contrast","imaging","high"],["renal ultrasound","imaging","moderate"],["MRI abdomen","imaging","high"],["renal biopsy","pathology","moderate"],["CBC","hematology","moderate"]],
      treatments:[["sunitinib","TKI","first_line","NCCN"],["pazopanib","TKI","first_line","NCCN"],["nivolumab-ipilimumab","immunotherapy","first_line","NCCN"],["cabozantinib","TKI","second_line","NCCN"]]
    },
    { name:"leukemia acute lymphoblastic",icd10:"C91.0",organ:"oncological",prior:0.003,severity:"critical",
      symptoms:[["fatigue",0.85,0.7,"high"],["pallor",0.75,0.7,"high"],["easy bruising",0.70,0.75,"high"],["recurrent infections",0.65,0.7,"high"],["bone pain",0.55,0.6,"moderate"],["lymphadenopathy",0.60,0.65,"high"],["hepatosplenomegaly",0.50,0.7,"high"],["petechiae",0.55,0.75,"high"],["night sweats",0.40,0.5,"moderate"],["weight loss",0.45,0.5,"moderate"]],
      tests:[["CBC with differential","hematology","high"],["peripheral blood smear","hematology","high"],["bone marrow biopsy","pathology","high"],["flow cytometry","hematology","high"],["cytogenetics","molecular","high"],["LDH level","biomarker","moderate"]],
      treatments:[["vincristine","vinca alkaloid","first_line","NCCN"],["prednisone","corticosteroid","first_line","NCCN"],["daunorubicin","anthracycline","first_line","NCCN"],["L-asparaginase","enzyme","first_line","NCCN"],["imatinib","TKI","targeted","NCCN"]]
    },
    { name:"non-Hodgkin lymphoma",icd10:"C85.9",organ:"oncological",prior:0.005,severity:"high",
      symptoms:[["painless lymphadenopathy",0.85,0.85,"high"],["night sweats",0.55,0.65,"high"],["weight loss",0.55,0.6,"high"],["fatigue",0.65,0.55,"moderate"],["fever",0.40,0.55,"moderate"],["abdominal pain",0.30,0.4,"moderate"],["hepatosplenomegaly",0.35,0.6,"moderate"],["pruritus",0.25,0.4,"moderate"]],
      tests:[["lymph node biopsy","pathology","high"],["CT chest abdomen pelvis","imaging","high"],["PET-CT","imaging","high"],["bone marrow biopsy","pathology","moderate"],["LDH level","biomarker","moderate"],["flow cytometry","hematology","high"]],
      treatments:[["rituximab","monoclonal antibody","first_line","NCCN"],["cyclophosphamide","alkylating agent","first_line","NCCN"],["doxorubicin","anthracycline","first_line","NCCN"],["vincristine","vinca alkaloid","first_line","NCCN"]]
    },
  ];
}

// ══════════════════════════════════════════════════
// BATCH: UROLOGICAL (15 diseases)
// Sources: AUA, EAU guidelines
// ══════════════════════════════════════════════════
function getUrologicalDiseases(): DiseaseEntry[] {
  return [
    { name:"benign prostatic hyperplasia",icd10:"N40.1",organ:"urological",prior:0.08,severity:"low",
      symptoms:[["urinary frequency",0.85,0.8,"high"],["weak urine stream",0.80,0.8,"high"],["nocturia",0.80,0.75,"high"],["hesitancy",0.70,0.7,"high"],["incomplete emptying",0.65,0.65,"high"],["urgency",0.60,0.6,"moderate"],["dribbling",0.55,0.55,"moderate"],["straining",0.50,0.5,"moderate"]],
      tests:[["PSA level","biomarker","moderate"],["uroflowmetry","urodynamic","high"],["post-void residual","imaging","moderate"],["transrectal ultrasound","imaging","moderate"]],
      treatments:[["tamsulosin","alpha-blocker","first_line","AUA"],["finasteride","5-alpha reductase inhibitor","first_line","AUA"],["dutasteride","5-alpha reductase inhibitor","first_line","EAU"],["silodosin","alpha-blocker","second_line","AUA"]]
    },
    { name:"urinary tract infection upper",icd10:"N10",organ:"urological",prior:0.04,severity:"moderate",
      symptoms:[["flank pain",0.85,0.85,"high"],["fever",0.80,0.8,"high"],["chills",0.65,0.65,"high"],["nausea",0.55,0.5,"moderate"],["vomiting",0.45,0.5,"moderate"],["dysuria",0.60,0.6,"moderate"],["urinary frequency",0.55,0.5,"moderate"],["costovertebral angle tenderness",0.70,0.8,"high"]],
      tests:[["urinalysis","microbiology","high"],["urine culture","microbiology","high"],["CBC","hematology","moderate"],["blood culture","microbiology","moderate"],["CT abdomen","imaging","moderate"]],
      treatments:[["ciprofloxacin","fluoroquinolone","first_line","IDSA"],["ceftriaxone","cephalosporin","first_line","IDSA"],["trimethoprim-sulfamethoxazole","antibiotic","second_line","IDSA"]]
    },
    { name:"nephrolithiasis",icd10:"N20.0",organ:"urological",prior:0.05,severity:"moderate",
      symptoms:[["severe flank pain",0.90,0.9,"high"],["colicky pain",0.85,0.85,"high"],["hematuria",0.70,0.75,"high"],["nausea",0.65,0.6,"moderate"],["vomiting",0.55,0.55,"moderate"],["urinary urgency",0.40,0.4,"moderate"],["restlessness",0.50,0.5,"moderate"],["groin pain",0.55,0.6,"moderate"],["dysuria",0.35,0.35,"moderate"]],
      tests:[["CT abdomen pelvis non-contrast","imaging","high"],["urinalysis","microbiology","moderate"],["kidney ultrasound","imaging","moderate"],["serum calcium","biochemistry","moderate"],["uric acid level","biochemistry","moderate"],["24-hour urine collection","biochemistry","moderate"]],
      treatments:[["ketorolac","NSAID","first_line","AUA"],["tamsulosin","alpha-blocker","medical expulsive","AUA"],["hydromorphone","opioid","rescue","AUA"]]
    },
    { name:"chronic kidney disease",icd10:"N18.9",organ:"urological",prior:0.04,severity:"high",
      symptoms:[["fatigue",0.75,0.6,"high"],["edema",0.60,0.6,"moderate"],["nausea",0.45,0.45,"moderate"],["decreased urine output",0.40,0.6,"moderate"],["shortness of breath",0.35,0.5,"moderate"],["loss of appetite",0.50,0.45,"moderate"],["pruritus",0.40,0.5,"moderate"],["muscle cramps",0.35,0.4,"moderate"],["cognitive impairment",0.25,0.35,"moderate"]],
      tests:[["serum creatinine","biochemistry","high"],["estimated GFR","biochemistry","high"],["urine albumin-creatinine ratio","biochemistry","high"],["renal ultrasound","imaging","moderate"],["metabolic panel","biochemistry","high"],["CBC","hematology","moderate"],["phosphate level","biochemistry","moderate"]],
      treatments:[["ACE inhibitor","antihypertensive","first_line","KDIGO"],["ARB","antihypertensive","first_line","KDIGO"],["sodium bicarbonate","supplement","adjunct","KDIGO"],["erythropoietin","hormone","adjunct","KDIGO"]]
    },
    { name:"testicular torsion",icd10:"N44.0",organ:"urological",prior:0.005,severity:"critical",
      symptoms:[["sudden severe testicular pain",0.95,0.95,"high"],["testicular swelling",0.80,0.8,"high"],["nausea",0.65,0.6,"moderate"],["vomiting",0.55,0.55,"moderate"],["absent cremasteric reflex",0.70,0.85,"high"],["high-riding testis",0.60,0.8,"high"],["abdominal pain",0.40,0.4,"moderate"]],
      tests:[["scrotal ultrasound with doppler","imaging","high"],["urinalysis","microbiology","moderate"]],
      treatments:[["manual detorsion","procedural","emergency","AUA"],["surgical orchiopexy","surgical","first_line","AUA"]]
    },
    { name:"erectile dysfunction",icd10:"N52.9",organ:"urological",prior:0.06,severity:"low",
      symptoms:[["inability to achieve erection",0.92,0.9,"high"],["inability to maintain erection",0.88,0.85,"high"],["reduced libido",0.50,0.5,"moderate"],["premature ejaculation",0.30,0.3,"low"],["anxiety about sexual performance",0.55,0.5,"moderate"]],
      tests:[["fasting glucose","biochemistry","moderate"],["lipid panel","biochemistry","moderate"],["testosterone level","endocrine","high"],["thyroid function tests","endocrine","moderate"],["prolactin level","endocrine","moderate"]],
      treatments:[["sildenafil","PDE5 inhibitor","first_line","AUA"],["tadalafil","PDE5 inhibitor","first_line","AUA"],["vardenafil","PDE5 inhibitor","first_line","AUA"]]
    },
  ];
}

// ══════════════════════════════════════════════════
// BATCH: OPHTHALMOLOGIC (15 diseases)
// Sources: AAO, NICE
// ══════════════════════════════════════════════════
function getOphthalmologicDiseases(): DiseaseEntry[] {
  return [
    { name:"acute angle-closure glaucoma",icd10:"H40.21",organ:"ophthalmologic",prior:0.005,severity:"critical",
      symptoms:[["severe eye pain",0.92,0.9,"high"],["blurred vision",0.85,0.85,"high"],["halos around lights",0.70,0.75,"high"],["nausea",0.60,0.55,"moderate"],["vomiting",0.50,0.5,"moderate"],["headache",0.65,0.6,"moderate"],["red eye",0.75,0.7,"high"],["fixed mid-dilated pupil",0.60,0.85,"high"]],
      tests:[["intraocular pressure measurement","ophthalmology","high"],["gonioscopy","ophthalmology","high"],["slit lamp examination","ophthalmology","high"],["visual field test","ophthalmology","moderate"]],
      treatments:[["timolol","beta-blocker eye drop","first_line","AAO"],["pilocarpine","miotic","first_line","AAO"],["acetazolamide","carbonic anhydrase inhibitor","first_line","AAO"],["laser iridotomy","procedural","definitive","AAO"]]
    },
    { name:"retinal detachment",icd10:"H33.0",organ:"ophthalmologic",prior:0.003,severity:"critical",
      symptoms:[["sudden floaters",0.80,0.8,"high"],["flashes of light",0.75,0.8,"high"],["curtain-like visual field loss",0.85,0.9,"high"],["blurred vision",0.65,0.6,"moderate"],["sudden vision loss",0.50,0.85,"high"]],
      tests:[["dilated fundoscopy","ophthalmology","high"],["ocular ultrasound","imaging","high"],["OCT","ophthalmology","moderate"]],
      treatments:[["pneumatic retinopexy","surgical","first_line","AAO"],["scleral buckle","surgical","first_line","AAO"],["vitrectomy","surgical","first_line","AAO"]]
    },
    { name:"central retinal artery occlusion",icd10:"H34.1",organ:"ophthalmologic",prior:0.002,severity:"critical",
      symptoms:[["sudden painless vision loss",0.92,0.95,"high"],["cherry red spot on fundus",0.70,0.9,"high"],["afferent pupillary defect",0.65,0.8,"high"]],
      tests:[["dilated fundoscopy","ophthalmology","high"],["fluorescein angiography","ophthalmology","high"],["carotid ultrasound","vascular","moderate"],["echocardiogram","cardiac","moderate"],["ESR CRP","inflammatory","moderate"]],
      treatments:[["ocular massage","procedural","emergency","AAO"],["anterior chamber paracentesis","procedural","emergency","AAO"],["acetazolamide","carbonic anhydrase inhibitor","emergency","AAO"]]
    },
    { name:"diabetic retinopathy",icd10:"H36.0",organ:"ophthalmologic",prior:0.03,severity:"high",
      symptoms:[["blurred vision",0.70,0.65,"high"],["floaters",0.50,0.5,"moderate"],["dark spots in vision",0.45,0.55,"moderate"],["difficulty seeing at night",0.40,0.45,"moderate"],["gradual vision loss",0.55,0.6,"moderate"],["color vision changes",0.30,0.4,"moderate"]],
      tests:[["dilated fundoscopy","ophthalmology","high"],["OCT","ophthalmology","high"],["fluorescein angiography","ophthalmology","high"],["HbA1c","biochemistry","high"],["fasting glucose","biochemistry","moderate"]],
      treatments:[["anti-VEGF injection","intravitreal","first_line","AAO"],["laser photocoagulation","procedural","first_line","AAO"],["vitrectomy","surgical","second_line","AAO"]]
    },
    { name:"conjunctivitis bacterial",icd10:"H10.0",organ:"ophthalmologic",prior:0.08,severity:"low",
      symptoms:[["red eye",0.90,0.8,"high"],["purulent discharge",0.80,0.85,"high"],["eyelid crusting",0.70,0.65,"high"],["eye irritation",0.75,0.6,"moderate"],["tearing",0.55,0.5,"moderate"],["eyelid swelling",0.45,0.45,"moderate"],["foreign body sensation",0.40,0.4,"moderate"]],
      tests:[["slit lamp examination","ophthalmology","moderate"],["conjunctival culture","microbiology","moderate"]],
      treatments:[["moxifloxacin eye drops","fluoroquinolone","first_line","AAO"],["erythromycin ophthalmic ointment","macrolide","first_line","AAO"],["tobramycin eye drops","aminoglycoside","second_line","AAO"]]
    },
    { name:"age-related macular degeneration",icd10:"H35.30",organ:"ophthalmologic",prior:0.03,severity:"moderate",
      symptoms:[["central vision loss",0.80,0.85,"high"],["distorted vision",0.70,0.75,"high"],["difficulty reading",0.65,0.6,"moderate"],["difficulty recognizing faces",0.55,0.6,"moderate"],["need for brighter light",0.50,0.5,"moderate"],["visual dark spot",0.60,0.65,"high"]],
      tests:[["OCT","ophthalmology","high"],["Amsler grid test","ophthalmology","moderate"],["fluorescein angiography","ophthalmology","high"],["dilated fundoscopy","ophthalmology","high"]],
      treatments:[["ranibizumab","anti-VEGF","first_line","AAO"],["aflibercept","anti-VEGF","first_line","AAO"],["AREDS2 supplements","nutritional","supportive","AAO"]]
    },
  ];
}

// ══════════════════════════════════════════════════
// BATCH: EXPANDED DANGEROUS DIAGNOSES
// Sources: WHO, EM guidelines, NICE
// ══════════════════════════════════════════════════
function getExpandedDangerousDiagnoses(): Array<{
  trigger_symptom: string;
  diagnosis_name: string;
  severity_level: string;
  must_not_miss: boolean;
  priority: number;
  emergency_protocol: string;
  guideline_source: string;
}> {
  return [
    // Cardiac emergencies
    {trigger_symptom:"chest pain",diagnosis_name:"acute myocardial infarction",severity_level:"critical",must_not_miss:true,priority:1,emergency_protocol:"12-lead ECG within 10 min, troponin, aspirin 300mg stat",guideline_source:"ESC/AHA"},
    {trigger_symptom:"chest pain",diagnosis_name:"aortic dissection",severity_level:"critical",must_not_miss:true,priority:2,emergency_protocol:"BP control, CT angiogram, surgical consult",guideline_source:"ESC"},
    {trigger_symptom:"palpitations",diagnosis_name:"ventricular tachycardia",severity_level:"critical",must_not_miss:true,priority:3,emergency_protocol:"12-lead ECG, defibrillator standby, amiodarone",guideline_source:"AHA"},
    {trigger_symptom:"syncope",diagnosis_name:"cardiac arrhythmia",severity_level:"high",must_not_miss:true,priority:4,emergency_protocol:"ECG monitoring, telemetry, electrolytes",guideline_source:"ESC"},
    {trigger_symptom:"chest pain",diagnosis_name:"cardiac tamponade",severity_level:"critical",must_not_miss:true,priority:5,emergency_protocol:"Emergent echocardiogram, pericardiocentesis",guideline_source:"AHA"},
    // Respiratory emergencies
    {trigger_symptom:"shortness of breath",diagnosis_name:"tension pneumothorax",severity_level:"critical",must_not_miss:true,priority:1,emergency_protocol:"Needle decompression 2nd ICS, chest tube",guideline_source:"ATLS"},
    {trigger_symptom:"shortness of breath",diagnosis_name:"pulmonary embolism",severity_level:"critical",must_not_miss:true,priority:2,emergency_protocol:"CTPA, anticoagulation, Wells score",guideline_source:"ESC"},
    {trigger_symptom:"shortness of breath",diagnosis_name:"acute heart failure",severity_level:"critical",must_not_miss:true,priority:3,emergency_protocol:"IV furosemide, O2, NIV, BNP/troponin",guideline_source:"ESC"},
    {trigger_symptom:"hemoptysis",diagnosis_name:"pulmonary hemorrhage",severity_level:"critical",must_not_miss:true,priority:4,emergency_protocol:"ABCs, cross-match, CT chest, bronchoscopy",guideline_source:"BTS"},
    {trigger_symptom:"stridor",diagnosis_name:"upper airway obstruction",severity_level:"critical",must_not_miss:true,priority:1,emergency_protocol:"Secure airway, nebulized epinephrine, ENT consult",guideline_source:"ATLS"},
    // Neurological emergencies
    {trigger_symptom:"sudden headache",diagnosis_name:"subarachnoid hemorrhage",severity_level:"critical",must_not_miss:true,priority:1,emergency_protocol:"CT head, LP if CT negative, neurosurgery consult",guideline_source:"AHA"},
    {trigger_symptom:"weakness",diagnosis_name:"stroke",severity_level:"critical",must_not_miss:true,priority:1,emergency_protocol:"CT head, thrombolysis window, NIHSS score",guideline_source:"AHA"},
    {trigger_symptom:"neck stiffness",diagnosis_name:"meningitis",severity_level:"critical",must_not_miss:true,priority:1,emergency_protocol:"Blood cultures, LP, empiric antibiotics <1hr",guideline_source:"IDSA"},
    {trigger_symptom:"seizure",diagnosis_name:"status epilepticus",severity_level:"critical",must_not_miss:true,priority:2,emergency_protocol:"Benzodiazepine, airway, glucose check",guideline_source:"AAN"},
    {trigger_symptom:"altered consciousness",diagnosis_name:"intracranial hemorrhage",severity_level:"critical",must_not_miss:true,priority:2,emergency_protocol:"CT head urgent, neurosurgery consult, BP management",guideline_source:"AHA"},
    {trigger_symptom:"sudden confusion",diagnosis_name:"hypoglycemia",severity_level:"high",must_not_miss:true,priority:3,emergency_protocol:"Immediate blood glucose, IV dextrose if <70mg/dL",guideline_source:"ADA"},
    // Abdominal emergencies
    {trigger_symptom:"abdominal pain",diagnosis_name:"ruptured abdominal aortic aneurysm",severity_level:"critical",must_not_miss:true,priority:1,emergency_protocol:"Large bore IV x2, cross-match, CT angiogram, vascular surgery",guideline_source:"SVS"},
    {trigger_symptom:"abdominal pain",diagnosis_name:"bowel perforation",severity_level:"critical",must_not_miss:true,priority:2,emergency_protocol:"Erect CXR, surgical consult, IV antibiotics, NPO",guideline_source:"WSES"},
    {trigger_symptom:"abdominal pain",diagnosis_name:"ectopic pregnancy",severity_level:"critical",must_not_miss:true,priority:1,emergency_protocol:"Serum beta-hCG, transvaginal US, type and screen",guideline_source:"ACOG"},
    {trigger_symptom:"abdominal pain",diagnosis_name:"acute mesenteric ischemia",severity_level:"critical",must_not_miss:true,priority:3,emergency_protocol:"CT angiogram, heparinization, surgical consult",guideline_source:"ESVS"},
    {trigger_symptom:"hematemesis",diagnosis_name:"upper GI hemorrhage",severity_level:"critical",must_not_miss:true,priority:1,emergency_protocol:"Large bore IV, cross-match, PPI infusion, urgent endoscopy",guideline_source:"BSG"},
    {trigger_symptom:"abdominal pain",diagnosis_name:"acute pancreatitis severe",severity_level:"critical",must_not_miss:true,priority:4,emergency_protocol:"IV fluids, lipase, CT abdomen, NPO, ICU if APACHE >8",guideline_source:"AGA"},
    // Infectious emergencies
    {trigger_symptom:"fever",diagnosis_name:"sepsis",severity_level:"critical",must_not_miss:true,priority:1,emergency_protocol:"qSOFA, lactate, blood cultures, broad-spectrum antibiotics <1hr",guideline_source:"SSC"},
    {trigger_symptom:"fever",diagnosis_name:"necrotizing fasciitis",severity_level:"critical",must_not_miss:true,priority:2,emergency_protocol:"Surgical debridement, IV antibiotics, ICU",guideline_source:"IDSA"},
    {trigger_symptom:"petechial rash",diagnosis_name:"meningococcemia",severity_level:"critical",must_not_miss:true,priority:1,emergency_protocol:"IM ceftriaxone immediately, blood cultures, LP",guideline_source:"IDSA"},
    {trigger_symptom:"fever",diagnosis_name:"toxic shock syndrome",severity_level:"critical",must_not_miss:true,priority:3,emergency_protocol:"Remove source, IV fluids, IV antibiotics, ICU",guideline_source:"IDSA"},
    {trigger_symptom:"fever",diagnosis_name:"malaria severe",severity_level:"critical",must_not_miss:true,priority:2,emergency_protocol:"Thick/thin smear, IV artesunate, ICU monitoring",guideline_source:"WHO"},
    {trigger_symptom:"fever",diagnosis_name:"dengue hemorrhagic fever",severity_level:"critical",must_not_miss:true,priority:3,emergency_protocol:"NS1 antigen, platelet count, IV fluids, blood product standby",guideline_source:"WHO"},
    // Metabolic emergencies
    {trigger_symptom:"polyuria",diagnosis_name:"diabetic ketoacidosis",severity_level:"critical",must_not_miss:true,priority:1,emergency_protocol:"Blood glucose, ABG, IV insulin + fluids, potassium",guideline_source:"ADA"},
    {trigger_symptom:"altered consciousness",diagnosis_name:"hyperosmolar hyperglycemic state",severity_level:"critical",must_not_miss:true,priority:2,emergency_protocol:"Glucose, osmolality, aggressive IV hydration, insulin",guideline_source:"ADA"},
    {trigger_symptom:"muscle weakness",diagnosis_name:"hyperkalemia",severity_level:"critical",must_not_miss:true,priority:3,emergency_protocol:"ECG, calcium gluconate, insulin/dextrose, kayexalate",guideline_source:"KDIGO"},
    {trigger_symptom:"tetany",diagnosis_name:"hypocalcemia severe",severity_level:"high",must_not_miss:true,priority:4,emergency_protocol:"IV calcium gluconate, ECG, magnesium check",guideline_source:"Endocrine Society"},
    // Obstetric emergencies
    {trigger_symptom:"vaginal bleeding",diagnosis_name:"placental abruption",severity_level:"critical",must_not_miss:true,priority:1,emergency_protocol:"Large bore IV, cross-match, emergency C-section if unstable",guideline_source:"ACOG"},
    {trigger_symptom:"hypertension in pregnancy",diagnosis_name:"eclampsia",severity_level:"critical",must_not_miss:true,priority:1,emergency_protocol:"Magnesium sulfate, BP control, delivery plan",guideline_source:"ACOG"},
    {trigger_symptom:"postpartum hemorrhage",diagnosis_name:"uterine atony",severity_level:"critical",must_not_miss:true,priority:1,emergency_protocol:"Uterine massage, oxytocin, cross-match, surgical if refractory",guideline_source:"WHO"},
    // Pediatric emergencies
    {trigger_symptom:"barking cough",diagnosis_name:"epiglottitis",severity_level:"critical",must_not_miss:true,priority:1,emergency_protocol:"Do NOT examine throat, secure airway, IV antibiotics",guideline_source:"AAP"},
    {trigger_symptom:"bilious vomiting in infant",diagnosis_name:"intestinal volvulus",severity_level:"critical",must_not_miss:true,priority:1,emergency_protocol:"Upper GI series, surgical consult, IV fluids",guideline_source:"APSA"},
    {trigger_symptom:"non-blanching rash",diagnosis_name:"meningococcal septicemia",severity_level:"critical",must_not_miss:true,priority:1,emergency_protocol:"IM ceftriaxone STAT, IV fluids, ICU",guideline_source:"NICE"},
    // Trauma/Environmental
    {trigger_symptom:"crush injury",diagnosis_name:"rhabdomyolysis",severity_level:"critical",must_not_miss:true,priority:2,emergency_protocol:"Aggressive IV fluids, CK level, urine myoglobin, monitor renal function",guideline_source:"EAST"},
    {trigger_symptom:"snakebite",diagnosis_name:"envenomation",severity_level:"critical",must_not_miss:true,priority:1,emergency_protocol:"Identify species, antivenom if indicated, monitor coags",guideline_source:"WHO"},
    // Vascular emergencies
    {trigger_symptom:"acute limb pain",diagnosis_name:"acute limb ischemia",severity_level:"critical",must_not_miss:true,priority:1,emergency_protocol:"6Ps assessment, heparinization, vascular surgery consult",guideline_source:"ESVS"},
    {trigger_symptom:"sudden vision loss",diagnosis_name:"central retinal artery occlusion",severity_level:"critical",must_not_miss:true,priority:2,emergency_protocol:"Ocular massage, acetazolamide, ophthalmology urgent",guideline_source:"AAO"},
  ];
}

// ══════════════════════════════════════════════════
// BATCH: EXPANDED CLINICAL GUIDELINES
// Sources: NICE, WHO, AHA, ESC, IDSA, GOLD, GINA
// ══════════════════════════════════════════════════
function getExpandedGuidelines(): Array<{
  title: string;
  condition: string;
  source: string;
  source_organization: string;
  evidence_grade: string;
  year: number;
  recommendation_text: string;
  summary: string;
  clinical_topic: string;
  keywords: string[];
  applicable_tests: string[];
  applicable_drugs: string[];
}> {
  return [
    {title:"Acute MI Management",condition:"acute myocardial infarction",source:"ESC 2023",source_organization:"European Society of Cardiology",evidence_grade:"A",year:2023,recommendation_text:"Immediate dual antiplatelet therapy (aspirin + P2Y12 inhibitor), early invasive strategy for NSTEMI, primary PCI for STEMI within 120 min",summary:"Evidence-based management of acute coronary syndromes",clinical_topic:"Cardiology",keywords:["MI","STEMI","NSTEMI","chest pain","troponin"],applicable_tests:["troponin","ECG","coronary angiography"],applicable_drugs:["aspirin","clopidogrel","ticagrelor","heparin"]},
    {title:"Hypertension Treatment",condition:"hypertension",source:"ESC/ESH 2023",source_organization:"European Society of Cardiology",evidence_grade:"A",year:2023,recommendation_text:"Target BP <140/90 in general, <130/80 if tolerated. Start with ACE inhibitor/ARB + calcium channel blocker",summary:"Management of arterial hypertension in adults",clinical_topic:"Cardiology",keywords:["hypertension","blood pressure","ACE inhibitor","ARB"],applicable_tests:["blood pressure","renal function","ECG"],applicable_drugs:["amlodipine","ramipril","losartan","hydrochlorothiazide"]},
    {title:"Type 2 Diabetes Management",condition:"type 2 diabetes mellitus",source:"ADA 2024",source_organization:"American Diabetes Association",evidence_grade:"A",year:2024,recommendation_text:"Metformin first-line, add SGLT2i or GLP-1 RA for cardiovascular or renal benefit. Target HbA1c <7%",summary:"Standards of care in diabetes",clinical_topic:"Endocrinology",keywords:["diabetes","HbA1c","metformin","SGLT2"],applicable_tests:["HbA1c","fasting glucose","lipid panel","renal function"],applicable_drugs:["metformin","empagliflozin","liraglutide","insulin glargine"]},
    {title:"Asthma Management",condition:"asthma",source:"GINA 2024",source_organization:"Global Initiative for Asthma",evidence_grade:"A",year:2024,recommendation_text:"Step-wise approach: SABA PRN → low-dose ICS → medium ICS/LABA → high ICS/LABA → add-on therapy",summary:"Global strategy for asthma management and prevention",clinical_topic:"Pulmonology",keywords:["asthma","ICS","LABA","SABA","wheeze"],applicable_tests:["spirometry","peak flow","FeNO"],applicable_drugs:["salbutamol","fluticasone","budesonide-formoterol","montelukast"]},
    {title:"COPD Management",condition:"COPD",source:"GOLD 2024",source_organization:"Global Initiative for Chronic Obstructive Lung Disease",evidence_grade:"A",year:2024,recommendation_text:"LAMA mono or LAMA/LABA for Group B-E. ICS add-on only if eos ≥300 or frequent exacerbations",summary:"GOLD strategy for prevention and management of COPD",clinical_topic:"Pulmonology",keywords:["COPD","emphysema","bronchitis","spirometry"],applicable_tests:["spirometry","chest X-ray","ABG"],applicable_drugs:["tiotropium","salmeterol-fluticasone","ipratropium","roflumilast"]},
    {title:"Community-Acquired Pneumonia",condition:"community-acquired pneumonia",source:"IDSA/ATS 2019",source_organization:"Infectious Diseases Society of America",evidence_grade:"A",year:2019,recommendation_text:"Outpatient: amoxicillin or doxycycline. Inpatient: beta-lactam + macrolide or respiratory FQ",summary:"Diagnosis and treatment of community-acquired pneumonia",clinical_topic:"Infectious Disease",keywords:["pneumonia","CAP","antibiotics","chest X-ray"],applicable_tests:["chest X-ray","sputum culture","blood culture","procalcitonin"],applicable_drugs:["amoxicillin","azithromycin","levofloxacin","ceftriaxone"]},
    {title:"Sepsis Management",condition:"sepsis",source:"SSC 2021",source_organization:"Surviving Sepsis Campaign",evidence_grade:"A",year:2021,recommendation_text:"Hour-1 bundle: lactate, blood cultures, broad-spectrum antibiotics, 30mL/kg crystalloids for hypotension, vasopressors for MAP <65",summary:"International guidelines for management of sepsis and septic shock",clinical_topic:"Critical Care",keywords:["sepsis","septic shock","lactate","qSOFA"],applicable_tests:["blood culture","lactate","procalcitonin","CBC"],applicable_drugs:["piperacillin-tazobactam","norepinephrine","vancomycin","meropenem"]},
    {title:"Stroke Management",condition:"stroke",source:"AHA/ASA 2019",source_organization:"American Heart Association",evidence_grade:"A",year:2019,recommendation_text:"IV alteplase within 4.5hrs, mechanical thrombectomy within 24hrs for large vessel occlusion. BP management per protocol",summary:"Guidelines for early management of acute ischemic stroke",clinical_topic:"Neurology",keywords:["stroke","TIA","thrombolysis","thrombectomy"],applicable_tests:["CT head","CT angiogram","MRI brain","coagulation studies"],applicable_drugs:["alteplase","aspirin","clopidogrel","atorvastatin"]},
    {title:"Heart Failure Management",condition:"heart failure",source:"ESC 2023",source_organization:"European Society of Cardiology",evidence_grade:"A",year:2023,recommendation_text:"Quadruple therapy for HFrEF: ACEi/ARNI + beta-blocker + MRA + SGLT2i. Diuretics for congestion",summary:"Guidelines for diagnosis and treatment of heart failure",clinical_topic:"Cardiology",keywords:["heart failure","HFrEF","HFpEF","BNP","ejection fraction"],applicable_tests:["echocardiogram","BNP","chest X-ray","ECG"],applicable_drugs:["sacubitril-valsartan","carvedilol","spironolactone","dapagliflozin","furosemide"]},
    {title:"Atrial Fibrillation",condition:"atrial fibrillation",source:"ESC 2024",source_organization:"European Society of Cardiology",evidence_grade:"A",year:2024,recommendation_text:"CHA2DS2-VASc for stroke risk. Anticoagulate if ≥2 (men) or ≥3 (women). DOACs preferred over warfarin",summary:"Guidelines for management of atrial fibrillation",clinical_topic:"Cardiology",keywords:["atrial fibrillation","anticoagulation","DOAC","rate control"],applicable_tests:["ECG","echocardiogram","thyroid function","renal function"],applicable_drugs:["rivaroxaban","apixaban","metoprolol","amiodarone","digoxin"]},
    {title:"Urinary Tract Infection",condition:"urinary tract infection",source:"IDSA 2011",source_organization:"Infectious Diseases Society of America",evidence_grade:"A",year:2011,recommendation_text:"Uncomplicated: nitrofurantoin 5d or TMP-SMX 3d. Complicated: fluoroquinolone or parenteral therapy",summary:"Guidelines for treatment of acute uncomplicated cystitis and pyelonephritis",clinical_topic:"Infectious Disease",keywords:["UTI","cystitis","pyelonephritis","dysuria"],applicable_tests:["urinalysis","urine culture","CBC"],applicable_drugs:["nitrofurantoin","trimethoprim-sulfamethoxazole","ciprofloxacin","ceftriaxone"]},
    {title:"Depression Treatment",condition:"major depressive disorder",source:"APA 2023",source_organization:"American Psychiatric Association",evidence_grade:"A",year:2023,recommendation_text:"First-line: SSRI or SNRI + psychotherapy. Augment with bupropion, mirtazapine, or atypical antipsychotic if partial response",summary:"Practice guideline for treatment of major depressive disorder",clinical_topic:"Psychiatry",keywords:["depression","MDD","SSRI","psychotherapy"],applicable_tests:["PHQ-9","thyroid function","CBC"],applicable_drugs:["sertraline","escitalopram","venlafaxine","bupropion"]},
    {title:"Peptic Ulcer Disease",condition:"peptic ulcer disease",source:"ACG 2017",source_organization:"American College of Gastroenterology",evidence_grade:"A",year:2017,recommendation_text:"Test for H. pylori, triple therapy if positive. PPI for 4-8 weeks. Discontinue NSAIDs",summary:"Guidelines for diagnosis and management of peptic ulcer disease",clinical_topic:"Gastroenterology",keywords:["peptic ulcer","H. pylori","PPI","dyspepsia"],applicable_tests:["H. pylori breath test","upper endoscopy","H. pylori stool antigen"],applicable_drugs:["omeprazole","amoxicillin","clarithromycin","bismuth subsalicylate"]},
    {title:"Anemia Evaluation",condition:"anemia",source:"WHO/ASH 2020",source_organization:"American Society of Hematology",evidence_grade:"A",year:2020,recommendation_text:"Evaluate with CBC, reticulocyte count, iron studies, B12/folate. Treat underlying cause. Iron replacement for iron deficiency",summary:"Approach to diagnosis and management of anemia",clinical_topic:"Hematology",keywords:["anemia","iron deficiency","B12","folate","hemoglobin"],applicable_tests:["CBC","iron studies","reticulocyte count","vitamin B12","folate"],applicable_drugs:["ferrous sulfate","cyanocobalamin","folic acid","erythropoietin"]},
    {title:"Migraine Treatment",condition:"migraine",source:"AAN 2021",source_organization:"American Academy of Neurology",evidence_grade:"A",year:2021,recommendation_text:"Acute: triptans, NSAIDs, combination analgesics. Prevention: beta-blockers, topiramate, valproate, CGRP monoclonal antibodies",summary:"Evidence-based guideline for migraine prevention and treatment",clinical_topic:"Neurology",keywords:["migraine","headache","triptan","aura"],applicable_tests:["MRI brain","CT head"],applicable_drugs:["sumatriptan","propranolol","topiramate","erenumab"]},
    {title:"Thyroid Dysfunction",condition:"hypothyroidism",source:"ATA 2014",source_organization:"American Thyroid Association",evidence_grade:"A",year:2014,recommendation_text:"Levothyroxine replacement, target TSH within reference range. Monitor every 6-8 weeks until stable",summary:"Guidelines for treatment of hypothyroidism",clinical_topic:"Endocrinology",keywords:["hypothyroidism","TSH","levothyroxine","thyroid"],applicable_tests:["TSH","free T4","thyroid antibodies"],applicable_drugs:["levothyroxine"]},
    {title:"Osteoarthritis Management",condition:"osteoarthritis",source:"OARSI 2019",source_organization:"Osteoarthritis Research Society International",evidence_grade:"A",year:2019,recommendation_text:"Core: exercise, weight management, education. Pharmacologic: topical NSAIDs, oral NSAIDs short-term, intra-articular corticosteroids",summary:"Guidelines for management of knee, hip, and polyarticular osteoarthritis",clinical_topic:"Rheumatology",keywords:["osteoarthritis","joint pain","NSAID","knee pain"],applicable_tests:["X-ray affected joint","ESR","CRP"],applicable_drugs:["diclofenac topical","ibuprofen","acetaminophen","intra-articular triamcinolone"]},
    {title:"Chronic Kidney Disease",condition:"chronic kidney disease",source:"KDIGO 2024",source_organization:"Kidney Disease Improving Global Outcomes",evidence_grade:"A",year:2024,recommendation_text:"ACEi/ARB for proteinuria, SGLT2i for GFR 20-45. Target BP <120 systolic. Manage anemia, mineral bone disease",summary:"Clinical practice guideline for CKD evaluation and management",clinical_topic:"Nephrology",keywords:["CKD","GFR","proteinuria","dialysis"],applicable_tests:["serum creatinine","eGFR","urine ACR","renal ultrasound"],applicable_drugs:["ramipril","dapagliflozin","erythropoietin","sodium bicarbonate"]},
    {title:"Tuberculosis Treatment",condition:"tuberculosis",source:"WHO 2022",source_organization:"World Health Organization",evidence_grade:"A",year:2022,recommendation_text:"2 months HRZE (isoniazid, rifampicin, pyrazinamide, ethambutol) + 4 months HR. DOT recommended",summary:"WHO consolidated guidelines on tuberculosis treatment",clinical_topic:"Infectious Disease",keywords:["TB","tuberculosis","HRZE","DOT"],applicable_tests:["sputum AFB","GeneXpert","chest X-ray","IGRA"],applicable_drugs:["isoniazid","rifampicin","pyrazinamide","ethambutol"]},
    {title:"Malaria Treatment",condition:"malaria",source:"WHO 2023",source_organization:"World Health Organization",evidence_grade:"A",year:2023,recommendation_text:"P. falciparum: ACT (artemisinin-based combination therapy). Severe: IV artesunate. P. vivax: chloroquine + primaquine",summary:"WHO guidelines for malaria treatment",clinical_topic:"Infectious Disease",keywords:["malaria","plasmodium","ACT","artesunate"],applicable_tests:["thick and thin blood smear","rapid malaria antigen","CBC","LFT"],applicable_drugs:["artemether-lumefantrine","artesunate","chloroquine","primaquine"]},
    {title:"Dengue Management",condition:"dengue fever",source:"WHO 2024",source_organization:"World Health Organization",evidence_grade:"A",year:2024,recommendation_text:"Supportive care, fluid management by hematocrit. Warning signs: abdominal pain, persistent vomiting, mucosal bleeding. No NSAIDs",summary:"Dengue guidelines for diagnosis, treatment, prevention and control",clinical_topic:"Infectious Disease",keywords:["dengue","NS1","platelet","hemorrhagic fever"],applicable_tests:["NS1 antigen","dengue IgM/IgG","CBC with platelet","hematocrit"],applicable_drugs:["acetaminophen","oral rehydration","IV crystalloids"]},
  ];
}

// ══════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const body = await req.json().catch(() => ({}));
  const batch: string = body.batch || "all";
  const log: string[] = [];
  const addLog = (msg: string) => { log.push(msg); console.log(msg); };

  addLog(`=== Knowledge Graph Expansion v2 — batch: ${batch} ===`);

  try {
    // Collect diseases based on batch parameter
    let diseases: DiseaseEntry[] = [];
    if (batch === "all" || batch === "psychiatric") diseases.push(...getPsychiatricDiseases());
    if (batch === "all" || batch === "oncological") diseases.push(...getOncologicalDiseases());
    if (batch === "all" || batch === "urological") diseases.push(...getUrologicalDiseases());
    if (batch === "all" || batch === "ophthalmologic") diseases.push(...getOphthalmologicDiseases());

    addLog(`Total diseases in batch: ${diseases.length}`);

    if (diseases.length > 0) {
      // Collect unique symptoms
      const uniqueSymptoms = new Set<string>();
      for (const d of diseases) {
        for (const [sym] of d.symptoms) uniqueSymptoms.add(sym);
      }
      addLog(`Unique symptoms: ${uniqueSymptoms.size}`);

      // STEP 1: Upsert diagnoses
      addLog("Step 1: Upserting diagnoses...");
      const diagRows = diseases.map(d => ({ diagnosis_name: d.name, icd10_code: d.icd10, category: d.organ }));
      for (let i = 0; i < diagRows.length; i += 100) {
        const chunk = diagRows.slice(i, i + 100);
        const { error } = await supabase.from("diagnoses").upsert(chunk, { onConflict: "diagnosis_name", ignoreDuplicates: true });
        if (error) addLog(`  Diagnoses error: ${error.message}`);
      }
      addLog(`  Diagnoses upserted: ${diagRows.length}`);

      // Fetch all diagnosis IDs
      const allDiagIds: Record<string, string> = {};
      let offset = 0;
      while (true) {
        const { data: batch } = await supabase.from("diagnoses").select("id, diagnosis_name").range(offset, offset + 999);
        if (!batch || batch.length === 0) break;
        for (const r of batch) allDiagIds[r.diagnosis_name] = r.id;
        offset += batch.length;
        if (batch.length < 1000) break;
      }

      // STEP 2: Upsert symptoms
      addLog("Step 2: Upserting symptoms...");
      const symRows = Array.from(uniqueSymptoms).map(s => ({ symptom_name: s, category: "general" }));
      for (let i = 0; i < symRows.length; i += 100) {
        const chunk = symRows.slice(i, i + 100);
        const { error } = await supabase.from("symptoms").upsert(chunk, { onConflict: "symptom_name", ignoreDuplicates: true });
        if (error) addLog(`  Symptoms error: ${error.message}`);
      }

      // Fetch all symptom IDs
      const allSymIds: Record<string, string> = {};
      offset = 0;
      while (true) {
        const { data: batch } = await supabase.from("symptoms").select("id, symptom_name").range(offset, offset + 999);
        if (!batch || batch.length === 0) break;
        for (const r of batch) allSymIds[r.symptom_name] = r.id;
        offset += batch.length;
        if (batch.length < 1000) break;
      }

      // STEP 3: Disease priors
      addLog("Step 3: Upserting disease priors...");
      const priorRows = diseases.filter(d => allDiagIds[d.name]).map(d => ({
        diagnosis_id: allDiagIds[d.name], base_prevalence: d.prior,
        age_modifier: {}, sex_modifier: {}, region_modifier: {},
      }));
      for (let i = 0; i < priorRows.length; i += 100) {
        const chunk = priorRows.slice(i, i + 100);
        const { error } = await supabase.from("disease_priors").upsert(chunk, { onConflict: "diagnosis_id", ignoreDuplicates: false });
        if (error) addLog(`  Priors error: ${error.message}`);
      }

      // STEP 4: Symptom likelihoods
      addLog("Step 4: Inserting symptom likelihoods...");
      const likRows: { symptom_id: string; diagnosis_id: string; likelihood_value: number }[] = [];
      for (const d of diseases) {
        const dId = allDiagIds[d.name];
        if (!dId) continue;
        for (const [sym, prob] of d.symptoms) {
          const sId = allSymIds[sym];
          if (!sId) continue;
          likRows.push({ symptom_id: sId, diagnosis_id: dId, likelihood_value: prob });
        }
      }
      let likInserted = 0;
      for (let i = 0; i < likRows.length; i += 200) {
        const chunk = likRows.slice(i, i + 200);
        const { error } = await supabase.from("symptom_likelihoods").insert(chunk);
        if (error) addLog(`  Likelihoods error (batch ${i}): ${error.message}`);
        else likInserted += chunk.length;
      }
      addLog(`  Likelihoods inserted: ${likInserted}`);

      // STEP 5: Disease tests
      addLog("Step 5: Inserting disease tests...");
      const testRows = diseases.flatMap(d => d.tests.map(([tname, tcat, tstr]) => ({
        disease_name: d.name, test_name: tname, test_category: tcat, diagnostic_strength: tstr,
      })));
      let testsInserted = 0;
      for (let i = 0; i < testRows.length; i += 200) {
        const chunk = testRows.slice(i, i + 200);
        const { error } = await supabase.from("disease_tests").insert(chunk);
        if (error) addLog(`  Tests error: ${error.message}`);
        else testsInserted += chunk.length;
      }
      addLog(`  Tests inserted: ${testsInserted}`);

      // STEP 6: Disease treatments
      addLog("Step 6: Inserting treatments...");
      const txRows = diseases.flatMap(d => d.treatments.map(([drug, cls, line, src]) => ({
        disease_name: d.name, drug_name: drug, drug_class: cls, line_of_treatment: line, guideline_source: src,
      })));
      let txInserted = 0;
      for (let i = 0; i < txRows.length; i += 200) {
        const chunk = txRows.slice(i, i + 200);
        const { error } = await supabase.from("disease_treatments").insert(chunk);
        if (error) addLog(`  Treatments error: ${error.message}`);
        else txInserted += chunk.length;
      }
      addLog(`  Treatments inserted: ${txInserted}`);
    }

    // STEP 7: Dangerous diagnoses expansion
    if (batch === "all" || batch === "dangerous") {
      addLog("Step 7: Expanding dangerous diagnoses...");
      const dangerRows = getExpandedDangerousDiagnoses();

      // Need diagnosis_id for each — lookup from diagnoses table
      const allDiagIds: Record<string, string> = {};
      let offset = 0;
      while (true) {
        const { data: b } = await supabase.from("diagnoses").select("id, diagnosis_name").range(offset, offset + 999);
        if (!b || b.length === 0) break;
        for (const r of b) allDiagIds[r.diagnosis_name.toLowerCase()] = r.id;
        offset += b.length;
        if (b.length < 1000) break;
      }

      let dangerInserted = 0;
      for (const dd of dangerRows) {
        const diagId = allDiagIds[dd.diagnosis_name.toLowerCase()];
        if (!diagId) {
          addLog(`  SKIP dangerous: no diagnosis_id for "${dd.diagnosis_name}"`);
          continue;
        }
        const { error } = await supabase.from("dangerous_diagnoses").upsert({
          trigger_symptom: dd.trigger_symptom,
          diagnosis_id: diagId,
          diagnosis_name: dd.diagnosis_name,
          severity_level: dd.severity_level,
          must_not_miss: dd.must_not_miss,
          priority: dd.priority,
          emergency_protocol: dd.emergency_protocol,
          guideline_source: dd.guideline_source,
        }, { onConflict: "trigger_symptom,diagnosis_id", ignoreDuplicates: true });
        if (error) addLog(`  Dangerous error: ${error.message}`);
        else dangerInserted++;
      }
      addLog(`  Dangerous diagnoses inserted: ${dangerInserted}`);
    }

    // STEP 8: Clinical guidelines expansion
    if (batch === "all" || batch === "guidelines") {
      addLog("Step 8: Expanding clinical guidelines...");
      const guidelines = getExpandedGuidelines();
      let guideInserted = 0;
      for (let i = 0; i < guidelines.length; i += 50) {
        const chunk = guidelines.slice(i, i + 50);
        const { error } = await supabase.from("clinical_guidelines").upsert(chunk, { onConflict: "title", ignoreDuplicates: true });
        if (error) addLog(`  Guidelines error: ${error.message}`);
        else guideInserted += chunk.length;
      }
      addLog(`  Guidelines inserted: ${guideInserted}`);
    }

    // VALIDATION
    addLog("=== VALIDATION ===");
    const counts: Record<string, number> = {};
    for (const table of ["diagnoses","symptoms","symptom_likelihoods","disease_priors","dangerous_diagnoses","clinical_guidelines","disease_tests","disease_treatments"]) {
      const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
      counts[table] = count || 0;
      addLog(`  ${table}: ${count}`);
    }

    return new Response(JSON.stringify({ success: true, batch, counts, log }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    addLog(`FATAL: ${err.message}`);
    return new Response(JSON.stringify({ success: false, error: err.message, log }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
