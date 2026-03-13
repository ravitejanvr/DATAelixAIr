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
// INFECTIOUS DISEASE (20 diseases)
// ══════════════════════════════════════════════════
function getInfectiousDiseases(): DiseaseEntry[] {
  return [
    {name:"malaria",icd10:"B54",organ:"infectious",prior:0.03,severity:"high",
      symptoms:[["fever cyclical",0.90,0.85,"high"],["chills",0.85,0.8,"high"],["sweating",0.75,0.7,"high"],["headache",0.70,0.6,"moderate"],["myalgia",0.55,0.5,"moderate"],["nausea",0.50,0.45,"moderate"],["vomiting",0.40,0.4,"moderate"],["hepatosplenomegaly",0.45,0.6,"moderate"],["anemia",0.50,0.55,"moderate"],["jaundice",0.30,0.5,"moderate"]],
      tests:[["thick and thin blood smear","microbiology","high"],["rapid malaria antigen","microbiology","high"],["CBC","hematology","moderate"],["LFT","biochemistry","moderate"],["LDH","biochemistry","moderate"]],
      treatments:[["artemether-lumefantrine","ACT","first_line","WHO"],["artesunate IV","antimalarial","severe","WHO"],["chloroquine","antimalarial","P_vivax","WHO"],["primaquine","antimalarial","radical_cure","WHO"]]},
    {name:"dengue fever",icd10:"A90",organ:"infectious",prior:0.025,severity:"high",
      symptoms:[["high fever",0.92,0.85,"high"],["severe headache",0.75,0.7,"high"],["retro-orbital pain",0.65,0.75,"high"],["myalgia",0.70,0.65,"high"],["arthralgia",0.65,0.6,"moderate"],["rash",0.50,0.5,"moderate"],["nausea",0.55,0.5,"moderate"],["petechiae",0.35,0.6,"moderate"],["abdominal pain",0.40,0.5,"moderate"],["thrombocytopenia",0.60,0.7,"high"]],
      tests:[["NS1 antigen","serology","high"],["dengue IgM IgG","serology","high"],["CBC with platelet","hematology","high"],["hematocrit","hematology","high"],["LFT","biochemistry","moderate"]],
      treatments:[["acetaminophen","analgesic","symptomatic","WHO"],["IV crystalloids","fluid","supportive","WHO"],["platelet monitoring","supportive","monitoring","WHO"]]},
    {name:"typhoid fever",icd10:"A01.0",organ:"infectious",prior:0.015,severity:"moderate",
      symptoms:[["step-ladder fever",0.85,0.85,"high"],["headache",0.65,0.6,"moderate"],["abdominal pain",0.60,0.55,"moderate"],["constipation",0.50,0.5,"moderate"],["diarrhea",0.45,0.45,"moderate"],["rose spots",0.25,0.8,"high"],["hepatosplenomegaly",0.40,0.6,"moderate"],["relative bradycardia",0.35,0.7,"high"],["malaise",0.60,0.4,"moderate"]],
      tests:[["blood culture","microbiology","high"],["Widal test","serology","moderate"],["stool culture","microbiology","moderate"],["CBC","hematology","moderate"],["LFT","biochemistry","moderate"]],
      treatments:[["azithromycin","macrolide","first_line","WHO"],["ceftriaxone","cephalosporin","first_line","WHO"],["ciprofloxacin","fluoroquinolone","second_line","IDSA"]]},
    {name:"HIV AIDS",icd10:"B20",organ:"infectious",prior:0.01,severity:"high",
      symptoms:[["weight loss",0.70,0.65,"high"],["chronic diarrhea",0.50,0.5,"moderate"],["fever persistent",0.55,0.55,"moderate"],["night sweats",0.55,0.55,"moderate"],["fatigue",0.65,0.5,"moderate"],["lymphadenopathy generalized",0.55,0.6,"moderate"],["oral candidiasis",0.40,0.7,"high"],["recurrent infections",0.55,0.6,"moderate"],["skin lesions",0.35,0.4,"moderate"]],
      tests:[["HIV ELISA","serology","high"],["HIV Western blot","confirmatory","high"],["CD4 count","immunology","high"],["HIV viral load","molecular","high"],["CBC","hematology","moderate"]],
      treatments:[["tenofovir-emtricitabine","NRTI","first_line","WHO"],["dolutegravir","INSTI","first_line","WHO"],["efavirenz","NNRTI","alternative","WHO"]]},
    {name:"hepatitis B acute",icd10:"B16.9",organ:"infectious",prior:0.008,severity:"moderate",
      symptoms:[["jaundice",0.70,0.75,"high"],["fatigue",0.75,0.6,"moderate"],["nausea",0.65,0.55,"moderate"],["right upper quadrant pain",0.50,0.5,"moderate"],["loss of appetite",0.60,0.5,"moderate"],["dark urine",0.55,0.6,"moderate"],["fever",0.40,0.4,"moderate"],["arthralgia",0.30,0.4,"moderate"],["rash",0.20,0.35,"moderate"]],
      tests:[["HBsAg","serology","high"],["anti-HBc IgM","serology","high"],["HBV DNA","molecular","high"],["LFT","biochemistry","high"],["coagulation studies","hematology","moderate"]],
      treatments:[["supportive care","supportive","acute","AASLD"],["entecavir","nucleoside analog","if_severe","AASLD"],["tenofovir","nucleotide analog","chronic","AASLD"]]},
    {name:"hepatitis C",icd10:"B18.2",organ:"infectious",prior:0.01,severity:"moderate",
      symptoms:[["fatigue",0.65,0.5,"moderate"],["jaundice",0.35,0.6,"moderate"],["nausea",0.40,0.4,"moderate"],["right upper quadrant pain",0.35,0.4,"moderate"],["loss of appetite",0.40,0.4,"moderate"],["joint pain",0.30,0.35,"moderate"],["often asymptomatic",0.50,0.3,"low"]],
      tests:[["HCV antibody","serology","high"],["HCV RNA","molecular","high"],["LFT","biochemistry","high"],["FibroScan","imaging","moderate"],["genotype testing","molecular","moderate"]],
      treatments:[["sofosbuvir-velpatasvir","DAA","first_line","AASLD"],["glecaprevir-pibrentasvir","DAA","first_line","AASLD"]]},
    {name:"cellulitis",icd10:"L03.90",organ:"infectious",prior:0.04,severity:"moderate",
      symptoms:[["skin erythema spreading",0.92,0.9,"high"],["skin warmth",0.85,0.8,"high"],["skin swelling",0.80,0.75,"high"],["pain at site",0.85,0.75,"high"],["fever",0.55,0.55,"moderate"],["lymphangitis",0.30,0.65,"moderate"],["chills",0.35,0.4,"moderate"]],
      tests:[["CBC","hematology","moderate"],["blood culture","microbiology","if_systemic"],["CRP","inflammatory","moderate"],["wound culture","microbiology","if_purulent"]],
      treatments:[["cephalexin","cephalosporin","first_line","IDSA"],["clindamycin","lincosamide","MRSA","IDSA"],["trimethoprim-sulfamethoxazole","antibiotic","MRSA","IDSA"],["vancomycin","glycopeptide","severe","IDSA"]]},
    {name:"urinary tract infection",icd10:"N39.0",organ:"infectious",prior:0.08,severity:"low",
      symptoms:[["dysuria",0.90,0.85,"high"],["urinary frequency",0.85,0.8,"high"],["urgency",0.80,0.75,"high"],["suprapubic pain",0.60,0.6,"moderate"],["hematuria",0.40,0.5,"moderate"],["cloudy urine",0.50,0.5,"moderate"],["foul-smelling urine",0.45,0.45,"moderate"]],
      tests:[["urinalysis","microbiology","high"],["urine culture","microbiology","high"],["CBC","hematology","if_systemic"]],
      treatments:[["nitrofurantoin","nitrofuran","first_line","IDSA"],["trimethoprim-sulfamethoxazole","antibiotic","first_line","IDSA"],["fosfomycin","antibiotic","alternative","IDSA"]]},
    {name:"sepsis",icd10:"A41.9",organ:"infectious",prior:0.008,severity:"critical",
      symptoms:[["fever",0.85,0.75,"high"],["tachycardia",0.80,0.7,"high"],["hypotension",0.65,0.75,"high"],["tachypnea",0.70,0.65,"high"],["altered mental status",0.50,0.65,"moderate"],["oliguria",0.40,0.6,"moderate"],["mottled skin",0.30,0.7,"high"],["rigors",0.45,0.55,"moderate"],["hypothermia",0.25,0.6,"moderate"]],
      tests:[["blood culture x2","microbiology","high"],["lactate","biochemistry","high"],["procalcitonin","biomarker","high"],["CBC","hematology","high"],["metabolic panel","biochemistry","high"],["coagulation studies","hematology","moderate"]],
      treatments:[["piperacillin-tazobactam","penicillin","first_line","SSC"],["meropenem","carbapenem","first_line","SSC"],["norepinephrine","vasopressor","first_line","SSC"],["IV crystalloids","fluid","first_line","SSC"]]},
    {name:"infective endocarditis",icd10:"I33.0",organ:"infectious",prior:0.003,severity:"critical",
      symptoms:[["fever prolonged",0.90,0.8,"high"],["new heart murmur",0.70,0.85,"high"],["weight loss",0.45,0.5,"moderate"],["night sweats",0.50,0.5,"moderate"],["petechiae",0.35,0.6,"moderate"],["splinter hemorrhages",0.25,0.75,"high"],["janeway lesions",0.15,0.9,"high"],["osler nodes",0.15,0.85,"high"],["splenomegaly",0.30,0.5,"moderate"],["embolic events",0.30,0.7,"high"]],
      tests:[["blood culture x3","microbiology","high"],["transesophageal echocardiogram","cardiac","high"],["CBC","hematology","moderate"],["ESR CRP","inflammatory","moderate"]],
      treatments:[["vancomycin","glycopeptide","empiric","AHA"],["gentamicin","aminoglycoside","synergy","AHA"],["ceftriaxone","cephalosporin","streptococcal","AHA"]]},
  ];
}

