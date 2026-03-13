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
// CARDIOLOGY (25 diseases)
// ══════════════════════════════════════════════════
function getCardiologyDiseases(): DiseaseEntry[] {
  return [
    {name:"acute myocardial infarction",icd10:"I21.9",organ:"cardiovascular",prior:0.02,severity:"critical",
      symptoms:[["chest pain",0.90,0.85,"high"],["chest tightness",0.80,0.8,"high"],["shortness of breath",0.65,0.6,"moderate"],["diaphoresis",0.60,0.7,"high"],["nausea",0.45,0.4,"moderate"],["jaw pain",0.35,0.6,"moderate"],["left arm pain",0.50,0.7,"high"],["palpitations",0.30,0.3,"moderate"],["dizziness",0.35,0.35,"moderate"],["fatigue",0.40,0.3,"moderate"]],
      tests:[["troponin",  "biomarker","high"],["ECG","cardiac","high"],["chest X-ray","imaging","moderate"],["echocardiogram","cardiac","high"],["coronary angiography","invasive","high"],["BNP","biomarker","moderate"]],
      treatments:[["aspirin","antiplatelet","first_line","AHA"],["clopidogrel","antiplatelet","first_line","ESC"],["heparin","anticoagulant","first_line","AHA"],["metoprolol","beta-blocker","first_line","ESC"],["atorvastatin","statin","first_line","AHA"]]},
    {name:"unstable angina",icd10:"I20.0",organ:"cardiovascular",prior:0.015,severity:"high",
      symptoms:[["chest pain at rest",0.88,0.85,"high"],["chest tightness",0.75,0.7,"high"],["shortness of breath",0.55,0.5,"moderate"],["diaphoresis",0.50,0.6,"moderate"],["nausea",0.35,0.35,"moderate"],["jaw pain",0.30,0.55,"moderate"],["left arm pain",0.40,0.6,"moderate"]],
      tests:[["troponin","biomarker","high"],["ECG","cardiac","high"],["stress test","cardiac","moderate"],["coronary angiography","invasive","high"]],
      treatments:[["aspirin","antiplatelet","first_line","AHA"],["nitroglycerin","nitrate","first_line","AHA"],["heparin","anticoagulant","first_line","ESC"],["metoprolol","beta-blocker","first_line","ESC"]]},
    {name:"congestive heart failure",icd10:"I50.9",organ:"cardiovascular",prior:0.025,severity:"high",
      symptoms:[["shortness of breath",0.90,0.85,"high"],["orthopnea",0.75,0.8,"high"],["paroxysmal nocturnal dyspnea",0.60,0.8,"high"],["peripheral edema",0.80,0.75,"high"],["fatigue",0.75,0.6,"high"],["weight gain",0.55,0.5,"moderate"],["jugular venous distension",0.50,0.8,"high"],["exercise intolerance",0.70,0.6,"high"],["cough",0.40,0.35,"moderate"],["nocturia",0.45,0.4,"moderate"]],
      tests:[["BNP","biomarker","high"],["echocardiogram","cardiac","high"],["chest X-ray","imaging","high"],["ECG","cardiac","moderate"],["renal function","biochemistry","moderate"]],
      treatments:[["furosemide","diuretic","first_line","ESC"],["sacubitril-valsartan","ARNI","first_line","ESC"],["carvedilol","beta-blocker","first_line","ESC"],["spironolactone","MRA","first_line","ESC"],["dapagliflozin","SGLT2i","first_line","ESC"]]},
    {name:"atrial fibrillation",icd10:"I48.91",organ:"cardiovascular",prior:0.03,severity:"moderate",
      symptoms:[["palpitations",0.85,0.8,"high"],["irregular heartbeat",0.90,0.9,"high"],["shortness of breath",0.55,0.5,"moderate"],["fatigue",0.60,0.5,"moderate"],["dizziness",0.45,0.4,"moderate"],["chest discomfort",0.40,0.4,"moderate"],["exercise intolerance",0.45,0.4,"moderate"],["syncope",0.20,0.5,"moderate"]],
      tests:[["ECG","cardiac","high"],["echocardiogram","cardiac","high"],["thyroid function tests","endocrine","moderate"],["Holter monitor","cardiac","moderate"],["coagulation studies","hematology","moderate"]],
      treatments:[["apixaban","anticoagulant","first_line","ESC"],["rivaroxaban","anticoagulant","first_line","ESC"],["metoprolol","beta-blocker","rate_control","ESC"],["amiodarone","antiarrhythmic","rhythm_control","ESC"],["digoxin","cardiac glycoside","second_line","ESC"]]},
    {name:"aortic dissection",icd10:"I71.0",organ:"cardiovascular",prior:0.002,severity:"critical",
      symptoms:[["tearing chest pain",0.90,0.95,"high"],["back pain sudden onset",0.75,0.8,"high"],["hypertension",0.60,0.6,"moderate"],["pulse deficit",0.45,0.85,"high"],["diaphoresis",0.55,0.6,"moderate"],["syncope",0.30,0.6,"moderate"],["neurological deficit",0.25,0.7,"high"],["shortness of breath",0.40,0.4,"moderate"]],
      tests:[["CT angiogram chest","imaging","high"],["D-dimer","biomarker","moderate"],["echocardiogram","cardiac","moderate"],["chest X-ray","imaging","moderate"],["blood pressure both arms","physical","high"]],
      treatments:[["labetalol","beta-blocker","first_line","ESC"],["esmolol","beta-blocker","first_line","AHA"],["nicardipine","calcium channel blocker","first_line","ESC"]]},
    {name:"pulmonary embolism",icd10:"I26.99",organ:"cardiovascular",prior:0.01,severity:"critical",
      symptoms:[["sudden shortness of breath",0.85,0.85,"high"],["pleuritic chest pain",0.65,0.7,"high"],["tachycardia",0.70,0.65,"high"],["hemoptysis",0.30,0.7,"high"],["leg swelling unilateral",0.45,0.6,"moderate"],["calf pain",0.40,0.5,"moderate"],["syncope",0.25,0.6,"moderate"],["hypoxia",0.60,0.7,"high"],["diaphoresis",0.35,0.4,"moderate"]],
      tests:[["CTPA","imaging","high"],["D-dimer","biomarker","high"],["ECG","cardiac","moderate"],["troponin","biomarker","moderate"],["lower extremity duplex ultrasound","imaging","moderate"],["ABG","biochemistry","moderate"]],
      treatments:[["heparin","anticoagulant","first_line","ESC"],["rivaroxaban","anticoagulant","first_line","ESC"],["apixaban","anticoagulant","first_line","ESC"],["alteplase","thrombolytic","massive_PE","ESC"]]},
    {name:"hypertensive crisis",icd10:"I16.9",organ:"cardiovascular",prior:0.008,severity:"critical",
      symptoms:[["severe headache",0.75,0.7,"high"],["blurred vision",0.55,0.6,"moderate"],["chest pain",0.50,0.5,"moderate"],["shortness of breath",0.45,0.5,"moderate"],["nausea",0.40,0.4,"moderate"],["nosebleed",0.30,0.4,"moderate"],["confusion",0.35,0.6,"moderate"],["anxiety",0.40,0.3,"moderate"]],
      tests:[["blood pressure","physical","high"],["renal function","biochemistry","high"],["ECG","cardiac","high"],["urinalysis","microbiology","moderate"],["fundoscopy","ophthalmology","moderate"]],
      treatments:[["nicardipine","calcium channel blocker","first_line","AHA"],["labetalol","beta-blocker","first_line","ESC"],["nitroprusside","vasodilator","second_line","AHA"]]},
    {name:"infective endocarditis",icd10:"I33.0",organ:"cardiovascular",prior:0.003,severity:"critical",
      symptoms:[["fever",0.90,0.8,"high"],["new heart murmur",0.70,0.85,"high"],["fatigue",0.65,0.5,"moderate"],["night sweats",0.50,0.5,"moderate"],["weight loss",0.45,0.5,"moderate"],["petechiae",0.35,0.6,"moderate"],["splinter hemorrhages",0.25,0.75,"high"],["janeway lesions",0.15,0.9,"high"],["osler nodes",0.15,0.85,"high"],["splenomegaly",0.30,0.5,"moderate"]],
      tests:[["blood culture x3","microbiology","high"],["echocardiogram transesophageal","cardiac","high"],["CBC","hematology","moderate"],["ESR CRP","inflammatory","moderate"],["urinalysis","microbiology","moderate"]],
      treatments:[["vancomycin","glycopeptide","first_line","AHA"],["gentamicin","aminoglycoside","first_line","ESC"],["ceftriaxone","cephalosporin","first_line","ESC"]]},
    {name:"pericarditis",icd10:"I30.9",organ:"cardiovascular",prior:0.008,severity:"moderate",
      symptoms:[["sharp chest pain",0.90,0.85,"high"],["chest pain worse lying down",0.75,0.8,"high"],["chest pain relieved sitting forward",0.70,0.85,"high"],["pericardial friction rub",0.55,0.9,"high"],["fever",0.50,0.5,"moderate"],["shortness of breath",0.40,0.4,"moderate"],["fatigue",0.35,0.3,"moderate"]],
      tests:[["ECG","cardiac","high"],["echocardiogram","cardiac","high"],["troponin","biomarker","moderate"],["CRP ESR","inflammatory","high"],["chest X-ray","imaging","moderate"]],
      treatments:[["ibuprofen","NSAID","first_line","ESC"],["colchicine","anti-inflammatory","first_line","ESC"],["aspirin","NSAID","first_line","ESC"]]},
    {name:"deep vein thrombosis",icd10:"I82.40",organ:"cardiovascular",prior:0.015,severity:"moderate",
      symptoms:[["leg swelling unilateral",0.85,0.85,"high"],["calf pain",0.75,0.7,"high"],["leg warmth",0.60,0.6,"moderate"],["leg redness",0.55,0.55,"moderate"],["leg tenderness",0.65,0.6,"moderate"],["distended superficial veins",0.40,0.5,"moderate"],["Homans sign positive",0.35,0.5,"moderate"]],
      tests:[["lower extremity duplex ultrasound","imaging","high"],["D-dimer","biomarker","high"],["coagulation studies","hematology","moderate"]],
      treatments:[["rivaroxaban","anticoagulant","first_line","ACCP"],["apixaban","anticoagulant","first_line","ACCP"],["heparin","anticoagulant","first_line","ACCP"],["warfarin","anticoagulant","second_line","ACCP"]]},
    {name:"stable angina",icd10:"I20.9",organ:"cardiovascular",prior:0.03,severity:"moderate",
      symptoms:[["exertional chest pain",0.90,0.9,"high"],["chest tightness",0.75,0.7,"high"],["shortness of breath on exertion",0.60,0.55,"moderate"],["pain relieved by rest",0.80,0.8,"high"],["jaw pain",0.30,0.5,"moderate"],["left arm pain",0.35,0.55,"moderate"]],
      tests:[["ECG","cardiac","moderate"],["stress test","cardiac","high"],["coronary CT angiography","imaging","high"],["lipid panel","biochemistry","moderate"]],
      treatments:[["aspirin","antiplatelet","first_line","AHA"],["atorvastatin","statin","first_line","AHA"],["metoprolol","beta-blocker","first_line","ESC"],["nitroglycerin","nitrate","PRN","AHA"],["amlodipine","calcium channel blocker","second_line","ESC"]]},
    {name:"mitral valve prolapse",icd10:"I34.1",organ:"cardiovascular",prior:0.025,severity:"low",
      symptoms:[["palpitations",0.60,0.5,"moderate"],["mid-systolic click",0.50,0.85,"high"],["chest pain atypical",0.40,0.4,"moderate"],["fatigue",0.35,0.3,"moderate"],["dizziness",0.30,0.3,"moderate"],["anxiety",0.30,0.3,"moderate"]],
      tests:[["echocardiogram","cardiac","high"],["ECG","cardiac","moderate"],["Holter monitor","cardiac","moderate"]],
      treatments:[["metoprolol","beta-blocker","symptomatic","AHA"],["aspirin","antiplatelet","if_indicated","AHA"]]},
    {name:"aortic stenosis",icd10:"I35.0",organ:"cardiovascular",prior:0.015,severity:"high",
      symptoms:[["exertional dyspnea",0.80,0.75,"high"],["angina",0.55,0.6,"moderate"],["syncope",0.45,0.7,"high"],["systolic ejection murmur",0.85,0.9,"high"],["fatigue",0.50,0.45,"moderate"],["heart failure symptoms",0.40,0.6,"moderate"]],
      tests:[["echocardiogram","cardiac","high"],["ECG","cardiac","moderate"],["cardiac catheterization","invasive","moderate"],["BNP","biomarker","moderate"]],
      treatments:[["surgical aortic valve replacement","surgical","definitive","AHA"],["TAVR","interventional","first_line","ESC"]]},
    {name:"peripheral artery disease",icd10:"I73.9",organ:"cardiovascular",prior:0.02,severity:"moderate",
      symptoms:[["intermittent claudication",0.85,0.9,"high"],["leg pain on walking",0.80,0.8,"high"],["cold extremities",0.55,0.5,"moderate"],["weak peripheral pulses",0.65,0.7,"high"],["hair loss on legs",0.40,0.5,"moderate"],["non-healing leg ulcers",0.35,0.7,"high"],["erectile dysfunction",0.30,0.4,"moderate"],["numbness in feet",0.40,0.4,"moderate"]],
      tests:[["ankle-brachial index","vascular","high"],["duplex ultrasound","imaging","high"],["CT angiography","imaging","moderate"],["lipid panel","biochemistry","moderate"],["HbA1c","biochemistry","moderate"]],
      treatments:[["cilostazol","phosphodiesterase inhibitor","first_line","AHA"],["aspirin","antiplatelet","first_line","AHA"],["atorvastatin","statin","first_line","AHA"],["ramipril","ACE inhibitor","adjunct","ESC"]]},
    {name:"supraventricular tachycardia",icd10:"I47.1",organ:"cardiovascular",prior:0.015,severity:"moderate",
      symptoms:[["palpitations",0.92,0.85,"high"],["rapid heartbeat",0.90,0.85,"high"],["dizziness",0.55,0.5,"moderate"],["chest discomfort",0.45,0.4,"moderate"],["shortness of breath",0.50,0.45,"moderate"],["anxiety",0.45,0.35,"moderate"],["syncope",0.20,0.5,"moderate"]],
      tests:[["ECG","cardiac","high"],["Holter monitor","cardiac","moderate"],["electrophysiology study","cardiac","high"]],
      treatments:[["adenosine","antiarrhythmic","first_line","AHA"],["verapamil","calcium channel blocker","first_line","ESC"],["metoprolol","beta-blocker","first_line","ESC"],["catheter ablation","interventional","definitive","AHA"]]},
  ];
}

