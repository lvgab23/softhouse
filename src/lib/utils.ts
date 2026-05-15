import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

export const formatShort = (value: number) => {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}K`
  return formatBRL(value)
}

export const formatDate = (date: string | null | undefined) => {
  if (!date) return '—'
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('pt-BR')
}

export const formatDateISO = (date: Date) =>
  date.toISOString().split('T')[0]

export async function buscaCEP(cep: string) {
  const cleaned = cep.replace(/\D/g, '')
  if (cleaned.length !== 8) return null
  const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`)
  const data = await res.json()
  if (data.erro) return null
  return data
}

export async function buscaCNPJ(cnpj: string) {
  const cleaned = cnpj.replace(/\D/g, '')
  const res = await fetch(`https://receitaws.com.br/v1/cnpj/${cleaned}`)
  return res.json()
}
