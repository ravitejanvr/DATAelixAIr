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
      ai_decision_ledger: {
        Row: {
          ai_output: string
          ai_output_type: string
          clinic_id: string
          confidence: number | null
          consultation_id: string | null
          created_at: string
          doctor_action: string
          doctor_id: string
          evidence_reference: string | null
          guideline_source: string | null
          id: string
          metadata: Json
          model_version: string | null
          override_reason: string | null
          safety_status: string
          visit_id: string
        }
        Insert: {
          ai_output: string
          ai_output_type?: string
          clinic_id: string
          confidence?: number | null
          consultation_id?: string | null
          created_at?: string
          doctor_action?: string
          doctor_id: string
          evidence_reference?: string | null
          guideline_source?: string | null
          id?: string
          metadata?: Json
          model_version?: string | null
          override_reason?: string | null
          safety_status?: string
          visit_id: string
        }
        Update: {
          ai_output?: string
          ai_output_type?: string
          clinic_id?: string
          confidence?: number | null
          consultation_id?: string | null
          created_at?: string
          doctor_action?: string
          doctor_id?: string
          evidence_reference?: string | null
          guideline_source?: string | null
          id?: string
          metadata?: Json
          model_version?: string | null
          override_reason?: string | null
          safety_status?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_decision_ledger_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_decision_ledger_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_decision_ledger_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "patient_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_pipeline_tests: {
        Row: {
          comparison_metrics: Json
          created_at: string
          id: string
          legacy_output: Json
          modular_output: Json
          patient_context: Json
          triggered_by: string
        }
        Insert: {
          comparison_metrics?: Json
          created_at?: string
          id?: string
          legacy_output?: Json
          modular_output?: Json
          patient_context?: Json
          triggered_by: string
        }
        Update: {
          comparison_metrics?: Json
          created_at?: string
          id?: string
          legacy_output?: Json
          modular_output?: Json
          patient_context?: Json
          triggered_by?: string
        }
        Relationships: []
      }
      ai_pipeline_tests_v4: {
        Row: {
          confidence_label: string | null
          confidence_score: number
          created_at: string
          dangerous_diagnosis_detected: boolean
          ddx_latency_ms: number | null
          diagnosis_match: number
          expected_output: Json
          failure_reasons: string[]
          guideline_count: number
          id: string
          lab_match: number
          latency_ms: number
          legacy_output: Json
          medication_match: number
          modular_output: Json
          module_logs: Json
          passed: boolean
          patient_context: Json
          pipeline_version: string
          run_group_id: string | null
          safety_alerts: number
          safety_flags: Json
          test_name: string
          triggered_by: string | null
          uncertainty_latency_ms: number | null
        }
        Insert: {
          confidence_label?: string | null
          confidence_score?: number
          created_at?: string
          dangerous_diagnosis_detected?: boolean
          ddx_latency_ms?: number | null
          diagnosis_match?: number
          expected_output?: Json
          failure_reasons?: string[]
          guideline_count?: number
          id?: string
          lab_match?: number
          latency_ms?: number
          legacy_output?: Json
          medication_match?: number
          modular_output?: Json
          module_logs?: Json
          passed?: boolean
          patient_context?: Json
          pipeline_version?: string
          run_group_id?: string | null
          safety_alerts?: number
          safety_flags?: Json
          test_name: string
          triggered_by?: string | null
          uncertainty_latency_ms?: number | null
        }
        Update: {
          confidence_label?: string | null
          confidence_score?: number
          created_at?: string
          dangerous_diagnosis_detected?: boolean
          ddx_latency_ms?: number | null
          diagnosis_match?: number
          expected_output?: Json
          failure_reasons?: string[]
          guideline_count?: number
          id?: string
          lab_match?: number
          latency_ms?: number
          legacy_output?: Json
          medication_match?: number
          modular_output?: Json
          module_logs?: Json
          passed?: boolean
          patient_context?: Json
          pipeline_version?: string
          run_group_id?: string | null
          safety_alerts?: number
          safety_flags?: Json
          test_name?: string
          triggered_by?: string | null
          uncertainty_latency_ms?: number | null
        }
        Relationships: []
      }
      anatomical_systems: {
        Row: {
          created_at: string
          description: string
          id: string
          system_name: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          system_name: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          system_name?: string
        }
        Relationships: []
      }
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
      benchmark_runs: {
        Row: {
          benchmark_version: string
          comparison_details: Json
          confidence_label: string | null
          confidence_score: number | null
          created_at: string
          ddx_latency_ms: number | null
          diagnosis_agreement: number
          expected_output: Json
          failure_reasons: string[]
          guideline_citations: number
          id: string
          lab_agreement: number
          latency_ms: number
          medication_agreement: number
          passed: boolean
          patient_context: Json
          pipeline_output: Json
          pipeline_type: string
          run_group_id: string | null
          run_timestamp: string
          safety_alerts: number
          test_case: string
          test_case_index: number
          triggered_by: string | null
          uncertainty_latency_ms: number | null
        }
        Insert: {
          benchmark_version?: string
          comparison_details?: Json
          confidence_label?: string | null
          confidence_score?: number | null
          created_at?: string
          ddx_latency_ms?: number | null
          diagnosis_agreement?: number
          expected_output?: Json
          failure_reasons?: string[]
          guideline_citations?: number
          id?: string
          lab_agreement?: number
          latency_ms?: number
          medication_agreement?: number
          passed?: boolean
          patient_context?: Json
          pipeline_output?: Json
          pipeline_type?: string
          run_group_id?: string | null
          run_timestamp?: string
          safety_alerts?: number
          test_case: string
          test_case_index?: number
          triggered_by?: string | null
          uncertainty_latency_ms?: number | null
        }
        Update: {
          benchmark_version?: string
          comparison_details?: Json
          confidence_label?: string | null
          confidence_score?: number | null
          created_at?: string
          ddx_latency_ms?: number | null
          diagnosis_agreement?: number
          expected_output?: Json
          failure_reasons?: string[]
          guideline_citations?: number
          id?: string
          lab_agreement?: number
          latency_ms?: number
          medication_agreement?: number
          passed?: boolean
          patient_context?: Json
          pipeline_output?: Json
          pipeline_type?: string
          run_group_id?: string | null
          run_timestamp?: string
          safety_alerts?: number
          test_case?: string
          test_case_index?: number
          triggered_by?: string | null
          uncertainty_latency_ms?: number | null
        }
        Relationships: []
      }
      bias_metrics: {
        Row: {
          acceptance_rate: number | null
          clinic_id: string | null
          created_at: string | null
          dimension: string
          dimension_value: string
          disparity_score: number | null
          fairness_threshold: number | null
          false_negative_rate: number | null
          false_positive_rate: number | null
          id: string
          metric_type: string
          override_rate: number | null
          passes_fairness: boolean | null
          period_end: string
          period_start: string
          positive_rate: number | null
          sample_count: number | null
        }
        Insert: {
          acceptance_rate?: number | null
          clinic_id?: string | null
          created_at?: string | null
          dimension: string
          dimension_value: string
          disparity_score?: number | null
          fairness_threshold?: number | null
          false_negative_rate?: number | null
          false_positive_rate?: number | null
          id?: string
          metric_type: string
          override_rate?: number | null
          passes_fairness?: boolean | null
          period_end: string
          period_start: string
          positive_rate?: number | null
          sample_count?: number | null
        }
        Update: {
          acceptance_rate?: number | null
          clinic_id?: string | null
          created_at?: string | null
          dimension?: string
          dimension_value?: string
          disparity_score?: number | null
          fairness_threshold?: number | null
          false_negative_rate?: number | null
          false_positive_rate?: number | null
          id?: string
          metric_type?: string
          override_rate?: number | null
          passes_fairness?: boolean | null
          period_end?: string
          period_start?: string
          positive_rate?: number | null
          sample_count?: number | null
        }
        Relationships: []
      }
      blog_article_index: {
        Row: {
          article_id: string
          category: string
          full_text: string
          id: string
          indexed_at: string
          keywords: string[]
          summary: string
          title: string
        }
        Insert: {
          article_id: string
          category?: string
          full_text?: string
          id?: string
          indexed_at?: string
          keywords?: string[]
          summary?: string
          title: string
        }
        Update: {
          article_id?: string
          category?: string
          full_text?: string
          id?: string
          indexed_at?: string
          keywords?: string[]
          summary?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_article_index_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "blog_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_articles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          author: string
          category: string
          clinical_implications: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          key_findings: string[]
          keywords: string[]
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          publish_date: string | null
          reading_time_min: number
          related_platform_features: string[]
          slug: string
          source_journal: string | null
          source_name: string | null
          source_type: string
          source_url: string | null
          source_year: number | null
          status: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          author?: string
          category?: string
          clinical_implications?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          key_findings?: string[]
          keywords?: string[]
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          publish_date?: string | null
          reading_time_min?: number
          related_platform_features?: string[]
          slug: string
          source_journal?: string | null
          source_name?: string | null
          source_type?: string
          source_url?: string | null
          source_year?: number | null
          status?: string
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          author?: string
          category?: string
          clinical_implications?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          key_findings?: string[]
          keywords?: string[]
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          publish_date?: string | null
          reading_time_min?: number
          related_platform_features?: string[]
          slug?: string
          source_journal?: string | null
          source_name?: string | null
          source_type?: string
          source_url?: string | null
          source_year?: number | null
          status?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      clinic_settings: {
        Row: {
          clinic_id: string
          consultation_fee: number | null
          created_at: string | null
          currency: string | null
          default_prescription_templates: Json | null
          doctor_templates: Json | null
          followup_fee: number | null
          id: string
          lab_margin: number | null
          notification_api_key: string | null
          notification_provider: string | null
          payment_methods: Json | null
          preferred_lab_name: string | null
          preferred_lab_phone: string | null
          preferred_pharmacy_name: string | null
          preferred_pharmacy_phone: string | null
          sms_enabled: boolean | null
          updated_at: string | null
          whatsapp_enabled: boolean | null
        }
        Insert: {
          clinic_id: string
          consultation_fee?: number | null
          created_at?: string | null
          currency?: string | null
          default_prescription_templates?: Json | null
          doctor_templates?: Json | null
          followup_fee?: number | null
          id?: string
          lab_margin?: number | null
          notification_api_key?: string | null
          notification_provider?: string | null
          payment_methods?: Json | null
          preferred_lab_name?: string | null
          preferred_lab_phone?: string | null
          preferred_pharmacy_name?: string | null
          preferred_pharmacy_phone?: string | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          whatsapp_enabled?: boolean | null
        }
        Update: {
          clinic_id?: string
          consultation_fee?: number | null
          created_at?: string | null
          currency?: string | null
          default_prescription_templates?: Json | null
          doctor_templates?: Json | null
          followup_fee?: number | null
          id?: string
          lab_margin?: number | null
          notification_api_key?: string | null
          notification_provider?: string | null
          payment_methods?: Json | null
          preferred_lab_name?: string | null
          preferred_lab_phone?: string | null
          preferred_pharmacy_name?: string | null
          preferred_pharmacy_phone?: string | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          whatsapp_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
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
          workflow_mode: string
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
          workflow_mode?: string
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
          workflow_mode?: string
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
      clinical_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          action_hint: string | null
          alert_type: string
          category: string
          clinic_id: string
          consultation_id: string | null
          created_at: string
          doctor_id: string
          id: string
          matched_indicators: Json | null
          message: string
          metadata: Json | null
          override_reason: string | null
          patient_id: string
          severity: string
          title: string
          visit_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          action_hint?: string | null
          alert_type?: string
          category?: string
          clinic_id: string
          consultation_id?: string | null
          created_at?: string
          doctor_id: string
          id?: string
          matched_indicators?: Json | null
          message: string
          metadata?: Json | null
          override_reason?: string | null
          patient_id: string
          severity?: string
          title: string
          visit_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          action_hint?: string | null
          alert_type?: string
          category?: string
          clinic_id?: string
          consultation_id?: string | null
          created_at?: string
          doctor_id?: string
          id?: string
          matched_indicators?: Json | null
          message?: string
          metadata?: Json | null
          override_reason?: string | null
          patient_id?: string
          severity?: string
          title?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_alerts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_alerts_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_alerts_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "patient_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_condition_map: {
        Row: {
          canonical_condition: string
          condition_id: string
          created_at: string
          icd10_codes: string[]
          id: string
          synonyms: string[]
        }
        Insert: {
          canonical_condition: string
          condition_id: string
          created_at?: string
          icd10_codes?: string[]
          id?: string
          synonyms?: string[]
        }
        Update: {
          canonical_condition?: string
          condition_id?: string
          created_at?: string
          icd10_codes?: string[]
          id?: string
          synonyms?: string[]
        }
        Relationships: []
      }
      clinical_context_objects: {
        Row: {
          built_by: string
          clinic_id: string
          clinical_observations: Json
          context_confidence: number
          created_at: string
          derived_context: Json
          episode_context: Json
          evidence_sources: Json
          fields_populated: number
          id: string
          medical_history: Json
          missing_fields: string[]
          patient_id: string
          patient_profile: Json
          status: string
          total_fields: number
          updated_at: string
          version: number
          visit_id: string
        }
        Insert: {
          built_by?: string
          clinic_id: string
          clinical_observations?: Json
          context_confidence?: number
          created_at?: string
          derived_context?: Json
          episode_context?: Json
          evidence_sources?: Json
          fields_populated?: number
          id?: string
          medical_history?: Json
          missing_fields?: string[]
          patient_id: string
          patient_profile?: Json
          status?: string
          total_fields?: number
          updated_at?: string
          version?: number
          visit_id: string
        }
        Update: {
          built_by?: string
          clinic_id?: string
          clinical_observations?: Json
          context_confidence?: number
          created_at?: string
          derived_context?: Json
          episode_context?: Json
          evidence_sources?: Json
          fields_populated?: number
          id?: string
          medical_history?: Json
          missing_fields?: string[]
          patient_id?: string
          patient_profile?: Json
          status?: string
          total_fields?: number
          updated_at?: string
          version?: number
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_context_objects_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_context_objects_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_context_objects_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "patient_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_guidelines: {
        Row: {
          applicable_drugs: string[]
          applicable_tests: string[]
          clinical_topic: string
          condition: string
          created_at: string
          evidence_grade: string
          guideline_url: string | null
          id: string
          is_active: boolean
          keywords: string[]
          recommendation_text: string
          source: string
          source_organization: string
          summary: string
          title: string
          updated_at: string
          year: number
        }
        Insert: {
          applicable_drugs?: string[]
          applicable_tests?: string[]
          clinical_topic?: string
          condition?: string
          created_at?: string
          evidence_grade?: string
          guideline_url?: string | null
          id?: string
          is_active?: boolean
          keywords?: string[]
          recommendation_text?: string
          source?: string
          source_organization?: string
          summary?: string
          title: string
          updated_at?: string
          year: number
        }
        Update: {
          applicable_drugs?: string[]
          applicable_tests?: string[]
          clinical_topic?: string
          condition?: string
          created_at?: string
          evidence_grade?: string
          guideline_url?: string | null
          id?: string
          is_active?: boolean
          keywords?: string[]
          recommendation_text?: string
          source?: string
          source_organization?: string
          summary?: string
          title?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
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
          report_data: Json | null
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
          report_data?: Json | null
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
          report_data?: Json | null
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
      dangerous_diagnoses: {
        Row: {
          created_at: string
          diagnosis_id: string
          diagnosis_name: string | null
          emergency_protocol: string | null
          guideline_source: string | null
          id: string
          must_not_miss: boolean
          notes: string | null
          priority: number
          severity_level: string
          trigger_symptom: string
        }
        Insert: {
          created_at?: string
          diagnosis_id: string
          diagnosis_name?: string | null
          emergency_protocol?: string | null
          guideline_source?: string | null
          id?: string
          must_not_miss?: boolean
          notes?: string | null
          priority?: number
          severity_level?: string
          trigger_symptom: string
        }
        Update: {
          created_at?: string
          diagnosis_id?: string
          diagnosis_name?: string | null
          emergency_protocol?: string | null
          guideline_source?: string | null
          id?: string
          must_not_miss?: boolean
          notes?: string | null
          priority?: number
          severity_level?: string
          trigger_symptom?: string
        }
        Relationships: [
          {
            foreignKeyName: "dangerous_diagnoses_diagnosis_id_fkey"
            columns: ["diagnosis_id"]
            isOneToOne: false
            referencedRelation: "diagnoses"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnoses: {
        Row: {
          category: string
          created_at: string
          diagnosis_name: string
          icd10_code: string | null
          id: string
        }
        Insert: {
          category?: string
          created_at?: string
          diagnosis_name: string
          icd10_code?: string | null
          id?: string
        }
        Update: {
          category?: string
          created_at?: string
          diagnosis_name?: string
          icd10_code?: string | null
          id?: string
        }
        Relationships: []
      }
      diagnosis_drug_map: {
        Row: {
          created_at: string
          diagnosis_id: string
          generic_name: string
          id: string
          line_of_treatment: string
        }
        Insert: {
          created_at?: string
          diagnosis_id: string
          generic_name: string
          id?: string
          line_of_treatment?: string
        }
        Update: {
          created_at?: string
          diagnosis_id?: string
          generic_name?: string
          id?: string
          line_of_treatment?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnosis_drug_map_diagnosis_id_fkey"
            columns: ["diagnosis_id"]
            isOneToOne: false
            referencedRelation: "diagnoses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnosis_drug_map_generic_name_fkey"
            columns: ["generic_name"]
            isOneToOne: false
            referencedRelation: "drug_master"
            referencedColumns: ["generic_name"]
          },
        ]
      }
      diagnosis_guideline_map: {
        Row: {
          created_at: string
          diagnosis_id: string
          guideline_id: string
          id: string
          recommendation_summary: string
          relevance_score: number
        }
        Insert: {
          created_at?: string
          diagnosis_id: string
          guideline_id: string
          id?: string
          recommendation_summary?: string
          relevance_score?: number
        }
        Update: {
          created_at?: string
          diagnosis_id?: string
          guideline_id?: string
          id?: string
          recommendation_summary?: string
          relevance_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "diagnosis_guideline_map_diagnosis_id_fkey"
            columns: ["diagnosis_id"]
            isOneToOne: false
            referencedRelation: "diagnoses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnosis_guideline_map_guideline_id_fkey"
            columns: ["guideline_id"]
            isOneToOne: false
            referencedRelation: "guideline_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnosis_lab_map: {
        Row: {
          created_at: string
          diagnosis_id: string
          id: string
          lab_test_id: string
          priority: string
        }
        Insert: {
          created_at?: string
          diagnosis_id: string
          id?: string
          lab_test_id: string
          priority?: string
        }
        Update: {
          created_at?: string
          diagnosis_id?: string
          id?: string
          lab_test_id?: string
          priority?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnosis_lab_map_diagnosis_id_fkey"
            columns: ["diagnosis_id"]
            isOneToOne: false
            referencedRelation: "diagnoses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnosis_lab_map_lab_test_id_fkey"
            columns: ["lab_test_id"]
            isOneToOne: false
            referencedRelation: "lab_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_flags: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          clinic_id: string
          consultation_id: string
          created_at: string
          diagnosis: string | null
          doctor_id: string
          flag_type: string
          id: string
          inconsistency_detail: string
          metadata: Json | null
          patient_id: string
          recommendation: string | null
          severity: string
          symptoms: Json | null
          tests_ordered: Json | null
          treatment_plan: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          clinic_id: string
          consultation_id: string
          created_at?: string
          diagnosis?: string | null
          doctor_id: string
          flag_type?: string
          id?: string
          inconsistency_detail: string
          metadata?: Json | null
          patient_id: string
          recommendation?: string | null
          severity?: string
          symptoms?: Json | null
          tests_ordered?: Json | null
          treatment_plan?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          clinic_id?: string
          consultation_id?: string
          created_at?: string
          diagnosis?: string | null
          doctor_id?: string
          flag_type?: string
          id?: string
          inconsistency_detail?: string
          metadata?: Json | null
          patient_id?: string
          recommendation?: string | null
          severity?: string
          symptoms?: Json | null
          tests_ordered?: Json | null
          treatment_plan?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_flags_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_flags_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_flags_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_hypotheses: {
        Row: {
          confidence_score: number
          created_at: string
          evidence_sources: Json
          hypothesis: Json
          id: string
          visit_id: string
        }
        Insert: {
          confidence_score?: number
          created_at?: string
          evidence_sources?: Json
          hypothesis?: Json
          id?: string
          visit_id: string
        }
        Update: {
          confidence_score?: number
          created_at?: string
          evidence_sources?: Json
          hypothesis?: Json
          id?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_hypotheses_visit_id_fkey"
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
      dose_frequency_dictionary: {
        Row: {
          code: string
          id: string
          meaning: string
          times_per_day: number
        }
        Insert: {
          code: string
          id?: string
          meaning?: string
          times_per_day?: number
        }
        Update: {
          code?: string
          id?: string
          meaning?: string
          times_per_day?: number
        }
        Relationships: []
      }
      drug_brand_generic_map: {
        Row: {
          brand_name: string
          created_at: string
          generic_name: string
          id: string
          ingredient_cui: string | null
          rxnorm_cui: string | null
        }
        Insert: {
          brand_name: string
          created_at?: string
          generic_name: string
          id?: string
          ingredient_cui?: string | null
          rxnorm_cui?: string | null
        }
        Update: {
          brand_name?: string
          created_at?: string
          generic_name?: string
          id?: string
          ingredient_cui?: string | null
          rxnorm_cui?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drug_brand_generic_map_ingredient_cui_fkey"
            columns: ["ingredient_cui"]
            isOneToOne: false
            referencedRelation: "drug_ingredients"
            referencedColumns: ["rxnorm_cui"]
          },
        ]
      }
      drug_brands: {
        Row: {
          brand_name: string
          country: string | null
          created_at: string
          generic_name: string
          id: string
          ingredient_cui: string | null
          manufacturer: string | null
          rxnorm_id: string | null
          strength: string | null
        }
        Insert: {
          brand_name: string
          country?: string | null
          created_at?: string
          generic_name: string
          id?: string
          ingredient_cui?: string | null
          manufacturer?: string | null
          rxnorm_id?: string | null
          strength?: string | null
        }
        Update: {
          brand_name?: string
          country?: string | null
          created_at?: string
          generic_name?: string
          id?: string
          ingredient_cui?: string | null
          manufacturer?: string | null
          rxnorm_id?: string | null
          strength?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drug_brands_generic_name_fkey"
            columns: ["generic_name"]
            isOneToOne: false
            referencedRelation: "drug_master"
            referencedColumns: ["generic_name"]
          },
        ]
      }
      drug_contraindication_map: {
        Row: {
          condition_id: string
          created_at: string
          drug_id: string
          id: string
          notes: string | null
          severity: string
          source_guideline: string | null
        }
        Insert: {
          condition_id: string
          created_at?: string
          drug_id: string
          id?: string
          notes?: string | null
          severity?: string
          source_guideline?: string | null
        }
        Update: {
          condition_id?: string
          created_at?: string
          drug_id?: string
          id?: string
          notes?: string | null
          severity?: string
          source_guideline?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drug_contraindication_map_condition_id_fkey"
            columns: ["condition_id"]
            isOneToOne: false
            referencedRelation: "diagnoses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drug_contraindication_map_drug_id_fkey"
            columns: ["drug_id"]
            isOneToOne: false
            referencedRelation: "drug_master"
            referencedColumns: ["id"]
          },
        ]
      }
      drug_dosage_forms: {
        Row: {
          created_at: string
          dose: string
          form: string
          id: string
          ingredient_cui: string
          route: string
          unit: string
        }
        Insert: {
          created_at?: string
          dose?: string
          form?: string
          id?: string
          ingredient_cui: string
          route?: string
          unit?: string
        }
        Update: {
          created_at?: string
          dose?: string
          form?: string
          id?: string
          ingredient_cui?: string
          route?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "drug_dosage_forms_ingredient_cui_fkey"
            columns: ["ingredient_cui"]
            isOneToOne: false
            referencedRelation: "drug_ingredients"
            referencedColumns: ["rxnorm_cui"]
          },
        ]
      }
      drug_dose_guidelines: {
        Row: {
          adult_max_dose: string
          adult_standard_dose: string
          contraindications: Json
          created_at: string
          duration_defaults: Json
          frequency_options: Json
          hepatic_adjustment: string
          id: string
          ingredient_cui: string
          pediatric_dose: string
          renal_adjustment: string
          updated_at: string
        }
        Insert: {
          adult_max_dose?: string
          adult_standard_dose?: string
          contraindications?: Json
          created_at?: string
          duration_defaults?: Json
          frequency_options?: Json
          hepatic_adjustment?: string
          id?: string
          ingredient_cui: string
          pediatric_dose?: string
          renal_adjustment?: string
          updated_at?: string
        }
        Update: {
          adult_max_dose?: string
          adult_standard_dose?: string
          contraindications?: Json
          created_at?: string
          duration_defaults?: Json
          frequency_options?: Json
          hepatic_adjustment?: string
          id?: string
          ingredient_cui?: string
          pediatric_dose?: string
          renal_adjustment?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drug_dose_guidelines_ingredient_cui_fkey"
            columns: ["ingredient_cui"]
            isOneToOne: false
            referencedRelation: "drug_ingredients"
            referencedColumns: ["rxnorm_cui"]
          },
        ]
      }
      drug_ingredients: {
        Row: {
          created_at: string
          generic_name: string
          id: string
          ingredient_type: string
          rxnorm_cui: string
        }
        Insert: {
          created_at?: string
          generic_name: string
          id?: string
          ingredient_type?: string
          rxnorm_cui: string
        }
        Update: {
          created_at?: string
          generic_name?: string
          id?: string
          ingredient_type?: string
          rxnorm_cui?: string
        }
        Relationships: []
      }
      drug_interactions: {
        Row: {
          created_at: string
          drug_a: string
          drug_b: string
          id: string
          interaction_description: string
          recommended_action: string | null
          severity: string
        }
        Insert: {
          created_at?: string
          drug_a: string
          drug_b: string
          id?: string
          interaction_description?: string
          recommended_action?: string | null
          severity?: string
        }
        Update: {
          created_at?: string
          drug_a?: string
          drug_b?: string
          id?: string
          interaction_description?: string
          recommended_action?: string | null
          severity?: string
        }
        Relationships: []
      }
      drug_master: {
        Row: {
          common_indications: string[] | null
          created_at: string
          drug_class: string
          generic_name: string
          hepatic_adjustment: string | null
          id: string
          max_daily_dose_mg: number | null
          mechanism: string
          pregnancy_category: string | null
          renal_adjustment: string | null
          rxnorm_id: string | null
        }
        Insert: {
          common_indications?: string[] | null
          created_at?: string
          drug_class?: string
          generic_name: string
          hepatic_adjustment?: string | null
          id?: string
          max_daily_dose_mg?: number | null
          mechanism?: string
          pregnancy_category?: string | null
          renal_adjustment?: string | null
          rxnorm_id?: string | null
        }
        Update: {
          common_indications?: string[] | null
          created_at?: string
          drug_class?: string
          generic_name?: string
          hepatic_adjustment?: string | null
          id?: string
          max_daily_dose_mg?: number | null
          mechanism?: string
          pregnancy_category?: string | null
          renal_adjustment?: string | null
          rxnorm_id?: string | null
        }
        Relationships: []
      }
      drug_safety_updates: {
        Row: {
          affected_populations: string[] | null
          alert_type: string
          black_box_warning: boolean | null
          contraindications: string[] | null
          created_at: string
          description: string | null
          drug_name: string
          generic_name: string | null
          id: string
          ingested_at: string
          is_active: boolean | null
          metadata: Json | null
          recall_info: string | null
          severity: string
          source: string
          source_id: string | null
          source_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          affected_populations?: string[] | null
          alert_type?: string
          black_box_warning?: boolean | null
          contraindications?: string[] | null
          created_at?: string
          description?: string | null
          drug_name: string
          generic_name?: string | null
          id?: string
          ingested_at?: string
          is_active?: boolean | null
          metadata?: Json | null
          recall_info?: string | null
          severity?: string
          source?: string
          source_id?: string | null
          source_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          affected_populations?: string[] | null
          alert_type?: string
          black_box_warning?: boolean | null
          contraindications?: string[] | null
          created_at?: string
          description?: string | null
          drug_name?: string
          generic_name?: string | null
          id?: string
          ingested_at?: string
          is_active?: boolean | null
          metadata?: Json | null
          recall_info?: string | null
          severity?: string
          source?: string
          source_id?: string | null
          source_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      evidence_sources: {
        Row: {
          authors: string
          created_at: string
          evidence_strength: string
          id: string
          journal: string
          related_feature: string
          source_link: string
          summary: string
          title: string
          updated_at: string
          year: number
        }
        Insert: {
          authors?: string
          created_at?: string
          evidence_strength?: string
          id?: string
          journal?: string
          related_feature?: string
          source_link?: string
          summary?: string
          title: string
          updated_at?: string
          year: number
        }
        Update: {
          authors?: string
          created_at?: string
          evidence_strength?: string
          id?: string
          journal?: string
          related_feature?: string
          source_link?: string
          summary?: string
          title?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      guideline_authorities: {
        Row: {
          authority_name: string
          country: string
          created_at: string
          id: string
          priority: number
        }
        Insert: {
          authority_name: string
          country?: string
          created_at?: string
          id?: string
          priority?: number
        }
        Update: {
          authority_name?: string
          country?: string
          created_at?: string
          id?: string
          priority?: number
        }
        Relationships: []
      }
      guideline_registry: {
        Row: {
          applicable_drugs: string[]
          applicable_tests: string[]
          condition: string
          country: string
          created_at: string
          guideline_url: string | null
          id: string
          is_active: boolean
          keywords: string[]
          organization: string
          publication_date: string | null
          recommendation_text: string
          specialty: string
          summary: string
          tier: number
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          applicable_drugs?: string[]
          applicable_tests?: string[]
          condition?: string
          country?: string
          created_at?: string
          guideline_url?: string | null
          id?: string
          is_active?: boolean
          keywords?: string[]
          organization: string
          publication_date?: string | null
          recommendation_text?: string
          specialty?: string
          summary?: string
          tier?: number
          title: string
          updated_at?: string
          version?: string
        }
        Update: {
          applicable_drugs?: string[]
          applicable_tests?: string[]
          condition?: string
          country?: string
          created_at?: string
          guideline_url?: string | null
          id?: string
          is_active?: boolean
          keywords?: string[]
          organization?: string
          publication_date?: string | null
          recommendation_text?: string
          specialty?: string
          summary?: string
          tier?: number
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      guideline_rules: {
        Row: {
          authority_id: string
          created_at: string
          diagnosis_id: string
          evidence_level: string
          id: string
          recommendation: string
          treatment_generic_name: string
        }
        Insert: {
          authority_id: string
          created_at?: string
          diagnosis_id: string
          evidence_level?: string
          id?: string
          recommendation?: string
          treatment_generic_name: string
        }
        Update: {
          authority_id?: string
          created_at?: string
          diagnosis_id?: string
          evidence_level?: string
          id?: string
          recommendation?: string
          treatment_generic_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "guideline_rules_authority_id_fkey"
            columns: ["authority_id"]
            isOneToOne: false
            referencedRelation: "guideline_authorities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guideline_rules_diagnosis_id_fkey"
            columns: ["diagnosis_id"]
            isOneToOne: false
            referencedRelation: "diagnoses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guideline_rules_treatment_generic_name_fkey"
            columns: ["treatment_generic_name"]
            isOneToOne: false
            referencedRelation: "drug_master"
            referencedColumns: ["generic_name"]
          },
        ]
      }
      guideline_sources: {
        Row: {
          created_at: string
          disease_category: string
          guideline_name: string
          id: string
          is_active: boolean
          last_updated: string
          organization: string
          priority: number
          region: string
          source_url: string | null
          version: string
        }
        Insert: {
          created_at?: string
          disease_category?: string
          guideline_name?: string
          id?: string
          is_active?: boolean
          last_updated?: string
          organization: string
          priority?: number
          region?: string
          source_url?: string | null
          version?: string
        }
        Update: {
          created_at?: string
          disease_category?: string
          guideline_name?: string
          id?: string
          is_active?: boolean
          last_updated?: string
          organization?: string
          priority?: number
          region?: string
          source_url?: string | null
          version?: string
        }
        Relationships: []
      }
      guideline_updates: {
        Row: {
          applicable_conditions: string[] | null
          applicable_drugs: string[] | null
          country: string | null
          created_at: string
          id: string
          ingested_at: string
          is_active: boolean | null
          keywords: string[] | null
          metadata: Json | null
          publication_date: string | null
          recommendation_text: string | null
          source_organization: string
          specialty: string | null
          summary: string | null
          supersedes_id: string | null
          title: string
          updated_at: string
          url: string | null
          version: string | null
        }
        Insert: {
          applicable_conditions?: string[] | null
          applicable_drugs?: string[] | null
          country?: string | null
          created_at?: string
          id?: string
          ingested_at?: string
          is_active?: boolean | null
          keywords?: string[] | null
          metadata?: Json | null
          publication_date?: string | null
          recommendation_text?: string | null
          source_organization: string
          specialty?: string | null
          summary?: string | null
          supersedes_id?: string | null
          title: string
          updated_at?: string
          url?: string | null
          version?: string | null
        }
        Update: {
          applicable_conditions?: string[] | null
          applicable_drugs?: string[] | null
          country?: string | null
          created_at?: string
          id?: string
          ingested_at?: string
          is_active?: boolean | null
          keywords?: string[] | null
          metadata?: Json | null
          publication_date?: string | null
          recommendation_text?: string | null
          source_organization?: string
          specialty?: string | null
          summary?: string | null
          supersedes_id?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guideline_updates_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "guideline_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      guideline_usage_logs: {
        Row: {
          clinic_id: string
          compliance_result: string | null
          created_at: string
          guideline_id: string
          guideline_name: string | null
          id: string
          matched_condition: string | null
          recommendation_checked: string | null
          recommendation_used: string | null
          tier: number
          visit_id: string
        }
        Insert: {
          clinic_id: string
          compliance_result?: string | null
          created_at?: string
          guideline_id: string
          guideline_name?: string | null
          id?: string
          matched_condition?: string | null
          recommendation_checked?: string | null
          recommendation_used?: string | null
          tier: number
          visit_id: string
        }
        Update: {
          clinic_id?: string
          compliance_result?: string | null
          created_at?: string
          guideline_id?: string
          guideline_name?: string | null
          id?: string
          matched_condition?: string | null
          recommendation_checked?: string | null
          recommendation_used?: string | null
          tier?: number
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guideline_usage_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guideline_usage_logs_guideline_id_fkey"
            columns: ["guideline_id"]
            isOneToOne: false
            referencedRelation: "guideline_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guideline_usage_logs_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "patient_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      innovation_insights: {
        Row: {
          category: string
          clinical_impact: string
          created_at: string
          evidence_source: string
          id: string
          keywords: string[]
          metadata: Json
          priority: string
          problem_detected: string
          reviewed_at: string | null
          reviewed_by: string | null
          roadmap_task: string | null
          source_urls: string[]
          status: string
          suggested_improvement: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          clinical_impact?: string
          created_at?: string
          evidence_source?: string
          id?: string
          keywords?: string[]
          metadata?: Json
          priority?: string
          problem_detected?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          roadmap_task?: string | null
          source_urls?: string[]
          status?: string
          suggested_improvement?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          clinical_impact?: string
          created_at?: string
          evidence_source?: string
          id?: string
          keywords?: string[]
          metadata?: Json
          priority?: string
          problem_detected?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          roadmap_task?: string | null
          source_urls?: string[]
          status?: string
          suggested_improvement?: string
          title?: string
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
          paid_at: string | null
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
          paid_at?: string | null
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
          paid_at?: string | null
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
      lab_catalog: {
        Row: {
          category: string | null
          clinic_id: string
          created_at: string | null
          external_lab_partner: string | null
          id: string
          is_active: boolean | null
          price: number | null
          test_code: string | null
          test_name: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          clinic_id: string
          created_at?: string | null
          external_lab_partner?: string | null
          id?: string
          is_active?: boolean | null
          price?: number | null
          test_code?: string | null
          test_name: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          clinic_id?: string
          created_at?: string | null
          external_lab_partner?: string | null
          id?: string
          is_active?: boolean | null
          price?: number | null
          test_code?: string | null
          test_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_catalog_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
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
      lab_partner_orders: {
        Row: {
          appointment_time: string | null
          clinic_id: string
          created_at: string | null
          id: string
          lab_order_id: string
          lab_partner_id: string | null
          notes: string | null
          patient_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          appointment_time?: string | null
          clinic_id: string
          created_at?: string | null
          id?: string
          lab_order_id: string
          lab_partner_id?: string | null
          notes?: string | null
          patient_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          appointment_time?: string | null
          clinic_id?: string
          created_at?: string | null
          id?: string
          lab_order_id?: string
          lab_partner_id?: string | null
          notes?: string | null
          patient_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_partner_orders_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_partner_orders_lab_order_id_fkey"
            columns: ["lab_order_id"]
            isOneToOne: false
            referencedRelation: "lab_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_partner_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
      lab_test_equivalence: {
        Row: {
          aliases: string[]
          canonical_name: string
          category: string
          created_at: string
          id: string
          loinc_code: string | null
        }
        Insert: {
          aliases?: string[]
          canonical_name: string
          category?: string
          created_at?: string
          id?: string
          loinc_code?: string | null
        }
        Update: {
          aliases?: string[]
          canonical_name?: string
          category?: string
          created_at?: string
          id?: string
          loinc_code?: string | null
        }
        Relationships: []
      }
      lab_tests: {
        Row: {
          category: string
          created_at: string
          id: string
          test_name: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          test_name: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          test_name?: string
        }
        Relationships: []
      }
      medical_evidence: {
        Row: {
          abstract: string | null
          authors: string | null
          created_at: string
          evidence_strength: string | null
          id: string
          ingested_at: string
          is_ai_summarized: boolean | null
          journal: string | null
          keywords: string[] | null
          metadata: Json | null
          relevance_category: string | null
          relevance_score: number | null
          source: string
          source_id: string | null
          summary: string | null
          title: string
          updated_at: string
          url: string | null
          year: number | null
        }
        Insert: {
          abstract?: string | null
          authors?: string | null
          created_at?: string
          evidence_strength?: string | null
          id?: string
          ingested_at?: string
          is_ai_summarized?: boolean | null
          journal?: string | null
          keywords?: string[] | null
          metadata?: Json | null
          relevance_category?: string | null
          relevance_score?: number | null
          source?: string
          source_id?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          url?: string | null
          year?: number | null
        }
        Update: {
          abstract?: string | null
          authors?: string | null
          created_at?: string
          evidence_strength?: string | null
          id?: string
          ingested_at?: string
          is_ai_summarized?: boolean | null
          journal?: string | null
          keywords?: string[] | null
          metadata?: Json | null
          relevance_category?: string | null
          relevance_score?: number | null
          source?: string
          source_id?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          year?: number | null
        }
        Relationships: []
      }
      medication_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          allergy_conflict: string | null
          clinic_id: string
          consultation_id: string | null
          created_at: string
          doctor_id: string
          dose_issue: string | null
          drug_a: string | null
          drug_b: string | null
          id: string
          message: string
          metadata: Json | null
          override_reason: string | null
          patient_id: string
          prescription_id: string | null
          rxnorm_ids: Json | null
          severity: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          allergy_conflict?: string | null
          clinic_id: string
          consultation_id?: string | null
          created_at?: string
          doctor_id: string
          dose_issue?: string | null
          drug_a?: string | null
          drug_b?: string | null
          id?: string
          message: string
          metadata?: Json | null
          override_reason?: string | null
          patient_id: string
          prescription_id?: string | null
          rxnorm_ids?: Json | null
          severity?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          allergy_conflict?: string | null
          clinic_id?: string
          consultation_id?: string | null
          created_at?: string
          doctor_id?: string
          dose_issue?: string | null
          drug_a?: string | null
          drug_b?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          override_reason?: string | null
          patient_id?: string
          prescription_id?: string | null
          rxnorm_ids?: Json | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_alerts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_alerts_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_alerts_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
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
      notification_logs: {
        Row: {
          clinic_id: string | null
          created_at: string
          delivery_status: string | null
          id: string
          message_content: string | null
          message_type: string
          patient_id: string
          provider: string | null
          provider_response: Json | null
          recipient_phone: string | null
          trigger_event: string
          visit_id: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          delivery_status?: string | null
          id?: string
          message_content?: string | null
          message_type: string
          patient_id: string
          provider?: string | null
          provider_response?: Json | null
          recipient_phone?: string | null
          trigger_event: string
          visit_id?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          delivery_status?: string | null
          id?: string
          message_content?: string | null
          message_type?: string
          patient_id?: string
          provider?: string | null
          provider_response?: Json | null
          recipient_phone?: string | null
          trigger_event?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "patient_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          clinic_id: string | null
          created_at: string
          id: string
          is_active: boolean
          message_template: string
          template_name: string
          trigger_event: string
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          message_template: string
          template_name: string
          trigger_event: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          message_template?: string
          template_name?: string
          trigger_event?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      outcome_feedback: {
        Row: {
          ai_diagnosis: string
          clinic_id: string
          consultation_id: string | null
          created_at: string | null
          days_to_resolution: number | null
          diagnosis_match: boolean | null
          doctor_final_diagnosis: string
          doctor_id: string
          follow_up_required: boolean | null
          id: string
          lab_results_summary: Json | null
          learning_signals: Json | null
          outcome_status: string | null
          patient_id: string
          readmission: boolean | null
          treatment_prescribed: Json | null
          updated_at: string | null
          visit_id: string
        }
        Insert: {
          ai_diagnosis: string
          clinic_id: string
          consultation_id?: string | null
          created_at?: string | null
          days_to_resolution?: number | null
          diagnosis_match?: boolean | null
          doctor_final_diagnosis: string
          doctor_id: string
          follow_up_required?: boolean | null
          id?: string
          lab_results_summary?: Json | null
          learning_signals?: Json | null
          outcome_status?: string | null
          patient_id: string
          readmission?: boolean | null
          treatment_prescribed?: Json | null
          updated_at?: string | null
          visit_id: string
        }
        Update: {
          ai_diagnosis?: string
          clinic_id?: string
          consultation_id?: string | null
          created_at?: string | null
          days_to_resolution?: number | null
          diagnosis_match?: boolean | null
          doctor_final_diagnosis?: string
          doctor_id?: string
          follow_up_required?: boolean | null
          id?: string
          lab_results_summary?: Json | null
          learning_signals?: Json | null
          outcome_status?: string | null
          patient_id?: string
          readmission?: boolean | null
          treatment_prescribed?: Json | null
          updated_at?: string | null
          visit_id?: string
        }
        Relationships: []
      }
      outcome_tracking: {
        Row: {
          adverse_events: Json | null
          clinic_id: string
          consultation_id: string
          created_at: string
          doctor_id: string
          follow_up_actual_date: string | null
          follow_up_missed: boolean | null
          follow_up_scheduled_date: string | null
          id: string
          outcome_notes: string | null
          outcome_status: string | null
          patient_id: string
          readmission_within_days: number | null
          treatment_effective: boolean | null
          updated_at: string
        }
        Insert: {
          adverse_events?: Json | null
          clinic_id: string
          consultation_id: string
          created_at?: string
          doctor_id: string
          follow_up_actual_date?: string | null
          follow_up_missed?: boolean | null
          follow_up_scheduled_date?: string | null
          id?: string
          outcome_notes?: string | null
          outcome_status?: string | null
          patient_id: string
          readmission_within_days?: number | null
          treatment_effective?: boolean | null
          updated_at?: string
        }
        Update: {
          adverse_events?: Json | null
          clinic_id?: string
          consultation_id?: string
          created_at?: string
          doctor_id?: string
          follow_up_actual_date?: string | null
          follow_up_missed?: boolean | null
          follow_up_scheduled_date?: string | null
          id?: string
          outcome_notes?: string | null
          outcome_status?: string | null
          patient_id?: string
          readmission_within_days?: number | null
          treatment_effective?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outcome_tracking_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_tracking_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_tracking_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_context_snapshots: {
        Row: {
          context_json: Json
          created_at: string
          id: string
          visit_id: string
        }
        Insert: {
          context_json?: Json
          created_at?: string
          id?: string
          visit_id: string
        }
        Update: {
          context_json?: Json
          created_at?: string
          id?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_context_snapshots_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "patient_visits"
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
          visit_token: string
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
          visit_token?: string
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
          visit_token?: string
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
      pharmacy_orders: {
        Row: {
          clinic_id: string
          created_at: string | null
          delivery_address: string | null
          id: string
          notes: string | null
          patient_id: string
          pharmacy_id: string | null
          prescription_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          delivery_address?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          pharmacy_id?: string | null
          prescription_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          delivery_address?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          pharmacy_id?: string | null
          prescription_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_orders_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      physiological_states: {
        Row: {
          created_at: string
          description: string
          id: string
          state_name: string
          system_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          state_name: string
          system_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          state_name?: string
          system_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "physiological_states_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "anatomical_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      physiology_diagnosis_map: {
        Row: {
          created_at: string
          diagnosis_id: string
          id: string
          physiological_state_id: string
          relevance_score: number
        }
        Insert: {
          created_at?: string
          diagnosis_id: string
          id?: string
          physiological_state_id: string
          relevance_score?: number
        }
        Update: {
          created_at?: string
          diagnosis_id?: string
          id?: string
          physiological_state_id?: string
          relevance_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "physiology_diagnosis_map_diagnosis_id_fkey"
            columns: ["diagnosis_id"]
            isOneToOne: false
            referencedRelation: "diagnoses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physiology_diagnosis_map_physiological_state_id_fkey"
            columns: ["physiological_state_id"]
            isOneToOne: false
            referencedRelation: "physiological_states"
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
      population_signals: {
        Row: {
          affected_count: number
          clinic_id: string | null
          created_at: string
          first_detected_at: string
          geographic_scope: string | null
          id: string
          indicators: Json
          is_resolved: boolean
          last_updated_at: string
          metadata: Json | null
          resolved_at: string | null
          severity: string
          signal_name: string
          signal_type: string
          time_window_hours: number
        }
        Insert: {
          affected_count?: number
          clinic_id?: string | null
          created_at?: string
          first_detected_at?: string
          geographic_scope?: string | null
          id?: string
          indicators?: Json
          is_resolved?: boolean
          last_updated_at?: string
          metadata?: Json | null
          resolved_at?: string | null
          severity?: string
          signal_name: string
          signal_type?: string
          time_window_hours?: number
        }
        Update: {
          affected_count?: number
          clinic_id?: string | null
          created_at?: string
          first_detected_at?: string
          geographic_scope?: string | null
          id?: string
          indicators?: Json
          is_resolved?: boolean
          last_updated_at?: string
          metadata?: Json | null
          resolved_at?: string | null
          severity?: string
          signal_name?: string
          signal_type?: string
          time_window_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "population_signals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      preindexed_knowledge: {
        Row: {
          condition_key: string
          condition_name: string
          created_at: string | null
          evidence_grade: string | null
          guideline_citations: Json | null
          icd10_codes: string[] | null
          id: string
          last_verified_at: string | null
          prevalence_tier: string | null
          recommended_tests: Json | null
          safety_considerations: Json | null
          source_authorities: string[] | null
          symptom_clusters: string[] | null
          treatment_options: Json | null
          updated_at: string | null
        }
        Insert: {
          condition_key: string
          condition_name: string
          created_at?: string | null
          evidence_grade?: string | null
          guideline_citations?: Json | null
          icd10_codes?: string[] | null
          id?: string
          last_verified_at?: string | null
          prevalence_tier?: string | null
          recommended_tests?: Json | null
          safety_considerations?: Json | null
          source_authorities?: string[] | null
          symptom_clusters?: string[] | null
          treatment_options?: Json | null
          updated_at?: string | null
        }
        Update: {
          condition_key?: string
          condition_name?: string
          created_at?: string | null
          evidence_grade?: string | null
          guideline_citations?: Json | null
          icd10_codes?: string[] | null
          id?: string
          last_verified_at?: string | null
          prevalence_tier?: string | null
          recommended_tests?: Json | null
          safety_considerations?: Json | null
          source_authorities?: string[] | null
          symptom_clusters?: string[] | null
          treatment_options?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      prescriptions: {
        Row: {
          brand_name: string | null
          clinic_id: string | null
          consultation_id: string
          created_at: string
          doctor_id: string
          dosage: string
          dose_unit: string | null
          dose_value: number | null
          drug_cui: string | null
          drug_name: string
          duration: string | null
          duration_days: number | null
          frequency: string | null
          frequency_code: string | null
          generic_name: string | null
          guideline_reference: string | null
          id: string
          instructions: string | null
          interactions: Json | null
          max_daily_dose: number | null
          patient_id: string
          route: string | null
          severity: string | null
          visit_id: string | null
        }
        Insert: {
          brand_name?: string | null
          clinic_id?: string | null
          consultation_id: string
          created_at?: string
          doctor_id: string
          dosage: string
          dose_unit?: string | null
          dose_value?: number | null
          drug_cui?: string | null
          drug_name: string
          duration?: string | null
          duration_days?: number | null
          frequency?: string | null
          frequency_code?: string | null
          generic_name?: string | null
          guideline_reference?: string | null
          id?: string
          instructions?: string | null
          interactions?: Json | null
          max_daily_dose?: number | null
          patient_id: string
          route?: string | null
          severity?: string | null
          visit_id?: string | null
        }
        Update: {
          brand_name?: string | null
          clinic_id?: string | null
          consultation_id?: string
          created_at?: string
          doctor_id?: string
          dosage?: string
          dose_unit?: string | null
          dose_value?: number | null
          drug_cui?: string | null
          drug_name?: string
          duration?: string | null
          duration_days?: number | null
          frequency?: string | null
          frequency_code?: string | null
          generic_name?: string | null
          guideline_reference?: string | null
          id?: string
          instructions?: string | null
          interactions?: Json | null
          max_daily_dose?: number | null
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
          city: string | null
          clinic_id: string | null
          clinic_name: string | null
          clinic_phone: string | null
          created_at: string
          designation: string | null
          email: string | null
          email_domain_type: string | null
          email_verified: boolean | null
          full_name: string
          id: string
          license_number: string | null
          phone: string | null
          phone_verified: boolean | null
          role_subtype: string | null
          signature_text: string | null
          specialization: string | null
          trust_score: number | null
          updated_at: string
          user_id: string
          verification_status: string
        }
        Insert: {
          account_status?: string
          city?: string | null
          clinic_id?: string | null
          clinic_name?: string | null
          clinic_phone?: string | null
          created_at?: string
          designation?: string | null
          email?: string | null
          email_domain_type?: string | null
          email_verified?: boolean | null
          full_name?: string
          id?: string
          license_number?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          role_subtype?: string | null
          signature_text?: string | null
          specialization?: string | null
          trust_score?: number | null
          updated_at?: string
          user_id: string
          verification_status?: string
        }
        Update: {
          account_status?: string
          city?: string | null
          clinic_id?: string | null
          clinic_name?: string | null
          clinic_phone?: string | null
          created_at?: string
          designation?: string | null
          email?: string | null
          email_domain_type?: string | null
          email_verified?: boolean | null
          full_name?: string
          id?: string
          license_number?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          role_subtype?: string | null
          signature_text?: string | null
          specialization?: string | null
          trust_score?: number | null
          updated_at?: string
          user_id?: string
          verification_status?: string
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
      reasoning_cache: {
        Row: {
          cluster_key: string
          cluster_symptoms: string[]
          confidence_score: number | null
          created_at: string | null
          expires_at: string
          hit_count: number | null
          id: string
          reasoning_output: Json
          ttl_hours: number | null
        }
        Insert: {
          cluster_key: string
          cluster_symptoms: string[]
          confidence_score?: number | null
          created_at?: string | null
          expires_at: string
          hit_count?: number | null
          id?: string
          reasoning_output: Json
          ttl_hours?: number | null
        }
        Update: {
          cluster_key?: string
          cluster_symptoms?: string[]
          confidence_score?: number | null
          created_at?: string | null
          expires_at?: string
          hit_count?: number | null
          id?: string
          reasoning_output?: Json
          ttl_hours?: number | null
        }
        Relationships: []
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
      report_tokens: {
        Row: {
          consultation_id: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          patient_id: string | null
          token: string
        }
        Insert: {
          consultation_id: string
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          patient_id?: string | null
          token: string
        }
        Update: {
          consultation_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          patient_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_tokens_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_flags: {
        Row: {
          created_at: string
          description: string
          flag_type: string
          id: string
          metadata: Json | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          flag_type?: string
          id?: string
          metadata?: Json | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          flag_type?: string
          id?: string
          metadata?: Json | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_id?: string
        }
        Relationships: []
      }
      risk_patterns: {
        Row: {
          action_hint: string | null
          created_at: string
          description: string
          id: string
          indicators: Json
          is_active: boolean
          pattern_name: string
          pattern_type: string
          severity: string
          specialty: string | null
          updated_at: string
        }
        Insert: {
          action_hint?: string | null
          created_at?: string
          description: string
          id?: string
          indicators?: Json
          is_active?: boolean
          pattern_name: string
          pattern_type?: string
          severity?: string
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          action_hint?: string | null
          created_at?: string
          description?: string
          id?: string
          indicators?: Json
          is_active?: boolean
          pattern_name?: string
          pattern_type?: string
          severity?: string
          specialty?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      symptom_diagnosis_map: {
        Row: {
          confidence_score: number
          created_at: string
          diagnosis_id: string
          id: string
          symptom_id: string
        }
        Insert: {
          confidence_score?: number
          created_at?: string
          diagnosis_id: string
          id?: string
          symptom_id: string
        }
        Update: {
          confidence_score?: number
          created_at?: string
          diagnosis_id?: string
          id?: string
          symptom_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "symptom_diagnosis_map_diagnosis_id_fkey"
            columns: ["diagnosis_id"]
            isOneToOne: false
            referencedRelation: "diagnoses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "symptom_diagnosis_map_symptom_id_fkey"
            columns: ["symptom_id"]
            isOneToOne: false
            referencedRelation: "symptoms"
            referencedColumns: ["id"]
          },
        ]
      }
      symptom_drug_map: {
        Row: {
          created_at: string
          generic_name: string
          id: string
          priority: string
          symptom_id: string
          treatment_type: string
        }
        Insert: {
          created_at?: string
          generic_name: string
          id?: string
          priority?: string
          symptom_id: string
          treatment_type?: string
        }
        Update: {
          created_at?: string
          generic_name?: string
          id?: string
          priority?: string
          symptom_id?: string
          treatment_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "symptom_drug_map_symptom_id_fkey"
            columns: ["symptom_id"]
            isOneToOne: false
            referencedRelation: "symptoms"
            referencedColumns: ["id"]
          },
        ]
      }
      symptom_lab_map: {
        Row: {
          clinical_rationale: string
          created_at: string
          id: string
          lab_test_id: string
          priority: string
          symptom_id: string
        }
        Insert: {
          clinical_rationale?: string
          created_at?: string
          id?: string
          lab_test_id: string
          priority?: string
          symptom_id: string
        }
        Update: {
          clinical_rationale?: string
          created_at?: string
          id?: string
          lab_test_id?: string
          priority?: string
          symptom_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "symptom_lab_map_lab_test_id_fkey"
            columns: ["lab_test_id"]
            isOneToOne: false
            referencedRelation: "lab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "symptom_lab_map_symptom_id_fkey"
            columns: ["symptom_id"]
            isOneToOne: false
            referencedRelation: "symptoms"
            referencedColumns: ["id"]
          },
        ]
      }
      symptom_physiology_map: {
        Row: {
          confidence_score: number
          created_at: string
          id: string
          physiological_state_id: string
          symptom_id: string
        }
        Insert: {
          confidence_score?: number
          created_at?: string
          id?: string
          physiological_state_id: string
          symptom_id: string
        }
        Update: {
          confidence_score?: number
          created_at?: string
          id?: string
          physiological_state_id?: string
          symptom_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "symptom_physiology_map_physiological_state_id_fkey"
            columns: ["physiological_state_id"]
            isOneToOne: false
            referencedRelation: "physiological_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "symptom_physiology_map_symptom_id_fkey"
            columns: ["symptom_id"]
            isOneToOne: false
            referencedRelation: "symptoms"
            referencedColumns: ["id"]
          },
        ]
      }
      symptoms: {
        Row: {
          category: string
          created_at: string
          id: string
          symptom_name: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          symptom_name: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          symptom_name?: string
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
      vital_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          action_hint: string | null
          clinic_id: string
          created_at: string
          doctor_id: string
          id: string
          message: string
          override_reason: string | null
          parameter: string
          patient_id: string
          severity: string
          value: number
          visit_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          action_hint?: string | null
          clinic_id: string
          created_at?: string
          doctor_id: string
          id?: string
          message: string
          override_reason?: string | null
          parameter: string
          patient_id: string
          severity?: string
          value: number
          visit_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          action_hint?: string | null
          clinic_id?: string
          created_at?: string
          doctor_id?: string
          id?: string
          message?: string
          override_reason?: string | null
          parameter?: string
          patient_id?: string
          severity?: string
          value?: number
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vital_alerts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vital_alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vital_alerts_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "patient_visits"
            referencedColumns: ["id"]
          },
        ]
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
