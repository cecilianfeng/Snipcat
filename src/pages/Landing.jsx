import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useScroll, useMotionValueEvent } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { createCheckoutSession } from '../lib/stripe'
import { supabase } from '../lib/supabaseClient'
import {
  Mail, ScanSearch, BellRing,
  Radar, LayoutDashboard, DollarSign, Shield, Zap,
  Check, X, Quote, Scissors, Gift, Star,
} from 'lucide-react'
import DashboardPreview from '../components/DashboardPreview'
import FAQ from '../components/FAQ'

/* Hand-drawn underline SVG component for "subscriptions" */
function HandDrawnUnderline() {
  return (
    <svg className="hand-underline" viewBox="0 0 500 30" preserveAspectRatio="none">
      <path className="stroke-main" d="M2,20 Q50,8 100,18 T200,15 T300,20 T400,16 T498,22" />
      <path className="stroke-accent" d="M2,20 Q50,8 100,18 T200,15 T300,20 T400,16 T498,22" />
    </svg>
  )
}

/* ─────────────────────────────────────────── */
/*  Animated Logo — black cat, coral scissors  */
/* ─────────────────────────────────────────── */
function CatLogo({ size = 36, className = '' }) {
  return (
    <motion.svg
      width={size * 1.35}
      height={size}
      viewBox="0 0 58 42"
      fill="none"
      className={className}
      aria-label="Snipcat logo"
      whileHover={{ scale: 1.08 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      {/* Scissors — left side, animated snip */}
      <g transform="translate(8,26) scale(0.28)">
        <motion.g
          animate={{ rotate: [0, 14, 0] }}
          transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
          style={{ transformOrigin: '0px -2px' }}
        >
          <circle cx="-6" cy="6" r="5" stroke="#F97316" strokeWidth="3" fill="white" />
          <line x1="-4" y1="2" x2="6" y2="-10" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
        </motion.g>
        <motion.g
          animate={{ rotate: [0, -14, 0] }}
          transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
          style={{ transformOrigin: '0px -2px' }}
        >
          <circle cx="6" cy="6" r="5" stroke="#F97316" strokeWidth="3" fill="white" />
          <line x1="4" y1="2" x2="-6" y2="-10" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
        </motion.g>
      </g>
      {/* Cat head */}
      <g transform="translate(18, 0)">
        <path d="M8 16L4 3L14 12" fill="#111827" />
        <path d="M32 16L36 3L26 12" fill="#111827" />
        <path d="M9 15L6 6L13 12" fill="#F97316" opacity="0.2" />
        <path d="M31 15L34 6L27 12" fill="#F97316" opacity="0.2" />
        <ellipse cx="20" cy="24" rx="14" ry="13" fill="#111827" />
        <motion.ellipse
          cx="15" cy="22" rx="2.2" ry="2.6" fill="#F97316"
          animate={{ scaleY: [1, 1, 0.08, 1, 1] }}
          transition={{ duration: 0.45, repeat: Infinity, repeatDelay: 4, times: [0, 0.35, 0.5, 0.65, 1] }}
          style={{ transformOrigin: '15px 22px' }}
        />
        <motion.ellipse
          cx="25" cy="22" rx="2.2" ry="2.6" fill="#F97316"
          animate={{ scaleY: [1, 1, 0.08, 1, 1] }}
          transition={{ duration: 0.45, repeat: Infinity, repeatDelay: 4, times: [0, 0.35, 0.5, 0.65, 1] }}
          style={{ transformOrigin: '25px 22px' }}
        />
        <ellipse cx="15.7" cy="21" rx="0.8" ry="1" fill="white" opacity="0.85" />
        <ellipse cx="25.7" cy="21" rx="0.8" ry="1" fill="white" opacity="0.85" />
        <path d="M18.8 27L20 28.8L21.2 27Z" fill="#F97316" />
      </g>
    </motion.svg>
  )
}

/* HeroCat removed — v9 design uses text-only hero */

/* ───────────── animation helpers ───────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (d = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: d, duration: 0.55, ease: 'easeOut' },
  }),
}
const staggerContainer = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }
const staggerChild = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
}

/* ───────────── data ───────────── */
const steps = [
  { num: 1, icon: <Mail className="w-5 h-5" />, title: 'Connect Your Email', desc: "Click 'Get Started' and authorize Snipcat with read-only access. We never send emails and never store your data. Takes 10 seconds." },
  { num: 2, icon: <ScanSearch className="w-5 h-5" />, title: 'AI Scans Your Inbox', desc: 'Our AI automatically finds all subscription emails, extracts prices and renewal dates. Scans thousands of emails in seconds.' },
  { num: 3, icon: <BellRing className="w-5 h-5" />, title: 'Never Miss a Renewal', desc: 'Get reminded before subscriptions renew. Cancel unwanted ones with one click. See all your costs in a beautiful dashboard.' },
]

const painPoints = [
  { pre: 'Wait, I\'m', bold: 'still paying', post: 'for that streaming service I never watch?' },
  { pre: 'I forgot to cancel after the', bold: 'free trial ended', post: '. Three months ago.' },
  { pre: 'How much am I', bold: 'actually spending', post: 'on AI tools every month?' },
]

const solutionPoints = [
  'Automatic subscription detection',
  'Beautiful, clear dashboard',
  'Smart renewal reminders',
  'Save $50–200/month on average',
]

const features = [
  { icon: <Radar className="w-6 h-6" />, title: 'Auto-Detect', desc: 'Scan your inbox and find all subscriptions automatically — even ones buried in Stripe receipts.' },
  { icon: <LayoutDashboard className="w-6 h-6" />, title: 'Clear Overview', desc: 'See all subscriptions and costs in one beautiful dashboard. Monthly totals and yearly projections.' },
  { icon: <BellRing className="w-6 h-6" />, title: 'Smart Reminders', desc: 'Get notified before renewals so you can cancel in time. Never get surprised by charges again.' },
  { icon: <DollarSign className="w-6 h-6" />, title: 'Save Money', desc: "Track spending and identify subscriptions you don't use. Users save $50–200/month on average." },
  { icon: <Shield className="w-6 h-6" />, title: 'Secure & Private', desc: 'Read-only email access. Your data never leaves your control. Everything runs in your browser.' },
  { icon: <Zap className="w-6 h-6" />, title: 'Lightning Fast', desc: 'Scan thousands of emails in seconds with AI. From connect to full dashboard in under 30 seconds.' },
]

const testimonials = [
  {
    quote: 'Saved me $87/month! Found subscriptions I completely forgot about.',
    name: 'Sarah Chen',
    role: 'Product Designer',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face'
  },
  {
    quote: 'So much better than spreadsheets. The UI is beautiful and it actually works.',
    name: 'Mike Rodriguez',
    role: 'Developer',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face'
  },
  {
    quote: 'Got reminded about my Spotify family plan renewal. Switched to a cheaper tier!',
    name: 'Alex Kim',
    role: 'Freelancer',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=80&h=80&fit=crop&crop=face'
  },
  {
    quote: 'Found 3 duplicate subscriptions I was paying for. This tool is a game changer!',
    name: 'Jessica Martinez',
    role: 'Marketing Manager',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face'
  },
  {
    quote: 'Simple, clean interface. Does exactly what it says. Highly recommend!',
    name: 'David Park',
    role: 'Startup Founder',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face'
  },
  {
    quote: 'Finally canceled my gym membership I forgot about for 8 months. Worth it!',
    name: 'Emma Thompson',
    role: 'Teacher',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop&crop=face'
  },
  {
    quote: 'Caught a price increase on my cloud storage before it renewed. Saved $60/year!',
    name: 'Ryan Patel',
    role: 'Data Analyst',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face'
  },
  {
    quote: 'Connected 3 email accounts and found 22 active subscriptions. Mind blown.',
    name: 'Olivia Wang',
    role: 'Content Creator',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=face'
  },
]

const freePlanFeatures = ['Track up to 3 subscriptions', 'Monthly summary email', 'Basic dashboard']
const freePlanMissing = ['No renewal reminders', 'Limited to 1 email account']
const proPlanFeatures = [
  'Unlimited subscriptions', '2x monthly summaries',
  'Renewal reminders (1 & 3 days before)', 'Price change alerts',
  'Multiple email accounts', 'Export to CSV',
]

/* ─────────────────────────────────────────── */
/*  How It Works — full-viewport zoom panels   */
/* ─────────────────────────────────────────── */
function StepPanel({ step }) {
  const panelRef = useRef(null)
  const [t, setT] = useState(0) // 0 → 1 as panel scrolls through viewport

  useEffect(() => {
    const handleScroll = () => {
      const el = panelRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight
      const center = rect.top + rect.height / 2
      setT(Math.max(0, Math.min(1, 1 - center / vh)))
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Zoom curve: small → full → shrink (tighter ranges for less gap feel)
  let scale, opacity
  if (t < 0.1) {
    scale = 0.85; opacity = 0.2
  } else if (t < 0.35) {
    const p = (t - 0.1) / 0.25
    scale = 0.85 + p * 0.15       // 0.85 → 1.0
    opacity = 0.2 + p * 0.8       // 0.2 → 1.0
  } else if (t < 0.65) {
    scale = 1.0; opacity = 1       // full size
  } else if (t < 0.9) {
    const p = (t - 0.65) / 0.25
    scale = 1.0 - p * 0.15         // 1.0 → 0.85
    opacity = 1 - p * 0.8          // 1.0 → 0.2
  } else {
    scale = 0.85; opacity = 0.2
  }
  const isLit = t > 0.15 && t < 0.85

  return (
    <>
      <div
        ref={panelRef}
        className="min-h-[55vh] flex items-center justify-center py-8"
      >
        <motion.div
          className="w-full h-full flex items-center justify-center px-6 sm:px-10 md:px-16 lg:px-24"
          animate={{ scale, opacity }}
          transition={{ duration: 0.05, ease: 'linear' }}
        >
          <div className="w-full max-w-4xl mx-auto">
            {/* Step number badge */}
            <motion.div
              className="flex items-center gap-4 mb-8"
              animate={{
                x: isLit ? 0 : -20,
                opacity: isLit ? 1 : 0.3,
              }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="w-20 h-20 md:w-24 md:h-24 rounded-full text-white flex items-center justify-center font-extrabold text-3xl md:text-4xl"
                animate={{
                  backgroundColor: isLit ? '#F97316' : 'rgba(255,255,255,0.1)',
                  color: isLit ? 'white' : 'rgba(255,255,255,0.3)',
                  boxShadow: isLit
                    ? '0 12px 40px rgba(249,115,22,0.5)'
                    : '0 2px 4px rgba(0,0,0,0.08)',
                }}
                transition={{ duration: 0.25 }}
              >
                {step.num}
              </motion.div>
              <div>
                <p className="text-sm font-semibold text-[#F97316] uppercase tracking-widest mb-1">
                  Step {step.num}
                </p>
                <h3 className="text-2xl md:text-4xl font-extrabold text-white">
                  {step.title}
                </h3>
              </div>
            </motion.div>

            {/* Content card — stretches wide */}
            <motion.div
              className="rounded-3xl p-8 md:p-12"
              animate={{
                backgroundColor: isLit ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)',
                borderColor: isLit ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.08)',
                boxShadow: isLit
                  ? '0 20px 60px -16px rgba(249,115,22,0.15)'
                  : 'none',
              }}
              transition={{ duration: 0.25 }}
              style={{ border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <motion.div
                className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center mb-6 [&>svg]:w-8 [&>svg]:h-8 md:[&>svg]:w-10 md:[&>svg]:h-10 text-white"
                animate={{
                  backgroundColor: isLit ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.06)',
                  scale: isLit ? 1.1 : 1,
                }}
                transition={{ duration: 0.2 }}
              >
                {step.icon}
              </motion.div>
              <p className="text-white text-opacity-55 leading-relaxed text-lg md:text-xl max-w-2xl">
                {step.desc}
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>

    </>
  )
}

/* ───────────── page ───────────── */
export default function Landing() {
  const [scrolled, setScrolled] = useState(false)
  const { scrollY } = useScroll()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [upgrading, setUpgrading] = useState(false)

  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 10))

  const handleProUpgradeClick = async (e) => {
    e.preventDefault()

    if (!user) {
      // Not logged in: redirect to login with upgrade redirect
      navigate('/login?redirect=upgrade')
      return
    }

    // Logged in: start checkout session
    setUpgrading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const checkoutUrl = await createCheckoutSession(user.id, session.access_token)
      window.location.href = checkoutUrl
    } catch (err) {
      console.error('Upgrade error:', err)
      setUpgrading(false)
      alert('Failed to start upgrade. Please try again.')
    }
  }

  return (
    <div className="bg-white text-gray-900 overflow-x-hidden">

      {/* Global animated styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap');

        .hero-title-archivo {
          font-family: 'Archivo Black', sans-serif;
          font-size: clamp(60px, 10.5vw, 112px);
          font-weight: 400;
          line-height: 1.04;
          letter-spacing: -2px;
          color: #111827;
        }

        .forgotten-gradient {
          font-style: italic;
          font-weight: 900;
          background: linear-gradient(90deg, #F97316, #FFB347, #F97316);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          display: inline-block;
          padding: 0.12em 0.08em;
          animation: gradient-shift 3s ease-in-out infinite, punk-float 3s ease-in-out infinite;
        }

        @keyframes punk-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .hand-underline {
          position: absolute;
          bottom: -0.05em;
          left: -1%;
          width: 102%;
          height: 0.22em;
          pointer-events: none;
          overflow: visible;
        }
        .hand-underline path {
          fill: none;
          stroke: #F97316;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 500;
          stroke-dashoffset: 500;
          animation: draw-underline 1.2s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
          animation-delay: 0.8s;
        }
        .hand-underline .stroke-main { stroke-width: 4.5; opacity: 0.9; }
        .hand-underline .stroke-accent { stroke-width: 2; opacity: 0.4; animation-delay: 1.3s; }

        @keyframes draw-underline {
          to { stroke-dashoffset: 0; }
        }
      `}</style>

      {/* ─── 1 · NAVBAR ─── */}
      <motion.nav
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className={`fixed top-0 inset-x-0 z-50 transition-shadow duration-300 ${scrolled ? 'shadow-md bg-white/95 backdrop-blur-sm' : 'bg-white'}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-7">
            <Link to="/" className="flex items-center gap-2 font-bold text-gray-900">
              <img src="/snipcat-logo.png" alt="Snipcat" className="w-8 h-8 object-contain" /> Snipcat
            </Link>
            <div className="flex items-center gap-6 text-sm font-medium">
              <a href="#how" className="text-gray-600 hover:text-gray-900 transition-colors">How it works</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Log In
            </Link>
            <Link to="/login">
              <motion.span
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                  className="inline-block px-5 py-2 text-sm font-semibold rounded-full bg-[#111827] text-white hover:bg-black transition-colors"
              >
                Try for free
              </motion.span>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* ─── 2 · HERO ─── */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 bg-white overflow-hidden">
        <div className="relative z-10 text-center max-w-3xl mx-auto px-4">
          <motion.h1
            className="hero-title-archivo mb-7"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.span variants={staggerChild} className="block">
              Snip away your
            </motion.span>
            <motion.span variants={staggerChild} className="block">
              <span className="forgotten-gradient">forgotten</span>
            </motion.span>
            <motion.span variants={staggerChild} className="block relative inline-block">
              subscriptions
              <HandDrawnUnderline />
            </motion.span>
          </motion.h1>

          <motion.p
            className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto mb-9"
            variants={fadeUp} initial="hidden" animate="visible" custom={0.35}
          >
            Snipcat scans your email with AI to find every recurring charge hiding in your inbox.<br />
            See everything. Cancel anything.
          </motion.p>

          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0.5}>
            <Link to="/login">
              <motion.span
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                className="inline-block px-8 py-3 bg-[#F97316] text-white text-base font-semibold rounded-full hover:bg-[#EA580C] transition-colors"
              >
                Try it for free
              </motion.span>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ─── 3 · HOW IT WORKS (FULL-SCREEN STEP PANELS) ─── */}
      <section className="bg-[#111827] py-16" id="how">
        <div className="text-center mb-4">
          <motion.h2
            className="text-3xl md:text-4xl font-extrabold text-white"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            How Snipcat Works
          </motion.h2>
          <motion.p
            className="mt-3 text-white text-opacity-50 text-lg"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            Get started in 3 simple steps
          </motion.p>
        </div>

        {steps.map((step) => (
          <StepPanel key={step.num} step={step} />
        ))}
      </section>

      {/* ─── 4 · DASHBOARD PREVIEW ─── */}
      <section className="py-24 bg-gradient-to-b from-white via-[#FFF5F0]/20 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title="See Everything in One Place" subtitle="A beautiful dashboard that makes sense of your subscriptions" />
          <motion.div
            className="mt-14"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.6 }}
          >
            <DashboardPreview />
          </motion.div>
        </div>
      </section>

      {/* ─── 5 · SOUND FAMILIAR? (ALIGNED TOP & BOTTOM) ─── */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Sound Familiar?" />

          <div className="grid md:grid-cols-2 gap-8 mt-14 items-stretch">
            <div className="space-y-4 flex flex-col justify-between">
              {painPoints.map((p, i) => (
                <motion.div
                  key={i}
                  className="bg-[#FFF5F0] rounded-xl p-6 border-l-4 border-[#F97316] flex-1 flex items-center"
                  initial={{ opacity: 0, x: -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                >
                  <p className="text-gray-700 font-medium text-lg leading-relaxed">
                    &quot;{p.pre} <span className="text-[#F97316] font-bold">{p.bold}</span> {p.post}&quot;
                  </p>
                </motion.div>
              ))}
            </div>

            <motion.div
              className="bg-[#111827] rounded-xl p-8 text-white flex flex-col justify-between shadow-2xl"
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <div>
                <Scissors className="w-9 h-9 mb-4 opacity-80 text-[#F97316]" />
                <h3 className="text-2xl font-bold mb-6">Snipcat solves all of this</h3>
              </div>
              <ul className="space-y-3">
                {solutionPoints.map((pt, i) => (
                  <motion.li
                    key={i}
                    className="flex items-center gap-3 text-white/90"
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 + i * 0.1, duration: 0.4 }}
                  >
                    <Check className="w-5 h-5 text-[#F97316] flex-shrink-0" /> {pt}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── 6 · FEATURES GRID (ORANGE ICONS) ─── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Everything You Need to Stay in Control" />

          <motion.div
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-14"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={staggerChild}
                whileHover={{ y: -4, boxShadow: '0 12px 32px -8px rgba(0,0,0,0.1)' }}
                className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm"
              >
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#FFF5F0] text-[#F97316] mb-4">
                  {f.icon}
                </span>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── 7 · PRICING (BUTTONS BOTTOM-ALIGNED WITH EQUAL HEIGHT) ─── */}
      <section className="py-24 bg-gray-50" id="pricing">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Simple, Honest Pricing" subtitle="Start free. Upgrade when you need more." />

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mt-14 items-stretch">
            {/* Free */}
            <motion.div
              className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex-1 flex flex-col">
                <Gift className="w-8 h-8 text-[#F97316] mb-4" />
                <h3 className="text-2xl font-bold mb-1">Free</h3>
                <p className="text-gray-500 mb-4">Perfect for getting started</p>
                <p className="text-4xl font-extrabold mb-6">$0<span className="text-base font-normal text-gray-400">/month</span></p>
                <ul className="space-y-2.5">
                  {freePlanFeatures.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-gray-700 text-sm">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />{f}
                    </li>
                  ))}
                  {freePlanMissing.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-gray-400 text-sm">
                      <X className="w-4 h-4 flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
              </div>
              <Link to="/login" className="block text-center py-3 mt-8 rounded-full border-2 border-[#F97316] text-[#F97316] font-semibold hover:bg-orange-50 transition-colors">
                Start Free
              </Link>
            </motion.div>

            {/* Pro — solid dark bg */}
            <motion.div
              className="relative bg-[#111827] rounded-2xl p-8 text-white shadow-2xl flex flex-col"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.5 }}
              whileHover={{ scale: 1.02 }}
            >
              <motion.span
                className="absolute -top-3 right-6 bg-[#F97316] text-xs font-bold px-3 py-1 rounded-full text-white shadow"
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                MOST POPULAR
              </motion.span>
              <div className="flex-1 flex flex-col">
                <Star className="w-8 h-8 text-[#F97316] mb-4" />
                <h3 className="text-2xl font-bold mb-1">Pro</h3>
                <p className="text-white/60 mb-4">For serious savers</p>
                <p className="text-4xl font-extrabold mb-6">$4.99<span className="text-base font-normal text-white/50">/month</span></p>
                <ul className="space-y-2.5">
                  {proPlanFeatures.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-white/85 text-sm">
                      <Check className="w-4 h-4 text-[#F97316] flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={handleProUpgradeClick}
                disabled={upgrading}
                className="block text-center w-full py-3 mt-8 rounded-full bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-semibold hover:from-[#EA580C] hover:to-[#C2410C] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {upgrading ? 'Loading...' : 'Start Saving Now'}
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── 8 · TESTIMONIALS (8 REVIEWS + REAL AVATARS + INFINITE MARQUEE) ─── */}
      <section className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Loved by Thousands" />
        </div>

        {/* Infinite scroll marquee — CSS-based for silky smooth performance */}
        <div className="mt-14 relative">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

          <div className="marquee-track">
            <div className="marquee-inner">
              {/* Render testimonials 3x for seamless loop */}
              {[...testimonials, ...testimonials, ...testimonials].map((t, i) => (
                <div
                  key={i}
                  className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200 w-[340px] flex-shrink-0"
                >
                  <Quote className="w-6 h-6 text-[#F97316] mb-3" />
                  <div className="flex gap-0.5 mb-3">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-gray-600 leading-relaxed mb-5 min-h-[60px]">"{t.quote}"</p>
                  <div className="flex items-center gap-3">
                    <img
                      src={t.avatar}
                      alt={t.name}
                      className="w-10 h-10 rounded-full object-cover shadow-md"
                      loading="lazy"
                    />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                      <p className="text-xs text-gray-400">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Marquee CSS animation */}
        <style>{`
          .marquee-track {
            overflow: hidden;
            width: 100%;
          }
          .marquee-inner {
            display: flex;
            gap: 1.5rem;
            width: max-content;
            animation: marquee-scroll 60s linear infinite;
          }
          .marquee-inner:hover {
            animation-play-state: paused;
          }
          @keyframes marquee-scroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-33.333%); }
          }
        `}</style>
      </section>

      {/* ─── 9 · FAQ ─── */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Frequently Asked Questions" />
          <div className="mt-14"><FAQ /></div>
        </div>
      </section>

      {/* ─── 10 · FINAL CTA ─── */}
      <section className="py-24 bg-[#111827] text-white text-center">
        <div className="max-w-3xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Scissors className="w-11 h-11 mx-auto mb-6 opacity-80 transform rotate-90" />
          </motion.div>
          <motion.h2
            className="text-3xl md:text-4xl font-extrabold mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            Stop the <span className="text-[#F97316]">bleeding</span>.
          </motion.h2>
          <motion.p
            className="text-lg text-white/70 mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            Join 1,000+ users who stopped wasting money on forgotten subscriptions
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <Link to="/login">
              <motion.span
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                className="inline-flex items-center gap-2.5 px-10 py-4 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white text-lg font-bold rounded-full shadow-lg hover:shadow-xl transition-shadow"
              >
                <Scissors className="w-5 h-5" />
                Try Snipcat for Free
              </motion.span>
            </Link>
          </motion.div>
          <motion.p
            className="mt-5 text-sm text-white/40"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            No credit card required &middot; Free forever &middot; Cancel anytime
          </motion.p>
        </div>
      </section>

      {/* ─── 11 · FOOTER ─── */}
      <footer className="bg-white border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-1.5 font-bold text-gray-900 mb-2">
                <CatLogo size={22} /> Snipcat
              </div>
              <p className="text-sm text-gray-500">Smart subscription management</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-3 text-sm">Product</p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#how" className="hover:text-[#F97316] transition-colors">How it works</a></li>
                <li><a href="#pricing" className="hover:text-[#F97316] transition-colors">Pricing</a></li>
                <li><a href="#faq" className="hover:text-[#F97316] transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-3 text-sm">Company</p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-[#F97316] transition-colors">About</a></li>
                <li><a href="#" className="hover:text-[#F97316] transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-[#F97316] transition-colors">Terms of Service</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-3 text-sm">Connect</p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-[#F97316] transition-colors">Twitter</a></li>
                <li><a href="mailto:hello@snipcat.com" className="hover:text-[#F97316] transition-colors">hello@snipcat.com</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-6 text-center text-sm text-gray-400">
            &copy; 2024 Snipcat. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}

function SectionHeading({ title, subtitle }) {
  return (
    <div className="text-center">
      <motion.h2
        className="text-3xl md:text-4xl font-extrabold text-gray-900"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          className="mt-3 text-gray-500 text-lg"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  )
}