// ══════════════════════════════════════════════════
// PULMONOLOGY (20 diseases)
// ══════════════════════════════════════════════════
function getPulmonologyDiseases(): DiseaseEntry[] {
  return [
    {name:"asthma",icd10:"J45.909",organ:"respiratory",prior:0.08,severity:"moderate",
      symptoms:[["wheezing",0.85,0.85,"high"],["shortness of breath",0.80,0.7,"high"],["cough",0.75,0.6,"moderate"],["chest tightness",0.70,0.65,"high"],["nocturnal cough",0.55,0.6,"moderate"],["exercise-induced symptoms",0.60,0.6,"moderate"],["dyspnea",0.65,0.55,"moderate"]],
      tests:[["spirometry","pulmonary","high"],["peak flow measurement","pulmonary","high"],["FeNO","pulmonary","moderate"],["chest X-ray","imaging","low"],["allergy testing","immunology","moderate"]],
      treatments:[["salbutamol","SABA","rescue","GINA"],["fluticasone","ICS","first_line","GINA"],["budesonide-formoterol","ICS-LABA","first_line","GINA"],["montelukast","LTRA","adjunct","GINA"],["omalizumab","anti-IgE","severe","GINA"]]},
    {name:"chronic obstructive pulmonary disease",icd10:"J44.9",organ:"respiratory",prior:0.05,severity:"high",
      symptoms:[["chronic cough",0.80,0.7,"high"],["sputum production",0.75,0.7,"high"],["progressive dyspnea",0.85,0.8,"high"],["wheezing",0.60,0.55,"moderate"],["barrel chest",0.35,0.7,"high"],["pursed lip breathing",0.30,0.7,"high"],["exercise intolerance",0.70,0.6,"high"],["weight loss",0.35,0.4,"moderate"],["cyanosis",0.25,0.6,"moderate"]],
      tests:[["spirometry","pulmonary","high"],["chest X-ray","imaging","moderate"],["ABG","biochemistry","moderate"],["CT chest","imaging","moderate"],["alpha-1 antitrypsin","biochemistry","moderate"]],
      treatments:[["tiotropium","LAMA","first_line","GOLD"],["salmeterol-fluticasone","ICS-LABA","first_line","GOLD"],["ipratropium","SAMA","rescue","GOLD"],["roflumilast","PDE4 inhibitor","adjunct","GOLD"],["azithromycin","macrolide","prevention","GOLD"]]},
    {name:"community-acquired pneumonia",icd10:"J18.9",organ:"respiratory",prior:0.04,severity:"high",
      symptoms:[["cough",0.90,0.75,"high"],["fever",0.85,0.75,"high"],["dyspnea",0.65,0.6,"moderate"],["pleuritic chest pain",0.55,0.6,"moderate"],["sputum production",0.70,0.6,"high"],["chills",0.55,0.55,"moderate"],["crackles on auscultation",0.70,0.75,"high"],["tachypnea",0.55,0.6,"moderate"],["fatigue",0.60,0.45,"moderate"]],
      tests:[["chest X-ray","imaging","high"],["CBC","hematology","moderate"],["blood culture","microbiology","moderate"],["sputum culture","microbiology","moderate"],["procalcitonin","biomarker","moderate"],["CRP","inflammatory","moderate"]],
      treatments:[["amoxicillin","penicillin","first_line","IDSA"],["azithromycin","macrolide","first_line","IDSA"],["levofloxacin","fluoroquinolone","second_line","IDSA"],["ceftriaxone","cephalosporin","inpatient","IDSA"]]},
    {name:"pneumothorax",icd10:"J93.9",organ:"respiratory",prior:0.005,severity:"critical",
      symptoms:[["sudden chest pain",0.90,0.85,"high"],["sudden shortness of breath",0.85,0.85,"high"],["decreased breath sounds unilateral",0.75,0.9,"high"],["tachycardia",0.55,0.5,"moderate"],["tracheal deviation",0.30,0.9,"high"],["subcutaneous emphysema",0.25,0.85,"high"],["hypoxia",0.50,0.6,"moderate"]],
      tests:[["chest X-ray","imaging","high"],["CT chest","imaging","high"],["ABG","biochemistry","moderate"]],
      treatments:[["needle decompression","procedural","emergency","ATLS"],["chest tube insertion","procedural","first_line","BTS"],["observation","conservative","small_pneumothorax","BTS"]]},
    {name:"pleural effusion",icd10:"J90",organ:"respiratory",prior:0.02,severity:"moderate",
      symptoms:[["dyspnea",0.80,0.7,"high"],["pleuritic chest pain",0.60,0.55,"moderate"],["decreased breath sounds",0.70,0.7,"high"],["dullness to percussion",0.75,0.8,"high"],["cough",0.50,0.4,"moderate"],["fever",0.35,0.4,"moderate"],["orthopnea",0.40,0.5,"moderate"]],
      tests:[["chest X-ray","imaging","high"],["chest ultrasound","imaging","high"],["thoracentesis","invasive","high"],["pleural fluid analysis","biochemistry","high"],["CT chest","imaging","moderate"]],
      treatments:[["thoracentesis","procedural","first_line","BTS"],["chest tube","procedural","large_effusion","BTS"],["diuretics","if_transudative","adjunct","BTS"]]},
    {name:"pulmonary fibrosis",icd10:"J84.10",organ:"respiratory",prior:0.005,severity:"high",
      symptoms:[["progressive dyspnea",0.90,0.85,"high"],["dry cough",0.75,0.7,"high"],["velcro crackles",0.65,0.85,"high"],["finger clubbing",0.45,0.75,"high"],["fatigue",0.60,0.5,"moderate"],["weight loss",0.35,0.4,"moderate"],["exercise intolerance",0.70,0.6,"high"]],
      tests:[["HRCT chest","imaging","high"],["spirometry","pulmonary","high"],["DLCO","pulmonary","high"],["6-minute walk test","functional","moderate"],["lung biopsy","pathology","moderate"]],
      treatments:[["pirfenidone","antifibrotic","first_line","ATS"],["nintedanib","antifibrotic","first_line","ATS"],["oxygen therapy","supportive","adjunct","ATS"]]},
    {name:"tuberculosis",icd10:"A15.9",organ:"respiratory",prior:0.02,severity:"high",
      symptoms:[["chronic cough",0.85,0.75,"high"],["hemoptysis",0.45,0.75,"high"],["night sweats",0.70,0.7,"high"],["weight loss",0.75,0.7,"high"],["fever low grade",0.65,0.6,"moderate"],["fatigue",0.60,0.5,"moderate"],["loss of appetite",0.55,0.5,"moderate"],["chest pain",0.35,0.4,"moderate"]],
      tests:[["sputum AFB smear","microbiology","high"],["sputum culture","microbiology","high"],["GeneXpert MTB/RIF","molecular","high"],["chest X-ray","imaging","high"],["tuberculin skin test","immunology","moderate"],["IGRA","immunology","moderate"]],
      treatments:[["isoniazid","antimycobacterial","first_line","WHO"],["rifampicin","antimycobacterial","first_line","WHO"],["pyrazinamide","antimycobacterial","first_line","WHO"],["ethambutol","antimycobacterial","first_line","WHO"]]},
    {name:"acute respiratory distress syndrome",icd10:"J80",organ:"respiratory",prior:0.003,severity:"critical",
      symptoms:[["severe dyspnea",0.92,0.9,"high"],["hypoxia refractory",0.85,0.9,"high"],["tachypnea",0.80,0.75,"high"],["bilateral crackles",0.70,0.7,"high"],["cyanosis",0.55,0.7,"high"],["accessory muscle use",0.65,0.6,"moderate"],["altered consciousness",0.40,0.5,"moderate"]],
      tests:[["ABG","biochemistry","high"],["chest X-ray","imaging","high"],["CT chest","imaging","moderate"],["echocardiogram","cardiac","moderate"],["procalcitonin","biomarker","moderate"]],
      treatments:[["lung protective ventilation","mechanical","first_line","ARDS Network"],["prone positioning","positioning","first_line","PROSEVA"],["neuromuscular blockade","paralytic","adjunct","ACURASYS"],["dexamethasone","corticosteroid","adjunct","DEXA-ARDS"]]},
    {name:"obstructive sleep apnea",icd10:"G47.33",organ:"respiratory",prior:0.06,severity:"moderate",
      symptoms:[["snoring",0.90,0.8,"high"],["witnessed apneas",0.80,0.9,"high"],["daytime sleepiness",0.85,0.8,"high"],["morning headache",0.45,0.5,"moderate"],["unrefreshing sleep",0.70,0.65,"high"],["nocturia",0.40,0.4,"moderate"],["difficulty concentrating",0.50,0.45,"moderate"],["irritability",0.40,0.35,"moderate"]],
      tests:[["polysomnography","sleep study","high"],["Epworth sleepiness scale","screening","moderate"],["home sleep test","sleep study","moderate"],["BMI","anthropometry","moderate"]],
      treatments:[["CPAP","device","first_line","AASM"],["mandibular advancement device","device","second_line","AASM"],["weight loss","lifestyle","adjunct","AASM"]]},
    {name:"lung abscess",icd10:"J85.2",organ:"respiratory",prior:0.003,severity:"high",
      symptoms:[["cough",0.85,0.7,"high"],["foul-smelling sputum",0.70,0.8,"high"],["fever",0.80,0.7,"high"],["weight loss",0.55,0.5,"moderate"],["night sweats",0.50,0.5,"moderate"],["hemoptysis",0.35,0.6,"moderate"],["pleuritic chest pain",0.40,0.45,"moderate"]],
      tests:[["chest X-ray","imaging","high"],["CT chest","imaging","high"],["sputum culture","microbiology","high"],["CBC","hematology","moderate"],["blood culture","microbiology","moderate"]],
      treatments:[["clindamycin","lincosamide","first_line","IDSA"],["amoxicillin-clavulanate","penicillin","first_line","IDSA"],["metronidazole","nitroimidazole","adjunct","IDSA"]]},
    {name:"bronchiectasis",icd10:"J47.9",organ:"respiratory",prior:0.01,severity:"moderate",
      symptoms:[["chronic productive cough",0.90,0.85,"high"],["large volume sputum",0.80,0.8,"high"],["hemoptysis",0.40,0.6,"moderate"],["recurrent respiratory infections",0.70,0.7,"high"],["dyspnea",0.55,0.5,"moderate"],["wheezing",0.40,0.4,"moderate"],["fatigue",0.45,0.4,"moderate"]],
      tests:[["HRCT chest","imaging","high"],["sputum culture","microbiology","high"],["spirometry","pulmonary","moderate"],["immunoglobulin levels","immunology","moderate"]],
      treatments:[["azithromycin","macrolide","first_line","BTS"],["airway clearance techniques","physiotherapy","first_line","BTS"],["inhaled tobramycin","aminoglycoside","adjunct","ERS"]]},
    {name:"sarcoidosis",icd10:"D86.9",organ:"respiratory",prior:0.005,severity:"moderate",
      symptoms:[["cough",0.60,0.5,"moderate"],["dyspnea",0.55,0.5,"moderate"],["fatigue",0.70,0.55,"moderate"],["erythema nodosum",0.35,0.7,"high"],["bilateral hilar lymphadenopathy",0.65,0.85,"high"],["eye pain",0.25,0.5,"moderate"],["joint pain",0.35,0.4,"moderate"],["skin lesions",0.30,0.5,"moderate"]],
      tests:[["chest X-ray","imaging","high"],["CT chest","imaging","high"],["ACE level","biomarker","moderate"],["calcium level","biochemistry","moderate"],["pulmonary function tests","pulmonary","moderate"],["tissue biopsy","pathology","high"]],
      treatments:[["prednisone","corticosteroid","first_line","ATS"],["methotrexate","immunosuppressant","second_line","ATS"],["azathioprine","immunosuppressant","second_line","ATS"]]},
  ];
}

