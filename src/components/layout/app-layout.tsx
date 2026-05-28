import { Sidebar } from './sidebar'

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#f8fafc]">
      <Sidebar />
      <main className="flex-1 ml-[210px] flex flex-col min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  )
}
