-- 014_multitenant_rls_filhas.sql
-- Completa a migração 013: tabelas-filhas que herdam o dono do "pai" e ainda usavam
-- auth.uid(). Passam a escopar pelo portfólio ativo (current_owner). NÃO apaga dados.

DO $$
BEGIN
  -- Resultados dos Diários Oficiais (pai: diarios_monitorados)
  IF to_regclass('public.diarios_resultados') IS NOT NULL THEN
    DROP POLICY IF EXISTS "users own diarios_resultados" ON public.diarios_resultados;
    DROP POLICY IF EXISTS "diarios_resultados_active" ON public.diarios_resultados;
    CREATE POLICY "diarios_resultados_active" ON public.diarios_resultados FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.diarios_monitorados m WHERE m.id = monitorado_id AND m.user_id = public.current_owner()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.diarios_monitorados m WHERE m.id = monitorado_id AND m.user_id = public.current_owner()));
  END IF;

  -- Gerações das usinas solares (pai: usinas_solares)
  IF to_regclass('public.solar_geracoes') IS NOT NULL THEN
    DROP POLICY IF EXISTS "solar_geracoes_user" ON public.solar_geracoes;
    DROP POLICY IF EXISTS "solar_geracoes_active" ON public.solar_geracoes;
    CREATE POLICY "solar_geracoes_active" ON public.solar_geracoes FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.usinas_solares u WHERE u.id = usina_id AND u.user_id = public.current_owner()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.usinas_solares u WHERE u.id = usina_id AND u.user_id = public.current_owner()));
  END IF;

  -- Anexos do Kanban (pai: kanban_cards)
  IF to_regclass('public.kanban_attachments') IS NOT NULL THEN
    DROP POLICY IF EXISTS "kanban_attachments_user" ON public.kanban_attachments;
    DROP POLICY IF EXISTS "kanban_attachments_active" ON public.kanban_attachments;
    CREATE POLICY "kanban_attachments_active" ON public.kanban_attachments FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.kanban_cards k WHERE k.id = card_id AND k.user_id = public.current_owner()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.kanban_cards k WHERE k.id = card_id AND k.user_id = public.current_owner()));
  END IF;
END $$;
