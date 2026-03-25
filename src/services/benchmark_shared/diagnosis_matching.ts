/**
 * Unified Diagnosis Matching — Single Source of Truth
 *
 * Consolidates the synonym maps from v9 and v10 into one canonical set.
 * Both benchmark runners MUST use this module to ensure consistent matching.
 */

const SYNONYM_MAP: Record<string, string[]> = {
  pneumonia: ["communityacquiredpneumonia", "cap", "lobarpneumonia", "bronchopneumonia"],
  communityacquiredpneumonia: ["pneumonia", "cap"],
  gastroenteritis: ["acutegastroenteritis", "stomachflu", "viralenteritis"],
  acutegastroenteritis: ["gastroenteritis"],
  appendicitis: ["acuteappendicitis"],
  acuteappendicitis: ["appendicitis"],
  urinarytractinfection: ["uti", "cystitis", "bladderinfection"],
  uti: ["urinarytractinfection"],
  acutecoronarysyndrome: ["acs", "myocardialinfarction", "heartattack", "unstableangina"],
  myocardialinfarction: ["acutecoronarysyndrome", "heartattack", "mi", "stemi", "nstemi"],
  diabeticketoacidosis: ["dka"],
  dka: ["diabeticketoacidosis"],
  pulmonaryembolism: ["pe", "lungclot"],
  pe: ["pulmonaryembolism"],
  asthma: ["asthmaexacerbation", "acuteasthma", "bronchialasthma"],
  asthmaexacerbation: ["asthma"],
  sepsis: ["septicemia", "systemicinfection", "bacteremia"],
  migraine: ["migraineheadache", "migrainewithauraaura"],
  copdexacerbation: ["copd", "chronicobstructivepulmonarydisease"],
  copd: ["copdexacerbation"],
  pancreatitis: ["acutepancreatitis"],
  acutepancreatitis: ["pancreatitis"],
  pepticulcerdisease: ["pepticulcer", "gastricculcer", "duodenalulcer"],
  pepticulcer: ["pepticulcerdisease"],
  pericarditis: ["acutepericarditis"],
  heartfailure: ["congestiveheartfailure", "chf"],
  congestiveheartfailure: ["heartfailure", "chf"],
  tensionheadache: ["tensionheadache", "tensiontype"],
  meningitis: ["bacterialmeningitis", "viralmeningitis"],
  stroke: ["cerebrovascularaccident", "cva", "ischemicstroke"],
  cerebrovascularaccident: ["stroke", "cva"],
  influenza: ["flu"],
  flu: ["influenza"],
  covid19: ["covid", "sarscov2", "covidlikesyndrome"],
  covid: ["covid19"],
  hypoglycemia: ["lowbloodsugar"],
  thyroidstorm: ["thyrotoxiccrisis", "thyrotoxicosis"],
  pyelonephritis: ["kidneysinfection"],
  renalcolic: ["kidneystone", "ureterolithiasis", "nephrolithiasis"],
  kidneystone: ["renalcolic", "nephrolithiasis"],
  cholecystitis: ["acutecholecystitis", "gallbladderinflammation"],
  acutecholecystitis: ["cholecystitis"],
  pneumothorax: ["collapsedlung", "tensionpneumothorax"],
  deepveinthrombosis: ["dvt"],
  dvt: ["deepveinthrombosis"],
  anaphylaxis: ["anaphylacticshock"],
  cellulitis: ["skinsofttissueinfection"],
  gerd: ["gastroesophagealrefluxdisease", "acidreflux"],
  gastroesophagealrefluxdisease: ["gerd"],
  aorticdissection: ["thoracicaorticdissection"],
  rupturedaaa: ["abdominalaorticaneurysm", "rupturedabdominalaorticaneurysm"],
  tensionpneumothorax: ["pneumothorax"],
  ectopicpregnancy: ["rupturedectopicpregnancy"],
  epiduralabscess: ["spinalepidurarabscess"],
  caudaequinasyndrome: ["caudaequina"],
  acuteglaucoma: ["angleclosureglaucoma", "acuteangleclosureglaucoma"],
  subarachnoidhemorrhage: ["sah"],
  statusepilepticus: ["prolongedseizure"],
  addisonianccrisis: ["adrenalcrisis", "adrenalinsufficiency"],
};

export function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function diagMatch(a: string, b: string): boolean {
  const na = norm(a), nb = norm(b);
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const aSyn = SYNONYM_MAP[na] || [];
  const bSyn = SYNONYM_MAP[nb] || [];
  return aSyn.includes(nb) || bSyn.includes(na);
}
