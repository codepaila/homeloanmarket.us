'use client'

import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { ArrowRight, Calculator } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function SmartToolsSection() {
  const prefersReducedMotion = useReducedMotion()

  const motionTransition = (delay: number) => ({
    duration: prefersReducedMotion ? 0 : 0.6,
    delay: prefersReducedMotion ? 0 : delay,
    ease: [0.25, 0.46, 0.45, 0.94] as const,
  })



  return (
    <div className="bg-primary rounded">
        <div className=" text-center p-4 transition-colors  sm:p-8 lg:p-10 ">
          <div className="flex items-center justify-center gap-3 border-b border-secondary pb-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background text-foreground">
              <Calculator className="h-5 w-5" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground">
              Mortgage Tool
            </span>
          </div>

          <h3 className="mt-8 text-xl font-semibold text-primary-foreground sm:text-2xl">
            Calculate Your Monthly Payment
          </h3>
          <p
            className="mt-4 max-w-3xl mx-auto text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Estimate your monthly mortgage payments instantly. Plan your home financing
            journey with confidence and clarity.
          </p>
          <p className="mt-3 max-w-lg mx-auto text-sm leading-relaxed text-muted-foreground sm:text-base">
            Enter home price, down payment, interest rate, and term to see your monthly payment
          </p>

          <div className="mt-8 group flex flex-col gap-4 sm:flex-row items-center justify-center">
            <Link href="/calculator">
              <Button
                className="btn-secondary w-full px-8 py-3 text-base sm:w-auto"
              >
                <span className="flex items-center gap-2">
                  Start Calculating
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </Button>
            </Link>
          </div>

          {/* Quick Stats */}
          <div className="mt-10 grid grid-cols-3 gap-4 border-t border-border pt-6">
            <div>
              <p className="text-xs text-muted-foreground">Home Price</p>
              <p className="mt-1 text-sm font-semibold text-primary-foreground">$100k - $5M</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Terms</p>
              <p className="mt-1 text-sm font-semibold text-primary-foreground">15 - 30 Years</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rate</p>
              <p className="mt-1 text-sm font-semibold text-primary-foreground">1% - 15%</p>
            </div>
          </div>
        </div>
      
    </div>
  )
}
