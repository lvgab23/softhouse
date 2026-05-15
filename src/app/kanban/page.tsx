'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { KanbanFullBoard } from '@/components/kanban/KanbanFullBoard'

export default function KanbanPage() {
  return (
    <AppLayout>
      <Topbar
        title="Pipeline de Oportunidades"
        subtitle="Gerencie oportunidades: primeira reunião → análise → compliance → fechamento → conversão"
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <KanbanFullBoard
          boardType="pipeline"
          title="Pipeline de Oportunidades"
          subtitle="Gerencie oportunidades antes de criar projetos, bens ou negócios"
        />
      </div>
    </AppLayout>
  )
}
