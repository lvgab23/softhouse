'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { KanbanFullBoard } from '@/components/kanban/KanbanFullBoard'

export default function NegociosKanbanPage() {
  return (
    <AppLayout>
      <Topbar title="Kanban de Negócios" subtitle="Pipeline completo de operações, parcerias e investimentos empresariais" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <KanbanFullBoard boardType="negocios" title="Kanban de Negócios" subtitle="Pipeline de operações empresariais" />
      </div>
    </AppLayout>
  )
}
