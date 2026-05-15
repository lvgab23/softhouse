'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Copy, ExternalLink, AlertTriangle, Database } from 'lucide-react'

const SQL = `-- Executar UMA VEZ no Supabase SQL Editor
-- https://supabase.com/dashboard/project/pltrjmfcsyeqxrgxvdmz/sql/new

CREATE TABLE IF NOT EXISTS usinas_solares_leituras (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  usina_id uuid NOT NULL REFERENCES usinas_solares(id) ON DELETE CASCADE,
  data date NOT NULL,
  kwh numeric(10,3) NOT NULL DEFAULT 0,
  potencia_pico_kw numeric(10,3),
  eficiencia numeric(6,2),
  source text DEFAULT 'api',
  created_at timestamptz DEFAULT now(),
  UNIQUE(usina_id, data)
);

CREATE INDEX IF NOT EXISTS idx_leituras_usina_data
  ON usinas_solares_leituras(usina_id, data DESC);

ALTER TABLE usinas_solares_leituras ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS leituras_own ON usinas_solares_leituras
  USING (usina_id IN (
    SELECT id FROM usinas_solares WHERE user_id = auth.uid()
  ));

CREATE TABLE IF NOT EXISTS usinas_solares_alarmes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  usina_id uuid NOT NULL REFERENCES usinas_solares(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  severidade text NOT NULL DEFAULT 'warning',
  descricao text,
  ativo boolean DEFAULT true,
  notificado boolean DEFAULT false,
  notificado_em timestamptz,
  created_at timestamptz DEFAULT now(),
  resolvido_em timestamptz
);

CREATE INDEX IF NOT EXISTS idx_alarmes_usina_ativo
  ON usinas_solares_alarmes(usina_id, ativo);

ALTER TABLE usinas_solares_alarmes ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS alarmes_own ON usinas_solares_alarmes
  USING (usina_id IN (
    SELECT id FROM usinas_solares WHERE user_id = auth.uid()
  ));

ALTER TABLE usinas_solares
  ADD COLUMN IF NOT EXISTS email_alerta text,
  ADD COLUMN IF NOT EXISTS whatsapp_numero text,
  ADD COLUMN IF NOT EXISTS alertas_ativo boolean DEFAULT true;`

export default function SetupPage() {
  const [copied, setCopied] = useState(false)
  const [tablesOk, setTablesOk] = useState<boolean | null>(null)

  useEffect(() => {
    // Verifica se tabelas já existem
    const check = async () => {
      try {
        const res = await fetch('/api/elekeeper?action=alarmes&usinaId=00000000-0000-0000-0000-000000000000')
        const data = await res.json()
        setTablesOk(!data.error || !data.error?.includes('does not exist'))
      } catch { setTablesOk(false) }
    }
    check()
  }, [])

  const copy = () => {
    navigator.clipboard.writeText(SQL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-12 px-4">
      <div className="w-full max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Database className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Setup — Migração do Banco de Dados</h1>
            <p className="text-sm text-gray-500">Execute o SQL abaixo uma vez para ativar histórico e alarmes.</p>
          </div>
        </div>

        {/* Status */}
        {tablesOk === true && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <p className="text-sm text-green-700 font-medium">Tabelas já existem. Migração concluída!</p>
          </div>
        )}
        {tablesOk === false && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <p className="text-sm text-amber-700 font-medium">Tabelas ainda não criadas. Execute o SQL abaixo.</p>
          </div>
        )}

        {/* Passos */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Como executar:</h2>
          <ol className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">1</span>
              Clique em <strong>Copiar SQL</strong> abaixo
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">2</span>
              <span>Abra o Supabase SQL Editor:
                <a href="https://supabase.com/dashboard/project/pltrjmfcsyeqxrgxvdmz/sql/new"
                  target="_blank" rel="noopener noreferrer"
                  className="ml-1 inline-flex items-center gap-1 text-blue-600 hover:underline font-medium">
                  Abrir SQL Editor <ExternalLink className="h-3 w-3" />
                </a>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">3</span>
              Cole o SQL e clique em <strong>Run</strong>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">4</span>
              Volte aqui e recarregue para confirmar
            </li>
          </ol>
        </div>

        {/* SQL */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-500 font-mono">010_usinas_leituras_alarmes.sql</span>
            <button onClick={copy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors">
              {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copiado!' : 'Copiar SQL'}
            </button>
          </div>
          <pre className="p-4 text-xs text-gray-700 overflow-x-auto bg-gray-50/50 leading-relaxed">{SQL}</pre>
        </div>

        <div className="text-center">
          <a href="/projetos/usinas-solares" className="text-sm text-blue-600 hover:underline">
            ← Voltar para Usinas Solares
          </a>
        </div>
      </div>
    </div>
  )
}
