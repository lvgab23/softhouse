-- ============================================================
-- MIGRATION 009 — Kanban Full + Pipeline + Solar
-- Substitui as migrations 005, 007, 008 de forma limpa.
-- Execute este arquivo completo no Supabase SQL Editor.
-- ============================================================

-- ── Drop old kanban tables (migration 005 schema) ──────────
DROP TABLE IF EXISTS kanban_activity_history  CASCADE;
DROP TABLE IF EXISTS kanban_financial_links   CASCADE;
DROP TABLE IF EXISTS kanban_checklists        CASCADE;
DROP TABLE IF EXISTS kanban_comments          CASCADE;
DROP TABLE IF EXISTS kanban_cards             CASCADE;
DROP TABLE IF EXISTS oportunidades            CASCADE;

-- ── kanban_cards ───────────────────────────────────────────
CREATE TABLE kanban_cards (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  board_type          TEXT NOT NULL CHECK (board_type IN ('bens','negocios','projetos','pipeline')),
  column_id           TEXT NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  priority            TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa','media','alta','urgente')),
  responsible         TEXT,
  due_date            DATE,
  tags                TEXT[] DEFAULT '{}',
  category            TEXT,
  related_object_id   UUID,
  related_object_name TEXT,
  related_object_type TEXT,
  valor_estimado      NUMERIC,
  valor_real          NUMERIC,
  tipo_destino        TEXT,
  convertido          BOOLEAN DEFAULT FALSE,
  position            INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── kanban_checklist_items ─────────────────────────────────
CREATE TABLE kanban_checklist_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id      UUID NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  order_index  INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ── kanban_tasks ───────────────────────────────────────────
CREATE TABLE kanban_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id      UUID NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  responsible  TEXT,
  status       TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluido')),
  priority     TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa','media','alta')),
  due_date     DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ── kanban_comments ────────────────────────────────────────
CREATE TABLE kanban_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    UUID NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  user_email TEXT,
  comment    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── kanban_activity_logs ───────────────────────────────────
CREATE TABLE kanban_activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     UUID NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS for kanban tables ──────────────────────────────────
ALTER TABLE kanban_cards           ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_activity_logs   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanban_cards_user"     ON kanban_cards;
DROP POLICY IF EXISTS "kanban_checklist_user" ON kanban_checklist_items;
DROP POLICY IF EXISTS "kanban_tasks_user"     ON kanban_tasks;
DROP POLICY IF EXISTS "kanban_comments_user"  ON kanban_comments;
DROP POLICY IF EXISTS "kanban_activity_user"  ON kanban_activity_logs;

CREATE POLICY "kanban_cards_user" ON kanban_cards
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "kanban_checklist_user" ON kanban_checklist_items
  FOR ALL USING (EXISTS (SELECT 1 FROM kanban_cards WHERE id = card_id AND user_id = auth.uid()));

CREATE POLICY "kanban_tasks_user" ON kanban_tasks
  FOR ALL USING (EXISTS (SELECT 1 FROM kanban_cards WHERE id = card_id AND user_id = auth.uid()));

CREATE POLICY "kanban_comments_user" ON kanban_comments
  FOR ALL USING (EXISTS (SELECT 1 FROM kanban_cards WHERE id = card_id AND user_id = auth.uid()));

CREATE POLICY "kanban_activity_user" ON kanban_activity_logs
  FOR ALL USING (EXISTS (SELECT 1 FROM kanban_cards WHERE id = card_id AND user_id = auth.uid()));

-- ── Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_kanban_cards_board   ON kanban_cards(board_type, user_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_col     ON kanban_cards(column_id);
CREATE INDEX IF NOT EXISTS idx_kanban_check_card    ON kanban_checklist_items(card_id);
CREATE INDEX IF NOT EXISTS idx_kanban_tasks_card    ON kanban_tasks(card_id);
CREATE INDEX IF NOT EXISTS idx_kanban_comments_card ON kanban_comments(card_id);
CREATE INDEX IF NOT EXISTS idx_kanban_activity_card ON kanban_activity_logs(card_id);

-- ── usinas_solares ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usinas_solares (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome                 TEXT NOT NULL,
  localizacao          TEXT,
  cidade               TEXT,
  estado               TEXT,
  potencia_kw          NUMERIC,
  geracao_mensal_kwh   NUMERIC,
  valor_investimento   NUMERIC,
  receita_mensal       NUMERIC,
  data_instalacao      DATE,
  status               TEXT DEFAULT 'ativa' CHECK (status IN ('ativa','inativa','manutencao')),
  notas                TEXT,
  elekeeper_plant_uid  TEXT,
  tarifa_kwh           NUMERIC DEFAULT 0.85,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE usinas_solares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usinas_solares_user" ON usinas_solares;
CREATE POLICY "usinas_solares_user" ON usinas_solares
  FOR ALL USING (auth.uid() = user_id);

-- Add columns if table already existed without them
ALTER TABLE usinas_solares ADD COLUMN IF NOT EXISTS elekeeper_plant_uid TEXT;
ALTER TABLE usinas_solares ADD COLUMN IF NOT EXISTS tarifa_kwh           NUMERIC DEFAULT 0.85;

-- ── solar_geracoes ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS solar_geracoes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usina_id   UUID REFERENCES usinas_solares(id) ON DELETE CASCADE,
  data       DATE NOT NULL,
  kwh        NUMERIC NOT NULL DEFAULT 0,
  valor_brl  NUMERIC DEFAULT 0,
  status     TEXT DEFAULT 'normal',
  raw_data   JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usina_id, data)
);

ALTER TABLE solar_geracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "solar_geracoes_user" ON solar_geracoes;
CREATE POLICY "solar_geracoes_user" ON solar_geracoes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM usinas_solares WHERE id = usina_id AND user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_solar_geracoes_usina_data ON solar_geracoes(usina_id, data DESC);