// ══════════════════════════════════════════════════
// GASTROENTEROLOGY (20 diseases)
// ══════════════════════════════════════════════════
function getGastroenterologyDiseases(): DiseaseEntry[] {
  return [
    {name:"gastroesophageal reflux disease",icd10:"K21.0",organ:"gastrointestinal",prior:0.15,severity:"low",
      symptoms:[["heartburn",0.90,0.85,"high"],["acid regurgitation",0.80,0.8,"high"],["dysphagia",0.35,0.5,"moderate"],["chest pain non-cardiac",0.40,0.4,"moderate"],["chronic cough",0.30,0.35,"moderate"],["hoarseness",0.25,0.35,"moderate"],["nausea",0.35,0.3,"moderate"],["epigastric pain",0.45,0.4,"moderate"]],
      tests:[["upper endoscopy","invasive","moderate"],["pH monitoring","functional","high"],["barium swallow","imaging","low"]],
      treatments:[["omeprazole","PPI","first_line","ACG"],["esomeprazole","PPI","first_line","ACG"],["ranitidine","H2RA","second_line","ACG"],["antacids","neutralizer","symptomatic","ACG"]]},
    {name:"peptic ulcer disease",icd10:"K27.9",organ:"gastrointestinal",prior:0.04,severity:"moderate",
      symptoms:[["epigastric pain",0.85,0.8,"high"],["burning stomach pain",0.80,0.8,"high"],["pain worse on empty stomach",0.70,0.7,"high"],["nausea",0.55,0.5,"moderate"],["bloating",0.45,0.4,"moderate"],["early satiety",0.40,0.4,"moderate"],["vomiting",0.35,0.4,"moderate"],["hematemesis",0.20,0.8,"high"],["melena",0.25,0.8,"high"]],
      tests:[["upper endoscopy","invasive","high"],["H. pylori breath test","microbiology","high"],["H. pylori stool antigen","microbiology","high"],["CBC","hematology","moderate"]],
      treatments:[["omeprazole","PPI","first_line","ACG"],["amoxicillin","penicillin","H_pylori_eradication","ACG"],["clarithromycin","macrolide","H_pylori_eradication","ACG"],["bismuth subsalicylate","protectant","adjunct","ACG"]]},
    {name:"acute pancreatitis",icd10:"K85.9",organ:"gastrointestinal",prior:0.008,severity:"critical",
      symptoms:[["severe epigastric pain",0.92,0.9,"high"],["pain radiating to back",0.75,0.8,"high"],["nausea",0.80,0.7,"high"],["vomiting",0.75,0.7,"high"],["abdominal tenderness",0.70,0.65,"high"],["fever",0.45,0.5,"moderate"],["tachycardia",0.50,0.5,"moderate"],["abdominal distension",0.40,0.45,"moderate"]],
      tests:[["lipase","biochemistry","high"],["amylase","biochemistry","high"],["CT abdomen","imaging","high"],["abdominal ultrasound","imaging","moderate"],["CBC","hematology","moderate"],["CRP","inflammatory","moderate"],["LFT","biochemistry","moderate"]],
      treatments:[["IV fluids","supportive","first_line","AGA"],["pain management","analgesic","first_line","AGA"],["NPO then early feeding","nutritional","first_line","AGA"]]},
    {name:"acute cholecystitis",icd10:"K81.0",organ:"gastrointestinal",prior:0.02,severity:"moderate",
      symptoms:[["right upper quadrant pain",0.90,0.85,"high"],["Murphy sign positive",0.70,0.85,"high"],["nausea",0.75,0.65,"high"],["vomiting",0.60,0.55,"moderate"],["fever",0.65,0.6,"moderate"],["pain after fatty meals",0.55,0.6,"moderate"],["right shoulder pain",0.35,0.5,"moderate"]],
      tests:[["abdominal ultrasound","imaging","high"],["HIDA scan","nuclear","high"],["CBC","hematology","moderate"],["LFT","biochemistry","moderate"],["CRP","inflammatory","moderate"]],
      treatments:[["laparoscopic cholecystectomy","surgical","first_line","SAGES"],["IV antibiotics","antimicrobial","first_line","TG18"],["percutaneous cholecystostomy","interventional","high_risk_patients","TG18"]]},
    {name:"choledocholithiasis",icd10:"K80.5",organ:"gastrointestinal",prior:0.01,severity:"high",
      symptoms:[["right upper quadrant pain",0.80,0.75,"high"],["jaundice",0.70,0.8,"high"],["dark urine",0.55,0.6,"moderate"],["pale stools",0.50,0.65,"moderate"],["nausea",0.55,0.5,"moderate"],["pruritus",0.40,0.5,"moderate"],["fever",0.35,0.5,"moderate"]],
      tests:[["LFT","biochemistry","high"],["abdominal ultrasound","imaging","high"],["MRCP","imaging","high"],["ERCP","invasive","high"],["CBC","hematology","moderate"]],
      treatments:[["ERCP with stone extraction","interventional","first_line","ASGE"],["cholecystectomy","surgical","definitive","SAGES"]]},
    {name:"inflammatory bowel disease crohn",icd10:"K50.9",organ:"gastrointestinal",prior:0.005,severity:"high",
      symptoms:[["chronic diarrhea",0.80,0.75,"high"],["abdominal pain",0.85,0.75,"high"],["weight loss",0.65,0.6,"moderate"],["fatigue",0.60,0.5,"moderate"],["perianal disease",0.40,0.7,"high"],["bloody stool",0.45,0.6,"moderate"],["fever",0.35,0.4,"moderate"],["mouth ulcers",0.30,0.5,"moderate"],["joint pain",0.30,0.4,"moderate"]],
      tests:[["colonoscopy with biopsy","invasive","high"],["CRP ESR","inflammatory","high"],["fecal calprotectin","biomarker","high"],["CT enterography","imaging","moderate"],["CBC","hematology","moderate"]],
      treatments:[["mesalamine","aminosalicylate","first_line","ACG"],["budesonide","corticosteroid","induction","ACG"],["azathioprine","immunomodulator","maintenance","ACG"],["infliximab","anti-TNF","moderate_severe","ACG"],["adalimumab","anti-TNF","moderate_severe","ACG"]]},
    {name:"inflammatory bowel disease ulcerative colitis",icd10:"K51.9",organ:"gastrointestinal",prior:0.005,severity:"high",
      symptoms:[["bloody diarrhea",0.90,0.85,"high"],["abdominal cramps",0.75,0.7,"high"],["urgency",0.70,0.65,"high"],["tenesmus",0.60,0.65,"moderate"],["weight loss",0.45,0.5,"moderate"],["fatigue",0.50,0.45,"moderate"],["fever",0.30,0.4,"moderate"],["mucus in stool",0.55,0.6,"moderate"]],
      tests:[["colonoscopy with biopsy","invasive","high"],["fecal calprotectin","biomarker","high"],["CRP ESR","inflammatory","moderate"],["stool culture","microbiology","moderate"],["CBC","hematology","moderate"]],
      treatments:[["mesalamine","aminosalicylate","first_line","ACG"],["prednisone","corticosteroid","flare","ACG"],["azathioprine","immunomodulator","maintenance","ACG"],["vedolizumab","integrin inhibitor","moderate_severe","ACG"]]},
    {name:"irritable bowel syndrome",icd10:"K58.9",organ:"gastrointestinal",prior:0.12,severity:"low",
      symptoms:[["abdominal pain",0.90,0.8,"high"],["bloating",0.80,0.75,"high"],["altered bowel habits",0.85,0.8,"high"],["abdominal cramping",0.70,0.65,"high"],["mucus in stool",0.40,0.4,"moderate"],["pain relief with defecation",0.65,0.7,"high"],["urgency",0.45,0.45,"moderate"],["incomplete evacuation",0.50,0.5,"moderate"]],
      tests:[["CBC","hematology","low"],["CRP","inflammatory","low"],["celiac serology","immunology","moderate"],["stool studies","microbiology","moderate"],["colonoscopy","invasive","if_alarm_features"]],
      treatments:[["fiber supplement","dietary","first_line","ACG"],["loperamide","antidiarrheal","IBS-D","ACG"],["linaclotide","guanylate cyclase agonist","IBS-C","ACG"],["amitriptyline","TCA","neuromodulator","ACG"]]},
    {name:"celiac disease",icd10:"K90.0",organ:"gastrointestinal",prior:0.01,severity:"moderate",
      symptoms:[["chronic diarrhea",0.70,0.65,"high"],["bloating",0.65,0.6,"moderate"],["abdominal pain",0.55,0.5,"moderate"],["weight loss",0.50,0.5,"moderate"],["fatigue",0.60,0.5,"moderate"],["iron deficiency anemia",0.50,0.6,"moderate"],["dermatitis herpetiformis",0.25,0.85,"high"],["malabsorption",0.55,0.7,"high"],["osteoporosis",0.30,0.5,"moderate"]],
      tests:[["tissue transglutaminase IgA","serology","high"],["total IgA level","immunology","moderate"],["endomysial antibodies","serology","high"],["duodenal biopsy","pathology","high"],["CBC","hematology","moderate"]],
      treatments:[["gluten-free diet","dietary","first_line","ACG"],["vitamin D supplementation","nutritional","adjunct","ACG"],["iron supplementation","nutritional","if_deficient","ACG"]]},
    {name:"acute appendicitis",icd10:"K35.80",organ:"gastrointestinal",prior:0.015,severity:"high",
      symptoms:[["periumbilical pain migrating to RLQ",0.85,0.9,"high"],["right lower quadrant pain",0.90,0.85,"high"],["nausea",0.75,0.65,"high"],["vomiting",0.60,0.55,"moderate"],["loss of appetite",0.70,0.6,"high"],["fever low grade",0.55,0.5,"moderate"],["rebound tenderness",0.65,0.8,"high"],["McBurney point tenderness",0.70,0.85,"high"]],
      tests:[["CT abdomen pelvis","imaging","high"],["CBC","hematology","moderate"],["CRP","inflammatory","moderate"],["urinalysis","microbiology","moderate"],["abdominal ultrasound","imaging","moderate"]],
      treatments:[["laparoscopic appendectomy","surgical","first_line","SAGES"],["IV antibiotics","antimicrobial","perioperative","SAGES"]]},
    {name:"liver cirrhosis",icd10:"K74.60",organ:"gastrointestinal",prior:0.01,severity:"high",
      symptoms:[["jaundice",0.65,0.7,"high"],["ascites",0.70,0.75,"high"],["spider angiomas",0.45,0.7,"high"],["palmar erythema",0.40,0.65,"moderate"],["hepatomegaly",0.50,0.6,"moderate"],["fatigue",0.70,0.5,"moderate"],["easy bruising",0.45,0.5,"moderate"],["peripheral edema",0.55,0.5,"moderate"],["gynecomastia",0.25,0.55,"moderate"],["muscle wasting",0.40,0.5,"moderate"]],
      tests:[["LFT","biochemistry","high"],["CBC with platelet","hematology","high"],["coagulation studies","hematology","high"],["abdominal ultrasound","imaging","high"],["FibroScan","imaging","high"],["AFP","biomarker","moderate"],["liver biopsy","pathology","moderate"]],
      treatments:[["lactulose","osmotic laxative","hepatic_encephalopathy","AASLD"],["spironolactone","diuretic","ascites","AASLD"],["furosemide","diuretic","ascites","AASLD"],["propranolol","beta-blocker","variceal_prophylaxis","AASLD"],["rifaximin","antibiotic","hepatic_encephalopathy","AASLD"]]},
    {name:"acute gastroenteritis",icd10:"K52.9",organ:"gastrointestinal",prior:0.10,severity:"low",
      symptoms:[["diarrhea",0.92,0.85,"high"],["nausea",0.80,0.7,"high"],["vomiting",0.75,0.7,"high"],["abdominal cramps",0.80,0.7,"high"],["fever",0.50,0.5,"moderate"],["dehydration",0.45,0.55,"moderate"],["malaise",0.55,0.4,"moderate"]],
      tests:[["stool culture","microbiology","moderate"],["stool ova and parasites","microbiology","moderate"],["CBC","hematology","low"],["metabolic panel","biochemistry","moderate"]],
      treatments:[["oral rehydration","supportive","first_line","WHO"],["ondansetron","antiemetic","symptomatic","AAP"],["loperamide","antidiarrheal","adult_only","ACG"]]},
  ];
}

