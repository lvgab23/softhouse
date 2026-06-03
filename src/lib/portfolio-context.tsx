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

    // Portfólio próprio
    const ownPortfolio: Portfolio = {
      owner_id:    user.id,
      owner_name:  user.user_metadata?.nome || user.email?.split('@')[0] || 'Meu portfólio',
      owner_email: user.email || '',
      is_own:      true,
    }

    // Busca colaborações ativas (sem join — mais robusto)
    const { data: collabs } = await (supabase as any)
      .from('colaboradores')
      .select('owner_id, owner_user_id')
      .eq('user_id', user.id)
      .eq('status', 'ativo')

    const collabPortfolios: Portfolio[] = []

    for (const c of collabs || []) {
      const ownerId = c.owner_id || c.owner_user_id
      if (!ownerId || ownerId === user.id) continue

      // Tenta buscar o perfil do dono
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

      // Evita duplicatas
      if (!collabPortfolios.find(p => p.owner_id === ownerId)) {
        collabPortfolios.push({ owner_id: ownerId, owner_name: ownerName, owner_email: ownerEmail, is_own: false })
      }
    }

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
    // Recarrega para garantir dados frescos
    window.location.reload()
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
