'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Users, CheckCircle, XCircle, Loader2, Shield, Edit3, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

const PERMISSOES_LABELS: Record<string, string> = {
  dashboard:   'Dashboard',
  aportes:     'Aportes',
  retornos:    'Retornos',
  lancamentos: 'Lançamentos',
  patrimonios: 'Imóveis',
  projetos:    'Projetos',
  empresas:    'Empresas',
  bens_moveis: 'Bens Móveis',
}

const nivelConf: Record<string, { label: string; icon: any; color: string }> = {
  admin:        { label: 'Admin',        icon: Shield, color: '#ef4444' },
  editor:       { label: 'Editor',       icon: Edit3,  color: '#3b82f6' },
  visualizador: { label: 'Visualizador', icon: Eye,    color: '#94a3b8' },
  personalizado:{ label: 'Personalizado',icon: Shield, color: '#8b5cf6' },
}

function ConviteContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [state, setState] = useState<'loading' | 'found' | 'invalid' | 'accepted' | 'error'>('loading')
  const [convite, setConvite] = useState<any>(null)
  const [accepting, setAccepting] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    if (!token) { setState('invalid'); return }

    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      const { data, error } = await (supabase as any)
        .from('colaboradores')
        .select('*')
        .eq('token_convite', token)
        .single()

      if (error || !data) { setState('invalid'); return }
      if (data.status === 'ativo') { setState('accepted'); setConvite(data); return }
      setConvite(data)
      setState('found')
    }
    load()
  }, [token])

  async function handleAccept() {
    if (!currentUser) {
      // Redirect to login with return URL
      router.push(`/login?redirect=/convite?token=${token}`)
      return
    }
    setAccepting(true)
    const supabase = createClient()
    const { error } = await (supabase as any)
      .from('colaboradores')
      .update({ status: 'ativo', user_id: currentUser.id })
      .eq('token_convite', token)

    if (error) { setState('error'); setAccepting(false); return }
    setState('accepted')
    setAccepting(false)
  }

  const permissoes = convite?.permissoes || {}
  const activePerms = Object.entries(permissoes).filter(([, v]) => v).map(([k]) => PERMISSOES_LABELS[k] || k)
  const nc = nivelConf[convite?.nivel] || nivelConf.visualizador

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-3">
            <Users className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Family Office</h1>
          <p className="text-slate-400 text-sm mt-1">Convite de colaboração</p>
        </div>

        <div className="px-6 py-8">
          {state === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              <p className="text-sm text-gray-500">Verificando convite...</p>
            </div>
          )}

          {state === 'invalid' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <XCircle className="h-12 w-12 text-red-400" />
              <h2 className="font-semibold text-gray-900">Convite inválido</h2>
              <p className="text-sm text-gray-500">Este link de convite não é válido ou já expirou.</p>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <XCircle className="h-12 w-12 text-red-400" />
              <h2 className="font-semibold text-gray-900">Erro ao aceitar</h2>
              <p className="text-sm text-gray-500">Ocorreu um erro. Tente novamente ou entre em contato com o administrador.</p>
            </div>
          )}

          {state === 'accepted' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-400" />
              <h2 className="font-semibold text-gray-900">Acesso ativo!</h2>
              <p className="text-sm text-gray-500">Seu acesso ao sistema já está ativo.</p>
              <Button onClick={() => router.push('/')} className="mt-2">Acessar sistema</Button>
            </div>
          )}

          {state === 'found' && convite && (
            <div className="space-y-5">
              <div className="text-center">
                <h2 className="font-semibold text-gray-900 text-lg">Você foi convidado!</h2>
                {convite.email && (
                  <p className="text-sm text-gray-500 mt-1">Para: <span className="font-medium text-gray-700">{convite.email}</span></p>
                )}
              </div>

              {/* Nivel */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: nc.color + '20' }}>
                  <nc.icon className="h-5 w-5" style={{ color: nc.color }} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Nível de acesso</p>
                  <p className="font-semibold text-gray-900">{nc.label}</p>
                </div>
              </div>

              {/* Permissions */}
              {activePerms.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">O que você poderá acessar:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {activePerms.map(p => (
                      <span key={p} className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-xs font-medium">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              {currentUser ? (
                <Button onClick={handleAccept} loading={accepting} className="w-full">
                  Aceitar convite
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-center text-gray-400">Você precisa estar logado para aceitar o convite</p>
                  <Button onClick={handleAccept} className="w-full">
                    Fazer login e aceitar
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ConvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    }>
      <ConviteContent />
    </Suspense>
  )
}
