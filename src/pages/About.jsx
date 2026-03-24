import { Link } from 'react-router-dom'

export default function About() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="font-bold text-gray-900 flex items-center gap-1.5">
            <img src="/snipcat-logo.png" alt="Snipcat" className="w-6 h-6" /> Snipcat
          </Link>
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            ← Back to home
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-6">About Snipcat</h1>

        <div className="space-y-6 text-gray-600 leading-relaxed">
          <p className="text-lg">
            Snipcat is an AI-powered subscription management tool that helps you take control
            of your recurring expenses. We believe managing subscriptions shouldn't be a chore —
            it should be effortless.
          </p>

          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-8 my-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Our Mission</h2>
            <p className="text-gray-700">
              In a world of subscription fatigue, we're building the simplest way to see what
              you're paying for, when you're being charged, and where you can save. One dashboard,
              zero surprises.
            </p>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4">How It Works</h2>
          <p>
            Connect your email and Snipcat's AI instantly scans for subscription receipts,
            renewal notices, and billing confirmations. It organizes everything into a clean
            dashboard with spending insights, renewal reminders, and smart alerts — so you
            never get surprised by an unexpected charge again.
          </p>

          <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4">Built With Care</h2>
          <p>
            Snipcat is designed and built in Toronto, Canada. We care deeply about user privacy
            and data security. We use read-only email access, never store your passwords, and
            you can revoke access at any time.
          </p>

          <div className="mt-12 pt-8 border-t border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Get in Touch</h2>
            <p>
              Questions, feedback, or partnership inquiries? We'd love to hear from you.
            </p>
            <div className="mt-4 flex flex-wrap gap-4">
              <a
                href="mailto:hello@snipcat.app"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-black transition-colors"
              >
                Email us
              </a>
              <a
                href="https://calendly.com/hellosnipcat/30min"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 text-gray-700 text-sm font-medium hover:border-gray-300 transition-colors"
              >
                Book a call
              </a>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-100 py-6 text-center text-sm text-gray-400">
        &copy; 2026 Snipcat. All rights reserved.
      </footer>
    </div>
  )
}
