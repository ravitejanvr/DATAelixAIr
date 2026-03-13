import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const symptomCache: Record<string, string> = {};
  const diagnosisCache: Record<string, string> = {};
  const { data: allS } = await supabase.from("symptoms").select("id, symptom_name");
  const { data: allD } = await supabase.from("diagnoses").select("id, diagnosis_name");
  for (const s of allS || []) symptomCache[s.symptom_name.toLowerCase()] = s.id;
  for (const d of allD || []) diagnosisCache[d.diagnosis_name.toLowerCase()] = d.id;

  async function eS(name: string): Promise<string> {
    const k = name.toLowerCase();
    if (symptomCache[k]) return symptomCache[k];
    const { data } = await supabase.from("symptoms").upsert({ symptom_name: name }, { onConflict: "symptom_name" }).select("id").single();
    if (data) { symptomCache[k] = data.id; return data.id; }
    const { data: ex } = await supabase.from("symptoms").select("id").eq("symptom_name", name).single();
    if (ex) { symptomCache[k] = ex.id; return ex.id; }
    throw new Error(`Failed: ${name}`);
  }

  async function eD(name: string, cat: string): Promise<string> {
    const k = name.toLowerCase();
    if (diagnosisCache[k]) return diagnosisCache[k];
    const { data } = await supabase.from("diagnoses").upsert({ diagnosis_name: name, category: cat }, { onConflict: "diagnosis_name" }).select("id").single();
    if (data) { diagnosisCache[k] = data.id; return data.id; }
    const { data: ex } = await supabase.from("diagnoses").select("id").eq("diagnosis_name", name).single();
    if (ex) { diagnosisCache[k] = ex.id; return ex.id; }
    throw new Error(`Failed: ${name}`);
  }

  type DM = [string, string, [string, number][]];

  const diseases: DM[] = [
    // CARDIOVASCULAR gaps
    ["aortic aneurysm rupture", "cardiovascular", [
      ["sudden severe abdominal pain", 0.8], ["back pain", 0.7], ["hypotension", 0.7], ["pulsatile abdominal mass", 0.6],
      ["syncope", 0.4], ["tachycardia", 0.6], ["diaphoresis", 0.5], ["flank pain", 0.4],
      ["nausea", 0.3], ["altered mental status", 0.3], ["cold extremities", 0.4]
    ]],
    ["aortic regurgitation", "cardiovascular", [
      ["dyspnea on exertion", 0.7], ["palpitations", 0.5], ["chest pain", 0.4], ["fatigue", 0.5],
      ["wide pulse pressure", 0.6], ["bounding pulses", 0.5], ["diastolic murmur", 0.8],
      ["orthopnea", 0.3], ["peripheral edema", 0.3], ["head bobbing", 0.3]
    ]],
    ["atrial flutter", "cardiovascular", [
      ["palpitations", 0.7], ["dyspnea", 0.5], ["fatigue", 0.5], ["dizziness", 0.4],
      ["chest discomfort", 0.3], ["exercise intolerance", 0.4], ["syncope", 0.3],
      ["rapid regular pulse", 0.6], ["anxiety", 0.3], ["weakness", 0.3]
    ]],
    ["cardiogenic shock", "cardiovascular", [
      ["hypotension", 0.9], ["tachycardia", 0.7], ["cool clammy skin", 0.7], ["altered mental status", 0.5],
      ["oliguria", 0.5], ["dyspnea", 0.6], ["jugular venous distension", 0.5],
      ["pulmonary edema", 0.4], ["diaphoresis", 0.5], ["chest pain", 0.3], ["weakness", 0.4]
    ]],
    ["dilated cardiomyopathy", "cardiovascular", [
      ["dyspnea", 0.8], ["fatigue", 0.7], ["peripheral edema", 0.6], ["orthopnea", 0.5],
      ["palpitations", 0.4], ["chest pain", 0.3], ["syncope", 0.3], ["hepatomegaly", 0.3],
      ["exercise intolerance", 0.6], ["paroxysmal nocturnal dyspnea", 0.4], ["cough", 0.3]
    ]],
    ["constrictive pericarditis", "cardiovascular", [
      ["peripheral edema", 0.7], ["ascites", 0.6], ["dyspnea on exertion", 0.6], ["jugular venous distension", 0.7],
      ["fatigue", 0.5], ["hepatomegaly", 0.5], ["pericardial knock", 0.4],
      ["kussmaul sign", 0.3], ["pleural effusion", 0.3], ["weight gain", 0.3]
    ]],
    ["cor pulmonale", "cardiovascular", [
      ["dyspnea", 0.8], ["peripheral edema", 0.7], ["jugular venous distension", 0.6], ["fatigue", 0.5],
      ["syncope", 0.4], ["cyanosis", 0.3], ["hepatomegaly", 0.4], ["ascites", 0.3],
      ["chest pain", 0.3], ["tachycardia", 0.4], ["wheezing", 0.3]
    ]],
    ["mitral stenosis", "cardiovascular", [
      ["dyspnea on exertion", 0.8], ["orthopnea", 0.5], ["hemoptysis", 0.3], ["palpitations", 0.5],
      ["fatigue", 0.5], ["opening snap", 0.5], ["diastolic rumble", 0.7],
      ["malar flush", 0.3], ["peripheral edema", 0.3], ["hoarseness", 0.3]
    ]],
    ["Raynaud phenomenon", "cardiovascular", [
      ["color changes in fingers", 0.9], ["cold fingers", 0.7], ["numbness in fingers", 0.6],
      ["pain in fingers", 0.5], ["tingling", 0.4], ["finger pallor", 0.7],
      ["cyanotic fingers", 0.5], ["triggered by cold", 0.7], ["triggered by stress", 0.4], ["ulceration of fingertips", 0.3]
    ]],
    ["Takotsubo cardiomyopathy", "cardiovascular", [
      ["chest pain", 0.8], ["dyspnea", 0.6], ["ST elevation on ECG", 0.5], ["emotional stress trigger", 0.6],
      ["palpitations", 0.3], ["syncope", 0.3], ["hypotension", 0.3], ["pulmonary edema", 0.3],
      ["diaphoresis", 0.4], ["anxiety", 0.4]
    ]],
    ["Wolff-Parkinson-White syndrome", "cardiovascular", [
      ["palpitations", 0.8], ["tachycardia", 0.7], ["dizziness", 0.5], ["syncope", 0.4],
      ["chest pain", 0.3], ["dyspnea", 0.3], ["anxiety", 0.3], ["sudden onset tachycardia", 0.6],
      ["lightheadedness", 0.4], ["presyncope", 0.4]
    ]],

    // DERMATOLOGICAL gaps
    ["angioedema", "dermatological", [
      ["facial swelling", 0.8], ["lip swelling", 0.7], ["tongue swelling", 0.6], ["throat tightness", 0.5],
      ["dysphagia", 0.4], ["dyspnea", 0.3], ["abdominal pain", 0.3], ["urticaria", 0.4],
      ["hoarseness", 0.3], ["pruritus", 0.3]
    ]],
    ["necrotizing fasciitis", "dermatological", [
      ["severe pain out of proportion", 0.8], ["skin erythema", 0.7], ["fever", 0.7],
      ["rapidly spreading", 0.6], ["skin necrosis", 0.5], ["crepitus", 0.4],
      ["tachycardia", 0.5], ["hypotension", 0.4], ["bullae", 0.4],
      ["altered mental status", 0.3], ["swelling", 0.6]
    ]],
    ["toxic epidermal necrolysis", "dermatological", [
      ["widespread skin detachment", 0.9], ["fever", 0.7], ["mucosal involvement", 0.7],
      ["skin pain", 0.7], ["erythematous macules", 0.6], ["nikolsky sign", 0.6],
      ["dysphagia", 0.3], ["conjunctivitis", 0.4], ["target lesions", 0.4],
      ["malaise", 0.4], ["tachycardia", 0.3]
    ]],
    ["rosacea", "dermatological", [
      ["facial erythema", 0.8], ["flushing", 0.7], ["papules on face", 0.5],
      ["telangiectasia", 0.5], ["burning sensation", 0.4], ["rhinophyma", 0.3],
      ["ocular irritation", 0.3], ["dry skin on face", 0.3], ["pustules on face", 0.4],
      ["worsened by triggers", 0.5]
    ]],
    ["seborrheic dermatitis", "dermatological", [
      ["flaky scalp", 0.8], ["erythematous patches", 0.6], ["greasy scales", 0.6],
      ["pruritus", 0.5], ["nasolabial fold involvement", 0.4], ["dandruff", 0.7],
      ["eyebrow involvement", 0.3], ["ear involvement", 0.3], ["mild burning", 0.3]
    ]],
    ["bullous pemphigoid", "dermatological", [
      ["tense blisters", 0.8], ["pruritus", 0.7], ["erythematous base", 0.5],
      ["urticarial plaques", 0.4], ["skin erosions", 0.3], ["mucosal sparing", 0.4],
      ["elderly onset", 0.3], ["widespread distribution", 0.5], ["burning sensation", 0.3]
    ]],
    ["pemphigus vulgaris", "dermatological", [
      ["flaccid blisters", 0.8], ["oral erosions", 0.7], ["nikolsky sign", 0.6],
      ["skin erosions", 0.6], ["pain", 0.5], ["dysphagia", 0.3],
      ["weight loss", 0.3], ["widespread distribution", 0.4], ["secondary infection", 0.3]
    ]],
    ["lichen planus", "dermatological", [
      ["purple polygonal papules", 0.8], ["pruritus", 0.7], ["wickham striae", 0.5],
      ["oral erosions", 0.3], ["nail changes", 0.3], ["wrist involvement", 0.5],
      ["ankle involvement", 0.4], ["koebner phenomenon", 0.3], ["hair loss", 0.3]
    ]],
    ["alopecia areata", "dermatological", [
      ["patchy hair loss", 0.9], ["smooth bald patches", 0.7], ["nail pitting", 0.3],
      ["exclamation point hairs", 0.5], ["sudden onset", 0.5], ["no scarring", 0.5],
      ["scalp involvement", 0.7], ["eyebrow hair loss", 0.3], ["tingling sensation", 0.3]
    ]],
    ["vitiligo", "dermatological", [
      ["depigmented patches", 0.9], ["symmetric distribution", 0.5], ["koebner phenomenon", 0.3],
      ["premature graying", 0.3], ["sun sensitivity", 0.4], ["well-demarcated borders", 0.6],
      ["face involvement", 0.4], ["hands involvement", 0.4], ["progressive", 0.4]
    ]],
    ["hidradenitis suppurativa", "dermatological", [
      ["painful nodules", 0.8], ["recurrent abscesses", 0.7], ["sinus tracts", 0.5],
      ["axillary involvement", 0.6], ["groin involvement", 0.5], ["scarring", 0.4],
      ["purulent drainage", 0.5], ["pain", 0.6], ["foul odor", 0.3], ["pruritus", 0.3]
    ]],

    // ENT gaps
    ["epiglottitis", "ent", [
      ["severe sore throat", 0.8], ["dysphagia", 0.7], ["drooling", 0.6], ["stridor", 0.5],
      ["muffled voice", 0.5], ["fever", 0.6], ["tripod position", 0.4],
      ["respiratory distress", 0.4], ["anxiety", 0.3], ["sore throat rapid onset", 0.6]
    ]],
    ["labyrinthitis", "ent", [
      ["vertigo", 0.8], ["nausea", 0.6], ["vomiting", 0.5], ["nystagmus", 0.6],
      ["hearing loss", 0.5], ["tinnitus", 0.4], ["imbalance", 0.5],
      ["ear fullness", 0.3], ["preceding URI", 0.3], ["anxiety", 0.3]
    ]],
    ["vestibular neuritis", "ent", [
      ["acute vertigo", 0.9], ["nausea", 0.7], ["vomiting", 0.5], ["nystagmus", 0.6],
      ["imbalance", 0.6], ["no hearing loss", 0.5], ["worsened by head movement", 0.5],
      ["anxiety", 0.3], ["preceding viral illness", 0.3], ["difficulty walking", 0.3]
    ]],
    ["mastoiditis", "ent", [
      ["postauricular pain", 0.8], ["postauricular swelling", 0.7], ["fever", 0.6],
      ["ear pain", 0.6], ["otorrhea", 0.4], ["protruding ear", 0.5],
      ["tenderness behind ear", 0.7], ["hearing loss", 0.3], ["irritability", 0.3]
    ]],
    ["Ludwig angina", "ent", [
      ["submandibular swelling", 0.8], ["floor of mouth elevation", 0.7], ["dysphagia", 0.6],
      ["fever", 0.5], ["drooling", 0.5], ["trismus", 0.4], ["neck swelling", 0.5],
      ["odynophagia", 0.5], ["respiratory distress", 0.3], ["preceding dental infection", 0.4]
    ]],
    ["oral candidiasis", "ent", [
      ["white patches in mouth", 0.8], ["oral pain", 0.5], ["dysphagia", 0.3],
      ["taste disturbance", 0.4], ["erythematous oral mucosa", 0.5], ["angular cheilitis", 0.3],
      ["burning mouth", 0.4], ["dry mouth", 0.3], ["difficulty eating", 0.3]
    ]],
    ["nasal polyps", "ent", [
      ["nasal obstruction", 0.8], ["rhinorrhea", 0.5], ["anosmia", 0.6], ["postnasal drip", 0.4],
      ["facial pressure", 0.3], ["snoring", 0.3], ["mouth breathing", 0.4],
      ["headache", 0.3], ["hyposmia", 0.5], ["nasal voice", 0.3]
    ]],
    ["temporomandibular joint disorder", "ent", [
      ["jaw pain", 0.8], ["clicking jaw", 0.6], ["jaw stiffness", 0.5], ["headache", 0.5],
      ["ear pain", 0.4], ["difficulty opening mouth", 0.5], ["facial pain", 0.4],
      ["jaw locking", 0.3], ["pain on chewing", 0.5], ["tooth pain", 0.3]
    ]],

    // ENVIRONMENTAL gaps
    ["carbon monoxide poisoning", "environmental", [
      ["headache", 0.8], ["dizziness", 0.6], ["nausea", 0.6], ["confusion", 0.5],
      ["weakness", 0.4], ["syncope", 0.3], ["chest pain", 0.3], ["shortness of breath", 0.3],
      ["visual disturbance", 0.3], ["cherry red skin", 0.3], ["vomiting", 0.4]
    ]],
    ["organophosphate poisoning", "environmental", [
      ["excessive salivation", 0.8], ["lacrimation", 0.7], ["miosis", 0.7],
      ["bradycardia", 0.5], ["diarrhea", 0.5], ["vomiting", 0.5], ["bronchospasm", 0.5],
      ["muscle fasciculations", 0.5], ["diaphoresis", 0.6], ["confusion", 0.3],
      ["urinary incontinence", 0.3], ["seizures", 0.3]
    ]],
    ["opioid overdose", "environmental", [
      ["respiratory depression", 0.9], ["miosis", 0.8], ["altered consciousness", 0.7],
      ["cyanosis", 0.4], ["hypotension", 0.4], ["bradycardia", 0.3],
      ["hypothermia", 0.3], ["apnea", 0.3], ["needle marks", 0.3], ["pulmonary edema", 0.3]
    ]],
    ["hypothermia", "environmental", [
      ["shivering", 0.7], ["confusion", 0.6], ["slurred speech", 0.5], ["drowsiness", 0.5],
      ["bradycardia", 0.4], ["hypotension", 0.4], ["cold skin", 0.7],
      ["muscle stiffness", 0.4], ["weak pulse", 0.3], ["loss of coordination", 0.5]
    ]],
    ["hyperthermia", "environmental", [
      ["high body temperature", 0.9], ["confusion", 0.5], ["hot dry skin", 0.5],
      ["tachycardia", 0.5], ["headache", 0.4], ["nausea", 0.4], ["dizziness", 0.4],
      ["muscle cramps", 0.3], ["syncope", 0.3], ["seizures", 0.3], ["weakness", 0.4]
    ]],
    ["acetaminophen overdose", "environmental", [
      ["nausea", 0.6], ["vomiting", 0.6], ["abdominal pain", 0.5], ["anorexia", 0.4],
      ["right upper quadrant pain", 0.4], ["jaundice", 0.3], ["diaphoresis", 0.3],
      ["malaise", 0.4], ["confusion", 0.3], ["hepatomegaly", 0.3]
    ]],

    // ENDOCRINE gaps
    ["diabetes insipidus", "endocrine", [
      ["polyuria", 0.9], ["polydipsia", 0.9], ["nocturia", 0.6], ["dehydration", 0.4],
      ["fatigue", 0.3], ["dizziness", 0.3], ["dry mouth", 0.3], ["constipation", 0.3],
      ["dilute urine", 0.7], ["hypernatremia", 0.4]
    ]],
    ["subacute thyroiditis", "endocrine", [
      ["neck pain", 0.8], ["tender thyroid", 0.7], ["fever", 0.5], ["fatigue", 0.5],
      ["jaw pain radiating", 0.3], ["palpitations", 0.4], ["weight loss", 0.3],
      ["malaise", 0.4], ["dysphagia", 0.3], ["preceding viral illness", 0.3]
    ]],
    ["carcinoid syndrome", "endocrine", [
      ["flushing", 0.8], ["diarrhea", 0.7], ["wheezing", 0.4], ["abdominal pain", 0.3],
      ["right heart failure", 0.3], ["pellagra-like rash", 0.3], ["tachycardia", 0.3],
      ["bronchospasm", 0.3], ["facial flushing episodes", 0.7], ["fatigue", 0.3]
    ]],
    ["insulinoma", "endocrine", [
      ["hypoglycemic episodes", 0.8], ["confusion", 0.5], ["sweating", 0.5],
      ["palpitations", 0.4], ["hunger", 0.5], ["tremor", 0.4], ["seizures", 0.3],
      ["weight gain", 0.3], ["blurred vision", 0.3], ["relief with eating", 0.6]
    ]],
    ["hypoparathyroidism", "endocrine", [
      ["muscle cramps", 0.7], ["tingling", 0.7], ["perioral numbness", 0.5],
      ["chvostek sign", 0.5], ["trousseau sign", 0.5], ["seizures", 0.3],
      ["fatigue", 0.3], ["dry skin", 0.3], ["brittle nails", 0.3], ["anxiety", 0.3]
    ]],

    // HEMATOLOGICAL gaps  
    ["G6PD deficiency", "hematological", [
      ["jaundice", 0.7], ["dark urine", 0.6], ["pallor", 0.5], ["fatigue", 0.5],
      ["tachycardia", 0.3], ["back pain", 0.3], ["abdominal pain", 0.3],
      ["dyspnea", 0.3], ["episodic hemolysis", 0.6], ["splenomegaly", 0.3]
    ]],
    ["hemolytic uremic syndrome", "hematological", [
      ["bloody diarrhea", 0.7], ["oliguria", 0.6], ["pallor", 0.5], ["jaundice", 0.4],
      ["fatigue", 0.4], ["abdominal pain", 0.5], ["edema", 0.3], ["petechiae", 0.3],
      ["irritability", 0.3], ["vomiting", 0.4], ["preceding gastroenteritis", 0.5]
    ]],
    ["thrombotic thrombocytopenic purpura", "hematological", [
      ["thrombocytopenia", 0.8], ["microangiopathic hemolytic anemia", 0.7],
      ["neurological symptoms", 0.5], ["fever", 0.4], ["renal impairment", 0.4],
      ["petechiae", 0.4], ["confusion", 0.4], ["fatigue", 0.5], ["pallor", 0.4],
      ["jaundice", 0.3], ["headache", 0.3]
    ]],
    ["myelodysplastic syndrome", "hematological", [
      ["fatigue", 0.8], ["pallor", 0.5], ["recurrent infections", 0.4],
      ["easy bruising", 0.4], ["petechiae", 0.3], ["dyspnea on exertion", 0.3],
      ["weakness", 0.4], ["weight loss", 0.3], ["splenomegaly", 0.3], ["anorexia", 0.3]
    ]],

    // OBSTETRIC gaps
    ["ectopic pregnancy", "obstetric", [
      ["lower abdominal pain", 0.8], ["vaginal bleeding", 0.7], ["amenorrhea", 0.6],
      ["shoulder pain", 0.3], ["dizziness", 0.3], ["syncope", 0.3],
      ["adnexal tenderness", 0.5], ["nausea", 0.3], ["pelvic pain", 0.6], ["positive pregnancy test", 0.7]
    ]],
    ["preeclampsia", "obstetric", [
      ["hypertension", 0.8], ["proteinuria", 0.7], ["headache", 0.5], ["edema", 0.5],
      ["visual disturbance", 0.4], ["upper abdominal pain", 0.3], ["nausea", 0.3],
      ["sudden weight gain", 0.3], ["hyperreflexia", 0.3], ["oliguria", 0.3]
    ]],
    ["placenta previa", "obstetric", [
      ["painless vaginal bleeding", 0.8], ["bright red bleeding", 0.7], ["uterine relaxation", 0.4],
      ["malpresentation", 0.3], ["tachycardia", 0.3], ["hypotension", 0.3],
      ["anemia", 0.3], ["third trimester bleeding", 0.7], ["no abdominal pain", 0.5]
    ]],
    ["placental abruption", "obstetric", [
      ["vaginal bleeding", 0.7], ["abdominal pain", 0.8], ["uterine tenderness", 0.6],
      ["uterine rigidity", 0.5], ["fetal distress", 0.4], ["back pain", 0.4],
      ["tachycardia", 0.3], ["hypotension", 0.3], ["dark blood", 0.3]
    ]],

    // OPHTHALMOLOGIC gaps
    ["acute angle closure glaucoma", "ophthalmologic", [
      ["severe eye pain", 0.8], ["blurred vision", 0.7], ["halos around lights", 0.6],
      ["nausea", 0.5], ["vomiting", 0.4], ["red eye", 0.6], ["headache", 0.5],
      ["fixed mid-dilated pupil", 0.5], ["decreased visual acuity", 0.5], ["tearing", 0.3]
    ]],
    ["corneal ulcer", "ophthalmologic", [
      ["eye pain", 0.8], ["red eye", 0.7], ["tearing", 0.5], ["photophobia", 0.5],
      ["foreign body sensation", 0.5], ["decreased vision", 0.4], ["purulent discharge", 0.3],
      ["corneal opacity", 0.5], ["eyelid swelling", 0.3], ["blepharospasm", 0.3]
    ]],
    ["optic neuritis", "ophthalmologic", [
      ["vision loss", 0.8], ["eye pain with movement", 0.7], ["color desaturation", 0.5],
      ["afferent pupillary defect", 0.5], ["central scotoma", 0.4], ["painful eye movement", 0.6],
      ["decreased visual acuity", 0.6], ["periorbital pain", 0.3], ["worsened by heat", 0.3]
    ]],
    ["retinal detachment", "ophthalmologic", [
      ["flashes of light", 0.7], ["floaters", 0.7], ["curtain over vision", 0.6],
      ["painless vision loss", 0.6], ["peripheral vision loss", 0.5],
      ["decreased visual acuity", 0.4], ["metamorphopsia", 0.3], ["sudden onset", 0.5]
    ]],
    ["central retinal artery occlusion", "ophthalmologic", [
      ["sudden painless vision loss", 0.9], ["afferent pupillary defect", 0.5],
      ["cherry red spot on fundoscopy", 0.5], ["pale retina", 0.4],
      ["amaurosis fugax history", 0.3], ["decreased visual acuity", 0.7],
      ["no pain", 0.5], ["unilateral", 0.6]
    ]],
    ["conjunctivitis", "ophthalmologic", [
      ["red eye", 0.8], ["eye discharge", 0.7], ["tearing", 0.5], ["itching", 0.5],
      ["foreign body sensation", 0.3], ["morning crusting", 0.4], ["photophobia", 0.3],
      ["bilateral involvement", 0.4], ["eyelid swelling", 0.3], ["blurred vision", 0.3]
    ]],
    ["uveitis", "ophthalmologic", [
      ["eye pain", 0.7], ["photophobia", 0.7], ["blurred vision", 0.6], ["red eye", 0.6],
      ["tearing", 0.4], ["miosis", 0.3], ["floaters", 0.3], ["decreased visual acuity", 0.4],
      ["ciliary flush", 0.4], ["hypopyon", 0.3]
    ]],
  ];

  const results: string[] = [];
  const allRows: { symptom_id: string; diagnosis_id: string; likelihood_value: number }[] = [];

  for (const [disease, cat, symptoms] of diseases) {
    try {
      const dId = await eD(disease, cat);
      for (const [symptom, lv] of symptoms) {
        if (lv < 0.3) continue;
        try { allRows.push({ symptom_id: await eS(symptom), diagnosis_id: dId, likelihood_value: lv }); }
        catch (e) { results.push(`⚠️ ${symptom}: ${e.message}`); }
      }
    } catch (e) { results.push(`⚠️ ${disease}: ${e.message}`); }
  }

  let upserted = 0;
  for (let i = 0; i < allRows.length; i += 400) {
    const batch = allRows.slice(i, i + 400);
    const { error } = await supabase.from("symptom_likelihoods")
      .upsert(batch, { onConflict: "symptom_id,diagnosis_id", ignoreDuplicates: false });
    if (error) results.push(`❌ Batch ${Math.floor(i/400)+1}: ${error.message}`);
    else upserted += batch.length;
  }

  results.push(`✅ Deep batch 3: ${upserted} rows upserted across ${diseases.length} diseases`);

  return new Response(JSON.stringify({ diseases_processed: diseases.length, rows_upserted: upserted, errors: results.filter(r => r.startsWith("⚠️") || r.startsWith("❌")), summary: results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
