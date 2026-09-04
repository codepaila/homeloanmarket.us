'use client'

import { useState, useEffect, useRef } from 'react'
import { Shield, CheckCircle, AlertCircle, Clock, Fingerprint, RefreshCw } from 'lucide-react'

interface HoldCaptchaProps {
  onChange: (isVerified: boolean) => void
  duration?: number // Duration in seconds
  error?: string
  cooldownDuration?: number // Cooldown duration in seconds after max attempts
}

export default function HoldCaptcha({ 
  onChange, 
  duration = 3, 
  error,
  cooldownDuration = 30 // 30 seconds cooldown
}: HoldCaptchaProps) {
  const [isHolding, setIsHolding] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isVerified, setIsVerified] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(duration)
  const [showSuccess, setShowSuccess] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [cooldownTime, setCooldownTime] = useState(0)
  const [isOnCooldown, setIsOnCooldown] = useState(false)
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const cooldownBarRef = useRef<HTMLDivElement>(null)
  const maxAttempt = 5

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) {
        clearInterval(holdIntervalRef.current)
      }
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current)
      }
    }
  }, [])

  // Update progress bar width
  useEffect(() => {
    if (progressBarRef.current) {
      progressBarRef.current.style.width = `${progress}%`
    }
  }, [progress])

  // Update cooldown bar width
  useEffect(() => {
    if (cooldownBarRef.current) {
      const width = (cooldownTime / cooldownDuration) * 100
      cooldownBarRef.current.style.width = `${width}%`
    }
  }, [cooldownTime, cooldownDuration])

  // Start cooldown timer
  const startCooldown = () => {
    setIsOnCooldown(true)
    setCooldownTime(cooldownDuration)
    
    cooldownIntervalRef.current = setInterval(() => {
      setCooldownTime(prev => {
        if (prev <= 1) {
          if (cooldownIntervalRef.current) {
            clearInterval(cooldownIntervalRef.current)
            cooldownIntervalRef.current = null
          }
          setIsOnCooldown(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const startHold = () => {
    if (isVerified || isHolding || isOnCooldown) return
    
    setIsHolding(true)
    setProgress(0)
    setTimeRemaining(duration)
    
    let currentProgress = 0
    const increment = 100 / (duration * 10) // Update 10 times per second
    
    holdIntervalRef.current = setInterval(() => {
      currentProgress += increment
      setProgress(Math.min(currentProgress, 100))
      setTimeRemaining(prev => Math.max(0, prev - 0.1))
      
      if (currentProgress >= 100) {
        completeVerification()
      }
    }, 100)
  }

  const cancelHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current)
      holdIntervalRef.current = null
    }
    
    if (!isVerified && isHolding) {
      setIsHolding(false)
      setProgress(0)
      setTimeRemaining(duration)
      
      const newAttempts = attempts + 1
      setAttempts(newAttempts)
      
      // Start cooldown after max attempts
      if (newAttempts >= maxAttempt) {
        startCooldown()
      }
      
      // Shake animation on failed attempt
      if (buttonRef.current) {
        buttonRef.current.classList.add('animate-shake')
        setTimeout(() => {
          buttonRef.current?.classList.remove('animate-shake')
        }, 500)
      }
    }
  }

  const completeVerification = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current)
      holdIntervalRef.current = null
    }
    
    setIsVerified(true)
    setShowSuccess(true)
    onChange(true)
    setAttempts(0) // Reset attempts on success
    
    // Reset after showing success animation
    setTimeout(() => {
      setShowSuccess(false)
    }, 2000)
  }

  const resetCaptcha = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current)
      holdIntervalRef.current = null
    }
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current)
      cooldownIntervalRef.current = null
    }
    
    setIsHolding(false)
    setProgress(0)
    setIsVerified(false)
    setTimeRemaining(duration)
    setShowSuccess(false)
    setAttempts(0)
    setIsOnCooldown(false)
    setCooldownTime(0)
    onChange(false)
  }

  // Format time display
  const formatTime = (seconds: number) => {
    const secs = Math.ceil(seconds)
    return `${secs}s`
  }

  // Format cooldown time display
  const formatCooldownTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Get status colors from CSS variables
  const getStatusColors = () => {
    if (isVerified) {
      return {
        border: 'border-green-500',
        bg: 'bg-green-500/10',
        iconColor: 'text-green-500',
        bgIcon: 'bg-green-500/20'
      }
    }
    if (isOnCooldown) {
      return {
        border: 'border-border',
        bg: 'bg-muted/50',
        iconColor: 'text-muted-foreground',
        bgIcon: 'bg-muted'
      }
    }
    if (isHolding) {
      return {
        border: 'border-blue-500',
        bg: 'bg-blue-500/5',
        iconColor: 'text-blue-500',
        bgIcon: 'bg-blue-500/10'
      }
    }
    return {
      border: 'border-border',
      bg: 'bg-background',
      iconColor: 'text-blue-500',
      bgIcon: 'bg-blue-500/5'
    }
  }

  const statusColors = getStatusColors()

  return (
    <div className="space-y-2 md:space-y-4">
      {/* Add custom animations to your global CSS or component styles */}
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
          20%, 40%, 60%, 80% { transform: translateX(2px); }
        }
        @keyframes scaleIn {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        .animate-scale-in {
          animation: scaleIn 0.3s ease-out;
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.3s ease-out;
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-rotate {
          animation: rotate 2s linear infinite;
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-blue-500/5">
            <Shield className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-sm font-semibold text-foreground">
            Security verification
          </div>
        </div>
        
        {attempts > 0 && !isVerified && !isOnCooldown && attempts < maxAttempt && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <AlertCircle className="h-3 w-3" />
            <span>Attempt {attempts}/{maxAttempt}</span>
          </div>
        )}
        
        {isOnCooldown && (
          <div className="flex items-center gap-1 text-xs text-red-500">
            <Clock className="h-3 w-3" />
            <span>Cooldown: {formatCooldownTime(cooldownTime)}</span>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="text-sm text-muted-foreground">
        {isOnCooldown ? (
          `Wait ${formatCooldownTime(cooldownTime)} before trying again`
        ) : (
          `Hold the button for ${duration} seconds to verify you're human`
        )}
      </div>

      {/* Main CAPTCHA Button */}
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onMouseDown={startHold}
          onTouchStart={startHold}
          onMouseUp={cancelHold}
          onMouseLeave={cancelHold}
          onTouchEnd={cancelHold}
          disabled={isVerified || isOnCooldown}
          className={`
            relative w-full p-3 rounded border-2 transition-all duration-200
            ${statusColors.border} ${statusColors.bg}
            ${!isVerified && !isOnCooldown ? 'hover:border-blue-500/50 hover:bg-muted' : ''}
            ${!isVerified && !isOnCooldown ? 'active:scale-[0.98]' : ''}
            disabled:opacity-50 disabled:cursor-not-allowed
            overflow-hidden
          `}
        >
          {/* Cooldown Overlay */}
          {isOnCooldown && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-0" />
          )}
          
          {/* Progress Bar Background */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5"></div>
          
          {/* Animated Progress Fill */}
          {isHolding && !isVerified && !isOnCooldown && (
            <div
              className="absolute inset-0 bg-gradient-to-r from-blue-500/15 to-purple-500/15"
              style={{ 
                transformOrigin: 'left',
                transform: `scaleX(${progress / 100})`,
                transition: 'transform 0.1s linear'
              }}
            />
          )}
          
          {/* Content */}
          <div className="relative z-10 flex flex-col items-center gap-1">
            {isVerified ? (
              <>
                <div className={`p-2 rounded-full ${statusColors.bgIcon} animate-scale-in`}>
                  <CheckCircle className={`h-4 w-4 ${statusColors.iconColor}`} />
                </div>
              </>
            ) : isOnCooldown ? (
              <>
                <div className={`p-3 rounded-full ${statusColors.bgIcon}`}>
                  <div className="animate-rotate">
                    <RefreshCw className="h-8 w-8 text-muted-foreground" />
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-foreground">
                    Cooling down...
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatCooldownTime(cooldownTime)} remaining
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={`p-3 rounded-full ${statusColors.bgIcon}`}>
                  {isHolding ? (
                    <div className="animate-rotate">
                      <Clock className="h-8 w-8 text-blue-500" />
                    </div>
                  ) : (
                    <Fingerprint className="h-8 w-8 text-blue-500" />
                  )}
                </div>
                <div className="text-center">
                  <div className="font-semibold text-foreground">
                    {isHolding ? 'Hold...' : 'Press & Hold'}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    {isHolding ? (
                      <>
                        <Clock className="h-3 w-3 animate-pulse" />
                        {formatTime(timeRemaining)} remaining
                      </>
                    ) : (
                      `Hold for ${duration} seconds to verify`
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </button>

        {/* Progress Indicator */}
        {isHolding && !isVerified && !isOnCooldown && (
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                ref={progressBarRef}
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-100"
                style={{ width: '0%' }}
              />
            </div>
          </div>
        )}

        {/* Cooldown Progress Ring */}
        {isOnCooldown && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-32">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                ref={cooldownBarRef}
                className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-1000"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Status Messages */}
      <div className="space-y-2">
        {error && (
          <div className="flex items-center gap-2 text-red-500 text-sm animate-fade-in">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {attempts > 0 && !isVerified && !isOnCooldown && attempts < maxAttempt && (
          <div className="flex items-center gap-2 text-red-500 text-sm animate-fade-in">
            <AlertCircle className="h-4 w-4" />
            <span>Release too soon! {maxAttempt - attempts} attempt(s) remaining.</span>
          </div>
        )}

        {isOnCooldown && (
          <div className="flex items-center gap-2 text-red-500 text-sm animate-fade-in">
            <AlertCircle className="h-4 w-4" />
            <span>
              Too many attempts. Please wait {formatCooldownTime(cooldownTime)} before trying again.
            </span>
          </div>
        )}

        {/* Reset Button - Shows after cooldown ends or if verified */}
        {(isVerified || (isOnCooldown && cooldownTime === 0)) && (
          <button
            type="button"
            onClick={resetCaptcha}
            className="w-full py-2 rounded border border-border hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors animate-fade-in-up"
          >
            {isOnCooldown && cooldownTime === 0 ? 'Try again now' : 'Reset verification'}
          </button>
        )}

        {/* Manual Reset during cooldown */}
        {isOnCooldown && cooldownTime > 0 && (
          <button
            type="button"
            onClick={resetCaptcha}
            className="w-full py-2 rounded border border-border hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors animate-fade-in-up"
            disabled={cooldownTime > 0}
          >
            Reset now
          </button>
        )}
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="rounded border border-green-500/30 bg-green-500/5 p-3 animate-scale-in">
          <div className="flex items-center gap-2 text-sm text-green-500">
            <CheckCircle className="h-4 w-4" />
            <span>Verification complete! You can now submit the form.</span>
          </div>
        </div>
      )}

      {/* Security Note */}
      <div className="text-xs text-muted-foreground pt-2 border-t border-border">
        <div className="flex items-start gap-2">
          <Shield className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>This helps prevent automated submissions and spam.</span>
        </div>
      </div>
    </div>
  )
}