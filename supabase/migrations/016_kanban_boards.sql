-- 016_kanban_boards.sql
-- Quadros personalizados do Kanban (estilo Trello): o usuário cria/edita/exclui quadros.
-- Escopado por portfólio ativo (multi-tenant). NÃO apaga dados. Aditivo e seguro:
-- o Kanban atual (pipeline) e os kanbans de módulo continuam funcionando igual.

-- Tabela dos quadros
CREATE TABLE IF NOT EXISTS public.kanban_boards (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  name       text NOT NULL,
  color      text DEFAULT '#6366f1',
  icon       text,
  columns    jsonb NOT NULL DEFAULT '[]'::jsonb,
  position   int  DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.kanban_boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "active_portfolio" ON public.kanban_boards;
CREATE POLICY "active_portfolio" ON public.kanban_boards FOR ALL TO authenticated
  USING (user_id = public.current_owner())
  WITH CHECK (user_id = public.current_owner());

DROP TRIGGER IF EXISTS trg_set_active_owner ON public.kanban_boards;
CREATE TRIGGER trg_set_active_owner BEFORE INSERT ON public.kanban_boards
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_to_active();

-- Cada card pode pertencer a um quadro personalizado
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS board_id uuid
  REFERENCES public.kanban_boards(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_kanban_cards_board_id ON public.kanban_cards(board_id);

-- Permite o tipo 'custom' (quadros criados pelo usuário) e 'adm' na restrição de board_type
ALTER TABLE public.kanban_cards DROP CONSTRAINT IF EXISTS kanban_cards_board_type_check;
ALTER TABLE public.kanban_cards ADD CONSTRAINT kanban_cards_board_type_check
  CHECK (board_type IN ('bens','negocios','projetos','pipeline','adm','custom'));