// ══════════════════════════════════════════════════
// ENDOCRINOLOGY (20 diseases)
// ══════════════════════════════════════════════════
function getEndocrinologyDiseases(): DiseaseEntry[] {
  return [
    {name:"type 2 diabetes mellitus",icd10:"E11.9",organ:"endocrine",prior:0.08,severity:"moderate",
      symptoms:[["polyuria",0.75,0.7,"high"],["polydipsia",0.70,0.7,"high"],["polyphagia",0.55,0.6,"moderate"],["fatigue",0.65,0.5,"moderate"],["blurred vision",0.45,0.5,"moderate"],["weight loss",0.40,0.45,"moderate"],["slow wound healing",0.50,0.55,"moderate"],["recurrent infections",0.40,0.45,"moderate"],["numbness in extremities",0.45,0.5,"moderate"],["acanthosis nigricans",0.30,0.7,"high"]],
      tests:[["HbA1c","biochemistry","high"],["fasting glucose","biochemistry","high"],["oral glucose tolerance test","biochemistry","high"],["lipid panel","biochemistry","moderate"],["renal function","biochemistry","moderate"],["urine albumin-creatinine ratio","biochemistry","moderate"]],
      treatments:[["metformin","biguanide","first_line","ADA"],["empagliflozin","SGLT2i","first_line","ADA"],["liraglutide","GLP-1 RA","first_line","ADA"],["sitagliptin","DPP-4 inhibitor","second_line","ADA"],["insulin glargine","basal insulin","if_needed","ADA"]]},
    {name:"type 1 diabetes mellitus",icd10:"E10.9",organ:"endocrine",prior:0.005,severity:"high",
      symptoms:[["polyuria",0.85,0.75,"high"],["polydipsia",0.85,0.75,"high"],["weight loss",0.75,0.7,"high"],["fatigue",0.70,0.55,"moderate"],["nausea",0.40,0.4,"moderate"],["blurred vision",0.35,0.45,"moderate"],["fruity breath odor",0.30,0.8,"high"],["polyphagia",0.55,0.55,"moderate"]],
      tests:[["HbA1c","biochemistry","high"],["fasting glucose","biochemistry","high"],["C-peptide","biochemistry","high"],["GAD antibodies","immunology","high"],["islet cell antibodies","immunology","high"],["ketones","biochemistry","moderate"]],
      treatments:[["insulin glargine","basal insulin","first_line","ADA"],["insulin lispro","rapid insulin","first_line","ADA"],["insulin pump","device","alternative","ADA"],["continuous glucose monitoring","device","adjunct","ADA"]]},
    {name:"diabetic ketoacidosis",icd10:"E10.10",organ:"endocrine",prior:0.005,severity:"critical",
      symptoms:[["nausea",0.80,0.65,"high"],["vomiting",0.70,0.6,"moderate"],["abdominal pain",0.65,0.6,"moderate"],["fruity breath odor",0.55,0.85,"high"],["Kussmaul respirations",0.50,0.9,"high"],["polyuria",0.60,0.55,"moderate"],["polydipsia",0.55,0.5,"moderate"],["altered consciousness",0.45,0.6,"moderate"],["dehydration",0.70,0.65,"high"],["tachycardia",0.55,0.5,"moderate"]],
      tests:[["blood glucose","biochemistry","high"],["ABG","biochemistry","high"],["serum ketones","biochemistry","high"],["metabolic panel","biochemistry","high"],["anion gap","biochemistry","high"],["urinalysis","biochemistry","moderate"]],
      treatments:[["IV insulin","insulin","first_line","ADA"],["IV normal saline","fluid","first_line","ADA"],["potassium replacement","electrolyte","first_line","ADA"],["bicarbonate","buffer","if_pH_below_6.9","ADA"]]},
    {name:"hypothyroidism",icd10:"E03.9",organ:"endocrine",prior:0.05,severity:"low",
      symptoms:[["fatigue",0.85,0.6,"high"],["weight gain",0.70,0.65,"high"],["cold intolerance",0.65,0.7,"high"],["constipation",0.55,0.5,"moderate"],["dry skin",0.60,0.55,"moderate"],["hair loss",0.50,0.5,"moderate"],["bradycardia",0.40,0.6,"moderate"],["depression",0.45,0.45,"moderate"],["muscle weakness",0.40,0.4,"moderate"],["menstrual irregularity",0.35,0.5,"moderate"]],
      tests:[["TSH","endocrine","high"],["free T4","endocrine","high"],["thyroid antibodies","immunology","moderate"],["lipid panel","biochemistry","moderate"]],
      treatments:[["levothyroxine","thyroid hormone","first_line","ATA"]]},
    {name:"hyperthyroidism",icd10:"E05.90",organ:"endocrine",prior:0.02,severity:"moderate",
      symptoms:[["weight loss despite good appetite",0.80,0.8,"high"],["tremor",0.70,0.7,"high"],["palpitations",0.75,0.7,"high"],["heat intolerance",0.70,0.7,"high"],["sweating",0.65,0.6,"moderate"],["anxiety",0.60,0.5,"moderate"],["diarrhea",0.40,0.45,"moderate"],["exophthalmos",0.35,0.85,"high"],["tachycardia",0.70,0.65,"high"],["menstrual irregularity",0.35,0.45,"moderate"]],
      tests:[["TSH","endocrine","high"],["free T4","endocrine","high"],["free T3","endocrine","high"],["TSH receptor antibodies","immunology","moderate"],["thyroid uptake scan","nuclear","moderate"]],
      treatments:[["methimazole","antithyroid","first_line","ATA"],["propranolol","beta-blocker","symptomatic","ATA"],["radioactive iodine","ablative","definitive","ATA"],["propylthiouracil","antithyroid","pregnancy","ATA"]]},
    {name:"Cushing syndrome",icd10:"E24.9",organ:"endocrine",prior:0.003,severity:"moderate",
      symptoms:[["weight gain central",0.85,0.8,"high"],["moon face",0.70,0.85,"high"],["buffalo hump",0.55,0.8,"high"],["striae purple",0.50,0.85,"high"],["easy bruising",0.55,0.6,"moderate"],["muscle weakness proximal",0.60,0.6,"moderate"],["hypertension",0.60,0.55,"moderate"],["hirsutism",0.45,0.55,"moderate"],["depression",0.40,0.4,"moderate"],["glucose intolerance",0.50,0.5,"moderate"]],
      tests:[["24-hour urinary cortisol","endocrine","high"],["late-night salivary cortisol","endocrine","high"],["low-dose dexamethasone suppression test","endocrine","high"],["ACTH level","endocrine","high"],["MRI pituitary","imaging","moderate"]],
      treatments:[["ketoconazole","steroidogenesis inhibitor","first_line","Endocrine Society"],["metyrapone","steroidogenesis inhibitor","first_line","Endocrine Society"],["transsphenoidal surgery","surgical","pituitary_adenoma","Endocrine Society"]]},
    {name:"Addison disease",icd10:"E27.1",organ:"endocrine",prior:0.002,severity:"high",
      symptoms:[["fatigue",0.90,0.7,"high"],["weight loss",0.70,0.6,"moderate"],["hyperpigmentation",0.65,0.85,"high"],["hypotension",0.70,0.7,"high"],["nausea",0.55,0.5,"moderate"],["salt craving",0.50,0.7,"high"],["muscle weakness",0.55,0.5,"moderate"],["abdominal pain",0.40,0.4,"moderate"],["dizziness on standing",0.55,0.55,"moderate"]],
      tests:[["morning cortisol","endocrine","high"],["ACTH stimulation test","endocrine","high"],["ACTH level","endocrine","high"],["metabolic panel","biochemistry","moderate"],["adrenal antibodies","immunology","moderate"]],
      treatments:[["hydrocortisone","corticosteroid","first_line","Endocrine Society"],["fludrocortisone","mineralocorticoid","first_line","Endocrine Society"]]},
    {name:"pheochromocytoma",icd10:"D35.0",organ:"endocrine",prior:0.001,severity:"high",
      symptoms:[["episodic headache",0.80,0.7,"high"],["sweating paroxysmal",0.70,0.75,"high"],["palpitations",0.70,0.7,"high"],["hypertension paroxysmal",0.75,0.8,"high"],["anxiety",0.50,0.5,"moderate"],["tremor",0.40,0.45,"moderate"],["pallor",0.35,0.5,"moderate"],["weight loss",0.30,0.4,"moderate"]],
      tests:[["plasma free metanephrines","endocrine","high"],["24-hour urine catecholamines","endocrine","high"],["CT adrenal","imaging","high"],["MRI adrenal","imaging","high"],["MIBG scan","nuclear","moderate"]],
      treatments:[["phenoxybenzamine","alpha-blocker","preoperative","Endocrine Society"],["adrenalectomy","surgical","definitive","Endocrine Society"],["propranolol","beta-blocker","after_alpha_blockade","Endocrine Society"]]},
    {name:"primary hyperparathyroidism",icd10:"E21.0",organ:"endocrine",prior:0.01,severity:"moderate",
      symptoms:[["fatigue",0.55,0.45,"moderate"],["bone pain",0.40,0.5,"moderate"],["kidney stones",0.35,0.6,"moderate"],["abdominal pain",0.30,0.35,"moderate"],["constipation",0.35,0.35,"moderate"],["depression",0.30,0.35,"moderate"],["polyuria",0.30,0.4,"moderate"],["cognitive impairment",0.25,0.35,"moderate"],["muscle weakness",0.35,0.4,"moderate"]],
      tests:[["serum calcium","biochemistry","high"],["PTH intact","endocrine","high"],["vitamin D level","biochemistry","moderate"],["phosphate level","biochemistry","moderate"],["24-hour urine calcium","biochemistry","moderate"],["DEXA scan","imaging","moderate"]],
      treatments:[["parathyroidectomy","surgical","definitive","AAES"],["cinacalcet","calcimimetic","non_surgical","Endocrine Society"]]},
    {name:"polycystic ovary syndrome",icd10:"E28.2",organ:"endocrine",prior:0.08,severity:"low",
      symptoms:[["irregular menstruation",0.85,0.8,"high"],["hirsutism",0.70,0.7,"high"],["acne",0.55,0.55,"moderate"],["weight gain",0.55,0.5,"moderate"],["infertility",0.50,0.6,"moderate"],["hair thinning",0.35,0.45,"moderate"],["acanthosis nigricans",0.30,0.6,"moderate"],["pelvic pain",0.25,0.3,"moderate"]],
      tests:[["testosterone total and free","endocrine","high"],["DHEA-S","endocrine","moderate"],["LH FSH ratio","endocrine","moderate"],["pelvic ultrasound","imaging","high"],["fasting glucose","biochemistry","moderate"],["HbA1c","biochemistry","moderate"],["lipid panel","biochemistry","moderate"]],
      treatments:[["combined oral contraceptive","hormonal","first_line","Endocrine Society"],["metformin","insulin sensitizer","first_line","ADA"],["spironolactone","antiandrogen","hirsutism","Endocrine Society"],["clomiphene","SERM","infertility","ASRM"]]},
  ];
}

