export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          nome: string | null
          email: string | null
          avatar_url: string | null
          empresa: string | null
          created_at: string
        }
        Insert: {
          id: string
          nome?: string | null
          email?: string | null
          avatar_url?: string | null
          empresa?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string | null
          email?: string | null
          avatar_url?: string | null
          empresa?: string | null
          created_at?: string
        }
      }
      categorias: {
        Row: {
          id: string
          user_id: string
          nome: string
          taxa_depreciacao: number | null
          vida_util_anos: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          nome: string
          taxa_depreciacao?: number | null
          vida_util_anos?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          nome?: string
          taxa_depreciacao?: number | null
          vida_util_anos?: number | null
          created_at?: string
        }
      }
      patrimonios: {
        Row: {
          id: string
          user_id: string
          codigo: number
          nome: string
          categoria_id: string | null
          logradouro: string | null
          numero: string | null
          bairro: string | null
          cidade: string | null
          estado: string | null
          cep: string | null
          latitude: number | null
          longitude: number | null
          valor_aquisicao: number | null
          valor_atual: number | null
          data_aquisicao: string | null
          status: 'ativo' | 'inativo' | 'negociacao' | 'vendido'
          kanban_coluna: string | null
          notas: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          nome: string
          categoria_id?: string | null
          logradouro?: string | null
          numero?: string | null
          bairro?: string | null
          cidade?: string | null
          estado?: string | null
          cep?: string | null
          latitude?: number | null
          longitude?: number | null
          valor_aquisicao?: number | null
          valor_atual?: number | null
          data_aquisicao?: string | null
          status?: 'ativo' | 'inativo' | 'negociacao' | 'vendido'
          kanban_coluna?: string | null
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          nome?: string
          categoria_id?: string | null
          logradouro?: string | null
          numero?: string | null
          bairro?: string | null
          cidade?: string | null
          estado?: string | null
          cep?: string | null
          latitude?: number | null
          longitude?: number | null
          valor_aquisicao?: number | null
          valor_atual?: number | null
          data_aquisicao?: string | null
          status?: 'ativo' | 'inativo' | 'negociacao' | 'vendido'
          kanban_coluna?: string | null
          notas?: string | null
          updated_at?: string
        }
      }
      fornecedores: {
        Row: {
          id: string
          user_id: string
          nome: string
          cnpj: string | null
          telefone: string | null
          email: string | null
          categoria: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          nome: string
          cnpj?: string | null
          telefone?: string | null
          email?: string | null
          categoria?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          nome?: string
          cnpj?: string | null
          telefone?: string | null
          email?: string | null
          categoria?: string | null
        }
      }
      movimentacoes: {
        Row: {
          id: string
          user_id: string
          patrimonio_id: string | null
          tipo: 'entrada' | 'saida'
          categoria: string | null
          descricao: string | null
          valor: number
          data: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          patrimonio_id?: string | null
          tipo: 'entrada' | 'saida'
          categoria?: string | null
          descricao?: string | null
          valor: number
          data: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          patrimonio_id?: string | null
          tipo?: 'entrada' | 'saida'
          categoria?: string | null
          descricao?: string | null
          valor?: number
          data?: string
        }
      }
      manutencoes: {
        Row: {
          id: string
          user_id: string
          patrimonio_id: string | null
          fornecedor_id: string | null
          descricao: string
          custo: number | null
          data_realizacao: string | null
          proxima_manutencao: string | null
          status: 'pendente' | 'em_andamento' | 'concluida'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          patrimonio_id?: string | null
          fornecedor_id?: string | null
          descricao: string
          custo?: number | null
          data_realizacao?: string | null
          proxima_manutencao?: string | null
          status?: 'pendente' | 'em_andamento' | 'concluida'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          patrimonio_id?: string | null
          fornecedor_id?: string | null
          descricao?: string
          custo?: number | null
          data_realizacao?: string | null
          proxima_manutencao?: string | null
          status?: 'pendente' | 'em_andamento' | 'concluida'
        }
      }
      alugueis: {
        Row: {
          id: string
          user_id: string
          patrimonio_id: string | null
          inquilino_nome: string | null
          inquilino_cpf: string | null
          inquilino_telefone: string | null
          valor_aluguel: number | null
          dia_vencimento: number | null
          data_inicio: string | null
          data_fim: string | null
          status: 'ativo' | 'encerrado' | 'inadimplente'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          patrimonio_id?: string | null
          inquilino_nome?: string | null
          inquilino_cpf?: string | null
          inquilino_telefone?: string | null
          valor_aluguel?: number | null
          dia_vencimento?: number | null
          data_inicio?: string | null
          data_fim?: string | null
          status?: 'ativo' | 'encerrado' | 'inadimplente'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          patrimonio_id?: string | null
          inquilino_nome?: string | null
          inquilino_cpf?: string | null
          inquilino_telefone?: string | null
          valor_aluguel?: number | null
          dia_vencimento?: number | null
          data_inicio?: string | null
          data_fim?: string | null
          status?: 'ativo' | 'encerrado' | 'inadimplente'
        }
      }
      historico: {
        Row: {
          id: string
          user_id: string
          tabela: string | null
          acao: 'criacao' | 'alteracao' | 'exclusao'
          campos: string | null
          registro_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tabela?: string | null
          acao: 'criacao' | 'alteracao' | 'exclusao'
          campos?: string | null
          registro_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tabela?: string | null
          acao?: 'criacao' | 'alteracao' | 'exclusao'
          campos?: string | null
          registro_id?: string | null
        }
      }
      colaboradores: {
        Row: {
          id: string
          owner_id: string
          user_id: string
          nivel: 'admin' | 'editor' | 'visualizador'
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          user_id: string
          nivel?: 'admin' | 'editor' | 'visualizador'
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          user_id?: string
          nivel?: 'admin' | 'editor' | 'visualizador'
        }
      }
      projetos: {
        Row: {
          id: string
          user_id: string
          nome: string
          descricao: string | null
          valor_total: number | null
          data_inicio: string | null
          status: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          nome: string
          descricao?: string | null
          valor_total?: number | null
          data_inicio?: string | null
          status?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          nome?: string
          descricao?: string | null
          valor_total?: number | null
          data_inicio?: string | null
          status?: string | null
        }
      }
      aportes: {
        Row: {
          id: string
          user_id: string
          projeto_id: string | null
          valor: number | null
          data: string | null
          descricao: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          projeto_id?: string | null
          valor?: number | null
          data?: string | null
          descricao?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          projeto_id?: string | null
          valor?: number | null
          data?: string | null
          descricao?: string | null
        }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Categoria = Database['public']['Tables']['categorias']['Row']
export type Patrimonio = Database['public']['Tables']['patrimonios']['Row']
export type Fornecedor = Database['public']['Tables']['fornecedores']['Row']
export type Movimentacao = Database['public']['Tables']['movimentacoes']['Row']
export type Manutencao = Database['public']['Tables']['manutencoes']['Row']
export type Aluguel = Database['public']['Tables']['alugueis']['Row']
export type Historico = Database['public']['Tables']['historico']['Row']
export type Colaborador = Database['public']['Tables']['colaboradores']['Row']
export type Projeto = Database['public']['Tables']['projetos']['Row']
export type Aporte = Database['public']['Tables']['aportes']['Row']
