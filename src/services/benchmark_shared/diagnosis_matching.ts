/**
 * Unified Diagnosis Matching — Single Source of Truth
 *
 * Consolidates the synonym maps from v9 and v10 into one canonical set.
 * Both benchmark runners MUST use this module to ensure consistent matching.
 *
 * v2: Expanded with ~60 new entries covering all v10 benchmark gold diagnoses.
 */

const SYNONYM_MAP: Record<string, string[]> = {
  // ── Respiratory ──
  pneumonia: ["communityacquiredpneumonia", "cap", "lobarpneumonia", "bronchopneumonia"],
  communityacquiredpneumonia: ["pneumonia", "cap"],
  asthma: ["asthmaexacerbation", "acuteasthma", "bronchialasthma"],
  asthmaexacerbation: ["asthma"],
  copdexacerbation: ["copd", "chronicobstructivepulmonarydisease"],
  copd: ["copdexacerbation", "chronicobstructivepulmonarydisease"],
  chronicobstructivepulmonarydisease: ["copd", "copdexacerbation"],
  pulmonaryembolism: ["pe", "lungclot", "massivepulmonaryembolism", "subsegmentalpe"],
  pe: ["pulmonaryembolism"],
  massivepulmonaryembolism: ["pulmonaryembolism", "pe"],
  pneumothorax: ["collapsedlung", "tensionpneumothorax"],
  tensionpneumothorax: ["pneumothorax"],
  pleuraleffusion: ["pleuralfluid", "fluidonlung"],
  tuberculosis: ["tb", "pulmonarytuberculosis"],
  tb: ["tuberculosis"],
  croup: ["laryngotracheitis", "laryngotracheobronchitis"],
  laryngotracheitis: ["croup"],
  bronchitis: ["acutebronchitis"],
  lungcancer: ["bronchogeniccarcinoma", "pulmonaryneoplasm"],
  vocalcorddysfunction: ["vcd", "paradoxicalvocalfoldmotion"],

  // ── GI ──
  gastroenteritis: ["acutegastroenteritis", "stomachflu", "viralenteritis"],
  acutegastroenteritis: ["gastroenteritis"],
  appendicitis: ["acuteappendicitis"],
  acuteappendicitis: ["appendicitis"],
  pancreatitis: ["acutepancreatitis"],
  acutepancreatitis: ["pancreatitis"],
  pepticulcerdisease: ["pepticulcer", "gastricculcer", "duodenalulcer", "pud"],
  pepticulcer: ["pepticulcerdisease", "pud"],
  pud: ["pepticulcerdisease", "pepticulcer"],
  cholecystitis: ["acutecholecystitis", "gallbladderinflammation"],
  acutecholecystitis: ["cholecystitis"],
  gerd: ["gastroesophagealrefluxdisease", "acidreflux"],
  gastroesophagealrefluxdisease: ["gerd"],
  uppergibleed: ["uppergastrointestinalbleed", "gibleed", "gibleed", "gihaemorrhage"],
  celiacdisease: ["celiac", "glutenenteropathy", "coeliacdisease"],
  diverticulitis: ["acutediverticulitis"],
  hepatitisa: ["hepatitis", "viralhepatitis"],
  hepatitisb: ["hepatitis"],
  inflammatoryboweldisease: ["ibd", "crohnsdisease", "ulcerativecolitis"],
  ibd: ["inflammatoryboweldisease"],
  irritablebowelsyndrome: ["ibs"],
  ibs: ["irritablebowelsyndrome"],
  chronicmesentericischemia: ["mesentericischemia", "intestinalischemia"],
  mesentericischemia: ["chronicmesentericischemia"],
  smallbowelobstruction: ["sbo", "bowelobstruction", "intestinalobstruction"],
  sbo: ["smallbowelobstruction"],
  perforatedduodenalulcer: ["perforatedviscus", "perforatedpepticulcer"],
  perforatedviscus: ["perforatedduodenalulcer"],
  strangulatedinguinalhernia: ["strangulatedhernia", "incarceratedhernia"],
  strangulatedhernia: ["strangulatedinguinalhernia"],
  intussusception: ["ileocolicintussusception"],
  pyloricstenosis: ["infantilehypertrophicpyloricstenosis", "ihps"],

  // ── Cardiac ──
  acutecoronarysyndrome: ["acs", "myocardialinfarction", "heartattack", "unstableangina"],
  myocardialinfarction: ["acutecoronarysyndrome", "heartattack", "mi", "stemi", "nstemi", "silentmi"],
  mi: ["myocardialinfarction", "acutecoronarysyndrome"],
  pericarditis: ["acutepericarditis"],
  heartfailure: ["congestiveheartfailure", "chf"],
  congestiveheartfailure: ["heartfailure", "chf"],
  aorticdissection: ["thoracicaorticdissection"],
  rupturedaaa: ["abdominalaorticaneurysm", "rupturedabdominalaorticaneurysm"],
  stableangina: ["anginapectoris", "chronicstableangina"],
  atrialfibrillation: ["af", "afib"],
  af: ["atrialfibrillation"],
  infectiveendocarditis: ["endocarditis", "bacterialendocarditis", "ie"],
  endocarditis: ["infectiveendocarditis"],
  wpwsyndrome: ["wpw", "wolffparkinsonwhite", "wolffparkinsonwhitesyndrome", "preexcitation"],
  wpw: ["wpwsyndrome", "wolffparkinsonwhite"],
  wolffparkinsonwhite: ["wpwsyndrome", "wpw"],
  svt: ["supraventriculartachycardia", "paroxysmalsvt"],
  supraventriculartachycardia: ["svt"],
  completeheartblock: ["thirddegreeheartblock", "3rddegreeavblock", "completeavblock"],
  cardiacTamponade: ["pericardialeffusionwithtamponade", "becktrtiad"],
  pericardialtamponade: ["cardiactamponade"],
  cardiactamponade: ["pericardialtamponade"],
  pericardialeffusion: ["pericardialtamponade", "cardiactamponade"],
  hypertensiveemergency: ["hypertensivecrisis", "malignanthypertension"],
  upperextremitydvt: ["armdvt", "upperextremitydeepveinthrombosis"],

  // ── DVT ──
  deepveinthrombosis: ["dvt"],
  dvt: ["deepveinthrombosis"],

  // ── Neurological ──
  migraine: ["migraineheadache", "migrainewithauraaura"],
  tensionheadache: ["tensionheadache", "tensiontype", "tensiontypeheadache"],
  meningitis: ["bacterialmeningitis", "viralmeningitis"],
  stroke: ["cerebrovascularaccident", "cva", "ischemicstroke", "posteriorcirculationstroke"],
  cerebrovascularaccident: ["stroke", "cva"],
  posteriorcirculationstroke: ["stroke", "cerebellarstroke", "basilararterystroke"],
  subarachnoidhemorrhage: ["sah"],
  sah: ["subarachnoidhemorrhage"],
  epiduralhematoma: ["extraduralhematoma", "epiduralbleed"],
  statusepilepticus: ["prolongedseizure", "nonconvulsivestatusepilepticus", "ncse"],
  nonconvulsivestatusepilepticus: ["ncse", "statusepilepticus", "subtlestatusepilepticus"],
  ncse: ["nonconvulsivestatusepilepticus", "statusepilepticus"],
  guillainbarresyndrome: ["gbs", "guillainbarre", "acuteinflammatorydemeyelinatingpolyneuropathy", "aidp"],
  gbs: ["guillainbarresyndrome"],
  multiplesclerosis: ["ms"],
  ms: ["multiplesclerosis"],
  trigeminalNeuralgia: ["ticDouloureux"],
  trigeminalneuralgia: ["ticdouloureux"],
  normalpressurehydrocephalus: ["nph"],
  nph: ["normalpressurehydrocephalus"],
  idiopathicintracranialHypertension: ["iih", "pseudotumorcerebri", "benignintracranialHypertension"],
  idiopathicintracr: ["iih"],
  iih: ["idiopathicintracranialHypertension", "pseudotumorcerebri"],
  metastaticspinalcordcompression: ["spinalcordcompression", "malignantcordcompression"],
  spinalcordcompression: ["metastaticspinalcordcompression"],
  giantcellarteritis: ["temporalarteritis", "gca"],
  gca: ["giantcellarteritis", "temporalarteritis"],
  temporalarteritis: ["giantcellarteritis", "gca"],
  clusterheadache: ["clusterheadaches"],
  caudaequinasyndrome: ["caudaequina"],
  functionalneurologicaldisorder: ["fnd", "conversiondisorder"],
  neurolepticmalignantsyndrome: ["nms"],
  nms: ["neurolepticmalignantsyndrome"],
  epiduralabscess: ["spinalepidurarabscess"],

  // ── Infectious ──
  influenza: ["flu"],
  flu: ["influenza"],
  covid19: ["covid", "sarscov2", "covidlikesyndrome"],
  covid: ["covid19"],
  sepsis: ["septicemia", "systemicinfection", "bacteremia"],
  malaria: ["plasmodiumfalciparum", "plasmodiumvivax"],
  denguefever: ["dengue", "breakbonefever", "denguehemorrhagicfever"],
  dengue: ["denguefever"],
  typhoidfever: ["typhoid", "entericfever"],
  typhoid: ["typhoidfever", "entericfever"],
  leptospirosis: ["weilsdisease"],
  peritonsillarabscess: ["pta", "quinsy"],
  epiglottitis: ["supraglottitis"],
  infectiousmononucleosis: ["mono", "ebv", "glandularfever", "kissingdisease"],
  necrotizingfasciitis: ["necfasc", "flesheatinbacteria", "nf"],
  fourniergangrene: ["fourniersgangrene", "perinealgangrene"],
  meningococcalsepticemia: ["meningococcaldisease", "meningococcemia"],
  meningococcaldisease: ["meningococcalsepticemia"],
  cellulitis: ["skinsofttissueinfection"],
  kawasakidisease: ["kawasaki", "mucocutaneouslymphnodesyndrome"],

  // ── Metabolic / Endocrine ──
  diabeticketoacidosis: ["dka"],
  dka: ["diabeticketoacidosis"],
  hypoglycemia: ["lowbloodsugar"],
  thyroidstorm: ["thyrotoxiccrisis", "thyrotoxicosis"],
  adrenalcrisis: ["addisonianccrisis", "adrenalinsufficiency", "addisoniancrisis"],
  addisonianccrisis: ["adrenalcrisis", "adrenalinsufficiency"],
  hypothyroidism: ["underactivethyroid", "myxedema"],
  myxedemacoma: ["myxedema", "severehypothyroidism"],
  pheochromocytoma: ["pheo", "paraganglioma"],
  hypercalcemiaofmalignancy: ["hypercalcemia", "malignanthypercalcemia"],
  hypercalcemia: ["hypercalcemiaofmalignancy"],
  gravesdisease: ["graves", "gravesthyrotoxicosis"],
  cushingsyndrome: ["cushings", "hypercortisolism"],

  // ── Toxicological ──
  carbonmonoxidepoisoning: ["copoisoning", "carbonmonoxide"],
  organophosphatepoisoning: ["oppoisoning", "cholinesteraseinhibitor"],
  paracetamolhepatotoxicity: ["acetaminophenoverdose", "paracetamoloverdose", "acetaminophenhepatotoxicity", "tylenolOverdose"],
  paracetamol: ["acetaminophen", "tylenol"],
  acetaminophen: ["paracetamol", "tylenol"],
  lithiumtoxicity: ["lithiumoverdose", "lithiumpoisoning"],
  opioidoverdose: ["opioidpoisoning", "narcoticoverdose"],

  // ── Renal / GU ──
  urinarytractinfection: ["uti", "cystitis", "bladderinfection"],
  uti: ["urinarytractinfection"],
  pyelonephritis: ["kidneysinfection", "uppuruti"],
  renalcolic: ["kidneystone", "ureterolithiasis", "nephrolithiasis"],
  kidneystone: ["renalcolic", "nephrolithiasis"],
  acutekidneyinjury: ["aki", "acuterenalfailure", "arf"],
  aki: ["acutekidneyinjury"],
  testiculartorsion: ["torsion"],
  nephroticsyndrome: ["nephrosis"],
  prostatitis: ["acuteprostatitis", "chronicprostatitis"],
  ectopicpregnancy: ["rupturedectopicpregnancy"],

  // ── Musculoskeletal ──
  septicarthritis: ["infectiousarthritis"],
  gout: ["acutegout", "podagra"],
  compartmentsyndrome: ["acutecompartmentsyndrome"],
  lumbarspinalstenosis: ["spinalstenosis"],
  fibromyalgia: ["fibromyalgiasyndrome"],
  sle: ["systemiclupuserythematosus", "lupus"],
  lupus: ["sle", "systemiclupuserythematosus"],
  rheumatoidarthritis: ["ra"],
  ra: ["rheumatoidarthritis"],

  // ── Dermatological ──
  psoriasis: ["plaquepsoriasis"],
  melanoma: ["malignantmelanoma", "cutaneousmelanoma"],

  // ── Ophthalmological ──
  acuteglaucoma: ["angleclosureglaucoma", "acuteangleclosureglaucoma"],
  acuteangleclosureglaucoma: ["acuteglaucoma", "angleclosureglaucoma"],
  retinoblastoma: ["rb", "retinalcancer"],

  // ── Hematological ──
  irondeficiencyanemia: ["ida", "irondeficiency"],
  lymphoma: ["hodgkinlymphoma", "nonhodgkinlymphoma", "nhl"],

  // ── Psychiatric ──
  bipolardisordermanicepisode: ["bipolarmania", "mania", "manicepisode"],
  somaticsymptomdisorder: ["somatization", "somatoformdisorder"],
  delirium: ["acuteconfusionalstate"],

  // ── Pediatric ──
  nonaccidentalinjury: ["nai", "childabuse", "nonaccidentaltrauma"],

  // ── Syncope ──
  vasovagalsyncope: ["neurocardiogenicsyncope", "simplefaint", "vasovagal"],
  orthostatichypotension: ["posturalhypotension", "orthostaticsyncope"],
  bppv: ["benignparoxysmalpositionalvertigo", "positionalvertigo"],
  benignparoxysmalpositionalvertigo: ["bppv"],

  // ── Psychiatric / Functional ──
  panicdisorder: ["panicattack", "panicanxiety"],
  panicattack: ["panicdisorder"],
  somatizationdisorder: ["somaticsymptomdisorder", "somatization", "somatoformdisorder"],
  conversiondisorder: ["functionalneurologicaldisorder", "fnd", "functionalneurologicalsymptomdisorder"],

  // ── Additional expanded entries ──
  costochondritis: ["tietzessyndrome", "chestwalltenderness"],
  seizure: ["epilepticseizure", "convulsion", "firstseizure"],
  spinalstenosis: ["lumbarspinalstenosis", "spinalcanalnarrowing"],

  // ── Other ──
  feverofunknownorigin: ["fuo", "puo"],
  anaphylaxis: ["anaphylacticshock"],
  sinusitis: ["acutesinusitis", "rhinosinusitis"],
};

export function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Strict synonym match with substring containment fallback.
 * Prevents false positives from token overlap by requiring
 * exact match, containment, or explicit synonym registration.
 */
export function diagMatch(a: string, b: string): boolean {
  const na = norm(a), nb = norm(b);
  if (na === nb) return true;
  // Containment (one fully contains the other)
  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) return true;
  // Explicit synonym map
  const aSyn = SYNONYM_MAP[na] || [];
  const bSyn = SYNONYM_MAP[nb] || [];
  if (aSyn.includes(nb) || bSyn.includes(na)) return true;
  // Cross-check: do any of a's synonyms match any of b's synonyms (shared canonical)?
  if (aSyn.length > 0 && bSyn.length > 0) {
    for (const as of aSyn) {
      if (bSyn.includes(as)) return true;
    }
  }
  return false;
}

/**
 * Get all known synonyms for a normalized diagnosis string.
 */
export function getSynonyms(diagnosis: string): string[] {
  const n = norm(diagnosis);
  return SYNONYM_MAP[n] || [];
}
