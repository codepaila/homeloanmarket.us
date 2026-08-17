'use client'


import { motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'

// Beautiful Unsplash background image - modern home exterior
const heroBackground = '/assets/images/home-cover.jpeg'

export default function HeroImageSection() {

  const prefersReducedMotion = useReducedMotion()

  const motionTransition = (delay: number) => ({
    duration: prefersReducedMotion ? 0 : 0.6,
    delay: prefersReducedMotion ? 0 : delay,
    ease: [0.25, 0.46, 0.45, 0.94] as const,
  })


  return (
    <section
      //  className="relative isolate  overflow-hidden bg-secondary"
      className="relative isolate min-h-80 sm:min-h-100 md:min-h-150 overflow-hidden bg-secondary"
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src={heroBackground}
          alt="Modern dream home exterior"
          // width={1200}
          // height={400}
          fill
          sizes="100vw"
          priority
          className="object-fit"
          aria-hidden="true"
        />

      </div>
      <div className="container-custom relative z-10">
        <div
         className="flex items-center py-12 md:py-16 lg:py-20 mt-10 md:mt-12"
        >
          <div className="mx-auto max-w-4xl text-left lg:mx-0">

            <motion.div
              initial={{ opacity: 1, x: 0 }}
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
                className="h-auto w-full max-w-[800px] object-contain object-left"
              />
            </motion.div>
          </div>
        </div>
      </div>
      {/*  */}
    </section>
  )
}