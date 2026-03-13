import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const results: string[] = [];

  async function getOrCreateSymptom(name: string, category = "general"): Promise<string | null> {
    const { data } = await supabase.from("symptoms").select("id").ilike("symptom_name", name).limit(1);
    if (data?.length) return data[0].id;
    const { data: ins, error } = await supabase.from("symptoms").insert({ symptom_name: name, category }).select("id").single();
    if (error) { results.push(`Symptom err: ${name}: ${error.message}`); return null; }
    return ins?.id || null;
  }

  async function getOrCreateDiagnosis(name: string, category: string): Promise<string | null> {
    const { data } = await supabase.from("diagnoses").select("id").ilike("diagnosis_name", name).limit(1);
    if (data?.length) return data[0].id;
    const { data: ins, error } = await supabase.from("diagnoses").insert({ diagnosis_name: name, category }).select("id").single();
    if (error) { results.push(`Diag err: ${name}: ${error.message}`); return null; }
    return ins?.id || null;
  }

  type DiseaseEntry = [string, string, [string, number][]];

  const neurology: DiseaseEntry[] = [
    ["Migraine", "neurology", [
      ["unilateral headache", 0.85], ["throbbing headache", 0.8], ["photophobia", 0.8],
      ["phonophobia", 0.75], ["nausea", 0.75], ["vomiting", 0.5],
      ["aura", 0.35], ["visual disturbance", 0.4], ["fatigue", 0.4],
      ["scalp tenderness", 0.3], ["neck stiffness", 0.3]
    ]],
    ["Tension Headache", "neurology", [
      ["bilateral headache", 0.9], ["band-like headache", 0.85], ["pressure headache", 0.8],
      ["neck tension", 0.6], ["scalp tenderness", 0.4], ["fatigue", 0.4],
      ["difficulty concentrating", 0.35], ["mild photophobia", 0.3]
    ]],
    ["Cluster Headache", "neurology", [
      ["severe unilateral headache", 0.9], ["periorbital pain", 0.85],
      ["lacrimation", 0.8], ["conjunctival injection", 0.75], ["nasal congestion", 0.7],
      ["rhinorrhea", 0.6], ["ptosis", 0.5], ["miosis", 0.45],
      ["restlessness", 0.7], ["forehead sweating", 0.4]
    ]],
    ["Subarachnoid Hemorrhage", "neurology", [
      ["thunderclap headache", 0.9], ["worst headache of life", 0.9],
      ["neck stiffness", 0.75], ["photophobia", 0.6], ["nausea", 0.7],
      ["vomiting", 0.7], ["altered mental status", 0.5], ["seizure", 0.3],
      ["loss of consciousness", 0.4], ["focal neurological deficit", 0.35]
    ]],
    ["Ischemic Stroke", "neurology", [
      ["sudden weakness", 0.85], ["facial droop", 0.8], ["arm weakness", 0.8],
      ["speech difficulty", 0.75], ["slurred speech", 0.7], ["visual loss", 0.4],
      ["dizziness", 0.5], ["ataxia", 0.4], ["confusion", 0.5],
      ["headache", 0.35], ["numbness", 0.6], ["hemiparesis", 0.8]
    ]],
    ["Hemorrhagic Stroke", "neurology", [
      ["sudden severe headache", 0.85], ["vomiting", 0.7], ["altered mental status", 0.7],
      ["hemiparesis", 0.7], ["seizure", 0.4], ["neck stiffness", 0.4],
      ["hypertension", 0.6], ["visual disturbance", 0.4], ["speech difficulty", 0.5],
      ["confusion", 0.5]
    ]],
    ["Transient Ischemic Attack", "neurology", [
      ["sudden weakness", 0.8], ["speech difficulty", 0.7], ["visual loss", 0.5],
      ["numbness", 0.6], ["dizziness", 0.5], ["ataxia", 0.35],
      ["facial droop", 0.6], ["arm weakness", 0.6], ["confusion", 0.4],
      ["resolution within 24 hours", 0.9]
    ]],
    ["Epilepsy", "neurology", [
      ["seizure", 0.95], ["loss of consciousness", 0.7], ["tonic-clonic movements", 0.7],
      ["aura", 0.4], ["confusion", 0.5], ["postictal drowsiness", 0.7],
      ["tongue biting", 0.4], ["urinary incontinence", 0.35],
      ["automatisms", 0.3], ["staring spells", 0.4]
    ]],
    ["Parkinson Disease", "neurology", [
      ["resting tremor", 0.85], ["bradykinesia", 0.9], ["rigidity", 0.8],
      ["postural instability", 0.6], ["shuffling gait", 0.7], ["masked facies", 0.6],
      ["micrographia", 0.5], ["stooped posture", 0.5], ["constipation", 0.4],
      ["anosmia", 0.4], ["sleep disturbance", 0.4], ["depression", 0.35]
    ]],
    ["Multiple Sclerosis", "neurology", [
      ["visual disturbance", 0.7], ["optic neuritis", 0.65], ["numbness", 0.7],
      ["tingling", 0.7], ["weakness", 0.65], ["fatigue", 0.8],
      ["ataxia", 0.5], ["lhermitte sign", 0.4], ["urinary urgency", 0.4],
      ["diplopia", 0.4], ["vertigo", 0.35], ["cognitive impairment", 0.35],
      ["spasticity", 0.4]
    ]],
    ["Guillain-Barre Syndrome", "neurology", [
      ["ascending weakness", 0.9], ["areflexia", 0.85], ["tingling in extremities", 0.8],
      ["symmetric weakness", 0.8], ["back pain", 0.5], ["respiratory difficulty", 0.4],
      ["facial weakness", 0.4], ["dysphagia", 0.3], ["autonomic dysfunction", 0.35],
      ["recent viral illness", 0.5]
    ]],
    ["Bell Palsy", "neurology", [
      ["unilateral facial weakness", 0.95], ["inability to close eye", 0.85],
      ["facial droop", 0.9], ["loss of taste", 0.5], ["ear pain", 0.4],
      ["hyperacusis", 0.35], ["drooling", 0.5], ["difficulty eating", 0.4],
      ["tearing", 0.3]
    ]],
    ["Trigeminal Neuralgia", "neurology", [
      ["sharp facial pain", 0.9], ["unilateral facial pain", 0.9],
      ["electric shock-like pain", 0.85], ["triggered by touch", 0.7],
      ["triggered by chewing", 0.6], ["brief episodes", 0.8],
      ["pain along trigeminal nerve", 0.7], ["grimacing", 0.4]
    ]],
    ["Meningitis", "neurology", [
      ["fever", 0.9], ["headache", 0.9], ["neck stiffness", 0.85],
      ["photophobia", 0.7], ["altered mental status", 0.6], ["nausea", 0.6],
      ["vomiting", 0.6], ["petechial rash", 0.4], ["seizure", 0.3],
      ["kernig sign", 0.5], ["brudzinski sign", 0.5], ["lethargy", 0.5]
    ]],
    ["Encephalitis", "neurology", [
      ["fever", 0.8], ["altered mental status", 0.85], ["seizure", 0.6],
      ["headache", 0.7], ["confusion", 0.8], ["personality change", 0.5],
      ["focal neurological deficit", 0.4], ["speech difficulty", 0.4],
      ["movement disorders", 0.3], ["lethargy", 0.6]
    ]],
    ["Benign Positional Vertigo", "neurology", [
      ["vertigo", 0.95], ["positional vertigo", 0.9], ["nystagmus", 0.8],
      ["nausea", 0.7], ["vomiting", 0.4], ["dizziness", 0.8],
      ["unsteadiness", 0.6], ["triggered by head position", 0.85]
    ]],
    ["Myasthenia Gravis", "neurology", [
      ["ptosis", 0.85], ["diplopia", 0.8], ["muscle weakness", 0.85],
      ["fatigable weakness", 0.9], ["dysphagia", 0.5], ["dysarthria", 0.4],
      ["respiratory weakness", 0.35], ["proximal limb weakness", 0.5],
      ["facial weakness", 0.4], ["neck weakness", 0.4]
    ]],
  ];

  const general: DiseaseEntry[] = [
    ["Anemia", "hematology", [
      ["fatigue", 0.9], ["pallor", 0.8], ["dyspnea on exertion", 0.7],
      ["dizziness", 0.6], ["tachycardia", 0.6], ["weakness", 0.7],
      ["headache", 0.4], ["cold extremities", 0.4], ["pica", 0.3],
      ["koilonychia", 0.3], ["brittle nails", 0.35], ["glossitis", 0.3]
    ]],
    ["Iron Deficiency Anemia", "hematology", [
      ["fatigue", 0.9], ["pallor", 0.8], ["pica", 0.5], ["koilonychia", 0.4],
      ["glossitis", 0.4], ["angular cheilitis", 0.35], ["brittle nails", 0.4],
      ["dyspnea on exertion", 0.7], ["dizziness", 0.5], ["headache", 0.4],
      ["tachycardia", 0.5], ["restless legs", 0.3]
    ]],
    ["Acute Kidney Injury", "nephrology", [
      ["oliguria", 0.8], ["edema", 0.7], ["nausea", 0.6], ["fatigue", 0.6],
      ["confusion", 0.4], ["dyspnea", 0.4], ["elevated creatinine", 0.9],
      ["hyperkalemia", 0.5], ["metabolic acidosis", 0.4], ["flank pain", 0.3]
    ]],
    ["Chronic Kidney Disease", "nephrology", [
      ["fatigue", 0.8], ["edema", 0.7], ["nausea", 0.5], ["loss of appetite", 0.6],
      ["pruritus", 0.5], ["muscle cramps", 0.4], ["nocturia", 0.5],
      ["hypertension", 0.6], ["anemia", 0.5], ["bone pain", 0.3],
      ["cognitive impairment", 0.3], ["peripheral neuropathy", 0.3]
    ]],
    ["Nephrotic Syndrome", "nephrology", [
      ["generalized edema", 0.9], ["periorbital edema", 0.8], ["proteinuria", 0.95],
      ["hypoalbuminemia", 0.85], ["hyperlipidemia", 0.6], ["weight gain", 0.6],
      ["fatigue", 0.5], ["foamy urine", 0.7], ["ascites", 0.4], ["pleural effusion", 0.3]
    ]],
    ["Pyelonephritis", "nephrology", [
      ["flank pain", 0.9], ["fever", 0.85], ["costovertebral angle tenderness", 0.8],
      ["dysuria", 0.6], ["urinary frequency", 0.5], ["nausea", 0.6],
      ["vomiting", 0.5], ["chills", 0.6], ["hematuria", 0.35],
      ["malaise", 0.4], ["tachycardia", 0.35]
    ]],
    ["Rheumatoid Arthritis", "rheumatology", [
      ["symmetric joint pain", 0.85], ["morning stiffness", 0.85],
      ["joint swelling", 0.8], ["joint tenderness", 0.8], ["fatigue", 0.7],
      ["metacarpophalangeal joint involvement", 0.7], ["rheumatoid nodules", 0.3],
      ["malaise", 0.4], ["low-grade fever", 0.3], ["hand stiffness", 0.7],
      ["swan neck deformity", 0.3], ["boutonniere deformity", 0.3]
    ]],
    ["Gout", "rheumatology", [
      ["acute joint pain", 0.9], ["first metatarsophalangeal joint pain", 0.8],
      ["joint swelling", 0.85], ["joint redness", 0.8], ["warmth", 0.7],
      ["tenderness", 0.85], ["fever", 0.3], ["tophi", 0.35],
      ["exquisite tenderness", 0.8], ["inability to bear weight", 0.6]
    ]],
    ["Systemic Lupus Erythematosus", "rheumatology", [
      ["malar rash", 0.8], ["butterfly rash", 0.75], ["arthralgia", 0.85],
      ["fatigue", 0.9], ["photosensitivity", 0.7], ["oral ulcers", 0.4],
      ["fever", 0.5], ["hair loss", 0.5], ["pleurisy", 0.35],
      ["raynaud phenomenon", 0.35], ["nephritis", 0.35], ["joint swelling", 0.6]
    ]],
    ["Fibromyalgia", "rheumatology", [
      ["widespread pain", 0.9], ["fatigue", 0.9], ["sleep disturbance", 0.8],
      ["cognitive impairment", 0.6], ["tender points", 0.7], ["headache", 0.5],
      ["depression", 0.5], ["anxiety", 0.4], ["irritable bowel symptoms", 0.4],
      ["morning stiffness", 0.5], ["numbness", 0.3], ["tingling", 0.3]
    ]],
    ["Deep Vein Thrombosis", "hematology", [
      ["calf swelling", 0.85], ["leg pain", 0.8], ["unilateral leg edema", 0.9],
      ["warmth in leg", 0.7], ["redness in leg", 0.6], ["tenderness", 0.7],
      ["positive homan sign", 0.4], ["pain on dorsiflexion", 0.5]
    ]],
    ["Sickle Cell Crisis", "hematology", [
      ["severe bone pain", 0.9], ["joint pain", 0.7], ["chest pain", 0.5],
      ["abdominal pain", 0.5], ["fever", 0.4], ["fatigue", 0.6],
      ["jaundice", 0.5], ["pallor", 0.5], ["swollen hands and feet", 0.4],
      ["priapism", 0.3], ["splenic sequestration", 0.3]
    ]],
    ["Lymphoma", "hematology", [
      ["painless lymphadenopathy", 0.9], ["night sweats", 0.7], ["weight loss", 0.7],
      ["fever", 0.5], ["fatigue", 0.7], ["pruritus", 0.4],
      ["splenomegaly", 0.4], ["hepatomegaly", 0.3], ["cough", 0.3],
      ["dyspnea", 0.3]
    ]],
    ["Allergic Rhinitis", "general", [
      ["sneezing", 0.9], ["rhinorrhea", 0.9], ["nasal congestion", 0.85],
      ["nasal itching", 0.8], ["watery eyes", 0.7], ["itchy eyes", 0.7],
      ["postnasal drip", 0.5], ["headache", 0.3], ["fatigue", 0.3],
      ["cough", 0.3]
    ]],
    ["Acute Sinusitis", "general", [
      ["facial pain", 0.85], ["nasal congestion", 0.85], ["purulent nasal discharge", 0.8],
      ["headache", 0.7], ["facial pressure", 0.7], ["fever", 0.4],
      ["cough", 0.4], ["postnasal drip", 0.5], ["anosmia", 0.4],
      ["tooth pain", 0.3], ["fatigue", 0.3]
    ]],
    ["Pharyngitis", "general", [
      ["sore throat", 0.95], ["odynophagia", 0.85], ["fever", 0.6],
      ["tonsillar exudates", 0.5], ["cervical lymphadenopathy", 0.6],
      ["headache", 0.4], ["malaise", 0.4], ["cough", 0.3],
      ["rhinorrhea", 0.3], ["abdominal pain", 0.3]
    ]],
    ["Dermatitis", "dermatology", [
      ["pruritus", 0.9], ["erythema", 0.85], ["scaling", 0.6],
      ["vesicles", 0.4], ["oozing", 0.35], ["lichenification", 0.35],
      ["dry skin", 0.6], ["skin thickening", 0.4], ["excoriation", 0.5]
    ]],
    ["Psoriasis", "dermatology", [
      ["silvery scales", 0.9], ["erythematous plaques", 0.85], ["pruritus", 0.6],
      ["nail pitting", 0.5], ["scalp involvement", 0.6], ["joint pain", 0.35],
      ["dry skin", 0.4], ["skin fissures", 0.3], ["koebner phenomenon", 0.4]
    ]],
    ["Urticaria", "dermatology", [
      ["wheals", 0.95], ["pruritus", 0.9], ["erythema", 0.8],
      ["angioedema", 0.4], ["swelling", 0.4], ["skin warmth", 0.3],
      ["transient lesions", 0.7], ["dermatographism", 0.4]
    ]],
  ];

  const allEntries = [...neurology, ...general];
  let totalInserted = 0;
  let totalErrors = 0;

  for (const [diseaseName, category, symptoms] of allEntries) {
    const diagId = await getOrCreateDiagnosis(diseaseName, category);
    if (!diagId) { totalErrors++; continue; }

    const rows: { symptom_id: string; diagnosis_id: string; likelihood_value: number }[] = [];
    for (const [symptomName, likelihood] of symptoms) {
      if (likelihood < 0.3) continue;
      const symId = await getOrCreateSymptom(symptomName, category);
      if (!symId) continue;
      rows.push({ symptom_id: symId, diagnosis_id: diagId, likelihood_value: likelihood });
    }

    if (rows.length > 0) {
      const { error } = await supabase.from("symptom_likelihoods")
        .upsert(rows, { onConflict: "symptom_id,diagnosis_id", ignoreDuplicates: false });
      if (error) { results.push(`Upsert err ${diseaseName}: ${error.message}`); totalErrors++; }
      else totalInserted += rows.length;
    }
  }

  const { count: likCount } = await supabase.from("symptom_likelihoods").select("*", { count: "exact", head: true });
  const { count: symCount } = await supabase.from("symptoms").select("*", { count: "exact", head: true });
  const { count: diagCount } = await supabase.from("diagnoses").select("*", { count: "exact", head: true });

  return new Response(JSON.stringify({
    batch: "neuro-general",
    diseases_processed: allEntries.length,
    likelihoods_upserted: totalInserted,
    errors: totalErrors,
    error_details: results.slice(0, 20),
    graph_counts: { diagnoses: diagCount, symptoms: symCount, symptom_likelihoods: likCount }
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
