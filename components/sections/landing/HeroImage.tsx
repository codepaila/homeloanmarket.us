'use client'


import { motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'

// Beautiful Unsplash background image - modern home exterior
const heroBackground = '/assets/images/cover.PNG'

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
      className="relative isolate min-h-80 sm:min-h-90 md:min-h-130 lg:min-h-150  overflow-hidden bg-secondary"
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
          className="object-cover object-center"
          aria-hidden="true"
        />

      </div>
      <div className="container-custom relative z-10">
        <div
          className=" py-12 md:pt-16 lg:pt-20 mt-12 md:mt-12"
        >
          <div className="mx-auto max-w-8xl text-left lg:mx-0">

            <motion.div
              initial={{ opacity: 1, x: 0 }}
              animate={{ opacity: 1, x: 0 }}
              transition={motionTransition(0.1)}
              className="mt-0"
            >
              <Image
                src="/assets/images/5-profiles-cover-icon.png"
                alt="Verified mortgage professionals"
                width={750}
                height={400}
                priority
                className="h-auto w-full max-w-187.5 object-contain object-center"
              />
            </motion.div>
            <div className="mt-8 sm:mt-10 md:mt-16 lg:mt-24">

              <motion.h1
                initial={{ opacity: 1, x: 0 }}
                animate={{ opacity: 1, x: 0 }}
                transition={motionTransition(0.2)}
                className=" text-lg sm:text-xl  md:text-3xl lg:text-[40px]   font-bold  tracking-tighter md:tracking-wide text-white text-shadow-xs text-shadow-black"
              >
                You Could Save Thousands on Your Home Loan.
              </motion.h1>

              {/* Subtitle - Exact text from image */}
              <motion.p
                initial={{ opacity: 1, x: 0 }}
                animate={{ opacity: 1, x: 0 }}
                transition={motionTransition(0.3)}
                className=" text-lg sm:text-2xl  md:text-3xl lg:text-[40px]  font-bold  tracking-tighter sm:tracking-wide text-white text-shadow-xs text-shadow-black"
              >
                Talk To Local Home Loan Experts
              </motion.p>
            </div>

          </div>
        </div>
      </div>
      {/*  */}
    </section>
  )
}