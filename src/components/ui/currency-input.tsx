'use client'

import { forwardRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  label?: string
  error?: string
  value?: number | string | null
  onChange?: (value: number | null) => void
}

function fmt(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return ''
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'))
  if (isNaN(n)) return ''
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parse(val: string): number | null {
  const cleaned = val.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ label, error, value, onChange, placeholder = '0,00', className, id, onBlur, ...props }, ref) => {
    const [focused, setFocused] = useState(false)
    const [raw, setRaw] = useState(() => fmt(value))

    useEffect(() => {
      if (!focused) setRaw(fmt(value))
    }, [value, focused])

    function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
      setFocused(true)
      const n = parse(raw)
      setRaw(n !== null ? String(n) : '')
      e.target.select()
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const v = e.target.value.replace(/[^\d,]/g, '')
      setRaw(v)
      onChange?.(parse(v))
    }

    function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
      setFocused(false)
      setRaw(fmt(parse(raw) ?? ''))
      onBlur?.(e)
    }

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
        )}
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="decimal"
          value={raw}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(
            'h-9 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 focus:border-[#0f172a] disabled:bg-gray-50 disabled:text-gray-400 transition-colors',
            error && 'border-red-400 focus:ring-red-200 focus:border-red-400',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }
)
CurrencyInput.displayName = 'CurrencyInput'
