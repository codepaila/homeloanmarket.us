// hooks/useFormSteps.ts
import { useState } from 'react'

export function useFormSteps(totalSteps: number) {
  const [currentStep, setCurrentStep] = useState(1)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])

  const next = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1)
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps(prev => [...prev, currentStep])
      }
    }
  }

  const back = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const goToStep = (step: number) => {
    if (step >= 1 && step <= totalSteps) {
      setCurrentStep(step)
    }
  }

  const isStepCompleted = (step: number) => {
    return completedSteps.includes(step)
  }

  const progress = (currentStep / totalSteps) * 100

  return {
    currentStep,
    totalSteps,
    next,
    back,
    goToStep,
    isStepCompleted,
    progress,
    completedSteps,
    setCompletedSteps,
  }
}