// ══════════════════════════════════════════════════
// DERMATOLOGY (15 diseases)
// ══════════════════════════════════════════════════
function getDermatologyDiseases(): DiseaseEntry[] {
  return [
    {name:"psoriasis",icd10:"L40.9",organ:"dermatological",prior:0.025,severity:"moderate",
      symptoms:[["erythematous plaques with silver scales",0.90,0.9,"high"],["pruritus",0.65,0.6,"moderate"],["skin dryness",0.55,0.5,"moderate"],["nail pitting",0.45,0.7,"high"],["scalp involvement",0.55,0.55,"moderate"],["joint pain",0.30,0.5,"moderate"],["Auspitz sign",0.40,0.8,"high"],["Koebner phenomenon",0.35,0.7,"high"]],
      tests:[["clinical diagnosis","clinical","high"],["skin biopsy","pathology","moderate"],["ESR CRP","inflammatory","if_arthritis"]],
      treatments:[["betamethasone topical","corticosteroid","first_line","AAD"],["calcipotriene","vitamin D analog","first_line","AAD"],["methotrexate","immunosuppressant","moderate_severe","AAD"],["adalimumab","anti-TNF","moderate_severe","AAD"],["secukinumab","anti-IL17","moderate_severe","AAD"]]},
    {name:"eczema atopic dermatitis",icd10:"L20.9",organ:"dermatological",prior:0.10,severity:"low",
      symptoms:[["pruritus intense",0.95,0.9,"high"],["erythematous patches",0.80,0.75,"high"],["dry skin",0.85,0.75,"high"],["lichenification",0.50,0.65,"moderate"],["excoriations",0.55,0.55,"moderate"],["flexural distribution",0.65,0.7,"high"],["weeping lesions",0.40,0.5,"moderate"],["sleep disturbance from itch",0.55,0.5,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["serum IgE","immunology","moderate"],["skin prick testing","allergy","moderate"]],
      treatments:[["emollients","moisturizer","first_line","AAD"],["hydrocortisone topical","corticosteroid","first_line","AAD"],["tacrolimus topical","calcineurin inhibitor","steroid_sparing","AAD"],["dupilumab","anti-IL4/13","moderate_severe","AAD"]]},
    {name:"acne vulgaris",icd10:"L70.0",organ:"dermatological",prior:0.15,severity:"low",
      symptoms:[["comedones",0.90,0.85,"high"],["papules",0.80,0.75,"high"],["pustules",0.70,0.7,"high"],["nodules",0.35,0.6,"moderate"],["cysts",0.25,0.65,"moderate"],["facial involvement",0.85,0.7,"high"],["back involvement",0.40,0.5,"moderate"],["scarring",0.30,0.5,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["testosterone level","endocrine","if_female_severe"]],
      treatments:[["benzoyl peroxide","antimicrobial","first_line","AAD"],["tretinoin topical","retinoid","first_line","AAD"],["doxycycline","antibiotic","moderate","AAD"],["isotretinoin","retinoid","severe","AAD"],["spironolactone","antiandrogen","female","AAD"]]},
    {name:"urticaria",icd10:"L50.9",organ:"dermatological",prior:0.05,severity:"low",
      symptoms:[["wheals",0.95,0.9,"high"],["pruritus",0.90,0.85,"high"],["angioedema",0.35,0.7,"high"],["dermographism",0.40,0.65,"moderate"],["transient lesions",0.70,0.65,"moderate"],["worsening with heat",0.30,0.4,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["CBC","hematology","chronic"],["thyroid function tests","endocrine","chronic"],["IgE level","immunology","if_allergic"]],
      treatments:[["cetirizine","antihistamine","first_line","EAACI"],["loratadine","antihistamine","first_line","EAACI"],["omalizumab","anti-IgE","refractory","EAACI"]]},
    {name:"herpes zoster",icd10:"B02.9",organ:"dermatological",prior:0.02,severity:"moderate",
      symptoms:[["vesicular rash dermatomal",0.90,0.9,"high"],["burning pain",0.85,0.85,"high"],["unilateral rash",0.85,0.85,"high"],["prodromal pain before rash",0.65,0.7,"high"],["pruritus",0.45,0.4,"moderate"],["fever",0.30,0.35,"moderate"],["headache",0.30,0.3,"moderate"],["fatigue",0.35,0.3,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["VZV PCR","molecular","moderate"],["Tzanck smear","cytology","moderate"]],
      treatments:[["valacyclovir","antiviral","first_line","AAD"],["acyclovir","antiviral","first_line","AAD"],["gabapentin","anticonvulsant","neuropathic_pain","AAN"],["prednisone","corticosteroid","adjunct","AAD"]]},
    {name:"fungal skin infection tinea",icd10:"B35.9",organ:"dermatological",prior:0.08,severity:"low",
      symptoms:[["ring-shaped rash",0.80,0.8,"high"],["pruritus",0.75,0.65,"high"],["scaling",0.70,0.65,"high"],["erythema",0.65,0.55,"moderate"],["central clearing",0.60,0.7,"high"],["advancing border",0.55,0.65,"moderate"]],
      tests:[["KOH preparation","microbiology","high"],["fungal culture","microbiology","moderate"],["Wood lamp","dermatology","moderate"]],
      treatments:[["terbinafine topical","antifungal","first_line","AAD"],["clotrimazole topical","antifungal","first_line","AAD"],["terbinafine oral","antifungal","extensive","AAD"]]},
    {name:"scabies",icd10:"B86",organ:"dermatological",prior:0.03,severity:"low",
      symptoms:[["intense pruritus worse at night",0.95,0.9,"high"],["burrows",0.60,0.85,"high"],["papular rash",0.70,0.65,"high"],["interdigital involvement",0.55,0.7,"high"],["genital lesions",0.35,0.55,"moderate"],["secondary excoriations",0.55,0.5,"moderate"],["household contacts affected",0.45,0.65,"moderate"]],
      tests:[["skin scraping microscopy","microbiology","high"],["dermoscopy","dermatology","moderate"]],
      treatments:[["permethrin 5% cream","insecticide","first_line","CDC"],["ivermectin oral","antiparasitic","first_line","CDC"]]},
    {name:"Stevens-Johnson syndrome",icd10:"L51.1",organ:"dermatological",prior:0.001,severity:"critical",
      symptoms:[["fever prodromal",0.80,0.7,"high"],["skin pain",0.85,0.8,"high"],["mucosal erosions",0.90,0.9,"high"],["target lesions atypical",0.70,0.8,"high"],["skin blistering",0.80,0.85,"high"],["conjunctivitis",0.60,0.7,"high"],["dysphagia",0.45,0.5,"moderate"],["malaise",0.55,0.45,"moderate"]],
      tests:[["skin biopsy","pathology","high"],["CBC","hematology","moderate"],["metabolic panel","biochemistry","moderate"],["CRP","inflammatory","moderate"]],
      treatments:[["stop offending drug","withdrawal","critical","BAD"],["wound care","supportive","first_line","BAD"],["IVIG","immunoglobulin","if_severe","BAD"],["cyclosporine","immunosuppressant","if_severe","BAD"]]},
  ];
}

// ══════════════════════════════════════════════════
// HEMATOLOGY (15 diseases)
// ══════════════════════════════════════════════════
function getHematologyDiseases(): DiseaseEntry[] {
  return [
    {name:"iron deficiency anemia",icd10:"D50.9",organ:"hematological",prior:0.10,severity:"low",
      symptoms:[["fatigue",0.85,0.6,"high"],["pallor",0.70,0.65,"high"],["dyspnea on exertion",0.55,0.5,"moderate"],["dizziness",0.45,0.4,"moderate"],["pica",0.25,0.75,"high"],["koilonychia",0.20,0.8,"high"],["angular cheilitis",0.30,0.55,"moderate"],["glossitis",0.25,0.55,"moderate"],["brittle nails",0.35,0.5,"moderate"],["tachycardia",0.40,0.4,"moderate"]],
      tests:[["CBC","hematology","high"],["serum iron","biochemistry","high"],["ferritin","biochemistry","high"],["TIBC","biochemistry","high"],["reticulocyte count","hematology","moderate"],["peripheral smear","hematology","moderate"]],
      treatments:[["ferrous sulfate","iron supplement","first_line","ASH"],["IV iron sucrose","iron supplement","if_oral_intolerant","ASH"],["treat underlying cause","etiological","critical","ASH"]]},
    {name:"vitamin B12 deficiency",icd10:"D51.9",organ:"hematological",prior:0.03,severity:"moderate",
      symptoms:[["fatigue",0.80,0.55,"moderate"],["paresthesias",0.65,0.65,"high"],["glossitis",0.45,0.6,"moderate"],["pallor",0.55,0.55,"moderate"],["ataxia",0.40,0.6,"moderate"],["cognitive impairment",0.35,0.5,"moderate"],["depression",0.30,0.35,"moderate"],["peripheral neuropathy",0.55,0.6,"moderate"]],
      tests:[["serum vitamin B12","biochemistry","high"],["methylmalonic acid","biochemistry","high"],["homocysteine","biochemistry","moderate"],["CBC","hematology","high"],["peripheral smear","hematology","high"],["intrinsic factor antibodies","immunology","moderate"]],
      treatments:[["cyanocobalamin IM","vitamin","first_line","ASH"],["cyanocobalamin oral high dose","vitamin","alternative","ASH"]]},
    {name:"sickle cell disease",icd10:"D57.1",organ:"hematological",prior:0.005,severity:"high",
      symptoms:[["pain crisis",0.90,0.9,"high"],["bone pain",0.80,0.75,"high"],["fatigue",0.70,0.55,"moderate"],["jaundice",0.55,0.6,"moderate"],["pallor",0.50,0.5,"moderate"],["shortness of breath",0.40,0.45,"moderate"],["swollen hands feet",0.45,0.65,"moderate"],["recurrent infections",0.40,0.5,"moderate"],["priapism",0.20,0.8,"high"],["splenic sequestration",0.25,0.8,"high"]],
      tests:[["hemoglobin electrophoresis","hematology","high"],["CBC","hematology","high"],["reticulocyte count","hematology","high"],["peripheral smear","hematology","high"],["LDH","biochemistry","moderate"],["bilirubin","biochemistry","moderate"]],
      treatments:[["hydroxyurea","antimetabolite","first_line","ASH"],["voxelotor","anti-sickling","adjunct","ASH"],["crizanlizumab","anti-P-selectin","prevention","ASH"],["blood transfusion","supportive","acute","ASH"]]},
    {name:"immune thrombocytopenia",icd10:"D69.3",organ:"hematological",prior:0.005,severity:"moderate",
      symptoms:[["easy bruising",0.85,0.8,"high"],["petechiae",0.80,0.8,"high"],["mucosal bleeding",0.55,0.65,"moderate"],["menorrhagia",0.45,0.55,"moderate"],["epistaxis",0.50,0.55,"moderate"],["gum bleeding",0.40,0.5,"moderate"],["fatigue",0.35,0.3,"moderate"]],
      tests:[["CBC with platelet","hematology","high"],["peripheral smear","hematology","high"],["coagulation studies","hematology","moderate"],["anti-platelet antibodies","immunology","moderate"],["bone marrow biopsy","pathology","if_atypical"]],
      treatments:[["prednisone","corticosteroid","first_line","ASH"],["IVIG","immunoglobulin","first_line","ASH"],["eltrombopag","TPO agonist","second_line","ASH"],["rituximab","anti-CD20","refractory","ASH"]]},
    {name:"disseminated intravascular coagulation",icd10:"D65",organ:"hematological",prior:0.002,severity:"critical",
      symptoms:[["bleeding from multiple sites",0.85,0.9,"high"],["petechiae",0.65,0.7,"high"],["ecchymoses",0.60,0.65,"moderate"],["oozing from IV sites",0.55,0.75,"high"],["organ dysfunction",0.50,0.6,"moderate"],["thrombosis",0.40,0.6,"moderate"],["shock",0.35,0.6,"moderate"]],
      tests:[["PT PTT","hematology","high"],["fibrinogen","hematology","high"],["D-dimer","hematology","high"],["CBC with platelet","hematology","high"],["peripheral smear","hematology","high"],["fibrin degradation products","hematology","high"]],
      treatments:[["treat underlying cause","etiological","critical","ISTH"],["platelet transfusion","blood product","if_bleeding","ISTH"],["FFP","blood product","if_bleeding","ISTH"],["cryoprecipitate","blood product","low_fibrinogen","ISTH"]]},
    {name:"hemophilia A",icd10:"D66",organ:"hematological",prior:0.001,severity:"high",
      symptoms:[["hemarthrosis",0.80,0.85,"high"],["easy bruising",0.75,0.7,"high"],["prolonged bleeding after injury",0.85,0.85,"high"],["muscle hematomas",0.55,0.65,"moderate"],["joint swelling",0.60,0.6,"moderate"],["GI bleeding",0.30,0.5,"moderate"],["intracranial hemorrhage",0.10,0.9,"high"]],
      tests:[["PTT prolonged","hematology","high"],["factor VIII level","hematology","high"],["mixing study corrects","hematology","high"],["PT normal","hematology","moderate"],["platelet count normal","hematology","moderate"]],
      treatments:[["factor VIII concentrate","replacement","first_line","WFH"],["emicizumab","bispecific antibody","prophylaxis","WFH"],["desmopressin","hormone","mild","WFH"]]},
    {name:"thalassemia major",icd10:"D56.1",organ:"hematological",prior:0.003,severity:"high",
      symptoms:[["severe anemia",0.90,0.85,"high"],["pallor",0.80,0.75,"high"],["fatigue",0.75,0.6,"moderate"],["hepatosplenomegaly",0.70,0.7,"high"],["growth retardation",0.55,0.6,"moderate"],["skeletal deformities",0.40,0.7,"high"],["jaundice",0.45,0.5,"moderate"],["iron overload symptoms",0.50,0.6,"moderate"]],
      tests:[["CBC","hematology","high"],["hemoglobin electrophoresis","hematology","high"],["peripheral smear","hematology","high"],["iron studies","biochemistry","high"],["ferritin","biochemistry","high"]],
      treatments:[["regular blood transfusion","supportive","first_line","TIF"],["deferasirox","iron chelator","first_line","TIF"],["luspatercept","erythroid maturation agent","adjunct","TIF"]]},
  ];
}

// ══════════════════════════════════════════════════
// RHEUMATOLOGY (15 diseases)
// ══════════════════════════════════════════════════
function getRheumatologyDiseases(): DiseaseEntry[] {
  return [
    {name:"rheumatoid arthritis",icd10:"M06.9",organ:"rheumatological",prior:0.01,severity:"moderate",
      symptoms:[["joint pain symmetric",0.85,0.8,"high"],["morning stiffness over 1 hour",0.80,0.8,"high"],["joint swelling",0.80,0.75,"high"],["fatigue",0.60,0.5,"moderate"],["metacarpophalangeal joint involvement",0.65,0.75,"high"],["rheumatoid nodules",0.25,0.75,"high"],["joint warmth",0.55,0.55,"moderate"],["grip weakness",0.50,0.5,"moderate"]],
      tests:[["RF","immunology","high"],["anti-CCP","immunology","high"],["ESR CRP","inflammatory","high"],["X-ray hands","imaging","moderate"],["joint ultrasound","imaging","moderate"]],
      treatments:[["methotrexate","DMARD","first_line","ACR"],["hydroxychloroquine","DMARD","mild","ACR"],["sulfasalazine","DMARD","first_line","ACR"],["adalimumab","anti-TNF","moderate_severe","ACR"],["tofacitinib","JAK inhibitor","moderate_severe","ACR"]]},
    {name:"systemic lupus erythematosus",icd10:"M32.9",organ:"rheumatological",prior:0.005,severity:"high",
      symptoms:[["butterfly rash",0.55,0.9,"high"],["joint pain",0.80,0.7,"high"],["fatigue",0.85,0.55,"moderate"],["photosensitivity",0.55,0.7,"high"],["oral ulcers",0.40,0.55,"moderate"],["pleuritis",0.35,0.55,"moderate"],["nephritis",0.40,0.7,"high"],["hair loss",0.45,0.55,"moderate"],["Raynaud phenomenon",0.35,0.5,"moderate"],["fever",0.40,0.4,"moderate"]],
      tests:[["ANA","immunology","high"],["anti-dsDNA","immunology","high"],["complement C3 C4","immunology","high"],["CBC","hematology","moderate"],["urinalysis","microbiology","moderate"],["anti-Smith","immunology","moderate"],["renal function","biochemistry","moderate"]],
      treatments:[["hydroxychloroquine","DMARD","first_line","ACR"],["prednisone","corticosteroid","flare","ACR"],["mycophenolate mofetil","immunosuppressant","nephritis","ACR"],["belimumab","anti-BLyS","moderate_severe","ACR"],["azathioprine","immunosuppressant","maintenance","ACR"]]},
    {name:"gout",icd10:"M10.9",organ:"rheumatological",prior:0.03,severity:"moderate",
      symptoms:[["acute joint pain",0.92,0.85,"high"],["first MTP joint involvement",0.70,0.85,"high"],["joint swelling",0.85,0.8,"high"],["joint redness",0.80,0.75,"high"],["joint warmth",0.75,0.7,"high"],["tophi",0.25,0.85,"high"],["fever",0.30,0.35,"moderate"],["inability to bear weight",0.55,0.55,"moderate"]],
      tests:[["serum uric acid","biochemistry","moderate"],["joint fluid analysis","invasive","high"],["negatively birefringent crystals","microscopy","high"],["X-ray affected joint","imaging","moderate"],["renal function","biochemistry","moderate"]],
      treatments:[["colchicine","anti-inflammatory","acute","ACR"],["indomethacin","NSAID","acute","ACR"],["prednisone","corticosteroid","acute","ACR"],["allopurinol","xanthine oxidase inhibitor","prophylaxis","ACR"],["febuxostat","xanthine oxidase inhibitor","alternative","ACR"]]},
    {name:"ankylosing spondylitis",icd10:"M45.9",organ:"rheumatological",prior:0.005,severity:"moderate",
      symptoms:[["low back pain inflammatory",0.90,0.85,"high"],["morning stiffness improving with exercise",0.80,0.8,"high"],["sacroiliac joint pain",0.75,0.8,"high"],["reduced spinal mobility",0.65,0.7,"high"],["enthesitis",0.45,0.6,"moderate"],["peripheral arthritis",0.35,0.45,"moderate"],["uveitis",0.25,0.65,"moderate"],["fatigue",0.55,0.45,"moderate"]],
      tests:[["HLA-B27","genetic","moderate"],["X-ray pelvis","imaging","moderate"],["MRI sacroiliac joints","imaging","high"],["ESR CRP","inflammatory","moderate"]],
      treatments:[["naproxen","NSAID","first_line","ASAS"],["adalimumab","anti-TNF","second_line","ASAS"],["secukinumab","anti-IL17","second_line","ASAS"],["sulfasalazine","DMARD","peripheral","ASAS"]]},
    {name:"osteoarthritis",icd10:"M19.90",organ:"rheumatological",prior:0.15,severity:"low",
      symptoms:[["joint pain worse with activity",0.90,0.85,"high"],["morning stiffness less than 30 min",0.75,0.75,"high"],["joint crepitus",0.65,0.7,"high"],["joint swelling bony",0.55,0.6,"moderate"],["reduced range of motion",0.70,0.65,"high"],["Heberden nodes",0.35,0.8,"high"],["Bouchard nodes",0.30,0.75,"high"]],
      tests:[["X-ray affected joint","imaging","high"],["clinical diagnosis","clinical","high"],["ESR CRP normal","inflammatory","moderate"]],
      treatments:[["acetaminophen","analgesic","first_line","OARSI"],["diclofenac topical","NSAID topical","first_line","OARSI"],["ibuprofen","NSAID","if_needed","OARSI"],["intra-articular corticosteroid","injection","if_effusion","OARSI"]]},
    {name:"fibromyalgia",icd10:"M79.7",organ:"rheumatological",prior:0.04,severity:"low",
      symptoms:[["widespread pain",0.95,0.85,"high"],["fatigue",0.85,0.65,"high"],["sleep disturbance",0.80,0.7,"high"],["cognitive dysfunction fibro fog",0.65,0.65,"high"],["tender points",0.70,0.7,"high"],["headache",0.50,0.4,"moderate"],["depression",0.45,0.4,"moderate"],["irritable bowel symptoms",0.35,0.4,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["CBC","hematology","to_exclude"],["TSH","endocrine","to_exclude"],["ESR CRP normal","inflammatory","to_exclude"]],
      treatments:[["duloxetine","SNRI","first_line","ACR"],["pregabalin","anticonvulsant","first_line","ACR"],["milnacipran","SNRI","first_line","ACR"],["exercise program","non-pharmacologic","first_line","EULAR"]]},
    {name:"polymyalgia rheumatica",icd10:"M35.3",organ:"rheumatological",prior:0.005,severity:"moderate",
      symptoms:[["bilateral shoulder pain",0.90,0.85,"high"],["bilateral hip pain",0.75,0.75,"high"],["morning stiffness severe",0.85,0.8,"high"],["fatigue",0.60,0.5,"moderate"],["fever low grade",0.35,0.4,"moderate"],["weight loss",0.30,0.4,"moderate"],["difficulty raising arms",0.65,0.65,"high"]],
      tests:[["ESR markedly elevated","inflammatory","high"],["CRP elevated","inflammatory","high"],["CBC","hematology","moderate"],["temporal artery biopsy","pathology","if_GCA_suspected"]],
      treatments:[["prednisone low dose","corticosteroid","first_line","ACR"],["methotrexate","DMARD","steroid_sparing","ACR"]]},
    {name:"giant cell arteritis",icd10:"M31.6",organ:"rheumatological",prior:0.003,severity:"critical",
      symptoms:[["new onset headache temporal",0.85,0.85,"high"],["scalp tenderness",0.65,0.7,"high"],["jaw claudication",0.50,0.85,"high"],["visual disturbance",0.45,0.8,"high"],["temporal artery tenderness",0.55,0.8,"high"],["fever",0.40,0.45,"moderate"],["polymyalgia symptoms",0.50,0.6,"moderate"],["fatigue",0.45,0.4,"moderate"]],
      tests:[["ESR markedly elevated","inflammatory","high"],["CRP elevated","inflammatory","high"],["temporal artery biopsy","pathology","high"],["temporal artery ultrasound","imaging","moderate"]],
      treatments:[["prednisone high dose","corticosteroid","first_line","ACR"],["tocilizumab","anti-IL6","steroid_sparing","ACR"],["aspirin low dose","antiplatelet","adjunct","ACR"]]},
  ];
}

// ══════════════════════════════════════════════════
// ENT (10 diseases)
// ══════════════════════════════════════════════════
function getENTDiseases(): DiseaseEntry[] {
  return [
    {name:"acute otitis media",icd10:"H66.90",organ:"ENT",prior:0.06,severity:"low",
      symptoms:[["ear pain",0.90,0.85,"high"],["fever",0.60,0.55,"moderate"],["hearing loss",0.55,0.55,"moderate"],["ear fullness",0.65,0.6,"moderate"],["irritability in children",0.55,0.5,"moderate"],["otorrhea",0.35,0.65,"moderate"],["bulging tympanic membrane",0.60,0.8,"high"]],
      tests:[["otoscopy","ENT","high"],["tympanometry","ENT","moderate"],["audiometry","ENT","if_hearing_loss"]],
      treatments:[["amoxicillin","penicillin","first_line","AAP"],["amoxicillin-clavulanate","penicillin","if_resistant","AAP"],["watchful waiting","conservative","mild","AAP"]]},
    {name:"acute sinusitis",icd10:"J01.90",organ:"ENT",prior:0.08,severity:"low",
      symptoms:[["facial pain pressure",0.85,0.8,"high"],["nasal congestion",0.90,0.8,"high"],["purulent nasal discharge",0.75,0.75,"high"],["headache frontal",0.60,0.55,"moderate"],["anosmia",0.40,0.45,"moderate"],["cough",0.45,0.4,"moderate"],["fever",0.40,0.4,"moderate"],["dental pain upper",0.30,0.5,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["CT sinuses","imaging","if_complicated"]],
      treatments:[["amoxicillin-clavulanate","penicillin","first_line","IDSA"],["saline nasal irrigation","supportive","first_line","AAO-HNS"],["fluticasone nasal spray","corticosteroid","adjunct","AAO-HNS"]]},
    {name:"allergic rhinitis",icd10:"J30.9",organ:"ENT",prior:0.20,severity:"low",
      symptoms:[["sneezing",0.85,0.8,"high"],["rhinorrhea watery",0.85,0.8,"high"],["nasal congestion",0.80,0.7,"high"],["nasal pruritus",0.75,0.7,"high"],["eye itching",0.60,0.6,"moderate"],["tearing",0.50,0.5,"moderate"],["allergic shiners",0.30,0.55,"moderate"],["nasal crease",0.25,0.55,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["skin prick testing","allergy","moderate"],["serum specific IgE","immunology","moderate"]],
      treatments:[["cetirizine","antihistamine","first_line","ARIA"],["fluticasone nasal","corticosteroid","first_line","ARIA"],["montelukast","LTRA","adjunct","ARIA"],["immunotherapy","desensitization","definitive","ARIA"]]},
    {name:"pharyngitis streptococcal",icd10:"J02.0",organ:"ENT",prior:0.05,severity:"low",
      symptoms:[["sore throat",0.92,0.85,"high"],["fever",0.75,0.7,"high"],["tonsillar exudate",0.65,0.75,"high"],["tender cervical lymphadenopathy",0.70,0.7,"high"],["dysphagia",0.55,0.5,"moderate"],["headache",0.40,0.35,"moderate"],["absence of cough",0.55,0.5,"moderate"],["abdominal pain in children",0.30,0.35,"moderate"]],
      tests:[["rapid strep test","microbiology","high"],["throat culture","microbiology","high"],["Centor score","clinical","moderate"]],
      treatments:[["penicillin V","penicillin","first_line","IDSA"],["amoxicillin","penicillin","first_line","IDSA"],["azithromycin","macrolide","penicillin_allergy","IDSA"]]},
    {name:"peritonsillar abscess",icd10:"J36",organ:"ENT",prior:0.005,severity:"moderate",
      symptoms:[["severe sore throat unilateral",0.90,0.9,"high"],["trismus",0.70,0.8,"high"],["uvular deviation",0.65,0.85,"high"],["fever",0.70,0.65,"high"],["muffled voice",0.60,0.7,"high"],["drooling",0.45,0.6,"moderate"],["referred ear pain",0.40,0.5,"moderate"]],
      tests:[["CT neck with contrast","imaging","if_unclear"],["needle aspiration","invasive","diagnostic_therapeutic"],["CBC","hematology","moderate"]],
      treatments:[["needle aspiration or I&D","procedural","first_line","AAO-HNS"],["amoxicillin-clavulanate","penicillin","first_line","AAO-HNS"],["clindamycin","lincosamide","alternative","AAO-HNS"]]},
    {name:"sudden sensorineural hearing loss",icd10:"H91.20",organ:"ENT",prior:0.003,severity:"high",
      symptoms:[["sudden hearing loss unilateral",0.95,0.95,"high"],["tinnitus",0.65,0.65,"moderate"],["ear fullness",0.55,0.55,"moderate"],["vertigo",0.40,0.5,"moderate"],["nausea",0.25,0.3,"moderate"]],
      tests:[["audiometry",  "ENT","high"],["MRI brain IAC","imaging","high"],["CBC","hematology","moderate"],["autoimmune panel","immunology","moderate"]],
      treatments:[["prednisone high dose","corticosteroid","first_line","AAO-HNS"],["intratympanic dexamethasone","corticosteroid","adjunct","AAO-HNS"]]},
    {name:"benign paroxysmal positional vertigo",icd10:"H81.10",organ:"ENT",prior:0.04,severity:"low",
      symptoms:[["brief episodes of vertigo",0.92,0.9,"high"],["vertigo triggered by head position",0.90,0.9,"high"],["nystagmus",0.75,0.8,"high"],["nausea",0.55,0.5,"moderate"],["imbalance",0.50,0.5,"moderate"],["no hearing loss",0.60,0.5,"moderate"]],
      tests:[["Dix-Hallpike maneuver","clinical","high"],["audiometry","ENT","to_exclude"]],
      treatments:[["Epley maneuver","repositioning","first_line","AAN"],["Brandt-Daroff exercises","physiotherapy","adjunct","AAN"]]},
    {name:"Meniere disease",icd10:"H81.0",organ:"ENT",prior:0.005,severity:"moderate",
      symptoms:[["episodic vertigo","0.90",0.9,"high"],["fluctuating hearing loss",0.80,0.85,"high"],["tinnitus",0.80,0.8,"high"],["ear fullness",0.75,0.75,"high"],["nausea",0.55,0.5,"moderate"],["vomiting",0.40,0.4,"moderate"]],
      tests:[["audiometry","ENT","high"],["electrocochleography","ENT","moderate"],["MRI brain IAC","imaging","to_exclude"]],
      treatments:[["betahistine","histamine analog","first_line","AAO-HNS"],["hydrochlorothiazide","diuretic","first_line","AAO-HNS"],["dietary salt restriction","lifestyle","adjunct","AAO-HNS"]]},
  ];
}

// ══════════════════════════════════════════════════
// PEDIATRICS (10 diseases)
// ══════════════════════════════════════════════════
function getPediatricDiseases(): DiseaseEntry[] {
  return [
    {name:"bronchiolitis",icd10:"J21.9",organ:"pediatric",prior:0.04,severity:"moderate",
      symptoms:[["cough",0.90,0.75,"high"],["wheezing",0.80,0.7,"high"],["rhinorrhea",0.85,0.7,"high"],["tachypnea",0.70,0.65,"high"],["feeding difficulty",0.60,0.6,"moderate"],["fever low grade",0.45,0.4,"moderate"],["nasal flaring",0.40,0.55,"moderate"],["chest retractions",0.50,0.6,"moderate"],["apnea in young infants",0.25,0.8,"high"]],
      tests:[["clinical diagnosis","clinical","high"],["RSV test","virology","moderate"],["chest X-ray","imaging","if_severe"],["pulse oximetry","monitoring","high"]],
      treatments:[["supportive care","supportive","first_line","AAP"],["supplemental oxygen","supportive","if_hypoxic","AAP"],["nasal suctioning","supportive","first_line","AAP"]]},
    {name:"croup",icd10:"J05.0",organ:"pediatric",prior:0.03,severity:"moderate",
      symptoms:[["barking cough",0.92,0.9,"high"],["stridor inspiratory",0.80,0.85,"high"],["hoarseness",0.70,0.65,"high"],["fever",0.50,0.45,"moderate"],["rhinorrhea",0.55,0.45,"moderate"],["worse at night",0.60,0.6,"moderate"],["respiratory distress",0.40,0.55,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"],["X-ray neck steeple sign","imaging","moderate"],["pulse oximetry","monitoring","moderate"]],
      treatments:[["dexamethasone single dose","corticosteroid","first_line","AAP"],["nebulized epinephrine","sympathomimetic","severe","AAP"],["cool mist","supportive","adjunct","AAP"]]},
    {name:"Kawasaki disease",icd10:"M30.3",organ:"pediatric",prior:0.002,severity:"critical",
      symptoms:[["fever over 5 days",0.95,0.9,"high"],["bilateral conjunctivitis non-purulent",0.80,0.85,"high"],["erythema of lips and oral cavity",0.75,0.8,"high"],["rash polymorphous",0.70,0.7,"high"],["cervical lymphadenopathy",0.55,0.6,"moderate"],["edema of hands feet",0.60,0.7,"high"],["desquamation of fingers",0.50,0.8,"high"],["irritability extreme",0.55,0.55,"moderate"]],
      tests:[["echocardiogram","cardiac","high"],["CBC","hematology","high"],["ESR CRP","inflammatory","high"],["LFT","biochemistry","moderate"],["urinalysis","microbiology","moderate"]],
      treatments:[["IVIG","immunoglobulin","first_line","AHA"],["aspirin high dose","antiplatelet","first_line","AHA"],["aspirin low dose maintenance","antiplatelet","maintenance","AHA"]]},
    {name:"hand foot and mouth disease",icd10:"B08.4",organ:"pediatric",prior:0.04,severity:"low",
      symptoms:[["fever",0.75,0.6,"moderate"],["oral vesicles",0.85,0.85,"high"],["vesicular rash on hands",0.80,0.8,"high"],["vesicular rash on feet",0.75,0.75,"high"],["sore throat",0.60,0.5,"moderate"],["loss of appetite",0.55,0.45,"moderate"],["irritability",0.45,0.4,"moderate"]],
      tests:[["clinical diagnosis","clinical","high"]],
      treatments:[["supportive care","supportive","first_line","AAP"],["acetaminophen","analgesic","symptomatic","AAP"],["oral fluids","hydration","supportive","AAP"]]},
    {name:"febrile seizure",icd10:"R56.00",organ:"pediatric",prior:0.03,severity:"moderate",
      symptoms:[["fever",0.95,0.85,"high"],["seizure during fever",0.95,0.95,"high"],["loss of consciousness",0.70,0.65,"moderate"],["tonic-clonic movements",0.60,0.7,"high"],["post-ictal drowsiness",0.65,0.6,"moderate"]],
      tests:[["blood glucose","biochemistry","moderate"],["CBC","hematology","moderate"],["urinalysis","microbiology","to_find_source"],["lumbar puncture","invasive","if_meningitis_suspected"]],
      treatments:[["fever management","supportive","first_line","AAP"],["acetaminophen","antipyretic","symptomatic","AAP"],["reassurance and education","counseling","first_line","AAP"]]},
    {name:"intussusception",icd10:"K56.1",organ:"pediatric",prior:0.003,severity:"critical",
      symptoms:[["colicky abdominal pain episodic",0.90,0.9,"high"],["currant jelly stool",0.50,0.9,"high"],["vomiting",0.80,0.7,"high"],["palpable sausage-shaped mass",0.45,0.85,"high"],["lethargy between episodes",0.55,0.65,"moderate"],["rectal bleeding",0.40,0.7,"high"],["drawing up legs",0.60,0.65,"moderate"]],
      tests:[["abdominal ultrasound target sign","imaging","high"],["abdominal X-ray","imaging","moderate"],["air enema","diagnostic_therapeutic","high"]],
      treatments:[["air or barium enema reduction","non-surgical","first_line","APSA"],["surgical reduction","surgical","if_failed_or_peritonitis","APSA"],["IV fluids","supportive","first_line","APSA"]]},
  ];
}

// ══════════════════════════════════════════════════
// SHARED UPSERT ENGINE (same as batch2)
// ══════════════════════════════════════════════════
async function processDiseases(supabase: any, diseases: DiseaseEntry[], log: string[], addLog: (m:string)=>void) {
  const uniqueSymptoms = new Set<string>();
  for (const d of diseases) for (const [sym] of d.symptoms) uniqueSymptoms.add(sym);
  addLog(`Unique symptoms: ${uniqueSymptoms.size}`);

  addLog("Upserting diagnoses...");
  const diagRows = diseases.map(d => ({ diagnosis_name: d.name, icd10_code: d.icd10, category: d.organ }));
  for (let i = 0; i < diagRows.length; i += 100) {
    const { error } = await supabase.from("diagnoses").upsert(diagRows.slice(i, i+100), { onConflict: "diagnosis_name", ignoreDuplicates: true });
    if (error) addLog(`  Diagnoses error: ${error.message}`);
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

  addLog("Upserting symptoms...");
  const symRows = Array.from(uniqueSymptoms).map(s => ({ symptom_name: s, category: "general" }));
  for (let i = 0; i < symRows.length; i += 100) {
    const { error } = await supabase.from("symptoms").upsert(symRows.slice(i, i+100), { onConflict: "symptom_name", ignoreDuplicates: true });
    if (error) addLog(`  Symptoms error: ${error.message}`);
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

  addLog("Upserting disease priors...");
  const priorRows = diseases.filter(d => allDiagIds[d.name]).map(d => ({
    diagnosis_id: allDiagIds[d.name], base_prevalence: d.prior,
    age_modifier: {}, sex_modifier: {}, region_modifier: {},
  }));
  for (let i = 0; i < priorRows.length; i += 100) {
    const { error } = await supabase.from("disease_priors").upsert(priorRows.slice(i, i+100), { onConflict: "diagnosis_id", ignoreDuplicates: false });
    if (error) addLog(`  Priors error: ${error.message}`);
  }

  addLog("Upserting symptom likelihoods...");
  const likRows: any[] = [];
  for (const d of diseases) {
    const dId = allDiagIds[d.name]; if (!dId) continue;
    for (const [sym, prob] of d.symptoms) {
      const sId = allSymIds[sym]; if (!sId) continue;
      likRows.push({ symptom_id: sId, diagnosis_id: dId, likelihood_value: prob });
    }
  }
  let likCount = 0;
  for (let i = 0; i < likRows.length; i += 200) {
    const { error } = await supabase.from("symptom_likelihoods").upsert(likRows.slice(i, i+200), { onConflict: "symptom_id,diagnosis_id", ignoreDuplicates: false });
    if (error) addLog(`  Likelihoods error: ${error.message}`);
    else likCount += likRows.slice(i, i+200).length;
  }
  addLog(`  Likelihoods upserted: ${likCount}`);

  addLog("Upserting disease tests...");
  const testRows = diseases.flatMap(d => d.tests.map(([t,c,s]) => ({ disease_name: d.name, test_name: t, test_category: c, diagnostic_strength: s })));
  let testCount = 0;
  for (let i = 0; i < testRows.length; i += 200) {
    const { error } = await supabase.from("disease_tests").upsert(testRows.slice(i, i+200), { onConflict: "disease_name,test_name", ignoreDuplicates: true });
    if (error) addLog(`  Tests error: ${error.message}`);
    else testCount += testRows.slice(i, i+200).length;
  }
  addLog(`  Tests upserted: ${testCount}`);

  addLog("Upserting disease treatments...");
  const txRows = diseases.flatMap(d => d.treatments.map(([drug,cls,line,src]) => ({ disease_name: d.name, drug_name: drug, drug_class: cls, line_of_treatment: line, guideline_source: src })));
  let txCount = 0;
  for (let i = 0; i < txRows.length; i += 200) {
    const { error } = await supabase.from("disease_treatments").upsert(txRows.slice(i, i+200), { onConflict: "disease_name,drug_name", ignoreDuplicates: true });
    if (error) addLog(`  Treatments error: ${error.message}`);
    else txCount += txRows.slice(i, i+200).length;
  }
  addLog(`  Treatments upserted: ${txCount}`);

  return { diagnoses: diagRows.length, likelihoods: likCount, tests: testCount, treatments: txCount };
}

// ══════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const body = await req.json().catch(() => ({}));
  const batch: string = body.batch || "all";
  const log: string[] = [];
  const addLog = (msg: string) => { log.push(msg); console.log(msg); };

  addLog(`=== KG Expansion Batch 3 — ${batch} ===`);

  try {
    let diseases: DiseaseEntry[] = [];
    if (batch === "all" || batch === "infectious") diseases.push(...getInfectiousDiseases());
    if (batch === "all" || batch === "dermatology") diseases.push(...getDermatologyDiseases());
    if (batch === "all" || batch === "hematology") diseases.push(...getHematologyDiseases());
    if (batch === "all" || batch === "rheumatology") diseases.push(...getRheumatologyDiseases());
    if (batch === "all" || batch === "ent") diseases.push(...getENTDiseases());
    if (batch === "all" || batch === "pediatrics") diseases.push(...getPediatricDiseases());

    addLog(`Total diseases: ${diseases.length}`);
    const stats = await processDiseases(supabase, diseases, log, addLog);

    addLog("=== VALIDATION ===");
    const counts: Record<string, number> = {};
    for (const table of ["diagnoses","symptoms","symptom_likelihoods","disease_priors","disease_tests","disease_treatments"]) {
      const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
      counts[table] = count || 0;
      addLog(`  ${table}: ${count}`);
    }

    return new Response(JSON.stringify({ success: true, batch, stats, counts, log }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    addLog(`FATAL: ${err.message}`);
    return new Response(JSON.stringify({ success: false, error: err.message, log }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
