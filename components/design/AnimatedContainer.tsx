'use client'

import { motion, useInView, useAnimation, type Variants } from 'motion/react'
import { useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

const fadeInUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
}

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
}

const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
}

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
}

export const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
}

interface AnimatedContainerProps {
  children: React.ReactNode
  className?: string
  delay?: number
  once?: boolean
  variant?: 'fade' | 'fadeUp' | 'scaleIn'
  stagger?: number
}

export function AnimatedContainer({
  children,
  className,
  delay = 0,
  once = true,
  variant = 'fadeUp',
}: AnimatedContainerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once, margin: '-50px' })
  const controls = useAnimation()

  useEffect(() => {
    if (isInView) {
      controls.start('animate')
    }
  }, [isInView, controls])

  const variants =
    variant === 'fade' ? fadeIn : variant === 'scaleIn' ? scaleIn : fadeInUp

  const finalVariant = {
    ...variants,
    animate: {
      ...variants.animate,
      transition: {
        ...variants.transition,
        delay: delay * (isInView ? 1 : 0),
      },
    },
  }

  return (
    <motion.div
      ref={ref}
      variants={staggerContainer}
      initial="initial"
      animate={controls}
    >
      <motion.div variants={finalVariant as unknown as Variants} className={className}>
        {children}
      </motion.div>
    </motion.div>
  )
}

export function StaggerChildren({
  children,
  className,
  delay = 0,
  stagger = 0.1,
}: AnimatedContainerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  const controls = useAnimation()

  useEffect(() => {
    if (isInView) {
      controls.start('animate')
    }
  }, [isInView, controls])

  const itemVariant = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1],
      delay: delay * (isInView ? 1 : 0),
    },
  }

  const containerVariant = {
    animate: {
      transition: {
        staggerChildren: stagger,
        delayChildren: delay,
      },
    },
  }

  return (
    <motion.div
      ref={ref}
      variants={containerVariant}
      initial="initial"
      animate={controls}
      className={className}
    >
      {Array.isArray(children)
        ? children.map((child, i) => (
            <motion.div key={i} variants={itemVariant}>
              {child}
            </motion.div>
          ))
        : children}
    </motion.div>
  )
}

export function HoverElevation({
  children,
  className,
  scale = 1.02,
}: {
  children: React.ReactNode
  className?: string
  scale?: number
}) {
  return (
    <motion.div
      className={cn(
        'transition-shadow duration-300',
        className
      )}
      whileHover={{
        scale,
        transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
      }}
    >
      {children}
    </motion.div>
  )
}

export function Counter({
  value,
  suffix = '',
  prefix = '',
  className,
}: {
  value: number
  suffix?: string
  prefix?: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      {isInView ? (
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        >
          {value.toLocaleString()}
        </motion.span>
      ) : (
        value.toLocaleString()
      )}
      {suffix}
    </span>
  )
}
