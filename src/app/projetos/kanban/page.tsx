'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { KanbanFullBoard } from '@/components/kanban/KanbanFullBoard'

export default function ProjetosKanbanPage() {
  return (
    <AppLayout>
      <Topbar title="Kanban de Projetos" subtitle="Gestão visual de projetos, tarefas e iniciativas" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <KanbanFullBoard boardType="projetos" title="Kanban de Projetos" subtitle="Pipeline dos projetos por fase" />
      </div>
    </AppLayout>
  )
}
