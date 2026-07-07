-- 015_kanban_bucket.sql
-- Cria o cofre (bucket) PRIVADO dos anexos do Kanban e as regras de upload.
-- A LEITURA dos arquivos é feita pela "portaria" /api/kanban/anexo/[id] (service role),
-- que confere o acesso ao portfólio antes de entregar. NÃO apaga dados.

-- Cofre privado
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kanban-attachments', 'kanban-attachments', false, 10485760,
  ARRAY['application/pdf','image/jpeg','image/jpg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Regras: cada usuário envia/apaga arquivos na própria pasta (auth.uid/cardId/...).
-- A leitura NÃO é liberada aqui de propósito — vai pela portaria (service role).
DROP POLICY IF EXISTS "kanban_attachments_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "kanban_attachments_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "kanban_attachments_storage_delete" ON storage.objects;

CREATE POLICY "kanban_attachments_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kanban-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "kanban_attachments_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'kanban-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
