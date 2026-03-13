import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, ScanSearch, CheckCircle, ArrowRight, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const CatLogo = ({ size = 40 }) => (
  <svg viewBox="0 0 40 42" fill="none" style={{ width: size, height: size }}>
    <g transform="translate(0, 0)">
      <path d="M8 16L4 3L14 12" fill="#F97316" />
      <path d="M32 16L36 3L26 12" fill="#F97316" />
      <ellipse cx="20" cy="24" rx="14" ry="13" fill="#F97316" />
      <ellipse cx="15" cy="22" rx="2.2" ry="2.6" fill="white" />
      <ellipse cx="25" cy="22" rx="2.2" ry="2.6" fill="white" />
      <path d="M18.8 27L20 28.8L21.2 27Z" fill="white" />
    </g>
  </svg>
)

const steps = [
  {
    id: 'welcome',
    title: 'Welcome to SnipKitty!',
    subtitle: "Let's get your subscriptions organized in under 2 minutes.",
    icon: Sparkles,
  },
  {
    id: 'connect',
    title: 'Connect Your Email',
    subtitle: 'We\'ll scan your inbox to find subscription receipts and billing emails. We only read — never send or delete.',
    icon: Mail,
  },
  {
    id: 'scanning',
    title: 'Scanning Your Subscriptions',
    subtitle: 'SnipKitty is sniffing through your emails for subscriptions...',
    icon: ScanSearch,
  },
  {
    id: 'done',
    title: 'All Set!',
    subtitle: 'We found your subscriptions. Let\'s take a look at your dashboard.',
    icon: CheckCircle,
  },
]

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isScanning, setIsScanning] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'

  const handleNext = () => {
    if (currentStep === 1) {
      // Simulate connecting Gmail and scanning
      setCurrentStep(2)
      setIsScanning(true)
      // Simulate scanning delay
      setTimeout(() => {
        setIsScanning(false)
        setCurrentStep(3)
      }, 3000)
    } else if (currentStep === 3) {
      // Done — go to dashboard
      navigate('/dashboard')
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }

  const step = steps[currentStep]
  const StepIcon = step.icon

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-orange-50/30 to-white flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <CatLogo size={32} />
        <span className="font-bold text-gray-900">Snip<span className="text-[#F97316]">Kitty</span></span>
      </div>

      {/* Progress Dots */}
      <div className="flex gap-2 mb-10">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === currentStep
                ? 'w-8 bg-[#F97316]'
                : i < currentStep
                  ? 'w-2 bg-[#F97316]/60'
                  : 'w-2 bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-10 max-w-md w-full text-center"
        >
          {/* Icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mb-6">
            {currentStep === 2 && isScanning ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
              >
                <ScanSearch size={28} className="text-[#F97316]" />
              </motion.div>
            ) : (
              <StepIcon size={28} className="text-[#F97316]" />
            )}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {currentStep === 0 ? `Hey ${firstName}!` : step.title}
          </h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            {step.subtitle}
          </p>

          {/* Scanning animation */}
          {currentStep === 2 && isScanning && (
            <div className="mb-6">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#F97316] to-[#FFB347] rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 3, ease: 'easeInOut' }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">This usually takes a few seconds...</p>
            </div>
          )}

          {/* Action Button */}
          {currentStep !== 2 && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleNext}
              className="w-full py-3 px-6 bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {currentStep === 0 && "Let's Go"}
              {currentStep === 1 && (
                <>
                  <Mail size={18} />
                  Connect Gmail
                </>
              )}
              {currentStep === 3 && (
                <>
                  View My Dashboard
                  <ArrowRight size={18} />
                </>
              )}
            </motion.button>
          )}

          {/* Skip option for step 1 */}
          {currentStep === 1 && (
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip for now — I'll add subscriptions manually
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
