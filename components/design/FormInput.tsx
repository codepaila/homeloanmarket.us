'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'

interface FormInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string
  name: string
  icon?: React.ReactNode
  error?: string
  hint?: string
  required?: boolean
  containerClassName?: string
  labelClassName?: string
  inputClassName?: string
  togglePassword?: boolean
}

export function FormInput({
  label,
  name,
  icon,
  error,
  hint,
  required = false,
  containerClassName,
  labelClassName,
  inputClassName,
  togglePassword = false,
  type,
  className,
  id,
  ...props
}: FormInputProps) {
  const inputId = id || name
  const [showPassword, setShowPassword] = useState(false)
  const hasError = !!error

  const inputType = togglePassword
    ? showPassword
      ? 'text'
      : 'password'
    : type

  return (
    <div className={cn('space-y-2', containerClassName)}>
      <label
        htmlFor={inputId}
        className={cn(
          'flex items-center gap-1.5 text-sm font-medium text-text-main',
          labelClassName,
        )}
      >
        {label}
        {required && <span className="text-destructive">*</span>}
      </label>

      <div className="relative">
        {icon && (
          <div
            className={cn(
              'absolute left-3 top-1/2 -translate-y-1/2 text-text-muted',
              hasError && 'text-destructive',
            )}
          >
            {icon}
          </div>
        )}

        <input
          id={inputId}
          name={name}
          type={inputType}
          className={cn(
            'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base',
            'transition-all duration-200 placeholder:text-text-muted/50',
            'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15',
            icon && 'pl-10',
            togglePassword && 'pr-12',
            hasError &&
              'border-destructive focus:border-destructive focus:ring-destructive/15',
            className,
          )}
          aria-invalid={hasError}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />

        {togglePassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-muted transition-colors hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {error && (
        <div
          id={`${inputId}-error`}
          className="flex items-center gap-1.5 text-xs text-destructive"
        >
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
        </div>
      )}
      {hint && !hasError && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  )
}

interface FormTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  label: string
  name: string
  icon?: React.ReactNode
  error?: string
  hint?: string
  required?: boolean
}

export function FormTextarea({
  label,
  name,
  icon,
  error,
  hint,
  required = false,
  className,
  id,
  ...props
}: FormTextareaProps) {
  const textareaId = id || name

  return (
    <div className="space-y-2">
      <label
        htmlFor={textareaId}
        className="flex items-center gap-1.5 text-sm font-medium text-text-main"
      >
        {label}
        {required && <span className="text-destructive">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <div
            className={cn(
              'absolute left-3 top-3 text-text-muted',
              'has-error:text-destructive',
            )}
          >
            {icon}
          </div>
        )}
        <textarea
          id={textareaId}
          name={name}
          className={cn(
            'w-full min-h-[120px] resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-base',
            'transition-all duration-200 placeholder:text-text-muted/50',
            'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15',
            icon && 'pl-10',
            error &&
              'border-destructive focus:border-destructive focus:ring-destructive/15',
            className,
          )}
          aria-invalid={!!error}
          {...props}
        />
      </div>
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
        </div>
      )}
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  )
}
