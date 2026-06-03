import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { PortfolioProvider } from '@/lib/portfolio-context'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SoftHouse — Gestão Patrimonial',
  description: 'Plataforma SaaS para controle de imóveis, investimentos e patrimônios.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      </head>
      <body className={`${inter.className} antialiased bg-[#f8fafc]`}>
        <PortfolioProvider>
          {children}
        </PortfolioProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
