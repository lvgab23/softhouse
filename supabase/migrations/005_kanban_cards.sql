-- Kanban cards system (module-agnostic)
CREATE TABLE IF NOT EXISTS kanban_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  module_type TEXT NOT NULL CHECK (module_type IN ('projects', 'assets', 'businesses')),
  column_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta', 'urgente')),
  responsible TEXT,
  participants TEXT[] DEFAULT '{}',
  start_date DATE,
  due_date DATE,
  tags TEXT[] DEFAULT '{}',
  estimated_value NUMERIC,
  realized_value NUMERIC,
  linked_entity_type TEXT,
  linked_entity_id UUID,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kanban_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES kanban_cards(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  responsible TEXT,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kanban_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES kanban_cards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  author_name TEXT,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kanban_financial_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES kanban_cards(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('conta_pagar', 'conta_receber', 'despesa', 'receita')),
  description TEXT NOT NULL,
  value NUMERIC,
  due_date DATE,
  status TEXT DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kanban_activity_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES kanban_cards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  author_name TEXT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kanban_cards_module_idx ON kanban_cards(module_type, column_id);
CREATE INDEX IF NOT EXISTS kanban_checklists_card_idx ON kanban_checklists(card_id);
CREATE INDEX IF NOT EXISTS kanban_comments_card_idx ON kanban_comments(card_id);
CREATE INDEX IF NOT EXISTS kanban_history_card_idx ON kanban_activity_history(card_id);
