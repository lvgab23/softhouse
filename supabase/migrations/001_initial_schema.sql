-- SoftHouse - Schema inicial
-- Execute este arquivo no SQL Editor do Supabase

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extensão do auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome TEXT,
  email TEXT,
  avatar_url TEXT,
  empresa TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger para criar profile automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- CATEGORIAS
-- ============================================================
CREATE TABLE IF NOT EXISTS categorias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  taxa_depreciacao DECIMAL(5,2) DEFAULT 0,
  vida_util_anos INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own categorias" ON categorias
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- PATRIMONIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS patrimonios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  codigo SERIAL,
  nome TEXT NOT NULL,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  logradouro TEXT,
  numero TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  valor_aquisicao DECIMAL(15,2),
  valor_atual DECIMAL(15,2),
  data_aquisicao DATE,
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','inativo','negociacao','vendido')),
  kanban_coluna TEXT DEFAULT 'aquisicao',
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE patrimonios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own patrimonios" ON patrimonios
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- FORNECEDORES
-- ============================================================
CREATE TABLE IF NOT EXISTS fornecedores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  cnpj TEXT,
  telefone TEXT,
  email TEXT,
  categoria TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own fornecedores" ON fornecedores
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- MOVIMENTACOES
-- ============================================================
CREATE TABLE IF NOT EXISTS movimentacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  patrimonio_id UUID REFERENCES patrimonios(id) ON DELETE SET NULL,
  tipo TEXT CHECK (tipo IN ('entrada','saida')) NOT NULL,
  categoria TEXT,
  descricao TEXT,
  valor DECIMAL(15,2) NOT NULL,
  data DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own movimentacoes" ON movimentacoes
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- MANUTENCOES
-- ============================================================
CREATE TABLE IF NOT EXISTS manutencoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  patrimonio_id UUID REFERENCES patrimonios(id) ON DELETE SET NULL,
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  custo DECIMAL(15,2),
  data_realizacao DATE,
  proxima_manutencao DATE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluida')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE manutencoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own manutencoes" ON manutencoes
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- ALUGUEIS
-- ============================================================
CREATE TABLE IF NOT EXISTS alugueis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  patrimonio_id UUID REFERENCES patrimonios(id) ON DELETE SET NULL,
  inquilino_nome TEXT,
  inquilino_cpf TEXT,
  inquilino_telefone TEXT,
  valor_aluguel DECIMAL(15,2),
  dia_vencimento INT,
  data_inicio DATE,
  data_fim DATE,
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','encerrado','inadimplente')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE alugueis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own alugueis" ON alugueis
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- HISTORICO
-- ============================================================
CREATE TABLE IF NOT EXISTS historico (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  tabela TEXT,
  acao TEXT CHECK (acao IN ('criacao','alteracao','exclusao')) NOT NULL,
  campos TEXT,
  registro_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own historico" ON historico
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- COLABORADORES
-- ============================================================
CREATE TABLE IF NOT EXISTS colaboradores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  nivel TEXT DEFAULT 'visualizador' CHECK (nivel IN ('admin','editor','visualizador')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage colaboradores" ON colaboradores
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Colaboradores view own access" ON colaboradores
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- PROJETOS
-- ============================================================
CREATE TABLE IF NOT EXISTS projetos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  valor_total DECIMAL(15,2) DEFAULT 0,
  data_inicio DATE,
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projetos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own projetos" ON projetos
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- APORTES
-- ============================================================
CREATE TABLE IF NOT EXISTS aportes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  projeto_id UUID REFERENCES projetos(id) ON DELETE CASCADE,
  valor DECIMAL(15,2),
  data DATE,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE aportes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own aportes" ON aportes
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_patrimonios_user_id ON patrimonios(user_id);
CREATE INDEX IF NOT EXISTS idx_patrimonios_status ON patrimonios(status);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_user_id ON movimentacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON movimentacoes(data);
CREATE INDEX IF NOT EXISTS idx_manutencoes_user_id ON manutencoes(user_id);
CREATE INDEX IF NOT EXISTS idx_historico_user_id ON historico(user_id);
CREATE INDEX IF NOT EXISTS idx_historico_created_at ON historico(created_at DESC);
