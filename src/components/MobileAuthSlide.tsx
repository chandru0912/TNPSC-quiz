import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useScrollLock } from '../hooks/useScrollLock'
import StudentAuthForm from './StudentAuthForm'
import './MobileAuthSlide.css'
import '../pages/Auth.css'

export type AuthSlideType = 'none' | 'login' | 'register'

interface MobileAuthSlideProps {
  activeSlide: AuthSlideType
  onClose: () => void
  onSwitchToLogin: () => void
  onSwitchToRegister: () => void
}

const MobileAuthSlide = ({
  activeSlide,
  onClose,
  onSwitchToLogin,
  onSwitchToRegister,
}: MobileAuthSlideProps) => {
  useScrollLock(activeSlide !== 'none')

  useEffect(() => {
    if (activeSlide === 'none') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeSlide, onClose])

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <AnimatePresence mode="wait">
      {activeSlide !== 'none' && (
        <div
          className="mobile-auth-overlay"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={activeSlide === 'login' ? 'Login Popup' : 'Register Popup'}
        >
          <motion.div
            key={`auth-slide-${activeSlide}`}
            className="mobile-auth-card glass"
            initial={{ opacity: 0, y: -18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.97 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            <StudentAuthForm
              initialMode={activeSlide === 'register' ? 'register' : 'login'}
              variant="modal"
              onClose={onClose}
              onSuccess={onClose}
              onSwitchMode={(nextMode) => {
                if (nextMode === 'register') onSwitchToRegister()
                else onSwitchToLogin()
              }}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export default MobileAuthSlide
