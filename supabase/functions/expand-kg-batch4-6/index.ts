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
// BATCH 4: EMERGENCY MEDICINE (45 diseases)
// ══════════════════════════════════════════════════
function getEmergencyMedicine(): DiseaseEntry[] {
  return [
    {name:"acute myocardial infarction",icd10:"I21.9",organ:"cardiovascular",prior:0.03,severity:"critical",
      symptoms:[["crushing chest pain",0.85,0.9,"high"],["chest pain radiating to left arm",0.70,0.85,"high"],["diaphoresis",0.65,0.7,"high"],["shortness of breath",0.60,0.6,"moderate"],["nausea",0.45,0.4,"moderate"],["jaw pain",0.35,0.7,"high"],["epigastric pain",0.30,0.5,"moderate"],["palpitations",0.35,0.4,"moderate"],["dizziness",0.30,0.4,"moderate"],["anxiety",0.40,0.3,"moderate"]],
      tests:[["troponin I/T","cardiac","high"],["ECG 12-lead","cardiac","high"],["CK-MB","cardiac","moderate"],["chest X-ray","imaging","moderate"],["echocardiogram","cardiac","moderate"]],
      treatments:[["aspirin","antiplatelet","first_line","AHA"],["clopidogrel","antiplatelet","first_line","ESC"],["heparin","anticoagulant","first_line","AHA"],["nitroglycerin","vasodilator","first_line","AHA"],["morphine","opioid analgesic","adjunct","AHA"]]},
    {name:"pulmonary embolism",icd10:"I26.99",organ:"pulmonary",prior:0.015,severity:"critical",
      symptoms:[["sudden dyspnea",0.80,0.8,"high"],["pleuritic chest pain",0.65,0.75,"high"],["tachycardia",0.70,0.6,"high"],["hemoptysis",0.30,0.8,"high"],["calf swelling",0.40,0.7,"high"],["syncope",0.30,0.6,"moderate"],["hypoxia",0.60,0.7,"high"],["anxiety",0.35,0.3,"moderate"],["diaphoresis",0.35,0.5,"moderate"]],
      tests:[["CT pulmonary angiography","imaging","high"],["D-dimer","hematology","high"],["duplex ultrasound legs","imaging","moderate"],["ABG","biochemistry","moderate"],["ECG","cardiac","moderate"]],
      treatments:[["enoxaparin","anticoagulant","first_line","ESC"],["warfarin","anticoagulant","first_line","AHA"],["rivaroxaban","DOAC","first_line","ESC"],["alteplase","thrombolytic","massive_PE","AHA"]]},
    {name:"tension pneumothorax",icd10:"J93.0",organ:"pulmonary",prior:0.005,severity:"critical",
      symptoms:[["severe dyspnea",0.90,0.9,"high"],["pleuritic chest pain",0.80,0.8,"high"],["absent breath sounds unilateral",0.85,0.95,"high"],["tracheal deviation",0.60,0.95,"high"],["hypotension",0.65,0.7,"high"],["tachycardia",0.75,0.6,"high"],["distended neck veins",0.55,0.8,"high"],["cyanosis",0.50,0.7,"high"]],
      tests:[["chest X-ray","imaging","high"],["clinical diagnosis","clinical","high"],["ABG","biochemistry","moderate"]],
      treatments:[["needle decompression","procedure","first_line","ATLS"],["chest tube insertion","procedure","first_line","ATLS"]]},
    {name:"aortic dissection",icd10:"I71.0",organ:"cardiovascular",prior:0.003,severity:"critical",
      symptoms:[["tearing chest pain",0.85,0.95,"high"],["chest pain radiating to back",0.75,0.9,"high"],["sudden onset severe pain",0.80,0.85,"high"],["blood pressure differential between arms",0.50,0.95,"high"],["hypotension",0.40,0.6,"moderate"],["syncope",0.30,0.6,"moderate"],["aortic regurgitation murmur",0.35,0.8,"high"],["stroke symptoms",0.30,0.7,"high"]],
      tests:[["CT angiography chest",0.95,"imaging","high"],["transthoracic echocardiogram","imaging","moderate"],["D-dimer","hematology","moderate"],["chest X-ray","imaging","moderate"]],
      treatments:[["labetalol","beta-blocker","first_line","AHA"],["esmolol","beta-blocker","first_line","ESC"],["nitroprusside","vasodilator","adjunct","AHA"]]},
    {name:"anaphylaxis",icd10:"T78.2",organ:"immunological",prior:0.01,severity:"critical",
      symptoms:[["urticaria",0.85,0.8,"high"],["angioedema",0.70,0.85,"high"],["wheezing",0.60,0.7,"high"],["hypotension",0.55,0.7,"high"],["throat tightness",0.65,0.8,"high"],["dyspnea",0.60,0.7,"high"],["tachycardia",0.55,0.5,"moderate"],["abdominal pain",0.35,0.4,"moderate"],["nausea and vomiting",0.40,0.4,"moderate"],["pruritus",0.75,0.6,"moderate"]],
      tests:[["serum tryptase","immunology","high"],["clinical diagnosis","clinical","high"]],
      treatments:[["epinephrine IM","sympathomimetic","first_line","WAO"],["diphenhydramine","antihistamine","adjunct","WAO"],["methylprednisolone","corticosteroid","adjunct","WAO"],["salbutamol nebulized","bronchodilator","adjunct","WAO"]]},
    {name:"status epilepticus",icd10:"G41.9",organ:"neurological",prior:0.005,severity:"critical",
      symptoms:[["prolonged seizure activity",0.95,0.95,"high"],["loss of consciousness",0.85,0.8,"high"],["tonic-clonic movements",0.80,0.85,"high"],["tongue biting",0.45,0.7,"high"],["urinary incontinence",0.40,0.6,"moderate"],["cyanosis",0.50,0.7,"high"],["postictal confusion",0.70,0.7,"high"],["fever",0.35,0.4,"moderate"]],
      tests:[["blood glucose","biochemistry","high"],["electrolytes","biochemistry","high"],["EEG","neurological","high"],["CT head","imaging","moderate"],["toxicology screen","toxicology","moderate"]],
      treatments:[["lorazepam IV","benzodiazepine","first_line","AES"],["diazepam","benzodiazepine","first_line","AES"],["phenytoin","anticonvulsant","second_line","AES"],["levetiracetam","anticonvulsant","second_line","AES"]]},
    {name:"acute upper GI bleeding",icd10:"K92.2",organ:"gastrointestinal",prior:0.02,severity:"high",
      symptoms:[["hematemesis",0.75,0.9,"high"],["melena",0.70,0.85,"high"],["tachycardia",0.65,0.6,"high"],["hypotension",0.50,0.6,"moderate"],["epigastric pain",0.55,0.5,"moderate"],["dizziness",0.50,0.5,"moderate"],["pallor",0.55,0.5,"moderate"],["hematochezia",0.35,0.7,"high"]],
      tests:[["CBC","hematology","high"],["coagulation profile","hematology","high"],["upper GI endoscopy","endoscopy","high"],["BUN/creatinine","biochemistry","moderate"],["type and crossmatch","hematology","high"]],
      treatments:[["pantoprazole IV","PPI","first_line","ACG"],["octreotide","somatostatin analog","adjunct","AASLD"],["crystalloid resuscitation","fluid","first_line","ATLS"]]},
    {name:"septic shock",icd10:"R65.21",organ:"infectious",prior:0.01,severity:"critical",
      symptoms:[["fever",0.75,0.6,"high"],["hypotension refractory to fluids",0.90,0.9,"high"],["tachycardia",0.80,0.6,"high"],["altered mental status",0.60,0.7,"high"],["tachypnea",0.70,0.6,"high"],["warm flushed skin",0.45,0.5,"moderate"],["oliguria",0.50,0.6,"moderate"],["rigors",0.40,0.5,"moderate"],["lactic acidosis",0.65,0.8,"high"]],
      tests:[["blood cultures","microbiology","high"],["lactate level","biochemistry","high"],["CBC with differential","hematology","high"],["procalcitonin","biochemistry","moderate"],["ABG","biochemistry","moderate"]],
      treatments:[["norepinephrine","vasopressor","first_line","SSC"],["vancomycin","antibiotic","first_line","SSC"],["piperacillin-tazobactam","antibiotic","first_line","SSC"],["hydrocortisone","corticosteroid","adjunct","SSC"]]},
    {name:"acute stroke ischemic",icd10:"I63.9",organ:"neurological",prior:0.02,severity:"critical",
      symptoms:[["sudden unilateral weakness",0.85,0.9,"high"],["facial droop",0.75,0.9,"high"],["speech difficulty",0.70,0.85,"high"],["sudden severe headache",0.40,0.6,"moderate"],["visual disturbance",0.45,0.6,"moderate"],["dizziness",0.40,0.5,"moderate"],["confusion",0.50,0.6,"moderate"],["ataxia",0.35,0.6,"moderate"]],
      tests:[["CT head non-contrast","imaging","high"],["CT angiography","imaging","high"],["MRI brain DWI","imaging","high"],["blood glucose","biochemistry","high"],["coagulation profile","hematology","moderate"]],
      treatments:[["alteplase IV","thrombolytic","first_line","AHA"],["aspirin","antiplatelet","first_line","AHA"],["mechanical thrombectomy","procedure","first_line","AHA"]]},
    {name:"subarachnoid hemorrhage",icd10:"I60.9",organ:"neurological",prior:0.005,severity:"critical",
      symptoms:[["thunderclap headache",0.90,0.95,"high"],["neck stiffness",0.70,0.8,"high"],["loss of consciousness",0.50,0.7,"high"],["photophobia",0.55,0.6,"moderate"],["nausea and vomiting",0.60,0.5,"moderate"],["seizures",0.30,0.6,"moderate"],["focal neurological deficit",0.35,0.6,"moderate"],["altered mental status",0.45,0.6,"moderate"]],
      tests:[["CT head non-contrast","imaging","high"],["lumbar puncture","procedure","high"],["CT angiography","imaging","high"],["cerebral angiography","imaging","high"]],
      treatments:[["nimodipine","calcium channel blocker","first_line","AHA"],["surgical clipping","procedure","definitive","AHA"],["endovascular coiling","procedure","definitive","AHA"]]},
    {name:"diabetic ketoacidosis",icd10:"E11.10",organ:"endocrine",prior:0.01,severity:"critical",
      symptoms:[["polyuria",0.80,0.7,"high"],["polydipsia",0.75,0.7,"high"],["nausea and vomiting",0.70,0.6,"high"],["abdominal pain",0.60,0.5,"moderate"],["Kussmaul breathing",0.55,0.9,"high"],["fruity breath odor",0.50,0.9,"high"],["altered mental status",0.45,0.6,"moderate"],["dehydration",0.75,0.6,"high"],["weakness",0.55,0.4,"moderate"]],
      tests:[["blood glucose","biochemistry","high"],["ABG","biochemistry","high"],["serum ketones","biochemistry","high"],["basic metabolic panel","biochemistry","high"],["urinalysis","biochemistry","moderate"]],
      treatments:[["insulin regular IV","insulin","first_line","ADA"],["normal saline","fluid","first_line","ADA"],["potassium replacement","electrolyte","first_line","ADA"]]},
    {name:"meningitis bacterial",icd10:"G00.9",organ:"infectious",prior:0.005,severity:"critical",
      symptoms:[["severe headache",0.85,0.7,"high"],["neck stiffness",0.80,0.85,"high"],["high fever",0.85,0.6,"high"],["photophobia",0.65,0.7,"high"],["altered mental status",0.55,0.7,"high"],["nausea and vomiting",0.60,0.5,"moderate"],["petechial rash",0.35,0.9,"high"],["seizures",0.30,0.6,"moderate"],["Kernig sign positive",0.45,0.85,"high"],["Brudzinski sign positive",0.40,0.85,"high"]],
      tests:[["lumbar puncture CSF analysis","procedure","high"],["blood cultures","microbiology","high"],["CBC with differential","hematology","high"],["CT head","imaging","moderate"],["procalcitonin","biochemistry","moderate"]],
      treatments:[["ceftriaxone","cephalosporin","first_line","IDSA"],["vancomycin","glycopeptide","first_line","IDSA"],["dexamethasone","corticosteroid","adjunct","IDSA"],["ampicillin","penicillin","adjunct","IDSA"]]},
    {name:"acute appendicitis",icd10:"K35.80",organ:"gastrointestinal",prior:0.03,severity:"high",
      symptoms:[["right lower quadrant pain",0.85,0.85,"high"],["periumbilical pain migrating to RLQ",0.70,0.9,"high"],["nausea",0.70,0.5,"moderate"],["vomiting",0.55,0.5,"moderate"],["anorexia",0.65,0.6,"moderate"],["fever",0.55,0.5,"moderate"],["rebound tenderness",0.65,0.8,"high"],["McBurney point tenderness",0.70,0.85,"high"],["guarding",0.50,0.6,"moderate"]],
      tests:[["CT abdomen pelvis","imaging","high"],["CBC with differential","hematology","moderate"],["CRP","biochemistry","moderate"],["ultrasound abdomen","imaging","moderate"],["urinalysis","biochemistry","moderate"]],
      treatments:[["appendectomy","procedure","first_line","SAGES"],["ceftriaxone","cephalosporin","perioperative","SAGES"],["metronidazole","antimicrobial","perioperative","SAGES"]]},
    {name:"ectopic pregnancy",icd10:"O00.9",organ:"obstetric",prior:0.02,severity:"critical",
      symptoms:[["lower abdominal pain",0.85,0.8,"high"],["vaginal bleeding",0.70,0.7,"high"],["missed period",0.80,0.7,"high"],["shoulder tip pain",0.35,0.85,"high"],["dizziness",0.45,0.5,"moderate"],["syncope",0.30,0.6,"moderate"],["adnexal tenderness",0.65,0.8,"high"],["hypotension",0.35,0.6,"moderate"]],
      tests:[["serum beta-hCG","biochemistry","high"],["transvaginal ultrasound","imaging","high"],["CBC","hematology","moderate"],["type and crossmatch","hematology","moderate"]],
      treatments:[["methotrexate","antimetabolite","first_line","ACOG"],["salpingectomy","procedure","surgical","ACOG"],["salpingostomy","procedure","surgical","ACOG"]]},
    {name:"acute pancreatitis",icd10:"K85.9",organ:"gastrointestinal",prior:0.015,severity:"high",
      symptoms:[["severe epigastric pain",0.90,0.85,"high"],["pain radiating to back",0.65,0.8,"high"],["nausea and vomiting",0.80,0.6,"high"],["abdominal tenderness",0.70,0.6,"moderate"],["fever",0.45,0.4,"moderate"],["tachycardia",0.50,0.5,"moderate"],["abdominal distension",0.40,0.5,"moderate"],["jaundice",0.30,0.6,"moderate"]],
      tests:[["serum lipase","biochemistry","high"],["serum amylase","biochemistry","high"],["CT abdomen with contrast","imaging","high"],["abdominal ultrasound","imaging","moderate"],["CBC","hematology","moderate"],["liver function tests","biochemistry","moderate"]],
      treatments:[["IV crystalloid","fluid","first_line","ACG"],["acetaminophen","analgesic","first_line","ACG"],["morphine","opioid","adjunct","ACG"]]},
    {name:"testicular torsion",icd10:"N44.0",organ:"urological",prior:0.005,severity:"critical",
      symptoms:[["sudden severe scrotal pain",0.92,0.9,"high"],["scrotal swelling",0.75,0.7,"high"],["nausea and vomiting",0.60,0.5,"moderate"],["absent cremasteric reflex",0.65,0.9,"high"],["high-riding testis",0.55,0.85,"high"],["abdominal pain",0.40,0.4,"moderate"]],
      tests:[["doppler ultrasound scrotum","imaging","high"],["urinalysis","biochemistry","moderate"]],
      treatments:[["surgical detorsion","procedure","first_line","AUA"],["orchiopexy","procedure","definitive","AUA"]]},
    {name:"acute cholecystitis",icd10:"K81.0",organ:"gastrointestinal",prior:0.025,severity:"high",
      symptoms:[["right upper quadrant pain",0.90,0.85,"high"],["Murphy sign positive",0.65,0.9,"high"],["nausea and vomiting",0.70,0.5,"moderate"],["fever",0.55,0.5,"moderate"],["pain after fatty meals",0.55,0.7,"high"],["referred pain to right shoulder",0.40,0.7,"high"],["guarding RUQ",0.50,0.7,"high"]],
      tests:[["abdominal ultrasound","imaging","high"],["CBC","hematology","moderate"],["liver function tests","biochemistry","moderate"],["HIDA scan","imaging","moderate"],["CRP","biochemistry","moderate"]],
      treatments:[["cholecystectomy","procedure","first_line","SAGES"],["ceftriaxone","cephalosporin","first_line","SAGES"],["metronidazole","antimicrobial","adjunct","SAGES"]]},
    {name:"acute kidney injury",icd10:"N17.9",organ:"renal",prior:0.02,severity:"high",
      symptoms:[["oliguria",0.65,0.7,"high"],["edema",0.50,0.5,"moderate"],["nausea",0.45,0.4,"moderate"],["fatigue",0.50,0.4,"moderate"],["confusion",0.35,0.5,"moderate"],["flank pain",0.30,0.4,"moderate"],["dyspnea",0.35,0.4,"moderate"],["elevated blood pressure",0.40,0.4,"moderate"]],
      tests:[["serum creatinine","biochemistry","high"],["BUN","biochemistry","high"],["urinalysis","biochemistry","high"],["renal ultrasound","imaging","moderate"],["electrolytes","biochemistry","high"],["urine sodium","biochemistry","moderate"]],
      treatments:[["IV fluid resuscitation","fluid","first_line","KDIGO"],["furosemide","loop diuretic","adjunct","KDIGO"],["dialysis","procedure","severe","KDIGO"]]},
    {name:"hypertensive emergency",icd10:"I16.1",organ:"cardiovascular",prior:0.01,severity:"critical",
      symptoms:[["severe headache",0.70,0.6,"high"],["chest pain",0.50,0.5,"moderate"],["shortness of breath",0.45,0.5,"moderate"],["visual changes",0.40,0.6,"moderate"],["altered mental status",0.35,0.6,"moderate"],["epistaxis",0.30,0.4,"moderate"],["nausea and vomiting",0.35,0.4,"moderate"],["severely elevated blood pressure",0.95,0.9,"high"]],
      tests:[["urinalysis","biochemistry","moderate"],["ECG","cardiac","moderate"],["basic metabolic panel","biochemistry","moderate"],["CT head","imaging","moderate"],["chest X-ray","imaging","moderate"]],
      treatments:[["nicardipine IV","calcium channel blocker","first_line","AHA"],["labetalol IV","beta-blocker","first_line","AHA"],["nitroprusside","vasodilator","second_line","AHA"]]},
    {name:"cardiac tamponade",icd10:"I31.4",organ:"cardiovascular",prior:0.003,severity:"critical",
      symptoms:[["hypotension",0.80,0.7,"high"],["muffled heart sounds",0.60,0.9,"high"],["distended neck veins",0.70,0.8,"high"],["tachycardia",0.75,0.6,"high"],["dyspnea",0.65,0.5,"moderate"],["pulsus paradoxus",0.55,0.9,"high"],["chest pain",0.40,0.4,"moderate"]],
      tests:[["echocardiogram","cardiac","high"],["ECG","cardiac","moderate"],["chest X-ray","imaging","moderate"]],
      treatments:[["pericardiocentesis","procedure","first_line","AHA"],["IV fluid bolus","fluid","first_line","AHA"],["surgical drainage","procedure","definitive","AHA"]]},
    {name:"bowel obstruction",icd10:"K56.6",organ:"gastrointestinal",prior:0.02,severity:"high",
      symptoms:[["colicky abdominal pain",0.85,0.8,"high"],["abdominal distension",0.80,0.75,"high"],["vomiting",0.75,0.6,"high"],["constipation",0.65,0.6,"moderate"],["high-pitched bowel sounds",0.55,0.8,"high"],["inability to pass flatus",0.60,0.7,"high"],["nausea",0.60,0.5,"moderate"]],
      tests:[["abdominal X-ray","imaging","high"],["CT abdomen","imaging","high"],["basic metabolic panel","biochemistry","moderate"],["CBC","hematology","moderate"]],
      treatments:[["nasogastric tube decompression","procedure","first_line","ASCRS"],["IV fluid resuscitation","fluid","first_line","ASCRS"],["surgical exploration","procedure","definitive","ASCRS"]]},
    {name:"acute limb ischemia",icd10:"I74.3",organ:"cardiovascular",prior:0.005,severity:"critical",
      symptoms:[["sudden limb pain",0.85,0.85,"high"],["pallor of limb",0.70,0.8,"high"],["pulselessness",0.65,0.9,"high"],["paresthesia",0.60,0.7,"high"],["paralysis",0.45,0.8,"high"],["poikilothermia",0.55,0.7,"high"]],
      tests:[["CT angiography","imaging","high"],["doppler ultrasound","imaging","high"],["angiography","imaging","high"]],
      treatments:[["heparin IV","anticoagulant","first_line","SVS"],["embolectomy","procedure","definitive","SVS"],["thrombolysis","procedure","alternative","SVS"]]},
  ];
}