// ══════════════════════════════════════════════════
// NEUROLOGY (20 diseases)
// ══════════════════════════════════════════════════
function getNeurologyDiseases(): DiseaseEntry[] {
  return [
    {name:"ischemic stroke",icd10:"I63.9",organ:"neurological",prior:0.01,severity:"critical",
      symptoms:[["sudden weakness one side",0.85,0.9,"high"],["facial droop",0.70,0.85,"high"],["speech difficulty",0.70,0.8,"high"],["arm drift",0.65,0.8,"high"],["sudden confusion",0.55,0.6,"moderate"],["sudden visual loss",0.40,0.65,"moderate"],["sudden severe headache",0.35,0.5,"moderate"],["dizziness",0.40,0.4,"moderate"],["ataxia",0.35,0.5,"moderate"]],
      tests:[["CT head non-contrast","imaging","high"],["CT angiogram","imaging","high"],["MRI brain","imaging","high"],["CBC","hematology","moderate"],["coagulation studies","hematology","moderate"],["blood glucose","biochemistry","moderate"],["ECG","cardiac","moderate"]],
      treatments:[["alteplase","thrombolytic","first_line","AHA"],["aspirin","antiplatelet","post_acute","AHA"],["mechanical thrombectomy","interventional","large_vessel","AHA"]]},
    {name:"hemorrhagic stroke",icd10:"I61.9",organ:"neurological",prior:0.005,severity:"critical",
      symptoms:[["sudden severe headache",0.90,0.9,"high"],["sudden weakness one side",0.70,0.8,"high"],["vomiting",0.65,0.6,"moderate"],["altered consciousness",0.70,0.7,"high"],["neck stiffness",0.45,0.5,"moderate"],["seizure",0.30,0.5,"moderate"],["hypertension severe",0.60,0.6,"moderate"]],
      tests:[["CT head non-contrast","imaging","high"],["CT angiogram","imaging","high"],["coagulation studies","hematology","high"],["CBC","hematology","moderate"]],
      treatments:[["blood pressure management","supportive","first_line","AHA"],["reversal of anticoagulation","hematologic","first_line","AHA"],["surgical evacuation","surgical","if_indicated","AHA"]]},
    {name:"subarachnoid hemorrhage",icd10:"I60.9",organ:"neurological",prior:0.003,severity:"critical",
      symptoms:[["thunderclap headache",0.95,0.95,"high"],["worst headache of life",0.90,0.95,"high"],["neck stiffness",0.70,0.75,"high"],["photophobia",0.55,0.6,"moderate"],["nausea",0.60,0.55,"moderate"],["vomiting",0.55,0.55,"moderate"],["loss of consciousness",0.40,0.6,"moderate"],["seizure",0.25,0.5,"moderate"],["focal neurological deficit",0.30,0.5,"moderate"]],
      tests:[["CT head non-contrast","imaging","high"],["lumbar puncture","invasive","high"],["CT angiogram","imaging","high"],["cerebral angiography","invasive","high"]],
      treatments:[["nimodipine","calcium channel blocker","neuroprotection","AHA"],["surgical clipping","surgical","definitive","AHA"],["endovascular coiling","interventional","definitive","AHA"]]},
    {name:"meningitis bacterial",icd10:"G00.9",organ:"neurological",prior:0.003,severity:"critical",
      symptoms:[["fever",0.90,0.8,"high"],["severe headache",0.85,0.8,"high"],["neck stiffness",0.80,0.85,"high"],["photophobia",0.65,0.65,"high"],["altered consciousness",0.55,0.6,"moderate"],["nausea",0.60,0.5,"moderate"],["vomiting",0.55,0.5,"moderate"],["petechial rash",0.35,0.8,"high"],["seizure",0.25,0.5,"moderate"],["Kernig sign positive",0.45,0.8,"high"]],
      tests:[["lumbar puncture CSF analysis","invasive","high"],["blood culture","microbiology","high"],["CBC","hematology","moderate"],["CRP","inflammatory","moderate"],["CT head","imaging","before_LP_if_indicated"],["latex agglutination","microbiology","moderate"]],
      treatments:[["ceftriaxone","cephalosporin","first_line","IDSA"],["vancomycin","glycopeptide","first_line","IDSA"],["dexamethasone","corticosteroid","adjunct","IDSA"],["ampicillin","penicillin","if_listeria","IDSA"]]},
    {name:"migraine",icd10:"G43.909",organ:"neurological",prior:0.12,severity:"low",
      symptoms:[["unilateral headache",0.80,0.75,"high"],["throbbing headache",0.75,0.75,"high"],["nausea",0.70,0.65,"high"],["photophobia",0.75,0.7,"high"],["phonophobia",0.65,0.65,"high"],["visual aura",0.35,0.75,"high"],["vomiting",0.45,0.5,"moderate"],["worsened by activity",0.65,0.6,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["MRI brain","imaging","if_atypical"],["CT head","imaging","first_presentation"]],
      treatments:[["sumatriptan","triptan","acute","AAN"],["ibuprofen","NSAID","acute","AAN"],["propranolol","beta-blocker","prevention","AAN"],["topiramate","anticonvulsant","prevention","AAN"],["erenumab","anti-CGRP","prevention","AAN"]]},
    {name:"epilepsy",icd10:"G40.909",organ:"neurological",prior:0.01,severity:"moderate",
      symptoms:[["seizures recurrent",0.95,0.95,"high"],["loss of consciousness",0.60,0.65,"moderate"],["tonic-clonic movements",0.55,0.8,"high"],["post-ictal confusion",0.60,0.7,"high"],["tongue biting",0.35,0.75,"high"],["urinary incontinence during episode",0.30,0.65,"moderate"],["aura",0.40,0.6,"moderate"],["staring episodes",0.45,0.6,"moderate"]],
      tests:[["EEG","neurophysiology","high"],["MRI brain","imaging","high"],["CT head","imaging","moderate"],["metabolic panel","biochemistry","moderate"],["prolactin post-seizure","endocrine","moderate"]],
      treatments:[["levetiracetam","anticonvulsant","first_line","AAN"],["valproate","anticonvulsant","first_line","AAN"],["lamotrigine","anticonvulsant","first_line","AAN"],["carbamazepine","anticonvulsant","focal","AAN"]]},
    {name:"Parkinson disease",icd10:"G20",organ:"neurological",prior:0.005,severity:"high",
      symptoms:[["resting tremor",0.80,0.85,"high"],["bradykinesia",0.85,0.85,"high"],["rigidity",0.75,0.8,"high"],["postural instability",0.55,0.7,"high"],["masked facies",0.50,0.7,"high"],["shuffling gait",0.60,0.75,"high"],["micrographia",0.40,0.7,"high"],["reduced arm swing",0.45,0.6,"moderate"],["constipation",0.40,0.4,"moderate"],["anosmia",0.35,0.5,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["DaTscan","nuclear","moderate"],["MRI brain","imaging","to_exclude_other"]],
      treatments:[["levodopa-carbidopa","dopamine precursor","first_line","AAN"],["pramipexole","dopamine agonist","early_disease","AAN"],["rasagiline","MAO-B inhibitor","adjunct","AAN"],["entacapone","COMT inhibitor","adjunct","AAN"]]},
    {name:"multiple sclerosis",icd10:"G35",organ:"neurological",prior:0.003,severity:"high",
      symptoms:[["optic neuritis",0.50,0.8,"high"],["numbness or tingling",0.65,0.6,"moderate"],["weakness",0.60,0.55,"moderate"],["fatigue",0.80,0.55,"moderate"],["Lhermitte sign",0.30,0.85,"high"],["balance problems",0.50,0.5,"moderate"],["bladder dysfunction",0.45,0.55,"moderate"],["diplopia",0.35,0.6,"moderate"],["spasticity",0.40,0.55,"moderate"],["cognitive impairment",0.35,0.4,"moderate"]],
      tests:[["MRI brain with gadolinium","imaging","high"],["MRI spine","imaging","high"],["lumbar puncture oligoclonal bands","invasive","high"],["visual evoked potentials","neurophysiology","moderate"],["OCT","ophthalmology","moderate"]],
      treatments:[["interferon beta","immunomodulator","first_line","AAN"],["glatiramer acetate","immunomodulator","first_line","AAN"],["dimethyl fumarate","immunomodulator","first_line","AAN"],["ocrelizumab","anti-CD20","first_line","AAN"],["natalizumab","integrin inhibitor","active_disease","AAN"]]},
    {name:"Alzheimer disease",icd10:"G30.9",organ:"neurological",prior:0.015,severity:"high",
      symptoms:[["progressive memory loss",0.92,0.9,"high"],["difficulty with daily tasks",0.75,0.7,"high"],["confusion",0.70,0.65,"high"],["language problems",0.55,0.6,"moderate"],["disorientation",0.65,0.65,"high"],["personality changes",0.50,0.55,"moderate"],["wandering",0.35,0.6,"moderate"],["difficulty with problem-solving",0.60,0.55,"moderate"],["depression",0.40,0.4,"moderate"]],
      tests:[["MMSE","cognitive","high"],["MoCA","cognitive","high"],["MRI brain","imaging","high"],["PET amyloid scan","imaging","moderate"],["CSF biomarkers","invasive","moderate"]],
      treatments:[["donepezil","cholinesterase inhibitor","first_line","AAN"],["memantine","NMDA antagonist","moderate_severe","AAN"],["rivastigmine","cholinesterase inhibitor","first_line","AAN"],["lecanemab","anti-amyloid","early_disease","FDA"]]},
    {name:"tension headache",icd10:"G44.209",organ:"neurological",prior:0.20,severity:"low",
      symptoms:[["bilateral headache",0.85,0.8,"high"],["pressing headache",0.80,0.8,"high"],["band-like headache",0.70,0.75,"high"],["mild to moderate intensity",0.75,0.6,"moderate"],["no nausea",0.60,0.5,"moderate"],["not worsened by activity",0.55,0.5,"moderate"],["neck tension",0.50,0.5,"moderate"],["scalp tenderness",0.40,0.45,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"]],
      treatments:[["acetaminophen","analgesic","first_line","AAN"],["ibuprofen","NSAID","first_line","AAN"],["amitriptyline","TCA","prevention","AAN"]]},
    {name:"trigeminal neuralgia",icd10:"G50.0",organ:"neurological",prior:0.005,severity:"moderate",
      symptoms:[["severe facial pain",0.95,0.9,"high"],["electric shock-like facial pain",0.85,0.9,"high"],["unilateral facial pain",0.80,0.8,"high"],["pain triggered by touch",0.75,0.8,"high"],["brief pain episodes",0.70,0.7,"high"],["pain in V2/V3 distribution",0.60,0.75,"high"]],
      tests:[["MRI brain with thin cuts through brainstem","imaging","high"],["clinical diagnosis","clinical","high"]],
      treatments:[["carbamazepine","anticonvulsant","first_line","AAN"],["oxcarbazepine","anticonvulsant","first_line","AAN"],["microvascular decompression","surgical","refractory","AAN"]]},
    {name:"myasthenia gravis",icd10:"G70.0",organ:"neurological",prior:0.002,severity:"high",
      symptoms:[["ptosis",0.80,0.8,"high"],["diplopia",0.65,0.7,"high"],["fatigable weakness",0.85,0.85,"high"],["dysphagia",0.45,0.6,"moderate"],["dysarthria",0.40,0.55,"moderate"],["weakness worse with activity",0.80,0.8,"high"],["respiratory difficulty",0.30,0.7,"high"],["facial weakness",0.40,0.5,"moderate"]],
      tests:[["acetylcholine receptor antibodies","immunology","high"],["MuSK antibodies","immunology","moderate"],["repetitive nerve stimulation","neurophysiology","high"],["CT chest for thymoma","imaging","moderate"],["edrophonium test","pharmacologic","moderate"]],
      treatments:[["pyridostigmine","cholinesterase inhibitor","first_line","MGFA"],["prednisone","corticosteroid","immunosuppression","MGFA"],["azathioprine","immunosuppressant","steroid_sparing","MGFA"],["IVIG","immunoglobulin","crisis","MGFA"],["thymectomy","surgical","if_thymoma","MGFA"]]},
    {name:"Guillain-Barre syndrome",icd10:"G61.0",organ:"neurological",prior:0.002,severity:"critical",
      symptoms:[["ascending weakness",0.90,0.9,"high"],["bilateral leg weakness",0.85,0.85,"high"],["areflexia",0.80,0.85,"high"],["paresthesias",0.65,0.6,"moderate"],["back pain",0.50,0.5,"moderate"],["difficulty walking",0.70,0.7,"high"],["facial weakness bilateral",0.40,0.65,"moderate"],["respiratory difficulty",0.35,0.7,"high"],["autonomic dysfunction",0.30,0.6,"moderate"]],
      tests:[["lumbar puncture CSF","invasive","high"],["nerve conduction studies","neurophysiology","high"],["spirometry","pulmonary","moderate"],["ganglioside antibodies","immunology","moderate"]],
      treatments:[["IVIG","immunoglobulin","first_line","AAN"],["plasmapheresis","immunotherapy","first_line","AAN"],["respiratory monitoring","supportive","critical","AAN"]]},
  ];
}

// ══════════════════════════════════════════════════
// SHARED UPSERT ENGINE
// ══════════════════════════════════════════════════
async function processDiseases(supabase: any, diseases: DiseaseEntry[], log: string[], addLog: (m:string)=>void) {
  const uniqueSymptoms = new Set<string>();
  for (const d of diseases) for (const [sym] of d.symptoms) uniqueSymptoms.add(sym);
  addLog(`Unique symptoms: ${uniqueSymptoms.size}`);

  // Upsert diagnoses
  addLog("Upserting diagnoses...");
  const diagRows = diseases.map(d => ({ diagnosis_name: d.name, icd10_code: d.icd10, category: d.organ }));
  for (let i = 0; i < diagRows.length; i += 100) {
    const { error } = await supabase.from("diagnoses").upsert(diagRows.slice(i, i+100), { onConflict: "diagnosis_name", ignoreDuplicates: true });
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

  // Upsert symptoms
  addLog("Upserting symptoms...");
  const symRows = Array.from(uniqueSymptoms).map(s => ({ symptom_name: s, category: "general" }));
  for (let i = 0; i < symRows.length; i += 100) {
    const { error } = await supabase.from("symptoms").upsert(symRows.slice(i, i+100), { onConflict: "symptom_name", ignoreDuplicates: true });
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

  // Upsert priors
  addLog("Upserting disease priors...");
  const priorRows = diseases.filter(d => allDiagIds[d.name]).map(d => ({
    diagnosis_id: allDiagIds[d.name], base_prevalence: d.prior,
    age_modifier: {}, sex_modifier: {}, region_modifier: {},
  }));
  for (let i = 0; i < priorRows.length; i += 100) {
    const { error } = await supabase.from("disease_priors").upsert(priorRows.slice(i, i+100), { onConflict: "diagnosis_id", ignoreDuplicates: false });
    if (error) addLog(`  Priors error: ${error.message}`);
  }

  // Upsert symptom likelihoods
  addLog("Upserting symptom likelihoods...");
  const likRows: any[] = [];
  for (const d of diseases) {
    const dId = allDiagIds[d.name]; if (!dId) continue;
    for (const [sym, prob] of d.symptoms) {
      const sId = allSymIds[sym]; if (!sId) continue;
      likRows.push({ symptom_id: sId, diagnosis_id: dId, likelihood_value: prob });
    }
  }
  let likCount = 0;
  for (let i = 0; i < likRows.length; i += 200) {
    const { error } = await supabase.from("symptom_likelihoods").upsert(likRows.slice(i, i+200), { onConflict: "symptom_id,diagnosis_id", ignoreDuplicates: false });
    if (error) addLog(`  Likelihoods error: ${error.message}`);
    else likCount += likRows.slice(i, i+200).length;
  }
  addLog(`  Likelihoods upserted: ${likCount}`);

  // Upsert disease tests
  addLog("Upserting disease tests...");
  const testRows = diseases.flatMap(d => d.tests.map(([t,c,s]) => ({ disease_name: d.name, test_name: t, test_category: c, diagnostic_strength: s })));
  let testCount = 0;
  for (let i = 0; i < testRows.length; i += 200) {
    const { error } = await supabase.from("disease_tests").upsert(testRows.slice(i, i+200), { onConflict: "disease_name,test_name", ignoreDuplicates: true });
    if (error) addLog(`  Tests error: ${error.message}`);
    else testCount += testRows.slice(i, i+200).length;
  }
  addLog(`  Tests upserted: ${testCount}`);

  // Upsert disease treatments
  addLog("Upserting disease treatments...");
  const txRows = diseases.flatMap(d => d.treatments.map(([drug,cls,line,src]) => ({ disease_name: d.name, drug_name: drug, drug_class: cls, line_of_treatment: line, guideline_source: src })));
  let txCount = 0;
  for (let i = 0; i < txRows.length; i += 200) {
    const { error } = await supabase.from("disease_treatments").upsert(txRows.slice(i, i+200), { onConflict: "disease_name,drug_name", ignoreDuplicates: true });
    if (error) addLog(`  Treatments error: ${error.message}`);
    else txCount += txRows.slice(i, i+200).length;
  }
  addLog(`  Treatments upserted: ${txCount}`);

  return { diagnoses: diagRows.length, likelihoods: likCount, tests: testCount, treatments: txCount };
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

  addLog(`=== KG Expansion Batch 2 — ${batch} ===`);

  try {
    let diseases: DiseaseEntry[] = [];
    if (batch === "all" || batch === "cardiology") diseases.push(...getCardiologyDiseases());
    if (batch === "all" || batch === "pulmonology") diseases.push(...getPulmonologyDiseases());
    if (batch === "all" || batch === "gastroenterology") diseases.push(...getGastroenterologyDiseases());
    if (batch === "all" || batch === "endocrinology") diseases.push(...getEndocrinologyDiseases());
    if (batch === "all" || batch === "neurology") diseases.push(...getNeurologyDiseases());

    addLog(`Total diseases: ${diseases.length}`);
    const stats = await processDiseases(supabase, diseases, log, addLog);

    // Validation counts
    addLog("=== VALIDATION ===");
    const counts: Record<string, number> = {};
    for (const table of ["diagnoses","symptoms","symptom_likelihoods","disease_priors","disease_tests","disease_treatments"]) {
      const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
      counts[table] = count || 0;
      addLog(`  ${table}: ${count}`);
    }

    return new Response(JSON.stringify({ success: true, batch, stats, counts, log }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    addLog(`FATAL: ${err.message}`);
    return new Response(JSON.stringify({ success: false, error: err.message, log }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
