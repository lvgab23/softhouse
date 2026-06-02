'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { KanbanFullBoard } from '@/components/kanban/KanbanFullBoard'

export default function KanbanAdmPage() {
  return (
    <AppLayout>
      <Topbar
        title="Gestão ADM"
        subtitle="Kanban administrativo independente"
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <KanbanFullBoard
          boardType="adm"
          title="Gestão ADM"
          subtitle="Kanban administrativo independente"
        />
      </div>
    </AppLayout>
  )
}
