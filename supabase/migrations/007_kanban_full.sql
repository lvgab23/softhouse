-- Kanban completo: cards, checklist, tarefas, comentários e atividades

CREATE TABLE IF NOT EXISTS kanban_cards (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  board_type          TEXT NOT NULL CHECK (board_type IN ('bens', 'negocios', 'projetos')),
  column_id           TEXT NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  priority            TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta', 'urgente')),
  responsible         TEXT,
  due_date            DATE,
  tags                TEXT[] DEFAULT '{}',
  category            TEXT,
  related_object_id   UUID,
  related_object_name TEXT,
  related_object_type TEXT,
  position            INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kanban_checklist_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id      UUID NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  order_index  INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS kanban_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id      UUID NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  responsible  TEXT,
  status       TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido')),
  priority     TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta')),
  due_date     DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS kanban_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    UUID NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  user_email TEXT,
  comment    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kanban_activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     UUID NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE kanban_cards           ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_activity_logs   ENABLE ROW LEVEL SECURITY;

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
