'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

export default function PrimeiroAcessoPage() {
  const router = useRouter()
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [showConf, setShowConf]     = useState(false)
  const [loading, setLoading]       = useState(false)

  const rules = [
    { label: 'Mínimo 8 caracteres',         ok: password.length >= 8 },
    { label: 'Letra maiúscula',              ok: /[A-Z]/.test(password) },
    { label: 'Número',                       ok: /[0-9]/.test(password) },
    { label: 'Senhas conferem',              ok: password === confirm && confirm.length > 0 },
  ]
  const allOk = rules.every(r => r.ok)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allOk) return
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      password,
      data: { primeiro_acesso: false },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    toast.success('Senha definida com sucesso!')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0a0f1e] mb-4">
            <KeyRound className="h-7 w-7 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Defina sua senha</h1>
          <p className="mt-2 text-sm text-gray-500">
            É seu primeiro acesso. Crie uma senha pessoal para continuar.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nova senha */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Nova senha</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 px-3 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirmar senha */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Confirmar senha</label>
              <div className="relative">
                <input
                  type={showConf ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 px-3 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setShowConf(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Regras */}
            {password.length > 0 && (
              <ul className="space-y-1.5 p-3 bg-gray-50 rounded-lg">
                {rules.map(r => (
                  <li key={r.label} className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className={`h-3.5 w-3.5 flex-shrink-0 ${r.ok ? 'text-green-500' : 'text-gray-300'}`} />
                    <span className={r.ok ? 'text-gray-700' : 'text-gray-400'}>{r.label}</span>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="submit"
              disabled={!allOk || loading}
              className="w-full h-10 bg-[#0a0f1e] text-white text-sm font-semibold rounded-lg hover:bg-[#1e293b] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Salvando...' : 'Definir senha e entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
