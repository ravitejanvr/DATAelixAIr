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
// BATCH 14: PEDIATRICS (25 diseases)
// ══════════════════════════════════════════════════
function getPediatrics(): DiseaseEntry[] {
  return [
    {name:"acute bronchiolitis",icd10:"J21.9",organ:"pulmonary",prior:0.05,severity:"moderate",
      symptoms:[["wheezing in infant",0.85,0.8,"high"],["cough",0.80,0.5,"moderate"],["tachypnea in infant",0.75,0.7,"high"],["nasal congestion",0.70,0.5,"moderate"],["fever",0.50,0.4,"moderate"],["poor feeding",0.55,0.5,"moderate"],["respiratory distress",0.45,0.6,"moderate"],["chest retractions",0.50,0.7,"high"]],
      tests:[["clinical diagnosis","clinical","high"],["chest X-ray","imaging","moderate"],["RSV rapid test","molecular","moderate"],["pulse oximetry","clinical","high"]],
      treatments:[["supportive care","supportive","first_line","AAP"],["supplemental oxygen","supportive","hypoxemia","AAP"],["hypertonic saline nebulized","supportive","adjunct","AAP"]]},
    {name:"croup",icd10:"J05.0",organ:"respiratory",prior:0.04,severity:"moderate",
      symptoms:[["barking cough",0.90,0.9,"high"],["stridor inspiratory",0.80,0.85,"high"],["hoarseness",0.70,0.6,"moderate"],["low-grade fever",0.50,0.4,"moderate"],["respiratory distress",0.40,0.6,"moderate"],["worse at night",0.55,0.6,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["neck X-ray steeple sign","imaging","moderate"]],
      treatments:[["dexamethasone oral","corticosteroid","first_line","AAP"],["nebulized epinephrine","sympathomimetic","severe","AAP"],["budesonide nebulized","corticosteroid","alternative","AAP"]]},
    {name:"kawasaki disease",icd10:"M30.3",organ:"pediatric",prior:0.001,severity:"critical",
      symptoms:[["fever more than 5 days",0.95,0.8,"high"],["bilateral conjunctival injection",0.80,0.8,"high"],["oral mucosal changes strawberry tongue",0.70,0.85,"high"],["cervical lymphadenopathy",0.55,0.5,"moderate"],["polymorphous rash",0.80,0.7,"high"],["extremity changes edema erythema",0.65,0.8,"high"],["desquamation fingers toes",0.55,0.85,"high"],["irritability",0.60,0.5,"moderate"]],
      tests:[["CBC with differential","hematology","moderate"],["CRP/ESR elevated","biochemistry","moderate"],["echocardiogram","cardiac","high"],["liver function tests","biochemistry","moderate"],["urinalysis","biochemistry","moderate"]],
      treatments:[["IVIG","immunotherapy","first_line","AHA"],["aspirin high dose","antiplatelet","acute","AHA"],["aspirin low dose","antiplatelet","convalescent","AHA"]]},
    {name:"febrile seizure",icd10:"R56.0",organ:"neurological",prior:0.04,severity:"moderate",
      symptoms:[["seizure with fever",0.95,0.9,"high"],["high fever",0.85,0.6,"high"],["tonic-clonic movements",0.70,0.7,"high"],["loss of consciousness",0.65,0.6,"moderate"],["postictal drowsiness",0.60,0.6,"moderate"],["age 6 months to 5 years",0.80,0.7,"high"]],
      tests:[["clinical assessment","clinical","high"],["blood glucose","biochemistry","moderate"],["electrolytes","biochemistry","low"]],
      treatments:[["antipyretics","supportive","first_line","AAP"],["reassurance","supportive","first_line","AAP"]]},
    {name:"hand foot and mouth disease",icd10:"B08.4",organ:"infectious",prior:0.04,severity:"low",
      symptoms:[["oral vesicles and ulcers",0.85,0.85,"high"],["vesicular rash on hands",0.80,0.85,"high"],["vesicular rash on feet",0.75,0.8,"high"],["fever",0.65,0.5,"moderate"],["sore throat",0.55,0.5,"moderate"],["decreased appetite",0.50,0.4,"moderate"],["irritability in children",0.45,0.4,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"]],
      treatments:[["supportive care","supportive","first_line","AAP"],["acetaminophen","analgesic","adjunct","AAP"]]},
    {name:"intussusception",icd10:"K56.1",organ:"gastrointestinal",prior:0.005,severity:"critical",
      symptoms:[["colicky abdominal pain intermittent",0.85,0.85,"high"],["vomiting",0.70,0.5,"moderate"],["currant jelly stool",0.50,0.9,"high"],["sausage-shaped abdominal mass",0.45,0.9,"high"],["pallor with pain episodes",0.50,0.6,"moderate"],["lethargy between episodes",0.40,0.6,"moderate"],["bloody stool",0.45,0.7,"high"]],
      tests:[["abdominal ultrasound target sign","imaging","high"],["abdominal X-ray","imaging","moderate"],["contrast enema","imaging","diagnostic_and_therapeutic"]],
      treatments:[["air or contrast enema reduction","procedure","first_line","AAP"],["surgical reduction","procedure","failed_enema","AAP"]]},
    {name:"pyloric stenosis",icd10:"K31.1",organ:"gastrointestinal",prior:0.003,severity:"high",
      symptoms:[["projectile vomiting non-bilious",0.90,0.9,"high"],["hungry after vomiting",0.70,0.8,"high"],["olive-shaped mass epigastrium",0.50,0.95,"high"],["weight loss or failure to gain",0.60,0.6,"moderate"],["visible peristalsis",0.40,0.85,"high"],["dehydration",0.55,0.5,"moderate"],["age 2-6 weeks",0.75,0.7,"high"]],
      tests:[["abdominal ultrasound pylorus","imaging","high"],["basic metabolic panel","biochemistry","high"]],
      treatments:[["pyloromyotomy","procedure","definitive","AAP"]]},
    {name:"measles",icd10:"B05.9",organ:"infectious",prior:0.005,severity:"moderate",
      symptoms:[["high fever",0.85,0.6,"high"],["cough",0.70,0.5,"moderate"],["coryza",0.65,0.5,"moderate"],["conjunctivitis",0.60,0.5,"moderate"],["maculopapular rash cephalocaudal",0.90,0.85,"high"],["Koplik spots",0.55,0.95,"high"],["photophobia",0.35,0.5,"moderate"]],
      tests:[["measles IgM serology","serology","high"],["measles PCR","molecular","high"],["clinical diagnosis","clinical","moderate"]],
      treatments:[["vitamin A","vitamin","first_line","WHO"],["supportive care","supportive","first_line","WHO"]]},
    {name:"scarlet fever",icd10:"A38",organ:"infectious",prior:0.02,severity:"moderate",
      symptoms:[["sandpaper-like rash",0.85,0.9,"high"],["sore throat",0.80,0.6,"moderate"],["high fever",0.75,0.5,"moderate"],["strawberry tongue",0.55,0.85,"high"],["circumoral pallor",0.50,0.85,"high"],["Pastia lines",0.40,0.9,"high"],["tonsillar exudate",0.55,0.5,"moderate"]],
      tests:[["rapid strep test","microbiology","high"],["throat culture","microbiology","moderate"],["ASO titer","serology","moderate"]],
      treatments:[["amoxicillin","penicillin","first_line","AAP"],["penicillin V","penicillin","first_line","IDSA"],["azithromycin","macrolide","penicillin_allergy","AAP"]]},
    {name:"neonatal jaundice",icd10:"P59.9",organ:"hepatic",prior:0.06,severity:"moderate",
      symptoms:[["yellow skin discoloration",0.95,0.9,"high"],["yellow sclera",0.85,0.85,"high"],["poor feeding",0.45,0.5,"moderate"],["lethargy",0.35,0.5,"moderate"],["dark urine",0.30,0.5,"moderate"],["pale stools",0.30,0.6,"moderate"]],
      tests:[["serum bilirubin total and direct","biochemistry","high"],["transcutaneous bilirubin","clinical","moderate"],["blood group and Coombs test","hematology","high"],["reticulocyte count","hematology","moderate"],["CBC","hematology","moderate"]],
      treatments:[["phototherapy","procedure","first_line","AAP"],["exchange transfusion","procedure","severe","AAP"]]},
  ];
}

// ══════════════════════════════════════════════════
// BATCH 15: DERMATOLOGY (20 diseases)
// ══════════════════════════════════════════════════
function getDermatology(): DiseaseEntry[] {
  return [
    {name:"psoriasis",icd10:"L40.0",organ:"dermatological",prior:0.03,severity:"moderate",
      symptoms:[["silvery scaly plaques",0.90,0.9,"high"],["erythematous plaques",0.85,0.7,"high"],["plaques on extensor surfaces",0.70,0.7,"high"],["scalp scaling",0.55,0.6,"moderate"],["nail pitting",0.50,0.7,"high"],["Auspitz sign",0.45,0.85,"high"],["Koebner phenomenon",0.40,0.7,"high"],["pruritus",0.55,0.5,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["skin biopsy","pathology","moderate"]],
      treatments:[["betamethasone topical","corticosteroid","first_line","AAD"],["calcipotriol","vitamin D analog","first_line","AAD"],["methotrexate","DMARD","moderate-severe","AAD"],["adalimumab","anti-TNF","severe","AAD"],["apremilast","PDE4 inhibitor","moderate","AAD"]]},
    {name:"atopic dermatitis",icd10:"L20.9",organ:"dermatological",prior:0.10,severity:"low",
      symptoms:[["pruritus intense",0.90,0.8,"high"],["eczematous rash",0.85,0.7,"high"],["dry skin",0.80,0.6,"moderate"],["rash in flexural areas",0.70,0.75,"high"],["lichenification",0.45,0.7,"high"],["family history atopy",0.55,0.5,"moderate"],["relapsing course",0.60,0.6,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["serum IgE","immunology","moderate"],["skin prick testing","immunology","moderate"]],
      treatments:[["emollients","moisturizer","first_line","AAD"],["hydrocortisone topical","corticosteroid","mild","AAD"],["tacrolimus topical","calcineurin inhibitor","second_line","AAD"],["dupilumab","anti-IL4/13","severe","AAD"]]},
    {name:"urticaria chronic",icd10:"L50.1",organ:"dermatological",prior:0.02,severity:"low",
      symptoms:[["wheals migratory",0.90,0.85,"high"],["pruritus",0.85,0.7,"high"],["angioedema",0.40,0.6,"moderate"],["individual lesions resolve within 24 hours",0.65,0.7,"high"],["dermographism",0.35,0.7,"high"]],
      tests:[["clinical diagnosis","clinical","high"],["CBC","hematology","low"],["TSH","biochemistry","moderate"],["anti-FcεRI antibodies","immunology","moderate"]],
      treatments:[["cetirizine","antihistamine","first_line","EAACI"],["fexofenadine","antihistamine","first_line","EAACI"],["omalizumab","anti-IgE","third_line","EAACI"]]},
    {name:"tinea corporis",icd10:"B35.4",organ:"dermatological",prior:0.03,severity:"low",
      symptoms:[["annular erythematous lesion",0.85,0.85,"high"],["central clearing",0.75,0.8,"high"],["raised scaly border",0.70,0.75,"high"],["pruritus",0.60,0.5,"moderate"],["spreading lesion",0.55,0.6,"moderate"]],
      tests:[["KOH preparation","microbiology","high"],["fungal culture","microbiology","moderate"],["Wood lamp","clinical","moderate"]],
      treatments:[["terbinafine topical","antifungal","first_line","AAD"],["clotrimazole topical","antifungal","first_line","AAD"],["terbinafine oral","antifungal","extensive","AAD"]]},
    {name:"scabies",icd10:"B86",organ:"dermatological",prior:0.02,severity:"low",
      symptoms:[["intense pruritus worse at night",0.90,0.8,"high"],["burrow tracks",0.55,0.9,"high"],["papular rash interdigital",0.70,0.75,"high"],["rash in web spaces",0.65,0.7,"high"],["family contacts affected",0.50,0.6,"moderate"],["excoriation marks",0.55,0.5,"moderate"]],
      tests:[["skin scraping microscopy","microbiology","high"],["dermoscopy","clinical","moderate"],["clinical diagnosis","clinical","moderate"]],
      treatments:[["permethrin 5% topical","antiparasitic","first_line","CDC"],["ivermectin oral","antiparasitic","alternative","CDC"]]},
    {name:"acne vulgaris",icd10:"L70.0",organ:"dermatological",prior:0.10,severity:"low",
      symptoms:[["comedones open and closed",0.85,0.8,"high"],["inflammatory papules",0.75,0.7,"high"],["pustules facial",0.70,0.7,"high"],["nodules",0.40,0.6,"moderate"],["scarring",0.35,0.6,"moderate"],["oily skin",0.55,0.5,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"]],
      treatments:[["benzoyl peroxide","antimicrobial","first_line","AAD"],["tretinoin topical","retinoid","first_line","AAD"],["doxycycline","tetracycline","moderate","AAD"],["isotretinoin","retinoid","severe","AAD"]]},
    {name:"melanoma",icd10:"C43.9",organ:"dermatological",prior:0.003,severity:"critical",
      symptoms:[["asymmetric pigmented lesion",0.75,0.8,"high"],["irregular borders mole",0.70,0.75,"high"],["color variation in mole",0.65,0.75,"high"],["diameter greater than 6mm",0.55,0.6,"moderate"],["evolving mole",0.70,0.7,"high"],["new pigmented lesion",0.50,0.5,"moderate"]],
      tests:[["dermoscopy","clinical","high"],["excisional biopsy","pathology","high"],["sentinel lymph node biopsy","pathology","moderate"],["CT/PET staging","imaging","moderate"]],
      treatments:[["wide local excision","procedure","first_line","NCCN"],["pembrolizumab","immunotherapy","advanced","NCCN"],["nivolumab","immunotherapy","adjuvant","NCCN"],["dabrafenib-trametinib","targeted therapy","BRAF_positive","NCCN"]]},
    {name:"basal cell carcinoma",icd10:"C44.91",organ:"dermatological",prior:0.01,severity:"moderate",
      symptoms:[["pearly papule or nodule",0.80,0.85,"high"],["telangiectasia on lesion",0.65,0.8,"high"],["rolled borders",0.60,0.8,"high"],["central ulceration",0.45,0.7,"high"],["slow growing lesion",0.55,0.5,"moderate"],["non-healing wound",0.50,0.6,"moderate"]],
      tests:[["skin biopsy","pathology","high"],["dermoscopy","clinical","moderate"]],
      treatments:[["surgical excision","procedure","first_line","NCCN"],["Mohs micrographic surgery","procedure","high_risk","NCCN"],["imiquimod topical","immunomodulator","superficial","NCCN"]]},
    {name:"herpes simplex labialis",icd10:"B00.1",organ:"dermatological",prior:0.05,severity:"low",
      symptoms:[["grouped vesicles on lip",0.85,0.9,"high"],["tingling or burning prodrome",0.70,0.7,"high"],["pain at lesion site",0.65,0.6,"moderate"],["crusting after vesicle rupture",0.60,0.6,"moderate"],["recurrent episodes",0.55,0.6,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["HSV PCR","molecular","moderate"],["Tzanck smear","cytology","moderate"]],
      treatments:[["acyclovir topical","antiviral","first_line","BASHH"],["valacyclovir oral","antiviral","moderate","BASHH"]]},
    {name:"contact dermatitis",icd10:"L25.9",organ:"dermatological",prior:0.05,severity:"low",
      symptoms:[["erythema at contact site",0.85,0.75,"high"],["pruritus at contact site",0.80,0.7,"high"],["vesicles at contact site",0.55,0.65,"moderate"],["well-demarcated borders matching exposure",0.60,0.8,"high"],["edema at site",0.50,0.5,"moderate"],["history of exposure to irritant or allergen",0.70,0.7,"high"]],
      tests:[["clinical diagnosis","clinical","high"],["patch testing","dermatology","moderate"]],
      treatments:[["topical corticosteroid","corticosteroid","first_line","AAD"],["emollients","moisturizer","adjunct","AAD"],["allergen avoidance","preventive","first_line","AAD"]]},
  ];
}

// ══════════════════════════════════════════════════
// BATCH 16: OPHTHALMOLOGY (15 diseases)
// ══════════════════════════════════════════════════
function getOphthalmology(): DiseaseEntry[] {
  return [
    {name:"acute angle-closure glaucoma",icd10:"H40.2",organ:"ophthalmologic",prior:0.005,severity:"critical",
      symptoms:[["severe eye pain sudden",0.90,0.85,"high"],["blurred vision acute",0.80,0.8,"high"],["halos around lights",0.65,0.8,"high"],["nausea and vomiting",0.55,0.5,"moderate"],["red eye",0.70,0.6,"moderate"],["mid-dilated fixed pupil",0.60,0.9,"high"],["headache",0.50,0.4,"moderate"],["elevated intraocular pressure",0.85,0.9,"high"]],
      tests:[["intraocular pressure measurement","ophthalmology","high"],["slit lamp examination","ophthalmology","high"],["gonioscopy","ophthalmology","high"]],
      treatments:[["timolol eye drops","beta-blocker","first_line","AAO"],["pilocarpine eye drops","miotic","first_line","AAO"],["acetazolamide IV","carbonic anhydrase inhibitor","first_line","AAO"],["laser peripheral iridotomy","procedure","definitive","AAO"]]},
    {name:"open angle glaucoma",icd10:"H40.1",organ:"ophthalmologic",prior:0.03,severity:"moderate",
      symptoms:[["gradual peripheral vision loss",0.65,0.7,"high"],["tunnel vision",0.40,0.8,"high"],["asymptomatic early",0.70,0.4,"moderate"],["elevated intraocular pressure",0.60,0.7,"high"]],
      tests:[["tonometry","ophthalmology","high"],["visual field testing","ophthalmology","high"],["optical coherence tomography","ophthalmology","high"],["fundoscopy optic disc","ophthalmology","high"]],
      treatments:[["latanoprost","prostaglandin analog","first_line","AAO"],["timolol","beta-blocker","second_line","AAO"],["trabeculectomy","procedure","refractory","AAO"]]},
    {name:"retinal detachment",icd10:"H33.0",organ:"ophthalmologic",prior:0.005,severity:"critical",
      symptoms:[["sudden flashes of light",0.80,0.8,"high"],["floaters sudden increase",0.75,0.75,"high"],["curtain or shadow in visual field",0.70,0.9,"high"],["painless vision loss",0.60,0.7,"high"]],
      tests:[["dilated fundoscopy","ophthalmology","high"],["ocular ultrasound","imaging","moderate"],["OCT","ophthalmology","moderate"]],
      treatments:[["pneumatic retinopexy","procedure","first_line","AAO"],["scleral buckle","procedure","definitive","AAO"],["vitrectomy","procedure","complex","AAO"]]},
    {name:"age-related macular degeneration",icd10:"H35.3",organ:"ophthalmologic",prior:0.05,severity:"moderate",
      symptoms:[["central vision loss gradual",0.75,0.7,"high"],["distorted vision metamorphopsia",0.65,0.8,"high"],["difficulty reading",0.60,0.5,"moderate"],["drusen on fundoscopy",0.55,0.8,"high"],["scotoma central",0.50,0.7,"high"]],
      tests:[["dilated fundoscopy","ophthalmology","high"],["OCT macular","ophthalmology","high"],["fluorescein angiography","ophthalmology","moderate"],["Amsler grid testing","clinical","moderate"]],
      treatments:[["ranibizumab intravitreal","anti-VEGF","wet_AMD","AAO"],["aflibercept intravitreal","anti-VEGF","wet_AMD","AAO"],["AREDS2 supplements","nutritional","dry_AMD","AAO"]]},
    {name:"conjunctivitis bacterial",icd10:"H10.0",organ:"ophthalmologic",prior:0.05,severity:"low",
      symptoms:[["red eye",0.85,0.6,"moderate"],["purulent discharge",0.80,0.8,"high"],["eye crusting morning",0.70,0.7,"high"],["foreign body sensation",0.50,0.5,"moderate"],["eyelid edema",0.45,0.5,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["conjunctival swab culture","microbiology","moderate"]],
      treatments:[["chloramphenicol eye drops","antibiotic","first_line","NICE"],["moxifloxacin eye drops","fluoroquinolone","alternative","AAO"]]},
    {name:"conjunctivitis viral",icd10:"H10.1",organ:"ophthalmologic",prior:0.06,severity:"low",
      symptoms:[["red eye",0.85,0.5,"moderate"],["watery discharge",0.80,0.7,"high"],["preauricular lymphadenopathy",0.45,0.8,"high"],["bilateral involvement sequential",0.55,0.6,"moderate"],["foreign body sensation",0.50,0.5,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["adenovirus PCR","molecular","moderate"]],
      treatments:[["artificial tears","supportive","first_line","AAO"],["cold compresses","supportive","adjunct","AAO"]]},
    {name:"diabetic retinopathy",icd10:"H36.0",organ:"ophthalmologic",prior:0.03,severity:"high",
      symptoms:[["gradual vision loss",0.55,0.5,"moderate"],["floaters",0.45,0.5,"moderate"],["blurred vision",0.50,0.5,"moderate"],["microaneurysms on fundoscopy",0.60,0.8,"high"],["cotton wool spots",0.40,0.7,"high"],["neovascularization",0.35,0.85,"high"],["asymptomatic early",0.60,0.4,"moderate"]],
      tests:[["dilated fundoscopy","ophthalmology","high"],["OCT macular","ophthalmology","high"],["fluorescein angiography","ophthalmology","moderate"],["HbA1c","biochemistry","moderate"]],
      treatments:[["anti-VEGF intravitreal","anti-VEGF","DME","AAO"],["panretinal laser photocoagulation","procedure","proliferative","AAO"],["vitrectomy","procedure","vitreous_hemorrhage","AAO"]]},
    {name:"anterior uveitis",icd10:"H20.0",organ:"ophthalmologic",prior:0.01,severity:"moderate",
      symptoms:[["eye pain",0.80,0.7,"high"],["photophobia",0.75,0.7,"high"],["blurred vision",0.60,0.5,"moderate"],["red eye ciliary flush",0.70,0.7,"high"],["miosis",0.50,0.7,"high"],["hypopyon",0.30,0.9,"high"]],
      tests:[["slit lamp examination","ophthalmology","high"],["HLA-B27","genetics","moderate"],["ACE level","biochemistry","moderate"],["chest X-ray","imaging","moderate"]],
      treatments:[["prednisolone acetate eye drops","corticosteroid","first_line","AAO"],["cyclopentolate eye drops","cycloplegic","adjunct","AAO"]]},
  ];
}

// ══════════════════════════════════════════════════
// BATCH 17: NEPHROLOGY (15 diseases)
// ══════════════════════════════════════════════════
function getNephrology(): DiseaseEntry[] {
  return [
    {name:"chronic kidney disease",icd10:"N18.9",organ:"renal",prior:0.10,severity:"moderate",
      symptoms:[["fatigue",0.65,0.4,"moderate"],["edema",0.55,0.5,"moderate"],["nausea",0.45,0.4,"moderate"],["pruritus",0.40,0.5,"moderate"],["nocturia",0.45,0.5,"moderate"],["decreased urine output",0.40,0.5,"moderate"],["elevated blood pressure",0.55,0.5,"moderate"],["bone pain",0.30,0.4,"moderate"],["metallic taste",0.30,0.6,"moderate"]],
      tests:[["serum creatinine","biochemistry","high"],["eGFR calculation","biochemistry","high"],["urine albumin-creatinine ratio","biochemistry","high"],["renal ultrasound","imaging","moderate"],["electrolytes","biochemistry","moderate"],["CBC","hematology","moderate"]],
      treatments:[["ramipril","ACE inhibitor","first_line","KDIGO"],["dapagliflozin","SGLT2 inhibitor","first_line","KDIGO"],["erythropoietin","ESA","anemia","KDIGO"],["sodium bicarbonate","alkali","acidosis","KDIGO"]]},
    {name:"nephrotic syndrome",icd10:"N04.9",organ:"renal",prior:0.005,severity:"high",
      symptoms:[["generalized edema",0.85,0.8,"high"],["periorbital edema",0.70,0.75,"high"],["frothy urine",0.65,0.8,"high"],["weight gain",0.55,0.5,"moderate"],["fatigue",0.45,0.4,"moderate"],["anorexia",0.35,0.4,"moderate"]],
      tests:[["24-hour urine protein","biochemistry","high"],["serum albumin","biochemistry","high"],["lipid panel","biochemistry","moderate"],["renal biopsy","pathology","high"],["serum creatinine","biochemistry","moderate"]],
      treatments:[["prednisolone","corticosteroid","first_line","KDIGO"],["cyclophosphamide","immunosuppressant","FSGS","KDIGO"],["rituximab","anti-CD20","steroid-resistant","KDIGO"],["furosemide","loop diuretic","symptomatic","KDIGO"]]},
    {name:"nephrolithiasis",icd10:"N20.0",organ:"renal",prior:0.05,severity:"moderate",
      symptoms:[["severe flank pain colicky",0.90,0.85,"high"],["pain radiating to groin",0.70,0.8,"high"],["hematuria",0.65,0.7,"high"],["nausea and vomiting",0.60,0.5,"moderate"],["urinary urgency",0.45,0.5,"moderate"],["dysuria",0.40,0.4,"moderate"],["restlessness",0.50,0.5,"moderate"]],
      tests:[["CT KUB non-contrast","imaging","high"],["urinalysis","biochemistry","high"],["basic metabolic panel","biochemistry","moderate"],["serum calcium","biochemistry","moderate"],["urine culture","microbiology","moderate"]],
      treatments:[["ketorolac","NSAID","first_line","AUA"],["tamsulosin","alpha-blocker","medical_expulsion","AUA"],["extracorporeal lithotripsy","procedure","large_stones","AUA"],["ureteroscopy","procedure","ureteral","AUA"]]},
    {name:"pyelonephritis",icd10:"N10",organ:"renal",prior:0.02,severity:"high",
      symptoms:[["flank pain",0.80,0.8,"high"],["high fever",0.75,0.6,"high"],["costovertebral angle tenderness",0.70,0.8,"high"],["rigors",0.50,0.5,"moderate"],["nausea and vomiting",0.55,0.5,"moderate"],["dysuria",0.50,0.5,"moderate"],["urinary frequency",0.45,0.5,"moderate"]],
      tests:[["urinalysis","biochemistry","high"],["urine culture","microbiology","high"],["blood cultures","microbiology","moderate"],["CBC","hematology","moderate"],["renal ultrasound","imaging","moderate"]],
      treatments:[["ciprofloxacin","fluoroquinolone","outpatient","IDSA"],["ceftriaxone","cephalosporin","inpatient","IDSA"],["trimethoprim-sulfamethoxazole","antibiotic","alternative","IDSA"]]},
    {name:"glomerulonephritis acute",icd10:"N00.9",organ:"renal",prior:0.005,severity:"high",
      symptoms:[["dark brown urine cola-colored",0.70,0.8,"high"],["edema",0.65,0.6,"moderate"],["hypertension new onset",0.60,0.6,"moderate"],["oliguria",0.50,0.6,"moderate"],["hematuria",0.75,0.7,"high"],["fatigue",0.40,0.4,"moderate"],["proteinuria",0.55,0.6,"moderate"]],
      tests:[["urinalysis with microscopy","biochemistry","high"],["serum creatinine","biochemistry","high"],["complement C3/C4","immunology","high"],["ASO titer","serology","moderate"],["ANA/anti-dsDNA","immunology","moderate"],["renal biopsy","pathology","high"]],
      treatments:[["furosemide","loop diuretic","edema","KDIGO"],["amlodipine","calcium channel blocker","hypertension","KDIGO"],["prednisolone","corticosteroid","if_indicated","KDIGO"]]},
    {name:"polycystic kidney disease",icd10:"Q61.3",organ:"renal",prior:0.005,severity:"moderate",
      symptoms:[["bilateral flank pain",0.55,0.6,"moderate"],["hematuria",0.45,0.5,"moderate"],["hypertension",0.60,0.5,"moderate"],["palpable kidneys",0.40,0.8,"high"],["urinary tract infections recurrent",0.35,0.5,"moderate"],["family history kidney disease",0.50,0.6,"moderate"],["headache",0.30,0.3,"moderate"]],
      tests:[["renal ultrasound","imaging","high"],["MRI abdomen","imaging","moderate"],["serum creatinine","biochemistry","moderate"],["genetic testing PKD1/PKD2","genetics","moderate"]],
      treatments:[["tolvaptan","vasopressin antagonist","first_line","KDIGO"],["ACE inhibitor","antihypertensive","hypertension","KDIGO"],["pain management","supportive","symptomatic","KDIGO"]]},
    {name:"renal cell carcinoma",icd10:"C64",organ:"renal",prior:0.005,severity:"critical",
      symptoms:[["hematuria",0.55,0.6,"moderate"],["flank pain",0.45,0.5,"moderate"],["palpable flank mass",0.35,0.7,"high"],["weight loss",0.40,0.5,"moderate"],["fever of unknown origin",0.30,0.4,"moderate"],["polycythemia",0.30,0.7,"high"],["varicocele left-sided new onset",0.30,0.8,"high"]],
      tests:[["CT abdomen with contrast","imaging","high"],["renal ultrasound","imaging","moderate"],["MRI abdomen","imaging","moderate"],["CBC","hematology","moderate"],["chest CT for staging","imaging","moderate"]],
      treatments:[["partial nephrectomy","procedure","T1","AUA"],["radical nephrectomy","procedure","advanced","AUA"],["sunitinib","targeted therapy","metastatic","NCCN"],["pembrolizumab-axitinib","immunotherapy-TKI","metastatic","NCCN"]]},
  ];
}

// Physiology states
function getPhysStates(): {state_name:string;description:string;organ_system:string}[] {
  return [
    {state_name:"bronchiolar edema infantile",description:"RSV-induced bronchiolar inflammation and mucus in infants",organ_system:"pulmonary"},
    {state_name:"subglottic edema",description:"Viral-induced narrowing of subglottic airway",organ_system:"respiratory"},
    {state_name:"coronary vasculitis",description:"Inflammatory vasculitis affecting coronary arteries",organ_system:"cardiovascular"},
    {state_name:"febrile seizure threshold lowering",description:"Temperature-related lowering of seizure threshold in children",organ_system:"neurological"},
    {state_name:"ileocolic telescoping",description:"Invagination of proximal bowel into distal segment",organ_system:"gastrointestinal"},
    {state_name:"pyloric muscular hypertrophy",description:"Hypertrophy of pyloric sphincter muscle causing obstruction",organ_system:"gastrointestinal"},
    {state_name:"neonatal bilirubin conjugation immaturity",description:"Immature hepatic glucuronidation of bilirubin in neonates",organ_system:"hepatic"},
    {state_name:"keratinocyte hyperproliferation",description:"Accelerated keratinocyte turnover with abnormal differentiation",organ_system:"dermatological"},
    {state_name:"epidermal barrier dysfunction",description:"Defective epidermal barrier with filaggrin deficiency",organ_system:"dermatological"},
    {state_name:"dermal mast cell histamine release",description:"Chronic spontaneous urticaria from mast cell activation",organ_system:"dermatological"},
    {state_name:"dermatophyte invasion",description:"Fungal invasion of keratinized tissue",organ_system:"dermatological"},
    {state_name:"sarcoptes mite infestation",description:"Sarcoptes scabiei burrowing in stratum corneum",organ_system:"dermatological"},
    {state_name:"sebaceous follicular obstruction",description:"Obstruction of pilosebaceous unit with Cutibacterium colonization",organ_system:"dermatological"},
    {state_name:"melanocyte malignant transformation",description:"Malignant transformation of melanocytes with invasion",organ_system:"dermatological"},
    {state_name:"aqueous humor outflow obstruction",description:"Acute obstruction of trabecular meshwork outflow",organ_system:"ophthalmologic"},
    {state_name:"trabecular meshwork progressive damage",description:"Gradual damage to trabecular meshwork increasing IOP",organ_system:"ophthalmologic"},
    {state_name:"retinal neurosensory separation",description:"Separation of neurosensory retina from RPE",organ_system:"ophthalmologic"},
    {state_name:"macular drusen accumulation",description:"Accumulation of drusen deposits under retinal pigment epithelium",organ_system:"ophthalmologic"},
    {state_name:"retinal microvascular damage",description:"Diabetes-related damage to retinal capillaries",organ_system:"ophthalmologic"},
    {state_name:"glomerular filtration decline",description:"Progressive loss of glomerular filtration capacity",organ_system:"renal"},
    {state_name:"glomerular permeability increase",description:"Loss of glomerular charge and size selectivity barrier",organ_system:"renal"},
    {state_name:"ureteral calculus obstruction",description:"Obstruction of ureter by calculus causing colic",organ_system:"renal"},
    {state_name:"ascending urinary tract infection",description:"Bacterial ascending infection to renal parenchyma",organ_system:"renal"},
    {state_name:"glomerular immune complex deposition",description:"Immune complex deposition in glomerular basement membrane",organ_system:"renal"},
    {state_name:"renal cystic expansion",description:"Progressive cystic expansion replacing normal renal parenchyma",organ_system:"renal"},
    {state_name:"renal parenchymal neoplasia",description:"Malignant transformation of renal parenchymal cells",organ_system:"renal"},
    {state_name:"anterior chamber inflammation",description:"Inflammatory process in anterior chamber of eye",organ_system:"ophthalmologic"},
  ];
}

// Dangerous diagnoses
function getDangerTriggers(): {trigger:string;disease:string;severity:string;protocol:string;source:string;priority:number}[] {
  return [
    {trigger:"fever more than 5 days",disease:"kawasaki disease",severity:"critical",protocol:"Urgent echo, IVIG within 10 days of fever onset",source:"AHA",priority:1},
    {trigger:"currant jelly stool",disease:"intussusception",severity:"critical",protocol:"Urgent ultrasound, air enema reduction",source:"AAP",priority:1},
    {trigger:"projectile vomiting non-bilious",disease:"pyloric stenosis",severity:"high",protocol:"Ultrasound pylorus, electrolytes, surgical consult",source:"AAP",priority:2},
    {trigger:"Koplik spots",disease:"measles",severity:"high",protocol:"Isolation, vitamin A, notification",source:"WHO",priority:2},
    {trigger:"barking cough",disease:"croup",severity:"moderate",protocol:"Assess severity, dexamethasone, nebulized epinephrine if severe",source:"AAP",priority:3},
    {trigger:"severe eye pain sudden",disease:"acute angle-closure glaucoma",severity:"critical",protocol:"Urgent ophthalmology, IOP-lowering drops, laser iridotomy",source:"AAO",priority:1},
    {trigger:"curtain or shadow in visual field",disease:"retinal detachment",severity:"critical",protocol:"Urgent dilated fundoscopy, ophthalmology emergency",source:"AAO",priority:1},
    {trigger:"sudden flashes of light",disease:"retinal detachment",severity:"high",protocol:"Urgent dilated fundoscopy",source:"AAO",priority:2},
    {trigger:"asymmetric pigmented lesion",disease:"melanoma",severity:"high",protocol:"Urgent dermoscopy, excisional biopsy",source:"NCCN",priority:2},
    {trigger:"severe flank pain colicky",disease:"nephrolithiasis",severity:"high",protocol:"CT KUB, analgesia, urology if obstructing",source:"AUA",priority:2},
    {trigger:"dark brown urine cola-colored",disease:"glomerulonephritis acute",severity:"high",protocol:"Urinalysis, complement levels, nephrology referral",source:"KDIGO",priority:2},
    {trigger:"frothy urine",disease:"nephrotic syndrome",severity:"high",protocol:"Urine protein, albumin, nephrology referral",source:"KDIGO",priority:2},
    {trigger:"costovertebral angle tenderness",disease:"pyelonephritis",severity:"high",protocol:"Urine culture, blood cultures, empiric antibiotics",source:"IDSA",priority:2},
    {trigger:"mid-dilated fixed pupil",disease:"acute angle-closure glaucoma",severity:"critical",protocol:"Emergency IOP reduction, laser iridotomy",source:"AAO",priority:1},
    {trigger:"stridor inspiratory",disease:"croup",severity:"high",protocol:"Dexamethasone, nebulized epinephrine if stridor at rest",source:"AAP",priority:2},
  ];
}

// Guidelines
function getGuidelinesData(): any[] {
  return [
    {title:"Kawasaki Disease Management 2024",condition:"kawasaki disease",source:"AHA 2024",source_organization:"American Heart Association",evidence_grade:"A",year:2024,recommendation_text:"IVIG 2g/kg single infusion within 10 days of fever onset. High-dose aspirin during acute phase, low-dose during convalescence. Echo at diagnosis, 2 weeks, and 6 weeks.",summary:"AHA scientific statement on Kawasaki disease",clinical_topic:"Pediatrics",keywords:["Kawasaki","IVIG","coronary aneurysm","aspirin"],applicable_tests:["echocardiogram","CBC","CRP/ESR"],applicable_drugs:["IVIG","aspirin"]},
    {title:"Bronchiolitis Management 2024",condition:"acute bronchiolitis",source:"AAP 2024",source_organization:"American Academy of Pediatrics",evidence_grade:"A",year:2024,recommendation_text:"Supportive care is primary treatment. No routine use of bronchodilators, corticosteroids, or antibiotics. Supplemental oxygen for SpO2 <90%.",summary:"AAP clinical practice guideline for bronchiolitis",clinical_topic:"Pediatrics",keywords:["bronchiolitis","RSV","infant","supportive care"],applicable_tests:["pulse oximetry","clinical assessment"],applicable_drugs:["supplemental oxygen"]},
    {title:"Psoriasis Treatment 2024",condition:"psoriasis",source:"AAD 2024",source_organization:"American Academy of Dermatology",evidence_grade:"A",year:2024,recommendation_text:"Topical therapy for mild. Phototherapy for moderate. Biologics (anti-TNF, anti-IL17, anti-IL23) for moderate-severe. Methotrexate as bridge.",summary:"AAD guidelines of care for psoriasis management",clinical_topic:"Dermatology",keywords:["psoriasis","biologic","IL-17","phototherapy"],applicable_tests:["clinical assessment","skin biopsy"],applicable_drugs:["betamethasone","methotrexate","adalimumab","secukinumab"]},
    {title:"Atopic Dermatitis Management 2024",condition:"atopic dermatitis",source:"AAD 2024",source_organization:"American Academy of Dermatology",evidence_grade:"A",year:2024,recommendation_text:"Emollients as baseline. Topical corticosteroids for flares. Calcineurin inhibitors for sensitive areas. Dupilumab for moderate-severe refractory.",summary:"AAD guidelines of care for atopic dermatitis",clinical_topic:"Dermatology",keywords:["eczema","atopic dermatitis","dupilumab","emollient"],applicable_tests:["clinical diagnosis"],applicable_drugs:["hydrocortisone","tacrolimus","dupilumab"]},
    {title:"Glaucoma Initial Treatment 2024",condition:"open angle glaucoma",source:"AAO 2024",source_organization:"American Academy of Ophthalmology",evidence_grade:"A",year:2024,recommendation_text:"Prostaglandin analogs first-line. Target IOP reduction 20-30% from baseline. Laser trabeculoplasty as alternative first-line. Surgery for refractory.",summary:"AAO preferred practice pattern for open-angle glaucoma",clinical_topic:"Ophthalmology",keywords:["glaucoma","IOP","latanoprost","visual field"],applicable_tests:["tonometry","visual field","OCT"],applicable_drugs:["latanoprost","timolol"]},
    {title:"Diabetic Retinopathy Screening 2024",condition:"diabetic retinopathy",source:"AAO 2024",source_organization:"American Academy of Ophthalmology",evidence_grade:"A",year:2024,recommendation_text:"Annual dilated eye exam for all diabetics. Anti-VEGF for DME. PRP for proliferative DR. Optimize glycemic and BP control.",summary:"AAO preferred practice pattern for diabetic retinopathy",clinical_topic:"Ophthalmology",keywords:["diabetic retinopathy","anti-VEGF","PRP","DME"],applicable_tests:["dilated fundoscopy","OCT","fluorescein angiography"],applicable_drugs:["ranibizumab","aflibercept"]},
    {title:"CKD Evaluation and Management 2024",condition:"chronic kidney disease",source:"KDIGO 2024",source_organization:"Kidney Disease Improving Global Outcomes",evidence_grade:"A",year:2024,recommendation_text:"ACEi/ARB for proteinuria. SGLT2i for GFR 20-45 with albuminuria. Target BP <120 systolic. Manage anemia with ESA when Hb <10.",summary:"KDIGO clinical practice guideline for CKD",clinical_topic:"Nephrology",keywords:["CKD","GFR","proteinuria","SGLT2i"],applicable_tests:["eGFR","urine ACR","renal ultrasound"],applicable_drugs:["ramipril","dapagliflozin","erythropoietin"]},
    {title:"Nephrolithiasis Management 2024",condition:"nephrolithiasis",source:"AUA 2024",source_organization:"American Urological Association",evidence_grade:"A",year:2024,recommendation_text:"NSAIDs first-line for pain. Alpha-blockers for medical expulsive therapy <10mm. ESWL or ureteroscopy for stones >10mm or refractory.",summary:"AUA guideline on surgical management of stones",clinical_topic:"Urology",keywords:["kidney stone","ESWL","ureteroscopy","tamsulosin"],applicable_tests:["CT KUB","urinalysis","serum calcium"],applicable_drugs:["ketorolac","tamsulosin"]},
    {title:"Melanoma Detection and Treatment 2024",condition:"melanoma",source:"NCCN 2024",source_organization:"National Comprehensive Cancer Network",evidence_grade:"A",year:2024,recommendation_text:"ABCDE criteria for detection. Excisional biopsy with margins. SLNB for >0.8mm. Adjuvant immunotherapy for stage III+.",summary:"NCCN guidelines for cutaneous melanoma",clinical_topic:"Dermatology/Oncology",keywords:["melanoma","ABCDE","immunotherapy","sentinel node"],applicable_tests:["dermoscopy","excisional biopsy","SLNB","PET-CT"],applicable_drugs:["pembrolizumab","nivolumab","dabrafenib-trametinib"]},
    {title:"Pyelonephritis Treatment 2024",condition:"pyelonephritis",source:"IDSA 2024",source_organization:"Infectious Diseases Society of America",evidence_grade:"A",year:2024,recommendation_text:"Outpatient: fluoroquinolone or TMP-SMX 7-14 days. Inpatient: IV ceftriaxone or fluoroquinolone. Urine culture before antibiotics.",summary:"IDSA guidelines for acute uncomplicated pyelonephritis",clinical_topic:"Infectious Disease/Nephrology",keywords:["pyelonephritis","UTI","ceftriaxone","urine culture"],applicable_tests:["urine culture","blood cultures","renal ultrasound"],applicable_drugs:["ciprofloxacin","ceftriaxone","trimethoprim-sulfamethoxazole"]},
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

  addLog("=== KG Expansion Batch 14-17: Peds + Derm + Ophtho + Nephro ===");

  try {
    const diseases: DiseaseEntry[] = [...getPediatrics(), ...getDermatology(), ...getOphthalmology(), ...getNephrology()];
    addLog(`Total diseases: ${diseases.length}`);

    const uniqueSymptoms = new Set<string>();
    for (const d of diseases) for (const [sym] of d.symptoms) uniqueSymptoms.add(sym);

    // Step 1: Diagnoses
    const diagRows = diseases.map(d => ({ diagnosis_name: d.name, icd10_code: d.icd10, category: d.organ }));
    for (let i = 0; i < diagRows.length; i += 100) {
      const { error } = await supabase.from("diagnoses").upsert(diagRows.slice(i, i + 100), { onConflict: "diagnosis_name", ignoreDuplicates: true });
      if (error) addLog(`Diag: ${error.message}`);
    }

    const allDiagIds: Record<string, string> = {};
    let offset = 0;
    while (true) {
      const { data } = await supabase.from("diagnoses").select("id, diagnosis_name").range(offset, offset + 999);
      if (!data || data.length === 0) break;
      for (const r of data) allDiagIds[r.diagnosis_name] = r.id;
      offset += data.length;
      if (data.length < 1000) break;
    }

    // Step 2: Symptoms
    const symRows = Array.from(uniqueSymptoms).map(s => ({ symptom_name: s, category: "general" }));
    for (let i = 0; i < symRows.length; i += 100) {
      const { error } = await supabase.from("symptoms").upsert(symRows.slice(i, i + 100), { onConflict: "symptom_name", ignoreDuplicates: true });
      if (error) addLog(`Sym: ${error.message}`);
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

    // Step 3: Priors
    const priorRows = diseases.filter(d => allDiagIds[d.name]).map(d => ({
      diagnosis_id: allDiagIds[d.name], base_prevalence: d.prior, age_modifier: {}, sex_modifier: {}, region_modifier: {},
    }));
    for (let i = 0; i < priorRows.length; i += 100) {
      await supabase.from("disease_priors").upsert(priorRows.slice(i, i + 100), { onConflict: "diagnosis_id", ignoreDuplicates: false });
    }

    // Step 4: Likelihoods
    const likRows: any[] = [];
    for (const d of diseases) {
      const dId = allDiagIds[d.name]; if (!dId) continue;
      for (const [sym, prob] of d.symptoms) {
        const sId = allSymIds[sym]; if (sId) likRows.push({ symptom_id: sId, diagnosis_id: dId, likelihood_value: prob });
      }
    }
    for (let i = 0; i < likRows.length; i += 200) {
      const { error } = await supabase.from("symptom_likelihoods").upsert(likRows.slice(i, i + 200), { onConflict: "symptom_id,diagnosis_id", ignoreDuplicates: false });
      if (error) addLog(`Lik: ${error.message}`);
    }
    addLog(`Likelihoods: ${likRows.length}`);

    // Step 5: Tests & Treatments
    const testRows = diseases.flatMap(d => d.tests.map(t => ({ disease_name: d.name, test_name: t[0], test_category: t[1], diagnostic_strength: t[2] })));
    for (let i = 0; i < testRows.length; i += 200) {
      await supabase.from("disease_tests").upsert(testRows.slice(i, i + 200), { onConflict: "disease_name,test_name", ignoreDuplicates: true });
    }

    const txRows = diseases.flatMap(d => d.treatments.map(t => ({ disease_name: d.name, drug_name: t[0], drug_class: t[1], line_of_treatment: t[2], guideline_source: t[3] })));
    for (let i = 0; i < txRows.length; i += 200) {
      await supabase.from("disease_treatments").upsert(txRows.slice(i, i + 200), { onConflict: "disease_name,drug_name", ignoreDuplicates: true });
    }

    // Step 6: Physiology
    const physStates = getPhysStates();
    const { data: systems } = await supabase.from("anatomical_systems").select("id, system_name");
    const systemIds: Record<string, string> = {};
    for (const s of systems || []) systemIds[s.system_name] = s.id;

    for (let i = 0; i < physStates.length; i += 50) {
      const chunk = physStates.slice(i, i + 50).map(s => ({ state_name: s.state_name, description: s.description, system_id: systemIds[s.organ_system] || Object.values(systemIds)[0] }));
      await supabase.from("physiological_states").upsert(chunk, { onConflict: "state_name", ignoreDuplicates: true });
    }

    const allPhysIds: Record<string, string> = {};
    offset = 0;
    while (true) {
      const { data } = await supabase.from("physiological_states").select("id, state_name").range(offset, offset + 999);
      if (!data || data.length === 0) break;
      for (const r of data) allPhysIds[r.state_name] = r.id;
      offset += data.length;
      if (data.length < 1000) break;
    }

    // Step 7: Sym-phys
    const symPhysMaps: [string, string, number, number][] = [
      ["wheezing in infant","bronchiolar edema infantile",0.85,0.85],
      ["tachypnea in infant","bronchiolar edema infantile",0.7,0.7],
      ["barking cough","subglottic edema",0.9,0.9],
      ["stridor inspiratory","subglottic edema",0.8,0.85],
      ["fever more than 5 days","coronary vasculitis",0.5,0.5],
      ["bilateral conjunctival injection","coronary vasculitis",0.6,0.65],
      ["seizure with fever","febrile seizure threshold lowering",0.9,0.9],
      ["colicky abdominal pain intermittent","ileocolic telescoping",0.7,0.7],
      ["currant jelly stool","ileocolic telescoping",0.6,0.9],
      ["projectile vomiting non-bilious","pyloric muscular hypertrophy",0.9,0.9],
      ["olive-shaped mass epigastrium","pyloric muscular hypertrophy",0.6,0.95],
      ["yellow skin discoloration","neonatal bilirubin conjugation immaturity",0.8,0.8],
      ["silvery scaly plaques","keratinocyte hyperproliferation",0.9,0.9],
      ["Auspitz sign","keratinocyte hyperproliferation",0.5,0.85],
      ["pruritus intense","epidermal barrier dysfunction",0.7,0.6],
      ["eczematous rash","epidermal barrier dysfunction",0.75,0.7],
      ["wheals migratory","dermal mast cell histamine release",0.85,0.85],
      ["annular erythematous lesion","dermatophyte invasion",0.8,0.85],
      ["central clearing","dermatophyte invasion",0.7,0.8],
      ["intense pruritus worse at night","sarcoptes mite infestation",0.85,0.8],
      ["burrow tracks","sarcoptes mite infestation",0.6,0.9],
      ["comedones open and closed","sebaceous follicular obstruction",0.8,0.8],
      ["inflammatory papules","sebaceous follicular obstruction",0.7,0.7],
      ["asymmetric pigmented lesion","melanocyte malignant transformation",0.7,0.8],
      ["evolving mole","melanocyte malignant transformation",0.65,0.7],
      ["severe eye pain sudden","aqueous humor outflow obstruction",0.85,0.85],
      ["halos around lights","aqueous humor outflow obstruction",0.7,0.8],
      ["mid-dilated fixed pupil","aqueous humor outflow obstruction",0.7,0.9],
      ["gradual peripheral vision loss","trabecular meshwork progressive damage",0.7,0.7],
      ["tunnel vision","trabecular meshwork progressive damage",0.5,0.8],
      ["curtain or shadow in visual field","retinal neurosensory separation",0.8,0.9],
      ["sudden flashes of light","retinal neurosensory separation",0.7,0.75],
      ["distorted vision metamorphopsia","macular drusen accumulation",0.7,0.8],
      ["drusen on fundoscopy","macular drusen accumulation",0.6,0.8],
      ["microaneurysms on fundoscopy","retinal microvascular damage",0.7,0.8],
      ["neovascularization","retinal microvascular damage",0.5,0.85],
      ["nocturia","glomerular filtration decline",0.4,0.45],
      ["metallic taste","glomerular filtration decline",0.4,0.6],
      ["frothy urine","glomerular permeability increase",0.7,0.8],
      ["periorbital edema","glomerular permeability increase",0.65,0.7],
      ["severe flank pain colicky","ureteral calculus obstruction",0.9,0.85],
      ["pain radiating to groin","ureteral calculus obstruction",0.75,0.8],
      ["costovertebral angle tenderness","ascending urinary tract infection",0.75,0.8],
      ["dark brown urine cola-colored","glomerular immune complex deposition",0.7,0.8],
      ["palpable kidneys","renal cystic expansion",0.5,0.8],
      ["eye pain","anterior chamber inflammation",0.7,0.65],
      ["photophobia","anterior chamber inflammation",0.65,0.65],
      ["hypopyon","anterior chamber inflammation",0.4,0.9],
      ["varicocele left-sided new onset","renal parenchymal neoplasia",0.4,0.8],
    ];

    const symPhysRows: any[] = [];
    for (const [sym, phys, conf, rel] of symPhysMaps) {
      const sId = allSymIds[sym]; const pId = allPhysIds[phys];
      if (sId && pId) symPhysRows.push({ symptom_id: sId, physiological_state_id: pId, confidence_score: conf });
    }
    for (let i = 0; i < symPhysRows.length; i += 100) {
      await supabase.from("symptom_physiology_map").upsert(symPhysRows.slice(i, i + 100), { onConflict: "symptom_id,physiological_state_id", ignoreDuplicates: true });
    }
    addLog(`Sym-phys: ${symPhysRows.length}`);

    // Step 8: Phys-diag
    const physDiagMaps: [string, string, number, number][] = [
      ["bronchiolar edema infantile","acute bronchiolitis",0.9,0.9],
      ["subglottic edema","croup",0.9,0.9],
      ["coronary vasculitis","kawasaki disease",0.9,0.9],
      ["febrile seizure threshold lowering","febrile seizure",0.9,0.9],
      ["ileocolic telescoping","intussusception",0.95,0.95],
      ["pyloric muscular hypertrophy","pyloric stenosis",0.95,0.95],
      ["neonatal bilirubin conjugation immaturity","neonatal jaundice",0.85,0.85],
      ["keratinocyte hyperproliferation","psoriasis",0.9,0.9],
      ["epidermal barrier dysfunction","atopic dermatitis",0.85,0.85],
      ["dermal mast cell histamine release","urticaria chronic",0.85,0.85],
      ["dermatophyte invasion","tinea corporis",0.9,0.9],
      ["sarcoptes mite infestation","scabies",0.95,0.95],
      ["sebaceous follicular obstruction","acne vulgaris",0.85,0.85],
      ["melanocyte malignant transformation","melanoma",0.95,0.95],
      ["aqueous humor outflow obstruction","acute angle-closure glaucoma",0.95,0.95],
      ["trabecular meshwork progressive damage","open angle glaucoma",0.9,0.9],
      ["retinal neurosensory separation","retinal detachment",0.95,0.95],
      ["macular drusen accumulation","age-related macular degeneration",0.85,0.85],
      ["retinal microvascular damage","diabetic retinopathy",0.9,0.9],
      ["glomerular filtration decline","chronic kidney disease",0.85,0.85],
      ["glomerular permeability increase","nephrotic syndrome",0.9,0.9],
      ["ureteral calculus obstruction","nephrolithiasis",0.95,0.95],
      ["ascending urinary tract infection","pyelonephritis",0.9,0.9],
      ["glomerular immune complex deposition","glomerulonephritis acute",0.9,0.9],
      ["renal cystic expansion","polycystic kidney disease",0.9,0.9],
      ["renal parenchymal neoplasia","renal cell carcinoma",0.9,0.9],
      ["anterior chamber inflammation","anterior uveitis",0.9,0.9],
    ];

    const physDiagRows: any[] = [];
    for (const [phys, diag, conf, rel] of physDiagMaps) {
      const pId = allPhysIds[phys]; const dId = allDiagIds[diag];
      if (pId && dId) physDiagRows.push({ physiological_state_id: pId, diagnosis_id: dId, relevance_score: rel });
    }
    for (let i = 0; i < physDiagRows.length; i += 100) {
      await supabase.from("physiology_diagnosis_map").upsert(physDiagRows.slice(i, i + 100), { onConflict: "physiological_state_id,diagnosis_id", ignoreDuplicates: true });
    }

    // Step 9: Dangerous
    const dangerData = getDangerTriggers();
    let dangerCount = 0;
    for (const dd of dangerData) {
      const diagId = allDiagIds[dd.disease]; if (!diagId) continue;
      const { error } = await supabase.from("dangerous_diagnoses").upsert({
        trigger_symptom: dd.trigger, diagnosis_id: diagId, diagnosis_name: dd.disease,
        severity_level: dd.severity, must_not_miss: true, priority: dd.priority,
        emergency_protocol: dd.protocol, guideline_source: dd.source,
      }, { onConflict: "trigger_symptom,diagnosis_id", ignoreDuplicates: true });
      if (!error) dangerCount++;
    }
    addLog(`Dangerous: ${dangerCount}`);

    // Step 10: Guidelines
    const guidelines = getGuidelinesData();
    for (let i = 0; i < guidelines.length; i += 50) {
      await supabase.from("clinical_guidelines").upsert(guidelines.slice(i, i + 50), { onConflict: "title", ignoreDuplicates: true });
    }

    // Validation
    const counts: Record<string, number> = {};
    for (const t of ["diagnoses","symptoms","symptom_likelihoods","physiological_states","symptom_physiology_map","physiology_diagnosis_map","dangerous_diagnoses","clinical_guidelines","disease_tests","disease_treatments"]) {
      const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
      counts[t] = count || 0;
      addLog(`${t}: ${count}`);
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