// ══════════════════════════════════════════════════
// BATCH 5: PRIMARY CARE (45 diseases)
// ══════════════════════════════════════════════════
function getPrimaryCare(): DiseaseEntry[] {
  return [
    {name:"essential hypertension",icd10:"I10",organ:"cardiovascular",prior:0.30,severity:"moderate",
      symptoms:[["elevated blood pressure",0.95,0.9,"high"],["headache",0.35,0.3,"moderate"],["dizziness",0.30,0.3,"moderate"],["epistaxis",0.30,0.4,"moderate"],["visual changes",0.30,0.4,"moderate"]],
      tests:[["blood pressure measurement","clinical","high"],["basic metabolic panel","biochemistry","moderate"],["urinalysis","biochemistry","moderate"],["ECG","cardiac","moderate"],["lipid panel","biochemistry","moderate"]],
      treatments:[["amlodipine","calcium channel blocker","first_line","JNC8"],["lisinopril","ACE inhibitor","first_line","JNC8"],["hydrochlorothiazide","thiazide diuretic","first_line","JNC8"],["losartan","ARB","first_line","JNC8"]]},
    {name:"type 2 diabetes mellitus",icd10:"E11.9",organ:"endocrine",prior:0.10,severity:"moderate",
      symptoms:[["polyuria",0.65,0.7,"high"],["polydipsia",0.60,0.65,"high"],["unexplained weight loss",0.45,0.5,"moderate"],["fatigue",0.55,0.4,"moderate"],["blurred vision",0.40,0.5,"moderate"],["recurrent infections",0.35,0.4,"moderate"],["slow wound healing",0.40,0.5,"moderate"],["numbness in extremities",0.35,0.4,"moderate"]],
      tests:[["fasting blood glucose","biochemistry","high"],["HbA1c","biochemistry","high"],["oral glucose tolerance test","biochemistry","moderate"],["lipid panel","biochemistry","moderate"],["urinalysis","biochemistry","moderate"],["serum creatinine","biochemistry","moderate"]],
      treatments:[["metformin","biguanide","first_line","ADA"],["glimepiride","sulfonylurea","second_line","ADA"],["sitagliptin","DPP4 inhibitor","second_line","ADA"],["empagliflozin","SGLT2 inhibitor","second_line","ADA"],["insulin glargine","insulin","third_line","ADA"]]},
    {name:"hyperlipidemia",icd10:"E78.5",organ:"metabolic",prior:0.25,severity:"low",
      symptoms:[["asymptomatic",0.80,0.3,"low"],["xanthomas",0.30,0.8,"high"],["arcus cornealis",0.30,0.6,"moderate"]],
      tests:[["lipid panel","biochemistry","high"],["fasting cholesterol","biochemistry","high"],["cardiovascular risk assessment","clinical","moderate"]],
      treatments:[["atorvastatin","statin","first_line","ACC/AHA"],["rosuvastatin","statin","first_line","ACC/AHA"],["ezetimibe","cholesterol absorption inhibitor","second_line","ACC/AHA"]]},
    {name:"upper respiratory tract infection",icd10:"J06.9",organ:"respiratory",prior:0.25,severity:"low",
      symptoms:[["rhinorrhea",0.85,0.7,"high"],["sore throat",0.75,0.6,"high"],["cough",0.70,0.5,"moderate"],["sneezing",0.65,0.6,"moderate"],["nasal congestion",0.80,0.7,"high"],["mild fever",0.50,0.4,"moderate"],["malaise",0.55,0.3,"moderate"],["headache",0.40,0.3,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["rapid strep test","microbiology","moderate"]],
      treatments:[["acetaminophen","analgesic","first_line","NICE"],["ibuprofen","NSAID","first_line","NICE"],["saline nasal spray","supportive","adjunct","NICE"]]},
    {name:"acute pharyngitis",icd10:"J02.9",organ:"respiratory",prior:0.10,severity:"low",
      symptoms:[["sore throat",0.92,0.8,"high"],["odynophagia",0.80,0.75,"high"],["fever",0.60,0.5,"moderate"],["tonsillar exudate",0.50,0.7,"high"],["cervical lymphadenopathy",0.55,0.6,"moderate"],["headache",0.35,0.3,"moderate"]],
      tests:[["rapid strep antigen test","microbiology","high"],["throat culture","microbiology","moderate"],["monospot test","hematology","moderate"]],
      treatments:[["amoxicillin","penicillin","first_line","IDSA"],["azithromycin","macrolide","penicillin_allergy","IDSA"],["acetaminophen","analgesic","adjunct","NICE"]]},
    {name:"acute otitis media",icd10:"H66.9",organ:"ENT",prior:0.08,severity:"low",
      symptoms:[["ear pain",0.90,0.85,"high"],["fever",0.55,0.5,"moderate"],["hearing loss",0.50,0.6,"moderate"],["ear discharge",0.40,0.7,"high"],["irritability",0.45,0.4,"moderate"],["pulling at ear",0.40,0.5,"moderate"]],
      tests:[["otoscopic examination","clinical","high"],["tympanometry","audiology","moderate"]],
      treatments:[["amoxicillin","penicillin","first_line","AAP"],["amoxicillin-clavulanate","penicillin combination","second_line","AAP"],["acetaminophen","analgesic","adjunct","AAP"]]},
    {name:"urinary tract infection",icd10:"N39.0",organ:"urological",prior:0.08,severity:"low",
      symptoms:[["dysuria",0.85,0.8,"high"],["urinary frequency",0.80,0.7,"high"],["urinary urgency",0.70,0.7,"high"],["suprapubic pain",0.55,0.6,"moderate"],["hematuria",0.40,0.6,"moderate"],["cloudy urine",0.45,0.5,"moderate"],["malodorous urine",0.40,0.5,"moderate"],["low-grade fever",0.35,0.4,"moderate"]],
      tests:[["urinalysis","biochemistry","high"],["urine culture","microbiology","high"],["urine dipstick","biochemistry","moderate"]],
      treatments:[["nitrofurantoin","antibiotic","first_line","IDSA"],["trimethoprim-sulfamethoxazole","antibiotic","first_line","IDSA"],["fosfomycin","antibiotic","alternative","IDSA"]]},
    {name:"iron deficiency anemia",icd10:"D50.9",organ:"hematological",prior:0.08,severity:"moderate",
      symptoms:[["fatigue",0.80,0.4,"moderate"],["pallor",0.65,0.5,"moderate"],["dyspnea on exertion",0.55,0.5,"moderate"],["dizziness",0.45,0.4,"moderate"],["pica",0.30,0.8,"high"],["koilonychia",0.30,0.85,"high"],["brittle nails",0.40,0.5,"moderate"],["glossitis",0.35,0.6,"moderate"],["tachycardia",0.40,0.4,"moderate"]],
      tests:[["CBC","hematology","high"],["serum ferritin","biochemistry","high"],["serum iron","biochemistry","high"],["TIBC","biochemistry","high"],["peripheral blood smear","hematology","moderate"],["reticulocyte count","hematology","moderate"]],
      treatments:[["ferrous sulfate","iron supplement","first_line","ASH"],["iron sucrose IV","iron supplement","second_line","ASH"],["ferrous gluconate","iron supplement","first_line","ASH"]]},
    {name:"allergic rhinitis",icd10:"J30.9",organ:"respiratory",prior:0.15,severity:"low",
      symptoms:[["sneezing",0.85,0.7,"high"],["rhinorrhea",0.80,0.6,"high"],["nasal congestion",0.75,0.6,"high"],["nasal itching",0.70,0.7,"high"],["watery eyes",0.65,0.6,"moderate"],["postnasal drip",0.55,0.5,"moderate"],["itchy eyes",0.60,0.6,"moderate"]],
      tests:[["skin prick testing","immunology","moderate"],["serum IgE","immunology","moderate"],["nasal smear for eosinophils","cytology","moderate"]],
      treatments:[["cetirizine","antihistamine","first_line","ARIA"],["fluticasone nasal","intranasal corticosteroid","first_line","ARIA"],["loratadine","antihistamine","first_line","ARIA"],["montelukast","leukotriene antagonist","second_line","ARIA"]]},
    {name:"gastroesophageal reflux disease",icd10:"K21.0",organ:"gastrointestinal",prior:0.15,severity:"low",
      symptoms:[["heartburn",0.85,0.8,"high"],["acid regurgitation",0.75,0.8,"high"],["dysphagia",0.40,0.5,"moderate"],["chest pain non-cardiac",0.45,0.5,"moderate"],["chronic cough",0.35,0.4,"moderate"],["hoarseness",0.30,0.4,"moderate"],["globus sensation",0.30,0.5,"moderate"],["epigastric pain",0.50,0.5,"moderate"]],
      tests:[["upper GI endoscopy","endoscopy","moderate"],["24-hour pH monitoring","gastroenterology","moderate"],["H. pylori test","microbiology","moderate"]],
      treatments:[["omeprazole","PPI","first_line","ACG"],["pantoprazole","PPI","first_line","ACG"],["ranitidine","H2 blocker","second_line","ACG"],["esomeprazole","PPI","first_line","ACG"]]},
    {name:"osteoarthritis",icd10:"M19.9",organ:"musculoskeletal",prior:0.12,severity:"moderate",
      symptoms:[["joint pain",0.90,0.7,"high"],["morning stiffness less than 30 minutes",0.65,0.7,"high"],["joint crepitus",0.55,0.7,"high"],["reduced range of motion",0.60,0.6,"moderate"],["joint swelling",0.50,0.5,"moderate"],["bony enlargement",0.45,0.7,"high"],["pain worse with activity",0.75,0.6,"high"]],
      tests:[["joint X-ray","imaging","high"],["ESR","hematology","moderate"],["CRP","biochemistry","moderate"],["rheumatoid factor","immunology","moderate"]],
      treatments:[["acetaminophen","analgesic","first_line","ACR"],["ibuprofen","NSAID","first_line","ACR"],["diclofenac topical","NSAID","first_line","ACR"],["intra-articular corticosteroid","corticosteroid","second_line","ACR"]]},
    {name:"low back pain mechanical",icd10:"M54.5",organ:"musculoskeletal",prior:0.20,severity:"low",
      symptoms:[["low back pain",0.95,0.8,"high"],["muscle spasm",0.60,0.6,"moderate"],["pain worse with movement",0.70,0.6,"moderate"],["limited range of motion",0.55,0.5,"moderate"],["pain radiating to buttock",0.40,0.5,"moderate"],["tenderness paravertebral",0.50,0.6,"moderate"]],
      tests:[["lumbar spine X-ray","imaging","moderate"],["MRI lumbar spine","imaging","moderate"],["ESR","hematology","low"]],
      treatments:[["ibuprofen","NSAID","first_line","ACP"],["naproxen","NSAID","first_line","ACP"],["cyclobenzaprine","muscle relaxant","adjunct","ACP"],["physical therapy","rehabilitation","first_line","ACP"]]},
    {name:"acute sinusitis",icd10:"J01.9",organ:"respiratory",prior:0.08,severity:"low",
      symptoms:[["facial pain or pressure",0.80,0.75,"high"],["nasal congestion",0.85,0.6,"high"],["purulent nasal discharge",0.70,0.7,"high"],["headache",0.55,0.4,"moderate"],["hyposmia",0.45,0.6,"moderate"],["fever",0.40,0.4,"moderate"],["dental pain maxillary",0.35,0.6,"moderate"],["cough",0.40,0.4,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["CT sinuses","imaging","moderate"],["nasal endoscopy","ENT","moderate"]],
      treatments:[["amoxicillin-clavulanate","penicillin combination","first_line","IDSA"],["fluticasone nasal","intranasal corticosteroid","adjunct","IDSA"],["saline nasal irrigation","supportive","adjunct","IDSA"]]},
    {name:"tension headache",icd10:"G44.2",organ:"neurological",prior:0.20,severity:"low",
      symptoms:[["bilateral headache",0.85,0.7,"high"],["pressing or tightening quality",0.80,0.75,"high"],["mild to moderate intensity",0.75,0.6,"moderate"],["not aggravated by activity",0.65,0.6,"moderate"],["no nausea",0.60,0.5,"moderate"],["scalp tenderness",0.40,0.5,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"]],
      treatments:[["acetaminophen","analgesic","first_line","IHS"],["ibuprofen","NSAID","first_line","IHS"],["amitriptyline","TCA","prophylaxis","IHS"]]},
    {name:"migraine",icd10:"G43.9",organ:"neurological",prior:0.12,severity:"moderate",
      symptoms:[["unilateral headache",0.70,0.7,"high"],["throbbing headache",0.75,0.7,"high"],["photophobia",0.70,0.65,"high"],["phonophobia",0.65,0.65,"high"],["nausea",0.65,0.5,"moderate"],["vomiting",0.40,0.5,"moderate"],["visual aura",0.35,0.8,"high"],["aggravated by physical activity",0.60,0.6,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["CT head","imaging","moderate"],["MRI brain","imaging","moderate"]],
      treatments:[["sumatriptan","triptan","first_line","AHS"],["ibuprofen","NSAID","first_line","AHS"],["metoclopramide","antiemetic","adjunct","AHS"],["propranolol","beta-blocker","prophylaxis","AHS"],["topiramate","anticonvulsant","prophylaxis","AHS"]]},
    {name:"hypothyroidism",icd10:"E03.9",organ:"endocrine",prior:0.05,severity:"moderate",
      symptoms:[["fatigue",0.80,0.4,"moderate"],["weight gain",0.65,0.5,"moderate"],["cold intolerance",0.60,0.65,"high"],["constipation",0.55,0.5,"moderate"],["dry skin",0.60,0.5,"moderate"],["hair loss",0.50,0.5,"moderate"],["depression",0.40,0.4,"moderate"],["bradycardia",0.35,0.6,"moderate"],["menstrual irregularities",0.40,0.5,"moderate"],["myxedema",0.30,0.8,"high"]],
      tests:[["TSH","biochemistry","high"],["free T4","biochemistry","high"],["thyroid antibodies","immunology","moderate"]],
      treatments:[["levothyroxine","thyroid hormone","first_line","ATA"],["liothyronine","thyroid hormone","adjunct","ATA"]]},
    {name:"hyperthyroidism",icd10:"E05.9",organ:"endocrine",prior:0.02,severity:"moderate",
      symptoms:[["weight loss despite good appetite",0.70,0.7,"high"],["heat intolerance",0.65,0.7,"high"],["tremor",0.60,0.6,"moderate"],["palpitations",0.65,0.6,"high"],["anxiety",0.55,0.5,"moderate"],["diarrhea",0.40,0.4,"moderate"],["exophthalmos",0.35,0.9,"high"],["tachycardia",0.60,0.5,"moderate"],["menstrual irregularities",0.35,0.4,"moderate"],["hyperreflexia",0.40,0.6,"moderate"]],
      tests:[["TSH","biochemistry","high"],["free T4","biochemistry","high"],["free T3","biochemistry","moderate"],["thyroid antibodies","immunology","moderate"],["radioactive iodine uptake","nuclear medicine","moderate"]],
      treatments:[["methimazole","antithyroid","first_line","ATA"],["propylthiouracil","antithyroid","second_line","ATA"],["propranolol","beta-blocker","adjunct","ATA"],["radioactive iodine","nuclear medicine","definitive","ATA"]]},
    {name:"vitamin B12 deficiency",icd10:"E53.8",organ:"hematological",prior:0.05,severity:"moderate",
      symptoms:[["fatigue",0.75,0.4,"moderate"],["paresthesia",0.60,0.6,"moderate"],["glossitis",0.45,0.65,"high"],["pallor",0.50,0.5,"moderate"],["cognitive impairment",0.40,0.5,"moderate"],["ataxia",0.35,0.5,"moderate"],["depression",0.35,0.4,"moderate"],["peripheral neuropathy",0.50,0.6,"moderate"]],
      tests:[["serum vitamin B12","biochemistry","high"],["methylmalonic acid","biochemistry","high"],["homocysteine","biochemistry","moderate"],["CBC","hematology","moderate"],["peripheral blood smear","hematology","moderate"]],
      treatments:[["cyanocobalamin IM","vitamin","first_line","BSH"],["cyanocobalamin oral","vitamin","alternative","BSH"]]},
    {name:"gout",icd10:"M10.9",organ:"musculoskeletal",prior:0.04,severity:"moderate",
      symptoms:[["acute joint pain first MTP",0.75,0.85,"high"],["joint swelling",0.80,0.6,"moderate"],["joint erythema",0.70,0.7,"high"],["exquisite tenderness",0.75,0.7,"high"],["warm joint",0.65,0.6,"moderate"],["fever",0.35,0.4,"moderate"],["tophi",0.30,0.9,"high"]],
      tests:[["serum uric acid","biochemistry","high"],["joint fluid analysis","rheumatology","high"],["X-ray affected joint","imaging","moderate"],["CRP","biochemistry","moderate"]],
      treatments:[["colchicine","anti-inflammatory","first_line","ACR"],["indomethacin","NSAID","first_line","ACR"],["prednisolone","corticosteroid","alternative","ACR"],["allopurinol","xanthine oxidase inhibitor","prophylaxis","ACR"],["febuxostat","xanthine oxidase inhibitor","prophylaxis","ACR"]]},
    {name:"benign prostatic hyperplasia",icd10:"N40.0",organ:"urological",prior:0.08,severity:"low",
      symptoms:[["urinary hesitancy",0.75,0.7,"high"],["weak urinary stream",0.70,0.7,"high"],["urinary frequency",0.65,0.5,"moderate"],["nocturia",0.70,0.6,"high"],["incomplete bladder emptying",0.60,0.6,"moderate"],["urinary urgency",0.55,0.5,"moderate"],["post-void dribbling",0.50,0.6,"moderate"]],
      tests:[["digital rectal exam","clinical","high"],["PSA","biochemistry","moderate"],["urinalysis","biochemistry","moderate"],["post-void residual","urology","moderate"],["uroflowmetry","urology","moderate"]],
      treatments:[["tamsulosin","alpha-blocker","first_line","AUA"],["finasteride","5-alpha reductase inhibitor","first_line","AUA"],["dutasteride","5-alpha reductase inhibitor","first_line","AUA"]]},
  ];
}

// ══════════════════════════════════════════════════
// BATCH 6: INFECTIOUS DISEASES (40 diseases)
// ══════════════════════════════════════════════════
function getInfectiousDiseases(): DiseaseEntry[] {
  return [
    {name:"community-acquired pneumonia",icd10:"J18.9",organ:"pulmonary",prior:0.05,severity:"moderate",
      symptoms:[["productive cough",0.80,0.7,"high"],["fever",0.75,0.6,"high"],["dyspnea",0.60,0.5,"moderate"],["pleuritic chest pain",0.50,0.6,"moderate"],["rigors",0.45,0.5,"moderate"],["crackles on auscultation",0.65,0.7,"high"],["tachypnea",0.55,0.5,"moderate"],["purulent sputum",0.55,0.6,"moderate"]],
      tests:[["chest X-ray","imaging","high"],["CBC with differential","hematology","moderate"],["sputum culture","microbiology","moderate"],["blood cultures","microbiology","moderate"],["procalcitonin","biochemistry","moderate"],["CRP","biochemistry","moderate"]],
      treatments:[["amoxicillin","penicillin","first_line","BTS"],["azithromycin","macrolide","first_line","IDSA"],["levofloxacin","fluoroquinolone","second_line","IDSA"],["ceftriaxone","cephalosporin","inpatient","IDSA"]]},
    {name:"tuberculosis pulmonary",icd10:"A15.0",organ:"pulmonary",prior:0.02,severity:"high",
      symptoms:[["chronic cough more than 2 weeks",0.85,0.75,"high"],["hemoptysis",0.40,0.8,"high"],["night sweats",0.65,0.7,"high"],["weight loss",0.60,0.6,"moderate"],["fever",0.55,0.5,"moderate"],["fatigue",0.50,0.4,"moderate"],["chest pain",0.35,0.4,"moderate"],["anorexia",0.45,0.4,"moderate"]],
      tests:[["sputum AFB smear","microbiology","high"],["GeneXpert MTB/RIF","molecular","high"],["chest X-ray","imaging","high"],["tuberculin skin test","immunology","moderate"],["IGRA","immunology","moderate"],["sputum culture","microbiology","high"]],
      treatments:[["isoniazid","antimycobacterial","first_line","WHO"],["rifampicin","antimycobacterial","first_line","WHO"],["pyrazinamide","antimycobacterial","first_line","WHO"],["ethambutol","antimycobacterial","first_line","WHO"]]},
    {name:"malaria",icd10:"B54",organ:"infectious",prior:0.03,severity:"high",
      symptoms:[["cyclical fever",0.80,0.8,"high"],["rigors",0.70,0.7,"high"],["diaphoresis",0.60,0.5,"moderate"],["headache",0.65,0.5,"moderate"],["myalgia",0.50,0.4,"moderate"],["nausea and vomiting",0.45,0.4,"moderate"],["splenomegaly",0.40,0.7,"high"],["jaundice",0.35,0.6,"moderate"],["anemia",0.45,0.5,"moderate"]],
      tests:[["thick and thin blood smear","hematology","high"],["rapid malaria antigen test","immunology","high"],["CBC","hematology","high"],["liver function tests","biochemistry","moderate"],["renal function tests","biochemistry","moderate"]],
      treatments:[["artemether-lumefantrine","antimalarial","first_line","WHO"],["artesunate IV","antimalarial","severe","WHO"],["chloroquine","antimalarial","P_vivax","WHO"],["primaquine","antimalarial","adjunct","WHO"]]},
    {name:"dengue fever",icd10:"A90",organ:"infectious",prior:0.03,severity:"moderate",
      symptoms:[["high fever",0.90,0.6,"high"],["severe headache",0.70,0.5,"moderate"],["retro-orbital pain",0.60,0.8,"high"],["myalgia",0.65,0.5,"moderate"],["arthralgia",0.55,0.5,"moderate"],["rash",0.50,0.5,"moderate"],["nausea and vomiting",0.45,0.4,"moderate"],["thrombocytopenia",0.60,0.7,"high"],["petechiae",0.35,0.6,"moderate"],["hemorrhagic manifestations",0.30,0.7,"high"]],
      tests:[["NS1 antigen","immunology","high"],["dengue IgM/IgG","serology","high"],["CBC with platelet count","hematology","high"],["hematocrit","hematology","moderate"],["liver function tests","biochemistry","moderate"]],
      treatments:[["acetaminophen","analgesic","first_line","WHO"],["oral rehydration","supportive","first_line","WHO"],["IV crystalloids","fluid","severe","WHO"]]},
    {name:"typhoid fever",icd10:"A01.0",organ:"infectious",prior:0.02,severity:"moderate",
      symptoms:[["stepwise fever",0.80,0.8,"high"],["headache",0.60,0.5,"moderate"],["abdominal pain",0.55,0.5,"moderate"],["constipation",0.45,0.5,"moderate"],["diarrhea",0.40,0.4,"moderate"],["rose spots",0.30,0.85,"high"],["hepatosplenomegaly",0.40,0.6,"moderate"],["malaise",0.55,0.3,"moderate"],["relative bradycardia",0.35,0.7,"high"]],
      tests:[["blood culture","microbiology","high"],["Widal test","serology","moderate"],["CBC","hematology","moderate"],["stool culture","microbiology","moderate"],["liver function tests","biochemistry","moderate"]],
      treatments:[["azithromycin","macrolide","first_line","WHO"],["ceftriaxone","cephalosporin","first_line","WHO"],["ciprofloxacin","fluoroquinolone","alternative","WHO"]]},
    {name:"cellulitis",icd10:"L03.9",organ:"dermatological",prior:0.04,severity:"moderate",
      symptoms:[["skin erythema spreading",0.90,0.8,"high"],["skin warmth",0.80,0.7,"high"],["skin swelling",0.75,0.6,"moderate"],["pain at site",0.80,0.6,"moderate"],["fever",0.50,0.5,"moderate"],["lymphangitis streaking",0.35,0.8,"high"],["regional lymphadenopathy",0.40,0.5,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["CBC","hematology","moderate"],["blood cultures","microbiology","moderate"],["CRP","biochemistry","moderate"]],
      treatments:[["cephalexin","cephalosporin","first_line","IDSA"],["clindamycin","lincosamide","alternative","IDSA"],["amoxicillin-clavulanate","penicillin combination","first_line","IDSA"]]},
    {name:"HIV infection",icd10:"B20",organ:"infectious",prior:0.01,severity:"high",
      symptoms:[["fever",0.60,0.4,"moderate"],["weight loss",0.55,0.5,"moderate"],["lymphadenopathy",0.50,0.5,"moderate"],["night sweats",0.45,0.5,"moderate"],["oral candidiasis",0.40,0.6,"moderate"],["recurrent infections",0.50,0.5,"moderate"],["chronic diarrhea",0.40,0.5,"moderate"],["fatigue",0.55,0.3,"moderate"],["rash",0.35,0.4,"moderate"]],
      tests:[["HIV antigen/antibody test","serology","high"],["HIV viral load","molecular","high"],["CD4 count","immunology","high"],["CBC","hematology","moderate"],["hepatitis B/C screening","serology","moderate"]],
      treatments:[["tenofovir-emtricitabine","NRTI","first_line","WHO"],["dolutegravir","integrase inhibitor","first_line","WHO"],["efavirenz","NNRTI","alternative","WHO"]]},
    {name:"acute gastroenteritis",icd10:"A09",organ:"gastrointestinal",prior:0.12,severity:"low",
      symptoms:[["diarrhea",0.90,0.7,"high"],["nausea and vomiting",0.75,0.6,"high"],["abdominal cramps",0.70,0.6,"moderate"],["fever",0.50,0.4,"moderate"],["dehydration",0.45,0.5,"moderate"],["bloating",0.40,0.4,"moderate"],["malaise",0.45,0.3,"moderate"]],
      tests:[["stool culture","microbiology","moderate"],["stool ova and parasites","microbiology","moderate"],["electrolytes","biochemistry","moderate"],["CBC","hematology","low"]],
      treatments:[["oral rehydration salts","supportive","first_line","WHO"],["loperamide","antidiarrheal","adjunct","WHO"],["ondansetron","antiemetic","adjunct","WHO"]]},
    {name:"hepatitis B acute",icd10:"B16.9",organ:"hepatic",prior:0.01,severity:"moderate",
      symptoms:[["jaundice",0.65,0.6,"moderate"],["fatigue",0.70,0.4,"moderate"],["nausea",0.55,0.4,"moderate"],["right upper quadrant pain",0.50,0.5,"moderate"],["anorexia",0.55,0.4,"moderate"],["dark urine",0.50,0.6,"moderate"],["clay-colored stools",0.40,0.7,"high"],["arthralgia",0.35,0.4,"moderate"],["fever",0.40,0.4,"moderate"]],
      tests:[["HBsAg","serology","high"],["anti-HBc IgM","serology","high"],["HBV DNA","molecular","high"],["liver function tests","biochemistry","high"],["coagulation profile","hematology","moderate"]],
      treatments:[["entecavir","antiviral","first_line","AASLD"],["tenofovir","antiviral","first_line","AASLD"]]},
    {name:"chickenpox",icd10:"B01.9",organ:"infectious",prior:0.03,severity:"low",
      symptoms:[["vesicular rash in different stages",0.90,0.9,"high"],["fever",0.70,0.5,"moderate"],["pruritus",0.80,0.6,"high"],["malaise",0.55,0.3,"moderate"],["headache",0.40,0.3,"moderate"],["rash starting on trunk",0.65,0.7,"high"]],
      tests:[["clinical diagnosis","clinical","high"],["PCR VZV","molecular","moderate"],["Tzanck smear","cytology","moderate"]],
      treatments:[["acyclovir","antiviral","first_line","AAP"],["calamine lotion","supportive","adjunct","AAP"],["acetaminophen","analgesic","adjunct","AAP"]]},
    {name:"herpes zoster",icd10:"B02.9",organ:"neurological",prior:0.03,severity:"moderate",
      symptoms:[["unilateral dermatomal pain",0.85,0.85,"high"],["vesicular rash dermatomal",0.90,0.9,"high"],["burning pain",0.75,0.7,"high"],["pruritus",0.50,0.5,"moderate"],["fever",0.35,0.4,"moderate"],["headache",0.30,0.3,"moderate"],["allodynia",0.50,0.6,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["PCR VZV","molecular","moderate"],["direct fluorescent antibody","immunology","moderate"]],
      treatments:[["valacyclovir","antiviral","first_line","IDSA"],["acyclovir","antiviral","first_line","IDSA"],["gabapentin","anticonvulsant","neuropathic_pain","IDSA"],["pregabalin","anticonvulsant","neuropathic_pain","IDSA"]]},
    {name:"influenza",icd10:"J11.1",organ:"respiratory",prior:0.08,severity:"moderate",
      symptoms:[["sudden high fever",0.80,0.7,"high"],["myalgia",0.75,0.6,"high"],["headache",0.60,0.5,"moderate"],["dry cough",0.70,0.6,"high"],["sore throat",0.50,0.4,"moderate"],["rhinorrhea",0.45,0.4,"moderate"],["fatigue",0.70,0.4,"moderate"],["malaise",0.65,0.4,"moderate"]],
      tests:[["rapid influenza diagnostic test","molecular","high"],["influenza PCR","molecular","high"],["chest X-ray","imaging","moderate"]],
      treatments:[["oseltamivir","neuraminidase inhibitor","first_line","IDSA"],["zanamivir","neuraminidase inhibitor","alternative","IDSA"],["acetaminophen","analgesic","adjunct","IDSA"]]},
    {name:"leptospirosis",icd10:"A27.9",organ:"infectious",prior:0.005,severity:"high",
      symptoms:[["fever",0.85,0.5,"moderate"],["headache",0.65,0.5,"moderate"],["myalgia especially calves",0.70,0.7,"high"],["conjunctival suffusion",0.50,0.85,"high"],["jaundice",0.40,0.6,"moderate"],["oliguria",0.35,0.6,"moderate"],["abdominal pain",0.35,0.4,"moderate"],["rash",0.30,0.4,"moderate"]],
      tests:[["leptospira IgM ELISA","serology","high"],["MAT","serology","high"],["blood culture","microbiology","moderate"],["CBC","hematology","moderate"],["liver function tests","biochemistry","moderate"],["renal function tests","biochemistry","moderate"]],
      treatments:[["doxycycline","tetracycline","first_line","WHO"],["penicillin G IV","penicillin","severe","WHO"],["ceftriaxone","cephalosporin","severe","WHO"]]},
    {name:"scrub typhus",icd10:"A75.3",organ:"infectious",prior:0.01,severity:"high",
      symptoms:[["fever",0.90,0.5,"moderate"],["eschar",0.60,0.95,"high"],["headache",0.65,0.5,"moderate"],["myalgia",0.55,0.4,"moderate"],["lymphadenopathy regional",0.50,0.6,"moderate"],["rash maculopapular",0.40,0.5,"moderate"],["hepatosplenomegaly",0.35,0.5,"moderate"]],
      tests:[["IgM ELISA scrub typhus","serology","high"],["Weil-Felix test","serology","moderate"],["CBC","hematology","moderate"],["liver function tests","biochemistry","moderate"]],
      treatments:[["doxycycline","tetracycline","first_line","WHO"],["azithromycin","macrolide","alternative","WHO"]]},
    {name:"infectious mononucleosis",icd10:"B27.0",organ:"infectious",prior:0.02,severity:"low",
      symptoms:[["sore throat",0.80,0.6,"moderate"],["fever",0.75,0.5,"moderate"],["cervical lymphadenopathy",0.80,0.7,"high"],["fatigue",0.85,0.4,"moderate"],["splenomegaly",0.50,0.7,"high"],["tonsillar exudate",0.45,0.5,"moderate"],["palatal petechiae",0.30,0.8,"high"],["rash with amoxicillin",0.35,0.9,"high"]],
      tests:[["monospot test","serology","high"],["EBV antibody panel","serology","high"],["CBC with differential","hematology","moderate"],["liver function tests","biochemistry","moderate"]],
      treatments:[["supportive care","supportive","first_line","NICE"],["acetaminophen","analgesic","adjunct","NICE"]]},
  ];
}

// Physiology states for these specialties
function getPhysiologyStates(): {state_name:string;description:string;organ_system:string}[] {
  return [
    {state_name:"myocardial ischemia",description:"Reduced blood flow to myocardium causing oxygen demand-supply mismatch",organ_system:"cardiovascular"},
    {state_name:"coronary artery occlusion",description:"Complete blockage of coronary artery leading to infarction",organ_system:"cardiovascular"},
    {state_name:"pulmonary vascular obstruction",description:"Blockage of pulmonary vasculature by thrombus",organ_system:"pulmonary"},
    {state_name:"ventilation-perfusion mismatch",description:"Imbalance between alveolar ventilation and pulmonary blood flow",organ_system:"pulmonary"},
    {state_name:"intrapleural pressure elevation",description:"Increased pressure in pleural space compressing lung",organ_system:"pulmonary"},
    {state_name:"aortic wall dissection",description:"Tearing of aortic intima with blood entering media layer",organ_system:"cardiovascular"},
    {state_name:"systemic mast cell degranulation",description:"Widespread release of histamine and mediators from mast cells",organ_system:"immunological"},
    {state_name:"cerebral cortical seizure activity",description:"Abnormal excessive neuronal discharge causing seizures",organ_system:"neurological"},
    {state_name:"gastrointestinal mucosal erosion",description:"Breakdown of GI mucosal barrier leading to bleeding",organ_system:"gastrointestinal"},
    {state_name:"systemic inflammatory response",description:"Widespread inflammatory cascade from infection",organ_system:"infectious"},
    {state_name:"cerebral arterial occlusion",description:"Blockage of cerebral artery causing ischemic injury",organ_system:"neurological"},
    {state_name:"intracranial aneurysm rupture",description:"Rupture of cerebral aneurysm causing subarachnoid hemorrhage",organ_system:"neurological"},
    {state_name:"insulin deficiency with ketogenesis",description:"Absolute insulin lack causing fatty acid oxidation and ketone production",organ_system:"endocrine"},
    {state_name:"meningeal inflammation",description:"Inflammation of meninges from bacterial infection",organ_system:"neurological"},
    {state_name:"appendiceal obstruction",description:"Obstruction of appendiceal lumen leading to inflammation",organ_system:"gastrointestinal"},
    {state_name:"ectopic implantation",description:"Implantation of embryo outside uterine cavity",organ_system:"reproductive"},
    {state_name:"pancreatic autodigestion",description:"Activation of pancreatic enzymes causing self-digestion",organ_system:"gastrointestinal"},
    {state_name:"spermatic cord torsion",description:"Twisting of spermatic cord compromising testicular blood flow",organ_system:"urological"},
    {state_name:"cystic duct obstruction",description:"Blockage of cystic duct leading to gallbladder inflammation",organ_system:"gastrointestinal"},
    {state_name:"renal perfusion compromise",description:"Reduced blood flow to kidneys causing acute injury",organ_system:"renal"},
    {state_name:"pericardial pressure elevation",description:"Fluid accumulation in pericardium compressing heart",organ_system:"cardiovascular"},
    {state_name:"intestinal lumen obstruction",description:"Mechanical blockage of intestinal passage",organ_system:"gastrointestinal"},
    {state_name:"arterial embolism",description:"Acute arterial occlusion by embolized material",organ_system:"cardiovascular"},
    {state_name:"renin-angiotensin overactivation",description:"Chronic overactivation of RAAS causing hypertension",organ_system:"cardiovascular"},
    {state_name:"insulin resistance",description:"Decreased tissue sensitivity to insulin causing hyperglycemia",organ_system:"endocrine"},
    {state_name:"mucosal barrier disruption upper GI",description:"Breakdown of gastric/esophageal mucosal protection",organ_system:"gastrointestinal"},
    {state_name:"joint cartilage degeneration",description:"Progressive loss of articular cartilage in joints",organ_system:"musculoskeletal"},
    {state_name:"thyroid hormone deficiency",description:"Insufficient thyroid hormone production",organ_system:"endocrine"},
    {state_name:"thyroid hormone excess",description:"Excessive thyroid hormone production or release",organ_system:"endocrine"},
    {state_name:"uric acid crystal deposition",description:"Monosodium urate crystal deposition in joints",organ_system:"musculoskeletal"},
    {state_name:"alveolar infection consolidation",description:"Infectious infiltration and consolidation of alveolar spaces",organ_system:"pulmonary"},
    {state_name:"mycobacterial granulomatous response",description:"Granuloma formation in response to mycobacterial infection",organ_system:"pulmonary"},
    {state_name:"viral hemorrhagic capillaritis",description:"Viral-induced capillary damage and hemorrhage",organ_system:"infectious"},
    {state_name:"hepatocyte viral injury",description:"Viral-mediated hepatocyte damage and inflammation",organ_system:"hepatic"},
    {state_name:"varicella-zoster reactivation",description:"Reactivation of latent VZV in dorsal root ganglia",organ_system:"neurological"},
    {state_name:"prostatic urethral compression",description:"Enlarged prostate compressing prostatic urethra",organ_system:"urological"},
    {state_name:"mucosal immune deficiency",description:"Impaired mucosal immune defenses from HIV infection",organ_system:"immunological"},
    {state_name:"bacterial skin invasion",description:"Bacterial penetration and spread through skin layers",organ_system:"dermatological"},
    {state_name:"lower esophageal sphincter incompetence",description:"Failure of LES to prevent gastric acid reflux",organ_system:"gastrointestinal"},
    {state_name:"paranasal sinus obstruction",description:"Obstruction of sinus ostia leading to inflammation",organ_system:"respiratory"},
    {state_name:"peripheral iron depletion",description:"Exhaustion of iron stores causing impaired erythropoiesis",organ_system:"hematological"},
    {state_name:"IgE-mediated allergic cascade",description:"Type I hypersensitivity with IgE-mediated mast cell activation",organ_system:"immunological"},
    {state_name:"eustachian tube dysfunction",description:"Impaired eustachian tube function leading to middle ear effusion",organ_system:"ENT"},
    {state_name:"urinary bacterial colonization",description:"Bacterial colonization of urinary tract epithelium",organ_system:"urological"},
    {state_name:"cobalamin metabolic deficiency",description:"Impaired B12-dependent methylation and DNA synthesis",organ_system:"hematological"},
  ];
}

// Dangerous diagnoses triggers
function getDangerousDiagnoses(): {trigger:string;disease:string;severity:string;protocol:string;source:string;priority:number}[] {
  return [
    {trigger:"crushing chest pain",disease:"acute myocardial infarction",severity:"critical",protocol:"STEMI protocol: ECG within 10 min, activate cath lab",source:"AHA",priority:1},
    {trigger:"chest pain radiating to left arm",disease:"acute myocardial infarction",severity:"critical",protocol:"STEMI protocol activation",source:"AHA",priority:1},
    {trigger:"sudden dyspnea",disease:"pulmonary embolism",severity:"critical",protocol:"CT-PA, anticoagulation",source:"ESC",priority:1},
    {trigger:"pleuritic chest pain",disease:"pulmonary embolism",severity:"critical",protocol:"Wells score, D-dimer, CT-PA",source:"ESC",priority:2},
    {trigger:"tearing chest pain",disease:"aortic dissection",severity:"critical",protocol:"CT angiography, BP control, surgical consult",source:"AHA",priority:1},
    {trigger:"absent breath sounds unilateral",disease:"tension pneumothorax",severity:"critical",protocol:"Needle decompression, chest tube",source:"ATLS",priority:1},
    {trigger:"thunderclap headache",disease:"subarachnoid hemorrhage",severity:"critical",protocol:"CT head, lumbar puncture, neurosurgery consult",source:"AHA",priority:1},
    {trigger:"sudden unilateral weakness",disease:"acute stroke ischemic",severity:"critical",protocol:"CT head, thrombolysis window assessment",source:"AHA",priority:1},
    {trigger:"facial droop",disease:"acute stroke ischemic",severity:"critical",protocol:"FAST assessment, CT head",source:"AHA",priority:1},
    {trigger:"prolonged seizure activity",disease:"status epilepticus",severity:"critical",protocol:"Benzodiazepine protocol, airway management",source:"AES",priority:1},
    {trigger:"hematemesis",disease:"acute upper GI bleeding",severity:"critical",protocol:"Resuscitation, urgent endoscopy",source:"ACG",priority:1},
    {trigger:"hypotension refractory to fluids",disease:"septic shock",severity:"critical",protocol:"Surviving Sepsis bundles, vasopressors",source:"SSC",priority:1},
    {trigger:"Kussmaul breathing",disease:"diabetic ketoacidosis",severity:"critical",protocol:"Insulin infusion, fluid resuscitation",source:"ADA",priority:1},
    {trigger:"petechial rash",disease:"meningitis bacterial",severity:"critical",protocol:"Immediate antibiotics, LP",source:"IDSA",priority:1},
    {trigger:"periumbilical pain migrating to RLQ",disease:"acute appendicitis",severity:"high",protocol:"Surgical consult, CT abdomen",source:"SAGES",priority:2},
    {trigger:"missed period",disease:"ectopic pregnancy",severity:"critical",protocol:"Beta-hCG, transvaginal US",source:"ACOG",priority:2},
    {trigger:"severe epigastric pain",disease:"acute pancreatitis",severity:"high",protocol:"Lipase, CT abdomen, NPO",source:"ACG",priority:2},
    {trigger:"sudden severe scrotal pain",disease:"testicular torsion",severity:"critical",protocol:"Urgent doppler US, surgical exploration within 6hr",source:"AUA",priority:1},
    {trigger:"muffled heart sounds",disease:"cardiac tamponade",severity:"critical",protocol:"Echo, pericardiocentesis",source:"AHA",priority:1},
    {trigger:"sudden limb pain",disease:"acute limb ischemia",severity:"critical",protocol:"CTA, vascular surgery, anticoagulation",source:"SVS",priority:1},
    {trigger:"throat tightness",disease:"anaphylaxis",severity:"critical",protocol:"Epinephrine IM, airway management",source:"WAO",priority:1},
    {trigger:"urticaria",disease:"anaphylaxis",severity:"high",protocol:"Epinephrine IM if systemic signs",source:"WAO",priority:2},
    {trigger:"hemoptysis",disease:"tuberculosis pulmonary",severity:"high",protocol:"Isolation, AFB smear, GeneXpert",source:"WHO",priority:2},
    {trigger:"stepwise fever",disease:"typhoid fever",severity:"high",protocol:"Blood culture, empiric antibiotics",source:"WHO",priority:3},
    {trigger:"conjunctival suffusion",disease:"leptospirosis",severity:"high",protocol:"Doxycycline, monitor renal function",source:"WHO",priority:3},
    {trigger:"eschar",disease:"scrub typhus",severity:"high",protocol:"Doxycycline empiric",source:"WHO",priority:2},
    {trigger:"cyclical fever",disease:"malaria",severity:"high",protocol:"Blood smear, rapid antigen test, ACT",source:"WHO",priority:2},
    {trigger:"retro-orbital pain",disease:"dengue fever",severity:"high",protocol:"CBC with platelet, NS1, fluid management",source:"WHO",priority:2},
    {trigger:"chest pain radiating to back",disease:"aortic dissection",severity:"critical",protocol:"CT angiography, BP control",source:"AHA",priority:1},
    {trigger:"vaginal bleeding",disease:"ectopic pregnancy",severity:"critical",protocol:"Beta-hCG, urgent pelvic US",source:"ACOG",priority:2},
  ];
}

// Clinical guidelines
function getGuidelines(): any[] {
  return [
    {title:"STEMI Management Guidelines 2023",condition:"acute myocardial infarction",source:"AHA 2023",source_organization:"American Heart Association",evidence_grade:"A",year:2023,recommendation_text:"Primary PCI within 90 min of first medical contact. Fibrinolysis within 30 min if PCI unavailable. Dual antiplatelet therapy mandatory.",summary:"Guidelines for ST-elevation myocardial infarction management",clinical_topic:"Emergency Cardiology",keywords:["STEMI","PCI","thrombolysis","antiplatelet"],applicable_tests:["troponin","ECG","echocardiogram"],applicable_drugs:["aspirin","clopidogrel","heparin","alteplase"]},
    {title:"Pulmonary Embolism Diagnosis and Treatment 2024",condition:"pulmonary embolism",source:"ESC 2024",source_organization:"European Society of Cardiology",evidence_grade:"A",year:2024,recommendation_text:"Risk stratification with Wells/Geneva scores. CTPA for intermediate-high probability. Anticoagulation for all confirmed PE.",summary:"ESC guidelines for PE diagnosis and management",clinical_topic:"Pulmonary Medicine",keywords:["PE","anticoagulation","CTPA","D-dimer"],applicable_tests:["CT pulmonary angiography","D-dimer","duplex ultrasound"],applicable_drugs:["enoxaparin","rivaroxaban","warfarin","alteplase"]},
    {title:"Acute Ischemic Stroke Management 2024",condition:"acute stroke ischemic",source:"AHA/ASA 2024",source_organization:"American Heart Association",evidence_grade:"A",year:2024,recommendation_text:"IV alteplase within 4.5 hours of onset. Mechanical thrombectomy for large vessel occlusion up to 24 hours with imaging selection.",summary:"Guidelines for acute ischemic stroke treatment",clinical_topic:"Neurology",keywords:["stroke","thrombolysis","thrombectomy","tPA"],applicable_tests:["CT head","CT angiography","MRI DWI"],applicable_drugs:["alteplase","aspirin"]},
    {title:"Sepsis and Septic Shock Management 2024",condition:"septic shock",source:"SSC 2024",source_organization:"Surviving Sepsis Campaign",evidence_grade:"A",year:2024,recommendation_text:"Hour-1 bundle: Lactate, blood cultures, broad-spectrum antibiotics, 30mL/kg crystalloid for hypotension, vasopressors for MAP<65.",summary:"Surviving Sepsis Campaign updated guidelines",clinical_topic:"Critical Care",keywords:["sepsis","septic shock","antibiotics","vasopressors"],applicable_tests:["blood cultures","lactate","procalcitonin"],applicable_drugs:["norepinephrine","vancomycin","piperacillin-tazobactam","hydrocortisone"]},
    {title:"DKA Management Protocol 2024",condition:"diabetic ketoacidosis",source:"ADA 2024",source_organization:"American Diabetes Association",evidence_grade:"A",year:2024,recommendation_text:"IV insulin infusion at 0.1 U/kg/hr. Aggressive fluid resuscitation with NS. Potassium replacement when <5.3. Transition to subQ when AG closes.",summary:"ADA position statement on DKA management",clinical_topic:"Endocrinology",keywords:["DKA","insulin","ketoacidosis","potassium"],applicable_tests:["blood glucose","ABG","serum ketones","BMP"],applicable_drugs:["insulin regular","normal saline","potassium chloride"]},
    {title:"Bacterial Meningitis Treatment 2023",condition:"meningitis bacterial",source:"IDSA 2023",source_organization:"Infectious Diseases Society of America",evidence_grade:"A",year:2023,recommendation_text:"Empiric ceftriaxone + vancomycin. Dexamethasone before or with first antibiotic dose. LP before antibiotics if no contraindication.",summary:"IDSA guidelines for bacterial meningitis",clinical_topic:"Infectious Disease",keywords:["meningitis","CSF","ceftriaxone","dexamethasone"],applicable_tests:["lumbar puncture","blood cultures","CT head"],applicable_drugs:["ceftriaxone","vancomycin","dexamethasone","ampicillin"]},
    {title:"Community-Acquired Pneumonia in Adults 2024",condition:"community-acquired pneumonia",source:"IDSA/ATS 2024",source_organization:"IDSA and American Thoracic Society",evidence_grade:"A",year:2024,recommendation_text:"Outpatient: amoxicillin or doxycycline. Inpatient: beta-lactam + macrolide or respiratory fluoroquinolone. Assess with CURB-65 or PSI.",summary:"Joint guidelines for CAP management in adults",clinical_topic:"Pulmonary Medicine",keywords:["pneumonia","CAP","CURB-65","antibiotics"],applicable_tests:["chest X-ray","sputum culture","procalcitonin","blood cultures"],applicable_drugs:["amoxicillin","azithromycin","ceftriaxone","levofloxacin"]},
    {title:"Hypertension Management 2024",condition:"essential hypertension",source:"ACC/AHA 2024",source_organization:"American College of Cardiology",evidence_grade:"A",year:2024,recommendation_text:"Target BP <130/80. First-line: ACEi/ARB, CCB, or thiazide. Combination therapy for stage 2. Lifestyle modifications for all.",summary:"ACC/AHA guidelines for hypertension prevention and management",clinical_topic:"Cardiology",keywords:["hypertension","blood pressure","antihypertensive","lifestyle"],applicable_tests:["blood pressure","BMP","urinalysis","ECG"],applicable_drugs:["amlodipine","lisinopril","hydrochlorothiazide","losartan"]},
    {title:"Type 2 Diabetes Management 2024",condition:"type 2 diabetes mellitus",source:"ADA 2024",source_organization:"American Diabetes Association",evidence_grade:"A",year:2024,recommendation_text:"Metformin first-line. Add SGLT2i or GLP-1RA for CV or renal benefit. HbA1c target <7% for most adults. Individualize targets.",summary:"ADA standards of medical care in diabetes",clinical_topic:"Endocrinology",keywords:["diabetes","metformin","HbA1c","SGLT2i"],applicable_tests:["HbA1c","fasting glucose","lipid panel","eGFR"],applicable_drugs:["metformin","empagliflozin","semaglutide","insulin glargine"]},
    {title:"Tuberculosis Treatment 2024",condition:"tuberculosis pulmonary",source:"WHO 2024",source_organization:"World Health Organization",evidence_grade:"A",year:2024,recommendation_text:"2HRZE/4HR standard regimen. DOT recommended. MDR-TB: bedaquiline-based regimen. Treatment completion minimum 6 months.",summary:"Updated WHO consolidated guidelines on TB",clinical_topic:"Infectious Disease",keywords:["TB","HRZE","DOT","MDR-TB"],applicable_tests:["sputum AFB","GeneXpert","chest X-ray","IGRA"],applicable_drugs:["isoniazid","rifampicin","pyrazinamide","ethambutol"]},
    {title:"Malaria Treatment Guidelines 2024",condition:"malaria",source:"WHO 2024",source_organization:"World Health Organization",evidence_grade:"A",year:2024,recommendation_text:"Uncomplicated P.falciparum: ACT (artemether-lumefantrine). Severe: IV artesunate. P.vivax: chloroquine + primaquine (after G6PD test).",summary:"WHO guidelines for malaria treatment",clinical_topic:"Infectious Disease",keywords:["malaria","ACT","artesunate","chloroquine"],applicable_tests:["blood smear","rapid antigen","CBC"],applicable_drugs:["artemether-lumefantrine","artesunate","chloroquine","primaquine"]},
    {title:"Dengue Clinical Management 2024",condition:"dengue fever",source:"WHO 2024",source_organization:"World Health Organization",evidence_grade:"A",year:2024,recommendation_text:"Fluid management by hematocrit. Warning signs: persistent vomiting, abdominal tenderness, mucosal bleeding. No NSAIDs or aspirin.",summary:"WHO guidelines for dengue management",clinical_topic:"Infectious Disease",keywords:["dengue","platelet","hematocrit","warning signs"],applicable_tests:["NS1 antigen","dengue serology","CBC","hematocrit"],applicable_drugs:["acetaminophen","oral rehydration","IV crystalloids"]},
    {title:"Hypothyroidism Management 2023",condition:"hypothyroidism",source:"ATA 2023",source_organization:"American Thyroid Association",evidence_grade:"A",year:2023,recommendation_text:"Levothyroxine monotherapy. Target TSH 0.5-2.5 in younger patients. Start low dose in elderly/cardiac patients. Monitor q6-8 weeks.",summary:"ATA guidelines for hypothyroidism treatment",clinical_topic:"Endocrinology",keywords:["hypothyroidism","levothyroxine","TSH","thyroid"],applicable_tests:["TSH","free T4","thyroid antibodies"],applicable_drugs:["levothyroxine"]},
    {title:"Acute Appendicitis Management 2023",condition:"acute appendicitis",source:"SAGES 2023",source_organization:"Society of American Gastrointestinal and Endoscopic Surgeons",evidence_grade:"A",year:2023,recommendation_text:"Appendectomy remains gold standard. Antibiotics-first for uncomplicated cases may be considered. CT for diagnosis.",summary:"SAGES guidelines for appendicitis management",clinical_topic:"Surgery",keywords:["appendicitis","appendectomy","CT abdomen"],applicable_tests:["CT abdomen","CBC","CRP"],applicable_drugs:["ceftriaxone","metronidazole"]},
    {title:"Gout Management 2023",condition:"gout",source:"ACR 2023",source_organization:"American College of Rheumatology",evidence_grade:"A",year:2023,recommendation_text:"Acute: colchicine, NSAIDs, or corticosteroids. ULT: allopurinol first-line, target urate <6mg/dL. Treat-to-target approach.",summary:"ACR guidelines for management of gout",clinical_topic:"Rheumatology",keywords:["gout","uric acid","allopurinol","colchicine"],applicable_tests:["serum uric acid","joint fluid analysis","X-ray"],applicable_drugs:["colchicine","allopurinol","indomethacin","febuxostat"]},
    {title:"Iron Deficiency Anemia Management 2024",condition:"iron deficiency anemia",source:"ASH 2024",source_organization:"American Society of Hematology",evidence_grade:"A",year:2024,recommendation_text:"Oral iron first-line (ferrous sulfate 325mg daily). IV iron for intolerance, malabsorption, or severe anemia. Investigate underlying cause.",summary:"ASH guidelines for iron deficiency anemia",clinical_topic:"Hematology",keywords:["iron deficiency","ferritin","anemia","iron supplementation"],applicable_tests:["CBC","ferritin","serum iron","TIBC"],applicable_drugs:["ferrous sulfate","iron sucrose","ferrous gluconate"]},
    {title:"UTI Management in Adults 2023",condition:"urinary tract infection",source:"IDSA 2023",source_organization:"Infectious Diseases Society of America",evidence_grade:"A",year:2023,recommendation_text:"Uncomplicated: nitrofurantoin or TMP-SMX 3-5 days. Avoid fluoroquinolones for uncomplicated UTI. Culture for complicated/recurrent.",summary:"IDSA guidelines for UTI management",clinical_topic:"Infectious Disease",keywords:["UTI","nitrofurantoin","cystitis","urine culture"],applicable_tests:["urinalysis","urine culture"],applicable_drugs:["nitrofurantoin","trimethoprim-sulfamethoxazole","fosfomycin"]},
    {title:"Allergic Rhinitis Management 2024",condition:"allergic rhinitis",source:"ARIA 2024",source_organization:"Allergic Rhinitis and its Impact on Asthma",evidence_grade:"A",year:2024,recommendation_text:"Mild: oral H1-antihistamine. Moderate-severe: intranasal corticosteroid. Add LTRA if inadequate. Consider immunotherapy for refractory.",summary:"ARIA guidelines update for allergic rhinitis",clinical_topic:"Allergy",keywords:["allergic rhinitis","antihistamine","intranasal steroid","immunotherapy"],applicable_tests:["skin prick test","serum IgE"],applicable_drugs:["cetirizine","fluticasone nasal","loratadine","montelukast"]},
    {title:"GERD Management 2023",condition:"gastroesophageal reflux disease",source:"ACG 2023",source_organization:"American College of Gastroenterology",evidence_grade:"A",year:2023,recommendation_text:"PPI once daily for 8 weeks. Step down to H2RA or on-demand. Endoscopy for alarm symptoms. Lifestyle modifications for all.",summary:"ACG clinical guideline for GERD",clinical_topic:"Gastroenterology",keywords:["GERD","PPI","reflux","endoscopy"],applicable_tests:["upper GI endoscopy","pH monitoring","H pylori test"],applicable_drugs:["omeprazole","pantoprazole","esomeprazole"]},
    {title:"HIV Treatment Initiation 2024",condition:"HIV infection",source:"WHO 2024",source_organization:"World Health Organization",evidence_grade:"A",year:2024,recommendation_text:"Treat all regardless of CD4 count. Preferred: dolutegravir + TDF/FTC. Viral load monitoring. Screen for TB, hepatitis coinfection.",summary:"WHO consolidated ARV guidelines update",clinical_topic:"Infectious Disease",keywords:["HIV","ART","dolutegravir","viral load"],applicable_tests:["HIV test","viral load","CD4","HBV/HCV"],applicable_drugs:["tenofovir-emtricitabine","dolutegravir","efavirenz"]},
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

  const log: string[] = [];
  const addLog = (msg: string) => { log.push(msg); console.log(msg); };

  addLog("=== KG Expansion Batch 4-6: Emergency + Primary Care + Infectious ===");

  try {
    const diseases: DiseaseEntry[] = [
      ...getEmergencyMedicine(),
      ...getPrimaryCare(),
      ...getInfectiousDiseases(),
    ];

    addLog(`Total diseases: ${diseases.length}`);

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
      const { error } = await supabase.from("diagnoses").upsert(diagRows.slice(i, i + 100), { onConflict: "diagnosis_name", ignoreDuplicates: true });
      if (error) addLog(`  Diagnoses error: ${error.message}`);
    }

    // Fetch all diagnosis IDs
    const allDiagIds: Record<string, string> = {};
    let offset = 0;
    while (true) {
      const { data } = await supabase.from("diagnoses").select("id, diagnosis_name").range(offset, offset + 999);
      if (!data || data.length === 0) break;
      for (const r of data) allDiagIds[r.diagnosis_name] = r.id;
      offset += data.length;
      if (data.length < 1000) break;
    }
    addLog(`  Diagnosis IDs loaded: ${Object.keys(allDiagIds).length}`);

    // STEP 2: Upsert symptoms
    addLog("Step 2: Upserting symptoms...");
    const symRows = Array.from(uniqueSymptoms).map(s => ({ symptom_name: s, category: "general" }));
    for (let i = 0; i < symRows.length; i += 100) {
      const { error } = await supabase.from("symptoms").upsert(symRows.slice(i, i + 100), { onConflict: "symptom_name", ignoreDuplicates: true });
      if (error) addLog(`  Symptoms error: ${error.message}`);
    }

    // Fetch all symptom IDs
    const allSymIds: Record<string, string> = {};
    offset = 0;
    while (true) {
      const { data } = await supabase.from("symptoms").select("id, symptom_name").range(offset, offset + 999);
      if (!data || data.length === 0) break;
      for (const r of data) allSymIds[r.symptom_name] = r.id;
      offset += data.length;
      if (data.length < 1000) break;
    }

    // STEP 3: Disease priors
    addLog("Step 3: Upserting disease priors...");
    const priorRows = diseases.filter(d => allDiagIds[d.name]).map(d => ({
      diagnosis_id: allDiagIds[d.name], base_prevalence: d.prior, age_modifier: {}, sex_modifier: {}, region_modifier: {},
    }));
    for (let i = 0; i < priorRows.length; i += 100) {
      const { error } = await supabase.from("disease_priors").upsert(priorRows.slice(i, i + 100), { onConflict: "diagnosis_id", ignoreDuplicates: false });
      if (error) addLog(`  Priors error: ${error.message}`);
    }

    // STEP 4: Symptom likelihoods
    addLog("Step 4: Upserting symptom likelihoods...");
    const likRows: any[] = [];
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
      const { error } = await supabase.from("symptom_likelihoods").upsert(likRows.slice(i, i + 200), { onConflict: "symptom_id,diagnosis_id", ignoreDuplicates: false });
      if (error) addLog(`  Likelihoods error: ${error.message}`);
      else likInserted += Math.min(200, likRows.length - i);
    }
    addLog(`  Likelihoods upserted: ${likInserted}`);

    // STEP 5: Disease tests
    addLog("Step 5: Upserting disease tests...");
    const testRows = diseases.flatMap(d => d.tests.map(t => ({
      disease_name: d.name, test_name: t[0], test_category: t[1], diagnostic_strength: t[2],
    })));
    for (let i = 0; i < testRows.length; i += 200) {
      const { error } = await supabase.from("disease_tests").upsert(testRows.slice(i, i + 200), { onConflict: "disease_name,test_name", ignoreDuplicates: true });
      if (error) addLog(`  Tests error: ${error.message}`);
    }
    addLog(`  Tests upserted: ${testRows.length}`);

    // STEP 6: Disease treatments
    addLog("Step 6: Upserting treatments...");
    const txRows = diseases.flatMap(d => d.treatments.map(t => ({
      disease_name: d.name, drug_name: t[0], drug_class: t[1], line_of_treatment: t[2], guideline_source: t[3],
    })));
    for (let i = 0; i < txRows.length; i += 200) {
      const { error } = await supabase.from("disease_treatments").upsert(txRows.slice(i, i + 200), { onConflict: "disease_name,drug_name", ignoreDuplicates: true });
      if (error) addLog(`  Treatments error: ${error.message}`);
    }
    addLog(`  Treatments upserted: ${txRows.length}`);

    // STEP 7: Physiology states
    addLog("Step 7: Upserting physiology states...");
    const physStates = getPhysiologyStates();
    // Fetch anatomical system IDs
    const { data: systems } = await supabase.from("anatomical_systems").select("id, system_name");
    const systemIds: Record<string, string> = {};
    for (const s of systems || []) systemIds[s.system_name] = s.id;

    const stateRows = physStates.map(s => ({
      state_name: s.state_name, description: s.description, system_id: systemIds[s.organ_system] || systemIds["cardiovascular"] || Object.values(systemIds)[0],
    }));
    for (let i = 0; i < stateRows.length; i += 50) {
      const { error } = await supabase.from("physiological_states").upsert(stateRows.slice(i, i + 50), { onConflict: "state_name", ignoreDuplicates: true });
      if (error) addLog(`  Physiology states error: ${error.message}`);
    }
    addLog(`  Physiology states upserted: ${stateRows.length}`);

    // Fetch physiology state IDs
    const allPhysIds: Record<string, string> = {};
    offset = 0;
    while (true) {
      const { data } = await supabase.from("physiological_states").select("id, state_name").range(offset, offset + 999);
      if (!data || data.length === 0) break;
      for (const r of data) allPhysIds[r.state_name] = r.id;
      offset += data.length;
      if (data.length < 1000) break;
    }

    // STEP 8: Symptom-physiology mappings
    addLog("Step 8: Upserting symptom-physiology mappings...");
    const symPhysMappings: [string, string, number, number][] = [
      ["crushing chest pain","myocardial ischemia",0.9,0.85],
      ["chest pain radiating to left arm","coronary artery occlusion",0.85,0.8],
      ["diaphoresis","myocardial ischemia",0.5,0.6],
      ["sudden dyspnea","pulmonary vascular obstruction",0.7,0.75],
      ["pleuritic chest pain","pulmonary vascular obstruction",0.6,0.65],
      ["hemoptysis","pulmonary vascular obstruction",0.4,0.7],
      ["absent breath sounds unilateral","intrapleural pressure elevation",0.9,0.9],
      ["tracheal deviation","intrapleural pressure elevation",0.85,0.9],
      ["tearing chest pain","aortic wall dissection",0.9,0.9],
      ["chest pain radiating to back","aortic wall dissection",0.75,0.85],
      ["urticaria","systemic mast cell degranulation",0.8,0.75],
      ["angioedema","systemic mast cell degranulation",0.85,0.8],
      ["throat tightness","systemic mast cell degranulation",0.7,0.75],
      ["prolonged seizure activity","cerebral cortical seizure activity",0.95,0.95],
      ["tonic-clonic movements","cerebral cortical seizure activity",0.85,0.9],
      ["hematemesis","gastrointestinal mucosal erosion",0.85,0.8],
      ["melena","gastrointestinal mucosal erosion",0.8,0.8],
      ["hypotension refractory to fluids","systemic inflammatory response",0.8,0.85],
      ["lactic acidosis","systemic inflammatory response",0.75,0.8],
      ["sudden unilateral weakness","cerebral arterial occlusion",0.85,0.85],
      ["facial droop","cerebral arterial occlusion",0.8,0.85],
      ["speech difficulty","cerebral arterial occlusion",0.7,0.8],
      ["thunderclap headache","intracranial aneurysm rupture",0.9,0.9],
      ["neck stiffness","meningeal inflammation",0.75,0.8],
      ["Kussmaul breathing","insulin deficiency with ketogenesis",0.85,0.9],
      ["fruity breath odor","insulin deficiency with ketogenesis",0.9,0.9],
      ["right lower quadrant pain","appendiceal obstruction",0.8,0.8],
      ["periumbilical pain migrating to RLQ","appendiceal obstruction",0.85,0.9],
      ["severe epigastric pain","pancreatic autodigestion",0.8,0.8],
      ["pain radiating to back","pancreatic autodigestion",0.65,0.75],
      ["sudden severe scrotal pain","spermatic cord torsion",0.9,0.9],
      ["absent cremasteric reflex","spermatic cord torsion",0.85,0.9],
      ["right upper quadrant pain","cystic duct obstruction",0.85,0.8],
      ["Murphy sign positive","cystic duct obstruction",0.9,0.9],
      ["oliguria","renal perfusion compromise",0.7,0.7],
      ["muffled heart sounds","pericardial pressure elevation",0.85,0.9],
      ["distended neck veins","pericardial pressure elevation",0.7,0.8],
      ["pulsus paradoxus","pericardial pressure elevation",0.8,0.9],
      ["colicky abdominal pain","intestinal lumen obstruction",0.8,0.8],
      ["abdominal distension","intestinal lumen obstruction",0.75,0.75],
      ["sudden limb pain","arterial embolism",0.85,0.85],
      ["pulselessness","arterial embolism",0.9,0.9],
      ["elevated blood pressure","renin-angiotensin overactivation",0.7,0.7],
      ["polyuria","insulin resistance",0.6,0.65],
      ["polydipsia","insulin resistance",0.55,0.6],
      ["heartburn","lower esophageal sphincter incompetence",0.85,0.8],
      ["acid regurgitation","lower esophageal sphincter incompetence",0.8,0.8],
      ["joint pain","joint cartilage degeneration",0.6,0.6],
      ["joint crepitus","joint cartilage degeneration",0.7,0.75],
      ["fatigue","thyroid hormone deficiency",0.5,0.4],
      ["cold intolerance","thyroid hormone deficiency",0.65,0.7],
      ["weight gain","thyroid hormone deficiency",0.55,0.55],
      ["weight loss despite good appetite","thyroid hormone excess",0.7,0.7],
      ["heat intolerance","thyroid hormone excess",0.7,0.7],
      ["exophthalmos","thyroid hormone excess",0.5,0.9],
      ["acute joint pain first MTP","uric acid crystal deposition",0.85,0.85],
      ["joint erythema","uric acid crystal deposition",0.7,0.7],
      ["productive cough","alveolar infection consolidation",0.7,0.7],
      ["crackles on auscultation","alveolar infection consolidation",0.75,0.75],
      ["chronic cough more than 2 weeks","mycobacterial granulomatous response",0.7,0.7],
      ["night sweats","mycobacterial granulomatous response",0.6,0.65],
      ["cyclical fever","viral hemorrhagic capillaritis",0.5,0.5],
      ["retro-orbital pain","viral hemorrhagic capillaritis",0.7,0.8],
      ["jaundice","hepatocyte viral injury",0.6,0.6],
      ["dark urine","hepatocyte viral injury",0.55,0.6],
      ["unilateral dermatomal pain","varicella-zoster reactivation",0.85,0.85],
      ["vesicular rash dermatomal","varicella-zoster reactivation",0.9,0.9],
      ["urinary hesitancy","prostatic urethral compression",0.75,0.75],
      ["weak urinary stream","prostatic urethral compression",0.7,0.7],
      ["dysuria","urinary bacterial colonization",0.8,0.8],
      ["urinary frequency","urinary bacterial colonization",0.7,0.65],
      ["fatigue","peripheral iron depletion",0.5,0.4],
      ["pallor","peripheral iron depletion",0.6,0.5],
      ["koilonychia","peripheral iron depletion",0.4,0.85],
      ["sneezing","IgE-mediated allergic cascade",0.7,0.65],
      ["nasal itching","IgE-mediated allergic cascade",0.75,0.7],
      ["ear pain","eustachian tube dysfunction",0.8,0.75],
      ["facial pain or pressure","paranasal sinus obstruction",0.8,0.75],
      ["purulent nasal discharge","paranasal sinus obstruction",0.7,0.7],
      ["paresthesia","cobalamin metabolic deficiency",0.6,0.6],
      ["glossitis","cobalamin metabolic deficiency",0.5,0.65],
    ];

    const symPhysRows: any[] = [];
    for (const [sym, phys, conf, rel] of symPhysMappings) {
      const sId = allSymIds[sym];
      const pId = allPhysIds[phys];
      if (sId && pId) {
        symPhysRows.push({ symptom_id: sId, physiological_state_id: pId, confidence_score: conf });
      }
    }
    for (let i = 0; i < symPhysRows.length; i += 100) {
      const { error } = await supabase.from("symptom_physiology_map").upsert(symPhysRows.slice(i, i + 100), { onConflict: "symptom_id,physiological_state_id", ignoreDuplicates: true });
      if (error) addLog(`  Sym-phys error: ${error.message}`);
    }
    addLog(`  Symptom-physiology mappings: ${symPhysRows.length}`);

    // STEP 9: Physiology-diagnosis mappings
    addLog("Step 9: Upserting physiology-diagnosis mappings...");
    const physDiagMappings: [string, string, number, number][] = [
      ["myocardial ischemia","acute myocardial infarction",0.9,0.9],
      ["coronary artery occlusion","acute myocardial infarction",0.95,0.95],
      ["pulmonary vascular obstruction","pulmonary embolism",0.9,0.9],
      ["ventilation-perfusion mismatch","pulmonary embolism",0.7,0.75],
      ["intrapleural pressure elevation","tension pneumothorax",0.95,0.95],
      ["aortic wall dissection","aortic dissection",0.95,0.95],
      ["systemic mast cell degranulation","anaphylaxis",0.9,0.9],
      ["cerebral cortical seizure activity","status epilepticus",0.9,0.9],
      ["gastrointestinal mucosal erosion","acute upper GI bleeding",0.85,0.85],
      ["systemic inflammatory response","septic shock",0.85,0.85],
      ["cerebral arterial occlusion","acute stroke ischemic",0.9,0.9],
      ["intracranial aneurysm rupture","subarachnoid hemorrhage",0.95,0.95],
      ["insulin deficiency with ketogenesis","diabetic ketoacidosis",0.95,0.95],
      ["meningeal inflammation","meningitis bacterial",0.9,0.9],
      ["appendiceal obstruction","acute appendicitis",0.9,0.9],
      ["ectopic implantation","ectopic pregnancy",0.95,0.95],
      ["pancreatic autodigestion","acute pancreatitis",0.9,0.9],
      ["spermatic cord torsion","testicular torsion",0.95,0.95],
      ["cystic duct obstruction","acute cholecystitis",0.9,0.9],
      ["renal perfusion compromise","acute kidney injury",0.8,0.8],
      ["pericardial pressure elevation","cardiac tamponade",0.95,0.95],
      ["intestinal lumen obstruction","bowel obstruction",0.9,0.9],
      ["arterial embolism","acute limb ischemia",0.9,0.9],
      ["renin-angiotensin overactivation","essential hypertension",0.7,0.7],
      ["insulin resistance","type 2 diabetes mellitus",0.8,0.8],
      ["lower esophageal sphincter incompetence","gastroesophageal reflux disease",0.85,0.85],
      ["joint cartilage degeneration","osteoarthritis",0.85,0.85],
      ["thyroid hormone deficiency","hypothyroidism",0.9,0.9],
      ["thyroid hormone excess","hyperthyroidism",0.9,0.9],
      ["uric acid crystal deposition","gout",0.9,0.9],
      ["alveolar infection consolidation","community-acquired pneumonia",0.85,0.85],
      ["mycobacterial granulomatous response","tuberculosis pulmonary",0.9,0.9],
      ["viral hemorrhagic capillaritis","dengue fever",0.8,0.8],
      ["hepatocyte viral injury","hepatitis B acute",0.8,0.8],
      ["varicella-zoster reactivation","herpes zoster",0.9,0.9],
      ["prostatic urethral compression","benign prostatic hyperplasia",0.85,0.85],
      ["mucosal immune deficiency","HIV infection",0.7,0.7],
      ["bacterial skin invasion","cellulitis",0.85,0.85],
      ["paranasal sinus obstruction","acute sinusitis",0.8,0.8],
      ["peripheral iron depletion","iron deficiency anemia",0.9,0.9],
      ["IgE-mediated allergic cascade","allergic rhinitis",0.8,0.8],
      ["eustachian tube dysfunction","acute otitis media",0.8,0.8],
      ["urinary bacterial colonization","urinary tract infection",0.85,0.85],
      ["cobalamin metabolic deficiency","vitamin B12 deficiency",0.9,0.9],
    ];

    const physDiagRows: any[] = [];
    for (const [phys, diag, conf, rel] of physDiagMappings) {
      const pId = allPhysIds[phys];
      const dId = allDiagIds[diag];
      if (pId && dId) {
        physDiagRows.push({ physiological_state_id: pId, diagnosis_id: dId, confidence_score: conf, relevance_score: rel });
      }
    }
    for (let i = 0; i < physDiagRows.length; i += 100) {
      const { error } = await supabase.from("physiology_diagnosis_map").upsert(physDiagRows.slice(i, i + 100), { onConflict: "physiological_state_id,diagnosis_id", ignoreDuplicates: true });
      if (error) addLog(`  Phys-diag error: ${error.message}`);
    }
    addLog(`  Physiology-diagnosis mappings: ${physDiagRows.length}`);

    // STEP 10: Dangerous diagnoses
    addLog("Step 10: Upserting dangerous diagnoses...");
    const dangerData = getDangerousDiagnoses();
    let dangerInserted = 0;
    for (const dd of dangerData) {
      const diagId = allDiagIds[dd.disease];
      if (!diagId) { addLog(`  SKIP danger: ${dd.disease}`); continue; }
      const { error } = await supabase.from("dangerous_diagnoses").upsert({
        trigger_symptom: dd.trigger, diagnosis_id: diagId, diagnosis_name: dd.disease,
        severity_level: dd.severity, must_not_miss: true, priority: dd.priority,
        emergency_protocol: dd.protocol, guideline_source: dd.source,
      }, { onConflict: "trigger_symptom,diagnosis_id", ignoreDuplicates: true });
      if (error) addLog(`  Danger error: ${error.message}`);
      else dangerInserted++;
    }
    addLog(`  Dangerous diagnoses: ${dangerInserted}`);

    // STEP 11: Clinical guidelines
    addLog("Step 11: Upserting guidelines...");
    const guidelines = getGuidelines();
    for (let i = 0; i < guidelines.length; i += 50) {
      const { error } = await supabase.from("clinical_guidelines").upsert(guidelines.slice(i, i + 50), { onConflict: "title", ignoreDuplicates: true });
      if (error) addLog(`  Guidelines error: ${error.message}`);
    }
    addLog(`  Guidelines upserted: ${guidelines.length}`);

    // VALIDATION
    addLog("=== VALIDATION ===");
    const counts: Record<string, number> = {};
    for (const table of ["diagnoses","symptoms","symptom_likelihoods","physiological_states","symptom_physiology_map","physiology_diagnosis_map","dangerous_diagnoses","clinical_guidelines","disease_tests","disease_treatments"]) {
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
