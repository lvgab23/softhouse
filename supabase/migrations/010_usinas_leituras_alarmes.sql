-- Leituras diárias de energia (histórico persistido)
CREATE TABLE IF NOT EXISTS usinas_solares_leituras (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  usina_id    uuid    NOT NULL REFERENCES usinas_solares(id) ON DELETE CASCADE,
  data        date    NOT NULL,
  kwh         numeric(10,3) NOT NULL DEFAULT 0,
  potencia_pico_kw numeric(10,3),
  eficiencia  numeric(6,2),
  source      text    DEFAULT 'api',
  created_at  timestamptz DEFAULT now(),
  UNIQUE(usina_id, data)
);
CREATE INDEX IF NOT EXISTS idx_leituras_usina_data ON usinas_solares_leituras(usina_id, data DESC);

-- RLS
ALTER TABLE usinas_solares_leituras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leituras_own" ON usinas_solares_leituras
  USING (usina_id IN (SELECT id FROM usinas_solares WHERE user_id = auth.uid()));

-- Alarmes / alertas
CREATE TABLE IF NOT EXISTS usinas_solares_alarmes (
  id           uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  usina_id     uuid    NOT NULL REFERENCES usinas_solares(id) ON DELETE CASCADE,
  tipo         text    NOT NULL, -- 'offline' | 'baixa_geracao' | 'sem_comunicacao'
  severidade   text    NOT NULL DEFAULT 'warning', -- 'info' | 'warning' | 'critical'
  descricao    text,
  ativo        boolean DEFAULT true,
  notificado   boolean DEFAULT false,
  notificado_em timestamptz,
  created_at   timestamptz DEFAULT now(),
  resolvido_em timestamptz
);
CREATE INDEX IF NOT EXISTS idx_alarmes_usina_ativo ON usinas_solares_alarmes(usina_id, ativo);

ALTER TABLE usinas_solares_alarmes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alarmes_own" ON usinas_solares_alarmes
  USING (usina_id IN (SELECT id FROM usinas_solares WHERE user_id = auth.uid()));

-- Configurações de alerta na usina
ALTER TABLE usinas_solares
  ADD COLUMN IF NOT EXISTS email_alerta    text,
  ADD COLUMN IF NOT EXISTS whatsapp_numero text,
  ADD COLUMN IF NOT EXISTS alertas_ativo   boolean DEFAULT true;
