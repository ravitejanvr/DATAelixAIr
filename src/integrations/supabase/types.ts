export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          actor_id: string
          clinic_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          actor_id: string
          clinic_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          actor_id?: string
          clinic_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_members: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          is_primary: boolean
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_members_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_workflow_config: {
        Row: {
          billing_enabled: boolean | null
          clinic_id: string
          created_at: string
          default_consultation_fee: number | null
          favorite_prescriptions_enabled: boolean | null
          id: string
          intake_enabled: boolean | null
          lab_enabled: boolean | null
          pharmacy_enabled: boolean | null
          triage_enabled: boolean | null
          updated_at: string
          vitals_required: boolean | null
          workflow_order: Json | null
        }
        Insert: {
          billing_enabled?: boolean | null
          clinic_id: string
          created_at?: string
          default_consultation_fee?: number | null
          favorite_prescriptions_enabled?: boolean | null
          id?: string
          intake_enabled?: boolean | null
          lab_enabled?: boolean | null
          pharmacy_enabled?: boolean | null
          triage_enabled?: boolean | null
          updated_at?: string
          vitals_required?: boolean | null
          workflow_order?: Json | null
        }
        Update: {
          billing_enabled?: boolean | null
          clinic_id?: string
          created_at?: string
          default_consultation_fee?: number | null
          favorite_prescriptions_enabled?: boolean | null
          id?: string
          intake_enabled?: boolean | null
          lab_enabled?: boolean | null
          pharmacy_enabled?: boolean | null
          triage_enabled?: boolean | null
          updated_at?: string
          vitals_required?: boolean | null
          workflow_order?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_workflow_config_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          country: string | null
          created_at: string
          email: string | null
          id: string
          location: string | null
          name: string
          phone: string | null
          specialty: string | null
          status: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          location?: string | null
          name: string
          phone?: string | null
          specialty?: string | null
          status?: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          location?: string | null
          name?: string
          phone?: string | null
          specialty?: string | null
          status?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      consultations: {
        Row: {
          ai_summary: string | null
          billing_amount: number | null
          billing_details: Json | null
          chief_complaint: string | null
          clinic_id: string | null
          confidence_score: string | null
          created_at: string
          doctor_final_transcript: string | null
          doctor_id: string
          drug_interactions: Json | null
          drug_recommendations: Json | null
          edited_transcript: string | null
          extracted_data: Json | null
          follow_up_date: string | null
          id: string
          normalization_results: Json | null
          patient_id: string
          pubmed_citations: Json | null
          raw_transcript: string | null
          review_confirmed: boolean | null
          risk_assessment: Json | null
          safety_flags: Json | null
          soap_assessment: string | null
          soap_objective: string | null
          soap_plan: string | null
          soap_subjective: string | null
          stabilized_transcript: string | null
          status: string | null
          tests_ordered: string[] | null
          updated_at: string
          visit_id: string | null
        }
        Insert: {
          ai_summary?: string | null
          billing_amount?: number | null
          billing_details?: Json | null
          chief_complaint?: string | null
          clinic_id?: string | null
          confidence_score?: string | null
          created_at?: string
          doctor_final_transcript?: string | null
          doctor_id: string
          drug_interactions?: Json | null
          drug_recommendations?: Json | null
          edited_transcript?: string | null
          extracted_data?: Json | null
          follow_up_date?: string | null
          id?: string
          normalization_results?: Json | null
          patient_id: string
          pubmed_citations?: Json | null
          raw_transcript?: string | null
          review_confirmed?: boolean | null
          risk_assessment?: Json | null
          safety_flags?: Json | null
          soap_assessment?: string | null
          soap_objective?: string | null
          soap_plan?: string | null
          soap_subjective?: string | null
          stabilized_transcript?: string | null
          status?: string | null
          tests_ordered?: string[] | null
          updated_at?: string
          visit_id?: string | null
        }
        Update: {
          ai_summary?: string | null
          billing_amount?: number | null
          billing_details?: Json | null
          chief_complaint?: string | null
          clinic_id?: string | null
          confidence_score?: string | null
          created_at?: string
          doctor_final_transcript?: string | null
          doctor_id?: string
          drug_interactions?: Json | null
          drug_recommendations?: Json | null
          edited_transcript?: string | null
          extracted_data?: Json | null
          follow_up_date?: string | null
          id?: string
          normalization_results?: Json | null
          patient_id?: string
          pubmed_citations?: Json | null
          raw_transcript?: string | null
          review_confirmed?: boolean | null
          risk_assessment?: Json | null
          safety_flags?: Json | null
          soap_assessment?: string | null
          soap_objective?: string | null
          soap_plan?: string | null
          soap_subjective?: string | null
          stabilized_transcript?: string | null
          status?: string | null
          tests_ordered?: string[] | null
          updated_at?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "patient_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_favorites: {
        Row: {
          clinic_id: string | null
          created_at: string
          default_dose: string | null
          doctor_id: string
          duration: string | null
          frequency: string | null
          generic_name: string
          id: string
          instructions: string | null
          preferred_brand: string | null
          route: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          default_dose?: string | null
          doctor_id: string
          duration?: string | null
          frequency?: string | null
          generic_name: string
          id?: string
          instructions?: string | null
          preferred_brand?: string | null
          route?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          default_dose?: string | null
          doctor_id?: string
          duration?: string | null
          frequency?: string | null
          generic_name?: string
          id?: string
          instructions?: string | null
          preferred_brand?: string | null
          route?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_favorites_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_learning_signals: {
        Row: {
          clinic_id: string | null
          created_at: string
          doctor_id: string
          id: string
          signal_data: Json
          signal_type: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          doctor_id: string
          id?: string
          signal_data?: Json
          signal_type?: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          doctor_id?: string
          id?: string
          signal_data?: Json
          signal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_learning_signals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_preferences: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          preferred_templates: Json
          soap_style: Json
          terminology_overrides: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          preferred_templates?: Json
          soap_style?: Json
          terminology_overrides?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          preferred_templates?: Json
          soap_style?: Json
          terminology_overrides?: Json
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          clinic_id: string
          consultation_fee: number | null
          consultation_id: string | null
          created_at: string
          discount: number | null
          doctor_id: string
          id: string
          invoice_number: string | null
          lab_charges: Json | null
          patient_id: string
          payment_mode: string | null
          procedures: Json | null
          status: string | null
          total: number | null
          updated_at: string
          visit_id: string | null
        }
        Insert: {
          clinic_id: string
          consultation_fee?: number | null
          consultation_id?: string | null
          created_at?: string
          discount?: number | null
          doctor_id: string
          id?: string
          invoice_number?: string | null
          lab_charges?: Json | null
          patient_id: string
          payment_mode?: string | null
          procedures?: Json | null
          status?: string | null
          total?: number | null
          updated_at?: string
          visit_id?: string | null
        }
        Update: {
          clinic_id?: string
          consultation_fee?: number | null
          consultation_id?: string | null
          created_at?: string
          discount?: number | null
          doctor_id?: string
          id?: string
          invoice_number?: string | null
          lab_charges?: Json | null
          patient_id?: string
          payment_mode?: string | null
          procedures?: Json | null
          status?: string | null
          total?: number | null
          updated_at?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "patient_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_orders: {
        Row: {
          category: string | null
          clinic_id: string
          completed_at: string | null
          consultation_id: string | null
          created_at: string
          doctor_id: string
          id: string
          notes: string | null
          order_number: string | null
          ordered_at: string
          patient_id: string
          priority: string | null
          status: string
          test_code: string | null
          test_name: string
          updated_at: string
          visit_id: string
        }
        Insert: {
          category?: string | null
          clinic_id: string
          completed_at?: string | null
          consultation_id?: string | null
          created_at?: string
          doctor_id: string
          id?: string
          notes?: string | null
          order_number?: string | null
          ordered_at?: string
          patient_id: string
          priority?: string | null
          status?: string
          test_code?: string | null
          test_name: string
          updated_at?: string
          visit_id: string
        }
        Update: {
          category?: string | null
          clinic_id?: string
          completed_at?: string | null
          consultation_id?: string | null
          created_at?: string
          doctor_id?: string
          id?: string
          notes?: string | null
          order_number?: string | null
          ordered_at?: string
          patient_id?: string
          priority?: string | null
          status?: string
          test_code?: string | null
          test_name?: string
          updated_at?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_orders_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "patient_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_results: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          is_abnormal: boolean | null
          lab_order_id: string
          notes: string | null
          parameter_name: string
          patient_id: string
          reference_range: string | null
          reported_at: string | null
          unit: string | null
          value: string
          verified_at: string | null
          verified_by: string | null
          visit_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          is_abnormal?: boolean | null
          lab_order_id: string
          notes?: string | null
          parameter_name: string
          patient_id: string
          reference_range?: string | null
          reported_at?: string | null
          unit?: string | null
          value: string
          verified_at?: string | null
          verified_by?: string | null
          visit_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          is_abnormal?: boolean | null
          lab_order_id?: string
          notes?: string | null
          parameter_name?: string
          patient_id?: string
          reference_range?: string | null
          reported_at?: string | null
          unit?: string | null
          value?: string
          verified_at?: string | null
          verified_by?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_lab_order_id_fkey"
            columns: ["lab_order_id"]
            isOneToOne: false
            referencedRelation: "lab_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "patient_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_events: {
        Row: {
          agent_name: string | null
          clinic_id: string | null
          created_at: string
          duration_ms: number | null
          event_type: string
          id: string
          metadata: Json
          success: boolean
        }
        Insert: {
          agent_name?: string | null
          clinic_id?: string | null
          created_at?: string
          duration_ms?: number | null
          event_type: string
          id?: string
          metadata?: Json
          success?: boolean
        }
        Update: {
          agent_name?: string | null
          clinic_id?: string | null
          created_at?: string
          duration_ms?: number | null
          event_type?: string
          id?: string
          metadata?: Json
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_visits: {
        Row: {
          assigned_to: string | null
          check_in_time: string
          chief_complaint: string | null
          clinic_id: string
          consultation_id: string | null
          created_by: string | null
          id: string
          patient_id: string
          status: string
          token_number: number | null
          updated_at: string
          visit_date: string | null
          visit_type: string | null
        }
        Insert: {
          assigned_to?: string | null
          check_in_time?: string
          chief_complaint?: string | null
          clinic_id: string
          consultation_id?: string | null
          created_by?: string | null
          id?: string
          patient_id: string
          status?: string
          token_number?: number | null
          updated_at?: string
          visit_date?: string | null
          visit_type?: string | null
        }
        Update: {
          assigned_to?: string | null
          check_in_time?: string
          chief_complaint?: string | null
          clinic_id?: string
          consultation_id?: string | null
          created_by?: string | null
          id?: string
          patient_id?: string
          status?: string
          token_number?: number | null
          updated_at?: string
          visit_date?: string | null
          visit_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_visits_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_visits_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          aadhaar_hash: string | null
          abha_id: string | null
          address: string | null
          age: number | null
          alcohol_use: string | null
          allergies: string[] | null
          blood_group: string | null
          bmi: number | null
          clinic_id: string | null
          created_at: string
          current_medications: string[] | null
          date_of_birth: string | null
          dietary_preference: string | null
          doctor_id: string
          email: string | null
          exercise_frequency: string | null
          family_history: Json | null
          gender: string | null
          height_cm: number | null
          id: string
          language_preference: string | null
          lifestyle_factors: Json | null
          medical_history: Json | null
          name: string
          occupation: string | null
          patient_user_id: string | null
          phone: string | null
          smoking_status: string | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          aadhaar_hash?: string | null
          abha_id?: string | null
          address?: string | null
          age?: number | null
          alcohol_use?: string | null
          allergies?: string[] | null
          blood_group?: string | null
          bmi?: number | null
          clinic_id?: string | null
          created_at?: string
          current_medications?: string[] | null
          date_of_birth?: string | null
          dietary_preference?: string | null
          doctor_id: string
          email?: string | null
          exercise_frequency?: string | null
          family_history?: Json | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          language_preference?: string | null
          lifestyle_factors?: Json | null
          medical_history?: Json | null
          name: string
          occupation?: string | null
          patient_user_id?: string | null
          phone?: string | null
          smoking_status?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          aadhaar_hash?: string | null
          abha_id?: string | null
          address?: string | null
          age?: number | null
          alcohol_use?: string | null
          allergies?: string[] | null
          blood_group?: string | null
          bmi?: number | null
          clinic_id?: string | null
          created_at?: string
          current_medications?: string[] | null
          date_of_birth?: string | null
          dietary_preference?: string | null
          doctor_id?: string
          email?: string | null
          exercise_frequency?: string | null
          family_history?: Json | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          language_preference?: string | null
          lifestyle_factors?: Json | null
          medical_history?: Json | null
          name?: string
          occupation?: string | null
          patient_user_id?: string | null
          phone?: string | null
          smoking_status?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_requests: {
        Row: {
          clinic_name: string
          contact_email: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          estimated_patient_volume: string
          id: string
          location: string
          notes: string | null
          speciality: string
          status: string
          updated_at: string
          workflow_type: string | null
        }
        Insert: {
          clinic_name: string
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          estimated_patient_volume: string
          id?: string
          location: string
          notes?: string | null
          speciality: string
          status?: string
          updated_at?: string
          workflow_type?: string | null
        }
        Update: {
          clinic_name?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          estimated_patient_volume?: string
          id?: string
          location?: string
          notes?: string | null
          speciality?: string
          status?: string
          updated_at?: string
          workflow_type?: string | null
        }
        Relationships: []
      }
      prescriptions: {
        Row: {
          clinic_id: string | null
          consultation_id: string
          created_at: string
          doctor_id: string
          dosage: string
          drug_name: string
          duration: string | null
          frequency: string | null
          id: string
          instructions: string | null
          interactions: Json | null
          patient_id: string
          route: string | null
          severity: string | null
          visit_id: string | null
        }
        Insert: {
          clinic_id?: string | null
          consultation_id: string
          created_at?: string
          doctor_id: string
          dosage: string
          drug_name: string
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          interactions?: Json | null
          patient_id: string
          route?: string | null
          severity?: string | null
          visit_id?: string | null
        }
        Update: {
          clinic_id?: string | null
          consultation_id?: string
          created_at?: string
          doctor_id?: string
          dosage?: string
          drug_name?: string
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          interactions?: Json | null
          patient_id?: string
          route?: string | null
          severity?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "patient_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string
          clinic_id: string | null
          clinic_name: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          license_number: string | null
          phone: string | null
          role_subtype: string | null
          specialization: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_status?: string
          clinic_id?: string | null
          clinic_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          license_number?: string | null
          phone?: string | null
          role_subtype?: string | null
          specialization?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_status?: string
          clinic_id?: string | null
          clinic_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          license_number?: string | null
          phone?: string | null
          role_subtype?: string | null
          specialization?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      regional_lexicon: {
        Row: {
          category: string
          clinical_term: string
          confidence: string | null
          created_at: string
          id: string
          language: string
          regional_phrase: string
          source_language: string | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          category?: string
          clinical_term: string
          confidence?: string | null
          created_at?: string
          id?: string
          language?: string
          regional_phrase: string
          source_language?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          category?: string
          clinical_term?: string
          confidence?: string | null
          created_at?: string
          id?: string
          language?: string
          regional_phrase?: string
          source_language?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      triage: {
        Row: {
          allergies_noted: string | null
          chief_complaint: string
          clinic_id: string
          created_at: string
          id: string
          notes: string | null
          pain_score: number | null
          patient_id: string
          pregnancy_status: string | null
          priority: string | null
          recorded_by: string
          symptom_duration: string | null
          updated_at: string
          visit_id: string
        }
        Insert: {
          allergies_noted?: string | null
          chief_complaint?: string
          clinic_id: string
          created_at?: string
          id?: string
          notes?: string | null
          pain_score?: number | null
          patient_id: string
          pregnancy_status?: string | null
          priority?: string | null
          recorded_by: string
          symptom_duration?: string | null
          updated_at?: string
          visit_id: string
        }
        Update: {
          allergies_noted?: string | null
          chief_complaint?: string
          clinic_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          pain_score?: number | null
          patient_id?: string
          pregnancy_status?: string | null
          priority?: string | null
          recorded_by?: string
          symptom_duration?: string | null
          updated_at?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "triage_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "triage_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "triage_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "patient_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_metrics: {
        Row: {
          created_at: string
          id: string
          metric_type: string
          metric_value: Json
          period_end: string
          period_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          metric_type: string
          metric_value?: Json
          period_end?: string
          period_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          metric_type?: string
          metric_value?: Json
          period_end?: string
          period_start?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vitals: {
        Row: {
          blood_sugar: number | null
          bp_diastolic: number | null
          bp_systolic: number | null
          clinic_id: string
          created_at: string
          height_cm: number | null
          id: string
          notes: string | null
          patient_id: string
          pulse: number | null
          recorded_by: string
          respiratory_rate: number | null
          spo2: number | null
          temperature: number | null
          visit_id: string | null
          weight_kg: number | null
        }
        Insert: {
          blood_sugar?: number | null
          bp_diastolic?: number | null
          bp_systolic?: number | null
          clinic_id: string
          created_at?: string
          height_cm?: number | null
          id?: string
          notes?: string | null
          patient_id: string
          pulse?: number | null
          recorded_by: string
          respiratory_rate?: number | null
          spo2?: number | null
          temperature?: number | null
          visit_id?: string | null
          weight_kg?: number | null
        }
        Update: {
          blood_sugar?: number | null
          bp_diastolic?: number | null
          bp_systolic?: number | null
          clinic_id?: string
          created_at?: string
          height_cm?: number | null
          id?: string
          notes?: string | null
          patient_id?: string
          pulse?: number | null
          recorded_by?: string
          respiratory_rate?: number | null
          spo2?: number | null
          temperature?: number | null
          visit_id?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vitals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitals_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitals_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "patient_visits"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_lexicon_usage: { Args: { ids: string[] }; Returns: undefined }
      is_clinic_member: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
      is_doctor_for_patient: {
        Args: { p_patient_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "doctor"
        | "patient"
        | "admin"
        | "nurse"
        | "allied_health"
        | "pharmacist"
        | "lab"
        | "care_coordinator"
        | "front_desk"
        | "platform_admin"
        | "clinic_admin"
        | "receptionist"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "doctor",
        "patient",
        "admin",
        "nurse",
        "allied_health",
        "pharmacist",
        "lab",
        "care_coordinator",
        "front_desk",
        "platform_admin",
        "clinic_admin",
        "receptionist",
      ],
    },
  },
} as const
