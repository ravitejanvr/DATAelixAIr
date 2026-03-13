import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // In-memory caches for FK resolution
  const symptomCache: Record<string, string> = {};
  const diagnosisCache: Record<string, string> = {};

  // Preload all symptoms and diagnoses into memory
  const { data: allSymptoms } = await supabase.from("symptoms").select("id, symptom_name");
  const { data: allDiagnoses } = await supabase.from("diagnoses").select("id, diagnosis_name");
  for (const s of allSymptoms || []) symptomCache[s.symptom_name.toLowerCase()] = s.id;
  for (const d of allDiagnoses || []) diagnosisCache[d.diagnosis_name.toLowerCase()] = d.id;

  async function ensureSymptom(name: string): Promise<string> {
    const key = name.toLowerCase();
    if (symptomCache[key]) return symptomCache[key];
    const { data } = await supabase.from("symptoms").upsert({ symptom_name: name }, { onConflict: "symptom_name" }).select("id").single();
    if (data) { symptomCache[key] = data.id; return data.id; }
    const { data: ex } = await supabase.from("symptoms").select("id").eq("symptom_name", name).single();
    if (ex) { symptomCache[key] = ex.id; return ex.id; }
    throw new Error(`Failed to resolve symptom: ${name}`);
  }

  async function ensureDiagnosis(name: string, category: string): Promise<string> {
    const key = name.toLowerCase();
    if (diagnosisCache[key]) return diagnosisCache[key];
    const { data } = await supabase.from("diagnoses").upsert({ diagnosis_name: name, category }, { onConflict: "diagnosis_name" }).select("id").single();
    if (data) { diagnosisCache[key] = data.id; return data.id; }
    const { data: ex } = await supabase.from("diagnoses").select("id").eq("diagnosis_name", name).single();
    if (ex) { diagnosisCache[key] = ex.id; return ex.id; }
    throw new Error(`Failed to resolve diagnosis: ${name}`);
  }

  // Disease-symptom mappings: [disease, category, [[symptom, likelihood], ...]]
  type DiseaseMap = [string, string, [string, number][]];

  const diseases: DiseaseMap[] = [
    // ===== CARDIOLOGY =====
    ["myocardial infarction", "cardiovascular", [
      ["chest pain", 0.9], ["radiating arm pain", 0.7], ["diaphoresis", 0.7], ["shortness of breath", 0.6],
      ["nausea", 0.5], ["jaw pain", 0.4], ["fatigue", 0.5], ["anxiety", 0.5], ["palpitations", 0.3],
      ["dizziness", 0.4], ["epigastric pain", 0.3], ["syncope", 0.3], ["cold sweats", 0.6]
    ]],
    ["unstable angina", "cardiovascular", [
      ["chest pain", 0.9], ["exertional chest pain", 0.8], ["radiating arm pain", 0.6], ["shortness of breath", 0.5],
      ["diaphoresis", 0.5], ["nausea", 0.4], ["fatigue", 0.5], ["anxiety", 0.4], ["jaw pain", 0.3],
      ["palpitations", 0.3], ["dizziness", 0.3], ["chest tightness", 0.7]
    ]],
    ["pericarditis", "cardiovascular", [
      ["chest pain", 0.9], ["pleuritic chest pain", 0.8], ["pain relieved by leaning forward", 0.7],
      ["fever", 0.5], ["malaise", 0.4], ["pericardial friction rub", 0.7], ["dyspnea", 0.4],
      ["cough", 0.3], ["fatigue", 0.4], ["tachycardia", 0.4], ["chest tightness", 0.5]
    ]],
    ["heart failure", "cardiovascular", [
      ["shortness of breath", 0.9], ["orthopnea", 0.8], ["paroxysmal nocturnal dyspnea", 0.7],
      ["peripheral edema", 0.8], ["fatigue", 0.7], ["weight gain", 0.5], ["jugular venous distension", 0.6],
      ["cough", 0.4], ["nocturia", 0.4], ["exercise intolerance", 0.7], ["hepatomegaly", 0.4],
      ["ascites", 0.3], ["wheezing", 0.3], ["tachycardia", 0.5]
    ]],
    ["atrial fibrillation", "cardiovascular", [
      ["palpitations", 0.8], ["irregular heartbeat", 0.9], ["fatigue", 0.6], ["shortness of breath", 0.5],
      ["dizziness", 0.5], ["chest discomfort", 0.4], ["exercise intolerance", 0.5], ["syncope", 0.3],
      ["anxiety", 0.3], ["weakness", 0.4], ["lightheadedness", 0.5], ["polyuria", 0.3]
    ]],
    ["pulmonary embolism", "cardiovascular", [
      ["sudden shortness of breath", 0.8], ["pleuritic chest pain", 0.7], ["tachycardia", 0.7],
      ["hemoptysis", 0.3], ["calf pain", 0.5], ["leg swelling", 0.5], ["syncope", 0.3],
      ["anxiety", 0.4], ["cough", 0.4], ["diaphoresis", 0.4], ["fever", 0.3], ["hypotension", 0.3],
      ["tachypnea", 0.7]
    ]],
    ["aortic dissection", "cardiovascular", [
      ["tearing chest pain", 0.9], ["sudden severe chest pain", 0.8], ["back pain", 0.7],
      ["hypertension", 0.5], ["hypotension", 0.4], ["pulse deficit", 0.5], ["diaphoresis", 0.6],
      ["syncope", 0.3], ["aortic regurgitation murmur", 0.4], ["neurological deficit", 0.3],
      ["abdominal pain", 0.3], ["dyspnea", 0.4], ["anxiety", 0.5]
    ]],
    ["hypertensive crisis", "cardiovascular", [
      ["severe headache", 0.7], ["hypertension", 0.9], ["blurred vision", 0.5], ["chest pain", 0.4],
      ["shortness of breath", 0.4], ["nausea", 0.4], ["epistaxis", 0.3], ["anxiety", 0.4],
      ["confusion", 0.3], ["dizziness", 0.5], ["palpitations", 0.3], ["vomiting", 0.3]
    ]],
    ["infective endocarditis", "cardiovascular", [
      ["fever", 0.9], ["new heart murmur", 0.7], ["fatigue", 0.6], ["night sweats", 0.5],
      ["weight loss", 0.4], ["petechiae", 0.4], ["splinter hemorrhages", 0.4], ["splenomegaly", 0.3],
      ["janeway lesions", 0.3], ["osler nodes", 0.3], ["myalgia", 0.4], ["anorexia", 0.4], ["chills", 0.5]
    ]],
    ["cardiac tamponade", "cardiovascular", [
      ["hypotension", 0.8], ["jugular venous distension", 0.8], ["muffled heart sounds", 0.7],
      ["tachycardia", 0.7], ["dyspnea", 0.6], ["chest pain", 0.5], ["pulsus paradoxus", 0.6],
      ["anxiety", 0.4], ["diaphoresis", 0.4], ["syncope", 0.3], ["fatigue", 0.3]
    ]],
    ["deep vein thrombosis", "cardiovascular", [
      ["leg swelling", 0.8], ["calf pain", 0.7], ["warmth in affected leg", 0.6],
      ["redness of leg", 0.5], ["tenderness", 0.6], ["leg heaviness", 0.4], ["dilated superficial veins", 0.3],
      ["low grade fever", 0.3], ["edema", 0.7], ["pain on dorsiflexion", 0.5]
    ]],
    ["mitral valve prolapse", "cardiovascular", [
      ["palpitations", 0.6], ["chest pain", 0.5], ["fatigue", 0.4], ["dizziness", 0.4],
      ["dyspnea", 0.3], ["anxiety", 0.4], ["mid-systolic click", 0.7], ["syncope", 0.3],
      ["exercise intolerance", 0.3], ["atypical chest pain", 0.5]
    ]],
    ["aortic stenosis", "cardiovascular", [
      ["exertional dyspnea", 0.8], ["syncope", 0.6], ["angina", 0.6], ["fatigue", 0.5],
      ["dizziness", 0.4], ["heart failure symptoms", 0.4], ["systolic ejection murmur", 0.8],
      ["exercise intolerance", 0.6], ["palpitations", 0.3], ["dyspnea on exertion", 0.7]
    ]],
    ["hypertrophic cardiomyopathy", "cardiovascular", [
      ["exertional dyspnea", 0.7], ["chest pain", 0.6], ["syncope", 0.5], ["palpitations", 0.5],
      ["dizziness", 0.4], ["fatigue", 0.4], ["systolic murmur", 0.6], ["sudden cardiac death risk", 0.3],
      ["orthopnea", 0.3], ["presyncope", 0.5], ["exercise intolerance", 0.5]
    ]],
    ["peripheral artery disease", "cardiovascular", [
      ["intermittent claudication", 0.8], ["leg pain on walking", 0.8], ["rest pain", 0.5],
      ["cold extremities", 0.5], ["weak pulses", 0.6], ["hair loss on legs", 0.4],
      ["non-healing wounds", 0.4], ["pallor on elevation", 0.5], ["numbness in feet", 0.4],
      ["gangrene", 0.3], ["muscle atrophy", 0.3]
    ]],

    // ===== PULMONOLOGY =====
    ["community acquired pneumonia", "respiratory", [
      ["cough", 0.9], ["fever", 0.8], ["purulent sputum", 0.7], ["dyspnea", 0.6],
      ["pleuritic chest pain", 0.5], ["chills", 0.5], ["fatigue", 0.5], ["tachypnea", 0.5],
      ["crackles on auscultation", 0.7], ["night sweats", 0.3], ["headache", 0.3],
      ["myalgia", 0.3], ["confusion", 0.3]
    ]],
    ["asthma exacerbation", "respiratory", [
      ["wheezing", 0.9], ["shortness of breath", 0.8], ["cough", 0.7], ["chest tightness", 0.7],
      ["tachypnea", 0.5], ["use of accessory muscles", 0.5], ["nocturnal cough", 0.5],
      ["difficulty speaking in full sentences", 0.4], ["anxiety", 0.4], ["prolonged expiration", 0.6],
      ["tachycardia", 0.4], ["decreased air entry", 0.5]
    ]],
    ["chronic obstructive pulmonary disease", "respiratory", [
      ["chronic cough", 0.8], ["dyspnea on exertion", 0.9], ["sputum production", 0.7],
      ["wheezing", 0.6], ["barrel chest", 0.4], ["pursed lip breathing", 0.4],
      ["exercise intolerance", 0.7], ["fatigue", 0.5], ["weight loss", 0.3],
      ["use of accessory muscles", 0.4], ["cyanosis", 0.3], ["prolonged expiration", 0.5],
      ["tachypnea", 0.4]
    ]],
    ["pleural effusion", "respiratory", [
      ["dyspnea", 0.8], ["pleuritic chest pain", 0.6], ["decreased breath sounds", 0.7],
      ["cough", 0.5], ["dullness to percussion", 0.7], ["fever", 0.4], ["tachypnea", 0.4],
      ["orthopnea", 0.3], ["chest heaviness", 0.5], ["weight loss", 0.3], ["fatigue", 0.4]
    ]],
    ["pneumothorax", "respiratory", [
      ["sudden chest pain", 0.8], ["acute dyspnea", 0.8], ["decreased breath sounds", 0.7],
      ["tachycardia", 0.5], ["hyperresonance to percussion", 0.6], ["subcutaneous emphysema", 0.3],
      ["tachypnea", 0.5], ["anxiety", 0.4], ["cyanosis", 0.3], ["pleuritic chest pain", 0.6],
      ["hypotension", 0.3]
    ]],
    ["pulmonary fibrosis", "respiratory", [
      ["progressive dyspnea", 0.9], ["dry cough", 0.7], ["fatigue", 0.6],
      ["bibasilar crackles", 0.7], ["clubbing", 0.5], ["exercise intolerance", 0.7],
      ["weight loss", 0.3], ["cyanosis", 0.3], ["tachypnea", 0.4],
      ["chest tightness", 0.4], ["hypoxia", 0.5]
    ]],
    ["tuberculosis", "infectious", [
      ["chronic cough", 0.8], ["hemoptysis", 0.5], ["night sweats", 0.7], ["weight loss", 0.7],
      ["fever", 0.6], ["fatigue", 0.6], ["anorexia", 0.5], ["chest pain", 0.3],
      ["lymphadenopathy", 0.4], ["evening rise of temperature", 0.5], ["malaise", 0.5],
      ["chills", 0.3], ["dyspnea", 0.3]
    ]],
    ["bronchiectasis", "respiratory", [
      ["chronic productive cough", 0.9], ["copious sputum", 0.8], ["hemoptysis", 0.4],
      ["recurrent respiratory infections", 0.6], ["dyspnea", 0.5], ["wheezing", 0.3],
      ["clubbing", 0.3], ["fatigue", 0.4], ["chest pain", 0.3], ["crackles", 0.5],
      ["fever", 0.3], ["foul smelling sputum", 0.5]
    ]],
    ["acute respiratory distress syndrome", "respiratory", [
      ["severe dyspnea", 0.9], ["hypoxia", 0.9], ["tachypnea", 0.8], ["bilateral crackles", 0.7],
      ["cyanosis", 0.5], ["use of accessory muscles", 0.6], ["confusion", 0.4],
      ["anxiety", 0.4], ["tachycardia", 0.6], ["diaphoresis", 0.4], ["chest tightness", 0.4]
    ]],
    ["Legionella pneumonia", "respiratory", [
      ["high fever", 0.8], ["cough", 0.7], ["dyspnea", 0.6], ["diarrhea", 0.5],
      ["confusion", 0.4], ["headache", 0.5], ["myalgia", 0.5], ["hyponatremia", 0.4],
      ["relative bradycardia", 0.3], ["chest pain", 0.3], ["fatigue", 0.5], ["nausea", 0.3]
    ]],

    // ===== INFECTIOUS DISEASE =====
    ["dengue fever", "infectious", [
      ["high fever", 0.9], ["severe headache", 0.7], ["retro-orbital pain", 0.7],
      ["myalgia", 0.7], ["arthralgia", 0.6], ["rash", 0.5], ["nausea", 0.5],
      ["vomiting", 0.4], ["thrombocytopenia", 0.6], ["hemorrhagic manifestations", 0.3],
      ["fatigue", 0.5], ["abdominal pain", 0.4], ["leukopenia", 0.5]
    ]],
    ["malaria", "infectious", [
      ["cyclical fever", 0.8], ["chills", 0.8], ["sweating", 0.7], ["headache", 0.6],
      ["myalgia", 0.5], ["nausea", 0.4], ["vomiting", 0.4], ["splenomegaly", 0.5],
      ["anemia", 0.4], ["jaundice", 0.3], ["fatigue", 0.5], ["hepatomegaly", 0.3],
      ["abdominal pain", 0.3], ["diarrhea", 0.3]
    ]],
    ["typhoid fever", "infectious", [
      ["stepladder fever", 0.7], ["headache", 0.6], ["abdominal pain", 0.6],
      ["constipation", 0.5], ["diarrhea", 0.4], ["rose spots", 0.3], ["splenomegaly", 0.4],
      ["hepatomegaly", 0.3], ["relative bradycardia", 0.4], ["fatigue", 0.5],
      ["anorexia", 0.5], ["coated tongue", 0.4], ["malaise", 0.5]
    ]],
    ["sepsis", "infectious", [
      ["fever", 0.8], ["tachycardia", 0.8], ["tachypnea", 0.7], ["hypotension", 0.6],
      ["altered mental status", 0.5], ["chills", 0.5], ["warm flushed skin", 0.4],
      ["oliguria", 0.4], ["leukocytosis", 0.5], ["lactic acidosis", 0.4],
      ["fatigue", 0.4], ["weakness", 0.4], ["hypothermia", 0.3]
    ]],
    ["influenza", "infectious", [
      ["sudden onset fever", 0.8], ["myalgia", 0.7], ["headache", 0.6], ["dry cough", 0.7],
      ["sore throat", 0.5], ["fatigue", 0.7], ["chills", 0.6], ["rhinorrhea", 0.4],
      ["body aches", 0.7], ["malaise", 0.6], ["anorexia", 0.4], ["sneezing", 0.3]
    ]],
    ["COVID-19", "infectious", [
      ["fever", 0.7], ["dry cough", 0.7], ["fatigue", 0.7], ["anosmia", 0.6],
      ["ageusia", 0.5], ["dyspnea", 0.5], ["myalgia", 0.5], ["sore throat", 0.4],
      ["headache", 0.5], ["diarrhea", 0.3], ["nasal congestion", 0.4], ["chills", 0.4],
      ["nausea", 0.3]
    ]],
    ["leptospirosis", "infectious", [
      ["fever", 0.8], ["myalgia", 0.7], ["headache", 0.6], ["conjunctival suffusion", 0.6],
      ["jaundice", 0.4], ["oliguria", 0.3], ["abdominal pain", 0.3], ["nausea", 0.4],
      ["vomiting", 0.4], ["calf tenderness", 0.5], ["rash", 0.3], ["photophobia", 0.3],
      ["hepatomegaly", 0.3]
    ]],
    ["meningitis bacterial", "infectious", [
      ["severe headache", 0.8], ["fever", 0.9], ["neck stiffness", 0.8], ["photophobia", 0.6],
      ["altered mental status", 0.5], ["nausea", 0.5], ["vomiting", 0.5], ["petechial rash", 0.4],
      ["kernig sign", 0.4], ["brudzinski sign", 0.4], ["seizures", 0.3], ["irritability", 0.3]
    ]],
    ["cellulitis", "infectious", [
      ["skin redness", 0.9], ["warmth", 0.8], ["swelling", 0.8], ["pain at site", 0.7],
      ["fever", 0.5], ["lymphangitis", 0.3], ["lymphadenopathy", 0.3], ["malaise", 0.3],
      ["skin tenderness", 0.7], ["chills", 0.3], ["advancing border", 0.5]
    ]],
    ["urinary tract infection", "infectious", [
      ["dysuria", 0.8], ["urinary frequency", 0.8], ["urgency", 0.7], ["suprapubic pain", 0.5],
      ["hematuria", 0.4], ["cloudy urine", 0.4], ["foul smelling urine", 0.3], ["fever", 0.3],
      ["flank pain", 0.3], ["nausea", 0.3], ["malaise", 0.3], ["lower abdominal pain", 0.5]
    ]],
    ["pyelonephritis", "infectious", [
      ["fever", 0.8], ["flank pain", 0.8], ["costovertebral angle tenderness", 0.7],
      ["nausea", 0.6], ["vomiting", 0.5], ["dysuria", 0.5], ["chills", 0.5],
      ["urinary frequency", 0.4], ["malaise", 0.4], ["tachycardia", 0.3],
      ["abdominal pain", 0.3], ["hematuria", 0.3]
    ]],
    ["herpes zoster", "infectious", [
      ["vesicular rash in dermatomal distribution", 0.9], ["pain along dermatome", 0.8],
      ["burning sensation", 0.7], ["tingling", 0.6], ["fever", 0.3], ["malaise", 0.3],
      ["headache", 0.3], ["pruritus", 0.4], ["allodynia", 0.4], ["lymphadenopathy", 0.3]
    ]],
    ["infectious mononucleosis", "infectious", [
      ["sore throat", 0.8], ["fatigue", 0.8], ["fever", 0.7], ["lymphadenopathy", 0.8],
      ["splenomegaly", 0.5], ["hepatomegaly", 0.3], ["rash", 0.3], ["palatal petechiae", 0.3],
      ["malaise", 0.6], ["headache", 0.4], ["myalgia", 0.3], ["tonsillar exudate", 0.5]
    ]],
    ["chickenpox", "infectious", [
      ["vesicular rash", 0.9], ["fever", 0.7], ["pruritus", 0.8], ["malaise", 0.5],
      ["headache", 0.4], ["rash in different stages", 0.7], ["anorexia", 0.3],
      ["fatigue", 0.4], ["sore throat", 0.3], ["myalgia", 0.3], ["lymphadenopathy", 0.3]
    ]],
    ["hepatitis A", "infectious", [
      ["jaundice", 0.7], ["fatigue", 0.7], ["nausea", 0.6], ["abdominal pain", 0.5],
      ["anorexia", 0.6], ["fever", 0.5], ["dark urine", 0.5], ["clay colored stools", 0.4],
      ["hepatomegaly", 0.4], ["vomiting", 0.4], ["pruritus", 0.3], ["malaise", 0.5]
    ]],
    ["hepatitis B", "infectious", [
      ["jaundice", 0.6], ["fatigue", 0.7], ["abdominal pain", 0.5], ["nausea", 0.5],
      ["anorexia", 0.5], ["dark urine", 0.5], ["arthralgia", 0.3], ["fever", 0.4],
      ["hepatomegaly", 0.4], ["vomiting", 0.3], ["malaise", 0.5], ["rash", 0.3]
    ]],

    // ===== GASTROENTEROLOGY =====
    ["acute appendicitis", "gastrointestinal", [
      ["right lower quadrant pain", 0.9], ["periumbilical pain migrating to RLQ", 0.7],
      ["nausea", 0.7], ["vomiting", 0.5], ["anorexia", 0.7], ["fever", 0.5],
      ["rebound tenderness", 0.6], ["guarding", 0.5], ["McBurney point tenderness", 0.7],
      ["leukocytosis", 0.5], ["constipation", 0.3], ["diarrhea", 0.3]
    ]],
    ["acute pancreatitis", "gastrointestinal", [
      ["severe epigastric pain", 0.9], ["pain radiating to back", 0.7], ["nausea", 0.8],
      ["vomiting", 0.7], ["abdominal tenderness", 0.6], ["fever", 0.4], ["tachycardia", 0.4],
      ["abdominal distension", 0.4], ["jaundice", 0.3], ["hypotension", 0.3],
      ["elevated lipase", 0.8], ["anorexia", 0.5]
    ]],
    ["peptic ulcer disease", "gastrointestinal", [
      ["epigastric pain", 0.8], ["burning abdominal pain", 0.7], ["pain related to meals", 0.6],
      ["nausea", 0.5], ["bloating", 0.4], ["heartburn", 0.4], ["anorexia", 0.3],
      ["weight loss", 0.3], ["hematemesis", 0.3], ["melena", 0.3], ["early satiety", 0.4],
      ["abdominal tenderness", 0.5]
    ]],
    ["gastroesophageal reflux disease", "gastrointestinal", [
      ["heartburn", 0.9], ["acid regurgitation", 0.8], ["dysphagia", 0.4],
      ["chest pain", 0.4], ["chronic cough", 0.3], ["hoarseness", 0.3], ["nausea", 0.3],
      ["bloating", 0.3], ["epigastric pain", 0.5], ["water brash", 0.4],
      ["globus sensation", 0.3], ["belching", 0.4]
    ]],
    ["inflammatory bowel disease", "gastrointestinal", [
      ["chronic diarrhea", 0.8], ["abdominal pain", 0.7], ["bloody stools", 0.6],
      ["weight loss", 0.5], ["fatigue", 0.5], ["fever", 0.4], ["anemia", 0.4],
      ["tenesmus", 0.4], ["urgency", 0.4], ["anorexia", 0.4], ["arthralgia", 0.3],
      ["perianal disease", 0.3]
    ]],
    ["cholecystitis", "gastrointestinal", [
      ["right upper quadrant pain", 0.9], ["murphy sign", 0.7], ["nausea", 0.7],
      ["vomiting", 0.5], ["fever", 0.5], ["pain after fatty meals", 0.6],
      ["referred right shoulder pain", 0.4], ["abdominal guarding", 0.4],
      ["jaundice", 0.3], ["tachycardia", 0.3], ["anorexia", 0.4], ["bloating", 0.3]
    ]],
    ["irritable bowel syndrome", "gastrointestinal", [
      ["abdominal pain related to defecation", 0.8], ["altered bowel habits", 0.8],
      ["bloating", 0.7], ["abdominal cramping", 0.7], ["mucus in stool", 0.4],
      ["flatulence", 0.5], ["urgency", 0.4], ["incomplete evacuation", 0.4],
      ["nausea", 0.3], ["fatigue", 0.3], ["anxiety", 0.3], ["abdominal distension", 0.5]
    ]],
    ["liver cirrhosis", "gastrointestinal", [
      ["jaundice", 0.7], ["ascites", 0.7], ["spider angiomata", 0.5], ["palmar erythema", 0.4],
      ["hepatomegaly", 0.5], ["splenomegaly", 0.4], ["fatigue", 0.6], ["weight loss", 0.4],
      ["peripheral edema", 0.5], ["gynecomastia", 0.3], ["easy bruising", 0.4],
      ["abdominal distension", 0.6], ["pruritus", 0.3], ["anorexia", 0.4]
    ]],
    ["acute gastroenteritis", "gastrointestinal", [
      ["diarrhea", 0.9], ["nausea", 0.8], ["vomiting", 0.7], ["abdominal cramps", 0.7],
      ["fever", 0.5], ["dehydration", 0.5], ["malaise", 0.4], ["anorexia", 0.4],
      ["headache", 0.3], ["myalgia", 0.3], ["fatigue", 0.4], ["abdominal pain", 0.6]
    ]],
    ["diverticulitis", "gastrointestinal", [
      ["left lower quadrant pain", 0.8], ["fever", 0.5], ["nausea", 0.4],
      ["change in bowel habits", 0.4], ["abdominal tenderness", 0.6], ["bloating", 0.3],
      ["constipation", 0.4], ["vomiting", 0.3], ["leukocytosis", 0.4],
      ["anorexia", 0.3], ["guarding", 0.3], ["diarrhea", 0.3]
    ]],
    ["gastrointestinal bleeding upper", "gastrointestinal", [
      ["hematemesis", 0.8], ["melena", 0.7], ["epigastric pain", 0.5], ["dizziness", 0.5],
      ["syncope", 0.3], ["tachycardia", 0.5], ["hypotension", 0.4], ["pallor", 0.5],
      ["fatigue", 0.4], ["weakness", 0.5], ["coffee ground emesis", 0.6], ["nausea", 0.4]
    ]],
    ["celiac disease", "gastrointestinal", [
      ["chronic diarrhea", 0.7], ["bloating", 0.6], ["abdominal pain", 0.5],
      ["weight loss", 0.5], ["fatigue", 0.6], ["iron deficiency anemia", 0.5],
      ["steatorrhea", 0.4], ["flatulence", 0.4], ["dermatitis herpetiformis", 0.3],
      ["failure to thrive", 0.3], ["osteoporosis", 0.3], ["anorexia", 0.3]
    ]],
  ];

  const results: string[] = [];
  const allRows: { symptom_id: string; diagnosis_id: string; likelihood: number }[] = [];

  // Resolve all FKs in memory first
  for (const [disease, category, symptoms] of diseases) {
    try {
      const dId = await ensureDiagnosis(disease, category);
      for (const [symptom, likelihood] of symptoms) {
        if (likelihood < 0.3) continue;
        try {
          const sId = await ensureSymptom(symptom);
          allRows.push({ symptom_id: sId, diagnosis_id: dId, likelihood });
        } catch (e) {
          results.push(`⚠️ Symptom error: ${symptom} - ${e.message}`);
        }
      }
    } catch (e) {
      results.push(`⚠️ Diagnosis error: ${disease} - ${e.message}`);
    }
  }

  // Batch upsert in chunks of 400
  const BATCH_SIZE = 400;
  let upserted = 0;
  for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
    const batch = allRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("symptom_likelihoods")
      .upsert(batch, { onConflict: "symptom_id,diagnosis_id", ignoreDuplicates: false });
    if (error) {
      results.push(`❌ Batch ${Math.floor(i/BATCH_SIZE)+1} error: ${error.message}`);
    } else {
      upserted += batch.length;
    }
  }

  results.push(`✅ Batch 1 complete: ${upserted} rows upserted across ${diseases.length} diseases`);

  return new Response(JSON.stringify({ 
    diseases_processed: diseases.length,
    rows_upserted: upserted,
    errors: results.filter(r => r.startsWith("⚠️") || r.startsWith("❌")),
    summary: results
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
