'use client'

import { motion, useReducedMotion } from 'motion/react'

import Image from 'next/image'

// Beautiful Unsplash background image - modern home exterior
const heroBackground = '/assets/images/cover.PNG'

export default function HeroSection() {
 
  const prefersReducedMotion = useReducedMotion()

  const motionTransition = (delay: number) => ({
    duration: prefersReducedMotion ? 0 : 0.6,
    delay: prefersReducedMotion ? 0 : delay,
    ease: [0.25, 0.46, 0.45, 0.94] as const,
  })

  return (
    <section className="relative isolate min-h-[40vh] md:min-h-[85vh] overflow-hidden bg-secondary">
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src={heroBackground}
          alt="Modern dream home exterior"
          fill
          priority
          sizes="100vw"
          className="object-cover object-bottom"
          aria-hidden="true"
        />
        {/* Dark Overlay for better text contrast */}
        {/* <div className="absolute inset-0 bg-gradient-to-r from-secondary/90 via-secondary/70 to-secondary/40" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-t from-secondary/90 via-transparent to-secondary/20" aria-hidden="true" /> */}
      </div>

      <div className="container-custom relative z-10">
        <div className="flex min-h-[45vh] md:min-h-[85vh] items-center py-12 md:py-16 lg:py-20">
          <div className="mx-auto max-w-4xl text-left lg:mx-0">
       
           

            {/* 5-Profile PNG Image */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={motionTransition(0.1)}
              className="mt-0"
            >
              <Image
                src="/assets/images/5-profiles-cover-icon.png"
                alt="Verified mortgage professionals"
                width={800}
                height={100}
                priority
                className="h-auto w-full max-w-[800px] object-contain"
              />
            </motion.div>

            {/* Main Heading - Exact text from image */}
            <div className="mt-12 ml-4">

              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={motionTransition(0.2)}
                className="mt-4  text-lg sm:text-xl lg:text-3xl  font-bold leading-[1.1] tracking-tight text-white text-shadow-black tracking-wide"
              >
                You Could Save Thousands on Your Home Loan.
        
              </motion.h1>

              {/* Subtitle - Exact text from image */}
              <motion.p
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={motionTransition(0.3)}
                className="mt-3 text-lg sm:text-2xl lg:text-3xl font-medium text-white/90"
              >
                Talk To Local Home Loan Experts
              </motion.p>
            </div>


          </div>
        </div>
      </div>
    </section>
  )
}