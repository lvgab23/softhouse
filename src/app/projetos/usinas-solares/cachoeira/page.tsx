'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function CachoeiraRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    const redirect = async () => {
      const sb = createClient() as any
      const { data } = await sb.from('usinas_solares')
        .select('id')
        .ilike('nome', '%cachoeira%')
        .limit(1)
        .single()
      if (data?.id) {
        router.replace(`/projetos/usinas-solares/${data.id}`)
      } else {
        router.replace('/projetos/usinas-solares')
      }
    }
    redirect()
  }, [router])

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        Carregando usina...
      </div>
    </div>
  )
}
