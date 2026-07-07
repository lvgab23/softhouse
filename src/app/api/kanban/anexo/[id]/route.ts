import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// "Portaria" dos anexos do Kanban (modelo Trello):
// link fixo, mas o acesso é conferido a cada abertura. Só quem está logado e
// tem acesso ao portfólio do card (RLS de kanban_attachments) consegue abrir.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth()
  if (error) return error

  // Cliente com a sessão do usuário: a RLS de kanban_attachments (por portfólio ativo)
  // só devolve a linha se o usuário for membro do portfólio dono do card.
  const supabase = await createClient()
  const { data: att, error: dbErr } = await (supabase as any)
    .from('kanban_attachments')
    .select('*')
    .eq('id', params.id)
    .single()

  if (dbErr || !att) {
    return NextResponse.json({ error: 'Sem acesso a este anexo.' }, { status: 403 })
  }

  // Links externos (Google Drive etc.) — apenas redireciona
  if (att.type === 'link' || !att.file_path) {
    return NextResponse.redirect(att.url)
  }

  // Arquivo no cofre privado — baixa via service role e entrega em streaming
  const admin = createAdminClient()
  const { data: blob, error: dlErr } = await admin.storage
    .from('kanban-attachments')
    .download(att.file_path)

  if (dlErr || !blob) {
    return NextResponse.json({ error: 'Arquivo não encontrado no armazenamento.' }, { status: 404 })
  }

  const arrayBuffer = await blob.arrayBuffer()
  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': att.mime_type || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(att.name)}"`,
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  })
}
