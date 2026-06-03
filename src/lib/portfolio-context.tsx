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
  const [portfolios, setPortfolios]   = useState<Portfolio[]>([])
  const [activeOwnerId, setActiveId] = useState('')
  const [loading, setLoading]        = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Portfólio próprio
    const ownPortfolio: Portfolio = {
      owner_id:    user.id,
      owner_name:  user.user_metadata?.nome || user.email?.split('@')[0] || 'Meu portfólio',
      owner_email: user.email || '',
      is_own:      true,
    }

    // Portfólios onde é colaborador ativo
    const { data: collabs } = await (supabase as any)
      .from('colaboradores')
      .select('owner_id, profiles:owner_id(nome, email)')
      .eq('user_id', user.id)
      .eq('status', 'ativo')

    const collabPortfolios: Portfolio[] = (collabs || []).map((c: any) => ({
      owner_id:    c.owner_id,
      owner_name:  c.profiles?.nome || c.profiles?.email?.split('@')[0] || 'Family Office',
      owner_email: c.profiles?.email || '',
      is_own:      false,
    }))

    const all = [ownPortfolio, ...collabPortfolios]
    setPortfolios(all)

    // Restaura seleção salva (ou usa o próprio)
    const saved = localStorage.getItem('active_portfolio')
    const valid = all.find(p => p.owner_id === saved)
    setActiveId(valid ? valid.owner_id : user.id)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function switchPortfolio(ownerId: string) {
    setActiveId(ownerId)
    localStorage.setItem('active_portfolio', ownerId)
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
