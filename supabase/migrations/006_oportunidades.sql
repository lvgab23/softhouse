CREATE TABLE IF NOT EXISTS oportunidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  titulo TEXT NOT NULL,
  descricao TEXT,
  coluna TEXT NOT NULL DEFAULT 'primeira_reuniao',
  tipo_destino TEXT,
  valor_estimado NUMERIC,
  responsavel TEXT,
  notas TEXT,
  convertido BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
