'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Search, CheckCircle2, XCircle, Loader2, Info } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Step = { label: string; status: 'pending' | 'running' | 'done' | 'error' | 'skip'; detail?: string }

function formatDoc(value: string, tipo: 'CPF' | 'CNPJ') {
  const d = value.replace(/\D/g, '')
  if (tipo === 'CNPJ') {
    return d
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 18)
  }
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
    .slice(0, 14)
}

const STEP_ICONS: Record<Step['status'], React.ReactNode> = {
  pending: <div className="w-4 h-4 rounded-full border-2 border-gray-300" />,
  running: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  done: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  error: <XCircle className="h-4 w-4 text-red-400" />,
  skip: <div className="w-4 h-4 rounded-full border-2 border-gray-200 bg-gray-100" />,
}

export default function ConsultaPage() {
  const router = useRouter()
  const [tipo, setTipo] = useState<'CPF' | 'CNPJ'>('CNPJ')
  const [documento, setDocumento] = useState('')
  const [nome, setNome] = useState('')
  const [processosText, setProcessosText] = useState('')
  const [loading, setLoading] = useState(false)
  const [steps, setSteps] = useState<Step[]>([])

  const updateStep = (index: number, update: Partial<Step>) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, ...update } : s))
  }

  const handleAnalise = async () => {
    const clean = documento.replace(/\D/g, '')
    const minLen = tipo === 'CNPJ' ? 14 : 11
    if (clean.length < minLen) {
      toast.error(`${tipo} inválido — verifique o número digitado`)
      return
    }

    const processos = processosText
      .split(/[\n,;]+/)
      .map(p => p.trim())
      .filter(p => p.replace(/\D/g, '').length === 20)

    const initialSteps: Step[] = [
      { label: tipo === 'CNPJ' ? 'Receita Federal — situação cadastral e QSA' : 'Validação do documento', status: tipo === 'CNPJ' ? 'pending' : 'skip' },
      { label: 'Portal Transparência — CEIS / CNEP / PEP / PGFN (sanções)', status: 'pending' },
      { label: 'Banco Central — PAS e dívida ativa', status: 'pending' },
      { label: 'Tribunais estaduais — SAJ (16 TJs incluindo TJSP)', status: 'pending' },
      { label: 'TJMG / TJRJ / TJRS e demais TJs', status: 'pending' },
      { label: 'STJ / STF / TST / TRF1-6 / TRT1-24', status: 'pending' },
      { label: processos.length > 0 ? `DataJud — ${processos.length} processo(s) por número` : 'DataJud — sem números informados', status: processos.length > 0 ? 'pending' : 'skip' },
      { label: 'Calculando score de risco', status: 'pending' },
    ]
    setSteps(initialSteps)
    setLoading(true)

    setTimeout(() => updateStep(0, { status: 'running' }), 200)
    setTimeout(() => updateStep(1, { status: 'running' }), 400)
    setTimeout(() => updateStep(2, { status: 'running' }), 600)
    setTimeout(() => updateStep(3, { status: 'running' }), 800)
    setTimeout(() => updateStep(4, { status: 'running' }), 1000)
    setTimeout(() => updateStep(5, { status: 'running' }), 1200)
    setTimeout(() => updateStep(6, { status: processos.length > 0 ? 'running' : 'skip' }), 1400)

    try {
      const res = await fetch('/api/compliance/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento: clean, tipo, processos, nome: nome.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error' } : s))
        toast.error(data.error || 'Erro ao realizar análise')
        setLoading(false)
        return
      }

      setSteps(prev => prev.map(s => ({
        ...s,
        status: s.status === 'skip' ? 'skip' : 'done',
      })))
      updateStep(7, { status: 'done' })

      await new Promise(r => setTimeout(r, 600))
      router.push(`/compliance/resultado/${data.id}`)
    } catch {
      setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error' } : s))
      toast.error('Erro de conexão — tente novamente')
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <Topbar title="Nova Consulta" subtitle="Análise de risco — CPF ou CNPJ" />

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Form card */}
        <div className="bg-white rounded-xl border border-black/[0.07] p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Análise de Compliance</h2>
              <p className="text-xs text-gray-500">Verificação em múltiplas bases públicas</p>
            </div>
          </div>

          {/* Tipo selector */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Tipo de documento</label>
            <div className="flex gap-2">
              {(['CNPJ', 'CPF'] as const).map(t => (
                <button
                  key={t}
                  disabled={loading}
                  onClick={() => { setTipo(t); setDocumento('') }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                    tipo === t
                      ? 'bg-[#0f172a] text-white border-[#0f172a]'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <Input
            label={tipo === 'CNPJ' ? 'CNPJ da empresa' : 'CPF da pessoa física'}
            placeholder={tipo === 'CNPJ' ? '00.000.000/0000-00' : '000.000.000-00'}
            value={documento}
            onChange={e => setDocumento(formatDoc(e.target.value, tipo))}
            disabled={loading}
          />

          <div className="mt-4">
            <Input
              label={tipo === 'CNPJ' ? 'Razão social (opcional — melhora busca nos tribunais)' : 'Nome completo (opcional — necessário para busca em tribunais)'}
              placeholder={tipo === 'CNPJ' ? 'Ex: Empresa Ltda' : 'Ex: João da Silva'}
              value={nome}
              onChange={e => setNome(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Números de Processos — DataJud/CNJ <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              rows={3}
              disabled={loading}
              value={processosText}
              onChange={e => setProcessosText(e.target.value)}
              placeholder={'Ex: 1234567-89.2023.8.26.0001\n0987654-32.2022.5.02.0001'}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-300 disabled:opacity-50 disabled:bg-gray-50"
            />
            <p className="text-[11px] text-gray-400 mt-1">Um por linha ou separados por vírgula — formato CNJ (20 dígitos)</p>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg flex gap-2">
            <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Consulta: Receita Federal, Portal Transparência (CGU/CEIS/CNEP/PEP/PGFN), Banco Central (PAS) e DataJud (processos por número).
              Pode levar até 30 segundos.
            </p>
          </div>

          <Button
            className="w-full mt-5"
            onClick={handleAnalise}
            loading={loading}
            disabled={!documento || loading}
          >
            {loading ? 'Analisando...' : (
              <><Search className="h-4 w-4" /> Iniciar Análise de Compliance</>
            )}
          </Button>
        </div>

        {/* Progress steps */}
        {steps.length > 0 && (
          <div className="bg-white rounded-xl border border-black/[0.07] p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Progresso da Análise</h3>
            <div className="space-y-3">
              {steps.map((step, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  step.status === 'running' ? 'bg-blue-50' :
                  step.status === 'done' ? 'bg-green-50' :
                  step.status === 'error' ? 'bg-red-50' :
                  step.status === 'skip' ? 'bg-gray-50 opacity-50' : 'bg-gray-50'
                }`}>
                  {STEP_ICONS[step.status]}
                  <span className={`text-sm ${
                    step.status === 'running' ? 'text-blue-700 font-medium' :
                    step.status === 'done' ? 'text-green-700 font-medium' :
                    step.status === 'error' ? 'text-red-600' :
                    'text-gray-500'
                  }`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
