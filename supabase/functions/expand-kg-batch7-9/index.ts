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
// BATCH 7: NEUROLOGY (40 diseases)
// ══════════════════════════════════════════════════
function getNeurology(): DiseaseEntry[] {
  return [
    {name:"epilepsy",icd10:"G40.9",organ:"neurological",prior:0.01,severity:"moderate",
      symptoms:[["recurrent seizures",0.90,0.9,"high"],["loss of consciousness",0.65,0.6,"moderate"],["aura",0.45,0.7,"high"],["postictal confusion",0.60,0.7,"high"],["tongue biting",0.40,0.7,"high"],["urinary incontinence",0.35,0.6,"moderate"],["tonic-clonic movements",0.55,0.8,"high"],["automatisms",0.35,0.7,"high"]],
      tests:[["EEG","neurological","high"],["MRI brain","imaging","high"],["blood glucose","biochemistry","moderate"],["electrolytes","biochemistry","moderate"]],
      treatments:[["levetiracetam","anticonvulsant","first_line","ILAE"],["carbamazepine","anticonvulsant","first_line","ILAE"],["valproate","anticonvulsant","first_line","ILAE"],["lamotrigine","anticonvulsant","first_line","ILAE"]]},
    {name:"Parkinson disease",icd10:"G20",organ:"neurological",prior:0.015,severity:"moderate",
      symptoms:[["resting tremor",0.75,0.85,"high"],["bradykinesia",0.80,0.85,"high"],["rigidity",0.75,0.8,"high"],["postural instability",0.55,0.7,"high"],["shuffling gait",0.60,0.75,"high"],["micrographia",0.45,0.7,"high"],["masked facies",0.50,0.75,"high"],["pill-rolling tremor",0.55,0.9,"high"],["depression",0.35,0.4,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["DaTscan","nuclear medicine","moderate"],["MRI brain","imaging","moderate"]],
      treatments:[["levodopa-carbidopa","dopaminergic","first_line","AAN"],["pramipexole","dopamine agonist","first_line","AAN"],["rasagiline","MAO-B inhibitor","adjunct","AAN"],["amantadine","NMDA antagonist","adjunct","AAN"]]},
    {name:"multiple sclerosis",icd10:"G35",organ:"neurological",prior:0.005,severity:"high",
      symptoms:[["optic neuritis",0.45,0.8,"high"],["limb weakness",0.55,0.6,"moderate"],["paresthesia",0.60,0.6,"moderate"],["Lhermitte sign",0.35,0.9,"high"],["fatigue",0.70,0.4,"moderate"],["diplopia",0.35,0.6,"moderate"],["ataxia",0.40,0.6,"moderate"],["urinary urgency",0.40,0.5,"moderate"],["spasticity",0.45,0.6,"moderate"]],
      tests:[["MRI brain with contrast","imaging","high"],["MRI spine","imaging","high"],["lumbar puncture oligoclonal bands","biochemistry","high"],["visual evoked potentials","neurophysiology","moderate"]],
      treatments:[["dimethyl fumarate","immunomodulator","first_line","AAN"],["glatiramer acetate","immunomodulator","first_line","AAN"],["ocrelizumab","anti-CD20","first_line","AAN"],["interferon beta-1a","immunomodulator","first_line","AAN"]]},
    {name:"trigeminal neuralgia",icd10:"G50.0",organ:"neurological",prior:0.005,severity:"moderate",
      symptoms:[["severe lancinating facial pain",0.92,0.9,"high"],["unilateral facial pain",0.85,0.8,"high"],["pain triggered by touch or chewing",0.75,0.8,"high"],["electric shock-like pain",0.80,0.85,"high"],["episodes lasting seconds to minutes",0.70,0.7,"high"],["pain along trigeminal distribution",0.80,0.85,"high"]],
      tests:[["MRI brain with FIESTA",0.75,"imaging","high"],["clinical diagnosis","clinical","high"]],
      treatments:[["carbamazepine","anticonvulsant","first_line","AAN"],["oxcarbazepine","anticonvulsant","first_line","AAN"],["gabapentin","anticonvulsant","second_line","AAN"]]},
    {name:"Bell palsy",icd10:"G51.0",organ:"neurological",prior:0.01,severity:"moderate",
      symptoms:[["sudden unilateral facial weakness",0.92,0.9,"high"],["inability to close eye",0.80,0.85,"high"],["drooping mouth corner",0.75,0.8,"high"],["loss of forehead wrinkles",0.70,0.85,"high"],["hyperacusis",0.40,0.7,"high"],["taste disturbance",0.45,0.6,"moderate"],["ear pain",0.35,0.4,"moderate"],["lacrimation changes",0.40,0.5,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["MRI brain","imaging","moderate"],["EMG","neurophysiology","moderate"]],
      treatments:[["prednisolone","corticosteroid","first_line","AAN"],["valacyclovir","antiviral","adjunct","AAN"],["artificial tears","supportive","adjunct","AAN"]]},
    {name:"myasthenia gravis",icd10:"G70.0",organ:"neurological",prior:0.002,severity:"high",
      symptoms:[["ptosis",0.80,0.8,"high"],["diplopia",0.70,0.7,"high"],["fatigable muscle weakness",0.85,0.85,"high"],["dysphagia",0.50,0.6,"moderate"],["dysarthria",0.40,0.5,"moderate"],["proximal limb weakness",0.45,0.5,"moderate"],["respiratory muscle weakness",0.30,0.7,"high"],["neck weakness",0.40,0.6,"moderate"]],
      tests:[["anti-AChR antibodies","immunology","high"],["anti-MuSK antibodies","immunology","moderate"],["edrophonium test","clinical","moderate"],["repetitive nerve stimulation","neurophysiology","high"],["CT chest for thymoma","imaging","moderate"]],
      treatments:[["pyridostigmine","cholinesterase inhibitor","first_line","AAN"],["prednisolone","corticosteroid","first_line","AAN"],["azathioprine","immunosuppressant","second_line","AAN"],["IVIG","immunotherapy","crisis","AAN"]]},
    {name:"Guillain-Barre syndrome",icd10:"G61.0",organ:"neurological",prior:0.002,severity:"high",
      symptoms:[["ascending weakness",0.85,0.9,"high"],["areflexia",0.80,0.85,"high"],["bilateral leg weakness",0.75,0.8,"high"],["paresthesia",0.60,0.6,"moderate"],["back pain",0.45,0.5,"moderate"],["facial weakness bilateral",0.40,0.6,"moderate"],["respiratory muscle weakness",0.35,0.7,"high"],["autonomic dysfunction",0.30,0.6,"moderate"]],
      tests:[["lumbar puncture CSF protein",0.75,"biochemistry","high"],["nerve conduction studies","neurophysiology","high"],["EMG","neurophysiology","moderate"],["spirometry","pulmonary","moderate"],["anti-ganglioside antibodies","immunology","moderate"]],
      treatments:[["IVIG","immunotherapy","first_line","AAN"],["plasmapheresis","immunotherapy","first_line","AAN"]]},
    {name:"cluster headache",icd10:"G44.0",organ:"neurological",prior:0.003,severity:"moderate",
      symptoms:[["severe unilateral periorbital pain",0.90,0.9,"high"],["lacrimation",0.75,0.8,"high"],["nasal congestion ipsilateral",0.65,0.7,"high"],["conjunctival injection",0.70,0.75,"high"],["ptosis ipsilateral",0.50,0.7,"high"],["restlessness during attack",0.60,0.7,"high"],["rhinorrhea ipsilateral",0.55,0.65,"moderate"],["facial sweating",0.45,0.5,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["MRI brain","imaging","moderate"]],
      treatments:[["sumatriptan SC","triptan","acute","IHS"],["oxygen 100% high flow","supportive","acute","IHS"],["verapamil","calcium channel blocker","prophylaxis","IHS"],["prednisone","corticosteroid","transitional","IHS"]]},
    {name:"Alzheimer disease",icd10:"G30.9",organ:"neurological",prior:0.05,severity:"high",
      symptoms:[["progressive memory loss",0.90,0.85,"high"],["difficulty with familiar tasks",0.75,0.7,"high"],["language difficulties",0.60,0.6,"moderate"],["disorientation",0.65,0.65,"moderate"],["poor judgment",0.55,0.55,"moderate"],["personality changes",0.50,0.5,"moderate"],["withdrawal from activities",0.55,0.5,"moderate"],["visuospatial difficulties",0.45,0.6,"moderate"]],
      tests:[["MMSE/MoCA screening","neuropsychological","high"],["MRI brain","imaging","high"],["PET amyloid","nuclear medicine","moderate"],["CSF biomarkers","biochemistry","moderate"]],
      treatments:[["donepezil","cholinesterase inhibitor","first_line","AAN"],["memantine","NMDA antagonist","moderate-severe","AAN"],["rivastigmine","cholinesterase inhibitor","first_line","AAN"]]},
    {name:"peripheral neuropathy diabetic",icd10:"G63.2",organ:"neurological",prior:0.05,severity:"moderate",
      symptoms:[["numbness in feet",0.80,0.7,"high"],["burning pain in feet",0.70,0.7,"high"],["tingling in extremities",0.75,0.65,"high"],["loss of sensation",0.65,0.65,"moderate"],["balance difficulties",0.45,0.5,"moderate"],["muscle weakness distal",0.40,0.5,"moderate"],["foot ulcers",0.30,0.7,"high"]],
      tests:[["nerve conduction studies","neurophysiology","high"],["HbA1c","biochemistry","high"],["monofilament test","clinical","high"],["vitamin B12 level","biochemistry","moderate"]],
      treatments:[["gabapentin","anticonvulsant","first_line","AAN"],["pregabalin","anticonvulsant","first_line","AAN"],["duloxetine","SNRI","first_line","AAN"],["amitriptyline","TCA","second_line","AAN"]]},
    {name:"essential tremor",icd10:"G25.0",organ:"neurological",prior:0.04,severity:"low",
      symptoms:[["postural tremor",0.85,0.8,"high"],["action tremor",0.80,0.8,"high"],["bilateral hand tremor",0.75,0.75,"high"],["head tremor",0.40,0.6,"moderate"],["voice tremor",0.30,0.6,"moderate"],["tremor improved with alcohol",0.35,0.8,"high"]],
      tests:[["clinical diagnosis","clinical","high"],["thyroid function","biochemistry","moderate"],["MRI brain","imaging","low"]],
      treatments:[["propranolol","beta-blocker","first_line","AAN"],["primidone","anticonvulsant","first_line","AAN"],["topiramate","anticonvulsant","second_line","AAN"]]},
    {name:"meningitis viral",icd10:"A87.9",organ:"neurological",prior:0.01,severity:"moderate",
      symptoms:[["headache",0.85,0.6,"moderate"],["fever",0.75,0.5,"moderate"],["neck stiffness",0.65,0.7,"high"],["photophobia",0.55,0.6,"moderate"],["nausea and vomiting",0.50,0.5,"moderate"],["malaise",0.45,0.3,"moderate"],["myalgia",0.35,0.3,"moderate"]],
      tests:[["lumbar puncture CSF analysis","procedure","high"],["CSF viral PCR","molecular","high"],["CBC","hematology","moderate"],["CT head","imaging","moderate"]],
      treatments:[["supportive care","supportive","first_line","IDSA"],["acyclovir","antiviral","if_HSV","IDSA"],["acetaminophen","analgesic","adjunct","NICE"]]},
    {name:"idiopathic intracranial hypertension",icd10:"G93.2",organ:"neurological",prior:0.003,severity:"moderate",
      symptoms:[["headache",0.90,0.5,"moderate"],["visual obscurations",0.55,0.7,"high"],["papilledema",0.80,0.9,"high"],["pulsatile tinnitus",0.50,0.8,"high"],["diplopia from sixth nerve palsy",0.40,0.7,"high"],["visual field loss",0.35,0.6,"moderate"]],
      tests:[["MRI brain with MRV","imaging","high"],["lumbar puncture opening pressure","procedure","high"],["visual field testing","ophthalmology","high"],["fundoscopy","ophthalmology","high"]],
      treatments:[["acetazolamide","carbonic anhydrase inhibitor","first_line","AAN"],["topiramate","anticonvulsant","second_line","AAN"],["weight loss","lifestyle","adjunct","AAN"]]},
    {name:"cervical radiculopathy",icd10:"M54.12",organ:"neurological",prior:0.03,severity:"moderate",
      symptoms:[["neck pain radiating to arm",0.85,0.8,"high"],["dermatomal arm pain",0.75,0.75,"high"],["numbness in fingers",0.60,0.6,"moderate"],["muscle weakness arm",0.50,0.6,"moderate"],["decreased reflexes",0.45,0.6,"moderate"],["neck stiffness",0.40,0.4,"moderate"],["Spurling test positive",0.55,0.8,"high"]],
      tests:[["MRI cervical spine","imaging","high"],["cervical spine X-ray","imaging","moderate"],["EMG/NCS","neurophysiology","moderate"]],
      treatments:[["gabapentin","anticonvulsant","first_line","NASS"],["ibuprofen","NSAID","first_line","NASS"],["prednisolone short course","corticosteroid","adjunct","NASS"],["physical therapy","rehabilitation","first_line","NASS"]]},
    {name:"lumbar disc herniation",icd10:"M51.1",organ:"neurological",prior:0.04,severity:"moderate",
      symptoms:[["low back pain radiating to leg",0.85,0.8,"high"],["sciatica",0.80,0.8,"high"],["numbness in leg or foot",0.55,0.6,"moderate"],["muscle weakness leg",0.40,0.6,"moderate"],["positive straight leg raise",0.65,0.8,"high"],["decreased ankle reflex",0.35,0.7,"high"],["pain worse with sitting",0.55,0.5,"moderate"]],
      tests:[["MRI lumbar spine","imaging","high"],["lumbar spine X-ray","imaging","moderate"],["EMG/NCS","neurophysiology","moderate"]],
      treatments:[["naproxen","NSAID","first_line","NASS"],["gabapentin","anticonvulsant","neuropathic","NASS"],["epidural steroid injection","corticosteroid","second_line","NASS"],["physical therapy","rehabilitation","first_line","NASS"]]},
  ];
}

// ══════════════════════════════════════════════════
// BATCH 8: CARDIOLOGY (40 diseases)
// ══════════════════════════════════════════════════
function getCardiology(): DiseaseEntry[] {
  return [
    {name:"atrial fibrillation",icd10:"I48.91",organ:"cardiovascular",prior:0.03,severity:"moderate",
      symptoms:[["palpitations",0.80,0.7,"high"],["irregular pulse",0.85,0.8,"high"],["dyspnea on exertion",0.55,0.5,"moderate"],["fatigue",0.50,0.4,"moderate"],["dizziness",0.40,0.4,"moderate"],["chest discomfort",0.35,0.4,"moderate"],["exercise intolerance",0.45,0.5,"moderate"]],
      tests:[["ECG 12-lead","cardiac","high"],["echocardiogram","cardiac","moderate"],["thyroid function","biochemistry","moderate"],["Holter monitor","cardiac","moderate"],["CBC","hematology","moderate"]],
      treatments:[["metoprolol","beta-blocker","rate_control","AHA"],["diltiazem","calcium channel blocker","rate_control","AHA"],["amiodarone","antiarrhythmic","rhythm_control","AHA"],["apixaban","DOAC","anticoagulation","AHA"],["rivaroxaban","DOAC","anticoagulation","ESC"]]},
    {name:"congestive heart failure",icd10:"I50.9",organ:"cardiovascular",prior:0.03,severity:"high",
      symptoms:[["dyspnea on exertion",0.85,0.7,"high"],["orthopnea",0.70,0.8,"high"],["paroxysmal nocturnal dyspnea",0.55,0.85,"high"],["peripheral edema",0.70,0.6,"moderate"],["fatigue",0.65,0.4,"moderate"],["jugular venous distension",0.55,0.8,"high"],["crackles bilateral",0.60,0.7,"high"],["weight gain rapid",0.45,0.5,"moderate"],["cough",0.40,0.4,"moderate"],["hepatomegaly",0.35,0.5,"moderate"]],
      tests:[["BNP/NT-proBNP","biochemistry","high"],["echocardiogram","cardiac","high"],["chest X-ray","imaging","high"],["ECG","cardiac","moderate"],["basic metabolic panel","biochemistry","moderate"]],
      treatments:[["enalapril","ACE inhibitor","first_line","AHA"],["carvedilol","beta-blocker","first_line","AHA"],["furosemide","loop diuretic","first_line","AHA"],["spironolactone","aldosterone antagonist","first_line","AHA"],["sacubitril-valsartan","ARNI","first_line","AHA"],["empagliflozin","SGLT2 inhibitor","first_line","AHA"]]},
    {name:"aortic stenosis",icd10:"I35.0",organ:"cardiovascular",prior:0.02,severity:"high",
      symptoms:[["exertional dyspnea",0.75,0.6,"moderate"],["angina",0.55,0.6,"moderate"],["syncope with exertion",0.45,0.8,"high"],["systolic ejection murmur",0.85,0.8,"high"],["crescendo-decrescendo murmur",0.80,0.85,"high"],["diminished S2",0.50,0.7,"high"],["pulsus parvus et tardus",0.40,0.85,"high"],["exercise intolerance",0.55,0.5,"moderate"]],
      tests:[["echocardiogram","cardiac","high"],["ECG","cardiac","moderate"],["cardiac catheterization","cardiac","moderate"],["chest X-ray","imaging","moderate"]],
      treatments:[["surgical aortic valve replacement","procedure","definitive","ACC/AHA"],["TAVR","procedure","alternative","ACC/AHA"],["furosemide","loop diuretic","symptomatic","ACC/AHA"]]},
    {name:"mitral regurgitation",icd10:"I34.0",organ:"cardiovascular",prior:0.02,severity:"moderate",
      symptoms:[["dyspnea on exertion",0.65,0.5,"moderate"],["palpitations",0.45,0.4,"moderate"],["fatigue",0.50,0.4,"moderate"],["holosystolic murmur at apex",0.80,0.85,"high"],["orthopnea",0.40,0.6,"moderate"],["peripheral edema",0.35,0.5,"moderate"]],
      tests:[["echocardiogram","cardiac","high"],["ECG","cardiac","moderate"],["chest X-ray","imaging","moderate"]],
      treatments:[["enalapril","ACE inhibitor","first_line","ACC/AHA"],["furosemide","loop diuretic","symptomatic","ACC/AHA"],["mitral valve repair","procedure","definitive","ACC/AHA"]]},
    {name:"unstable angina",icd10:"I20.0",organ:"cardiovascular",prior:0.015,severity:"high",
      symptoms:[["chest pain at rest",0.80,0.8,"high"],["chest pain with minimal exertion",0.75,0.75,"high"],["crescendo angina",0.65,0.8,"high"],["diaphoresis",0.50,0.6,"moderate"],["shortness of breath",0.55,0.5,"moderate"],["nausea",0.35,0.4,"moderate"],["jaw pain",0.30,0.6,"moderate"]],
      tests:[["serial troponins","cardiac","high"],["ECG 12-lead","cardiac","high"],["coronary angiography","cardiac","high"],["echocardiogram","cardiac","moderate"]],
      treatments:[["aspirin","antiplatelet","first_line","AHA"],["clopidogrel","antiplatelet","first_line","AHA"],["enoxaparin","anticoagulant","first_line","AHA"],["metoprolol","beta-blocker","first_line","AHA"],["nitroglycerin","vasodilator","adjunct","AHA"]]},
    {name:"pericarditis acute",icd10:"I30.9",organ:"cardiovascular",prior:0.01,severity:"moderate",
      symptoms:[["sharp chest pain",0.85,0.8,"high"],["chest pain worse with inspiration",0.75,0.8,"high"],["chest pain relieved by leaning forward",0.65,0.85,"high"],["pericardial friction rub",0.50,0.9,"high"],["fever",0.45,0.4,"moderate"],["dyspnea",0.40,0.4,"moderate"],["diffuse ST elevation on ECG",0.55,0.85,"high"]],
      tests:[["ECG","cardiac","high"],["echocardiogram","cardiac","high"],["troponin","cardiac","moderate"],["CRP/ESR","biochemistry","moderate"],["chest X-ray","imaging","moderate"]],
      treatments:[["ibuprofen","NSAID","first_line","ESC"],["colchicine","anti-inflammatory","first_line","ESC"],["prednisolone","corticosteroid","refractory","ESC"]]},
    {name:"infective endocarditis",icd10:"I33.0",organ:"cardiovascular",prior:0.005,severity:"critical",
      symptoms:[["fever prolonged",0.85,0.6,"high"],["new heart murmur",0.70,0.8,"high"],["petechiae",0.40,0.5,"moderate"],["Janeway lesions",0.30,0.9,"high"],["Osler nodes",0.30,0.9,"high"],["splinter hemorrhages",0.35,0.7,"high"],["embolic phenomena",0.40,0.7,"high"],["night sweats",0.35,0.4,"moderate"],["weight loss",0.35,0.4,"moderate"]],
      tests:[["blood cultures serial","microbiology","high"],["echocardiogram TEE","cardiac","high"],["CBC","hematology","moderate"],["CRP/ESR","biochemistry","moderate"],["urinalysis","biochemistry","moderate"]],
      treatments:[["vancomycin","glycopeptide","empiric","AHA"],["gentamicin","aminoglycoside","adjunct","AHA"],["ceftriaxone","cephalosporin","streptococcal","AHA"],["surgical valve replacement","procedure","complicated","AHA"]]},
    {name:"supraventricular tachycardia",icd10:"I47.1",organ:"cardiovascular",prior:0.02,severity:"moderate",
      symptoms:[["sudden onset palpitations",0.90,0.85,"high"],["rapid regular pulse",0.85,0.8,"high"],["dizziness",0.50,0.5,"moderate"],["chest discomfort",0.40,0.4,"moderate"],["dyspnea",0.40,0.4,"moderate"],["anxiety",0.35,0.3,"moderate"],["presyncope",0.30,0.5,"moderate"]],
      tests:[["ECG 12-lead","cardiac","high"],["Holter monitor","cardiac","moderate"],["electrophysiology study","cardiac","moderate"]],
      treatments:[["adenosine","antiarrhythmic","acute","AHA"],["verapamil","calcium channel blocker","acute","AHA"],["metoprolol","beta-blocker","prophylaxis","AHA"],["catheter ablation","procedure","definitive","AHA"]]},
    {name:"ventricular tachycardia",icd10:"I47.2",organ:"cardiovascular",prior:0.005,severity:"critical",
      symptoms:[["palpitations",0.70,0.6,"moderate"],["dizziness",0.55,0.5,"moderate"],["syncope",0.50,0.7,"high"],["chest pain",0.45,0.5,"moderate"],["dyspnea",0.45,0.5,"moderate"],["hypotension",0.40,0.6,"moderate"],["loss of consciousness",0.35,0.7,"high"]],
      tests:[["ECG 12-lead","cardiac","high"],["cardiac monitoring","cardiac","high"],["echocardiogram","cardiac","moderate"],["electrolyte panel","biochemistry","moderate"]],
      treatments:[["amiodarone","antiarrhythmic","first_line","AHA"],["lidocaine","antiarrhythmic","acute","AHA"],["synchronized cardioversion","procedure","unstable","AHA"],["ICD implantation","procedure","prophylaxis","AHA"]]},
    {name:"peripheral artery disease",icd10:"I73.9",organ:"cardiovascular",prior:0.05,severity:"moderate",
      symptoms:[["intermittent claudication",0.80,0.85,"high"],["leg pain with walking",0.75,0.7,"high"],["diminished peripheral pulses",0.65,0.8,"high"],["cool extremities",0.50,0.5,"moderate"],["skin color changes legs",0.45,0.5,"moderate"],["hair loss legs",0.40,0.5,"moderate"],["non-healing leg ulcers",0.35,0.7,"high"],["rest pain",0.30,0.7,"high"]],
      tests:[["ankle-brachial index","vascular","high"],["duplex ultrasound","imaging","moderate"],["CT angiography","imaging","moderate"],["lipid panel","biochemistry","moderate"]],
      treatments:[["cilostazol","phosphodiesterase inhibitor","first_line","ACC/AHA"],["aspirin","antiplatelet","first_line","ACC/AHA"],["atorvastatin","statin","first_line","ACC/AHA"],["supervised exercise","rehabilitation","first_line","ACC/AHA"]]},
    {name:"deep vein thrombosis",icd10:"I82.40",organ:"cardiovascular",prior:0.01,severity:"high",
      symptoms:[["unilateral leg swelling",0.80,0.8,"high"],["calf pain",0.70,0.7,"high"],["warmth over affected area",0.55,0.6,"moderate"],["erythema of leg",0.45,0.5,"moderate"],["Homan sign positive",0.35,0.5,"moderate"],["pitting edema",0.50,0.6,"moderate"]],
      tests:[["duplex ultrasound legs","imaging","high"],["D-dimer","hematology","high"],["Wells score","clinical","high"]],
      treatments:[["enoxaparin","anticoagulant","first_line","ACCP"],["rivaroxaban","DOAC","first_line","ACCP"],["apixaban","DOAC","first_line","ACCP"],["warfarin","anticoagulant","alternative","ACCP"]]},
    {name:"hypertrophic cardiomyopathy",icd10:"I42.1",organ:"cardiovascular",prior:0.005,severity:"high",
      symptoms:[["exertional dyspnea",0.65,0.6,"moderate"],["chest pain with exertion",0.55,0.6,"moderate"],["syncope with exertion",0.40,0.8,"high"],["palpitations",0.45,0.5,"moderate"],["systolic murmur increasing with Valsalva",0.55,0.9,"high"],["sudden cardiac death family history",0.30,0.8,"high"]],
      tests:[["echocardiogram","cardiac","high"],["ECG","cardiac","moderate"],["cardiac MRI","imaging","moderate"],["genetic testing","genetics","moderate"]],
      treatments:[["metoprolol","beta-blocker","first_line","AHA"],["verapamil","calcium channel blocker","alternative","AHA"],["disopyramide","antiarrhythmic","adjunct","AHA"],["septal myectomy","procedure","refractory","AHA"],["mavacamten","cardiac myosin inhibitor","first_line","AHA"]]},
  ];
}

// ══════════════════════════════════════════════════
// BATCH 9: PULMONOLOGY (35 diseases)
// ══════════════════════════════════════════════════
function getPulmonology(): DiseaseEntry[] {
  return [
    {name:"asthma",icd10:"J45.9",organ:"pulmonary",prior:0.08,severity:"moderate",
      symptoms:[["wheezing",0.85,0.8,"high"],["dyspnea episodic",0.80,0.7,"high"],["chest tightness",0.65,0.6,"moderate"],["cough worse at night",0.70,0.65,"high"],["cough with exercise",0.55,0.6,"moderate"],["response to bronchodilator",0.65,0.8,"high"],["prolonged expiration",0.50,0.7,"high"]],
      tests:[["spirometry with reversibility","pulmonary","high"],["peak flow monitoring","pulmonary","moderate"],["exhaled nitric oxide","pulmonary","moderate"],["chest X-ray","imaging","moderate"],["allergy testing","immunology","moderate"]],
      treatments:[["salbutamol","SABA","reliever","GINA"],["budesonide inhaled","ICS","first_line","GINA"],["fluticasone-salmeterol","ICS-LABA","step_up","GINA"],["montelukast","leukotriene antagonist","adjunct","GINA"],["tiotropium","LAMA","add_on","GINA"]]},
    {name:"COPD",icd10:"J44.1",organ:"pulmonary",prior:0.06,severity:"moderate",
      symptoms:[["chronic productive cough",0.75,0.7,"high"],["dyspnea progressive",0.80,0.7,"high"],["wheezing",0.55,0.5,"moderate"],["barrel chest",0.40,0.7,"high"],["pursed lip breathing",0.35,0.75,"high"],["use of accessory muscles",0.45,0.6,"moderate"],["cyanosis",0.30,0.6,"moderate"],["reduced breath sounds",0.50,0.6,"moderate"]],
      tests:[["spirometry post-bronchodilator","pulmonary","high"],["chest X-ray","imaging","moderate"],["CT chest","imaging","moderate"],["ABG","biochemistry","moderate"],["alpha-1 antitrypsin","biochemistry","moderate"]],
      treatments:[["tiotropium","LAMA","first_line","GOLD"],["salbutamol","SABA","reliever","GOLD"],["fluticasone-salmeterol","ICS-LABA","moderate-severe","GOLD"],["roflumilast","PDE4 inhibitor","adjunct","GOLD"],["azithromycin","macrolide","prophylaxis","GOLD"]]},
    {name:"pleural effusion",icd10:"J91.8",organ:"pulmonary",prior:0.02,severity:"moderate",
      symptoms:[["dyspnea",0.75,0.6,"moderate"],["pleuritic chest pain",0.55,0.5,"moderate"],["decreased breath sounds",0.70,0.7,"high"],["dullness to percussion",0.75,0.8,"high"],["cough",0.45,0.4,"moderate"],["reduced chest expansion",0.55,0.6,"moderate"]],
      tests:[["chest X-ray","imaging","high"],["chest ultrasound","imaging","high"],["thoracentesis","procedure","high"],["CT chest","imaging","moderate"],["pleural fluid analysis","biochemistry","high"]],
      treatments:[["thoracentesis","procedure","therapeutic","BTS"],["chest tube drainage","procedure","large_effusion","BTS"],["treat underlying cause","supportive","first_line","BTS"]]},
    {name:"pneumothorax spontaneous",icd10:"J93.1",organ:"pulmonary",prior:0.01,severity:"moderate",
      symptoms:[["sudden pleuritic chest pain",0.85,0.8,"high"],["dyspnea sudden onset",0.80,0.75,"high"],["absent breath sounds unilateral",0.65,0.85,"high"],["hyperresonance to percussion",0.55,0.8,"high"],["tachycardia",0.45,0.4,"moderate"],["tachypnea",0.50,0.5,"moderate"]],
      tests:[["chest X-ray","imaging","high"],["CT chest","imaging","moderate"]],
      treatments:[["observation","supportive","small","BTS"],["needle aspiration","procedure","moderate","BTS"],["chest tube insertion","procedure","large","BTS"]]},
    {name:"pulmonary fibrosis idiopathic",icd10:"J84.1",organ:"pulmonary",prior:0.005,severity:"high",
      symptoms:[["progressive dyspnea",0.90,0.7,"high"],["dry cough chronic",0.70,0.6,"moderate"],["bibasilar crackles velcro-like",0.75,0.9,"high"],["clubbing",0.45,0.8,"high"],["fatigue",0.50,0.4,"moderate"],["exercise intolerance",0.55,0.5,"moderate"]],
      tests:[["HRCT chest","imaging","high"],["spirometry","pulmonary","high"],["DLCO","pulmonary","high"],["six-minute walk test","pulmonary","moderate"],["lung biopsy","pathology","moderate"]],
      treatments:[["pirfenidone","antifibrotic","first_line","ATS"],["nintedanib","antifibrotic","first_line","ATS"],["supplemental oxygen","supportive","symptomatic","ATS"]]},
    {name:"obstructive sleep apnea",icd10:"G47.33",organ:"pulmonary",prior:0.10,severity:"moderate",
      symptoms:[["loud snoring",0.85,0.7,"high"],["witnessed apneic episodes",0.75,0.85,"high"],["excessive daytime sleepiness",0.80,0.75,"high"],["morning headache",0.45,0.5,"moderate"],["unrefreshing sleep",0.60,0.6,"moderate"],["nocturia",0.40,0.4,"moderate"],["difficulty concentrating",0.45,0.4,"moderate"],["gasping or choking during sleep",0.60,0.8,"high"]],
      tests:[["polysomnography","sleep study","high"],["home sleep apnea test","sleep study","moderate"],["Epworth sleepiness scale","clinical","moderate"],["BMI calculation","anthropometry","moderate"]],
      treatments:[["CPAP","device","first_line","AASM"],["mandibular advancement device","device","alternative","AASM"],["weight loss","lifestyle","adjunct","AASM"],["uvulopalatopharyngoplasty","procedure","refractory","AASM"]]},
    {name:"bronchiectasis",icd10:"J47.9",organ:"pulmonary",prior:0.01,severity:"moderate",
      symptoms:[["chronic productive cough",0.85,0.8,"high"],["copious purulent sputum",0.75,0.8,"high"],["recurrent respiratory infections",0.65,0.7,"high"],["hemoptysis",0.40,0.6,"moderate"],["dyspnea",0.50,0.5,"moderate"],["wheezing",0.35,0.4,"moderate"],["clubbing",0.30,0.6,"moderate"]],
      tests:[["HRCT chest","imaging","high"],["sputum culture","microbiology","moderate"],["spirometry","pulmonary","moderate"],["immunoglobulin levels","immunology","moderate"]],
      treatments:[["airway clearance techniques","physiotherapy","first_line","BTS"],["azithromycin prophylactic","macrolide","prophylaxis","BTS"],["inhaled tobramycin","aminoglycoside","pseudomonas","BTS"]]},
    {name:"sarcoidosis",icd10:"D86.0",organ:"pulmonary",prior:0.005,severity:"moderate",
      symptoms:[["dry cough",0.60,0.5,"moderate"],["dyspnea",0.55,0.5,"moderate"],["bilateral hilar lymphadenopathy",0.70,0.85,"high"],["erythema nodosum",0.35,0.7,"high"],["fatigue",0.60,0.4,"moderate"],["fever",0.35,0.4,"moderate"],["arthralgia",0.40,0.4,"moderate"],["skin lesions",0.35,0.5,"moderate"],["uveitis",0.30,0.7,"high"]],
      tests:[["chest X-ray","imaging","high"],["CT chest","imaging","moderate"],["serum ACE level","biochemistry","moderate"],["biopsy granuloma","pathology","high"],["calcium level","biochemistry","moderate"],["spirometry","pulmonary","moderate"]],
      treatments:[["prednisolone","corticosteroid","first_line","ATS"],["methotrexate","immunosuppressant","second_line","ATS"],["azathioprine","immunosuppressant","second_line","ATS"]]},
    {name:"acute respiratory distress syndrome",icd10:"J80",organ:"pulmonary",prior:0.005,severity:"critical",
      symptoms:[["severe dyspnea acute onset",0.90,0.8,"high"],["hypoxia refractory",0.85,0.85,"high"],["tachypnea",0.80,0.6,"moderate"],["bilateral crackles",0.65,0.6,"moderate"],["cyanosis",0.55,0.6,"moderate"],["use of accessory muscles",0.60,0.5,"moderate"]],
      tests:[["ABG","biochemistry","high"],["chest X-ray bilateral infiltrates","imaging","high"],["CT chest","imaging","moderate"],["BNP to exclude cardiogenic","biochemistry","moderate"]],
      treatments:[["lung protective ventilation","procedure","first_line","ARDS Network"],["prone positioning","procedure","severe","ARDS Network"],["neuromuscular blockade","adjunct","severe","ARDS Network"]]},
    {name:"lung cancer",icd10:"C34.9",organ:"pulmonary",prior:0.02,severity:"critical",
      symptoms:[["persistent cough",0.65,0.5,"moderate"],["hemoptysis",0.40,0.7,"high"],["weight loss",0.55,0.5,"moderate"],["chest pain",0.45,0.4,"moderate"],["dyspnea",0.50,0.5,"moderate"],["hoarseness",0.30,0.5,"moderate"],["recurrent pneumonia",0.30,0.6,"moderate"],["bone pain metastatic",0.30,0.5,"moderate"],["clubbing",0.30,0.6,"moderate"]],
      tests:[["CT chest with contrast","imaging","high"],["PET-CT","imaging","moderate"],["bronchoscopy with biopsy","pathology","high"],["sputum cytology","pathology","moderate"],["tumor markers","biochemistry","moderate"]],
      treatments:[["surgical resection","procedure","early_stage","NCCN"],["carboplatin-paclitaxel","chemotherapy","advanced","NCCN"],["pembrolizumab","immunotherapy","first_line","NCCN"],["osimertinib","targeted therapy","EGFR_positive","NCCN"]]},
  ];
}

// Physiology states for these specialties
function getPhysStates(): {state_name:string;description:string;organ_system:string}[] {
  return [
    {state_name:"neuronal hyperexcitability",description:"Abnormal lowering of seizure threshold in cortical neurons",organ_system:"neurological"},
    {state_name:"dopaminergic neurodegeneration",description:"Progressive loss of dopaminergic neurons in substantia nigra",organ_system:"neurological"},
    {state_name:"CNS demyelination",description:"Autoimmune destruction of myelin sheaths in central nervous system",organ_system:"neurological"},
    {state_name:"trigeminal nerve compression",description:"Vascular compression of trigeminal nerve root entry zone",organ_system:"neurological"},
    {state_name:"facial nerve inflammation",description:"Inflammatory edema of facial nerve within temporal bone",organ_system:"neurological"},
    {state_name:"neuromuscular junction dysfunction",description:"Autoimmune attack on acetylcholine receptors at NMJ",organ_system:"neurological"},
    {state_name:"peripheral nerve demyelination",description:"Autoimmune demyelination of peripheral nerves",organ_system:"neurological"},
    {state_name:"trigeminal autonomic activation",description:"Activation of trigeminal-autonomic reflex arc causing headache",organ_system:"neurological"},
    {state_name:"cortical amyloid deposition",description:"Accumulation of amyloid plaques and tau tangles in cortex",organ_system:"neurological"},
    {state_name:"peripheral nerve axonal injury",description:"Metabolic damage to peripheral nerve axons",organ_system:"neurological"},
    {state_name:"cardiac atrial reentry",description:"Disorganized electrical reentry circuits in atria",organ_system:"cardiovascular"},
    {state_name:"ventricular systolic dysfunction",description:"Impaired ventricular contraction and reduced ejection fraction",organ_system:"cardiovascular"},
    {state_name:"aortic valve calcification",description:"Progressive calcification and stenosis of aortic valve",organ_system:"cardiovascular"},
    {state_name:"coronary plaque instability",description:"Unstable atherosclerotic plaque with risk of rupture",organ_system:"cardiovascular"},
    {state_name:"pericardial inflammation",description:"Inflammatory process affecting pericardium",organ_system:"cardiovascular"},
    {state_name:"valvular vegetation formation",description:"Bacterial colonization forming vegetations on heart valves",organ_system:"cardiovascular"},
    {state_name:"atrioventricular nodal reentry",description:"Reentry circuit within or near AV node",organ_system:"cardiovascular"},
    {state_name:"ventricular reentry circuit",description:"Reentry pathway through ventricular myocardium",organ_system:"cardiovascular"},
    {state_name:"peripheral atherosclerosis",description:"Atherosclerotic narrowing of peripheral arteries",organ_system:"cardiovascular"},
    {state_name:"venous thrombosis formation",description:"Clot formation in deep venous system",organ_system:"cardiovascular"},
    {state_name:"septal hypertrophy obstruction",description:"Asymmetric septal hypertrophy causing outflow obstruction",organ_system:"cardiovascular"},
    {state_name:"bronchial hyperresponsiveness",description:"Excessive airway narrowing in response to triggers",organ_system:"pulmonary"},
    {state_name:"airway chronic inflammation",description:"Persistent airway inflammation with mucus hypersecretion",organ_system:"pulmonary"},
    {state_name:"pleural fluid accumulation",description:"Accumulation of fluid in pleural space",organ_system:"pulmonary"},
    {state_name:"alveolar rupture",description:"Rupture of alveolar wall allowing air into pleural space",organ_system:"pulmonary"},
    {state_name:"pulmonary fibrotic remodeling",description:"Progressive fibrotic replacement of lung parenchyma",organ_system:"pulmonary"},
    {state_name:"upper airway collapse",description:"Repetitive collapse of upper airway during sleep",organ_system:"pulmonary"},
    {state_name:"bronchial wall destruction",description:"Irreversible dilation and destruction of bronchial walls",organ_system:"pulmonary"},
    {state_name:"non-caseating granuloma formation",description:"Formation of non-caseating granulomas in affected organs",organ_system:"pulmonary"},
    {state_name:"diffuse alveolar damage",description:"Acute widespread damage to alveolar epithelium and capillaries",organ_system:"pulmonary"},
    {state_name:"pulmonary neoplastic proliferation",description:"Uncontrolled cell growth in lung tissue",organ_system:"pulmonary"},
    {state_name:"mitral valve incompetence",description:"Failure of mitral valve leaflets to coapt properly",organ_system:"cardiovascular"},
    {state_name:"CSF pressure elevation non-tumoral",description:"Elevated intracranial pressure without space-occupying lesion",organ_system:"neurological"},
    {state_name:"spinal nerve root compression",description:"Compression of spinal nerve root by disc or bone",organ_system:"neurological"},
  ];
}

// Dangerous diagnoses
function getDangerTriggers(): {trigger:string;disease:string;severity:string;protocol:string;source:string;priority:number}[] {
  return [
    {trigger:"ascending weakness",disease:"Guillain-Barre syndrome",severity:"critical",protocol:"ICU admission, respiratory monitoring, IVIG/plasmapheresis",source:"AAN",priority:1},
    {trigger:"respiratory muscle weakness",disease:"Guillain-Barre syndrome",severity:"critical",protocol:"Intubation readiness, serial FVC monitoring",source:"AAN",priority:1},
    {trigger:"fatigable muscle weakness",disease:"myasthenia gravis",severity:"high",protocol:"Anti-AChR testing, respiratory monitoring",source:"AAN",priority:2},
    {trigger:"syncope with exertion",disease:"aortic stenosis",severity:"critical",protocol:"Urgent echocardiography, activity restriction",source:"ACC/AHA",priority:1},
    {trigger:"syncope with exertion",disease:"hypertrophic cardiomyopathy",severity:"critical",protocol:"Echocardiography, ICD evaluation",source:"AHA",priority:1},
    {trigger:"new heart murmur",disease:"infective endocarditis",severity:"critical",protocol:"Blood cultures, TEE, empiric antibiotics",source:"AHA",priority:1},
    {trigger:"fever prolonged",disease:"infective endocarditis",severity:"high",protocol:"Blood cultures x3, echocardiography",source:"AHA",priority:2},
    {trigger:"sudden onset palpitations",disease:"ventricular tachycardia",severity:"critical",protocol:"12-lead ECG, cardiac monitoring, amiodarone/cardioversion",source:"AHA",priority:1},
    {trigger:"severe dyspnea acute onset",disease:"acute respiratory distress syndrome",severity:"critical",protocol:"ICU admission, lung-protective ventilation",source:"ARDS Network",priority:1},
    {trigger:"hypoxia refractory",disease:"acute respiratory distress syndrome",severity:"critical",protocol:"Prone positioning, neuromuscular blockade consideration",source:"ARDS Network",priority:1},
    {trigger:"hemoptysis",disease:"lung cancer",severity:"high",protocol:"CT chest, bronchoscopy referral",source:"NCCN",priority:2},
    {trigger:"bilateral leg weakness",disease:"Guillain-Barre syndrome",severity:"critical",protocol:"Urgent neurology consult, spirometry",source:"AAN",priority:1},
    {trigger:"chest pain at rest",disease:"unstable angina",severity:"critical",protocol:"Serial troponins, ECG, antiplatelet therapy",source:"AHA",priority:1},
    {trigger:"unilateral leg swelling",disease:"deep vein thrombosis",severity:"high",protocol:"D-dimer, duplex US, anticoagulation if confirmed",source:"ACCP",priority:2},
    {trigger:"papilledema",disease:"idiopathic intracranial hypertension",severity:"high",protocol:"Urgent MRI/MRV, LP with opening pressure",source:"AAN",priority:2},
  ];
}

// Clinical guidelines
function getGuidelinesData(): any[] {
  return [
    {title:"Epilepsy Management 2023",condition:"epilepsy",source:"ILAE 2023",source_organization:"International League Against Epilepsy",evidence_grade:"A",year:2023,recommendation_text:"Monotherapy first-line. Levetiracetam or lamotrigine for focal. Valproate for generalized. Avoid valproate in women of childbearing age.",summary:"ILAE position paper on treatment of epilepsy",clinical_topic:"Neurology",keywords:["epilepsy","seizure","anticonvulsant","EEG"],applicable_tests:["EEG","MRI brain"],applicable_drugs:["levetiracetam","carbamazepine","valproate","lamotrigine"]},
    {title:"Parkinson Disease Treatment 2024",condition:"Parkinson disease",source:"AAN 2024",source_organization:"American Academy of Neurology",evidence_grade:"A",year:2024,recommendation_text:"Levodopa-carbidopa remains most effective. Dopamine agonists for younger patients. MAO-B inhibitors as adjunct.",summary:"AAN practice guidelines for Parkinson disease",clinical_topic:"Neurology",keywords:["Parkinson","levodopa","dopamine","tremor"],applicable_tests:["clinical assessment","DaTscan"],applicable_drugs:["levodopa-carbidopa","pramipexole","rasagiline","amantadine"]},
    {title:"Multiple Sclerosis Disease-Modifying Therapy 2024",condition:"multiple sclerosis",source:"AAN 2024",source_organization:"American Academy of Neurology",evidence_grade:"A",year:2024,recommendation_text:"Start DMT early after diagnosis. High-efficacy therapy for active disease. Ocrelizumab for primary progressive MS.",summary:"Updated practice guideline for disease-modifying therapies in MS",clinical_topic:"Neurology",keywords:["MS","DMT","ocrelizumab","relapse"],applicable_tests:["MRI brain","MRI spine","CSF"],applicable_drugs:["ocrelizumab","dimethyl fumarate","glatiramer acetate"]},
    {title:"Atrial Fibrillation Management 2024",condition:"atrial fibrillation",source:"AHA/ACC 2024",source_organization:"American Heart Association",evidence_grade:"A",year:2024,recommendation_text:"CHA2DS2-VASc score for anticoagulation decision. DOACs preferred over warfarin. Rate vs rhythm control based on symptoms.",summary:"AHA/ACC guideline for management of atrial fibrillation",clinical_topic:"Cardiology",keywords:["AFib","anticoagulation","rate control","DOAC"],applicable_tests:["ECG","echocardiogram","thyroid function"],applicable_drugs:["apixaban","metoprolol","amiodarone","rivaroxaban"]},
    {title:"Heart Failure Management 2024",condition:"congestive heart failure",source:"AHA/ACC 2024",source_organization:"American Heart Association",evidence_grade:"A",year:2024,recommendation_text:"Quadruple therapy for HFrEF: ACEi/ARNI + beta-blocker + MRA + SGLT2i. Diuretics for congestion. Device therapy for EF≤35%.",summary:"AHA/ACC guideline for management of heart failure",clinical_topic:"Cardiology",keywords:["heart failure","HFrEF","ARNI","SGLT2i"],applicable_tests:["BNP","echocardiogram","chest X-ray"],applicable_drugs:["sacubitril-valsartan","carvedilol","spironolactone","empagliflozin"]},
    {title:"Asthma Management GINA 2024",condition:"asthma",source:"GINA 2024",source_organization:"Global Initiative for Asthma",evidence_grade:"A",year:2024,recommendation_text:"Track 1: ICS-formoterol as reliever and controller. Step up by increasing ICS dose. Add LAMA or biologic for severe asthma.",summary:"GINA Global Strategy for Asthma Management and Prevention",clinical_topic:"Pulmonology",keywords:["asthma","ICS","LABA","GINA"],applicable_tests:["spirometry","peak flow","FeNO"],applicable_drugs:["budesonide-formoterol","fluticasone","salbutamol","montelukast"]},
    {title:"COPD Management GOLD 2024",condition:"COPD",source:"GOLD 2024",source_organization:"Global Initiative for Chronic Obstructive Lung Disease",evidence_grade:"A",year:2024,recommendation_text:"LAMA or LAMA/LABA for Group B. ICS/LABA/LAMA triple therapy for Group E with eosinophils ≥300. Pulmonary rehabilitation for all.",summary:"GOLD report for COPD prevention, diagnosis and management",clinical_topic:"Pulmonology",keywords:["COPD","GOLD","LAMA","exacerbation"],applicable_tests:["spirometry","ABG","CT chest"],applicable_drugs:["tiotropium","fluticasone-salmeterol","roflumilast"]},
    {title:"DVT and PE Management 2024",condition:"deep vein thrombosis",source:"ACCP 2024",source_organization:"American College of Chest Physicians",evidence_grade:"A",year:2024,recommendation_text:"DOACs first-line for VTE. Minimum 3 months for provoked. Extended anticoagulation for unprovoked. Compression stockings optional.",summary:"ACCP evidence-based guidelines on VTE treatment",clinical_topic:"Hematology",keywords:["DVT","VTE","anticoagulation","DOAC"],applicable_tests:["duplex US","D-dimer","CT-PA"],applicable_drugs:["rivaroxaban","apixaban","enoxaparin","warfarin"]},
    {title:"Idiopathic Pulmonary Fibrosis 2023",condition:"pulmonary fibrosis idiopathic",source:"ATS/ERS 2023",source_organization:"American Thoracic Society",evidence_grade:"A",year:2023,recommendation_text:"Antifibrotic therapy with pirfenidone or nintedanib for all patients with IPF. No role for corticosteroids or immunosuppressants.",summary:"ATS/ERS clinical practice guideline for IPF",clinical_topic:"Pulmonology",keywords:["IPF","pirfenidone","nintedanib","fibrosis"],applicable_tests:["HRCT","spirometry","DLCO"],applicable_drugs:["pirfenidone","nintedanib"]},
    {title:"Obstructive Sleep Apnea Management 2024",condition:"obstructive sleep apnea",source:"AASM 2024",source_organization:"American Academy of Sleep Medicine",evidence_grade:"A",year:2024,recommendation_text:"CPAP first-line for moderate-severe OSA. Mandibular advancement for mild-moderate. Weight loss for BMI>25. Screen for HTN, DM.",summary:"AASM clinical practice guideline for OSA",clinical_topic:"Sleep Medicine",keywords:["OSA","CPAP","AHI","sleepiness"],applicable_tests:["polysomnography","home sleep test","Epworth"],applicable_drugs:["CPAP device"]},
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

  addLog("=== KG Expansion Batch 7-9: Neurology + Cardiology + Pulmonology ===");

  try {
    const diseases: DiseaseEntry[] = [...getNeurology(), ...getCardiology(), ...getPulmonology()];
    addLog(`Total diseases: ${diseases.length}`);

    const uniqueSymptoms = new Set<string>();
    for (const d of diseases) for (const [sym] of d.symptoms) uniqueSymptoms.add(sym);
    addLog(`Unique symptoms: ${uniqueSymptoms.size}`);

    // Step 1: Upsert diagnoses
    const diagRows = diseases.map(d => ({ diagnosis_name: d.name, icd10_code: d.icd10, category: d.organ }));
    for (let i = 0; i < diagRows.length; i += 100) {
      const { error } = await supabase.from("diagnoses").upsert(diagRows.slice(i, i + 100), { onConflict: "diagnosis_name", ignoreDuplicates: true });
      if (error) addLog(`Diag error: ${error.message}`);
    }

    // Fetch diagnosis IDs
    const allDiagIds: Record<string, string> = {};
    let offset = 0;
    while (true) {
      const { data } = await supabase.from("diagnoses").select("id, diagnosis_name").range(offset, offset + 999);
      if (!data || data.length === 0) break;
      for (const r of data) allDiagIds[r.diagnosis_name] = r.id;
      offset += data.length;
      if (data.length < 1000) break;
    }

    // Step 2: Upsert symptoms
    const symRows = Array.from(uniqueSymptoms).map(s => ({ symptom_name: s, category: "general" }));
    for (let i = 0; i < symRows.length; i += 100) {
      const { error } = await supabase.from("symptoms").upsert(symRows.slice(i, i + 100), { onConflict: "symptom_name", ignoreDuplicates: true });
      if (error) addLog(`Sym error: ${error.message}`);
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

    // Step 3: Disease priors
    const priorRows = diseases.filter(d => allDiagIds[d.name]).map(d => ({
      diagnosis_id: allDiagIds[d.name], base_prevalence: d.prior, age_modifier: {}, sex_modifier: {}, region_modifier: {},
    }));
    for (let i = 0; i < priorRows.length; i += 100) {
      const { error } = await supabase.from("disease_priors").upsert(priorRows.slice(i, i + 100), { onConflict: "diagnosis_id", ignoreDuplicates: false });
      if (error) addLog(`Prior error: ${error.message}`);
    }

    // Step 4: Symptom likelihoods
    const likRows: any[] = [];
    for (const d of diseases) {
      const dId = allDiagIds[d.name];
      if (!dId) continue;
      for (const [sym, prob] of d.symptoms) {
        const sId = allSymIds[sym];
        if (sId) likRows.push({ symptom_id: sId, diagnosis_id: dId, likelihood_value: prob });
      }
    }
    for (let i = 0; i < likRows.length; i += 200) {
      const { error } = await supabase.from("symptom_likelihoods").upsert(likRows.slice(i, i + 200), { onConflict: "symptom_id,diagnosis_id", ignoreDuplicates: false });
      if (error) addLog(`Lik error: ${error.message}`);
    }
    addLog(`Likelihoods: ${likRows.length}`);

    // Step 5: Disease tests
    const testRows = diseases.flatMap(d => d.tests.map(t => ({
      disease_name: d.name, test_name: t[0], test_category: t[1], diagnostic_strength: t[2],
    })));
    for (let i = 0; i < testRows.length; i += 200) {
      const { error } = await supabase.from("disease_tests").upsert(testRows.slice(i, i + 200), { onConflict: "disease_name,test_name", ignoreDuplicates: true });
      if (error) addLog(`Test error: ${error.message}`);
    }

    // Step 6: Disease treatments
    const txRows = diseases.flatMap(d => d.treatments.map(t => ({
      disease_name: d.name, drug_name: t[0], drug_class: t[1], line_of_treatment: t[2], guideline_source: t[3],
    })));
    for (let i = 0; i < txRows.length; i += 200) {
      const { error } = await supabase.from("disease_treatments").upsert(txRows.slice(i, i + 200), { onConflict: "disease_name,drug_name", ignoreDuplicates: true });
      if (error) addLog(`Tx error: ${error.message}`);
    }

    // Step 7: Physiology states
    const physStates = getPhysStates();
    const { data: systems } = await supabase.from("anatomical_systems").select("id, system_name");
    const systemIds: Record<string, string> = {};
    for (const s of systems || []) systemIds[s.system_name] = s.id;

    const stateRows = physStates.map(s => ({
      state_name: s.state_name, description: s.description, system_id: systemIds[s.organ_system] || Object.values(systemIds)[0],
    }));
    for (let i = 0; i < stateRows.length; i += 50) {
      const { error } = await supabase.from("physiological_states").upsert(stateRows.slice(i, i + 50), { onConflict: "state_name", ignoreDuplicates: true });
      if (error) addLog(`Phys state error: ${error.message}`);
    }

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

    // Step 8: Symptom-physiology mappings
    const symPhysMaps: [string, string, number, number][] = [
      ["recurrent seizures","neuronal hyperexcitability",0.9,0.9],
      ["aura","neuronal hyperexcitability",0.7,0.7],
      ["resting tremor","dopaminergic neurodegeneration",0.8,0.85],
      ["bradykinesia","dopaminergic neurodegeneration",0.85,0.85],
      ["rigidity","dopaminergic neurodegeneration",0.75,0.8],
      ["shuffling gait","dopaminergic neurodegeneration",0.7,0.75],
      ["optic neuritis","CNS demyelination",0.7,0.8],
      ["Lhermitte sign","CNS demyelination",0.6,0.9],
      ["spasticity","CNS demyelination",0.5,0.6],
      ["severe lancinating facial pain","trigeminal nerve compression",0.9,0.9],
      ["electric shock-like pain","trigeminal nerve compression",0.85,0.85],
      ["sudden unilateral facial weakness","facial nerve inflammation",0.85,0.85],
      ["inability to close eye","facial nerve inflammation",0.8,0.85],
      ["ptosis","neuromuscular junction dysfunction",0.75,0.8],
      ["fatigable muscle weakness","neuromuscular junction dysfunction",0.85,0.85],
      ["diplopia","neuromuscular junction dysfunction",0.6,0.65],
      ["ascending weakness","peripheral nerve demyelination",0.85,0.9],
      ["areflexia","peripheral nerve demyelination",0.8,0.85],
      ["severe unilateral periorbital pain","trigeminal autonomic activation",0.9,0.9],
      ["lacrimation","trigeminal autonomic activation",0.7,0.75],
      ["conjunctival injection","trigeminal autonomic activation",0.7,0.75],
      ["progressive memory loss","cortical amyloid deposition",0.85,0.85],
      ["language difficulties","cortical amyloid deposition",0.55,0.6],
      ["numbness in feet","peripheral nerve axonal injury",0.75,0.7],
      ["burning pain in feet","peripheral nerve axonal injury",0.7,0.7],
      ["palpitations","cardiac atrial reentry",0.6,0.55],
      ["irregular pulse","cardiac atrial reentry",0.8,0.8],
      ["dyspnea on exertion","ventricular systolic dysfunction",0.6,0.55],
      ["orthopnea","ventricular systolic dysfunction",0.7,0.8],
      ["paroxysmal nocturnal dyspnea","ventricular systolic dysfunction",0.6,0.85],
      ["peripheral edema","ventricular systolic dysfunction",0.55,0.5],
      ["systolic ejection murmur","aortic valve calcification",0.8,0.8],
      ["crescendo-decrescendo murmur","aortic valve calcification",0.75,0.85],
      ["chest pain at rest","coronary plaque instability",0.8,0.8],
      ["crescendo angina","coronary plaque instability",0.75,0.8],
      ["sharp chest pain","pericardial inflammation",0.7,0.7],
      ["chest pain relieved by leaning forward","pericardial inflammation",0.7,0.85],
      ["pericardial friction rub","pericardial inflammation",0.6,0.9],
      ["Janeway lesions","valvular vegetation formation",0.4,0.9],
      ["Osler nodes","valvular vegetation formation",0.4,0.9],
      ["sudden onset palpitations","atrioventricular nodal reentry",0.8,0.8],
      ["intermittent claudication","peripheral atherosclerosis",0.8,0.85],
      ["diminished peripheral pulses","peripheral atherosclerosis",0.7,0.8],
      ["unilateral leg swelling","venous thrombosis formation",0.8,0.8],
      ["calf pain","venous thrombosis formation",0.65,0.65],
      ["wheezing","bronchial hyperresponsiveness",0.75,0.75],
      ["dyspnea episodic","bronchial hyperresponsiveness",0.7,0.7],
      ["chest tightness","bronchial hyperresponsiveness",0.6,0.6],
      ["chronic productive cough","airway chronic inflammation",0.7,0.7],
      ["dyspnea progressive","airway chronic inflammation",0.65,0.65],
      ["barrel chest","airway chronic inflammation",0.5,0.7],
      ["dullness to percussion","pleural fluid accumulation",0.8,0.8],
      ["decreased breath sounds","pleural fluid accumulation",0.7,0.7],
      ["sudden pleuritic chest pain","alveolar rupture",0.8,0.8],
      ["hyperresonance to percussion","alveolar rupture",0.7,0.8],
      ["bibasilar crackles velcro-like","pulmonary fibrotic remodeling",0.8,0.9],
      ["clubbing","pulmonary fibrotic remodeling",0.5,0.75],
      ["loud snoring","upper airway collapse",0.8,0.7],
      ["witnessed apneic episodes","upper airway collapse",0.85,0.85],
      ["gasping or choking during sleep","upper airway collapse",0.75,0.8],
      ["copious purulent sputum","bronchial wall destruction",0.75,0.8],
      ["recurrent respiratory infections","bronchial wall destruction",0.65,0.7],
      ["bilateral hilar lymphadenopathy","non-caseating granuloma formation",0.75,0.85],
      ["erythema nodosum","non-caseating granuloma formation",0.5,0.7],
      ["severe dyspnea acute onset","diffuse alveolar damage",0.8,0.8],
      ["hypoxia refractory","diffuse alveolar damage",0.85,0.85],
      ["persistent cough","pulmonary neoplastic proliferation",0.5,0.45],
      ["hemoptysis","pulmonary neoplastic proliferation",0.5,0.7],
      ["papilledema","CSF pressure elevation non-tumoral",0.8,0.9],
      ["pulsatile tinnitus","CSF pressure elevation non-tumoral",0.6,0.8],
      ["sciatica","spinal nerve root compression",0.8,0.8],
      ["neck pain radiating to arm","spinal nerve root compression",0.75,0.75],
      ["Spurling test positive","spinal nerve root compression",0.6,0.8],
      ["holosystolic murmur at apex","mitral valve incompetence",0.8,0.85],
      ["systolic murmur increasing with Valsalva","septal hypertrophy obstruction",0.7,0.9],
    ];

    const symPhysRows: any[] = [];
    for (const [sym, phys, conf, rel] of symPhysMaps) {
      const sId = allSymIds[sym]; const pId = allPhysIds[phys];
      if (sId && pId) symPhysRows.push({ symptom_id: sId, physiological_state_id: pId, confidence_score: conf });
    }
    for (let i = 0; i < symPhysRows.length; i += 100) {
      const { error } = await supabase.from("symptom_physiology_map").upsert(symPhysRows.slice(i, i + 100), { onConflict: "symptom_id,physiological_state_id", ignoreDuplicates: true });
      if (error) addLog(`SP error: ${error.message}`);
    }
    addLog(`Sym-phys: ${symPhysRows.length}`);

    // Step 9: Physiology-diagnosis
    const physDiagMaps: [string, string, number, number][] = [
      ["neuronal hyperexcitability","epilepsy",0.9,0.9],
      ["dopaminergic neurodegeneration","Parkinson disease",0.95,0.95],
      ["CNS demyelination","multiple sclerosis",0.9,0.9],
      ["trigeminal nerve compression","trigeminal neuralgia",0.9,0.9],
      ["facial nerve inflammation","Bell palsy",0.9,0.9],
      ["neuromuscular junction dysfunction","myasthenia gravis",0.95,0.95],
      ["peripheral nerve demyelination","Guillain-Barre syndrome",0.9,0.9],
      ["trigeminal autonomic activation","cluster headache",0.9,0.9],
      ["cortical amyloid deposition","Alzheimer disease",0.9,0.9],
      ["peripheral nerve axonal injury","peripheral neuropathy diabetic",0.85,0.85],
      ["cardiac atrial reentry","atrial fibrillation",0.9,0.9],
      ["ventricular systolic dysfunction","congestive heart failure",0.9,0.9],
      ["aortic valve calcification","aortic stenosis",0.9,0.9],
      ["coronary plaque instability","unstable angina",0.9,0.9],
      ["pericardial inflammation","pericarditis acute",0.9,0.9],
      ["valvular vegetation formation","infective endocarditis",0.9,0.9],
      ["atrioventricular nodal reentry","supraventricular tachycardia",0.85,0.85],
      ["ventricular reentry circuit","ventricular tachycardia",0.9,0.9],
      ["peripheral atherosclerosis","peripheral artery disease",0.9,0.9],
      ["venous thrombosis formation","deep vein thrombosis",0.9,0.9],
      ["septal hypertrophy obstruction","hypertrophic cardiomyopathy",0.9,0.9],
      ["bronchial hyperresponsiveness","asthma",0.9,0.9],
      ["airway chronic inflammation","COPD",0.85,0.85],
      ["pleural fluid accumulation","pleural effusion",0.85,0.85],
      ["alveolar rupture","pneumothorax spontaneous",0.9,0.9],
      ["pulmonary fibrotic remodeling","pulmonary fibrosis idiopathic",0.9,0.9],
      ["upper airway collapse","obstructive sleep apnea",0.9,0.9],
      ["bronchial wall destruction","bronchiectasis",0.85,0.85],
      ["non-caseating granuloma formation","sarcoidosis",0.85,0.85],
      ["diffuse alveolar damage","acute respiratory distress syndrome",0.9,0.9],
      ["pulmonary neoplastic proliferation","lung cancer",0.9,0.9],
      ["mitral valve incompetence","mitral regurgitation",0.9,0.9],
      ["CSF pressure elevation non-tumoral","idiopathic intracranial hypertension",0.9,0.9],
      ["spinal nerve root compression","cervical radiculopathy",0.85,0.85],
      ["spinal nerve root compression","lumbar disc herniation",0.85,0.85],
    ];

    const physDiagRows: any[] = [];
    for (const [phys, diag, conf, rel] of physDiagMaps) {
      const pId = allPhysIds[phys]; const dId = allDiagIds[diag];
      if (pId && dId) physDiagRows.push({ physiological_state_id: pId, diagnosis_id: dId, relevance_score: rel });
    }
    for (let i = 0; i < physDiagRows.length; i += 100) {
      const { error } = await supabase.from("physiology_diagnosis_map").upsert(physDiagRows.slice(i, i + 100), { onConflict: "physiological_state_id,diagnosis_id", ignoreDuplicates: true });
      if (error) addLog(`PD error: ${error.message}`);
    }
    addLog(`Phys-diag: ${physDiagRows.length}`);

    // Step 10: Dangerous diagnoses
    const dangerData = getDangerTriggers();
    let dangerCount = 0;
    for (const dd of dangerData) {
      const diagId = allDiagIds[dd.disease];
      if (!diagId) continue;
      const { error } = await supabase.from("dangerous_diagnoses").upsert({
        trigger_symptom: dd.trigger, diagnosis_id: diagId, diagnosis_name: dd.disease,
        severity_level: dd.severity, must_not_miss: true, priority: dd.priority,
        emergency_protocol: dd.protocol, guideline_source: dd.source,
      }, { onConflict: "trigger_symptom,diagnosis_id", ignoreDuplicates: true });
      if (!error) dangerCount++;
      else addLog(`Danger error: ${error.message}`);
    }
    addLog(`Dangerous: ${dangerCount}`);

    // Step 11: Guidelines
    const guidelines = getGuidelinesData();
    for (let i = 0; i < guidelines.length; i += 50) {
      const { error } = await supabase.from("clinical_guidelines").upsert(guidelines.slice(i, i + 50), { onConflict: "title", ignoreDuplicates: true });
      if (error) addLog(`Guide error: ${error.message}`);
    }
    addLog(`Guidelines: ${guidelines.length}`);

    // Validation
    addLog("=== VALIDATION ===");
    const counts: Record<string, number> = {};
    for (const t of ["diagnoses","symptoms","symptom_likelihoods","physiological_states","symptom_physiology_map","physiology_diagnosis_map","dangerous_diagnoses","clinical_guidelines","disease_tests","disease_treatments"]) {
      const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
      counts[t] = count || 0;
      addLog(`  ${t}: ${count}`);
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
