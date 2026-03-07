/**
 * Layer 7: Learning Layer API
 * 
 * Manages doctor-specific learning data such as prescription favorites
 * and regional lexicon updates. Future: feedback loops, model fine-tuning.
 * 
 * Dependencies:
 *   - Layer 10 (Infrastructure): Supabase client
 * 
 * Consumers:
 *   - Layer 2 (Workflow): Prescription favorites in prescriptions page
 *   - Layer 3 (Multilingual): Regional lexicon expansion
 */

export interface DoctorFavorite {
  id: string;
  doctor_id: string;
  generic_name: string;
  preferred_brand: string | null;
  default_dose: string | null;
  frequency: string | null;
  duration: string | null;
  route: string | null;
  instructions: string | null;
  clinic_id: string | null;
}

export interface RegionalLexiconEntry {
  id: string;
  regional_phrase: string;
  clinical_term: string;
  language: string;
  category: string;
}
