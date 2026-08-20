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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      bairros: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      equipes: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      zonas_equipe: {
        Row: {
          id: string
          nome: string
          equipe_id: string | null
          geojson: Json
          cor: string
          created_at: string
        }
        Insert: {
          id?: string
          nome: string
          equipe_id?: string | null
          geojson: Json
          cor?: string
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string
          equipe_id?: string | null
          geojson?: Json
          cor?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zonas_equipe_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
        ]
      }
      imoveis: {
        Row: {
          complemento: string
          created_at: string
          data_pesquisa: string | null
          equipe_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          numero: string
          observacao: string | null
          resultado_atual:
            | Database["public"]["Enums"]["resultado_pesquisa"]
            | null
          rua_id: string
          updated_at: string
          nome_morador: string | null
          situacao: string | null
          voto_estadual: string | null
          voto_federal: string | null
          voto_senador: string | null
          voto_governador: string | null
          voto_presidente: string | null
        }
        Insert: {
          complemento?: string
          created_at?: string
          data_pesquisa?: string | null
          equipe_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          numero: string
          observacao?: string | null
          resultado_atual?:
            | Database["public"]["Enums"]["resultado_pesquisa"]
            | null
          rua_id: string
          updated_at?: string
          nome_morador?: string | null
          situacao?: string | null
          voto_estadual?: string | null
          voto_federal?: string | null
          voto_senador?: string | null
          voto_governador?: string | null
          voto_presidente?: string | null
        }
        Update: {
          complemento?: string
          created_at?: string
          data_pesquisa?: string | null
          equipe_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          numero?: string
          observacao?: string | null
          resultado_atual?:
            | Database["public"]["Enums"]["resultado_pesquisa"]
            | null
          rua_id?: string
          updated_at?: string
          nome_morador?: string | null
          situacao?: string | null
          voto_estadual?: string | null
          voto_federal?: string | null
          voto_senador?: string | null
          voto_governador?: string | null
          voto_presidente?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imoveis_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imoveis_rua_id_fkey"
            columns: ["rua_id"]
            isOneToOne: false
            referencedRelation: "ruas"
            referencedColumns: ["id"]
          },
        ]
      }
      importacao_erros: {
        Row: {
          created_at: string
          dados: Json | null
          id: string
          importacao_id: string
          linha: number
          mensagem: string
        }
        Insert: {
          created_at?: string
          dados?: Json | null
          id?: string
          importacao_id: string
          linha: number
          mensagem: string
        }
        Update: {
          created_at?: string
          dados?: Json | null
          id?: string
          importacao_id?: string
          linha?: number
          mensagem?: string
        }
        Relationships: [
          {
            foreignKeyName: "importacao_erros_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      importacoes: {
        Row: {
          arquivo_nome: string
          atualizados: number
          created_at: string
          created_by: string | null
          erros: number
          id: string
          novos: number
          total_linhas: number
        }
        Insert: {
          arquivo_nome: string
          atualizados?: number
          created_at?: string
          created_by?: string | null
          erros?: number
          id?: string
          novos?: number
          total_linhas?: number
        }
        Update: {
          arquivo_nome?: string
          atualizados?: number
          created_at?: string
          created_by?: string | null
          erros?: number
          id?: string
          novos?: number
          total_linhas?: number
        }
        Relationships: []
      }
      localidades: {
        Row: {
          bairro_id: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          bairro_id: string
          created_at?: string
          id?: string
          nome?: string
        }
        Update: {
          bairro_id?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "localidades_bairro_id_fkey"
            columns: ["bairro_id"]
            isOneToOne: false
            referencedRelation: "bairros"
            referencedColumns: ["id"]
          },
        ]
      }
      pesquisas: {
        Row: {
          created_at: string
          created_by: string | null
          data_pesquisa: string
          equipe_id: string | null
          id: string
          imovel_id: string
          observacao: string | null
          resultado: Database["public"]["Enums"]["resultado_pesquisa"] | null
          nome_morador: string | null
          situacao: string | null
          voto_estadual: string | null
          voto_federal: string | null
          voto_senador: string | null
          voto_governador: string | null
          voto_presidente: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_pesquisa?: string
          equipe_id?: string | null
          id?: string
          imovel_id: string
          observacao?: string | null
          resultado?: Database["public"]["Enums"]["resultado_pesquisa"] | null
          nome_morador?: string | null
          situacao?: string | null
          voto_estadual?: string | null
          voto_federal?: string | null
          voto_senador?: string | null
          voto_governador?: string | null
          voto_presidente?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_pesquisa?: string
          equipe_id?: string | null
          id?: string
          imovel_id?: string
          observacao?: string | null
          resultado?: Database["public"]["Enums"]["resultado_pesquisa"] | null
          nome_morador?: string | null
          situacao?: string | null
          voto_estadual?: string | null
          voto_federal?: string | null
          voto_senador?: string | null
          voto_governador?: string | null
          voto_presidente?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pesquisas_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesquisas_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
        ]
      }
      ruas: {
        Row: {
          created_at: string
          id: string
          localidade_id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          localidade_id: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          localidade_id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "ruas_localidade_id_fkey"
            columns: ["localidade_id"]
            isOneToOne: false
            referencedRelation: "localidades"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      upsert_imovel: {
        Args: {
          p_bairro: string
          p_complemento?: string
          p_data?: string
          p_equipe?: string
          p_latitude?: number
          p_localidade?: string
          p_longitude?: number
          p_numero?: string
          p_observacao?: string
          p_resultado?: Database["public"]["Enums"]["resultado_pesquisa"]
          p_rua?: string
        }
        Returns: Json
      }
    }
    Enums: {
      resultado_pesquisa:
        | "apoia"
        | "nao_apoia"
        | "indeciso"
        | "nao_respondeu"
        | "nao_encontrado"
      user_role: "super_admin" | "admin" | "leader" | "minister"
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
      resultado_pesquisa: [
        "apoia",
        "nao_apoia",
        "indeciso",
        "nao_respondeu",
        "nao_encontrado",
      ],
      user_role: ["super_admin", "admin", "leader", "minister"],
    },
  },
} as const
