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

  async function eS(n: string): Promise<string> {
    const k = n.toLowerCase();
    if (symptomCache[k]) return symptomCache[k];
    const { data } = await supabase.from("symptoms").upsert({ symptom_name: n }, { onConflict: "symptom_name" }).select("id").single();
    if (data) { symptomCache[k] = data.id; return data.id; }
    const { data: ex } = await supabase.from("symptoms").select("id").eq("symptom_name", n).single();
    if (ex) { symptomCache[k] = ex.id; return ex.id; }
    throw new Error(`Failed: ${n}`);
  }

  async function eD(n: string, c: string): Promise<string> {
    const k = n.toLowerCase();
    if (diagnosisCache[k]) return diagnosisCache[k];
    const { data } = await supabase.from("diagnoses").upsert({ diagnosis_name: n, category: c }, { onConflict: "diagnosis_name" }).select("id").single();
    if (data) { diagnosisCache[k] = data.id; return data.id; }
    const { data: ex } = await supabase.from("diagnoses").select("id").eq("diagnosis_name", n).single();
    if (ex) { diagnosisCache[k] = ex.id; return ex.id; }
    throw new Error(`Failed: ${n}`);
  }

  type DM = [string, string, [string, number][]];

  const diseases: DM[] = [
    // INFECTIOUS gaps
    ["pelvic inflammatory disease", "infectious", [
      ["lower abdominal pain", 0.8], ["vaginal discharge", 0.7], ["fever", 0.5],
      ["cervical motion tenderness", 0.6], ["adnexal tenderness", 0.5], ["dyspareunia", 0.4],
      ["irregular bleeding", 0.3], ["nausea", 0.3], ["dysuria", 0.3], ["back pain", 0.3]
    ]],
    ["orbital cellulitis", "infectious", [
      ["eye pain", 0.7], ["proptosis", 0.7], ["periorbital swelling", 0.7], ["fever", 0.5],
      ["restricted eye movement", 0.5], ["decreased vision", 0.4], ["red eye", 0.5],
      ["diplopia", 0.3], ["headache", 0.3], ["chemosis", 0.4]
    ]],
    ["Lyme disease", "infectious", [
      ["erythema migrans", 0.8], ["fever", 0.5], ["fatigue", 0.6], ["headache", 0.4],
      ["myalgia", 0.4], ["arthralgia", 0.4], ["neck stiffness", 0.3], ["facial palsy", 0.3],
      ["joint swelling", 0.3], ["rash", 0.5], ["tick bite history", 0.5]
    ]],
    ["rickettsial infection", "infectious", [
      ["fever", 0.8], ["headache", 0.6], ["rash", 0.6], ["myalgia", 0.5],
      ["malaise", 0.4], ["eschar", 0.4], ["lymphadenopathy", 0.3], ["nausea", 0.3],
      ["tick bite history", 0.3], ["arthralgia", 0.3], ["conjunctival injection", 0.3]
    ]],
    ["herpes simplex encephalitis", "infectious", [
      ["fever", 0.8], ["headache", 0.7], ["altered mental status", 0.7], ["seizures", 0.5],
      ["focal neurological deficit", 0.4], ["confusion", 0.5], ["behavioral changes", 0.4],
      ["aphasia", 0.3], ["neck stiffness", 0.3], ["personality change", 0.3]
    ]],
    ["giardiasis", "infectious", [
      ["watery diarrhea", 0.8], ["abdominal cramps", 0.6], ["bloating", 0.6],
      ["flatulence", 0.5], ["nausea", 0.4], ["steatorrhea", 0.3], ["weight loss", 0.3],
      ["fatigue", 0.3], ["anorexia", 0.3], ["foul smelling stool", 0.4]
    ]],
    ["cat scratch disease", "infectious", [
      ["regional lymphadenopathy", 0.8], ["papule at inoculation site", 0.6], ["fever", 0.5],
      ["fatigue", 0.4], ["headache", 0.3], ["malaise", 0.3], ["anorexia", 0.3],
      ["cat scratch history", 0.6], ["lymph node tenderness", 0.5]
    ]],
    ["toxoplasmosis", "infectious", [
      ["lymphadenopathy", 0.7], ["fever", 0.5], ["fatigue", 0.5], ["headache", 0.4],
      ["myalgia", 0.3], ["sore throat", 0.3], ["hepatosplenomegaly", 0.3],
      ["rash", 0.3], ["malaise", 0.4], ["cervical lymphadenopathy", 0.5]
    ]],
    ["rotavirus gastroenteritis", "infectious", [
      ["watery diarrhea", 0.9], ["vomiting", 0.7], ["fever", 0.5], ["abdominal cramps", 0.5],
      ["dehydration", 0.5], ["irritability", 0.3], ["poor feeding", 0.3],
      ["lethargy", 0.3], ["decreased urine output", 0.3], ["malaise", 0.3]
    ]],
    ["anthrax", "infectious", [
      ["black eschar", 0.7], ["painless ulcer", 0.5], ["fever", 0.5], ["malaise", 0.4],
      ["lymphadenopathy", 0.4], ["edema around lesion", 0.5], ["headache", 0.3],
      ["dyspnea", 0.3], ["chest discomfort", 0.3], ["cough", 0.3]
    ]],
    ["plague", "infectious", [
      ["fever", 0.8], ["painful lymphadenopathy", 0.7], ["bubo", 0.6], ["chills", 0.5],
      ["headache", 0.5], ["malaise", 0.4], ["myalgia", 0.3], ["nausea", 0.3],
      ["prostration", 0.3], ["skin necrosis", 0.3]
    ]],
    ["Pneumocystis jirovecii pneumonia", "respiratory", [
      ["progressive dyspnea", 0.8], ["dry cough", 0.7], ["fever", 0.5], ["fatigue", 0.5],
      ["hypoxia", 0.6], ["tachypnea", 0.4], ["weight loss", 0.3],
      ["night sweats", 0.3], ["chest tightness", 0.3], ["inability to exercise", 0.4]
    ]],

    // GI gaps
    ["spontaneous bacterial peritonitis", "gastrointestinal", [
      ["abdominal pain", 0.7], ["fever", 0.6], ["ascites", 0.7], ["altered mental status", 0.4],
      ["abdominal tenderness", 0.5], ["nausea", 0.3], ["diarrhea", 0.3],
      ["hypothermia", 0.3], ["ileus", 0.3], ["worsening hepatic encephalopathy", 0.3]
    ]],
    ["ischemic colitis", "gastrointestinal", [
      ["abdominal pain", 0.8], ["bloody diarrhea", 0.7], ["urgency", 0.4], ["nausea", 0.3],
      ["vomiting", 0.3], ["abdominal tenderness", 0.5], ["fever", 0.3],
      ["hematochezia", 0.6], ["cramping", 0.4], ["left sided pain", 0.5]
    ]],
    ["autoimmune hepatitis", "gastrointestinal", [
      ["fatigue", 0.7], ["jaundice", 0.5], ["abdominal pain", 0.4], ["arthralgia", 0.4],
      ["anorexia", 0.4], ["nausea", 0.3], ["hepatomegaly", 0.4], ["rash", 0.3],
      ["pruritus", 0.3], ["amenorrhea", 0.3], ["spider angiomata", 0.3]
    ]],
    ["esophageal cancer", "gastrointestinal", [
      ["progressive dysphagia", 0.8], ["weight loss", 0.7], ["odynophagia", 0.4],
      ["chest pain", 0.3], ["hoarseness", 0.3], ["cough", 0.3], ["anorexia", 0.4],
      ["hematemesis", 0.3], ["regurgitation", 0.3], ["fatigue", 0.3]
    ]],
    ["rectal prolapse", "gastrointestinal", [
      ["protruding mass from rectum", 0.8], ["fecal incontinence", 0.5], ["rectal bleeding", 0.4],
      ["mucus discharge", 0.4], ["constipation", 0.3], ["tenesmus", 0.3],
      ["discomfort on sitting", 0.3], ["incomplete evacuation", 0.4], ["anal pain", 0.3]
    ]],

    // RENAL gaps
    ["renal artery stenosis", "renal", [
      ["resistant hypertension", 0.7], ["renal bruit", 0.4], ["renal impairment", 0.5],
      ["flash pulmonary edema", 0.3], ["headache", 0.3], ["hypokalemia", 0.3],
      ["flank pain", 0.3], ["azotemia with ACE inhibitor", 0.4], ["fatigue", 0.3]
    ]],
    ["renal tubular acidosis", "renal", [
      ["metabolic acidosis", 0.7], ["hypokalemia", 0.5], ["fatigue", 0.4],
      ["muscle weakness", 0.4], ["nephrolithiasis", 0.3], ["growth retardation", 0.3],
      ["polyuria", 0.3], ["bone pain", 0.3], ["nausea", 0.3]
    ]],
    ["minimal change disease", "renal", [
      ["edema", 0.8], ["proteinuria", 0.8], ["periorbital edema", 0.6], ["ascites", 0.3],
      ["fatigue", 0.3], ["frothy urine", 0.5], ["weight gain", 0.3],
      ["pleural effusion", 0.3], ["hypoalbuminemia", 0.5]
    ]],
    ["focal segmental glomerulosclerosis", "renal", [
      ["proteinuria", 0.8], ["edema", 0.6], ["hypertension", 0.4], ["hematuria", 0.3],
      ["frothy urine", 0.4], ["fatigue", 0.3], ["weight gain", 0.3],
      ["periorbital edema", 0.3], ["renal impairment", 0.3]
    ]],
    ["membranous nephropathy", "renal", [
      ["edema", 0.7], ["proteinuria", 0.8], ["frothy urine", 0.5], ["fatigue", 0.4],
      ["weight gain", 0.3], ["hypertension", 0.3], ["periorbital edema", 0.3],
      ["ascites", 0.3], ["dyspnea", 0.3]
    ]],
    ["chronic glomerulonephritis", "renal", [
      ["hematuria", 0.6], ["proteinuria", 0.6], ["hypertension", 0.5], ["edema", 0.4],
      ["fatigue", 0.4], ["nocturia", 0.3], ["foamy urine", 0.3],
      ["weight gain", 0.3], ["nausea", 0.3], ["headache", 0.3]
    ]],

    // RESPIRATORY gaps
    ["hemothorax", "respiratory", [
      ["dyspnea", 0.8], ["chest pain", 0.7], ["decreased breath sounds", 0.6],
      ["tachycardia", 0.5], ["hypotension", 0.4], ["dullness to percussion", 0.5],
      ["tachypnea", 0.4], ["anxiety", 0.3], ["pallor", 0.3], ["diaphoresis", 0.3]
    ]],
    ["chronic respiratory failure", "respiratory", [
      ["dyspnea on exertion", 0.8], ["fatigue", 0.6], ["cyanosis", 0.4],
      ["use of accessory muscles", 0.4], ["morning headache", 0.3], ["confusion", 0.3],
      ["peripheral edema", 0.3], ["poor sleep", 0.3], ["exercise intolerance", 0.5],
      ["tachypnea", 0.4]
    ]],
    ["chylothorax", "respiratory", [
      ["dyspnea", 0.7], ["cough", 0.4], ["chest discomfort", 0.4],
      ["decreased breath sounds", 0.5], ["weight loss", 0.3], ["fatigue", 0.3],
      ["milky pleural fluid", 0.6], ["malnutrition", 0.3], ["dullness to percussion", 0.4]
    ]],
    ["sleep-disordered breathing", "respiratory", [
      ["snoring", 0.8], ["excessive daytime sleepiness", 0.7], ["witnessed apneas", 0.5],
      ["morning headache", 0.4], ["dry mouth on waking", 0.4], ["nocturia", 0.3],
      ["poor concentration", 0.3], ["irritability", 0.3], ["gasping at night", 0.4],
      ["obesity", 0.3]
    ]],

    // MUSCULOSKELETAL gaps
    ["reactive arthritis", "musculoskeletal", [
      ["joint pain", 0.8], ["conjunctivitis", 0.5], ["urethritis", 0.4],
      ["asymmetric arthritis", 0.6], ["back pain", 0.3], ["heel pain", 0.3],
      ["skin lesions", 0.3], ["dactylitis", 0.3], ["oral ulcers", 0.3],
      ["preceding infection", 0.5]
    ]],
    ["polyarteritis nodosa", "musculoskeletal", [
      ["fever", 0.6], ["weight loss", 0.5], ["myalgia", 0.5], ["arthralgia", 0.4],
      ["abdominal pain", 0.4], ["skin nodules", 0.4], ["livedo reticularis", 0.3],
      ["testicular pain", 0.3], ["hypertension", 0.3], ["peripheral neuropathy", 0.3]
    ]],
    ["Wegener granulomatosis", "musculoskeletal", [
      ["sinusitis", 0.6], ["cough", 0.4], ["hemoptysis", 0.4], ["hematuria", 0.4],
      ["saddle nose deformity", 0.3], ["epistaxis", 0.4], ["arthralgia", 0.3],
      ["fever", 0.3], ["weight loss", 0.3], ["purpura", 0.3], ["dyspnea", 0.3]
    ]],

    // PSYCHIATRIC gaps
    ["bipolar disorder manic episode", "psychiatric", [
      ["elevated mood", 0.8], ["decreased need for sleep", 0.7], ["grandiosity", 0.6],
      ["pressured speech", 0.6], ["racing thoughts", 0.5], ["distractibility", 0.4],
      ["increased activity", 0.5], ["impulsive behavior", 0.4], ["irritability", 0.4],
      ["psychomotor agitation", 0.3]
    ]],
    ["schizophrenia", "psychiatric", [
      ["auditory hallucinations", 0.7], ["delusions", 0.6], ["disorganized speech", 0.5],
      ["social withdrawal", 0.5], ["flat affect", 0.5], ["avolition", 0.4],
      ["paranoia", 0.4], ["disorganized behavior", 0.3], ["cognitive impairment", 0.3],
      ["insomnia", 0.3], ["anhedonia", 0.3]
    ]],
    ["obsessive compulsive disorder", "psychiatric", [
      ["intrusive thoughts", 0.8], ["compulsive behaviors", 0.8], ["anxiety", 0.6],
      ["repetitive actions", 0.6], ["fear of contamination", 0.4], ["checking behaviors", 0.4],
      ["distress", 0.5], ["time consuming rituals", 0.5], ["avoidance", 0.3],
      ["guilt", 0.3]
    ]],
    ["post traumatic stress disorder", "psychiatric", [
      ["flashbacks", 0.7], ["nightmares", 0.6], ["hypervigilance", 0.6],
      ["avoidance behavior", 0.5], ["insomnia", 0.5], ["irritability", 0.4],
      ["exaggerated startle response", 0.5], ["emotional numbing", 0.4],
      ["difficulty concentrating", 0.3], ["anxiety", 0.4]
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

  results.push(`✅ Deep batch 4: ${upserted} rows across ${diseases.length} diseases`);

  return new Response(JSON.stringify({ diseases_processed: diseases.length, rows_upserted: upserted, errors: results.filter(r => r.startsWith("⚠️") || r.startsWith("❌")), summary: results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
