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

  const infectious: DiseaseEntry[] = [
    ["Dengue Fever", "infectious", [
      ["high fever", 0.95], ["severe headache", 0.8], ["retro-orbital pain", 0.75],
      ["myalgia", 0.8], ["arthralgia", 0.7], ["maculopapular rash", 0.6],
      ["nausea", 0.5], ["vomiting", 0.5], ["thrombocytopenia", 0.7],
      ["petechiae", 0.4], ["fatigue", 0.6], ["loss of appetite", 0.5],
      ["abdominal pain", 0.4], ["leukopenia", 0.5]
    ]],
    ["Malaria", "infectious", [
      ["cyclical fever", 0.9], ["chills", 0.85], ["rigors", 0.8], ["diaphoresis", 0.7],
      ["headache", 0.7], ["myalgia", 0.6], ["fatigue", 0.6], ["nausea", 0.5],
      ["vomiting", 0.4], ["splenomegaly", 0.5], ["hepatomegaly", 0.4],
      ["anemia", 0.6], ["jaundice", 0.35], ["thrombocytopenia", 0.5]
    ]],
    ["Typhoid Fever", "infectious", [
      ["step-ladder fever", 0.85], ["fever", 0.95], ["headache", 0.7],
      ["abdominal pain", 0.6], ["constipation", 0.5], ["diarrhea", 0.4],
      ["rose spots", 0.35], ["hepatosplenomegaly", 0.5], ["relative bradycardia", 0.6],
      ["malaise", 0.6], ["coated tongue", 0.4], ["loss of appetite", 0.6]
    ]],
    ["Tuberculosis", "infectious", [
      ["chronic cough", 0.9], ["hemoptysis", 0.6], ["night sweats", 0.8],
      ["weight loss", 0.8], ["fever", 0.7], ["fatigue", 0.7], ["loss of appetite", 0.6],
      ["chest pain", 0.4], ["lymphadenopathy", 0.5], ["productive cough", 0.7]
    ]],
    ["Sepsis", "infectious", [
      ["fever", 0.85], ["tachycardia", 0.9], ["tachypnea", 0.8],
      ["hypotension", 0.7], ["altered mental status", 0.6], ["chills", 0.6],
      ["oliguria", 0.5], ["warm flushed skin", 0.4], ["leukocytosis", 0.7],
      ["confusion", 0.5], ["fatigue", 0.5], ["diaphoresis", 0.4]
    ]],
    ["Influenza", "infectious", [
      ["fever", 0.9], ["cough", 0.85], ["myalgia", 0.8], ["headache", 0.7],
      ["sore throat", 0.6], ["fatigue", 0.8], ["rhinorrhea", 0.5],
      ["chills", 0.6], ["malaise", 0.7], ["body aches", 0.8], ["dry cough", 0.6]
    ]],
    ["COVID-19", "infectious", [
      ["fever", 0.8], ["cough", 0.8], ["dyspnea", 0.6], ["fatigue", 0.7],
      ["anosmia", 0.7], ["ageusia", 0.65], ["sore throat", 0.5],
      ["myalgia", 0.5], ["headache", 0.5], ["diarrhea", 0.35],
      ["chest tightness", 0.4], ["rhinorrhea", 0.4], ["chills", 0.4]
    ]],
    ["Leptospirosis", "infectious", [
      ["fever", 0.9], ["myalgia", 0.8], ["headache", 0.7], ["conjunctival suffusion", 0.7],
      ["jaundice", 0.5], ["renal failure", 0.4], ["hemorrhage", 0.35],
      ["nausea", 0.5], ["vomiting", 0.4], ["abdominal pain", 0.4],
      ["rash", 0.3], ["hepatomegaly", 0.35], ["calf tenderness", 0.6]
    ]],
    ["Meningitis", "infectious", [
      ["fever", 0.9], ["headache", 0.9], ["neck stiffness", 0.85],
      ["photophobia", 0.7], ["altered mental status", 0.6], ["nausea", 0.6],
      ["vomiting", 0.6], ["petechial rash", 0.4], ["seizure", 0.3],
      ["kernig sign", 0.5], ["brudzinski sign", 0.5], ["lethargy", 0.5]
    ]],
    ["Cellulitis", "infectious", [
      ["skin redness", 0.9], ["skin warmth", 0.85], ["swelling", 0.85],
      ["tenderness", 0.8], ["fever", 0.5], ["pain", 0.8],
      ["lymphadenopathy", 0.4], ["skin streaking", 0.35], ["malaise", 0.3]
    ]],
    ["Urinary Tract Infection", "infectious", [
      ["dysuria", 0.9], ["urinary frequency", 0.85], ["urinary urgency", 0.8],
      ["suprapubic pain", 0.6], ["hematuria", 0.4], ["cloudy urine", 0.5],
      ["foul-smelling urine", 0.45], ["fever", 0.4], ["flank pain", 0.35],
      ["nausea", 0.3], ["pelvic pain", 0.35]
    ]],
    ["Pneumocystis Pneumonia", "infectious", [
      ["progressive dyspnea", 0.9], ["dry cough", 0.8], ["fever", 0.7],
      ["hypoxia", 0.8], ["fatigue", 0.6], ["weight loss", 0.5],
      ["night sweats", 0.4], ["tachypnea", 0.6], ["chest discomfort", 0.4]
    ]],
    ["Hepatitis A", "infectious", [
      ["jaundice", 0.8], ["fatigue", 0.8], ["nausea", 0.7], ["vomiting", 0.5],
      ["abdominal pain", 0.6], ["loss of appetite", 0.7], ["fever", 0.6],
      ["dark urine", 0.7], ["clay-colored stool", 0.5], ["hepatomegaly", 0.5],
      ["pruritus", 0.35], ["malaise", 0.6]
    ]],
    ["Hepatitis B", "infectious", [
      ["jaundice", 0.7], ["fatigue", 0.8], ["nausea", 0.6], ["abdominal pain", 0.6],
      ["loss of appetite", 0.7], ["dark urine", 0.6], ["arthralgia", 0.4],
      ["fever", 0.4], ["hepatomegaly", 0.5], ["rash", 0.3], ["malaise", 0.6]
    ]],
    ["Chikungunya", "infectious", [
      ["fever", 0.9], ["severe arthralgia", 0.9], ["polyarthralgia", 0.85],
      ["rash", 0.5], ["headache", 0.6], ["myalgia", 0.6], ["fatigue", 0.6],
      ["joint swelling", 0.7], ["conjunctivitis", 0.3], ["nausea", 0.3]
    ]],
    ["Scrub Typhus", "infectious", [
      ["fever", 0.9], ["eschar", 0.7], ["headache", 0.7], ["myalgia", 0.6],
      ["lymphadenopathy", 0.6], ["rash", 0.5], ["hepatosplenomegaly", 0.4],
      ["cough", 0.3], ["confusion", 0.3], ["malaise", 0.5]
    ]],
  ];

  const endocrinology: DiseaseEntry[] = [
    ["Type 2 Diabetes Mellitus", "endocrinology", [
      ["polyuria", 0.8], ["polydipsia", 0.8], ["polyphagia", 0.6],
      ["weight loss", 0.5], ["fatigue", 0.7], ["blurred vision", 0.5],
      ["recurrent infections", 0.4], ["slow wound healing", 0.5],
      ["numbness in feet", 0.5], ["tingling in hands", 0.4], ["acanthosis nigricans", 0.35]
    ]],
    ["Type 1 Diabetes Mellitus", "endocrinology", [
      ["polyuria", 0.9], ["polydipsia", 0.9], ["polyphagia", 0.7],
      ["weight loss", 0.8], ["fatigue", 0.7], ["blurred vision", 0.4],
      ["nausea", 0.4], ["vomiting", 0.35], ["abdominal pain", 0.3],
      ["fruity breath odor", 0.5], ["rapid onset", 0.7]
    ]],
    ["Diabetic Ketoacidosis", "endocrinology", [
      ["nausea", 0.8], ["vomiting", 0.8], ["abdominal pain", 0.7],
      ["fruity breath odor", 0.75], ["kussmaul breathing", 0.7],
      ["polyuria", 0.7], ["polydipsia", 0.7], ["altered mental status", 0.5],
      ["dehydration", 0.8], ["tachycardia", 0.6], ["fatigue", 0.6], ["weakness", 0.5]
    ]],
    ["Hypothyroidism", "endocrinology", [
      ["fatigue", 0.9], ["weight gain", 0.8], ["cold intolerance", 0.8],
      ["constipation", 0.7], ["dry skin", 0.7], ["hair loss", 0.6],
      ["depression", 0.5], ["bradycardia", 0.5], ["hoarseness", 0.4],
      ["menorrhagia", 0.4], ["myalgia", 0.4], ["facial puffiness", 0.5],
      ["cognitive slowing", 0.4], ["peripheral edema", 0.35]
    ]],
    ["Hyperthyroidism", "endocrinology", [
      ["weight loss", 0.85], ["heat intolerance", 0.8], ["palpitations", 0.8],
      ["tremor", 0.75], ["tachycardia", 0.8], ["anxiety", 0.7],
      ["diarrhea", 0.5], ["diaphoresis", 0.6], ["exophthalmos", 0.4],
      ["goiter", 0.5], ["fatigue", 0.5], ["muscle weakness", 0.4],
      ["insomnia", 0.5], ["menstrual irregularity", 0.4]
    ]],
    ["Cushing Syndrome", "endocrinology", [
      ["weight gain", 0.85], ["moon face", 0.8], ["central obesity", 0.8],
      ["purple striae", 0.7], ["easy bruising", 0.6], ["hypertension", 0.6],
      ["muscle weakness", 0.6], ["hirsutism", 0.5], ["acne", 0.4],
      ["depression", 0.4], ["hyperglycemia", 0.5], ["buffalo hump", 0.6],
      ["osteoporosis", 0.3], ["menstrual irregularity", 0.4]
    ]],
    ["Addison Disease", "endocrinology", [
      ["fatigue", 0.9], ["hyperpigmentation", 0.8], ["weight loss", 0.7],
      ["hypotension", 0.7], ["nausea", 0.6], ["vomiting", 0.5],
      ["abdominal pain", 0.5], ["salt craving", 0.6], ["dizziness", 0.5],
      ["muscle weakness", 0.5], ["depression", 0.3], ["orthostatic hypotension", 0.6]
    ]],
    ["Pheochromocytoma", "endocrinology", [
      ["paroxysmal hypertension", 0.85], ["headache", 0.8], ["diaphoresis", 0.8],
      ["palpitations", 0.8], ["tachycardia", 0.7], ["anxiety", 0.6],
      ["tremor", 0.5], ["pallor", 0.4], ["nausea", 0.35],
      ["weight loss", 0.3], ["chest pain", 0.3]
    ]],
    ["Hyperparathyroidism", "endocrinology", [
      ["bone pain", 0.6], ["kidney stones", 0.5], ["fatigue", 0.7],
      ["depression", 0.5], ["constipation", 0.5], ["nausea", 0.4],
      ["polyuria", 0.5], ["polydipsia", 0.4], ["abdominal pain", 0.4],
      ["muscle weakness", 0.5], ["cognitive impairment", 0.35]
    ]],
    ["Hypoglycemia", "endocrinology", [
      ["diaphoresis", 0.9], ["tremor", 0.85], ["palpitations", 0.7],
      ["anxiety", 0.7], ["hunger", 0.8], ["confusion", 0.6],
      ["dizziness", 0.7], ["weakness", 0.6], ["blurred vision", 0.5],
      ["seizure", 0.35], ["loss of consciousness", 0.3], ["irritability", 0.5]
    ]],
    ["Thyroid Storm", "endocrinology", [
      ["high fever", 0.9], ["tachycardia", 0.9], ["agitation", 0.8],
      ["delirium", 0.7], ["diaphoresis", 0.8], ["nausea", 0.6],
      ["vomiting", 0.5], ["diarrhea", 0.5], ["jaundice", 0.35],
      ["heart failure symptoms", 0.4], ["tremor", 0.7]
    ]],
    ["Myxedema Coma", "endocrinology", [
      ["hypothermia", 0.9], ["altered mental status", 0.9], ["bradycardia", 0.8],
      ["hypotension", 0.7], ["hyponatremia", 0.6], ["respiratory depression", 0.6],
      ["facial puffiness", 0.7], ["non-pitting edema", 0.6], ["seizure", 0.3]
    ]],
    ["Acromegaly", "endocrinology", [
      ["enlarged hands", 0.85], ["enlarged feet", 0.85], ["coarsened facial features", 0.8],
      ["headache", 0.6], ["visual field defect", 0.5], ["jaw prognathism", 0.7],
      ["excessive sweating", 0.6], ["arthralgia", 0.5], ["carpal tunnel syndrome", 0.4],
      ["snoring", 0.4], ["fatigue", 0.4]
    ]],
    ["PCOS", "endocrinology", [
      ["menstrual irregularity", 0.9], ["hirsutism", 0.7], ["acne", 0.6],
      ["weight gain", 0.6], ["infertility", 0.5], ["hair thinning", 0.4],
      ["acanthosis nigricans", 0.35], ["pelvic pain", 0.3], ["fatigue", 0.4]
    ]],
  ];

  const allEntries = [...infectious, ...endocrinology];
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
    batch: "infectious-endo",
    diseases_processed: allEntries.length,
    likelihoods_upserted: totalInserted,
    errors: totalErrors,
    error_details: results.slice(0, 20),
    graph_counts: { diagnoses: diagCount, symptoms: symCount, symptom_likelihoods: likCount }
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
