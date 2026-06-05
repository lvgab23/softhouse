-- 013_multitenant_rls.sql
-- Multi-tenant por portfólio (colaboradores), centralizado no banco.
--
-- Ideia: cada usuário tem um "portfólio ativo" guardado no banco (user_active_portfolio).
-- A trava (RLS) de todas as tabelas passa a filtrar por esse portfólio ativo automaticamente,
-- e um trigger grava cada novo registro no portfólio ativo. Assim:
--   - Em "Meu portfólio" => só vê/grava dados do próprio dono.
--   - Em um portfólio de colaborador => só vê/grava dados daquele dono (nunca mistura).
--   - Editar como colaborador salva na conta do DONO, sem tocar na conta pessoal.

-- ============================================================
-- 1. Tabela do portfólio ativo de cada usuário
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_active_portfolio (
  user_id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_owner_id uuid NOT NULL,
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.user_active_portfolio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own active portfolio" ON public.user_active_portfolio;
CREATE POLICY "own active portfolio" ON public.user_active_portfolio
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 2. Funções auxiliares (SECURITY DEFINER => ignoram RLS por dentro, sem recursão)
-- ============================================================

-- Sou membro (dono OU colaborador ativo) deste portfólio?
CREATE OR REPLACE FUNCTION public.is_member_of(target_owner uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT
    target_owner = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.colaboradores c
      WHERE c.user_id = auth.uid()
        AND COALESCE(c.owner_id, c.owner_user_id) = target_owner
        AND COALESCE(c.status, 'ativo') = 'ativo'
    );
$$;

-- Qual o portfólio ativo do usuário logado? (default: ele mesmo)
CREATE OR REPLACE FUNCTION public.current_owner()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT active_owner_id FROM public.user_active_portfolio WHERE user_id = auth.uid()),
    auth.uid()
  );
$$;

-- Troca o portfólio ativo (validando que o usuário tem acesso)
CREATE OR REPLACE FUNCTION public.set_active_portfolio(target uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.is_member_of(target) THEN
    RAISE EXCEPTION 'sem acesso a este portfolio';
  END IF;
  INSERT INTO public.user_active_portfolio (user_id, active_owner_id, updated_at)
  VALUES (auth.uid(), target, now())
  ON CONFLICT (user_id) DO UPDATE
    SET active_owner_id = EXCLUDED.active_owner_id, updated_at = now();
END;
$$;

-- Trigger: ao inserir, grava o registro no portfólio ativo (só para usuários reais,
-- não para service_role / crons que não têm auth.uid()).
CREATE OR REPLACE FUNCTION public.set_user_id_to_active()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.user_id := public.current_owner();
  END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_member_of(uuid)          TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.current_owner()             TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_active_portfolio(uuid)  TO authenticated;

-- ============================================================
-- 3. Recria as políticas + trigger de TODAS as tabelas com coluna user_id
--    (exceto colaboradores e user_active_portfolio, que têm regra própria)
-- ============================================================
DO $$
DECLARE
  t   text;
  pol text;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'user_id'
      AND tb.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('colaboradores', 'user_active_portfolio')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- remove todas as políticas antigas
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
    END LOOP;

    -- nova política: só o portfólio ativo
    EXECUTE format(
      'CREATE POLICY "active_portfolio" ON public.%I FOR ALL TO authenticated '
      || 'USING (user_id = public.current_owner()) '
      || 'WITH CHECK (user_id = public.current_owner())',
      t
    );

    -- trigger que força user_id = portfólio ativo no insert
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_active_owner ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_active_owner BEFORE INSERT ON public.%I '
      || 'FOR EACH ROW EXECUTE FUNCTION public.set_user_id_to_active()',
      t
    );
  END LOOP;
END $$;

-- ============================================================
-- 4. profiles: colaborador precisa LER o nome/email do dono (para o seletor de portfólio)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "members_view_profile" ON public.profiles;
CREATE POLICY "members_view_profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_member_of(id));
-- (update/insert do profile continuam restritos ao próprio usuário — políticas originais mantidas)

-- ============================================================
-- 5. Tabelas-filhas (herdam o dono da tabela-pai) — escopo pelo portfólio ativo
-- ============================================================
DO $$
BEGIN
  -- Kanban (filhas de kanban_cards)
  IF to_regclass('public.kanban_checklist_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS "kanban_checklist_user" ON public.kanban_checklist_items;
    DROP POLICY IF EXISTS "kanban_checklist_active" ON public.kanban_checklist_items;
    CREATE POLICY "kanban_checklist_active" ON public.kanban_checklist_items FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.kanban_cards k WHERE k.id = card_id AND k.user_id = public.current_owner()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.kanban_cards k WHERE k.id = card_id AND k.user_id = public.current_owner()));
  END IF;

  IF to_regclass('public.kanban_tasks') IS NOT NULL THEN
    DROP POLICY IF EXISTS "kanban_tasks_user" ON public.kanban_tasks;
    DROP POLICY IF EXISTS "kanban_tasks_active" ON public.kanban_tasks;
    CREATE POLICY "kanban_tasks_active" ON public.kanban_tasks FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.kanban_cards k WHERE k.id = card_id AND k.user_id = public.current_owner()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.kanban_cards k WHERE k.id = card_id AND k.user_id = public.current_owner()));
  END IF;

  IF to_regclass('public.kanban_comments') IS NOT NULL THEN
    DROP POLICY IF EXISTS "kanban_comments_user" ON public.kanban_comments;
    DROP POLICY IF EXISTS "kanban_comments_active" ON public.kanban_comments;
    CREATE POLICY "kanban_comments_active" ON public.kanban_comments FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.kanban_cards k WHERE k.id = card_id AND k.user_id = public.current_owner()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.kanban_cards k WHERE k.id = card_id AND k.user_id = public.current_owner()));
  END IF;

  IF to_regclass('public.kanban_activity_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "kanban_activity_user" ON public.kanban_activity_logs;
    DROP POLICY IF EXISTS "kanban_activity_active" ON public.kanban_activity_logs;
    CREATE POLICY "kanban_activity_active" ON public.kanban_activity_logs FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.kanban_cards k WHERE k.id = card_id AND k.user_id = public.current_owner()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.kanban_cards k WHERE k.id = card_id AND k.user_id = public.current_owner()));
  END IF;

  -- Usinas solares (filhas de usinas_solares)
  IF to_regclass('public.usinas_solares_leituras') IS NOT NULL THEN
    DROP POLICY IF EXISTS "leituras_own" ON public.usinas_solares_leituras;
    DROP POLICY IF EXISTS "leituras_active" ON public.usinas_solares_leituras;
    CREATE POLICY "leituras_active" ON public.usinas_solares_leituras FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.usinas_solares u WHERE u.id = usina_id AND u.user_id = public.current_owner()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.usinas_solares u WHERE u.id = usina_id AND u.user_id = public.current_owner()));
  END IF;

  IF to_regclass('public.usinas_solares_alarmes') IS NOT NULL THEN
    DROP POLICY IF EXISTS "alarmes_own" ON public.usinas_solares_alarmes;
    DROP POLICY IF EXISTS "alarmes_active" ON public.usinas_solares_alarmes;
    CREATE POLICY "alarmes_active" ON public.usinas_solares_alarmes FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.usinas_solares u WHERE u.id = usina_id AND u.user_id = public.current_owner()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.usinas_solares u WHERE u.id = usina_id AND u.user_id = public.current_owner()));
  END IF;
END $$;
