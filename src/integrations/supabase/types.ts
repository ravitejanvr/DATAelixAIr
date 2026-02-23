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
      consultations: {
        Row: {
          ai_summary: string | null
          billing_amount: number | null
          billing_details: Json | null
          chief_complaint: string | null
          created_at: string
          doctor_id: string
          drug_interactions: Json | null
          drug_recommendations: Json | null
          follow_up_date: string | null
          id: string
          patient_id: string
          pubmed_citations: Json | null
          raw_transcript: string | null
          risk_assessment: Json | null
          soap_assessment: string | null
          soap_objective: string | null
          soap_plan: string | null
          soap_subjective: string | null
          status: string | null
          tests_ordered: string[] | null
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          billing_amount?: number | null
          billing_details?: Json | null
          chief_complaint?: string | null
          created_at?: string
          doctor_id: string
          drug_interactions?: Json | null
          drug_recommendations?: Json | null
          follow_up_date?: string | null
          id?: string
          patient_id: string
          pubmed_citations?: Json | null
          raw_transcript?: string | null
          risk_assessment?: Json | null
          soap_assessment?: string | null
          soap_objective?: string | null
          soap_plan?: string | null
          soap_subjective?: string | null
          status?: string | null
          tests_ordered?: string[] | null
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          billing_amount?: number | null
          billing_details?: Json | null
          chief_complaint?: string | null
          created_at?: string
          doctor_id?: string
          drug_interactions?: Json | null
          drug_recommendations?: Json | null
          follow_up_date?: string | null
          id?: string
          patient_id?: string
          pubmed_citations?: Json | null
          raw_transcript?: string | null
          risk_assessment?: Json | null
          soap_assessment?: string | null
          soap_objective?: string | null
          soap_plan?: string | null
          soap_subjective?: string | null
          status?: string | null
          tests_ordered?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultations_patient_id_fkey"
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
          age: number | null
          alcohol_use: string | null
          allergies: string[] | null
          blood_group: string | null
          bmi: number | null
          created_at: string
          current_medications: string[] | null
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
          age?: number | null
          alcohol_use?: string | null
          allergies?: string[] | null
          blood_group?: string | null
          bmi?: number | null
          created_at?: string
          current_medications?: string[] | null
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
          age?: number | null
          alcohol_use?: string | null
          allergies?: string[] | null
          blood_group?: string | null
          bmi?: number | null
          created_at?: string
          current_medications?: string[] | null
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
        Relationships: []
      }
      prescriptions: {
        Row: {
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
        }
        Insert: {
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
        }
        Update: {
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
        }
        Relationships: [
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
        ]
      }
      profiles: {
        Row: {
          clinic_name: string | null
          created_at: string
          full_name: string
          id: string
          license_number: string | null
          phone: string | null
          specialization: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_name?: string | null
          created_at?: string
          full_name?: string
          id?: string
          license_number?: string | null
          phone?: string | null
          specialization?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_name?: string | null
          created_at?: string
          full_name?: string
          id?: string
          license_number?: string | null
          phone?: string | null
          specialization?: string | null
          updated_at?: string
          user_id?: string
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
      is_doctor_for_patient: {
        Args: { p_patient_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "doctor" | "patient"
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
      app_role: ["doctor", "patient"],
    },
  },
} as const
