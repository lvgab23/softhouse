-- ============================================================
-- MIGRATION 011 — Kanban Attachments
-- Adiciona tabela de anexos (PDF, imagens, links Google Drive)
-- para os cards do kanban.
-- Execute este arquivo no Supabase SQL Editor.
-- ============================================================

-- ── Criar bucket de storage para anexos ──────────────────────
-- (Executa apenas se o bucket não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kanban-attachments',
  'kanban-attachments',
  false,
  10485760,  -- 10 MB por arquivo
  ARRAY['application/pdf','image/jpeg','image/jpg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ── Policy de storage ─────────────────────────────────────────
DROP POLICY IF EXISTS "kanban_attachments_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "kanban_attachments_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "kanban_attachments_storage_delete" ON storage.objects;

CREATE POLICY "kanban_attachments_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'kanban-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "kanban_attachments_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'kanban-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "kanban_attachments_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'kanban-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ── Tabela kanban_attachments ─────────────────────────────────
CREATE TABLE IF NOT EXISTS kanban_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     UUID NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  type        TEXT NOT NULL CHECK (type IN ('file', 'link')),
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  file_path   TEXT,
  mime_type   TEXT,
  size_bytes  BIGINT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE kanban_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanban_attachments_user" ON kanban_attachments;
CREATE POLICY "kanban_attachments_user" ON kanban_attachments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM kanban_cards WHERE id = card_id AND user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_kanban_attachments_card ON kanban_attachments(card_id);
