'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { KanbanFullBoard } from '@/components/kanban/KanbanFullBoard'

export default function BensKanbanPage() {
  return (
    <AppLayout>
      <Topbar title="Kanban de Bens" subtitle="Gestão completa de ativos patrimoniais — imóveis, veículos, usinas e mais" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <KanbanFullBoard boardType="bens" title="Kanban de Bens" subtitle="Pipeline patrimonial" />
      </div>
    </AppLayout>
  )
}
