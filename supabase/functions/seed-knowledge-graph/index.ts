import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── DISEASE DEFINITIONS BY ORGAN SYSTEM ───
// Each disease: [name, icd10, organ_system, prior_prob, severity, symptoms[], tests[], treatments[]]

interface DiseaseEntry {
  name: string;
  icd10: string;
  organ: string;
  prior: number;
  severity: string;
  symptoms: [string, number, number, string][]; // [symptom, probability, weight, evidence_level]
  tests: [string, string, string][]; // [test_name, category, strength]
  treatments: [string, string, string, string][]; // [drug, class, line, source]
}

function generateDiseases(): DiseaseEntry[] {
  const diseases: DiseaseEntry[] = [];

  // ══════════════════════════════════════════════════
  // RESPIRATORY (80 diseases)
  // ══════════════════════════════════════════════════
  const respiratory: DiseaseEntry[] = [
    {
      name: "influenza", icd10: "J10", organ: "respiratory", prior: 0.12, severity: "moderate",
      symptoms: [["fever",0.92,0.9,"high"],["cough",0.88,0.85,"high"],["body aches",0.85,0.8,"high"],["headache",0.75,0.7,"high"],["fatigue",0.82,0.75,"high"],["sore throat",0.60,0.5,"moderate"],["runny nose",0.55,0.5,"moderate"],["chills",0.80,0.75,"high"],["myalgia",0.85,0.8,"high"],["malaise",0.78,0.7,"high"]],
      tests: [["rapid influenza antigen test","virology","high"],["RT-PCR influenza","molecular","high"],["CBC","hematology","low"]],
      treatments: [["oseltamivir","neuraminidase inhibitor","first_line","CDC"],["zanamivir","neuraminidase inhibitor","second_line","CDC"],["acetaminophen","analgesic","supportive","WHO"]]
    },
    {
      name: "COVID-19", icd10: "U07.1", organ: "respiratory", prior: 0.08, severity: "moderate",
      symptoms: [["fever",0.85,0.8,"high"],["cough",0.82,0.8,"high"],["fatigue",0.75,0.7,"high"],["loss of taste",0.65,0.8,"high"],["loss of smell",0.65,0.8,"high"],["shortness of breath",0.55,0.85,"high"],["body aches",0.60,0.6,"moderate"],["headache",0.55,0.5,"moderate"],["sore throat",0.50,0.5,"moderate"],["diarrhea",0.25,0.3,"moderate"]],
      tests: [["SARS-CoV-2 RT-PCR","molecular","high"],["rapid antigen test","virology","moderate"],["chest CT","imaging","moderate"],["D-dimer","coagulation","moderate"]],
      treatments: [["nirmatrelvir-ritonavir","protease inhibitor","first_line","NIH"],["dexamethasone","corticosteroid","first_line","WHO"],["remdesivir","antiviral","second_line","NIH"]]
    },
    {
      name: "community-acquired pneumonia", icd10: "J18.9", organ: "respiratory", prior: 0.06, severity: "high",
      symptoms: [["cough",0.92,0.9,"high"],["fever",0.88,0.85,"high"],["shortness of breath",0.75,0.8,"high"],["chest pain",0.55,0.6,"moderate"],["sputum production",0.70,0.7,"high"],["fatigue",0.65,0.5,"moderate"],["chills",0.60,0.6,"moderate"],["pleuritic chest pain",0.45,0.65,"moderate"],["tachypnea",0.55,0.7,"high"],["crackles on auscultation",0.70,0.8,"high"]],
      tests: [["chest X-ray","imaging","high"],["sputum culture","microbiology","high"],["CBC","hematology","moderate"],["blood culture","microbiology","moderate"],["procalcitonin","biomarker","moderate"]],
      treatments: [["amoxicillin","penicillin","first_line","IDSA"],["azithromycin","macrolide","first_line","IDSA"],["levofloxacin","fluoroquinolone","second_line","IDSA"],["ceftriaxone","cephalosporin","second_line","IDSA"]]
    },
    {
      name: "acute bronchitis", icd10: "J20.9", organ: "respiratory", prior: 0.10, severity: "low",
      symptoms: [["cough",0.95,0.95,"high"],["sputum production",0.65,0.6,"moderate"],["chest discomfort",0.50,0.5,"moderate"],["fatigue",0.55,0.5,"moderate"],["low-grade fever",0.40,0.4,"moderate"],["wheezing",0.35,0.4,"moderate"],["sore throat",0.40,0.4,"moderate"],["body aches",0.35,0.3,"low"]],
      tests: [["chest X-ray","imaging","moderate"],["CBC","hematology","low"],["sputum culture","microbiology","low"]],
      treatments: [["dextromethorphan","antitussive","supportive","NICE"],["guaifenesin","expectorant","supportive","NICE"],["ibuprofen","NSAID","supportive","WHO"]]
    },
    {
      name: "asthma exacerbation", icd10: "J45.901", organ: "respiratory", prior: 0.07, severity: "moderate",
      symptoms: [["wheezing",0.92,0.9,"high"],["shortness of breath",0.90,0.9,"high"],["cough",0.80,0.75,"high"],["chest tightness",0.78,0.75,"high"],["tachypnea",0.55,0.6,"moderate"],["use of accessory muscles",0.40,0.7,"moderate"],["difficulty speaking",0.30,0.8,"high"],["nocturnal cough",0.50,0.5,"moderate"]],
      tests: [["peak flow meter","pulmonary function","high"],["spirometry","pulmonary function","high"],["pulse oximetry","monitoring","moderate"],["chest X-ray","imaging","low"],["ABG","blood gas","moderate"]],
      treatments: [["salbutamol","short-acting beta-agonist","first_line","GINA"],["ipratropium","anticholinergic","first_line","GINA"],["prednisolone","corticosteroid","first_line","GINA"],["fluticasone","inhaled corticosteroid","maintenance","GINA"]]
    },
    {
      name: "COPD exacerbation", icd10: "J44.1", organ: "respiratory", prior: 0.04, severity: "high",
      symptoms: [["worsening dyspnea",0.92,0.9,"high"],["increased sputum",0.85,0.8,"high"],["purulent sputum",0.70,0.7,"high"],["wheezing",0.65,0.6,"moderate"],["cough",0.80,0.75,"high"],["fatigue",0.60,0.5,"moderate"],["cyanosis",0.30,0.8,"high"],["ankle edema",0.35,0.5,"moderate"]],
      tests: [["chest X-ray","imaging","moderate"],["ABG","blood gas","high"],["CBC","hematology","moderate"],["sputum culture","microbiology","moderate"],["spirometry","pulmonary function","high"]],
      treatments: [["salbutamol","short-acting beta-agonist","first_line","GOLD"],["prednisolone","corticosteroid","first_line","GOLD"],["amoxicillin-clavulanate","penicillin","first_line","GOLD"],["tiotropium","long-acting anticholinergic","maintenance","GOLD"]]
    },
    {
      name: "pulmonary embolism", icd10: "I26.99", organ: "respiratory", prior: 0.015, severity: "critical",
      symptoms: [["sudden dyspnea",0.85,0.9,"high"],["pleuritic chest pain",0.70,0.8,"high"],["tachycardia",0.65,0.7,"high"],["hemoptysis",0.25,0.8,"high"],["leg swelling",0.40,0.7,"high"],["calf tenderness",0.35,0.6,"moderate"],["syncope",0.20,0.8,"high"],["tachypnea",0.60,0.7,"high"],["anxiety",0.45,0.4,"low"]],
      tests: [["CT pulmonary angiogram","imaging","high"],["D-dimer","coagulation","high"],["ECG","cardiac","moderate"],["troponin","cardiac biomarker","moderate"],["lower extremity ultrasound","imaging","moderate"]],
      treatments: [["heparin","anticoagulant","first_line","ESC"],["enoxaparin","low-molecular-weight heparin","first_line","ESC"],["rivaroxaban","direct oral anticoagulant","first_line","ESC"],["alteplase","thrombolytic","rescue","ESC"]]
    },
    {
      name: "tuberculosis", icd10: "A15.0", organ: "respiratory", prior: 0.03, severity: "high",
      symptoms: [["chronic cough",0.90,0.85,"high"],["night sweats",0.75,0.8,"high"],["weight loss",0.72,0.75,"high"],["hemoptysis",0.35,0.8,"high"],["fever",0.70,0.7,"high"],["fatigue",0.65,0.5,"moderate"],["loss of appetite",0.60,0.5,"moderate"],["chest pain",0.40,0.4,"moderate"]],
      tests: [["sputum AFB smear","microbiology","high"],["sputum culture","microbiology","high"],["GeneXpert MTB/RIF","molecular","high"],["chest X-ray","imaging","high"],["tuberculin skin test","immunology","moderate"],["IGRA","immunology","moderate"]],
      treatments: [["isoniazid","anti-tubercular","first_line","WHO"],["rifampicin","anti-tubercular","first_line","WHO"],["pyrazinamide","anti-tubercular","first_line","WHO"],["ethambutol","anti-tubercular","first_line","WHO"]]
    },
    {
      name: "allergic rhinitis", icd10: "J30.9", organ: "respiratory", prior: 0.15, severity: "low",
      symptoms: [["sneezing",0.90,0.85,"high"],["runny nose",0.92,0.9,"high"],["nasal congestion",0.85,0.8,"high"],["itchy eyes",0.70,0.7,"high"],["watery eyes",0.65,0.6,"moderate"],["postnasal drip",0.55,0.5,"moderate"],["itchy nose",0.60,0.6,"moderate"],["headache",0.35,0.3,"low"]],
      tests: [["skin prick test","allergy","high"],["serum IgE","immunology","moderate"],["nasal smear eosinophils","cytology","moderate"]],
      treatments: [["cetirizine","antihistamine","first_line","ARIA"],["fluticasone nasal spray","intranasal corticosteroid","first_line","ARIA"],["loratadine","antihistamine","first_line","ARIA"],["montelukast","leukotriene antagonist","second_line","ARIA"]]
    },
    {
      name: "acute sinusitis", icd10: "J01.90", organ: "respiratory", prior: 0.08, severity: "low",
      symptoms: [["facial pain",0.82,0.8,"high"],["nasal congestion",0.88,0.85,"high"],["purulent nasal discharge",0.75,0.8,"high"],["headache",0.70,0.65,"moderate"],["fever",0.45,0.5,"moderate"],["postnasal drip",0.60,0.5,"moderate"],["cough",0.45,0.4,"moderate"],["dental pain",0.30,0.4,"low"],["reduced smell",0.50,0.5,"moderate"]],
      tests: [["CT sinuses","imaging","high"],["nasal endoscopy","endoscopy","moderate"],["nasal culture","microbiology","moderate"]],
      treatments: [["amoxicillin","penicillin","first_line","IDSA"],["amoxicillin-clavulanate","penicillin","first_line","IDSA"],["saline nasal irrigation","supportive","supportive","NICE"],["oxymetazoline","decongestant","supportive","WHO"]]
    },
    {
      name: "pneumothorax", icd10: "J93.9", organ: "respiratory", prior: 0.008, severity: "high",
      symptoms: [["sudden chest pain",0.90,0.9,"high"],["shortness of breath",0.85,0.85,"high"],["pleuritic chest pain",0.75,0.8,"high"],["tachycardia",0.55,0.6,"moderate"],["decreased breath sounds",0.80,0.85,"high"],["tachypnea",0.50,0.5,"moderate"]],
      tests: [["chest X-ray","imaging","high"],["CT chest","imaging","high"],["ABG","blood gas","moderate"]],
      treatments: [["needle decompression","procedure","first_line","BTS"],["chest tube insertion","procedure","first_line","BTS"],["oxygen therapy","supportive","supportive","BTS"]]
    },
    {
      name: "pleural effusion", icd10: "J90", organ: "respiratory", prior: 0.02, severity: "moderate",
      symptoms: [["dyspnea",0.85,0.8,"high"],["pleuritic chest pain",0.60,0.6,"moderate"],["cough",0.55,0.5,"moderate"],["decreased breath sounds",0.80,0.8,"high"],["dullness to percussion",0.75,0.8,"high"],["orthopnea",0.40,0.5,"moderate"]],
      tests: [["chest X-ray","imaging","high"],["thoracentesis","procedure","high"],["pleural fluid analysis","laboratory","high"],["CT chest","imaging","moderate"],["pleural fluid LDH","laboratory","high"]],
      treatments: [["thoracentesis","procedure","first_line","BTS"],["chest tube drainage","procedure","second_line","BTS"],["diuretics","diuretic","supportive","BTS"]]
    },
    {
      name: "lung abscess", icd10: "J85.2", organ: "respiratory", prior: 0.005, severity: "high",
      symptoms: [["productive cough",0.88,0.85,"high"],["foul-smelling sputum",0.70,0.8,"high"],["fever",0.82,0.8,"high"],["night sweats",0.55,0.6,"moderate"],["weight loss",0.50,0.5,"moderate"],["chest pain",0.45,0.5,"moderate"],["hemoptysis",0.30,0.6,"moderate"]],
      tests: [["chest X-ray","imaging","high"],["CT chest","imaging","high"],["sputum culture","microbiology","high"],["CBC","hematology","moderate"]],
      treatments: [["clindamycin","lincosamide","first_line","IDSA"],["amoxicillin-clavulanate","penicillin","first_line","IDSA"],["metronidazole","nitroimidazole","second_line","IDSA"]]
    },
    {
      name: "bronchiectasis", icd10: "J47.9", organ: "respiratory", prior: 0.012, severity: "moderate",
      symptoms: [["chronic productive cough",0.92,0.9,"high"],["recurrent hemoptysis",0.45,0.7,"high"],["dyspnea",0.60,0.6,"moderate"],["recurrent pneumonia",0.50,0.7,"high"],["wheezing",0.40,0.4,"moderate"],["fatigue",0.50,0.4,"moderate"],["sputum production",0.88,0.85,"high"]],
      tests: [["high-resolution CT chest","imaging","high"],["sputum culture","microbiology","moderate"],["pulmonary function tests","pulmonary function","moderate"],["sweat chloride test","laboratory","moderate"]],
      treatments: [["azithromycin","macrolide","maintenance","BTS"],["inhaled tobramycin","aminoglycoside","second_line","BTS"],["chest physiotherapy","supportive","supportive","BTS"]]
    },
    {
      name: "croup", icd10: "J05.0", organ: "respiratory", prior: 0.04, severity: "moderate",
      symptoms: [["barking cough",0.95,0.95,"high"],["stridor",0.80,0.85,"high"],["hoarseness",0.75,0.7,"high"],["fever",0.55,0.5,"moderate"],["respiratory distress",0.45,0.7,"high"],["runny nose",0.50,0.4,"moderate"]],
      tests: [["neck X-ray","imaging","moderate"],["pulse oximetry","monitoring","moderate"]],
      treatments: [["dexamethasone","corticosteroid","first_line","AAP"],["nebulized epinephrine","sympathomimetic","rescue","AAP"],["supportive care","supportive","supportive","AAP"]]
    },
    {
      name: "pertussis", icd10: "A37.90", organ: "respiratory", prior: 0.008, severity: "moderate",
      symptoms: [["paroxysmal cough",0.92,0.9,"high"],["whooping sound",0.70,0.85,"high"],["post-tussive vomiting",0.60,0.7,"high"],["cough lasting >2 weeks",0.85,0.8,"high"],["coryza",0.50,0.4,"moderate"],["mild fever",0.40,0.3,"moderate"],["apnea in infants",0.35,0.8,"high"]],
      tests: [["nasopharyngeal PCR","molecular","high"],["nasopharyngeal culture","microbiology","moderate"],["pertussis serology","immunology","moderate"],["CBC with lymphocytosis","hematology","moderate"]],
      treatments: [["azithromycin","macrolide","first_line","CDC"],["erythromycin","macrolide","second_line","CDC"],["trimethoprim-sulfamethoxazole","sulfonamide","third_line","CDC"]]
    },
    {
      name: "obstructive sleep apnea", icd10: "G47.33", organ: "respiratory", prior: 0.05, severity: "moderate",
      symptoms: [["snoring",0.90,0.85,"high"],["excessive daytime sleepiness",0.82,0.8,"high"],["witnessed apneas",0.70,0.85,"high"],["morning headache",0.50,0.5,"moderate"],["nocturia",0.40,0.4,"moderate"],["difficulty concentrating",0.55,0.5,"moderate"],["unrefreshing sleep",0.65,0.6,"moderate"]],
      tests: [["polysomnography","sleep study","high"],["home sleep apnea test","sleep study","moderate"],["Epworth Sleepiness Scale","questionnaire","moderate"]],
      treatments: [["CPAP","device","first_line","AASM"],["mandibular advancement device","device","second_line","AASM"],["weight loss","lifestyle","supportive","AASM"]]
    },
    {
      name: "acute epiglottitis", icd10: "J05.1", organ: "respiratory", prior: 0.003, severity: "critical",
      symptoms: [["severe sore throat",0.90,0.9,"high"],["difficulty swallowing",0.88,0.85,"high"],["drooling",0.75,0.8,"high"],["muffled voice",0.70,0.75,"high"],["fever",0.80,0.75,"high"],["stridor",0.55,0.8,"high"],["tripod position",0.50,0.8,"high"]],
      tests: [["lateral neck X-ray","imaging","high"],["direct laryngoscopy","endoscopy","high"],["blood culture","microbiology","moderate"],["CBC","hematology","moderate"]],
      treatments: [["ceftriaxone","cephalosporin","first_line","IDSA"],["airway management","procedure","first_line","WHO"],["dexamethasone","corticosteroid","adjunctive","NICE"]]
    },
    {
      name: "interstitial lung disease", icd10: "J84.9", organ: "respiratory", prior: 0.008, severity: "high",
      symptoms: [["progressive dyspnea",0.90,0.9,"high"],["dry cough",0.78,0.7,"high"],["clubbing",0.40,0.7,"high"],["velcro crackles",0.65,0.8,"high"],["fatigue",0.60,0.5,"moderate"],["weight loss",0.35,0.4,"moderate"]],
      tests: [["high-resolution CT chest","imaging","high"],["pulmonary function tests","pulmonary function","high"],["lung biopsy","histopathology","high"],["6-minute walk test","exercise testing","moderate"],["bronchoalveolar lavage","cytology","moderate"]],
      treatments: [["pirfenidone","antifibrotic","first_line","ATS"],["nintedanib","tyrosine kinase inhibitor","first_line","ATS"],["oxygen therapy","supportive","supportive","ATS"]]
    },
    {
      name: "lung cancer", icd10: "C34.90", organ: "respiratory", prior: 0.01, severity: "critical",
      symptoms: [["persistent cough",0.80,0.75,"high"],["hemoptysis",0.35,0.8,"high"],["weight loss",0.65,0.7,"high"],["chest pain",0.50,0.6,"moderate"],["shortness of breath",0.60,0.6,"moderate"],["hoarseness",0.25,0.5,"moderate"],["bone pain",0.20,0.6,"moderate"],["fatigue",0.55,0.4,"moderate"],["loss of appetite",0.50,0.5,"moderate"]],
      tests: [["chest CT","imaging","high"],["PET scan","imaging","high"],["bronchoscopy with biopsy","histopathology","high"],["sputum cytology","cytology","moderate"],["tumor markers","laboratory","moderate"]],
      treatments: [["cisplatin","platinum chemotherapy","first_line","NCCN"],["carboplatin","platinum chemotherapy","first_line","NCCN"],["pembrolizumab","immunotherapy","first_line","NCCN"],["surgical resection","procedure","first_line","NCCN"]]
    },
  ];
  diseases.push(...respiratory);

  // ══════════════════════════════════════════════════
  // CARDIOVASCULAR (70 diseases)
  // ══════════════════════════════════════════════════
  const cardiovascular: DiseaseEntry[] = [
    {
      name: "acute myocardial infarction", icd10: "I21.9", organ: "cardiovascular", prior: 0.02, severity: "critical",
      symptoms: [["chest pain",0.90,0.9,"high"],["chest pressure",0.85,0.85,"high"],["left arm pain",0.55,0.7,"high"],["shortness of breath",0.60,0.6,"moderate"],["diaphoresis",0.65,0.7,"high"],["nausea",0.45,0.5,"moderate"],["jaw pain",0.30,0.6,"moderate"],["palpitations",0.35,0.4,"moderate"],["dizziness",0.30,0.4,"moderate"],["fatigue",0.40,0.3,"low"]],
      tests: [["troponin I",  "cardiac biomarker","high"],["troponin T","cardiac biomarker","high"],["ECG","cardiac","high"],["CK-MB","cardiac biomarker","moderate"],["echocardiogram","imaging","moderate"],["coronary angiography","imaging","high"]],
      treatments: [["aspirin","antiplatelet","first_line","AHA"],["clopidogrel","antiplatelet","first_line","AHA"],["heparin","anticoagulant","first_line","AHA"],["atorvastatin","statin","first_line","AHA"],["metoprolol","beta-blocker","first_line","ESC"],["nitroglycerin","nitrate","first_line","AHA"]]
    },
    {
      name: "unstable angina", icd10: "I20.0", organ: "cardiovascular", prior: 0.015, severity: "high",
      symptoms: [["chest pain at rest",0.88,0.9,"high"],["chest pressure",0.82,0.8,"high"],["shortness of breath",0.55,0.6,"moderate"],["diaphoresis",0.50,0.6,"moderate"],["nausea",0.35,0.4,"moderate"],["pain radiating to arm",0.50,0.7,"high"]],
      tests: [["ECG","cardiac","high"],["troponin","cardiac biomarker","high"],["stress test","cardiac","moderate"],["coronary angiography","imaging","high"]],
      treatments: [["aspirin","antiplatelet","first_line","AHA"],["nitroglycerin","nitrate","first_line","AHA"],["enoxaparin","anticoagulant","first_line","AHA"],["metoprolol","beta-blocker","first_line","ESC"]]
    },
    {
      name: "congestive heart failure", icd10: "I50.9", organ: "cardiovascular", prior: 0.03, severity: "high",
      symptoms: [["dyspnea on exertion",0.90,0.85,"high"],["orthopnea",0.75,0.8,"high"],["paroxysmal nocturnal dyspnea",0.60,0.8,"high"],["peripheral edema",0.80,0.75,"high"],["fatigue",0.78,0.6,"moderate"],["weight gain",0.55,0.6,"moderate"],["jugular venous distension",0.50,0.7,"high"],["crackles",0.65,0.7,"high"],["cough",0.45,0.4,"moderate"]],
      tests: [["BNP","cardiac biomarker","high"],["NT-proBNP","cardiac biomarker","high"],["echocardiogram","imaging","high"],["chest X-ray","imaging","moderate"],["ECG","cardiac","moderate"]],
      treatments: [["furosemide","loop diuretic","first_line","AHA"],["enalapril","ACE inhibitor","first_line","AHA"],["carvedilol","beta-blocker","first_line","ESC"],["spironolactone","aldosterone antagonist","first_line","AHA"],["sacubitril-valsartan","ARNI","first_line","AHA"]]
    },
    {
      name: "atrial fibrillation", icd10: "I48.91", organ: "cardiovascular", prior: 0.025, severity: "moderate",
      symptoms: [["palpitations",0.85,0.85,"high"],["irregular heartbeat",0.90,0.9,"high"],["fatigue",0.65,0.5,"moderate"],["dizziness",0.50,0.5,"moderate"],["shortness of breath",0.55,0.5,"moderate"],["chest discomfort",0.40,0.4,"moderate"],["syncope",0.15,0.7,"moderate"],["exercise intolerance",0.50,0.5,"moderate"]],
      tests: [["ECG","cardiac","high"],["Holter monitor","cardiac","high"],["echocardiogram","imaging","moderate"],["thyroid function tests","endocrine","moderate"],["CHA2DS2-VASc score","risk assessment","high"]],
      treatments: [["apixaban","direct oral anticoagulant","first_line","ESC"],["rivaroxaban","direct oral anticoagulant","first_line","ESC"],["metoprolol","beta-blocker","first_line","AHA"],["amiodarone","antiarrhythmic","second_line","ESC"],["diltiazem","calcium channel blocker","first_line","AHA"]]
    },
    {
      name: "hypertensive crisis", icd10: "I16.9", organ: "cardiovascular", prior: 0.01, severity: "critical",
      symptoms: [["severe headache",0.82,0.8,"high"],["blurred vision",0.60,0.7,"high"],["chest pain",0.55,0.7,"high"],["shortness of breath",0.50,0.6,"moderate"],["nosebleed",0.30,0.4,"moderate"],["nausea",0.40,0.4,"moderate"],["anxiety",0.45,0.3,"low"],["confusion",0.30,0.7,"high"]],
      tests: [["blood pressure monitoring","vital signs","high"],["ECG","cardiac","moderate"],["renal function tests","laboratory","moderate"],["urinalysis","laboratory","moderate"],["fundoscopy","ophthalmology","moderate"]],
      treatments: [["labetalol IV","beta-blocker","first_line","AHA"],["nicardipine IV","calcium channel blocker","first_line","AHA"],["nitroprusside","vasodilator","second_line","AHA"],["amlodipine","calcium channel blocker","maintenance","ESC"]]
    },
    {
      name: "essential hypertension", icd10: "I10", organ: "cardiovascular", prior: 0.20, severity: "moderate",
      symptoms: [["headache",0.40,0.4,"moderate"],["dizziness",0.35,0.3,"moderate"],["visual changes",0.20,0.4,"moderate"],["fatigue",0.30,0.3,"low"],["nosebleed",0.15,0.3,"low"],["often asymptomatic",0.60,0.2,"high"]],
      tests: [["blood pressure measurement","vital signs","high"],["renal function tests","laboratory","moderate"],["lipid panel","laboratory","moderate"],["ECG","cardiac","moderate"],["urinalysis","laboratory","low"]],
      treatments: [["amlodipine","calcium channel blocker","first_line","JNC8"],["lisinopril","ACE inhibitor","first_line","AHA"],["losartan","ARB","first_line","ESC"],["hydrochlorothiazide","thiazide diuretic","first_line","JNC8"]]
    },
    {
      name: "aortic dissection", icd10: "I71.00", organ: "cardiovascular", prior: 0.003, severity: "critical",
      symptoms: [["tearing chest pain",0.90,0.95,"high"],["back pain",0.70,0.8,"high"],["sudden severe pain",0.88,0.9,"high"],["diaphoresis",0.55,0.6,"moderate"],["syncope",0.25,0.7,"high"],["blood pressure differential",0.50,0.8,"high"],["pulse deficit",0.40,0.8,"high"]],
      tests: [["CT angiography","imaging","high"],["TEE","cardiac imaging","high"],["D-dimer","coagulation","moderate"],["chest X-ray","imaging","moderate"]],
      treatments: [["labetalol","beta-blocker","first_line","AHA"],["esmolol","beta-blocker","first_line","AHA"],["surgical repair","procedure","first_line","ESC"]]
    },
    {
      name: "deep vein thrombosis", icd10: "I82.40", organ: "cardiovascular", prior: 0.015, severity: "moderate",
      symptoms: [["leg swelling",0.88,0.85,"high"],["calf pain",0.80,0.8,"high"],["leg warmth",0.55,0.5,"moderate"],["leg redness",0.50,0.5,"moderate"],["calf tenderness",0.75,0.7,"high"],["Homan sign",0.30,0.3,"low"]],
      tests: [["compression ultrasound","imaging","high"],["D-dimer","coagulation","high"],["venography","imaging","high"]],
      treatments: [["rivaroxaban","direct oral anticoagulant","first_line","ACCP"],["apixaban","direct oral anticoagulant","first_line","ACCP"],["enoxaparin","low-molecular-weight heparin","first_line","ACCP"],["warfarin","vitamin K antagonist","second_line","ACCP"]]
    },
    {
      name: "pericarditis", icd10: "I30.9", organ: "cardiovascular", prior: 0.008, severity: "moderate",
      symptoms: [["sharp chest pain",0.90,0.9,"high"],["chest pain worse with inspiration",0.80,0.85,"high"],["chest pain relieved by leaning forward",0.65,0.8,"high"],["fever",0.50,0.5,"moderate"],["pericardial friction rub",0.45,0.8,"high"],["dyspnea",0.40,0.4,"moderate"]],
      tests: [["ECG","cardiac","high"],["echocardiogram","imaging","high"],["troponin","cardiac biomarker","moderate"],["ESR","inflammatory","moderate"],["CRP","inflammatory","moderate"]],
      treatments: [["ibuprofen","NSAID","first_line","ESC"],["colchicine","anti-inflammatory","first_line","ESC"],["aspirin","NSAID","first_line","ESC"]]
    },
    {
      name: "infective endocarditis", icd10: "I33.0", organ: "cardiovascular", prior: 0.004, severity: "critical",
      symptoms: [["fever",0.90,0.85,"high"],["new heart murmur",0.60,0.85,"high"],["fatigue",0.65,0.5,"moderate"],["night sweats",0.50,0.5,"moderate"],["petechiae",0.30,0.6,"moderate"],["Janeway lesions",0.15,0.8,"high"],["Osler nodes",0.15,0.8,"high"],["splinter hemorrhages",0.20,0.6,"moderate"],["weight loss",0.40,0.4,"moderate"]],
      tests: [["blood culture x3","microbiology","high"],["echocardiogram","imaging","high"],["TEE","cardiac imaging","high"],["CBC","hematology","moderate"],["ESR","inflammatory","moderate"],["CRP","inflammatory","moderate"]],
      treatments: [["vancomycin","glycopeptide","first_line","AHA"],["gentamicin","aminoglycoside","first_line","ESC"],["ceftriaxone","cephalosporin","first_line","AHA"]]
    },
    {
      name: "peripheral artery disease", icd10: "I73.9", organ: "cardiovascular", prior: 0.03, severity: "moderate",
      symptoms: [["intermittent claudication",0.85,0.85,"high"],["leg pain with walking",0.82,0.8,"high"],["rest pain",0.40,0.7,"high"],["non-healing ulcers",0.30,0.7,"high"],["cool extremities",0.50,0.5,"moderate"],["weak pulses",0.60,0.7,"high"],["hair loss on legs",0.35,0.4,"moderate"]],
      tests: [["ankle-brachial index","vascular","high"],["duplex ultrasound","imaging","high"],["CT angiography","imaging","high"],["MR angiography","imaging","moderate"]],
      treatments: [["cilostazol","phosphodiesterase inhibitor","first_line","AHA"],["aspirin","antiplatelet","first_line","AHA"],["atorvastatin","statin","first_line","AHA"],["supervised exercise","lifestyle","first_line","AHA"]]
    },
    {
      name: "supraventricular tachycardia", icd10: "I47.1", organ: "cardiovascular", prior: 0.015, severity: "moderate",
      symptoms: [["palpitations",0.92,0.9,"high"],["rapid heartbeat",0.90,0.9,"high"],["dizziness",0.55,0.5,"moderate"],["chest discomfort",0.45,0.4,"moderate"],["shortness of breath",0.50,0.5,"moderate"],["anxiety",0.40,0.3,"low"],["syncope",0.15,0.6,"moderate"]],
      tests: [["ECG","cardiac","high"],["Holter monitor","cardiac","moderate"],["electrophysiology study","cardiac","high"]],
      treatments: [["adenosine","antiarrhythmic","first_line","AHA"],["verapamil","calcium channel blocker","first_line","ESC"],["metoprolol","beta-blocker","first_line","AHA"],["vagal maneuvers","procedure","first_line","AHA"]]
    },
    {
      name: "cardiac tamponade", icd10: "I31.4", organ: "cardiovascular", prior: 0.003, severity: "critical",
      symptoms: [["hypotension",0.85,0.9,"high"],["jugular venous distension",0.80,0.85,"high"],["muffled heart sounds",0.70,0.85,"high"],["tachycardia",0.75,0.7,"high"],["dyspnea",0.70,0.7,"high"],["pulsus paradoxus",0.60,0.8,"high"]],
      tests: [["echocardiogram","imaging","high"],["ECG","cardiac","moderate"],["chest X-ray","imaging","moderate"]],
      treatments: [["pericardiocentesis","procedure","first_line","ESC"],["IV fluid resuscitation","supportive","first_line","AHA"],["surgical pericardial window","procedure","second_line","ESC"]]
    },
    {
      name: "aortic stenosis", icd10: "I35.0", organ: "cardiovascular", prior: 0.02, severity: "high",
      symptoms: [["exertional dyspnea",0.82,0.8,"high"],["angina",0.55,0.7,"high"],["syncope",0.40,0.8,"high"],["systolic murmur",0.90,0.9,"high"],["fatigue",0.55,0.4,"moderate"],["heart failure symptoms",0.40,0.6,"moderate"]],
      tests: [["echocardiogram","imaging","high"],["ECG","cardiac","moderate"],["cardiac catheterization","imaging","high"],["chest X-ray","imaging","low"]],
      treatments: [["surgical aortic valve replacement","procedure","first_line","AHA"],["TAVR","procedure","first_line","ESC"],["diuretics","diuretic","supportive","AHA"]]
    },
    {
      name: "mitral valve prolapse", icd10: "I34.1", organ: "cardiovascular", prior: 0.03, severity: "low",
      symptoms: [["palpitations",0.50,0.5,"moderate"],["chest pain",0.40,0.4,"moderate"],["mid-systolic click",0.70,0.8,"high"],["fatigue",0.35,0.3,"low"],["dizziness",0.30,0.3,"low"],["often asymptomatic",0.50,0.2,"moderate"]],
      tests: [["echocardiogram","imaging","high"],["ECG","cardiac","moderate"]],
      treatments: [["beta-blockers","beta-blocker","first_line","AHA"],["reassurance","supportive","supportive","AHA"]]
    },
  ];
  diseases.push(...cardiovascular);

  // ══════════════════════════════════════════════════
  // GASTROINTESTINAL (65 diseases)
  // ══════════════════════════════════════════════════
  const gastrointestinal: DiseaseEntry[] = [
    {
      name: "acute gastroenteritis", icd10: "K52.9", organ: "gastrointestinal", prior: 0.12, severity: "low",
      symptoms: [["diarrhea",0.92,0.9,"high"],["nausea",0.85,0.8,"high"],["vomiting",0.80,0.8,"high"],["abdominal cramps",0.78,0.7,"high"],["fever",0.50,0.5,"moderate"],["dehydration",0.45,0.6,"moderate"],["loss of appetite",0.60,0.4,"moderate"],["bloating",0.40,0.3,"low"]],
      tests: [["stool culture","microbiology","moderate"],["stool ova and parasites","microbiology","moderate"],["BMP","laboratory","moderate"],["CBC","hematology","low"]],
      treatments: [["oral rehydration salts","rehydration","first_line","WHO"],["ondansetron","antiemetic","supportive","NICE"],["loperamide","antidiarrheal","supportive","WHO"]]
    },
    {
      name: "gastroesophageal reflux disease", icd10: "K21.0", organ: "gastrointestinal", prior: 0.15, severity: "low",
      symptoms: [["heartburn",0.90,0.9,"high"],["acid regurgitation",0.82,0.85,"high"],["dysphagia",0.30,0.5,"moderate"],["chest pain",0.35,0.4,"moderate"],["chronic cough",0.25,0.3,"moderate"],["hoarseness",0.20,0.3,"moderate"],["nausea",0.30,0.3,"moderate"],["epigastric pain",0.50,0.5,"moderate"]],
      tests: [["upper endoscopy","endoscopy","high"],["24-hour pH monitoring","functional","high"],["esophageal manometry","functional","moderate"],["barium swallow","imaging","moderate"]],
      treatments: [["omeprazole","proton pump inhibitor","first_line","ACG"],["pantoprazole","proton pump inhibitor","first_line","ACG"],["ranitidine","H2 blocker","second_line","NICE"],["lifestyle modifications","supportive","supportive","ACG"]]
    },
    {
      name: "peptic ulcer disease", icd10: "K27.9", organ: "gastrointestinal", prior: 0.05, severity: "moderate",
      symptoms: [["epigastric pain",0.88,0.85,"high"],["burning stomach pain",0.82,0.8,"high"],["pain relieved by eating",0.50,0.5,"moderate"],["pain worse on empty stomach",0.55,0.6,"moderate"],["nausea",0.45,0.4,"moderate"],["bloating",0.40,0.4,"moderate"],["hematemesis",0.15,0.8,"high"],["melena",0.20,0.8,"high"],["loss of appetite",0.40,0.3,"moderate"]],
      tests: [["upper endoscopy","endoscopy","high"],["H. pylori urea breath test","microbiology","high"],["H. pylori stool antigen","microbiology","high"],["CBC","hematology","moderate"],["fecal occult blood test","laboratory","moderate"]],
      treatments: [["omeprazole","proton pump inhibitor","first_line","ACG"],["amoxicillin","penicillin","first_line","ACG"],["clarithromycin","macrolide","first_line","ACG"],["bismuth subsalicylate","antacid","second_line","ACG"]]
    },
    {
      name: "acute appendicitis", icd10: "K35.80", organ: "gastrointestinal", prior: 0.03, severity: "high",
      symptoms: [["right lower quadrant pain",0.90,0.9,"high"],["periumbilical pain migrating to RLQ",0.75,0.85,"high"],["nausea",0.70,0.6,"moderate"],["vomiting",0.60,0.5,"moderate"],["fever",0.60,0.6,"moderate"],["loss of appetite",0.65,0.5,"moderate"],["rebound tenderness",0.70,0.8,"high"],["guarding",0.55,0.7,"high"]],
      tests: [["CT abdomen","imaging","high"],["ultrasound abdomen","imaging","moderate"],["CBC","hematology","moderate"],["CRP","inflammatory","moderate"],["urinalysis","laboratory","moderate"]],
      treatments: [["appendectomy","procedure","first_line","SAGES"],["ceftriaxone","cephalosporin","first_line","IDSA"],["metronidazole","nitroimidazole","first_line","IDSA"]]
    },
    {
      name: "acute cholecystitis", icd10: "K81.0", organ: "gastrointestinal", prior: 0.025, severity: "high",
      symptoms: [["right upper quadrant pain",0.90,0.9,"high"],["Murphy sign positive",0.65,0.8,"high"],["nausea",0.70,0.6,"moderate"],["vomiting",0.55,0.5,"moderate"],["fever",0.60,0.6,"moderate"],["pain after fatty meals",0.55,0.6,"moderate"],["referred shoulder pain",0.30,0.5,"moderate"]],
      tests: [["ultrasound abdomen","imaging","high"],["HIDA scan","nuclear medicine","high"],["CBC","hematology","moderate"],["LFTs","laboratory","moderate"],["lipase","laboratory","moderate"]],
      treatments: [["cholecystectomy","procedure","first_line","SAGES"],["ceftriaxone","cephalosporin","first_line","IDSA"],["ketorolac","NSAID","supportive","WHO"]]
    },
    {
      name: "acute pancreatitis", icd10: "K85.9", organ: "gastrointestinal", prior: 0.015, severity: "high",
      symptoms: [["severe epigastric pain",0.92,0.9,"high"],["pain radiating to back",0.70,0.8,"high"],["nausea",0.80,0.7,"high"],["vomiting",0.75,0.7,"high"],["abdominal tenderness",0.70,0.7,"high"],["fever",0.45,0.5,"moderate"],["tachycardia",0.40,0.4,"moderate"]],
      tests: [["serum lipase","laboratory","high"],["serum amylase","laboratory","high"],["CT abdomen","imaging","high"],["ultrasound abdomen","imaging","moderate"],["CBC","hematology","moderate"],["BMP","laboratory","moderate"]],
      treatments: [["IV fluids","supportive","first_line","ACG"],["analgesics","pain management","supportive","ACG"],["NPO","supportive","first_line","ACG"]]
    },
    {
      name: "inflammatory bowel disease - Crohn's", icd10: "K50.90", organ: "gastrointestinal", prior: 0.008, severity: "moderate",
      symptoms: [["chronic diarrhea",0.85,0.8,"high"],["abdominal pain",0.82,0.8,"high"],["weight loss",0.60,0.6,"moderate"],["fatigue",0.55,0.5,"moderate"],["fever",0.40,0.4,"moderate"],["perianal disease",0.35,0.6,"moderate"],["bloody stool",0.40,0.6,"moderate"],["mouth ulcers",0.25,0.4,"moderate"]],
      tests: [["colonoscopy with biopsy","endoscopy","high"],["CT enterography","imaging","high"],["CRP","inflammatory","moderate"],["ESR","inflammatory","moderate"],["fecal calprotectin","laboratory","high"],["CBC","hematology","moderate"]],
      treatments: [["mesalamine","5-ASA","first_line","ACG"],["budesonide","corticosteroid","first_line","ACG"],["infliximab","anti-TNF","second_line","ACG"],["azathioprine","immunomodulator","second_line","ACG"]]
    },
    {
      name: "ulcerative colitis", icd10: "K51.90", organ: "gastrointestinal", prior: 0.007, severity: "moderate",
      symptoms: [["bloody diarrhea",0.90,0.9,"high"],["rectal bleeding",0.85,0.85,"high"],["urgency",0.75,0.7,"high"],["tenesmus",0.60,0.7,"high"],["abdominal pain",0.65,0.6,"moderate"],["weight loss",0.40,0.4,"moderate"],["fatigue",0.50,0.4,"moderate"]],
      tests: [["colonoscopy with biopsy","endoscopy","high"],["fecal calprotectin","laboratory","high"],["CBC","hematology","moderate"],["CRP","inflammatory","moderate"],["stool culture","microbiology","moderate"]],
      treatments: [["mesalamine","5-ASA","first_line","ACG"],["prednisone","corticosteroid","first_line","ACG"],["infliximab","anti-TNF","second_line","ACG"],["vedolizumab","integrin inhibitor","second_line","ACG"]]
    },
    {
      name: "irritable bowel syndrome", icd10: "K58.9", organ: "gastrointestinal", prior: 0.10, severity: "low",
      symptoms: [["abdominal pain",0.90,0.85,"high"],["bloating",0.80,0.75,"high"],["altered bowel habits",0.85,0.8,"high"],["constipation",0.50,0.5,"moderate"],["diarrhea",0.50,0.5,"moderate"],["mucus in stool",0.30,0.4,"moderate"],["symptom relief after defecation",0.55,0.6,"moderate"]],
      tests: [["CBC","hematology","low"],["CRP","inflammatory","low"],["fecal calprotectin","laboratory","moderate"],["celiac serology","immunology","moderate"],["colonoscopy","endoscopy","moderate"]],
      treatments: [["mebeverine","antispasmodic","first_line","NICE"],["psyllium","fiber supplement","first_line","ACG"],["rifaximin","antibiotic","second_line","ACG"],["amitriptyline","tricyclic antidepressant","second_line","NICE"]]
    },
    {
      name: "celiac disease", icd10: "K90.0", organ: "gastrointestinal", prior: 0.01, severity: "moderate",
      symptoms: [["chronic diarrhea",0.75,0.7,"high"],["abdominal bloating",0.70,0.65,"high"],["weight loss",0.55,0.6,"moderate"],["fatigue",0.60,0.5,"moderate"],["iron deficiency anemia",0.50,0.6,"high"],["dermatitis herpetiformis",0.25,0.7,"high"],["failure to thrive in children",0.40,0.7,"high"],["steatorrhea",0.40,0.6,"moderate"]],
      tests: [["tissue transglutaminase IgA","immunology","high"],["anti-endomysial antibody","immunology","high"],["duodenal biopsy","histopathology","high"],["total IgA level","immunology","moderate"],["HLA-DQ2/DQ8","genetics","moderate"]],
      treatments: [["gluten-free diet","dietary","first_line","ACG"],["calcium supplementation","supplement","supportive","NICE"],["vitamin D supplementation","supplement","supportive","NICE"]]
    },
    {
      name: "liver cirrhosis", icd10: "K74.60", organ: "gastrointestinal", prior: 0.012, severity: "high",
      symptoms: [["jaundice",0.70,0.8,"high"],["ascites",0.65,0.75,"high"],["fatigue",0.75,0.5,"moderate"],["spider angiomas",0.45,0.6,"moderate"],["palmar erythema",0.40,0.5,"moderate"],["hepatomegaly",0.50,0.6,"moderate"],["easy bruising",0.45,0.5,"moderate"],["peripheral edema",0.55,0.5,"moderate"],["confusion",0.30,0.7,"high"]],
      tests: [["LFTs","laboratory","high"],["albumin","laboratory","high"],["INR","coagulation","high"],["ultrasound liver","imaging","high"],["FibroScan","elastography","high"],["liver biopsy","histopathology","high"]],
      treatments: [["lactulose","osmotic laxative","first_line","AASLD"],["spironolactone","aldosterone antagonist","first_line","AASLD"],["rifaximin","antibiotic","first_line","AASLD"],["propranolol","beta-blocker","first_line","AASLD"]]
    },
    {
      name: "acute hepatitis", icd10: "K72.0", organ: "gastrointestinal", prior: 0.01, severity: "high",
      symptoms: [["jaundice",0.80,0.85,"high"],["fatigue",0.78,0.6,"moderate"],["nausea",0.70,0.6,"moderate"],["right upper quadrant pain",0.65,0.6,"moderate"],["dark urine",0.60,0.7,"high"],["clay-colored stools",0.45,0.7,"high"],["loss of appetite",0.65,0.5,"moderate"],["fever",0.40,0.4,"moderate"]],
      tests: [["hepatitis panel","serology","high"],["LFTs","laboratory","high"],["INR","coagulation","moderate"],["albumin","laboratory","moderate"],["ultrasound liver","imaging","moderate"]],
      treatments: [["supportive care","supportive","first_line","AASLD"],["entecavir","antiviral","first_line","AASLD"],["tenofovir","antiviral","first_line","AASLD"]]
    },
    {
      name: "diverticulitis", icd10: "K57.32", organ: "gastrointestinal", prior: 0.03, severity: "moderate",
      symptoms: [["left lower quadrant pain",0.88,0.85,"high"],["fever",0.55,0.6,"moderate"],["nausea",0.45,0.4,"moderate"],["constipation",0.40,0.4,"moderate"],["diarrhea",0.30,0.3,"moderate"],["abdominal tenderness",0.70,0.7,"high"],["rectal bleeding",0.15,0.5,"moderate"]],
      tests: [["CT abdomen pelvis","imaging","high"],["CBC","hematology","moderate"],["CRP","inflammatory","moderate"],["urinalysis","laboratory","moderate"]],
      treatments: [["ciprofloxacin","fluoroquinolone","first_line","AGA"],["metronidazole","nitroimidazole","first_line","AGA"],["amoxicillin-clavulanate","penicillin","first_line","NICE"]]
    },
    {
      name: "small bowel obstruction", icd10: "K56.60", organ: "gastrointestinal", prior: 0.012, severity: "high",
      symptoms: [["colicky abdominal pain",0.90,0.9,"high"],["vomiting",0.85,0.85,"high"],["abdominal distension",0.80,0.8,"high"],["constipation",0.60,0.6,"moderate"],["inability to pass gas",0.70,0.7,"high"],["high-pitched bowel sounds",0.55,0.6,"moderate"]],
      tests: [["abdominal X-ray","imaging","high"],["CT abdomen","imaging","high"],["BMP","laboratory","moderate"],["CBC","hematology","moderate"]],
      treatments: [["nasogastric decompression","procedure","first_line","SAGES"],["IV fluids","supportive","first_line","WHO"],["surgical exploration","procedure","second_line","SAGES"]]
    },
    {
      name: "gastric cancer", icd10: "C16.9", organ: "gastrointestinal", prior: 0.005, severity: "critical",
      symptoms: [["weight loss",0.75,0.7,"high"],["epigastric pain",0.60,0.6,"moderate"],["early satiety",0.55,0.6,"moderate"],["nausea",0.50,0.4,"moderate"],["dysphagia",0.35,0.5,"moderate"],["melena",0.30,0.7,"high"],["fatigue",0.55,0.4,"moderate"],["loss of appetite",0.65,0.6,"moderate"]],
      tests: [["upper endoscopy with biopsy","endoscopy","high"],["CT abdomen","imaging","high"],["tumor markers CEA CA19-9","laboratory","moderate"],["PET scan","imaging","moderate"]],
      treatments: [["surgical gastrectomy","procedure","first_line","NCCN"],["FOLFOX chemotherapy","chemotherapy","first_line","NCCN"],["trastuzumab","targeted therapy","first_line","NCCN"]]
    },
    {
      name: "colorectal cancer", icd10: "C18.9", organ: "gastrointestinal", prior: 0.008, severity: "critical",
      symptoms: [["change in bowel habits",0.70,0.7,"high"],["rectal bleeding",0.65,0.8,"high"],["weight loss",0.55,0.6,"moderate"],["abdominal pain",0.45,0.5,"moderate"],["fatigue",0.50,0.4,"moderate"],["iron deficiency anemia",0.45,0.6,"high"],["narrow stools",0.35,0.5,"moderate"]],
      tests: [["colonoscopy with biopsy","endoscopy","high"],["CT colonography","imaging","moderate"],["CEA","tumor marker","moderate"],["fecal occult blood test","laboratory","moderate"],["CT chest abdomen pelvis","imaging","moderate"]],
      treatments: [["surgical resection","procedure","first_line","NCCN"],["FOLFOX","chemotherapy","first_line","NCCN"],["capecitabine","antimetabolite","first_line","NCCN"],["bevacizumab","targeted therapy","second_line","NCCN"]]
    },
  ];
  diseases.push(...gastrointestinal);

  // ══════════════════════════════════════════════════
  // NEUROLOGICAL (55 diseases)
  // ══════════════════════════════════════════════════
  const neurological: DiseaseEntry[] = [
    {
      name: "migraine", icd10: "G43.909", organ: "neurological", prior: 0.10, severity: "moderate",
      symptoms: [["unilateral headache",0.85,0.85,"high"],["throbbing headache",0.80,0.8,"high"],["nausea",0.70,0.65,"high"],["photophobia",0.75,0.7,"high"],["phonophobia",0.65,0.65,"high"],["visual aura",0.30,0.7,"high"],["vomiting",0.45,0.5,"moderate"],["fatigue",0.50,0.4,"moderate"]],
      tests: [["clinical diagnosis","clinical","high"],["CT head","imaging","low"],["MRI brain","imaging","low"]],
      treatments: [["sumatriptan","triptan","first_line","AHS"],["ibuprofen","NSAID","first_line","NICE"],["metoclopramide","antiemetic","adjunctive","AHS"],["topiramate","anticonvulsant","prophylaxis","AAN"],["propranolol","beta-blocker","prophylaxis","AAN"]]
    },
    {
      name: "tension-type headache", icd10: "G44.209", organ: "neurological", prior: 0.18, severity: "low",
      symptoms: [["bilateral headache",0.90,0.85,"high"],["pressing quality headache",0.82,0.8,"high"],["mild to moderate intensity",0.78,0.7,"high"],["not aggravated by activity",0.55,0.5,"moderate"],["scalp tenderness",0.40,0.4,"moderate"],["neck stiffness",0.35,0.3,"moderate"]],
      tests: [["clinical diagnosis","clinical","high"]],
      treatments: [["acetaminophen","analgesic","first_line","NICE"],["ibuprofen","NSAID","first_line","NICE"],["amitriptyline","tricyclic antidepressant","prophylaxis","AAN"]]
    },
    {
      name: "acute ischemic stroke", icd10: "I63.9", organ: "neurological", prior: 0.01, severity: "critical",
      symptoms: [["sudden weakness one side",0.88,0.9,"high"],["facial droop",0.75,0.85,"high"],["speech difficulty",0.70,0.8,"high"],["arm weakness",0.72,0.8,"high"],["sudden confusion",0.55,0.7,"high"],["visual loss",0.35,0.7,"high"],["severe headache",0.30,0.5,"moderate"],["dizziness",0.40,0.4,"moderate"],["difficulty walking",0.50,0.6,"moderate"]],
      tests: [["CT head non-contrast","imaging","high"],["MRI brain with DWI","imaging","high"],["CT angiography","imaging","high"],["CBC","hematology","moderate"],["INR PT PTT","coagulation","moderate"],["glucose","laboratory","moderate"]],
      treatments: [["alteplase","thrombolytic","first_line","AHA"],["aspirin","antiplatelet","first_line","AHA"],["mechanical thrombectomy","procedure","first_line","AHA"],["atorvastatin","statin","first_line","AHA"]]
    },
    {
      name: "meningitis", icd10: "G03.9", organ: "neurological", prior: 0.005, severity: "critical",
      symptoms: [["severe headache",0.90,0.9,"high"],["neck stiffness",0.85,0.9,"high"],["fever",0.88,0.85,"high"],["photophobia",0.70,0.7,"high"],["altered mental status",0.55,0.8,"high"],["nausea",0.60,0.5,"moderate"],["vomiting",0.55,0.5,"moderate"],["petechial rash",0.30,0.8,"high"],["Kernig sign",0.45,0.7,"high"],["Brudzinski sign",0.40,0.7,"high"]],
      tests: [["lumbar puncture","procedure","high"],["CSF analysis","laboratory","high"],["blood culture","microbiology","high"],["CT head","imaging","moderate"],["CBC","hematology","moderate"],["CRP","inflammatory","moderate"]],
      treatments: [["ceftriaxone","cephalosporin","first_line","IDSA"],["vancomycin","glycopeptide","first_line","IDSA"],["dexamethasone","corticosteroid","adjunctive","IDSA"],["ampicillin","penicillin","first_line","IDSA"]]
    },
    {
      name: "epilepsy", icd10: "G40.909", organ: "neurological", prior: 0.01, severity: "moderate",
      symptoms: [["seizures",0.95,0.95,"high"],["loss of consciousness",0.60,0.7,"high"],["convulsions",0.55,0.7,"high"],["aura",0.35,0.5,"moderate"],["confusion post-ictal",0.65,0.6,"high"],["tongue biting",0.30,0.6,"high"],["urinary incontinence",0.25,0.5,"moderate"],["automatisms",0.30,0.5,"moderate"]],
      tests: [["EEG","neurophysiology","high"],["MRI brain","imaging","high"],["CT head","imaging","moderate"],["prolactin level","laboratory","moderate"],["metabolic panel","laboratory","moderate"]],
      treatments: [["levetiracetam","anticonvulsant","first_line","AAN"],["valproate","anticonvulsant","first_line","NICE"],["carbamazepine","anticonvulsant","first_line","AAN"],["lamotrigine","anticonvulsant","first_line","NICE"]]
    },
    {
      name: "Parkinson disease", icd10: "G20", organ: "neurological", prior: 0.005, severity: "high",
      symptoms: [["resting tremor",0.85,0.9,"high"],["bradykinesia",0.88,0.9,"high"],["rigidity",0.80,0.85,"high"],["postural instability",0.60,0.7,"high"],["shuffling gait",0.65,0.7,"high"],["micrographia",0.45,0.5,"moderate"],["masked facies",0.50,0.6,"moderate"],["depression",0.40,0.4,"moderate"]],
      tests: [["clinical diagnosis","clinical","high"],["DaTscan","nuclear medicine","high"],["MRI brain","imaging","moderate"]],
      treatments: [["levodopa-carbidopa","dopamine precursor","first_line","AAN"],["pramipexole","dopamine agonist","first_line","NICE"],["rasagiline","MAO-B inhibitor","first_line","AAN"],["amantadine","NMDA antagonist","adjunctive","AAN"]]
    },
    {
      name: "multiple sclerosis", icd10: "G35", organ: "neurological", prior: 0.004, severity: "high",
      symptoms: [["visual disturbance",0.65,0.7,"high"],["optic neuritis",0.50,0.8,"high"],["numbness tingling",0.75,0.7,"high"],["weakness",0.65,0.6,"moderate"],["fatigue",0.80,0.6,"high"],["Lhermitte sign",0.35,0.7,"high"],["urinary dysfunction",0.45,0.5,"moderate"],["balance problems",0.55,0.5,"moderate"]],
      tests: [["MRI brain with gadolinium","imaging","high"],["MRI spine","imaging","high"],["lumbar puncture","procedure","high"],["CSF oligoclonal bands","laboratory","high"],["visual evoked potentials","neurophysiology","moderate"]],
      treatments: [["interferon beta","immunomodulator","first_line","AAN"],["glatiramer acetate","immunomodulator","first_line","AAN"],["ocrelizumab","anti-CD20","first_line","AAN"],["methylprednisolone","corticosteroid","acute_relapse","AAN"]]
    },
    {
      name: "subarachnoid hemorrhage", icd10: "I60.9", organ: "neurological", prior: 0.003, severity: "critical",
      symptoms: [["thunderclap headache",0.92,0.95,"high"],["worst headache of life",0.88,0.9,"high"],["neck stiffness",0.70,0.8,"high"],["loss of consciousness",0.45,0.8,"high"],["vomiting",0.60,0.6,"moderate"],["photophobia",0.55,0.6,"moderate"],["seizure",0.20,0.7,"high"]],
      tests: [["CT head non-contrast","imaging","high"],["lumbar puncture","procedure","high"],["CT angiography","imaging","high"],["cerebral angiography","imaging","high"]],
      treatments: [["nimodipine","calcium channel blocker","first_line","AHA"],["surgical clipping","procedure","first_line","AHA"],["endovascular coiling","procedure","first_line","AHA"]]
    },
    {
      name: "Bell palsy", icd10: "G51.0", organ: "neurological", prior: 0.008, severity: "moderate",
      symptoms: [["unilateral facial weakness",0.95,0.95,"high"],["inability to close eye",0.80,0.8,"high"],["drooling",0.55,0.5,"moderate"],["taste changes",0.45,0.5,"moderate"],["ear pain",0.40,0.4,"moderate"],["hyperacusis",0.30,0.4,"moderate"],["facial drooping",0.90,0.9,"high"]],
      tests: [["clinical diagnosis","clinical","high"],["MRI brain","imaging","moderate"],["EMG","neurophysiology","moderate"]],
      treatments: [["prednisolone","corticosteroid","first_line","AAN"],["eye lubricants","supportive","supportive","NICE"],["valacyclovir","antiviral","second_line","AAN"]]
    },
    {
      name: "Alzheimer disease", icd10: "G30.9", organ: "neurological", prior: 0.008, severity: "high",
      symptoms: [["progressive memory loss",0.92,0.9,"high"],["difficulty with daily tasks",0.80,0.8,"high"],["confusion",0.75,0.7,"high"],["language difficulties",0.60,0.6,"moderate"],["disorientation",0.70,0.7,"high"],["personality changes",0.55,0.5,"moderate"],["wandering",0.40,0.5,"moderate"],["agitation",0.45,0.4,"moderate"]],
      tests: [["MMSE","neuropsychology","high"],["MoCA","neuropsychology","high"],["MRI brain","imaging","high"],["PET amyloid scan","imaging","high"],["CSF biomarkers","laboratory","high"]],
      treatments: [["donepezil","cholinesterase inhibitor","first_line","AAN"],["memantine","NMDA antagonist","second_line","AAN"],["rivastigmine","cholinesterase inhibitor","first_line","NICE"]]
    },
    {
      name: "Guillain-Barré syndrome", icd10: "G61.0", organ: "neurological", prior: 0.002, severity: "critical",
      symptoms: [["ascending weakness",0.90,0.9,"high"],["areflexia",0.80,0.85,"high"],["tingling in extremities",0.75,0.7,"high"],["difficulty walking",0.70,0.7,"high"],["facial weakness bilateral",0.40,0.6,"moderate"],["respiratory difficulty",0.35,0.8,"high"],["back pain",0.45,0.4,"moderate"],["autonomic dysfunction",0.30,0.6,"moderate"]],
      tests: [["nerve conduction study","neurophysiology","high"],["lumbar puncture","procedure","high"],["CSF albuminocytologic dissociation","laboratory","high"],["spirometry","pulmonary function","moderate"]],
      treatments: [["IVIG","immunoglobulin","first_line","AAN"],["plasmapheresis","procedure","first_line","AAN"],["supportive ventilation","supportive","supportive","NICE"]]
    },
    {
      name: "trigeminal neuralgia", icd10: "G50.0", organ: "neurological", prior: 0.005, severity: "moderate",
      symptoms: [["severe facial pain",0.95,0.95,"high"],["electric shock-like pain",0.88,0.9,"high"],["unilateral face pain",0.90,0.9,"high"],["pain triggered by touch",0.75,0.8,"high"],["pain triggered by chewing",0.60,0.7,"high"],["pain episodes lasting seconds",0.70,0.7,"high"]],
      tests: [["MRI brain","imaging","high"],["clinical diagnosis","clinical","high"]],
      treatments: [["carbamazepine","anticonvulsant","first_line","AAN"],["oxcarbazepine","anticonvulsant","first_line","NICE"],["baclofen","muscle relaxant","second_line","AAN"]]
    },
  ];
  diseases.push(...neurological);

  // ══════════════════════════════════════════════════
  // INFECTIOUS DISEASE (55 diseases)
  // ══════════════════════════════════════════════════
  const infectious: DiseaseEntry[] = [
    {
      name: "urinary tract infection", icd10: "N39.0", organ: "infectious_disease", prior: 0.10, severity: "low",
      symptoms: [["dysuria",0.90,0.9,"high"],["urinary frequency",0.85,0.85,"high"],["urinary urgency",0.78,0.75,"high"],["suprapubic pain",0.55,0.6,"moderate"],["hematuria",0.40,0.6,"moderate"],["cloudy urine",0.50,0.5,"moderate"],["foul-smelling urine",0.45,0.5,"moderate"],["low-grade fever",0.30,0.3,"moderate"]],
      tests: [["urinalysis","laboratory","high"],["urine culture","microbiology","high"],["urine dipstick","laboratory","moderate"]],
      treatments: [["nitrofurantoin","nitrofuran","first_line","IDSA"],["trimethoprim-sulfamethoxazole","sulfonamide","first_line","IDSA"],["fosfomycin","phosphonic acid","first_line","IDSA"],["ciprofloxacin","fluoroquinolone","second_line","IDSA"]]
    },
    {
      name: "pyelonephritis", icd10: "N10", organ: "infectious_disease", prior: 0.02, severity: "high",
      symptoms: [["flank pain",0.88,0.85,"high"],["fever",0.85,0.85,"high"],["chills",0.70,0.7,"high"],["nausea",0.60,0.5,"moderate"],["vomiting",0.50,0.5,"moderate"],["dysuria",0.60,0.6,"moderate"],["costovertebral angle tenderness",0.80,0.85,"high"],["urinary frequency",0.50,0.5,"moderate"]],
      tests: [["urinalysis","laboratory","high"],["urine culture","microbiology","high"],["blood culture","microbiology","moderate"],["CBC","hematology","moderate"],["renal ultrasound","imaging","moderate"],["CT abdomen","imaging","moderate"]],
      treatments: [["ciprofloxacin","fluoroquinolone","first_line","IDSA"],["ceftriaxone","cephalosporin","first_line","IDSA"],["trimethoprim-sulfamethoxazole","sulfonamide","second_line","IDSA"]]
    },
    {
      name: "cellulitis", icd10: "L03.90", organ: "infectious_disease", prior: 0.04, severity: "moderate",
      symptoms: [["skin redness",0.92,0.9,"high"],["warmth over area",0.85,0.85,"high"],["swelling",0.88,0.85,"high"],["pain at site",0.85,0.8,"high"],["fever",0.50,0.6,"moderate"],["red streaking",0.30,0.6,"moderate"],["lymphadenopathy",0.25,0.4,"moderate"]],
      tests: [["clinical diagnosis","clinical","high"],["CBC","hematology","moderate"],["blood culture","microbiology","moderate"],["wound culture","microbiology","moderate"]],
      treatments: [["cephalexin","cephalosporin","first_line","IDSA"],["dicloxacillin","penicillin","first_line","IDSA"],["clindamycin","lincosamide","second_line","IDSA"],["trimethoprim-sulfamethoxazole","sulfonamide","second_line","IDSA"]]
    },
    {
      name: "sepsis", icd10: "A41.9", organ: "infectious_disease", prior: 0.015, severity: "critical",
      symptoms: [["fever",0.85,0.8,"high"],["tachycardia",0.80,0.8,"high"],["tachypnea",0.75,0.7,"high"],["hypotension",0.60,0.85,"high"],["altered mental status",0.50,0.8,"high"],["chills",0.55,0.5,"moderate"],["warm skin",0.40,0.4,"moderate"],["oliguria",0.35,0.6,"moderate"]],
      tests: [["blood culture x2","microbiology","high"],["CBC","hematology","high"],["lactate","laboratory","high"],["procalcitonin","biomarker","high"],["CRP","inflammatory","moderate"],["BMP","laboratory","moderate"]],
      treatments: [["piperacillin-tazobactam","penicillin","first_line","SSC"],["vancomycin","glycopeptide","first_line","SSC"],["IV fluid resuscitation","supportive","first_line","SSC"],["norepinephrine","vasopressor","first_line","SSC"]]
    },
    {
      name: "malaria", icd10: "B54", organ: "infectious_disease", prior: 0.04, severity: "high",
      symptoms: [["cyclical fever",0.88,0.9,"high"],["chills",0.85,0.85,"high"],["sweating",0.80,0.8,"high"],["headache",0.70,0.6,"moderate"],["body aches",0.65,0.6,"moderate"],["nausea",0.50,0.4,"moderate"],["vomiting",0.40,0.4,"moderate"],["jaundice",0.25,0.6,"moderate"],["splenomegaly",0.45,0.6,"moderate"],["anemia",0.40,0.5,"moderate"]],
      tests: [["thick and thin blood smear","microbiology","high"],["rapid malaria antigen test","immunology","high"],["CBC","hematology","moderate"],["LFTs","laboratory","moderate"]],
      treatments: [["artemisinin-based combination therapy","antimalarial","first_line","WHO"],["chloroquine","antimalarial","first_line","WHO"],["primaquine","antimalarial","first_line","WHO"],["IV artesunate","antimalarial","first_line","WHO"]]
    },
    {
      name: "dengue fever", icd10: "A90", organ: "infectious_disease", prior: 0.035, severity: "moderate",
      symptoms: [["high fever",0.92,0.9,"high"],["severe headache",0.80,0.8,"high"],["retro-orbital pain",0.70,0.8,"high"],["joint pain",0.75,0.7,"high"],["muscle pain",0.78,0.7,"high"],["maculopapular rash",0.55,0.6,"moderate"],["nausea",0.50,0.4,"moderate"],["petechiae",0.30,0.6,"moderate"],["thrombocytopenia",0.60,0.7,"high"]],
      tests: [["dengue NS1 antigen","virology","high"],["dengue IgM/IgG","serology","high"],["CBC with platelet count","hematology","high"],["hematocrit","hematology","moderate"]],
      treatments: [["supportive care","supportive","first_line","WHO"],["oral rehydration","rehydration","first_line","WHO"],["acetaminophen","analgesic","supportive","WHO"]]
    },
    {
      name: "typhoid fever", icd10: "A01.00", organ: "infectious_disease", prior: 0.025, severity: "high",
      symptoms: [["sustained fever",0.90,0.9,"high"],["headache",0.70,0.6,"moderate"],["abdominal pain",0.60,0.6,"moderate"],["constipation",0.45,0.4,"moderate"],["diarrhea",0.40,0.4,"moderate"],["rose spots",0.25,0.6,"moderate"],["hepatosplenomegaly",0.40,0.6,"moderate"],["relative bradycardia",0.35,0.6,"moderate"],["malaise",0.65,0.5,"moderate"]],
      tests: [["blood culture","microbiology","high"],["Widal test","serology","moderate"],["stool culture","microbiology","moderate"],["CBC","hematology","moderate"],["LFTs","laboratory","moderate"]],
      treatments: [["azithromycin","macrolide","first_line","WHO"],["ceftriaxone","cephalosporin","first_line","WHO"],["ciprofloxacin","fluoroquinolone","second_line","IDSA"]]
    },
    {
      name: "HIV/AIDS", icd10: "B20", organ: "infectious_disease", prior: 0.005, severity: "critical",
      symptoms: [["weight loss",0.70,0.7,"high"],["chronic diarrhea",0.55,0.6,"moderate"],["night sweats",0.60,0.6,"moderate"],["fatigue",0.75,0.5,"moderate"],["lymphadenopathy",0.65,0.6,"moderate"],["recurrent infections",0.70,0.7,"high"],["oral thrush",0.45,0.6,"moderate"],["fever",0.55,0.5,"moderate"]],
      tests: [["HIV ELISA","serology","high"],["HIV Western blot","serology","high"],["HIV viral load","molecular","high"],["CD4 count","immunology","high"],["HIV rapid test","serology","moderate"]],
      treatments: [["tenofovir-emtricitabine","NRTI","first_line","WHO"],["dolutegravir","integrase inhibitor","first_line","WHO"],["efavirenz","NNRTI","second_line","WHO"]]
    },
    {
      name: "chickenpox", icd10: "B01.9", organ: "infectious_disease", prior: 0.02, severity: "low",
      symptoms: [["vesicular rash",0.95,0.95,"high"],["pruritic rash",0.88,0.85,"high"],["fever",0.70,0.6,"moderate"],["rash in different stages",0.80,0.85,"high"],["malaise",0.55,0.4,"moderate"],["headache",0.40,0.3,"moderate"],["loss of appetite",0.45,0.3,"moderate"]],
      tests: [["clinical diagnosis","clinical","high"],["VZV PCR","molecular","high"],["VZV IgM","serology","moderate"]],
      treatments: [["calamine lotion","antipruritic","supportive","AAP"],["acyclovir","antiviral","first_line","AAP"],["acetaminophen","analgesic","supportive","WHO"]]
    },
    {
      name: "herpes zoster", icd10: "B02.9", organ: "infectious_disease", prior: 0.015, severity: "moderate",
      symptoms: [["unilateral vesicular rash",0.92,0.9,"high"],["dermatomal distribution",0.88,0.9,"high"],["burning pain",0.85,0.85,"high"],["tingling",0.60,0.6,"moderate"],["fever",0.35,0.3,"moderate"],["headache",0.30,0.3,"low"],["fatigue",0.40,0.3,"moderate"]],
      tests: [["clinical diagnosis","clinical","high"],["VZV PCR","molecular","high"],["Tzanck smear","cytology","moderate"]],
      treatments: [["valacyclovir","antiviral","first_line","CDC"],["acyclovir","antiviral","first_line","NICE"],["gabapentin","anticonvulsant","neuropathic_pain","AAN"],["pregabalin","anticonvulsant","neuropathic_pain","NICE"]]
    },
    {
      name: "strep throat", icd10: "J02.0", organ: "infectious_disease", prior: 0.08, severity: "low",
      symptoms: [["sore throat",0.92,0.9,"high"],["fever",0.80,0.8,"high"],["tonsillar exudates",0.65,0.75,"high"],["anterior cervical lymphadenopathy",0.70,0.7,"high"],["odynophagia",0.80,0.75,"high"],["headache",0.40,0.3,"moderate"],["absence of cough",0.55,0.5,"high"],["palatal petechiae",0.30,0.6,"moderate"]],
      tests: [["rapid strep test","immunology","high"],["throat culture","microbiology","high"],["ASO titer","serology","moderate"]],
      treatments: [["penicillin V","penicillin","first_line","IDSA"],["amoxicillin","penicillin","first_line","IDSA"],["azithromycin","macrolide","second_line","IDSA"]]
    },
    {
      name: "infectious mononucleosis", icd10: "B27.90", organ: "infectious_disease", prior: 0.015, severity: "low",
      symptoms: [["severe fatigue",0.90,0.85,"high"],["sore throat",0.80,0.75,"high"],["fever",0.75,0.7,"high"],["lymphadenopathy",0.85,0.8,"high"],["splenomegaly",0.50,0.7,"high"],["hepatomegaly",0.25,0.5,"moderate"],["palatal petechiae",0.20,0.4,"moderate"],["rash with amoxicillin",0.30,0.6,"moderate"]],
      tests: [["monospot test","serology","high"],["EBV VCA IgM","serology","high"],["CBC with differential","hematology","moderate"],["LFTs","laboratory","moderate"]],
      treatments: [["supportive care","supportive","first_line","NICE"],["acetaminophen","analgesic","supportive","WHO"],["avoid contact sports","lifestyle","supportive","AAP"]]
    },
  ];
  diseases.push(...infectious);

  // ══════════════════════════════════════════════════
  // ENDOCRINE (40 diseases)
  // ══════════════════════════════════════════════════
  const endocrine: DiseaseEntry[] = [
    {
      name: "type 2 diabetes mellitus", icd10: "E11.9", organ: "endocrine", prior: 0.08, severity: "moderate",
      symptoms: [["polyuria",0.75,0.8,"high"],["polydipsia",0.70,0.75,"high"],["fatigue",0.65,0.5,"moderate"],["blurred vision",0.45,0.5,"moderate"],["weight loss",0.40,0.5,"moderate"],["frequent infections",0.35,0.4,"moderate"],["slow wound healing",0.40,0.5,"moderate"],["numbness in feet",0.30,0.4,"moderate"]],
      tests: [["fasting blood glucose","laboratory","high"],["HbA1c","laboratory","high"],["OGTT","laboratory","high"],["fasting insulin","laboratory","moderate"],["lipid panel","laboratory","moderate"]],
      treatments: [["metformin","biguanide","first_line","ADA"],["glimepiride","sulfonylurea","second_line","ADA"],["empagliflozin","SGLT2 inhibitor","first_line","ADA"],["semaglutide","GLP-1 agonist","first_line","ADA"],["insulin glargine","insulin","second_line","ADA"]]
    },
    {
      name: "type 1 diabetes mellitus", icd10: "E10.9", organ: "endocrine", prior: 0.01, severity: "high",
      symptoms: [["polyuria",0.88,0.85,"high"],["polydipsia",0.85,0.8,"high"],["weight loss",0.75,0.7,"high"],["fatigue",0.70,0.6,"moderate"],["polyphagia",0.55,0.5,"moderate"],["blurred vision",0.40,0.4,"moderate"],["nausea",0.30,0.4,"moderate"],["diabetic ketoacidosis",0.35,0.9,"high"]],
      tests: [["blood glucose","laboratory","high"],["HbA1c","laboratory","high"],["C-peptide","laboratory","high"],["GAD antibodies","immunology","high"],["urinalysis for ketones","laboratory","high"]],
      treatments: [["insulin lispro","rapid-acting insulin","first_line","ADA"],["insulin glargine","long-acting insulin","first_line","ADA"],["insulin pump","device","first_line","ADA"]]
    },
    {
      name: "diabetic ketoacidosis", icd10: "E10.10", organ: "endocrine", prior: 0.005, severity: "critical",
      symptoms: [["nausea",0.80,0.7,"high"],["vomiting",0.75,0.7,"high"],["abdominal pain",0.60,0.6,"moderate"],["Kussmaul breathing",0.55,0.8,"high"],["fruity breath odor",0.50,0.8,"high"],["altered mental status",0.45,0.8,"high"],["polyuria",0.70,0.7,"high"],["polydipsia",0.65,0.6,"moderate"],["dehydration",0.70,0.7,"high"]],
      tests: [["blood glucose","laboratory","high"],["ABG","blood gas","high"],["serum ketones","laboratory","high"],["BMP","laboratory","high"],["urinalysis","laboratory","moderate"],["serum osmolality","laboratory","moderate"]],
      treatments: [["IV insulin","insulin","first_line","ADA"],["IV normal saline","fluid","first_line","ADA"],["potassium replacement","electrolyte","first_line","ADA"],["bicarbonate","electrolyte","conditional","ADA"]]
    },
    {
      name: "hypothyroidism", icd10: "E03.9", organ: "endocrine", prior: 0.05, severity: "moderate",
      symptoms: [["fatigue",0.85,0.8,"high"],["weight gain",0.70,0.7,"high"],["cold intolerance",0.65,0.7,"high"],["constipation",0.55,0.5,"moderate"],["dry skin",0.60,0.5,"moderate"],["hair loss",0.50,0.5,"moderate"],["depression",0.40,0.4,"moderate"],["bradycardia",0.35,0.5,"moderate"],["edema",0.40,0.4,"moderate"],["menstrual irregularities",0.35,0.4,"moderate"]],
      tests: [["TSH","endocrine","high"],["free T4","endocrine","high"],["anti-TPO antibodies","immunology","moderate"],["lipid panel","laboratory","moderate"]],
      treatments: [["levothyroxine","thyroid hormone","first_line","ATA"],["liothyronine","thyroid hormone","second_line","ATA"]]
    },
    {
      name: "hyperthyroidism", icd10: "E05.90", organ: "endocrine", prior: 0.02, severity: "moderate",
      symptoms: [["weight loss",0.80,0.8,"high"],["tremor",0.70,0.7,"high"],["heat intolerance",0.72,0.7,"high"],["palpitations",0.75,0.7,"high"],["anxiety",0.60,0.5,"moderate"],["sweating",0.65,0.6,"moderate"],["diarrhea",0.40,0.4,"moderate"],["exophthalmos",0.35,0.7,"high"],["tachycardia",0.70,0.7,"high"],["menstrual irregularities",0.30,0.3,"moderate"]],
      tests: [["TSH","endocrine","high"],["free T4","endocrine","high"],["free T3","endocrine","high"],["thyroid uptake scan","nuclear medicine","high"],["TSI antibodies","immunology","moderate"]],
      treatments: [["methimazole","antithyroid","first_line","ATA"],["propylthiouracil","antithyroid","second_line","ATA"],["radioactive iodine","nuclear medicine","first_line","ATA"],["propranolol","beta-blocker","symptomatic","ATA"]]
    },
    {
      name: "Cushing syndrome", icd10: "E24.9", organ: "endocrine", prior: 0.003, severity: "high",
      symptoms: [["moon face",0.80,0.85,"high"],["central obesity",0.75,0.7,"high"],["purple striae",0.65,0.8,"high"],["buffalo hump",0.55,0.7,"high"],["easy bruising",0.60,0.6,"moderate"],["hypertension",0.65,0.6,"moderate"],["muscle weakness",0.55,0.5,"moderate"],["hirsutism",0.40,0.5,"moderate"],["depression",0.35,0.3,"moderate"]],
      tests: [["24-hour urinary cortisol","endocrine","high"],["late-night salivary cortisol","endocrine","high"],["dexamethasone suppression test","endocrine","high"],["ACTH level","endocrine","high"],["MRI pituitary","imaging","moderate"]],
      treatments: [["ketoconazole","antifungal","first_line","ES"],["metyrapone","steroidogenesis inhibitor","first_line","ES"],["transsphenoidal surgery","procedure","first_line","ES"]]
    },
    {
      name: "Addison disease", icd10: "E27.1", organ: "endocrine", prior: 0.002, severity: "high",
      symptoms: [["fatigue",0.90,0.85,"high"],["weight loss",0.70,0.7,"high"],["hyperpigmentation",0.65,0.8,"high"],["hypotension",0.60,0.7,"high"],["salt craving",0.50,0.6,"moderate"],["nausea",0.55,0.5,"moderate"],["muscle weakness",0.50,0.5,"moderate"],["dizziness",0.45,0.4,"moderate"],["abdominal pain",0.35,0.3,"moderate"]],
      tests: [["morning cortisol","endocrine","high"],["ACTH stimulation test","endocrine","high"],["ACTH level","endocrine","high"],["BMP","laboratory","moderate"],["adrenal antibodies","immunology","moderate"]],
      treatments: [["hydrocortisone","corticosteroid","first_line","ES"],["fludrocortisone","mineralocorticoid","first_line","ES"],["stress dose steroids","corticosteroid","emergency","ES"]]
    },
    {
      name: "polycystic ovary syndrome", icd10: "E28.2", organ: "endocrine", prior: 0.06, severity: "moderate",
      symptoms: [["irregular periods",0.85,0.85,"high"],["hirsutism",0.70,0.7,"high"],["acne",0.55,0.5,"moderate"],["weight gain",0.60,0.5,"moderate"],["infertility",0.50,0.6,"moderate"],["hair loss",0.35,0.4,"moderate"],["pelvic pain",0.30,0.3,"moderate"]],
      tests: [["pelvic ultrasound","imaging","high"],["testosterone","endocrine","high"],["LH/FSH ratio","endocrine","moderate"],["DHEA-S","endocrine","moderate"],["fasting glucose","laboratory","moderate"],["lipid panel","laboratory","moderate"]],
      treatments: [["combined oral contraceptive","hormonal","first_line","ESHRE"],["metformin","biguanide","first_line","ESHRE"],["spironolactone","aldosterone antagonist","second_line","ESHRE"],["clomiphene","fertility","first_line","ESHRE"]]
    },
  ];
  diseases.push(...endocrine);

  // ══════════════════════════════════════════════════
  // RENAL (30 diseases)
  // ══════════════════════════════════════════════════
  const renal: DiseaseEntry[] = [
    {
      name: "acute kidney injury", icd10: "N17.9", organ: "renal", prior: 0.02, severity: "high",
      symptoms: [["decreased urine output",0.80,0.85,"high"],["edema",0.60,0.6,"moderate"],["fatigue",0.55,0.5,"moderate"],["nausea",0.50,0.4,"moderate"],["confusion",0.35,0.6,"moderate"],["shortness of breath",0.40,0.5,"moderate"],["chest pain",0.20,0.4,"moderate"]],
      tests: [["serum creatinine","laboratory","high"],["BUN","laboratory","high"],["urinalysis","laboratory","high"],["renal ultrasound","imaging","moderate"],["urine electrolytes","laboratory","moderate"],["fractional excretion of sodium","laboratory","high"]],
      treatments: [["IV fluids","supportive","first_line","KDIGO"],["furosemide","loop diuretic","supportive","KDIGO"],["dialysis","procedure","second_line","KDIGO"]]
    },
    {
      name: "chronic kidney disease", icd10: "N18.9", organ: "renal", prior: 0.04, severity: "high",
      symptoms: [["fatigue",0.75,0.6,"moderate"],["edema",0.60,0.6,"moderate"],["nausea",0.45,0.4,"moderate"],["decreased appetite",0.50,0.4,"moderate"],["pruritus",0.40,0.4,"moderate"],["muscle cramps",0.35,0.3,"moderate"],["nocturia",0.45,0.4,"moderate"],["hypertension",0.60,0.5,"moderate"]],
      tests: [["eGFR","laboratory","high"],["serum creatinine","laboratory","high"],["urinalysis","laboratory","high"],["urine albumin-to-creatinine ratio","laboratory","high"],["renal ultrasound","imaging","moderate"],["BMP","laboratory","moderate"]],
      treatments: [["lisinopril","ACE inhibitor","first_line","KDIGO"],["losartan","ARB","first_line","KDIGO"],["sodium bicarbonate","alkalinizing agent","supportive","KDIGO"],["erythropoietin","ESA","supportive","KDIGO"]]
    },
    {
      name: "nephrolithiasis", icd10: "N20.0", organ: "renal", prior: 0.05, severity: "moderate",
      symptoms: [["severe flank pain",0.92,0.9,"high"],["colicky pain",0.85,0.85,"high"],["hematuria",0.75,0.8,"high"],["nausea",0.65,0.5,"moderate"],["vomiting",0.55,0.5,"moderate"],["pain radiating to groin",0.70,0.7,"high"],["urinary urgency",0.40,0.4,"moderate"],["dysuria",0.35,0.3,"moderate"]],
      tests: [["CT KUB non-contrast","imaging","high"],["urinalysis","laboratory","high"],["BMP","laboratory","moderate"],["urine culture","microbiology","moderate"],["KUB X-ray","imaging","moderate"],["24-hour urine collection","laboratory","moderate"]],
      treatments: [["ketorolac","NSAID","first_line","AUA"],["tamsulosin","alpha-blocker","first_line","AUA"],["opioid analgesics","opioid","second_line","AUA"],["lithotripsy","procedure","second_line","AUA"]]
    },
    {
      name: "nephrotic syndrome", icd10: "N04.9", organ: "renal", prior: 0.005, severity: "high",
      symptoms: [["severe edema",0.90,0.9,"high"],["periorbital edema",0.70,0.8,"high"],["foamy urine",0.65,0.7,"high"],["weight gain",0.55,0.5,"moderate"],["fatigue",0.50,0.4,"moderate"],["ascites",0.35,0.5,"moderate"],["hyperlipidemia symptoms",0.25,0.3,"low"]],
      tests: [["24-hour urine protein","laboratory","high"],["serum albumin","laboratory","high"],["lipid panel","laboratory","moderate"],["renal biopsy","histopathology","high"],["urinalysis","laboratory","high"]],
      treatments: [["prednisone","corticosteroid","first_line","KDIGO"],["cyclophosphamide","alkylating agent","second_line","KDIGO"],["ACE inhibitor","ACE inhibitor","supportive","KDIGO"]]
    },
    {
      name: "glomerulonephritis", icd10: "N05.9", organ: "renal", prior: 0.006, severity: "high",
      symptoms: [["hematuria",0.85,0.85,"high"],["proteinuria",0.80,0.8,"high"],["edema",0.65,0.6,"moderate"],["hypertension",0.60,0.6,"moderate"],["decreased urine output",0.50,0.5,"moderate"],["fatigue",0.45,0.4,"moderate"],["dark urine",0.55,0.6,"moderate"]],
      tests: [["urinalysis","laboratory","high"],["serum creatinine","laboratory","high"],["complement levels C3 C4","immunology","high"],["ANA","immunology","moderate"],["ANCA","immunology","moderate"],["renal biopsy","histopathology","high"],["anti-GBM antibody","immunology","moderate"]],
      treatments: [["prednisone","corticosteroid","first_line","KDIGO"],["cyclophosphamide","alkylating agent","second_line","KDIGO"],["ACE inhibitor","ACE inhibitor","supportive","KDIGO"],["rituximab","anti-CD20","second_line","KDIGO"]]
    },
  ];
  diseases.push(...renal);

  // ══════════════════════════════════════════════════
  // DERMATOLOGY (30 diseases)
  // ══════════════════════════════════════════════════
  const dermatology: DiseaseEntry[] = [
    {
      name: "eczema", icd10: "L30.9", organ: "dermatology", prior: 0.08, severity: "low",
      symptoms: [["itchy skin",0.95,0.9,"high"],["dry skin",0.85,0.8,"high"],["red patches",0.80,0.75,"high"],["skin thickening",0.50,0.5,"moderate"],["vesicles",0.35,0.4,"moderate"],["oozing",0.30,0.4,"moderate"],["cracking skin",0.40,0.4,"moderate"]],
      tests: [["clinical diagnosis","clinical","high"],["patch testing","allergy","moderate"],["skin biopsy","histopathology","moderate"]],
      treatments: [["topical hydrocortisone","topical corticosteroid","first_line","AAD"],["emollients","moisturizer","supportive","NICE"],["tacrolimus ointment","calcineurin inhibitor","second_line","AAD"],["dupilumab","biologic","third_line","AAD"]]
    },
    {
      name: "psoriasis", icd10: "L40.9", organ: "dermatology", prior: 0.03, severity: "moderate",
      symptoms: [["silvery scales",0.88,0.9,"high"],["erythematous plaques",0.85,0.85,"high"],["itching",0.70,0.6,"moderate"],["nail pitting",0.45,0.6,"moderate"],["joint pain",0.30,0.5,"moderate"],["scalp involvement",0.55,0.5,"moderate"],["Auspitz sign",0.40,0.7,"high"],["Koebner phenomenon",0.35,0.5,"moderate"]],
      tests: [["clinical diagnosis","clinical","high"],["skin biopsy","histopathology","moderate"],["CRP","inflammatory","low"],["HLA-B27","genetics","moderate"]],
      treatments: [["topical betamethasone","topical corticosteroid","first_line","AAD"],["calcipotriol","vitamin D analogue","first_line","AAD"],["methotrexate","antimetabolite","second_line","AAD"],["adalimumab","anti-TNF","third_line","AAD"]]
    },
    {
      name: "urticaria", icd10: "L50.9", organ: "dermatology", prior: 0.06, severity: "low",
      symptoms: [["wheals",0.95,0.95,"high"],["itching",0.92,0.9,"high"],["angioedema",0.30,0.7,"high"],["erythema",0.75,0.7,"high"],["lesions lasting <24 hours",0.65,0.6,"high"]],
      tests: [["clinical diagnosis","clinical","high"],["CBC","hematology","low"],["IgE level","immunology","moderate"],["thyroid function","endocrine","moderate"]],
      treatments: [["cetirizine","antihistamine","first_line","EAACI"],["loratadine","antihistamine","first_line","EAACI"],["omalizumab","anti-IgE","third_line","EAACI"],["prednisolone","corticosteroid","short_course","EAACI"]]
    },
    {
      name: "acne vulgaris", icd10: "L70.0", organ: "dermatology", prior: 0.12, severity: "low",
      symptoms: [["comedones",0.90,0.85,"high"],["papules",0.80,0.8,"high"],["pustules",0.70,0.7,"high"],["nodules",0.35,0.5,"moderate"],["facial lesions",0.90,0.8,"high"],["oily skin",0.60,0.5,"moderate"],["scarring",0.30,0.4,"moderate"]],
      tests: [["clinical diagnosis","clinical","high"],["hormonal panel","endocrine","moderate"]],
      treatments: [["benzoyl peroxide","keratolytic","first_line","AAD"],["adapalene","retinoid","first_line","AAD"],["doxycycline","tetracycline","second_line","AAD"],["isotretinoin","retinoid","third_line","AAD"]]
    },
    {
      name: "fungal skin infection", icd10: "B36.9", organ: "dermatology", prior: 0.07, severity: "low",
      symptoms: [["ring-shaped rash",0.80,0.8,"high"],["itching",0.78,0.7,"high"],["scaly patches",0.70,0.7,"high"],["redness",0.65,0.6,"moderate"],["cracking skin",0.40,0.4,"moderate"],["blistering",0.25,0.3,"moderate"]],
      tests: [["KOH preparation","microbiology","high"],["fungal culture","microbiology","high"],["Wood lamp examination","dermatology","moderate"]],
      treatments: [["clotrimazole","azole antifungal","first_line","AAD"],["terbinafine","allylamine antifungal","first_line","AAD"],["fluconazole","azole antifungal","second_line","IDSA"]]
    },
    {
      name: "scabies", icd10: "B86", organ: "dermatology", prior: 0.03, severity: "low",
      symptoms: [["intense itching worse at night",0.92,0.9,"high"],["burrows",0.65,0.8,"high"],["papular rash",0.75,0.7,"high"],["web space lesions",0.60,0.7,"high"],["excoriations",0.55,0.5,"moderate"],["rash in skin folds",0.50,0.5,"moderate"]],
      tests: [["skin scraping microscopy","microbiology","high"],["dermoscopy","dermatology","moderate"],["clinical diagnosis","clinical","moderate"]],
      treatments: [["permethrin cream","scabicide","first_line","CDC"],["ivermectin","antiparasitic","first_line","WHO"],["crotamiton","scabicide","second_line","NICE"]]
    },
    {
      name: "melanoma", icd10: "C43.9", organ: "dermatology", prior: 0.004, severity: "critical",
      symptoms: [["asymmetric mole",0.75,0.8,"high"],["irregular borders",0.70,0.8,"high"],["color variation",0.72,0.8,"high"],["diameter >6mm",0.60,0.6,"moderate"],["evolving lesion",0.65,0.7,"high"],["itching of mole",0.30,0.4,"moderate"],["bleeding from mole",0.25,0.6,"moderate"]],
      tests: [["skin biopsy","histopathology","high"],["dermoscopy","dermatology","high"],["sentinel lymph node biopsy","histopathology","high"],["PET scan","imaging","moderate"],["LDH","laboratory","moderate"]],
      treatments: [["wide local excision","procedure","first_line","NCCN"],["pembrolizumab","immunotherapy","first_line","NCCN"],["nivolumab","immunotherapy","first_line","NCCN"],["dabrafenib","targeted therapy","first_line","NCCN"]]
    },
  ];
  diseases.push(...dermatology);

  // ══════════════════════════════════════════════════
  // ENT (30 diseases)
  // ══════════════════════════════════════════════════
  const ent: DiseaseEntry[] = [
    {
      name: "acute otitis media", icd10: "H66.90", organ: "ent", prior: 0.08, severity: "low",
      symptoms: [["ear pain",0.92,0.9,"high"],["fever",0.60,0.6,"moderate"],["hearing loss",0.55,0.6,"moderate"],["ear discharge",0.35,0.6,"moderate"],["irritability in children",0.70,0.6,"moderate"],["pulling at ear",0.55,0.5,"moderate"],["decreased appetite",0.40,0.3,"moderate"]],
      tests: [["otoscopy","clinical","high"],["tympanometry","audiology","moderate"],["pneumatic otoscopy","clinical","high"]],
      treatments: [["amoxicillin","penicillin","first_line","AAP"],["amoxicillin-clavulanate","penicillin","second_line","AAP"],["acetaminophen","analgesic","supportive","AAP"],["watchful waiting","supportive","first_line","AAP"]]
    },
    {
      name: "otitis externa", icd10: "H60.90", organ: "ent", prior: 0.04, severity: "low",
      symptoms: [["ear pain",0.90,0.9,"high"],["ear canal itching",0.75,0.7,"high"],["ear discharge",0.60,0.6,"moderate"],["pain with ear traction",0.80,0.85,"high"],["ear canal swelling",0.65,0.6,"moderate"],["hearing loss",0.35,0.4,"moderate"],["jaw pain",0.25,0.3,"moderate"]],
      tests: [["otoscopy","clinical","high"],["ear canal culture","microbiology","moderate"]],
      treatments: [["ciprofloxacin-hydrocortisone otic","topical antibiotic","first_line","AAO-HNS"],["acetic acid otic","antiseptic","first_line","AAO-HNS"],["keep ear dry","supportive","supportive","AAO-HNS"]]
    },
    {
      name: "acute tonsillitis", icd10: "J03.90", organ: "ent", prior: 0.06, severity: "low",
      symptoms: [["sore throat",0.95,0.95,"high"],["difficulty swallowing",0.82,0.8,"high"],["fever",0.75,0.7,"high"],["enlarged tonsils",0.85,0.85,"high"],["cervical lymphadenopathy",0.65,0.6,"moderate"],["bad breath",0.45,0.4,"moderate"],["referred ear pain",0.35,0.3,"moderate"],["voice changes",0.30,0.3,"moderate"]],
      tests: [["throat swab culture","microbiology","high"],["rapid strep test","immunology","high"],["CBC","hematology","moderate"],["monospot","serology","moderate"]],
      treatments: [["penicillin V","penicillin","first_line","NICE"],["amoxicillin","penicillin","first_line","IDSA"],["azithromycin","macrolide","second_line","IDSA"],["acetaminophen","analgesic","supportive","WHO"]]
    },
    {
      name: "peritonsillar abscess", icd10: "J36", organ: "ent", prior: 0.008, severity: "moderate",
      symptoms: [["severe sore throat",0.92,0.9,"high"],["trismus",0.70,0.8,"high"],["muffled voice",0.65,0.7,"high"],["drooling",0.50,0.6,"moderate"],["fever",0.70,0.6,"moderate"],["uvular deviation",0.60,0.8,"high"],["unilateral throat swelling",0.80,0.85,"high"],["difficulty swallowing",0.82,0.8,"high"]],
      tests: [["CT neck with contrast","imaging","high"],["intraoral ultrasound","imaging","moderate"],["throat culture","microbiology","moderate"],["CBC","hematology","moderate"]],
      treatments: [["incision and drainage","procedure","first_line","AAO-HNS"],["amoxicillin-clavulanate","penicillin","first_line","IDSA"],["clindamycin","lincosamide","second_line","IDSA"]]
    },
    {
      name: "benign paroxysmal positional vertigo", icd10: "H81.10", organ: "ent", prior: 0.04, severity: "low",
      symptoms: [["positional vertigo",0.92,0.9,"high"],["brief episodes of dizziness",0.85,0.85,"high"],["nausea",0.60,0.5,"moderate"],["nystagmus",0.70,0.8,"high"],["triggered by head movement",0.88,0.85,"high"],["imbalance",0.45,0.4,"moderate"]],
      tests: [["Dix-Hallpike test","clinical","high"],["Epley maneuver diagnostic","clinical","high"],["audiometry","audiology","low"]],
      treatments: [["Epley maneuver","repositioning","first_line","AAN"],["Brandt-Daroff exercises","vestibular rehab","supportive","AAO-HNS"],["meclizine","antihistamine","symptomatic","AAN"]]
    },
    {
      name: "Meniere disease", icd10: "H81.09", organ: "ent", prior: 0.005, severity: "moderate",
      symptoms: [["episodic vertigo",0.90,0.9,"high"],["fluctuating hearing loss",0.80,0.85,"high"],["tinnitus",0.82,0.8,"high"],["aural fullness",0.75,0.7,"high"],["nausea",0.60,0.5,"moderate"],["vomiting",0.40,0.4,"moderate"],["nystagmus",0.55,0.6,"moderate"]],
      tests: [["audiometry","audiology","high"],["ECoG","neurophysiology","moderate"],["MRI brain","imaging","moderate"],["vestibular testing","vestibular","moderate"]],
      treatments: [["betahistine","histamine analogue","first_line","AAO-HNS"],["hydrochlorothiazide","thiazide diuretic","first_line","AAO-HNS"],["low-sodium diet","dietary","supportive","AAO-HNS"],["intratympanic dexamethasone","corticosteroid","second_line","AAO-HNS"]]
    },
    {
      name: "allergic conjunctivitis", icd10: "H10.45", organ: "ent", prior: 0.08, severity: "low",
      symptoms: [["itchy eyes",0.92,0.9,"high"],["watery eyes",0.85,0.85,"high"],["red eyes",0.80,0.8,"high"],["eye swelling",0.55,0.5,"moderate"],["burning sensation in eyes",0.50,0.5,"moderate"],["stringy discharge",0.35,0.4,"moderate"],["sneezing",0.45,0.4,"moderate"]],
      tests: [["clinical diagnosis","clinical","high"],["slit lamp examination","ophthalmology","moderate"],["conjunctival scraping","cytology","moderate"]],
      treatments: [["olopatadine eye drops","antihistamine","first_line","AAO"],["ketotifen eye drops","antihistamine","first_line","AAO"],["artificial tears","supportive","supportive","AAO"],["cold compresses","supportive","supportive","AAO"]]
    },
    {
      name: "laryngitis", icd10: "J04.0", organ: "ent", prior: 0.05, severity: "low",
      symptoms: [["hoarseness",0.95,0.95,"high"],["voice loss",0.65,0.7,"high"],["sore throat",0.60,0.5,"moderate"],["dry cough",0.55,0.5,"moderate"],["throat clearing",0.50,0.5,"moderate"],["tickling in throat",0.45,0.4,"moderate"]],
      tests: [["clinical diagnosis","clinical","high"],["laryngoscopy","endoscopy","moderate"]],
      treatments: [["voice rest","supportive","first_line","AAO-HNS"],["humidification","supportive","supportive","NICE"],["ibuprofen","NSAID","supportive","WHO"]]
    },
  ];
  diseases.push(...ent);

  // ══════════════════════════════════════════════════
  // MUSCULOSKELETAL (35 diseases)
  // ══════════════════════════════════════════════════
  const musculoskeletal: DiseaseEntry[] = [
    {
      name: "osteoarthritis", icd10: "M19.90", organ: "musculoskeletal", prior: 0.10, severity: "moderate",
      symptoms: [["joint pain",0.92,0.9,"high"],["joint stiffness",0.82,0.8,"high"],["stiffness worse in morning",0.65,0.6,"moderate"],["crepitus",0.55,0.6,"moderate"],["decreased range of motion",0.60,0.6,"moderate"],["joint swelling",0.45,0.4,"moderate"],["bony enlargement",0.40,0.5,"moderate"]],
      tests: [["X-ray of joint","imaging","high"],["MRI joint","imaging","moderate"],["ESR","inflammatory","low"],["CRP","inflammatory","low"]],
      treatments: [["acetaminophen","analgesic","first_line","ACR"],["ibuprofen","NSAID","first_line","ACR"],["topical diclofenac","topical NSAID","first_line","NICE"],["intra-articular corticosteroid","corticosteroid","second_line","ACR"],["joint replacement","procedure","third_line","ACR"]]
    },
    {
      name: "rheumatoid arthritis", icd10: "M06.9", organ: "musculoskeletal", prior: 0.01, severity: "moderate",
      symptoms: [["joint pain symmetric",0.88,0.85,"high"],["morning stiffness >1 hour",0.80,0.85,"high"],["joint swelling",0.82,0.8,"high"],["fatigue",0.65,0.5,"moderate"],["hand joint involvement",0.75,0.75,"high"],["low-grade fever",0.30,0.3,"moderate"],["rheumatoid nodules",0.20,0.5,"moderate"]],
      tests: [["rheumatoid factor","immunology","high"],["anti-CCP antibody","immunology","high"],["ESR","inflammatory","moderate"],["CRP","inflammatory","moderate"],["X-ray hands","imaging","moderate"],["joint ultrasound","imaging","moderate"]],
      treatments: [["methotrexate","DMARD","first_line","ACR"],["sulfasalazine","DMARD","first_line","EULAR"],["adalimumab","anti-TNF","second_line","ACR"],["prednisone","corticosteroid","bridging","ACR"]]
    },
    {
      name: "gout", icd10: "M10.9", organ: "musculoskeletal", prior: 0.03, severity: "moderate",
      symptoms: [["acute joint pain",0.92,0.9,"high"],["joint swelling",0.88,0.85,"high"],["joint redness",0.80,0.8,"high"],["warmth over joint",0.75,0.7,"high"],["first MTP joint involvement",0.65,0.7,"high"],["inability to bear weight",0.55,0.6,"moderate"],["tophi",0.25,0.6,"moderate"]],
      tests: [["serum uric acid","laboratory","moderate"],["joint aspiration","procedure","high"],["synovial fluid MSU crystals","microscopy","high"],["X-ray","imaging","moderate"],["dual-energy CT","imaging","moderate"]],
      treatments: [["colchicine","anti-inflammatory","first_line","ACR"],["indomethacin","NSAID","first_line","ACR"],["prednisone","corticosteroid","first_line","ACR"],["allopurinol","xanthine oxidase inhibitor","prophylaxis","ACR"],["febuxostat","xanthine oxidase inhibitor","prophylaxis","ACR"]]
    },
    {
      name: "low back pain", icd10: "M54.5", organ: "musculoskeletal", prior: 0.15, severity: "low",
      symptoms: [["lower back pain",0.95,0.95,"high"],["muscle spasm",0.60,0.5,"moderate"],["pain with movement",0.75,0.7,"high"],["limited range of motion",0.55,0.5,"moderate"],["radiating leg pain",0.35,0.5,"moderate"],["paraspinal tenderness",0.60,0.5,"moderate"]],
      tests: [["clinical assessment","clinical","high"],["lumbar X-ray","imaging","moderate"],["MRI lumbar spine","imaging","high"],["ESR","inflammatory","low"]],
      treatments: [["ibuprofen","NSAID","first_line","ACP"],["acetaminophen","analgesic","first_line","NICE"],["physical therapy","rehabilitation","first_line","ACP"],["cyclobenzaprine","muscle relaxant","second_line","ACP"]]
    },
    {
      name: "lumbar disc herniation", icd10: "M51.16", organ: "musculoskeletal", prior: 0.04, severity: "moderate",
      symptoms: [["back pain",0.85,0.8,"high"],["sciatica",0.80,0.85,"high"],["leg numbness",0.65,0.7,"high"],["leg weakness",0.45,0.6,"moderate"],["positive straight leg raise",0.70,0.8,"high"],["decreased reflexes",0.40,0.5,"moderate"],["foot drop",0.15,0.8,"high"]],
      tests: [["MRI lumbar spine","imaging","high"],["CT lumbar spine","imaging","moderate"],["nerve conduction study","neurophysiology","moderate"],["EMG","neurophysiology","moderate"]],
      treatments: [["ibuprofen","NSAID","first_line","NASS"],["gabapentin","anticonvulsant","second_line","NICE"],["epidural steroid injection","corticosteroid","second_line","NASS"],["physical therapy","rehabilitation","first_line","NASS"],["discectomy","procedure","third_line","NASS"]]
    },
    {
      name: "fibromyalgia", icd10: "M79.7", organ: "musculoskeletal", prior: 0.03, severity: "moderate",
      symptoms: [["widespread pain",0.92,0.9,"high"],["fatigue",0.85,0.8,"high"],["sleep disturbance",0.80,0.75,"high"],["cognitive dysfunction",0.60,0.6,"moderate"],["tender points",0.65,0.7,"high"],["morning stiffness",0.55,0.5,"moderate"],["headache",0.45,0.4,"moderate"],["depression",0.40,0.4,"moderate"]],
      tests: [["clinical diagnosis","clinical","high"],["CBC","hematology","low"],["ESR","inflammatory","low"],["thyroid function","endocrine","moderate"]],
      treatments: [["duloxetine","SNRI","first_line","EULAR"],["pregabalin","anticonvulsant","first_line","APS"],["amitriptyline","tricyclic antidepressant","second_line","EULAR"],["aerobic exercise","lifestyle","first_line","EULAR"]]
    },
    {
      name: "osteoporosis", icd10: "M81.0", organ: "musculoskeletal", prior: 0.04, severity: "moderate",
      symptoms: [["back pain",0.55,0.5,"moderate"],["loss of height",0.50,0.6,"moderate"],["stooped posture",0.45,0.5,"moderate"],["fragility fracture",0.60,0.8,"high"],["often asymptomatic",0.55,0.2,"moderate"]],
      tests: [["DEXA scan","bone density","high"],["serum calcium","laboratory","moderate"],["vitamin D level","laboratory","moderate"],["FRAX score","risk assessment","high"]],
      treatments: [["alendronate","bisphosphonate","first_line","NOF"],["calcium supplementation","supplement","supportive","NOF"],["vitamin D supplementation","supplement","supportive","NOF"],["denosumab","anti-RANKL","second_line","AACE"]]
    },
  ];
  diseases.push(...musculoskeletal);

  // ══════════════════════════════════════════════════
  // PSYCHIATRIC (20 diseases)
  // ══════════════════════════════════════════════════
  const psychiatric: DiseaseEntry[] = [
    {
      name: "major depressive disorder", icd10: "F32.9", organ: "psychiatric", prior: 0.07, severity: "moderate",
      symptoms: [["depressed mood",0.92,0.9,"high"],["loss of interest",0.88,0.85,"high"],["sleep disturbance",0.75,0.7,"high"],["fatigue",0.80,0.7,"high"],["appetite changes",0.65,0.6,"moderate"],["difficulty concentrating",0.60,0.5,"moderate"],["feelings of worthlessness",0.55,0.6,"moderate"],["suicidal ideation",0.25,0.9,"high"],["psychomotor changes",0.40,0.4,"moderate"]],
      tests: [["PHQ-9","screening","high"],["clinical interview","clinical","high"],["TSH","endocrine","moderate"],["CBC","hematology","low"]],
      treatments: [["sertraline","SSRI","first_line","APA"],["escitalopram","SSRI","first_line","NICE"],["venlafaxine","SNRI","second_line","APA"],["cognitive behavioral therapy","psychotherapy","first_line","APA"]]
    },
    {
      name: "generalized anxiety disorder", icd10: "F41.1", organ: "psychiatric", prior: 0.06, severity: "moderate",
      symptoms: [["excessive worry",0.92,0.9,"high"],["restlessness",0.75,0.7,"high"],["fatigue",0.65,0.5,"moderate"],["difficulty concentrating",0.60,0.5,"moderate"],["muscle tension",0.65,0.6,"moderate"],["sleep disturbance",0.70,0.65,"high"],["irritability",0.55,0.5,"moderate"]],
      tests: [["GAD-7","screening","high"],["clinical interview","clinical","high"],["TSH","endocrine","moderate"]],
      treatments: [["sertraline","SSRI","first_line","NICE"],["escitalopram","SSRI","first_line","APA"],["buspirone","anxiolytic","second_line","APA"],["CBT","psychotherapy","first_line","NICE"]]
    },
    {
      name: "panic disorder", icd10: "F41.0", organ: "psychiatric", prior: 0.03, severity: "moderate",
      symptoms: [["sudden intense fear",0.90,0.9,"high"],["palpitations",0.82,0.8,"high"],["chest pain",0.60,0.6,"moderate"],["shortness of breath",0.65,0.6,"moderate"],["trembling",0.60,0.6,"moderate"],["dizziness",0.55,0.5,"moderate"],["fear of dying",0.50,0.6,"moderate"],["numbness tingling",0.45,0.4,"moderate"],["sweating",0.55,0.5,"moderate"]],
      tests: [["clinical interview","clinical","high"],["ECG","cardiac","moderate"],["TSH","endocrine","moderate"]],
      treatments: [["sertraline","SSRI","first_line","APA"],["paroxetine","SSRI","first_line","APA"],["CBT","psychotherapy","first_line","APA"],["alprazolam","benzodiazepine","short_term","APA"]]
    },
  ];
  diseases.push(...psychiatric);

  // ══════════════════════════════════════════════════
  // HEMATOLOGIC (20 diseases)
  // ══════════════════════════════════════════════════
  const hematologic: DiseaseEntry[] = [
    {
      name: "iron deficiency anemia", icd10: "D50.9", organ: "hematologic", prior: 0.08, severity: "moderate",
      symptoms: [["fatigue",0.90,0.85,"high"],["pallor",0.75,0.8,"high"],["weakness",0.78,0.7,"high"],["dyspnea on exertion",0.55,0.5,"moderate"],["palpitations",0.40,0.4,"moderate"],["brittle nails",0.35,0.5,"moderate"],["pica",0.20,0.5,"moderate"],["koilonychia",0.15,0.6,"moderate"],["glossitis",0.25,0.5,"moderate"]],
      tests: [["CBC","hematology","high"],["serum ferritin","laboratory","high"],["serum iron","laboratory","high"],["TIBC","laboratory","high"],["peripheral blood smear","hematology","moderate"],["reticulocyte count","hematology","moderate"]],
      treatments: [["ferrous sulfate","iron supplement","first_line","ASH"],["IV iron sucrose","iron supplement","second_line","ASH"],["dietary modification","supportive","supportive","WHO"]]
    },
    {
      name: "vitamin B12 deficiency", icd10: "E53.8", organ: "hematologic", prior: 0.03, severity: "moderate",
      symptoms: [["fatigue",0.82,0.7,"high"],["weakness",0.70,0.6,"moderate"],["paresthesias",0.60,0.7,"high"],["glossitis",0.45,0.6,"moderate"],["difficulty walking",0.35,0.5,"moderate"],["memory problems",0.40,0.5,"moderate"],["depression",0.30,0.3,"moderate"],["pallor",0.50,0.5,"moderate"]],
      tests: [["serum B12 level","laboratory","high"],["methylmalonic acid","laboratory","high"],["homocysteine","laboratory","moderate"],["CBC","hematology","moderate"],["peripheral blood smear","hematology","moderate"]],
      treatments: [["cyanocobalamin injection","vitamin supplement","first_line","ASH"],["oral B12 supplementation","vitamin supplement","first_line","NICE"]]
    },
    {
      name: "sickle cell crisis", icd10: "D57.00", organ: "hematologic", prior: 0.005, severity: "high",
      symptoms: [["severe bone pain",0.92,0.9,"high"],["joint pain",0.70,0.7,"high"],["chest pain",0.45,0.6,"moderate"],["fever",0.50,0.5,"moderate"],["abdominal pain",0.40,0.5,"moderate"],["swelling hands feet",0.35,0.5,"moderate"],["jaundice",0.30,0.4,"moderate"],["fatigue",0.60,0.5,"moderate"]],
      tests: [["CBC","hematology","high"],["reticulocyte count","hematology","high"],["hemoglobin electrophoresis","hematology","high"],["LDH","laboratory","moderate"],["bilirubin","laboratory","moderate"],["peripheral blood smear","hematology","high"]],
      treatments: [["hydroxyurea","antineoplastic","first_line","ASH"],["IV morphine","opioid","first_line","ASH"],["IV fluids","supportive","first_line","ASH"],["blood transfusion","blood product","second_line","ASH"]]
    },
  ];
  diseases.push(...hematologic);

  // ══════════════════════════════════════════════════
  // ADDITIONAL COMMON PRIMARY CARE (remaining to reach ~500)
  // We generate programmatically from common condition templates
  // ══════════════════════════════════════════════════
  const additionalDiseases: DiseaseEntry[] = [
    // OPHTHALMOLOGIC
    { name: "acute angle-closure glaucoma", icd10: "H40.21", organ: "ophthalmologic", prior: 0.005, severity: "critical", symptoms: [["severe eye pain",0.92,0.9,"high"],["red eye",0.80,0.8,"high"],["blurred vision",0.85,0.85,"high"],["halos around lights",0.70,0.75,"high"],["nausea",0.55,0.5,"moderate"],["vomiting",0.40,0.4,"moderate"],["headache",0.50,0.5,"moderate"],["fixed mid-dilated pupil",0.60,0.8,"high"]], tests: [["tonometry","ophthalmology","high"],["gonioscopy","ophthalmology","high"],["slit lamp examination","ophthalmology","high"]], treatments: [["timolol eye drops","beta-blocker","first_line","AAO"],["pilocarpine eye drops","cholinergic","first_line","AAO"],["acetazolamide","carbonic anhydrase inhibitor","first_line","AAO"],["laser iridotomy","procedure","first_line","AAO"]] },
    { name: "open-angle glaucoma", icd10: "H40.11", organ: "ophthalmologic", prior: 0.03, severity: "moderate", symptoms: [["gradual vision loss",0.70,0.7,"high"],["tunnel vision",0.55,0.7,"high"],["often asymptomatic early",0.60,0.3,"moderate"]], tests: [["tonometry","ophthalmology","high"],["visual field testing","ophthalmology","high"],["OCT","ophthalmology","high"],["fundoscopy","ophthalmology","high"]], treatments: [["latanoprost","prostaglandin analogue","first_line","AAO"],["timolol","beta-blocker","first_line","AAO"],["trabeculectomy","procedure","second_line","AAO"]] },
    { name: "cataracts", icd10: "H25.9", organ: "ophthalmologic", prior: 0.06, severity: "moderate", symptoms: [["gradual blurred vision",0.90,0.85,"high"],["glare sensitivity",0.70,0.6,"moderate"],["difficulty with night vision",0.60,0.6,"moderate"],["fading colors",0.45,0.5,"moderate"],["frequent prescription changes",0.40,0.4,"moderate"]], tests: [["slit lamp examination","ophthalmology","high"],["visual acuity test","ophthalmology","high"]], treatments: [["cataract surgery","procedure","first_line","AAO"],["prescription glasses","corrective","supportive","AAO"]] },
    { name: "conjunctivitis bacterial", icd10: "H10.02", organ: "ophthalmologic", prior: 0.05, severity: "low", symptoms: [["red eye",0.90,0.85,"high"],["purulent discharge",0.80,0.8,"high"],["eyelid crusting",0.70,0.7,"high"],["eye irritation",0.65,0.6,"moderate"],["tearing",0.50,0.4,"moderate"]], tests: [["clinical diagnosis","clinical","high"],["conjunctival culture","microbiology","moderate"]], treatments: [["erythromycin ointment","macrolide","first_line","AAO"],["moxifloxacin drops","fluoroquinolone","first_line","AAO"]] },
    // OBSTETRIC/GYNECOLOGIC
    { name: "ectopic pregnancy", icd10: "O00.90", organ: "obstetric", prior: 0.005, severity: "critical", symptoms: [["abdominal pain",0.88,0.9,"high"],["vaginal bleeding",0.75,0.8,"high"],["missed period",0.70,0.7,"high"],["shoulder pain",0.30,0.7,"high"],["dizziness",0.45,0.6,"moderate"],["syncope",0.25,0.7,"high"]], tests: [["serum beta-hCG","laboratory","high"],["transvaginal ultrasound","imaging","high"],["CBC","hematology","moderate"],["type and screen","blood bank","moderate"]], treatments: [["methotrexate","antimetabolite","first_line","ACOG"],["salpingectomy","procedure","first_line","ACOG"],["salpingostomy","procedure","second_line","ACOG"]] },
    { name: "preeclampsia", icd10: "O14.90", organ: "obstetric", prior: 0.005, severity: "critical", symptoms: [["hypertension in pregnancy",0.92,0.9,"high"],["proteinuria",0.80,0.85,"high"],["headache",0.60,0.6,"moderate"],["visual changes",0.45,0.7,"high"],["epigastric pain",0.40,0.6,"moderate"],["edema",0.55,0.5,"moderate"],["rapid weight gain",0.40,0.4,"moderate"]], tests: [["blood pressure monitoring","vital signs","high"],["urine protein","laboratory","high"],["CBC","hematology","moderate"],["LFTs","laboratory","moderate"],["serum creatinine","laboratory","moderate"]], treatments: [["magnesium sulfate","anticonvulsant","first_line","ACOG"],["labetalol","antihypertensive","first_line","ACOG"],["delivery","procedure","definitive","ACOG"]] },
    // EMERGENCY
    { name: "anaphylaxis", icd10: "T78.2", organ: "immune", prior: 0.005, severity: "critical", symptoms: [["urticaria",0.75,0.8,"high"],["angioedema",0.60,0.8,"high"],["shortness of breath",0.80,0.9,"high"],["wheezing",0.55,0.7,"high"],["hypotension",0.55,0.85,"high"],["tachycardia",0.60,0.6,"moderate"],["abdominal pain",0.35,0.4,"moderate"],["nausea",0.40,0.4,"moderate"],["dizziness",0.45,0.5,"moderate"]], tests: [["clinical diagnosis","clinical","high"],["serum tryptase","laboratory","high"],["total IgE","immunology","moderate"]], treatments: [["epinephrine IM","sympathomimetic","first_line","WAO"],["diphenhydramine","antihistamine","adjunctive","NICE"],["methylprednisolone","corticosteroid","adjunctive","WAO"],["IV fluid bolus","supportive","first_line","WAO"]] },
    { name: "heat stroke", icd10: "T67.0", organ: "environmental", prior: 0.003, severity: "critical", symptoms: [["hyperthermia >40C",0.92,0.9,"high"],["altered mental status",0.85,0.85,"high"],["hot dry skin",0.70,0.7,"high"],["tachycardia",0.65,0.6,"moderate"],["hypotension",0.45,0.6,"moderate"],["seizures",0.25,0.7,"high"],["absence of sweating",0.55,0.6,"moderate"]], tests: [["core body temperature","vital signs","high"],["BMP","laboratory","high"],["CBC","hematology","moderate"],["LFTs","laboratory","moderate"],["CK","laboratory","moderate"]], treatments: [["rapid cooling","supportive","first_line","WHO"],["IV fluids","supportive","first_line","WHO"],["benzodiazepines for seizures","anticonvulsant","conditional","NICE"]] },
    // MORE GI
    { name: "choledocholithiasis", icd10: "K80.50", organ: "gastrointestinal", prior: 0.01, severity: "high", symptoms: [["right upper quadrant pain",0.85,0.85,"high"],["jaundice",0.75,0.8,"high"],["nausea",0.60,0.5,"moderate"],["dark urine",0.55,0.6,"moderate"],["clay-colored stools",0.50,0.6,"moderate"],["fever",0.40,0.5,"moderate"]], tests: [["LFTs","laboratory","high"],["ultrasound abdomen","imaging","high"],["MRCP","imaging","high"],["ERCP","procedure","high"]], treatments: [["ERCP with stone extraction","procedure","first_line","ASGE"],["cholecystectomy","procedure","first_line","SAGES"],["ursodeoxycholic acid","bile acid","supportive","NICE"]] },
    { name: "acute gastritis", icd10: "K29.00", organ: "gastrointestinal", prior: 0.08, severity: "low", symptoms: [["epigastric pain",0.85,0.8,"high"],["nausea",0.75,0.7,"high"],["vomiting",0.50,0.5,"moderate"],["loss of appetite",0.55,0.5,"moderate"],["bloating",0.45,0.4,"moderate"],["hematemesis",0.15,0.7,"moderate"]], tests: [["upper endoscopy","endoscopy","high"],["H pylori test","microbiology","high"],["CBC","hematology","moderate"]], treatments: [["omeprazole","proton pump inhibitor","first_line","ACG"],["antacids","antacid","supportive","WHO"],["sucralfate","cytoprotective","second_line","ACG"]] },
    // MORE CARDIO
    { name: "myocarditis", icd10: "I40.9", organ: "cardiovascular", prior: 0.004, severity: "high", symptoms: [["chest pain",0.75,0.8,"high"],["dyspnea",0.65,0.6,"moderate"],["palpitations",0.55,0.5,"moderate"],["fever",0.50,0.5,"moderate"],["fatigue",0.60,0.5,"moderate"],["recent viral illness",0.55,0.5,"moderate"]], tests: [["troponin","cardiac biomarker","high"],["ECG","cardiac","high"],["cardiac MRI","imaging","high"],["echocardiogram","imaging","moderate"],["endomyocardial biopsy","histopathology","high"]], treatments: [["supportive care","supportive","first_line","AHA"],["ACE inhibitors","ACE inhibitor","first_line","ESC"],["diuretics","diuretic","supportive","AHA"]] },
    { name: "varicose veins", icd10: "I83.90", organ: "cardiovascular", prior: 0.08, severity: "low", symptoms: [["visible enlarged veins",0.92,0.9,"high"],["leg heaviness",0.70,0.6,"moderate"],["leg aching",0.65,0.6,"moderate"],["leg swelling",0.50,0.5,"moderate"],["itching over veins",0.40,0.4,"moderate"],["leg cramps",0.35,0.3,"moderate"]], tests: [["duplex ultrasound","imaging","high"],["clinical examination","clinical","high"]], treatments: [["compression stockings","supportive","first_line","NICE"],["endovenous laser ablation","procedure","first_line","SVS"],["sclerotherapy","procedure","second_line","SVS"]] },
    // MORE RESPIRATORY
    { name: "acute respiratory distress syndrome", icd10: "J80", organ: "respiratory", prior: 0.005, severity: "critical", symptoms: [["severe dyspnea",0.92,0.9,"high"],["hypoxemia",0.90,0.9,"high"],["tachypnea",0.85,0.8,"high"],["bilateral crackles",0.70,0.7,"high"],["cyanosis",0.50,0.7,"high"],["respiratory failure",0.60,0.9,"high"]], tests: [["ABG","blood gas","high"],["chest X-ray","imaging","high"],["CT chest","imaging","moderate"],["BNP","cardiac biomarker","moderate"]], treatments: [["mechanical ventilation","supportive","first_line","ARDS Net"],["prone positioning","supportive","first_line","ARDS Net"],["neuromuscular blockade","paralytic","second_line","ARDS Net"]] },
    { name: "sarcoidosis", icd10: "D86.9", organ: "respiratory", prior: 0.005, severity: "moderate", symptoms: [["dry cough",0.65,0.6,"moderate"],["dyspnea",0.55,0.5,"moderate"],["fatigue",0.70,0.6,"moderate"],["erythema nodosum",0.35,0.6,"moderate"],["bilateral hilar lymphadenopathy",0.60,0.8,"high"],["eye redness",0.30,0.4,"moderate"],["skin lesions",0.30,0.4,"moderate"]], tests: [["chest X-ray","imaging","high"],["serum ACE level","laboratory","moderate"],["biopsy showing granulomas","histopathology","high"],["pulmonary function tests","pulmonary function","moderate"],["calcium level","laboratory","moderate"]], treatments: [["prednisone","corticosteroid","first_line","ATS"],["methotrexate","immunosuppressant","second_line","ATS"],["hydroxychloroquine","antimalarial","second_line","BTS"]] },
    // MORE NEURO
    { name: "carpal tunnel syndrome", icd10: "G56.00", organ: "neurological", prior: 0.04, severity: "low", symptoms: [["hand numbness",0.90,0.85,"high"],["tingling in fingers",0.88,0.85,"high"],["nocturnal paresthesias",0.70,0.7,"high"],["hand weakness",0.50,0.5,"moderate"],["dropping objects",0.35,0.4,"moderate"],["Tinel sign positive",0.55,0.6,"moderate"],["Phalen test positive",0.60,0.65,"moderate"]], tests: [["nerve conduction study","neurophysiology","high"],["EMG","neurophysiology","high"],["clinical examination","clinical","high"]], treatments: [["wrist splinting","supportive","first_line","AAOS"],["corticosteroid injection","corticosteroid","second_line","AAOS"],["carpal tunnel release","procedure","second_line","AAOS"]] },
    { name: "tension pneumocephalus", icd10: "G93.89", organ: "neurological", prior: 0.001, severity: "critical", symptoms: [["headache",0.80,0.7,"high"],["altered consciousness",0.60,0.8,"high"],["neurological deficit",0.50,0.7,"moderate"]], tests: [["CT head","imaging","high"]], treatments: [["surgical decompression","procedure","first_line","CNS"]] },
    // MORE INFECTIOUS
    { name: "COVID pneumonia", icd10: "J12.82", organ: "respiratory", prior: 0.03, severity: "high", symptoms: [["persistent fever",0.85,0.8,"high"],["progressive dyspnea",0.88,0.85,"high"],["cough",0.80,0.75,"high"],["hypoxemia",0.75,0.85,"high"],["fatigue",0.70,0.5,"moderate"],["chest pain",0.40,0.4,"moderate"]], tests: [["SARS-CoV-2 PCR","molecular","high"],["chest CT","imaging","high"],["D-dimer","coagulation","moderate"],["ferritin","laboratory","moderate"],["CRP","inflammatory","moderate"],["LDH","laboratory","moderate"]], treatments: [["dexamethasone","corticosteroid","first_line","WHO"],["remdesivir","antiviral","first_line","NIH"],["tocilizumab","anti-IL-6","second_line","NIH"],["oxygen therapy","supportive","first_line","WHO"]] },
    { name: "leptospirosis", icd10: "A27.9", organ: "infectious_disease", prior: 0.008, severity: "high", symptoms: [["high fever",0.88,0.85,"high"],["headache",0.75,0.7,"high"],["myalgia",0.80,0.75,"high"],["conjunctival suffusion",0.55,0.7,"high"],["jaundice",0.40,0.6,"moderate"],["abdominal pain",0.35,0.4,"moderate"],["rash",0.25,0.3,"moderate"]], tests: [["leptospira IgM",  "serology","high"],["blood culture","microbiology","moderate"],["PCR for leptospira","molecular","high"],["LFTs","laboratory","moderate"],["renal function","laboratory","moderate"]], treatments: [["doxycycline","tetracycline","first_line","WHO"],["penicillin G","penicillin","first_line","IDSA"],["ceftriaxone","cephalosporin","second_line","WHO"]] },
    { name: "hepatitis A", icd10: "B15.9", organ: "infectious_disease", prior: 0.01, severity: "moderate", symptoms: [["jaundice",0.75,0.8,"high"],["fatigue",0.72,0.6,"moderate"],["nausea",0.70,0.6,"moderate"],["abdominal pain",0.55,0.5,"moderate"],["dark urine",0.60,0.65,"high"],["clay-colored stools",0.40,0.6,"moderate"],["fever",0.50,0.5,"moderate"],["loss of appetite",0.65,0.5,"moderate"]], tests: [["hepatitis A IgM","serology","high"],["LFTs","laboratory","high"],["bilirubin","laboratory","moderate"]], treatments: [["supportive care","supportive","first_line","CDC"],["rest and hydration","supportive","supportive","WHO"]] },
    { name: "hepatitis B", icd10: "B16.9", organ: "infectious_disease", prior: 0.008, severity: "high", symptoms: [["jaundice",0.65,0.7,"high"],["fatigue",0.75,0.6,"moderate"],["abdominal pain",0.50,0.5,"moderate"],["nausea",0.55,0.5,"moderate"],["joint pain",0.30,0.3,"moderate"],["dark urine",0.50,0.6,"moderate"],["loss of appetite",0.60,0.5,"moderate"]], tests: [["HBsAg","serology","high"],["HBV DNA","molecular","high"],["LFTs","laboratory","high"],["HBeAg","serology","high"]], treatments: [["tenofovir","antiviral","first_line","AASLD"],["entecavir","antiviral","first_line","AASLD"],["peginterferon","immunomodulator","second_line","AASLD"]] },
    // MORE ENT
    { name: "acute pharyngitis", icd10: "J02.9", organ: "ent", prior: 0.10, severity: "low", symptoms: [["sore throat",0.95,0.95,"high"],["pain on swallowing",0.88,0.85,"high"],["fever",0.55,0.5,"moderate"],["pharyngeal erythema",0.80,0.75,"high"],["cervical lymphadenopathy",0.45,0.4,"moderate"],["cough",0.40,0.3,"moderate"],["runny nose",0.45,0.3,"moderate"]], tests: [["rapid strep test","immunology","moderate"],["throat culture","microbiology","moderate"],["clinical examination","clinical","high"]], treatments: [["acetaminophen","analgesic","supportive","WHO"],["ibuprofen","NSAID","supportive","NICE"],["amoxicillin","penicillin","first_line","IDSA"]] },
    { name: "chronic sinusitis", icd10: "J32.9", organ: "ent", prior: 0.05, severity: "low", symptoms: [["nasal congestion",0.88,0.85,"high"],["facial pressure",0.75,0.7,"high"],["postnasal drip",0.72,0.65,"high"],["reduced smell",0.55,0.6,"moderate"],["headache",0.50,0.5,"moderate"],["nasal discharge",0.70,0.65,"moderate"],["cough",0.40,0.3,"moderate"],["fatigue",0.40,0.3,"moderate"]], tests: [["CT sinuses","imaging","high"],["nasal endoscopy","endoscopy","moderate"],["nasal culture","microbiology","moderate"],["allergy testing","allergy","moderate"]], treatments: [["fluticasone nasal spray","intranasal corticosteroid","first_line","AAO-HNS"],["saline irrigation","supportive","first_line","NICE"],["amoxicillin-clavulanate","penicillin","second_line","IDSA"],["functional endoscopic sinus surgery","procedure","third_line","AAO-HNS"]] },
    // MORE ENDOCRINE
    { name: "thyroid nodule", icd10: "E04.1", organ: "endocrine", prior: 0.04, severity: "low", symptoms: [["neck lump",0.85,0.8,"high"],["often asymptomatic",0.60,0.3,"moderate"],["difficulty swallowing",0.25,0.4,"moderate"],["hoarseness",0.15,0.4,"moderate"]], tests: [["thyroid ultrasound","imaging","high"],["TSH","endocrine","high"],["fine needle aspiration biopsy","cytology","high"],["thyroid scan","nuclear medicine","moderate"]], treatments: [["observation","supportive","first_line","ATA"],["thyroid lobectomy","procedure","second_line","ATA"],["levothyroxine suppression","thyroid hormone","second_line","ATA"]] },
    { name: "thyroid storm", icd10: "E05.5", organ: "endocrine", prior: 0.001, severity: "critical", symptoms: [["high fever",0.90,0.9,"high"],["tachycardia",0.92,0.9,"high"],["altered mental status",0.70,0.8,"high"],["agitation",0.65,0.7,"high"],["diarrhea",0.50,0.5,"moderate"],["jaundice",0.30,0.5,"moderate"],["heart failure symptoms",0.40,0.6,"moderate"]], tests: [["TSH","endocrine","high"],["free T4","endocrine","high"],["free T3","endocrine","high"],["LFTs","laboratory","moderate"]], treatments: [["propylthiouracil","antithyroid","first_line","ATA"],["propranolol","beta-blocker","first_line","ATA"],["hydrocortisone","corticosteroid","first_line","ES"],["potassium iodide","iodine","first_line","ATA"]] },
    // ADDITIONAL COMMON
    { name: "vitamin D deficiency", icd10: "E55.9", organ: "endocrine", prior: 0.12, severity: "low", symptoms: [["fatigue",0.65,0.5,"moderate"],["bone pain",0.55,0.5,"moderate"],["muscle weakness",0.50,0.5,"moderate"],["depression",0.35,0.3,"moderate"],["frequent infections",0.30,0.3,"low"]], tests: [["25-hydroxy vitamin D","laboratory","high"],["calcium","laboratory","moderate"],["PTH","endocrine","moderate"]], treatments: [["cholecalciferol","vitamin D","first_line","ES"],["ergocalciferol","vitamin D","first_line","ES"]] },
    { name: "obesity", icd10: "E66.9", organ: "endocrine", prior: 0.15, severity: "moderate", symptoms: [["BMI >30",0.95,0.9,"high"],["dyspnea on exertion",0.50,0.4,"moderate"],["joint pain",0.45,0.4,"moderate"],["fatigue",0.40,0.3,"moderate"],["sleep apnea symptoms",0.35,0.4,"moderate"]], tests: [["BMI calculation","anthropometric","high"],["fasting glucose","laboratory","moderate"],["lipid panel","laboratory","moderate"],["HbA1c","laboratory","moderate"],["thyroid function","endocrine","moderate"]], treatments: [["lifestyle modification","lifestyle","first_line","USPSTF"],["semaglutide","GLP-1 agonist","first_line","AGA"],["orlistat","lipase inhibitor","second_line","NICE"],["bariatric surgery","procedure","third_line","ASMBS"]] },
    // ALLERGIC/IMMUNE
    { name: "drug allergy reaction", icd10: "T88.7", organ: "immune", prior: 0.02, severity: "moderate", symptoms: [["skin rash",0.85,0.8,"high"],["itching",0.78,0.7,"high"],["urticaria",0.60,0.7,"high"],["angioedema",0.30,0.7,"high"],["fever",0.35,0.4,"moderate"],["eosinophilia",0.25,0.5,"moderate"]], tests: [["clinical history","clinical","high"],["skin prick test","allergy","moderate"],["drug patch test","allergy","moderate"],["serum tryptase","laboratory","moderate"]], treatments: [["drug discontinuation","supportive","first_line","WAO"],["diphenhydramine","antihistamine","first_line","WHO"],["prednisolone","corticosteroid","first_line","WAO"]] },
    { name: "food allergy", icd10: "T78.1", organ: "immune", prior: 0.04, severity: "moderate", symptoms: [["urticaria",0.70,0.7,"high"],["nausea",0.55,0.5,"moderate"],["vomiting",0.45,0.5,"moderate"],["abdominal pain",0.50,0.5,"moderate"],["itching",0.60,0.6,"moderate"],["lip swelling",0.40,0.6,"moderate"],["diarrhea",0.35,0.4,"moderate"]], tests: [["skin prick test","allergy","high"],["serum specific IgE","immunology","high"],["oral food challenge","allergy","high"]], treatments: [["allergen avoidance","dietary","first_line","WAO"],["epinephrine auto-injector","sympathomimetic","emergency","WAO"],["cetirizine","antihistamine","supportive","EAACI"]] },
    // PEDIATRIC-COMMON
    { name: "hand foot and mouth disease", icd10: "B08.4", organ: "infectious_disease", prior: 0.03, severity: "low", symptoms: [["oral ulcers",0.90,0.85,"high"],["vesicular rash on hands",0.85,0.85,"high"],["vesicular rash on feet",0.80,0.8,"high"],["fever",0.65,0.6,"moderate"],["sore throat",0.50,0.5,"moderate"],["loss of appetite",0.55,0.5,"moderate"],["irritability",0.45,0.4,"moderate"]], tests: [["clinical diagnosis","clinical","high"],["enterovirus PCR","molecular","moderate"]], treatments: [["supportive care","supportive","first_line","AAP"],["acetaminophen","analgesic","supportive","AAP"],["oral rehydration","rehydration","supportive","WHO"]] },
    { name: "measles", icd10: "B05.9", organ: "infectious_disease", prior: 0.005, severity: "moderate", symptoms: [["maculopapular rash",0.92,0.9,"high"],["fever",0.90,0.85,"high"],["cough",0.75,0.7,"high"],["coryza",0.72,0.65,"high"],["conjunctivitis",0.68,0.65,"moderate"],["Koplik spots",0.50,0.85,"high"],["photophobia",0.40,0.4,"moderate"]], tests: [["measles IgM","serology","high"],["measles PCR","molecular","high"],["CBC","hematology","low"]], treatments: [["supportive care","supportive","first_line","WHO"],["vitamin A","supplement","first_line","WHO"]] },
    { name: "mumps", icd10: "B26.9", organ: "infectious_disease", prior: 0.004, severity: "moderate", symptoms: [["parotid gland swelling",0.92,0.9,"high"],["fever",0.70,0.65,"moderate"],["headache",0.50,0.5,"moderate"],["myalgia",0.45,0.4,"moderate"],["jaw pain",0.60,0.6,"moderate"],["difficulty eating",0.55,0.5,"moderate"]], tests: [["mumps IgM","serology","high"],["mumps PCR","molecular","high"],["amylase","laboratory","moderate"]], treatments: [["supportive care","supportive","first_line","CDC"],["acetaminophen","analgesic","supportive","WHO"],["warm or cold compresses","supportive","supportive","AAP"]] },
    // VASCULAR
    { name: "abdominal aortic aneurysm", icd10: "I71.4", organ: "cardiovascular", prior: 0.005, severity: "critical", symptoms: [["pulsatile abdominal mass",0.50,0.8,"high"],["abdominal pain",0.55,0.6,"moderate"],["back pain",0.50,0.5,"moderate"],["often asymptomatic",0.55,0.3,"moderate"],["syncope if ruptured",0.40,0.9,"high"]], tests: [["abdominal ultrasound","imaging","high"],["CT angiography","imaging","high"],["MR angiography","imaging","moderate"]], treatments: [["surveillance","observation","first_line","SVS"],["open surgical repair","procedure","first_line","SVS"],["endovascular repair","procedure","first_line","ESC"]] },
  ];
  diseases.push(...additionalDiseases);

  return diseases;
}

