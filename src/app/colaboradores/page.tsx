'use client'

import { useEffect, useState, useCallback } from 'react'
import { Users, Plus, Copy, Check, Trash2, Shield, Eye, Edit3, Link2, KeyRound } from 'lucide-react'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const PERMISSOES_CONFIG = [
  { key: 'dashboard',   label: 'Dashboard',      desc: 'Ver dashboards e métricas' },
  { key: 'aportes',     label: 'Aportes',         desc: 'Lançar e visualizar aportes' },
  { key: 'retornos',    label: 'Retornos',        desc: 'Lançar e visualizar retornos' },
  { key: 'lancamentos', label: 'Lançamentos',     desc: 'Lançamentos financeiros gerais' },
  { key: 'patrimonios', label: 'Imóveis',         desc: 'Cadastrar e editar imóveis' },
  { key: 'projetos',    label: 'Projetos',        desc: 'Visualizar projetos' },
  { key: 'empresas',    label: 'Empresas',        desc: 'Visualizar empresas/negócios' },
  { key: 'bens_moveis', label: 'Bens Móveis',     desc: 'Visualizar bens móveis' },
]

const DEFAULT_PERMISSOES: Record<string, boolean> = {
  dashboard: true,
  aportes: true,
  retornos: true,
  lancamentos: false,
  patrimonios: false,
  projetos: true,
  empresas: false,
  bens_moveis: false,
}

const NIVEL_PRESETS: Record<string, Record<string, boolean>> = {
  admin: Object.fromEntries(PERMISSOES_CONFIG.map(p => [p.key, true])),
  editor: { dashboard: true, aportes: true, retornos: true, lancamentos: true, patrimonios: false, projetos: true, empresas: true, bens_moveis: true },
  visualizador: { dashboard: true, aportes: false, retornos: false, lancamentos: false, patrimonios: false, projetos: true, empresas: true, bens_moveis: true },
  personalizado: DEFAULT_PERMISSOES,
}

const nivelConf: Record<string, { label: string; variant: any; icon: any; color: string }> = {
  admin:        { label: 'Admin',        variant: 'danger', icon: Shield, color: '#ef4444' },
  editor:       { label: 'Editor',       variant: 'info',   icon: Edit3,  color: '#3b82f6' },
  visualizador: { label: 'Visualizador', variant: 'gray',   icon: Eye,    color: '#94a3b8' },
  personalizado:{ label: 'Personalizado',variant: 'info',   icon: Shield, color: '#8b5cf6' },
}

const statusConf: Record<string, { label: string; color: string; bg: string }> = {
  pendente: { label: 'Pendente', color: '#f59e0b', bg: '#fffbeb' },
  ativo:    { label: 'Ativo',    color: '#22c55e', bg: '#f0fdf4' },
  inativo:  { label: 'Inativo',  color: '#94a3b8', bg: '#f8fafc' },
}

interface Colaborador {
  id: string
  nome: string | null
  email: string | null
  nivel: string
  status: string
  token_convite: string | null
  permissoes: Record<string, boolean>
  created_at: string
  profiles?: { nome: string | null; email: string | null; avatar_url: string | null }
}

function getDisplayName(c: Colaborador) {
  return c.profiles?.nome || c.nome || c.profiles?.email || c.email || '—'
}
function getDisplayEmail(c: Colaborador) {
  return c.profiles?.email || c.email || '—'
}

