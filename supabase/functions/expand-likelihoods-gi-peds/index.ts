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

  const gastroenterology: DiseaseEntry[] = [
    ["Gastroesophageal Reflux Disease", "gastroenterology", [
      ["heartburn", 0.9], ["acid regurgitation", 0.85], ["dysphagia", 0.4],
      ["chest pain", 0.5], ["chronic cough", 0.35], ["hoarseness", 0.3],
      ["epigastric pain", 0.6], ["nausea", 0.4], ["belching", 0.5],
      ["globus sensation", 0.3], ["sore throat", 0.3]
    ]],
    ["Peptic Ulcer Disease", "gastroenterology", [
      ["epigastric pain", 0.9], ["burning epigastric pain", 0.85], ["abdominal pain", 0.8],
      ["nausea", 0.6], ["vomiting", 0.4], ["bloating", 0.5],
      ["loss of appetite", 0.5], ["weight loss", 0.35], ["melena", 0.4],
      ["hematemesis", 0.3], ["pain relief with antacids", 0.6], ["night pain", 0.5]
    ]],
    ["Acute Appendicitis", "gastroenterology", [
      ["right lower quadrant pain", 0.9], ["periumbilical pain migrating to RLQ", 0.8],
      ["nausea", 0.7], ["vomiting", 0.6], ["loss of appetite", 0.7],
      ["fever", 0.6], ["rebound tenderness", 0.7], ["guarding", 0.6],
      ["rovsing sign", 0.4], ["psoas sign", 0.35], ["diarrhea", 0.3]
    ]],
    ["Acute Pancreatitis", "gastroenterology", [
      ["severe epigastric pain", 0.9], ["pain radiating to back", 0.8],
      ["nausea", 0.8], ["vomiting", 0.8], ["abdominal tenderness", 0.7],
      ["fever", 0.5], ["tachycardia", 0.5], ["abdominal distension", 0.4],
      ["jaundice", 0.3], ["cullen sign", 0.3], ["grey turner sign", 0.3]
    ]],
    ["Cholecystitis", "gastroenterology", [
      ["right upper quadrant pain", 0.9], ["murphy sign", 0.8],
      ["nausea", 0.7], ["vomiting", 0.6], ["fever", 0.6],
      ["pain after fatty food", 0.7], ["referred shoulder pain", 0.4],
      ["abdominal tenderness", 0.7], ["jaundice", 0.3], ["bloating", 0.4]
    ]],
    ["Choledocholithiasis", "gastroenterology", [
      ["right upper quadrant pain", 0.85], ["jaundice", 0.8],
      ["dark urine", 0.7], ["clay-colored stool", 0.6], ["fever", 0.4],
      ["nausea", 0.5], ["vomiting", 0.4], ["pruritus", 0.4],
      ["epigastric pain", 0.5]
    ]],
    ["Acute Cholangitis", "gastroenterology", [
      ["fever", 0.9], ["jaundice", 0.85], ["right upper quadrant pain", 0.85],
      ["chills", 0.7], ["hypotension", 0.4], ["altered mental status", 0.35],
      ["nausea", 0.5], ["vomiting", 0.4], ["tachycardia", 0.5]
    ]],
    ["Inflammatory Bowel Disease", "gastroenterology", [
      ["chronic diarrhea", 0.9], ["bloody diarrhea", 0.7], ["abdominal pain", 0.8],
      ["weight loss", 0.6], ["fatigue", 0.6], ["fever", 0.4],
      ["rectal bleeding", 0.6], ["tenesmus", 0.5], ["urgency", 0.5],
      ["arthralgia", 0.3], ["loss of appetite", 0.5], ["abdominal cramping", 0.7]
    ]],
    ["Crohn Disease", "gastroenterology", [
      ["abdominal pain", 0.85], ["chronic diarrhea", 0.8], ["weight loss", 0.7],
      ["fatigue", 0.6], ["fever", 0.4], ["perianal disease", 0.5],
      ["fistula", 0.35], ["bloody stool", 0.5], ["mouth ulcers", 0.3],
      ["abdominal mass", 0.3], ["malnutrition", 0.4], ["arthralgia", 0.35]
    ]],
    ["Ulcerative Colitis", "gastroenterology", [
      ["bloody diarrhea", 0.9], ["rectal bleeding", 0.85], ["abdominal cramping", 0.7],
      ["urgency", 0.7], ["tenesmus", 0.6], ["mucus in stool", 0.5],
      ["weight loss", 0.5], ["fatigue", 0.5], ["fever", 0.35], ["arthralgia", 0.3]
    ]],
    ["Irritable Bowel Syndrome", "gastroenterology", [
      ["abdominal pain", 0.9], ["altered bowel habits", 0.85], ["bloating", 0.8],
      ["abdominal cramping", 0.7], ["mucus in stool", 0.4], ["constipation", 0.5],
      ["diarrhea", 0.5], ["flatulence", 0.6], ["abdominal distension", 0.5],
      ["nausea", 0.3], ["fatigue", 0.3]
    ]],
    ["Celiac Disease", "gastroenterology", [
      ["chronic diarrhea", 0.7], ["bloating", 0.7], ["abdominal pain", 0.6],
      ["weight loss", 0.6], ["fatigue", 0.7], ["iron deficiency anemia", 0.6],
      ["malabsorption", 0.5], ["steatorrhea", 0.4], ["dermatitis herpetiformis", 0.35],
      ["growth failure", 0.3], ["osteoporosis", 0.3], ["mouth ulcers", 0.3]
    ]],
    ["Gastroenteritis", "gastroenterology", [
      ["diarrhea", 0.9], ["nausea", 0.85], ["vomiting", 0.8],
      ["abdominal cramping", 0.8], ["fever", 0.5], ["dehydration", 0.6],
      ["loss of appetite", 0.6], ["malaise", 0.4], ["myalgia", 0.3],
      ["headache", 0.3], ["abdominal pain", 0.7]
    ]],
    ["Hepatic Cirrhosis", "gastroenterology", [
      ["jaundice", 0.7], ["ascites", 0.7], ["spider angioma", 0.5],
      ["palmar erythema", 0.5], ["fatigue", 0.8], ["weight loss", 0.5],
      ["peripheral edema", 0.6], ["hepatomegaly", 0.5], ["splenomegaly", 0.5],
      ["gynecomastia", 0.3], ["easy bruising", 0.5], ["confusion", 0.4],
      ["pruritus", 0.35], ["abdominal distension", 0.6]
    ]],
    ["Acute Gastritis", "gastroenterology", [
      ["epigastric pain", 0.9], ["nausea", 0.8], ["vomiting", 0.6],
      ["loss of appetite", 0.6], ["bloating", 0.5], ["belching", 0.4],
      ["hematemesis", 0.3], ["abdominal tenderness", 0.5], ["dyspepsia", 0.7]
    ]],
    ["Small Bowel Obstruction", "gastroenterology", [
      ["abdominal pain", 0.9], ["vomiting", 0.85], ["abdominal distension", 0.8],
      ["constipation", 0.7], ["obstipation", 0.6], ["nausea", 0.8],
      ["high-pitched bowel sounds", 0.6], ["dehydration", 0.5],
      ["tachycardia", 0.4], ["fever", 0.3]
    ]],
    ["Diverticulitis", "gastroenterology", [
      ["left lower quadrant pain", 0.9], ["fever", 0.6], ["nausea", 0.5],
      ["change in bowel habits", 0.5], ["abdominal tenderness", 0.7],
      ["constipation", 0.4], ["diarrhea", 0.3], ["rectal bleeding", 0.3],
      ["loss of appetite", 0.4], ["bloating", 0.35]
    ]],
    ["GI Bleed Upper", "gastroenterology", [
      ["hematemesis", 0.85], ["melena", 0.8], ["epigastric pain", 0.5],
      ["dizziness", 0.6], ["syncope", 0.4], ["tachycardia", 0.6],
      ["hypotension", 0.5], ["fatigue", 0.5], ["pallor", 0.6],
      ["coffee ground vomiting", 0.7], ["weakness", 0.5]
    ]],
  ];

  const pediatrics: DiseaseEntry[] = [
    ["Bronchiolitis", "pediatrics", [
      ["cough", 0.9], ["wheezing", 0.85], ["tachypnea", 0.8],
      ["rhinorrhea", 0.8], ["fever", 0.5], ["poor feeding", 0.7],
      ["nasal flaring", 0.5], ["chest retractions", 0.6], ["irritability", 0.5],
      ["apnea", 0.3], ["cyanosis", 0.3], ["crackles on auscultation", 0.6]
    ]],
    ["Pediatric Pneumonia", "pediatrics", [
      ["cough", 0.9], ["fever", 0.85], ["tachypnea", 0.8],
      ["dyspnea", 0.7], ["chest retractions", 0.6], ["nasal flaring", 0.5],
      ["poor feeding", 0.5], ["grunting", 0.4], ["crackles on auscultation", 0.7],
      ["lethargy", 0.4], ["vomiting", 0.3], ["abdominal pain", 0.3]
    ]],
    ["Kawasaki Disease", "pediatrics", [
      ["high fever persisting 5 days", 0.95], ["bilateral conjunctival injection", 0.8],
      ["oral mucosal changes", 0.75], ["strawberry tongue", 0.7],
      ["cervical lymphadenopathy", 0.7], ["polymorphous rash", 0.8],
      ["extremity changes", 0.7], ["irritability", 0.7], ["peeling skin", 0.6],
      ["arthralgia", 0.4], ["abdominal pain", 0.3], ["diarrhea", 0.3]
    ]],
    ["Measles", "pediatrics", [
      ["fever", 0.95], ["maculopapular rash", 0.9], ["cough", 0.8],
      ["coryza", 0.8], ["conjunctivitis", 0.7], ["koplik spots", 0.7],
      ["malaise", 0.6], ["photophobia", 0.4], ["lymphadenopathy", 0.3],
      ["diarrhea", 0.3], ["high fever", 0.8]
    ]],
    ["Mumps", "pediatrics", [
      ["parotid swelling", 0.9], ["parotid tenderness", 0.85], ["fever", 0.7],
      ["headache", 0.5], ["myalgia", 0.5], ["loss of appetite", 0.6],
      ["jaw pain with chewing", 0.7], ["malaise", 0.5], ["earache", 0.4],
      ["orchitis", 0.3]
    ]],
    ["Rubella", "pediatrics", [
      ["maculopapular rash", 0.85], ["low-grade fever", 0.7],
      ["lymphadenopathy", 0.8], ["posterior auricular lymphadenopathy", 0.75],
      ["arthralgia", 0.5], ["conjunctivitis", 0.4], ["malaise", 0.4],
      ["coryza", 0.4], ["headache", 0.3], ["sore throat", 0.3]
    ]],
    ["Otitis Media", "pediatrics", [
      ["ear pain", 0.9], ["fever", 0.6], ["irritability", 0.7],
      ["ear tugging", 0.6], ["hearing loss", 0.5], ["ear discharge", 0.4],
      ["poor feeding", 0.4], ["sleep disturbance", 0.5], ["crying", 0.6],
      ["rhinorrhea", 0.5], ["cough", 0.3]
    ]],
    ["Croup", "pediatrics", [
      ["barking cough", 0.9], ["stridor", 0.85], ["hoarseness", 0.8],
      ["fever", 0.5], ["rhinorrhea", 0.5], ["respiratory distress", 0.5],
      ["worse at night", 0.7], ["chest retractions", 0.4], ["tachypnea", 0.35]
    ]],
    ["Hand Foot and Mouth Disease", "pediatrics", [
      ["fever", 0.8], ["oral vesicles", 0.9], ["hand vesicles", 0.85],
      ["foot vesicles", 0.85], ["sore throat", 0.6], ["poor feeding", 0.6],
      ["malaise", 0.5], ["irritability", 0.5], ["drooling", 0.4],
      ["rash on buttocks", 0.4]
    ]],
    ["Febrile Seizure", "pediatrics", [
      ["seizure", 0.95], ["fever", 0.95], ["postictal drowsiness", 0.8],
      ["loss of consciousness", 0.7], ["tonic-clonic movements", 0.7],
      ["irritability", 0.5], ["crying", 0.4], ["vomiting", 0.3]
    ]],
    ["Intussusception", "pediatrics", [
      ["intermittent abdominal pain", 0.9], ["drawing up legs", 0.8],
      ["vomiting", 0.7], ["currant jelly stool", 0.6], ["abdominal mass", 0.5],
      ["bloody stool", 0.5], ["lethargy", 0.5], ["pallor", 0.4],
      ["inconsolable crying", 0.7], ["fever", 0.3]
    ]],
    ["Pyloric Stenosis", "pediatrics", [
      ["projectile vomiting", 0.9], ["non-bilious vomiting", 0.85],
      ["olive-shaped mass", 0.6], ["dehydration", 0.7], ["weight loss", 0.6],
      ["hunger after vomiting", 0.7], ["visible peristalsis", 0.5],
      ["failure to thrive", 0.5], ["metabolic alkalosis", 0.5]
    ]],
    ["Acute Rheumatic Fever", "pediatrics", [
      ["migratory polyarthritis", 0.8], ["carditis", 0.7], ["fever", 0.7],
      ["chorea", 0.4], ["erythema marginatum", 0.3], ["subcutaneous nodules", 0.3],
      ["arthralgia", 0.7], ["elevated ESR", 0.6], ["sore throat history", 0.6],
      ["heart murmur", 0.5], ["malaise", 0.4]
    ]],
    ["Chickenpox", "pediatrics", [
      ["vesicular rash", 0.95], ["pruritic rash", 0.9], ["fever", 0.7],
      ["rash in different stages", 0.85], ["malaise", 0.5],
      ["loss of appetite", 0.5], ["headache", 0.3], ["fatigue", 0.4]
    ]],
    ["Scarlet Fever", "pediatrics", [
      ["sandpaper rash", 0.9], ["fever", 0.85], ["sore throat", 0.85],
      ["strawberry tongue", 0.7], ["flushed cheeks", 0.6],
      ["circumoral pallor", 0.5], ["pastia lines", 0.4], ["headache", 0.4],
      ["nausea", 0.3], ["vomiting", 0.3], ["lymphadenopathy", 0.4]
    ]],
  ];

  const allEntries = [...gastroenterology, ...pediatrics];
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
    batch: "gi-peds",
    diseases_processed: allEntries.length,
    likelihoods_upserted: totalInserted,
    errors: totalErrors,
    error_details: results.slice(0, 20),
    graph_counts: { diagnoses: diagCount, symptoms: symCount, symptom_likelihoods: likCount }
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