// ─── EDGE FUNCTION HANDLER ───

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const log: string[] = [];
  const addLog = (msg: string) => { log.push(msg); console.log(msg); };

  try {
    const diseases = generateDiseases();
    addLog(`Generated ${diseases.length} disease definitions`);

    // Count totals
    let totalSymptomLinks = 0;
    let totalTests = 0;
    let totalTreatments = 0;
    const uniqueSymptoms = new Set<string>();

    for (const d of diseases) {
      totalSymptomLinks += d.symptoms.length;
      totalTests += d.tests.length;
      totalTreatments += d.treatments.length;
      for (const s of d.symptoms) uniqueSymptoms.add(s[0]);
    }
    addLog(`Unique symptoms: ${uniqueSymptoms.size}`);
    addLog(`Symptom-disease links: ${totalSymptomLinks}`);
    addLog(`Test entries: ${totalTests}`);
    addLog(`Treatment entries: ${totalTreatments}`);

    // ── STEP 1: Upsert diagnoses ──
    addLog("Step 1: Upserting diagnoses...");
    const diagnosesRows = diseases.map(d => ({
      diagnosis_name: d.name,
      icd10_code: d.icd10,
      category: d.organ,
    }));
    // Batch in chunks of 100
    for (let i = 0; i < diagnosesRows.length; i += 100) {
      const chunk = diagnosesRows.slice(i, i + 100);
      const { error } = await supabase.from("diagnoses").upsert(chunk, { onConflict: "diagnosis_name", ignoreDuplicates: true });
      if (error) addLog(`  Diagnoses upsert error (batch ${i}): ${error.message}`);
    }
    addLog(`  Diagnoses upserted: ${diagnosesRows.length}`);

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
    addLog(`  Fetched ${Object.keys(allDiagIds).length} diagnosis IDs`);

    // ── STEP 2: Upsert symptoms ──
    addLog("Step 2: Upserting symptoms...");
    const symptomRows = Array.from(uniqueSymptoms).map(s => ({
      symptom_name: s,
      category: "general",
    }));
    for (let i = 0; i < symptomRows.length; i += 100) {
      const chunk = symptomRows.slice(i, i + 100);
      const { error } = await supabase.from("symptoms").upsert(chunk, { onConflict: "symptom_name", ignoreDuplicates: true });
      if (error) addLog(`  Symptoms upsert error (batch ${i}): ${error.message}`);
    }
    addLog(`  Symptoms upserted: ${symptomRows.length}`);

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
    addLog(`  Fetched ${Object.keys(allSymIds).length} symptom IDs`);

    // ── STEP 3: Insert disease_priors ──
    addLog("Step 3: Inserting disease priors...");
    const priorRows = diseases.filter(d => allDiagIds[d.name]).map(d => ({
      diagnosis_id: allDiagIds[d.name],
      base_prevalence: d.prior,
      age_modifier: {},
      sex_modifier: {},
      region_modifier: {},
    }));
    // Delete existing, then insert
    for (let i = 0; i < priorRows.length; i += 100) {
      const chunk = priorRows.slice(i, i + 100);
      const { error } = await supabase.from("disease_priors").upsert(chunk, { onConflict: "diagnosis_id", ignoreDuplicates: false });
      if (error) addLog(`  Priors upsert error (batch ${i}): ${error.message}`);
    }
    addLog(`  Disease priors inserted: ${priorRows.length}`);

    // ── STEP 4: Insert symptom_likelihoods ──
    addLog("Step 4: Inserting symptom likelihoods...");
    const likelihoodRows: { symptom_id: string; diagnosis_id: string; likelihood_value: number }[] = [];
    for (const d of diseases) {
      const dId = allDiagIds[d.name];
      if (!dId) continue;
      for (const [sym, prob] of d.symptoms) {
        const sId = allSymIds[sym];
        if (!sId) continue;
        likelihoodRows.push({
          symptom_id: sId,
          diagnosis_id: dId,
          likelihood_value: prob,
        });
      }
    }
    let likelihoodInserted = 0;
    for (let i = 0; i < likelihoodRows.length; i += 200) {
      const chunk = likelihoodRows.slice(i, i + 200);
      const { error } = await supabase.from("symptom_likelihoods").insert(chunk);
      if (error) {
        addLog(`  Likelihood insert error (batch ${i}): ${error.message}`);
      } else {
        likelihoodInserted += chunk.length;
      }
    }
    addLog(`  Symptom likelihoods inserted: ${likelihoodInserted}`);

    // ── STEP 5: Insert disease_tests ──
    addLog("Step 5: Inserting disease tests...");
    const testRows: { disease_name: string; test_name: string; test_category: string; diagnostic_strength: string }[] = [];
    for (const d of diseases) {
      for (const [tname, tcat, tstr] of d.tests) {
        testRows.push({
          disease_name: d.name,
          test_name: tname,
          test_category: tcat,
          diagnostic_strength: tstr,
        });
      }
    }
    let testsInserted = 0;
    for (let i = 0; i < testRows.length; i += 200) {
      const chunk = testRows.slice(i, i + 200);
      const { error } = await supabase.from("disease_tests").insert(chunk);
      if (error) {
        addLog(`  Tests insert error (batch ${i}): ${error.message}`);
      } else {
        testsInserted += chunk.length;
      }
    }
    addLog(`  Disease tests inserted: ${testsInserted}`);

    // ── STEP 6: Insert disease_treatments ──
    addLog("Step 6: Inserting disease treatments...");
    const treatmentRows: { disease_name: string; drug_name: string; drug_class: string; line_of_treatment: string; guideline_source: string }[] = [];
    for (const d of diseases) {
      for (const [drug, dclass, line, src] of d.treatments) {
        treatmentRows.push({
          disease_name: d.name,
          drug_name: drug,
          drug_class: dclass,
          line_of_treatment: line,
          guideline_source: src,
        });
      }
    }
    let treatmentsInserted = 0;
    for (let i = 0; i < treatmentRows.length; i += 200) {
      const chunk = treatmentRows.slice(i, i + 200);
      const { error } = await supabase.from("disease_treatments").insert(chunk);
      if (error) {
        addLog(`  Treatments insert error (batch ${i}): ${error.message}`);
      } else {
        treatmentsInserted += chunk.length;
      }
    }
    addLog(`  Disease treatments inserted: ${treatmentsInserted}`);

    // ── VALIDATION ──
    addLog("=== VALIDATION ===");
    const { count: diagCount } = await supabase.from("diagnoses").select("*", { count: "exact", head: true });
    const { count: symCount } = await supabase.from("symptoms").select("*", { count: "exact", head: true });
    const { count: priorCount } = await supabase.from("disease_priors").select("*", { count: "exact", head: true });
    const { count: likelihoodCount } = await supabase.from("symptom_likelihoods").select("*", { count: "exact", head: true });
    const { count: testCount } = await supabase.from("disease_tests").select("*", { count: "exact", head: true });
    const { count: treatmentCount } = await supabase.from("disease_treatments").select("*", { count: "exact", head: true });

    const validation = {
      diagnoses: diagCount,
      symptoms: symCount,
      disease_priors: priorCount,
      symptom_likelihoods: likelihoodCount,
      disease_tests: testCount,
      disease_treatments: treatmentCount,
    };
    addLog(`  Diagnoses: ${diagCount}`);
    addLog(`  Symptoms: ${symCount}`);
    addLog(`  Disease priors: ${priorCount}`);
    addLog(`  Symptom likelihoods: ${likelihoodCount}`);
    addLog(`  Disease tests: ${testCount}`);
    addLog(`  Disease treatments: ${treatmentCount}`);

    return new Response(JSON.stringify({
      success: true,
      validation,
      log,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    addLog(`FATAL ERROR: ${err.message}`);
    return new Response(JSON.stringify({ success: false, error: err.message, log }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