export default function ColaboradoresPage() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state
  const [formMode, setFormMode]   = useState<'senha' | 'convite'>('senha')
  const [formNome, setFormNome]   = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formSenha, setFormSenha] = useState('')
  const [formNivel, setFormNivel] = useState('editor')
  const [formPerms, setFormPerms] = useState<Record<string, boolean>>(NIVEL_PRESETS.editor)

  const fetchData = useCallback(async () => {
    // Garante que a migration de colaboradores foi executada
    await fetch('/api/admin/migrate-colaboradores', { method: 'POST' }).catch(() => {})
    const supabase = createClient()
    const { data } = await (supabase as any)
      .from('colaboradores')
      .select('*, profiles:user_id(nome, email, avatar_url)')
      .order('created_at', { ascending: false })
    setColaboradores((data || []).map((c: any) => ({
      ...c,
      permissoes: c.permissoes || DEFAULT_PERMISSOES,
    })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function openModal() {
    setFormMode('senha')
    setFormNome('')
    setFormEmail('')
    setFormSenha('')
    setFormNivel('editor')
    setFormPerms(NIVEL_PRESETS.editor)
    setShowModal(true)
  }

  function handleNivelChange(nivel: string) {
    setFormNivel(nivel)
    if (nivel !== 'personalizado') setFormPerms(NIVEL_PRESETS[nivel] || DEFAULT_PERMISSOES)
  }

  function togglePerm(key: string) {
    const next = { ...formPerms, [key]: !formPerms[key] }
    setFormPerms(next)
    // If doesn't match any preset, switch to personalizado
    const matchedPreset = Object.entries(NIVEL_PRESETS).find(([pKey, pVal]) =>
      pKey !== 'personalizado' && Object.keys(pVal).every(k => pVal[k] === next[k])
    )
    if (matchedPreset) setFormNivel(matchedPreset[0])
    else setFormNivel('personalizado')
  }

  async function handleSave() {
    if (!formEmail.trim()) { toast.error('Informe o e-mail do colaborador'); return }
    if (formMode === 'senha' && formSenha.length < 6) { toast.error('Senha deve ter ao menos 6 caracteres'); return }
    setSaving(true)

    if (formMode === 'senha') {
      const res = await fetch('/api/admin/create-colaborador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formEmail.trim().toLowerCase(),
          password: formSenha,
          nome: formNome.trim() || null,
          nivel: formNivel,
          permissoes: formPerms,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(`Erro ao criar colaborador: ${data.error}`)
        setSaving(false)
        return
      }
      toast.success('Colaborador criado! Compartilhe o e-mail e a senha temporária com ele.')
    } else {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Não autenticado'); setSaving(false); return }

      const payload = {
        owner_id: user.id,
        owner_user_id: user.id,
        nome: formNome.trim() || null,
        email: formEmail.trim().toLowerCase(),
        nivel: formNivel,
        status: 'pendente',
        permissoes: formPerms,
      }
      const { error } = await (supabase as any).from('colaboradores').insert(payload)
      if (error) {
        toast.error(`Erro ao convidar: ${error.message}`)
        setSaving(false)
        return
      }
      toast.success('Colaborador convidado! Copie o link de convite na lista.')
    }

    setSaving(false)
    setShowModal(false)
    fetchData()
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const supabase = createClient()
    const { error } = await (supabase as any).from('colaboradores').delete().eq('id', id)
    if (error) toast.error('Erro ao remover colaborador')
    else { toast.success('Colaborador removido'); fetchData() }
    setDeletingId(null)
  }

  function getInviteLink(token: string) {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    return `${base}/convite?token=${token}`
  }

  async function copyInvite(c: Colaborador) {
    if (!c.token_convite) return
    const link = getInviteLink(c.token_convite)
    try {
      await navigator.clipboard.writeText(link)
      setCopiedId(c.id)
      toast.success('Link copiado!')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  return (
    <AppLayout>
      <Topbar title="Colaboradores" subtitle="Gerencie quem tem acesso ao sistema e o que podem fazer">
        <Button onClick={openModal} size="sm"><Plus className="h-4 w-4" />Convidar Colaborador</Button>
      </Topbar>

      <div className="p-6 space-y-4">
        {/* Stats row */}
        {!loading && colaboradores.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total', value: colaboradores.length, color: '#6366f1' },
              { label: 'Ativos', value: colaboradores.filter(c => c.status === 'ativo').length, color: '#22c55e' },
              { label: 'Pendentes', value: colaboradores.filter(c => c.status === 'pendente').length, color: '#f59e0b' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-black/[0.08] p-4">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />)}</div>
        ) : colaboradores.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum colaborador"
            description="Convide colaboradores para acessar partes específicas do sistema"
            action={{ label: 'Convidar Colaborador', onClick: openModal }}
          />
        ) : (
          <div className="bg-white rounded-xl border border-black/[0.08] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Colaborador</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 hidden md:table-cell">E-mail</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">Nível</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 hidden lg:table-cell">Permissões</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody>
                {colaboradores.map((c, i) => {
                  const nc = nivelConf[c.nivel] || nivelConf.visualizador
                  const sc = statusConf[c.status] || statusConf.pendente
                  const activePerms = Object.entries(c.permissoes).filter(([, v]) => v).map(([k]) =>
                    PERMISSOES_CONFIG.find(p => p.key === k)?.label
                  ).filter(Boolean)

                  return (
                    <tr key={c.id} className={`border-b border-gray-50 hover:bg-gray-50/40 transition-colors ${i === colaboradores.length - 1 ? 'border-b-0' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 flex-shrink-0">
                            {getDisplayName(c).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{getDisplayName(c)}</p>
                            <p className="text-xs text-gray-400 md:hidden">{getDisplayEmail(c)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{getDisplayEmail(c)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
                          style={{ background: nc.color + '18', color: nc.color }}>
                          <nc.icon className="h-3 w-3" />{nc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block px-2 py-1 rounded-full text-xs font-semibold"
                          style={{ background: sc.bg, color: sc.color }}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {activePerms.slice(0, 4).map(p => (
                            <span key={p} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">{p}</span>
                          ))}
                          {activePerms.length > 4 && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]">+{activePerms.length - 4}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {c.status === 'pendente' && c.token_convite && (
                            <button
                              onClick={() => copyInvite(c)}
                              title="Copiar link de convite"
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
                            >
                              {copiedId === c.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(c.id)}
                            disabled={deletingId === c.id}
                            title="Remover colaborador"
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-500 transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Convidar Colaborador"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>
              {formMode === 'senha' ? 'Criar Colaborador' : 'Gerar Convite'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg">
            {([
              { key: 'senha',   icon: KeyRound, label: 'Criar com senha',   desc: 'Você define a senha temporária' },
              { key: 'convite', icon: Link2,    label: 'Link de convite',    desc: 'Colaborador cria a própria conta' },
            ] as const).map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setFormMode(opt.key)}
                className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-md text-xs font-medium transition-all ${
                  formMode === opt.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <opt.icon className="h-4 w-4" />
                {opt.label}
              </button>
            ))}
          </div>

          {/* Name + Email */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Nome (opcional)</label>
              <input
                className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="Nome do colaborador"
                value={formNome}
                onChange={e => setFormNome(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">E-mail <span className="text-red-500">*</span></label>
              <input
                type="email"
                className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="email@exemplo.com"
                value={formEmail}
                onChange={e => setFormEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Senha temporária (modo senha) */}
          {formMode === 'senha' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Senha temporária <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 font-mono"
                placeholder="mínimo 6 caracteres"
                value={formSenha}
                onChange={e => setFormSenha(e.target.value)}
              />
              <p className="text-[10px] text-gray-400">O colaborador será obrigado a trocar no primeiro acesso.</p>
            </div>
          )}

          {/* Nivel presets */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700">Nível de acesso</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(nivelConf).map(([key, conf]) => (
                <button
                  key={key}
                  onClick={() => handleNivelChange(key)}
                  className={`px-3 py-2.5 rounded-lg border text-xs font-medium transition-all flex flex-col items-center gap-1 ${
                    formNivel === key
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <conf.icon className="h-4 w-4" />
                  {conf.label}
                </button>
              ))}
            </div>
          </div>

          {/* Permissions grid */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700">Permissões individuais</label>
            <div className="grid grid-cols-2 gap-2">
              {PERMISSOES_CONFIG.map(p => (
                <label
                  key={p.key}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    formPerms[p.key]
                      ? 'border-blue-200 bg-blue-50/60'
                      : 'border-gray-100 bg-gray-50/40 opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!formPerms[p.key]}
                    onChange={() => togglePerm(p.key)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className={`text-xs font-semibold ${formPerms[p.key] ? 'text-blue-900' : 'text-gray-500'}`}>{p.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{p.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700">
              {formMode === 'senha'
                ? 'A conta será criada agora. Compartilhe o e-mail e a senha temporária com o colaborador — ele será obrigado a trocar a senha no primeiro acesso.'
                : 'Um link de convite será gerado. Copie e envie para o colaborador — ele poderá criar uma conta e acessar apenas o que foi permitido.'}
            </p>
          </div>
        </div>
      </Modal>
    </AppLayout>
  )
}
