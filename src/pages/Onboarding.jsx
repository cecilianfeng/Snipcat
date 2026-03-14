import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, ScanSearch, CheckCircle, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { createSubscription } from '../lib/subscriptions'
import { scanGmailForSubscriptions } from '../lib/gmail'

// Same logo as Sidebar — black cat with orange scissors on dark bg inverted for light bg
const CatLogo = ({ size = 36 }) => (
  <svg
    width={size * 1.35}
    height={size}
    viewBox="0 0 58 42"
    fill="none"
    aria-label="SnipKitty logo"
  >
    {/* Scissors */}
    <g transform="translate(8,26) scale(0.28)">
      <circle cx="-6" cy="6" r="5" stroke="#F97316" strokeWidth="3" fill="none" />
      <line x1="-4" y1="2" x2="6" y2="-10" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
      <circle cx="6" cy="6" r="5" stroke="#F97316" strokeWidth="3" fill="none" />
      <line x1="4" y1="2" x2="-6" y2="-10" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
    </g>
    {/* Cat head — dark fill like Landing/Sidebar */}
    <g transform="translate(18, 0)">
      <path d="M8 16L4 3L14 12" fill="#111827" />
      <path d="M32 16L36 3L26 12" fill="#111827" />
      <ellipse cx="20" cy="24" rx="14" ry="13" fill="#111827" />
      <ellipse cx="15" cy="22" rx="2.2" ry="2.6" fill="#F97316" />
      <ellipse cx="25" cy="22" rx="2.2" ry="2.6" fill="#F97316" />
      <path d="M18.8 27L20 28.8L21.2 27Z" fill="#F97316" />
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
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 })
  const [scanFoundCount, setScanFoundCount] = useState(0)
  const [scanError, setScanError] = useState(null)
  const navigate = useNavigate()
  const { user, markOnboarded, getGoogleToken } = useAuth()

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'

  const handleNext = async () => {
    if (currentStep === 1) {
      // Real Gmail scan
      setCurrentStep(2)
      setIsScanning(true)
      setScanError(null)
      try {
        const token = await getGoogleToken()
        if (!token) {
          setScanError('Gmail access not available. Please sign out and sign in again.')
          setIsScanning(false)
          setCurrentStep(1)
          return
        }
        const { confirmed, needsReview } = await scanGmailForSubscriptions(
          token,
          (progress) => setScanProgress({ current: progress.current, total: progress.total }),
          { months: 6 }
        )
        // Save confirmed subscriptions
        let added = 0
        for (const sub of [...confirmed, ...needsReview]) {
          try {
            const { _emailCount, _confidence, _domain, ...dbSub } = sub
            await createSubscription({ ...dbSub, amount: dbSub.amount || 0, user_id: user.id })
            added++
          } catch (err) {
            console.warn('Failed to add:', sub.name, err)
          }
        }
        setScanFoundCount(added)
        setIsScanning(false)
        setCurrentStep(3)
      } catch (err) {
        console.error('Scan failed:', err)
        setScanError(err.message)
        setIsScanning(false)
        setCurrentStep(1)
      }
    } else if (currentStep === 3) {
      await markOnboarded()
      navigate('/dashboard')
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0 && !isScanning) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const step = steps[currentStep]
  const StepIcon = step.icon

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-orange-50/30 to-white flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <CatLogo size={32} />
        <span className="text-xl font-bold text-gray-900">Snip<span className="text-[#F97316]">Kitty</span></span>
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
            {currentStep === 3
              ? `We found and added ${scanFoundCount} subscription${scanFoundCount !== 1 ? 's' : ''} from your inbox. Let's take a look!`
              : step.subtitle}
          </p>

          {/* Scanning progress */}
          {currentStep === 2 && isScanning && (
            <div className="mb-6">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#F97316] to-[#FFB347] rounded-full"
                  animate={{ width: scanProgress.total > 0 ? `${(scanProgress.current / scanProgress.total) * 100}%` : '10%' }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {scanProgress.total > 0
                  ? `Scanning email ${scanProgress.current} of ${scanProgress.total}...`
                  : 'Searching your inbox...'}
              </p>
            </div>
          )}

          {/* Scan error */}
          {scanError && currentStep === 1 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{scanError}</p>
            </div>
          )}

          {/* Action Buttons */}
          {currentStep !== 2 && (
            <div className="space-y-3">
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

              {/* Back button — show on steps 1+ (not step 0, not during scanning) */}
              {currentStep > 0 && (
                <button
                  onClick={handleBack}
                  className="w-full py-2.5 px-6 text-gray-500 hover:text-gray-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              )}
            </div>
          )}

          {/* Skip option for step 1 */}
          {currentStep === 1 && (
            <button
              onClick={async () => { await markOnboarded(); navigate('/dashboard') }}
              className="mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip for now — I'll add subscriptions manually
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
