'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building, Shield, TrendingUp, BarChart3, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    const supabase = createClient()
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        })
        if (error) throw error
        router.push('/dashboard')
        router.refresh()
      } else {
        const { error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
        })
        if (error) throw error
        toast.success('Conta criada! Verifique seu e-mail para confirmar o cadastro.')
        setMode('login')
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0f172a] relative flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0c1a2e]" />
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80)', backgroundSize: 'cover', backgroundPosition: 'center' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center">
              <Building className="h-5 w-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl">SoftHouse</span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <div>
            <h2 className="text-4xl font-bold text-white leading-tight">
              Gestão Patrimonial<br />Inteligente
            </h2>
            <p className="mt-3 text-[#94a3b8] text-base leading-relaxed">
              Controle completo do seu patrimônio, imóveis e investimentos em uma plataforma unificada.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Shield, label: 'Seguro & Privado' },
              { icon: TrendingUp, label: 'ROI em Tempo Real' },
              { icon: BarChart3, label: 'Relatórios Avançados' },
              { icon: Globe, label: 'Acesso em Qualquer Lugar' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                <Icon className="h-4 w-4 text-blue-400 flex-shrink-0" />
                <span className="text-[#94a3b8] text-xs">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-[#475569] text-xs italic">
            "Tome decisões estratégicas com dados precisos sobre seus patrimônios."
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm space-y-7">
          <div className="text-center">
            <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
              <div className="w-8 h-8 bg-[#0f172a] rounded-xl flex items-center justify-center">
                <Building className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-lg text-gray-900">SoftHouse</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {mode === 'login' ? 'Bem-vindo de volta' : 'Criar conta'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {mode === 'login' ? 'Entre na sua conta para continuar' : 'Preencha os dados para criar sua conta'}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="E-mail"
              type="email"
              placeholder="seu@email.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Senha"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
            <Button type="submit" className="w-full" loading={loading} size="lg">
              {mode === 'login' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500">
            {mode === 'login' ? (
              <>
                Não tem uma conta?{' '}
                <button onClick={() => setMode('signup')} className="font-medium text-[#0f172a] hover:underline">
                  Cadastre-se
                </button>
              </>
            ) : (
              <>
                Já tem uma conta?{' '}
                <button onClick={() => setMode('login')} className="font-medium text-[#0f172a] hover:underline">
                  Entrar
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
