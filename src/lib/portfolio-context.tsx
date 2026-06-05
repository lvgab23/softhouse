'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Portfolio {
  owner_id: string
  owner_name: string
  owner_email: string
  is_own: boolean
}

interface PortfolioContextType {
  activeOwnerId: string
  activePortfolio: Portfolio | null
  portfolios: Portfolio[]
  isOwnAccount: boolean
  switchPortfolio: (ownerId: string) => void
  loading: boolean
}

const PortfolioContext = createContext<PortfolioContextType>({
  activeOwnerId: '',
  activePortfolio: null,
  portfolios: [],
  isOwnAccount: true,
  switchPortfolio: () => {},
  loading: true,
})

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [portfolios, setPortfolios]  = useState<Portfolio[]>([])
  const [activeOwnerId, setActiveId] = useState('')
  const [loading, setLoading]        = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // ── Portfólio próprio
    const ownPortfolio: Portfolio = {
      owner_id:    user.id,
      owner_name:  user.user_metadata?.nome || user.email?.split('@')[0] || 'Meu portfólio',
      owner_email: user.email || '',
      is_own:      true,
    }

    // Começa com o próprio portfólio (refinado abaixo após ler o portfólio ativo do banco)
    setActiveId(user.id)

    // ── Busca colaborações ativas
    const { data: collabs } = await (supabase as any)
      .from('colaboradores')
      .select('owner_id, owner_user_id')
      .eq('user_id', user.id)
      .eq('status', 'ativo')

    const collabPortfolios: Portfolio[] = []

    for (const c of collabs || []) {
      const ownerId = c.owner_id || c.owner_user_id
      if (!ownerId || ownerId === user.id) continue

      let ownerName  = 'Family Office'
      let ownerEmail = ''

      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('nome, email')
        .eq('id', ownerId)
        .maybeSingle()

      if (profile) {
        ownerName  = profile.nome || profile.email?.split('@')[0] || 'Family Office'
        ownerEmail = profile.email || ''
      }

      if (!collabPortfolios.find(p => p.owner_id === ownerId)) {
        collabPortfolios.push({
          owner_id:    ownerId,
          owner_name:  ownerName,
          owner_email: ownerEmail,
          is_own:      false,
        })
      }
    }

    const all = [ownPortfolio, ...collabPortfolios]
    setPortfolios(all)

    // ── Portfólio ativo é a fonte da verdade no banco (a trava RLS usa o mesmo valor)
    const { data: act } = await (supabase as any)
      .from('user_active_portfolio')
      .select('active_owner_id')
      .eq('user_id', user.id)
      .maybeSingle()

    const desired = act?.active_owner_id || user.id
    const valid = all.find(p => p.owner_id === desired) ? desired : user.id
    setActiveId(valid)
    if (typeof window !== 'undefined') localStorage.setItem('active_portfolio', valid)

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function switchPortfolio(ownerId: string) {
    // Grava o portfólio ativo no banco (a trava RLS passa a filtrar por ele).
    // Só recarrega se o banco confirmar — assim leitura e gravação ficam sempre no mesmo portfólio.
    const supabase = createClient()
    const { error } = await (supabase as any).rpc('set_active_portfolio', { target: ownerId })
    if (error) {
      console.error('Erro ao trocar portfólio:', error.message)
      return
    }
    setActiveId(ownerId)
    if (typeof window !== 'undefined') {
      localStorage.setItem('active_portfolio', ownerId)
      window.location.reload()
    }
  }

  const activePortfolio = portfolios.find(p => p.owner_id === activeOwnerId) ?? null
  const isOwnAccount    = activePortfolio?.is_own ?? true

  return (
    <PortfolioContext.Provider value={{ activeOwnerId, activePortfolio, portfolios, isOwnAccount, switchPortfolio, loading }}>
      {children}
    </PortfolioContext.Provider>
  )
}

export function usePortfolio() {
  return useContext(PortfolioContext)
}
