'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Car, Hash, DollarSign, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { MetricCard } from '@/components/ui/metric-card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatBRL, formatShort, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const TIPOS = [
  { value: 'automovel', label: 'Automóvel' },
  { value: 'moto', label: 'Motocicleta' },
  { value: 'caminhao', label: 'Caminhão' },
  { value: 'van', label: 'Van / Utilitário' },
  { value: 'maquinario', label: 'Maquinário' },
  { value: 'equipamento', label: 'Equipamento' },
  { value: 'outro', label: 'Outro' },
]

const COMBUSTIVEIS = [
  { value: 'gasolina', label: 'Gasolina' },
  { value: 'etanol', label: 'Etanol' },
  { value: 'flex', label: 'Flex' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'eletrico', label: 'Elétrico' },
  { value: 'hibrido', label: 'Híbrido' },
  { value: 'gnv', label: 'GNV' },
]

const MARCAS_COMUNS = [
  'Chevrolet', 'Fiat', 'Ford', 'Honda', 'Hyundai', 'Jeep', 'Mitsubishi',
  'Nissan', 'Peugeot', 'Renault', 'Toyota', 'Volkswagen', 'Volvo', 'Outra',
]

const schema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  tipo: z.string().default('automovel'),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  ano: z.coerce.number().min(1900).max(2100).optional(),
  placa: z.string().optional(),
  renavam: z.string().optional(),
  cor: z.string().optional(),
  km_atual: z.coerce.number().min(0).optional(),
  combustivel: z.string().optional(),
  valor_aquisicao: z.coerce.number().min(0).optional(),
  valor_atual: z.coerce.number().min(0).optional(),
  data_aquisicao: z.string().optional(),
  seguro_apolice: z.string().optional(),
  seguro_vencimento: z.string().optional(),
  ipva_vencimento: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  status: z.string().default('ativo'),
  notas: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const statusConfig: Record<string, { label: string; variant: any }> = {
  ativo: { label: 'Ativo', variant: 'success' },
  manutencao: { label: 'Em Manutenção', variant: 'warning' },
  vendido: { label: 'Vendido', variant: 'danger' },
  inativo: { label: 'Inativo', variant: 'gray' },
}

const tipoConfig: Record<string, { label: string }> = Object.fromEntries(TIPOS.map(t => [t.value, { label: t.label }]))

