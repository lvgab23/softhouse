-- Bens Móveis (veículos, equipamentos, maquinários)
-- Execute no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS bens_moveis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'automovel',        -- automovel, moto, caminhao, van, maquinario, equipamento, outro
  marca TEXT,
  modelo TEXT,
  ano INTEGER,
  placa TEXT,
  renavam TEXT,
  cor TEXT,
  km_atual DECIMAL(12,1),
  combustivel TEXT,                     -- gasolina, etanol, flex, diesel, eletrico, hibrido, gnv
  valor_aquisicao DECIMAL(15,2),
  valor_atual DECIMAL(15,2),
  data_aquisicao DATE,
  seguro_apolice TEXT,
  seguro_vencimento DATE,
  ipva_vencimento DATE,
  status TEXT DEFAULT 'ativo',          -- ativo, manutencao, inativo, vendido
  cidade TEXT,
  estado TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bens_moveis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own bens_moveis" ON bens_moveis;
CREATE POLICY "Users manage own bens_moveis" ON bens_moveis
  FOR ALL USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_bens_moveis_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_bens_moveis_updated_at ON bens_moveis;
CREATE TRIGGER set_bens_moveis_updated_at
  BEFORE UPDATE ON bens_moveis
  FOR EACH ROW EXECUTE FUNCTION update_bens_moveis_updated_at();
