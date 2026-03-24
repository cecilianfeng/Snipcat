import { Link } from 'react-router-dom'

export default function Privacy() {
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
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: March 24, 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">1. Introduction</h2>
            <p>
              Snipcat ("we", "our", or "us") operates the website snipcat.app and provides
              subscription management services. This Privacy Policy explains how we collect,
              use, disclose, and safeguard your information when you use our service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">2. Information We Collect</h2>
            <p className="mb-3">We collect the following types of information:</p>
            <p className="mb-2">
              <strong className="text-gray-900">Account Information:</strong> When you sign up,
              we collect your name, email address, and profile picture through Google OAuth.
              We do not store your Google password.
            </p>
            <p className="mb-2">
              <strong className="text-gray-900">Email Data:</strong> With your explicit permission,
              we access your Gmail inbox using read-only permissions to scan for subscription-related
              emails. We only process email metadata and content related to subscriptions — we do
              not read or store personal emails.
            </p>
            <p className="mb-2">
              <strong className="text-gray-900">Subscription Data:</strong> Information about your
              subscriptions that is derived from email analysis, including service names, costs,
              billing cycles, and renewal dates.
            </p>
            <p>
              <strong className="text-gray-900">Payment Information:</strong> Payment processing
              is handled entirely by Stripe. We do not store your credit card numbers or banking
              details on our servers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <p className="ml-4 mt-2">
              — Provide and maintain our subscription tracking service<br />
              — Analyze your emails to identify and categorize subscriptions<br />
              — Send you renewal reminders and spending alerts<br />
              — Process payments for Pro subscriptions<br />
              — Improve and personalize your experience<br />
              — Communicate with you about service updates
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">4. AI Processing</h2>
            <p>
              Snipcat uses AI (powered by Claude) to analyze email content and identify subscription
              patterns. This processing is done securely and the AI does not retain your personal
              data between sessions. We do not use your data to train AI models.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">5. Data Sharing</h2>
            <p>We do not sell, trade, or rent your personal information. We may share data with:</p>
            <p className="ml-4 mt-2">
              — <strong className="text-gray-900">Stripe:</strong> For payment processing<br />
              — <strong className="text-gray-900">Supabase:</strong> For secure data storage and authentication<br />
              — <strong className="text-gray-900">Resend:</strong> For transactional emails (reminders, alerts)<br />
              — <strong className="text-gray-900">Anthropic:</strong> For AI-powered email analysis (no data retained)
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">6. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your data, including
              encryption in transit (TLS), encryption at rest, and secure authentication via
              OAuth 2.0. Your email access tokens are stored securely and can be revoked at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">7. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. You can delete
              your account at any time, which will permanently remove all your data from our
              systems within 30 days. Email scan data is processed in real-time and not
              permanently stored in raw form.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">8. Your Rights</h2>
            <p>You have the right to:</p>
            <p className="ml-4 mt-2">
              — Access your personal data<br />
              — Correct inaccurate data<br />
              — Delete your account and data<br />
              — Revoke email access permissions<br />
              — Export your subscription data<br />
              — Opt out of non-essential communications
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">9. Cookies</h2>
            <p>
              We use essential cookies for authentication and session management. We do not use
              tracking cookies or third-party advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">10. Children's Privacy</h2>
            <p>
              Snipcat is not intended for users under the age of 13. We do not knowingly collect
              personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any
              changes by posting the new Privacy Policy on this page and updating the "Last
              updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">12. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at{' '}
              <a href="mailto:hello@snipcat.app" className="text-[#F97316] hover:underline">
                hello@snipcat.app
              </a>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-gray-100 py-6 text-center text-sm text-gray-400">
        &copy; 2026 Snipcat. All rights reserved.
      </footer>
    </div>
  )
}