export default function BensMoveiPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tableError, setTableError] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'automovel', status: 'ativo' },
  })

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await (supabase as any).from('bens_moveis').select('*').order('created_at', { ascending: false })
    if (error?.code === '42P01') { setTableError(true); setLoading(false); return }
    setItems(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => {
    setEditing(null)
    reset({ tipo: 'automovel', status: 'ativo' })
    setModalOpen(true)
  }

  const openEdit = (item: any) => {
    setEditing(item)
    reset({
      nome: item.nome, tipo: item.tipo, marca: item.marca || '',
      modelo: item.modelo || '', ano: item.ano || undefined,
      placa: item.placa || '', renavam: item.renavam || '',
      cor: item.cor || '', km_atual: item.km_atual || undefined,
      combustivel: item.combustivel || '', valor_aquisicao: item.valor_aquisicao || undefined,
      valor_atual: item.valor_atual || undefined, data_aquisicao: item.data_aquisicao || '',
      seguro_apolice: item.seguro_apolice || '', seguro_vencimento: item.seguro_vencimento || '',
      ipva_vencimento: item.ipva_vencimento || '', cidade: item.cidade || '',
      estado: item.estado || '', status: item.status, notas: item.notas || '',
    })
    setModalOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const clean = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === '' ? null : v]))
    const { error } = editing
      ? await (supabase as any).from('bens_moveis').update(clean).eq('id', editing.id)
      : await (supabase as any).from('bens_moveis').insert({ ...clean, user_id: user.id })
    if (error) { toast.error('Erro ao salvar. Verifique se a tabela foi criada.'); console.error(error); return }
    toast.success(editing ? 'Bem atualizado!' : 'Bem cadastrado!')
    setModalOpen(false)
    fetchData()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    await (createClient() as any).from('bens_moveis').delete().eq('id', deleteId)
    toast.success('Bem excluído')
    setDeleteId(null)
    setDeleting(false)
    fetchData()
  }

  const ativos = items.filter(i => i.status === 'ativo')
  const totalValor = items.reduce((s, i) => s + (i.valor_atual || i.valor_aquisicao || 0), 0)
  const ipvaAlerta = items.filter(i => i.ipva_vencimento && new Date(i.ipva_vencimento) < new Date(Date.now() + 30 * 86400000)).length

  if (tableError) {
    return (
      <AppLayout>
        <Topbar title="Bens Móveis" subtitle="Cadastro de veículos e equipamentos" />
        <div className="p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 max-w-2xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-800 mb-2">Tabela não encontrada</p>
                <p className="text-sm text-yellow-700 mb-4">Execute o SQL abaixo no <strong>Supabase SQL Editor</strong> para criar a tabela:</p>
                <pre className="bg-yellow-100 rounded-lg p-3 text-xs text-yellow-900 overflow-x-auto whitespace-pre-wrap">
{`CREATE TABLE IF NOT EXISTS bens_moveis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'automovel',
  marca TEXT, modelo TEXT, ano INTEGER,
  placa TEXT, renavam TEXT, cor TEXT,
  km_atual DECIMAL(12,1), combustivel TEXT,
  valor_aquisicao DECIMAL(15,2),
  valor_atual DECIMAL(15,2),
  data_aquisicao DATE,
  seguro_apolice TEXT, seguro_vencimento DATE,
  ipva_vencimento DATE,
  status TEXT DEFAULT 'ativo',
  cidade TEXT, estado TEXT, notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bens_moveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own bens_moveis"
  ON bens_moveis FOR ALL
  USING (auth.uid() = user_id);`}
                </pre>
                <Button className="mt-4" onClick={() => { setTableError(false); setLoading(true); fetchData() }}>
                  Verificar novamente
                </Button>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <Topbar title="Bens Móveis" subtitle="Cadastro de veículos e equipamentos">
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Novo Bem
        </Button>
      </Topbar>

      <div className="p-6 space-y-5">
        {/* Métricas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total de Bens" value={String(items.length)} subtitle="cadastrados" icon={Hash} />
          <MetricCard label="Bens Ativos" value={String(ativos.length)} subtitle="em uso" icon={Car} />
          <MetricCard label="Valor Total" value={formatShort(totalValor)} subtitle="valor atual" icon={DollarSign} />
          <MetricCard label="Alertas IPVA" value={String(ipvaAlerta)} subtitle="vencendo em 30 dias" icon={AlertTriangle} />
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-white rounded-xl animate-pulse" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhum bem cadastrado"
            description="Cadastre veículos, máquinas e equipamentos"
            action={{ label: 'Novo Bem', onClick: openCreate }}
          />
        ) : (
          <div className="bg-white rounded-xl border border-black/[0.08] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Bem</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tipo</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Placa / Ano</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">KM</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">IPVA</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any, i: number) => {
                    const sc = statusConfig[item.status] || statusConfig.ativo
                    const ipvaVencendo = item.ipva_vencimento && new Date(item.ipva_vencimento) < new Date(Date.now() + 30 * 86400000)
                    return (
                      <tr key={item.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i === items.length - 1 ? 'border-b-0' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                              <Car className="h-4 w-4 text-blue-500" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-xs">{item.nome}</p>
                              <p className="text-[10px] text-gray-400">{[item.marca, item.modelo].filter(Boolean).join(' ')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{tipoConfig[item.tipo]?.label || item.tipo}</td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-mono text-gray-700">{item.placa || '—'}</p>
                          <p className="text-[10px] text-gray-400">{item.ano || '—'}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-gray-600">
                          {item.km_atual != null ? `${Number(item.km_atual).toLocaleString('pt-BR')} km` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900 text-xs">
                          {formatBRL(item.valor_atual || item.valor_aquisicao || 0)}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {item.ipva_vencimento
                            ? <span className={ipvaVencendo ? 'text-red-500 font-medium' : 'text-gray-500'}>{formatDate(item.ipva_vencimento)}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        <td className="px-4 py-3"><Badge variant={sc.variant}>{sc.label}</Badge></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setDeleteId(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Cadastro/Edição */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Bem Móvel' : 'Novo Bem Móvel'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>{editing ? 'Salvar' : 'Cadastrar'}</Button>
          </>
        }
      >
        <form className="space-y-4">
          {/* Identificação */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Identificação</p>
            <div className="space-y-3">
              <Input label="Nome / Descrição *" placeholder="Ex: Honda Civic 2020, Trator John Deere..." error={errors.nome?.message} {...register('nome')} />
              <div className="grid grid-cols-2 gap-3">
                <Select label="Tipo" {...register('tipo')}>
                  {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
                <Select label="Status" {...register('status')}>
                  <option value="ativo">Ativo</option>
                  <option value="manutencao">Em Manutenção</option>
                  <option value="inativo">Inativo</option>
                  <option value="vendido">Vendido</option>
                </Select>
              </div>
            </div>
          </div>

          {/* Dados do Veículo */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Dados do Veículo</p>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Select label="Marca" {...register('marca')}>
                  <option value="">Selecione...</option>
                  {MARCAS_COMUNS.map(m => <option key={m} value={m}>{m}</option>)}
                </Select>
                <Input label="Modelo" placeholder="Ex: Civic EXL" {...register('modelo')} />
                <Input label="Ano" type="number" placeholder="2024" {...register('ano')} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Placa" placeholder="ABC-1234" {...register('placa')} />
                <Input label="Renavam" placeholder="00000000000" {...register('renavam')} />
                <Input label="Cor" placeholder="Prata, Branco..." {...register('cor')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="KM Atual" type="number" placeholder="0" {...register('km_atual')} />
                <Select label="Combustível" {...register('combustivel')}>
                  <option value="">Selecione...</option>
                  {COMBUSTIVEIS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Select>
              </div>
            </div>
          </div>

          {/* Valores */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Valores</p>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Valor de Aquisição (R$)" type="number" step="0.01" {...register('valor_aquisicao')} />
              <Input label="Valor Atual de Mercado (R$)" type="number" step="0.01" {...register('valor_atual')} />
              <Input label="Data de Aquisição" type="date" {...register('data_aquisicao')} />
            </div>
          </div>

          {/* Documentação */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Documentação e Seguros</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Nº Apólice Seguro" placeholder="Ex: 12345-6" {...register('seguro_apolice')} />
                <Input label="Vencimento Seguro" type="date" {...register('seguro_vencimento')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Vencimento IPVA" type="date" {...register('ipva_vencimento')} />
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Cidade" {...register('cidade')} />
                  <Input label="Estado" placeholder="GO" maxLength={2} {...register('estado')} />
                </div>
              </div>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              rows={2}
              placeholder="Informações adicionais..."
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 resize-none"
              {...register('notas')}
            />
          </div>
        </form>
      </Modal>

      {/* Modal Excluir */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Excluir Bem" size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>Excluir</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">Deseja excluir este bem? Esta ação não pode ser desfeita.</p>
      </Modal>
    </AppLayout>
  )
}
