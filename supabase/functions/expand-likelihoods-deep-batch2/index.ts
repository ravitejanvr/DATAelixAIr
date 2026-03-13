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

  const symptomCache: Record<string, string> = {};
  const diagnosisCache: Record<string, string> = {};

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
    throw new Error(`Failed: ${name}`);
  }

  async function ensureDiagnosis(name: string, category: string): Promise<string> {
    const key = name.toLowerCase();
    if (diagnosisCache[key]) return diagnosisCache[key];
    const { data } = await supabase.from("diagnoses").upsert({ diagnosis_name: name, category }, { onConflict: "diagnosis_name" }).select("id").single();
    if (data) { diagnosisCache[key] = data.id; return data.id; }
    const { data: ex } = await supabase.from("diagnoses").select("id").eq("diagnosis_name", name).single();
    if (ex) { diagnosisCache[key] = ex.id; return ex.id; }
    throw new Error(`Failed: ${name}`);
  }

  type DiseaseMap = [string, string, [string, number][]];

  const diseases: DiseaseMap[] = [
    // ===== ENDOCRINOLOGY =====
    ["diabetes mellitus type 2", "endocrine", [
      ["polyuria", 0.8], ["polydipsia", 0.8], ["polyphagia", 0.6], ["weight loss", 0.5],
      ["fatigue", 0.6], ["blurred vision", 0.4], ["recurrent infections", 0.4],
      ["acanthosis nigricans", 0.3], ["numbness in feet", 0.4], ["slow wound healing", 0.5],
      ["nocturia", 0.5], ["pruritus", 0.3]
    ]],
    ["diabetes mellitus type 1", "endocrine", [
      ["polyuria", 0.9], ["polydipsia", 0.9], ["weight loss", 0.7], ["polyphagia", 0.6],
      ["fatigue", 0.6], ["nausea", 0.4], ["vomiting", 0.3], ["blurred vision", 0.4],
      ["abdominal pain", 0.3], ["fruity breath odor", 0.3], ["weakness", 0.4], ["dehydration", 0.4]
    ]],
    ["diabetic ketoacidosis", "endocrine", [
      ["nausea", 0.7], ["vomiting", 0.7], ["abdominal pain", 0.6], ["polyuria", 0.6],
      ["polydipsia", 0.6], ["kussmaul breathing", 0.6], ["fruity breath odor", 0.5],
      ["dehydration", 0.7], ["altered mental status", 0.4], ["tachycardia", 0.5],
      ["fatigue", 0.5], ["weakness", 0.5], ["weight loss", 0.3]
    ]],
    ["hyperthyroidism", "endocrine", [
      ["weight loss", 0.8], ["tachycardia", 0.7], ["heat intolerance", 0.7], ["tremor", 0.7],
      ["anxiety", 0.5], ["sweating", 0.6], ["palpitations", 0.6], ["diarrhea", 0.4],
      ["insomnia", 0.4], ["goiter", 0.5], ["exophthalmos", 0.4], ["fatigue", 0.4],
      ["menstrual irregularity", 0.3], ["muscle weakness", 0.4]
    ]],
    ["hypothyroidism", "endocrine", [
      ["fatigue", 0.8], ["weight gain", 0.7], ["cold intolerance", 0.7], ["constipation", 0.6],
      ["dry skin", 0.6], ["hair loss", 0.5], ["bradycardia", 0.4], ["depression", 0.4],
      ["hoarseness", 0.3], ["menorrhagia", 0.3], ["periorbital edema", 0.4],
      ["myalgia", 0.3], ["delayed reflexes", 0.3], ["cognitive slowing", 0.4]
    ]],
    ["Hashimoto thyroiditis", "endocrine", [
      ["fatigue", 0.7], ["weight gain", 0.6], ["cold intolerance", 0.6], ["constipation", 0.5],
      ["dry skin", 0.5], ["goiter", 0.5], ["hair loss", 0.4], ["depression", 0.3],
      ["myalgia", 0.3], ["periorbital edema", 0.3], ["hoarseness", 0.3], ["bradycardia", 0.3]
    ]],
    ["Cushing syndrome", "endocrine", [
      ["weight gain", 0.8], ["moon face", 0.7], ["central obesity", 0.7], ["striae", 0.5],
      ["hypertension", 0.6], ["hirsutism", 0.4], ["acne", 0.3], ["muscle weakness", 0.5],
      ["easy bruising", 0.4], ["glucose intolerance", 0.4], ["depression", 0.3],
      ["osteoporosis", 0.3], ["buffalo hump", 0.5]
    ]],
    ["Addison disease", "endocrine", [
      ["fatigue", 0.8], ["hyperpigmentation", 0.7], ["weight loss", 0.6], ["hypotension", 0.6],
      ["nausea", 0.5], ["anorexia", 0.5], ["salt craving", 0.4], ["dizziness", 0.4],
      ["abdominal pain", 0.3], ["myalgia", 0.3], ["weakness", 0.5], ["hypoglycemia", 0.3]
    ]],
    ["pheochromocytoma", "endocrine", [
      ["episodic hypertension", 0.8], ["headache", 0.7], ["diaphoresis", 0.7],
      ["palpitations", 0.7], ["anxiety", 0.5], ["tremor", 0.4], ["pallor", 0.3],
      ["nausea", 0.3], ["chest pain", 0.3], ["weight loss", 0.3], ["tachycardia", 0.6]
    ]],
    ["hyperaldosteronism", "endocrine", [
      ["hypertension", 0.8], ["hypokalemia", 0.7], ["muscle weakness", 0.5],
      ["polyuria", 0.4], ["polydipsia", 0.3], ["headache", 0.3], ["fatigue", 0.4],
      ["muscle cramps", 0.4], ["nocturia", 0.3], ["metabolic alkalosis", 0.5],
      ["numbness", 0.3]
    ]],
    ["hypoglycemia", "endocrine", [
      ["tremor", 0.7], ["sweating", 0.7], ["palpitations", 0.6], ["hunger", 0.6],
      ["anxiety", 0.5], ["confusion", 0.5], ["dizziness", 0.5], ["blurred vision", 0.4],
      ["weakness", 0.5], ["seizures", 0.3], ["irritability", 0.4], ["pallor", 0.4]
    ]],
    ["acromegaly", "endocrine", [
      ["enlarged hands and feet", 0.8], ["coarsened facial features", 0.7], ["headache", 0.5],
      ["visual field defects", 0.4], ["excessive sweating", 0.5], ["joint pain", 0.5],
      ["fatigue", 0.4], ["sleep apnea", 0.3], ["carpal tunnel syndrome", 0.3],
      ["hypertension", 0.3], ["glucose intolerance", 0.3]
    ]],

    // ===== NEUROLOGY =====
    ["migraine", "neurological", [
      ["unilateral headache", 0.8], ["throbbing headache", 0.7], ["photophobia", 0.7],
      ["phonophobia", 0.6], ["nausea", 0.6], ["vomiting", 0.4], ["aura", 0.3],
      ["visual disturbance", 0.3], ["fatigue", 0.4], ["neck stiffness", 0.3],
      ["dizziness", 0.3], ["scalp tenderness", 0.3]
    ]],
    ["tension headache", "neurological", [
      ["bilateral headache", 0.8], ["band-like pressure headache", 0.8],
      ["mild to moderate pain", 0.7], ["scalp tenderness", 0.4], ["neck tension", 0.5],
      ["fatigue", 0.3], ["difficulty concentrating", 0.3], ["no nausea", 0.5],
      ["sensitivity to light", 0.3], ["jaw clenching", 0.3]
    ]],
    ["subarachnoid hemorrhage", "neurological", [
      ["thunderclap headache", 0.9], ["worst headache of life", 0.8], ["neck stiffness", 0.7],
      ["vomiting", 0.5], ["photophobia", 0.5], ["loss of consciousness", 0.4],
      ["seizures", 0.3], ["focal neurological deficit", 0.3], ["altered mental status", 0.4],
      ["nausea", 0.5], ["confusion", 0.3], ["diplopia", 0.3]
    ]],
    ["ischemic stroke", "neurological", [
      ["sudden weakness", 0.8], ["facial droop", 0.7], ["speech difficulty", 0.7],
      ["arm weakness", 0.7], ["leg weakness", 0.5], ["visual disturbance", 0.4],
      ["sudden confusion", 0.5], ["headache", 0.3], ["dizziness", 0.4],
      ["difficulty walking", 0.4], ["numbness", 0.5], ["dysarthria", 0.6]
    ]],
    ["hemorrhagic stroke", "neurological", [
      ["sudden severe headache", 0.8], ["vomiting", 0.6], ["altered consciousness", 0.7],
      ["focal weakness", 0.6], ["seizures", 0.4], ["neck stiffness", 0.4],
      ["hypertension", 0.5], ["speech difficulty", 0.5], ["visual disturbance", 0.3],
      ["nausea", 0.5], ["confusion", 0.5]
    ]],
    ["epilepsy", "neurological", [
      ["seizures", 0.9], ["loss of consciousness", 0.6], ["tonic-clonic movements", 0.5],
      ["aura", 0.4], ["confusion", 0.5], ["tongue biting", 0.4], ["urinary incontinence", 0.3],
      ["post-ictal drowsiness", 0.6], ["automatisms", 0.3], ["staring spells", 0.4],
      ["deja vu", 0.3], ["muscle jerking", 0.4]
    ]],
    ["Parkinson disease", "neurological", [
      ["resting tremor", 0.8], ["bradykinesia", 0.8], ["rigidity", 0.7],
      ["postural instability", 0.6], ["shuffling gait", 0.5], ["masked facies", 0.5],
      ["micrographia", 0.4], ["difficulty initiating movement", 0.5], ["depression", 0.3],
      ["sleep disturbance", 0.3], ["constipation", 0.3], ["anosmia", 0.3]
    ]],
    ["Guillain-Barre syndrome", "neurological", [
      ["ascending weakness", 0.8], ["areflexia", 0.7], ["paresthesias", 0.6],
      ["bilateral leg weakness", 0.7], ["difficulty walking", 0.6], ["facial weakness", 0.4],
      ["dysphagia", 0.3], ["respiratory difficulty", 0.3], ["back pain", 0.4],
      ["autonomic dysfunction", 0.3], ["numbness", 0.5]
    ]],
    ["multiple sclerosis", "neurological", [
      ["optic neuritis", 0.6], ["numbness", 0.6], ["tingling", 0.5], ["weakness", 0.5],
      ["fatigue", 0.6], ["balance problems", 0.5], ["visual disturbance", 0.5],
      ["urinary urgency", 0.3], ["lhermitte sign", 0.3], ["diplopia", 0.3],
      ["spasticity", 0.3], ["cognitive impairment", 0.3]
    ]],
    ["Bell palsy", "neurological", [
      ["unilateral facial weakness", 0.9], ["inability to close eye", 0.7],
      ["drooping mouth corner", 0.7], ["drooling", 0.5], ["taste disturbance", 0.4],
      ["ear pain", 0.4], ["hyperacusis", 0.3], ["difficulty eating", 0.3],
      ["tearing", 0.3], ["numbness of face", 0.3]
    ]],
    ["subdural hematoma", "neurological", [
      ["headache", 0.7], ["confusion", 0.6], ["altered mental status", 0.6],
      ["hemiparesis", 0.5], ["drowsiness", 0.5], ["personality change", 0.3],
      ["seizures", 0.3], ["gait disturbance", 0.3], ["nausea", 0.4],
      ["papilledema", 0.3], ["speech difficulty", 0.3]
    ]],
    ["trigeminal neuralgia", "neurological", [
      ["sharp facial pain", 0.9], ["electric shock-like pain", 0.8], ["unilateral face pain", 0.8],
      ["pain triggered by touch", 0.6], ["pain triggered by eating", 0.5],
      ["pain triggered by talking", 0.4], ["lacrimation", 0.3], ["facial flushing", 0.3],
      ["brief pain episodes", 0.7], ["pain-free intervals", 0.5]
    ]],

    // ===== PEDIATRICS =====
    ["bronchiolitis", "respiratory", [
      ["wheezing", 0.8], ["cough", 0.8], ["rhinorrhea", 0.7], ["tachypnea", 0.7],
      ["fever", 0.5], ["poor feeding", 0.5], ["nasal flaring", 0.4], ["intercostal retractions", 0.5],
      ["irritability", 0.4], ["apnea in infants", 0.3], ["crackles", 0.4], ["cyanosis", 0.3]
    ]],
    ["Kawasaki disease", "immunological", [
      ["prolonged fever", 0.9], ["conjunctival injection", 0.7], ["strawberry tongue", 0.6],
      ["rash", 0.7], ["cervical lymphadenopathy", 0.5], ["edema of hands and feet", 0.5],
      ["cracked lips", 0.5], ["irritability", 0.5], ["peeling skin", 0.4],
      ["joint pain", 0.3], ["abdominal pain", 0.3], ["diarrhea", 0.3]
    ]],
    ["measles", "infectious", [
      ["fever", 0.9], ["cough", 0.7], ["coryza", 0.7], ["conjunctivitis", 0.6],
      ["maculopapular rash", 0.8], ["koplik spots", 0.5], ["photophobia", 0.3],
      ["malaise", 0.5], ["anorexia", 0.3], ["lymphadenopathy", 0.3],
      ["sore throat", 0.3], ["rash starting on face", 0.6]
    ]],
    ["mumps", "infectious", [
      ["parotid gland swelling", 0.9], ["fever", 0.6], ["headache", 0.5],
      ["myalgia", 0.4], ["anorexia", 0.4], ["malaise", 0.4], ["jaw pain on chewing", 0.5],
      ["earache", 0.3], ["sore throat", 0.3], ["fatigue", 0.3], ["bilateral parotitis", 0.6]
    ]],
    ["rubella", "infectious", [
      ["rash", 0.8], ["low grade fever", 0.6], ["lymphadenopathy", 0.7],
      ["arthralgia", 0.4], ["conjunctivitis", 0.3], ["headache", 0.3],
      ["malaise", 0.4], ["sore throat", 0.3], ["coryza", 0.3],
      ["postauricular lymphadenopathy", 0.6], ["rash spreading from face", 0.5]
    ]],
    ["otitis media", "ent", [
      ["ear pain", 0.9], ["fever", 0.5], ["irritability", 0.5], ["decreased hearing", 0.5],
      ["ear pulling", 0.4], ["otorrhea", 0.3], ["rhinorrhea", 0.4], ["cough", 0.3],
      ["poor feeding", 0.3], ["vomiting", 0.3], ["sleep disturbance", 0.4],
      ["bulging tympanic membrane", 0.6]
    ]],
    ["croup", "respiratory", [
      ["barking cough", 0.9], ["stridor", 0.8], ["hoarseness", 0.7], ["fever", 0.5],
      ["rhinorrhea", 0.4], ["dyspnea", 0.4], ["worse at night", 0.5],
      ["intercostal retractions", 0.4], ["agitation", 0.3], ["tachypnea", 0.3],
      ["sore throat", 0.3]
    ]],
    ["hand foot and mouth disease", "infectious", [
      ["oral ulcers", 0.8], ["vesicular rash on hands", 0.8], ["vesicular rash on feet", 0.7],
      ["fever", 0.6], ["sore throat", 0.5], ["poor feeding", 0.4], ["malaise", 0.4],
      ["irritability", 0.3], ["drooling", 0.3], ["rash on buttocks", 0.3], ["anorexia", 0.4]
    ]],
    ["neonatal sepsis", "infectious", [
      ["temperature instability", 0.7], ["poor feeding", 0.7], ["lethargy", 0.7],
      ["tachypnea", 0.5], ["tachycardia", 0.5], ["jaundice", 0.4], ["apnea", 0.4],
      ["irritability", 0.4], ["hypotension", 0.3], ["abdominal distension", 0.3],
      ["seizures", 0.3], ["mottled skin", 0.3]
    ]],
    ["febrile seizure", "neurological", [
      ["seizures", 0.9], ["fever", 0.9], ["tonic-clonic movements", 0.6],
      ["loss of consciousness", 0.5], ["post-ictal drowsiness", 0.5],
      ["crying", 0.3], ["vomiting", 0.3], ["upper respiratory symptoms", 0.3],
      ["brief seizure duration", 0.5], ["irritability", 0.3]
    ]],
    ["intussusception", "gastrointestinal", [
      ["colicky abdominal pain", 0.8], ["currant jelly stool", 0.5], ["vomiting", 0.6],
      ["abdominal mass", 0.4], ["irritability", 0.5], ["lethargy", 0.4],
      ["drawing up legs", 0.5], ["bloody stool", 0.4], ["pallor", 0.3],
      ["anorexia", 0.3], ["bilious vomiting", 0.3]
    ]],

    // ===== NEPHROLOGY =====
    ["acute kidney injury", "renal", [
      ["oliguria", 0.7], ["peripheral edema", 0.5], ["fatigue", 0.5], ["nausea", 0.5],
      ["confusion", 0.3], ["elevated creatinine", 0.8], ["dyspnea", 0.3],
      ["anorexia", 0.3], ["vomiting", 0.3], ["pruritus", 0.3], ["flank pain", 0.3]
    ]],
    ["chronic kidney disease", "renal", [
      ["fatigue", 0.7], ["peripheral edema", 0.6], ["nausea", 0.5], ["anorexia", 0.5],
      ["pruritus", 0.4], ["nocturia", 0.4], ["muscle cramps", 0.3], ["dyspnea", 0.3],
      ["cognitive impairment", 0.3], ["pallor", 0.3], ["hiccups", 0.3], ["weight loss", 0.3]
    ]],
    ["nephrotic syndrome", "renal", [
      ["peripheral edema", 0.9], ["proteinuria", 0.9], ["periorbital edema", 0.7],
      ["ascites", 0.5], ["fatigue", 0.4], ["frothy urine", 0.6], ["weight gain", 0.4],
      ["anorexia", 0.3], ["hypoalbuminemia", 0.7], ["hyperlipidemia", 0.4],
      ["pleural effusion", 0.3]
    ]],
    ["nephrolithiasis", "renal", [
      ["flank pain", 0.9], ["colicky pain", 0.8], ["hematuria", 0.7], ["nausea", 0.6],
      ["vomiting", 0.5], ["groin pain", 0.5], ["urinary urgency", 0.4],
      ["dysuria", 0.3], ["restlessness", 0.5], ["diaphoresis", 0.3],
      ["abdominal pain", 0.4], ["costovertebral angle tenderness", 0.4]
    ]],
    ["glomerulonephritis", "renal", [
      ["hematuria", 0.8], ["proteinuria", 0.7], ["peripheral edema", 0.6],
      ["hypertension", 0.5], ["oliguria", 0.4], ["fatigue", 0.4], ["cola colored urine", 0.5],
      ["facial puffiness", 0.4], ["abdominal pain", 0.3], ["nausea", 0.3],
      ["headache", 0.3], ["dyspnea", 0.3]
    ]],

    // ===== HEMATOLOGY =====
    ["iron deficiency anemia", "hematological", [
      ["fatigue", 0.8], ["pallor", 0.7], ["weakness", 0.6], ["dyspnea on exertion", 0.5],
      ["dizziness", 0.4], ["palpitations", 0.4], ["koilonychia", 0.3],
      ["pica", 0.3], ["glossitis", 0.3], ["angular cheilitis", 0.3],
      ["brittle nails", 0.3], ["cold intolerance", 0.3]
    ]],
    ["sickle cell crisis", "hematological", [
      ["severe bone pain", 0.9], ["acute pain crisis", 0.8], ["fever", 0.4],
      ["fatigue", 0.5], ["pallor", 0.4], ["jaundice", 0.4], ["swelling of hands feet", 0.3],
      ["tachycardia", 0.3], ["chest pain", 0.3], ["abdominal pain", 0.4],
      ["dyspnea", 0.3], ["weakness", 0.3]
    ]],
    ["thrombocytopenia", "hematological", [
      ["easy bruising", 0.7], ["petechiae", 0.7], ["mucosal bleeding", 0.5],
      ["epistaxis", 0.4], ["gingival bleeding", 0.4], ["menorrhagia", 0.3],
      ["fatigue", 0.3], ["hematuria", 0.3], ["purpura", 0.5], ["prolonged bleeding", 0.5]
    ]],
    ["disseminated intravascular coagulation", "hematological", [
      ["diffuse bleeding", 0.8], ["petechiae", 0.6], ["ecchymoses", 0.5],
      ["thrombosis", 0.4], ["altered mental status", 0.3], ["hypotension", 0.4],
      ["tachycardia", 0.4], ["oliguria", 0.3], ["purpura fulminans", 0.3],
      ["fever", 0.3], ["dyspnea", 0.3]
    ]],
    ["deep vein thrombosis", "hematological", [
      ["unilateral leg swelling", 0.8], ["calf pain", 0.7], ["warmth in affected leg", 0.6],
      ["redness of leg", 0.5], ["pitting edema", 0.5], ["tenderness", 0.6],
      ["homans sign", 0.3], ["dilated superficial veins", 0.3], ["low grade fever", 0.3],
      ["leg heaviness", 0.4]
    ]],

    // ===== DERMATOLOGY FILL =====
    ["psoriasis", "dermatological", [
      ["scaly plaques", 0.9], ["silvery scales", 0.8], ["erythematous plaques", 0.7],
      ["pruritus", 0.5], ["nail pitting", 0.4], ["joint pain", 0.3],
      ["auspitz sign", 0.5], ["koebner phenomenon", 0.3], ["scalp involvement", 0.4],
      ["skin fissures", 0.3], ["dry skin", 0.3]
    ]],
    ["eczema", "dermatological", [
      ["pruritus", 0.9], ["dry skin", 0.8], ["erythematous rash", 0.7],
      ["skin thickening", 0.4], ["excoriations", 0.5], ["vesicles", 0.3],
      ["oozing", 0.3], ["skin fissures", 0.3], ["lichenification", 0.4],
      ["flexural distribution", 0.5], ["sleep disturbance", 0.3]
    ]],
    ["urticaria", "dermatological", [
      ["wheals", 0.9], ["pruritus", 0.8], ["erythema", 0.6], ["angioedema", 0.3],
      ["dermographism", 0.3], ["transient lesions", 0.6], ["burning sensation", 0.3],
      ["anxiety", 0.3], ["widespread distribution", 0.5], ["recurrence", 0.4]
    ]],
    ["cellulitis", "dermatological", [
      ["skin redness", 0.9], ["warmth", 0.8], ["swelling", 0.8], ["pain at site", 0.7],
      ["fever", 0.5], ["lymphangitis", 0.3], ["skin tenderness", 0.7],
      ["malaise", 0.3], ["chills", 0.3], ["advancing border", 0.5]
    ]],
    ["impetigo", "dermatological", [
      ["honey-colored crusted lesions", 0.8], ["erythematous base", 0.6],
      ["pruritus", 0.5], ["vesicles", 0.4], ["bullae", 0.3], ["regional lymphadenopathy", 0.3],
      ["skin tenderness", 0.3], ["fever", 0.3], ["spreading lesions", 0.5],
      ["facial distribution", 0.4]
    ]],
    ["herpes simplex", "dermatological", [
      ["grouped vesicles", 0.8], ["painful ulcers", 0.7], ["tingling prodrome", 0.6],
      ["burning sensation", 0.5], ["fever", 0.3], ["lymphadenopathy", 0.3],
      ["malaise", 0.3], ["recurrent episodes", 0.5], ["erythematous base", 0.5],
      ["crusting", 0.4]
    ]],
    ["scabies", "dermatological", [
      ["intense pruritus", 0.9], ["worse at night", 0.7], ["burrow tracks", 0.6],
      ["papular rash", 0.6], ["interdigital involvement", 0.5], ["excoriations", 0.5],
      ["vesicles", 0.3], ["nodules", 0.3], ["secondary infection", 0.3],
      ["household contacts affected", 0.4]
    ]],
    ["tinea corporis", "dermatological", [
      ["ring-shaped rash", 0.8], ["pruritus", 0.6], ["erythematous border", 0.6],
      ["central clearing", 0.6], ["scaling", 0.5], ["expanding lesion", 0.4],
      ["multiple lesions", 0.3], ["papules at border", 0.4], ["vesicles at border", 0.3]
    ]],

    // ===== ENT =====
    ["acute sinusitis", "ent", [
      ["facial pain", 0.8], ["nasal congestion", 0.8], ["purulent nasal discharge", 0.7],
      ["headache", 0.5], ["fever", 0.4], ["postnasal drip", 0.5], ["anosmia", 0.3],
      ["cough", 0.3], ["dental pain", 0.3], ["facial pressure", 0.6],
      ["maxillary tenderness", 0.5], ["fatigue", 0.3]
    ]],
    ["acute pharyngitis", "ent", [
      ["sore throat", 0.9], ["odynophagia", 0.7], ["fever", 0.5], ["tonsillar exudate", 0.4],
      ["cervical lymphadenopathy", 0.5], ["headache", 0.3], ["malaise", 0.3],
      ["dysphagia", 0.4], ["pharyngeal erythema", 0.7], ["body aches", 0.3],
      ["cough", 0.3]
    ]],
    ["peritonsillar abscess", "ent", [
      ["severe sore throat", 0.9], ["trismus", 0.7], ["drooling", 0.5],
      ["uvular deviation", 0.6], ["fever", 0.6], ["muffled voice", 0.5],
      ["unilateral throat swelling", 0.7], ["dysphagia", 0.6], ["ear pain", 0.3],
      ["cervical lymphadenopathy", 0.4], ["odynophagia", 0.7]
    ]],
    ["epistaxis", "ent", [
      ["nasal bleeding", 0.9], ["anterior nasal bleeding", 0.7], ["blood in throat", 0.3],
      ["nasal congestion", 0.3], ["dry nasal mucosa", 0.4], ["nasal crusting", 0.3],
      ["dizziness", 0.3], ["anxiety", 0.3], ["nausea from blood swallowing", 0.3],
      ["pallor", 0.3]
    ]],

    // ===== MUSCULOSKELETAL =====
    ["gout", "musculoskeletal", [
      ["acute joint pain", 0.9], ["swollen joint", 0.8], ["erythema over joint", 0.7],
      ["first MTP joint involvement", 0.7], ["warmth over joint", 0.6], ["exquisite tenderness", 0.6],
      ["fever", 0.3], ["tophi", 0.3], ["limited range of motion", 0.5],
      ["pain worse at night", 0.4], ["rapid onset", 0.6]
    ]],
    ["rheumatoid arthritis", "musculoskeletal", [
      ["morning stiffness", 0.8], ["symmetric joint swelling", 0.7],
      ["joint pain", 0.8], ["fatigue", 0.5], ["small joint involvement", 0.6],
      ["joint deformity", 0.3], ["rheumatoid nodules", 0.3], ["weakness", 0.3],
      ["stiffness after inactivity", 0.6], ["warmth over joints", 0.4],
      ["decreased grip strength", 0.4], ["anorexia", 0.3]
    ]],
    ["osteoarthritis", "musculoskeletal", [
      ["joint pain with activity", 0.8], ["joint stiffness", 0.7], ["crepitus", 0.5],
      ["joint swelling", 0.5], ["decreased range of motion", 0.6], ["pain worse with use", 0.7],
      ["bony enlargement", 0.3], ["morning stiffness less than 30 min", 0.5],
      ["knee pain", 0.4], ["hip pain", 0.3], ["difficulty walking", 0.3]
    ]],
    ["ankylosing spondylitis", "musculoskeletal", [
      ["chronic low back pain", 0.8], ["morning stiffness", 0.7], ["improved with exercise", 0.6],
      ["sacroiliac joint pain", 0.6], ["reduced spinal mobility", 0.5], ["fatigue", 0.4],
      ["enthesitis", 0.4], ["peripheral arthritis", 0.3], ["chest wall pain", 0.3],
      ["uveitis", 0.3], ["buttock pain", 0.4]
    ]],
    ["systemic lupus erythematosus", "musculoskeletal", [
      ["joint pain", 0.8], ["malar rash", 0.6], ["fatigue", 0.7],
      ["photosensitivity", 0.5], ["oral ulcers", 0.3], ["hair loss", 0.4],
      ["fever", 0.4], ["pleuritis", 0.3], ["renal involvement", 0.3],
      ["arthritis", 0.6], ["rash", 0.5], ["anemia", 0.3]
    ]],

    // ===== PSYCHIATRIC =====
    ["major depressive disorder", "psychiatric", [
      ["depressed mood", 0.9], ["loss of interest", 0.8], ["fatigue", 0.7],
      ["sleep disturbance", 0.6], ["appetite change", 0.5], ["difficulty concentrating", 0.5],
      ["feelings of worthlessness", 0.4], ["psychomotor retardation", 0.3],
      ["suicidal ideation", 0.3], ["weight change", 0.4], ["anhedonia", 0.7],
      ["guilt", 0.4]
    ]],
    ["generalized anxiety disorder", "psychiatric", [
      ["excessive worry", 0.9], ["restlessness", 0.7], ["fatigue", 0.5],
      ["difficulty concentrating", 0.5], ["muscle tension", 0.5], ["sleep disturbance", 0.5],
      ["irritability", 0.4], ["palpitations", 0.4], ["sweating", 0.3],
      ["trembling", 0.3], ["gastrointestinal symptoms", 0.3]
    ]],
    ["panic disorder", "psychiatric", [
      ["sudden onset palpitations", 0.8], ["chest pain", 0.6], ["shortness of breath", 0.6],
      ["dizziness", 0.5], ["trembling", 0.5], ["fear of dying", 0.5],
      ["sweating", 0.5], ["nausea", 0.4], ["paresthesias", 0.3],
      ["derealization", 0.3], ["choking sensation", 0.4]
    ]],
  ];

  const results: string[] = [];
  const allRows: { symptom_id: string; diagnosis_id: string; likelihood: number }[] = [];

  for (const [disease, category, symptoms] of diseases) {
    try {
      const dId = await ensureDiagnosis(disease, category);
      for (const [symptom, likelihood] of symptoms) {
        if (likelihood < 0.3) continue;
        try {
          const sId = await ensureSymptom(symptom);
          allRows.push({ symptom_id: sId, diagnosis_id: dId, likelihood_value: likelihood });
        } catch (e) {
          results.push(`⚠️ Symptom: ${symptom} - ${e.message}`);
        }
      }
    } catch (e) {
      results.push(`⚠️ Diagnosis: ${disease} - ${e.message}`);
    }
  }

  const BATCH_SIZE = 400;
  let upserted = 0;
  for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
    const batch = allRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("symptom_likelihoods")
      .upsert(batch, { onConflict: "symptom_id,diagnosis_id", ignoreDuplicates: false });
    if (error) {
      results.push(`❌ Batch ${Math.floor(i/BATCH_SIZE)+1}: ${error.message}`);
    } else {
      upserted += batch.length;
    }
  }

  results.push(`✅ Batch 2 complete: ${upserted} rows upserted across ${diseases.length} diseases`);

  return new Response(JSON.stringify({
    diseases_processed: diseases.length,
    rows_upserted: upserted,
    errors: results.filter(r => r.startsWith("⚠️") || r.startsWith("❌")),
    summary: results
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
