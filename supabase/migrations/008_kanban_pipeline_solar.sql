-- Permite 'pipeline' como board_type
ALTER TABLE kanban_cards DROP CONSTRAINT IF EXISTS kanban_cards_board_type_check;
ALTER TABLE kanban_cards ADD CONSTRAINT kanban_cards_board_type_check
  CHECK (board_type IN ('bens', 'negocios', 'projetos', 'pipeline'));

-- Campo financeiro no card
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS valor_estimado NUMERIC;
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS valor_real     NUMERIC;
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS tipo_destino   TEXT;   -- projetos | patrimonios | empresas
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS convertido     BOOLEAN DEFAULT FALSE;

-- Cache de geração solar diária
CREATE TABLE IF NOT EXISTS solar_geracoes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usina_id     UUID REFERENCES usinas_solares(id) ON DELETE CASCADE,
  data         DATE NOT NULL,
  kwh          NUMERIC NOT NULL DEFAULT 0,
  valor_brl    NUMERIC DEFAULT 0,
  status       TEXT DEFAULT 'normal',
  raw_data     JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usina_id, data)
);

-- Configuração Elekeeper por usina
ALTER TABLE usinas_solares ADD COLUMN IF NOT EXISTS elekeeper_plant_uid TEXT;
ALTER TABLE usinas_solares ADD COLUMN IF NOT EXISTS tarifa_kwh           NUMERIC DEFAULT 0.85;

ALTER TABLE solar_geracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "solar_geracoes_user" ON solar_geracoes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM usinas_solares WHERE id = usina_id AND user_id = auth.uid())
  );
