import { Link } from 'react-router-dom'

export default function Terms() {
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
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: March 24, 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Snipcat (snipcat.app), you agree to be bound by these Terms
              of Service. If you do not agree to these terms, please do not use our service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">2. Description of Service</h2>
            <p>
              Snipcat is a subscription management platform that helps you track, manage, and
              optimize your recurring subscriptions. Our service uses AI-powered email analysis
              to automatically detect and categorize your subscriptions, provides spending insights,
              and sends renewal reminders.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">3. Account Registration</h2>
            <p>
              To use Snipcat, you must create an account using Google OAuth. You are responsible
              for maintaining the security of your account and for all activities that occur under
              your account. You must be at least 13 years old to use this service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">4. Free and Pro Plans</h2>
            <p className="mb-2">
              <strong className="text-gray-900">Free Plan:</strong> Provides basic subscription
              tracking features at no cost. Free plans are subject to feature limitations as
              described on our pricing page.
            </p>
            <p>
              <strong className="text-gray-900">Pro Plan:</strong> Available for $7.99/month,
              providing access to all premium features including unlimited email accounts,
              advanced analytics, CSV export, and priority support. Pro subscriptions are billed
              monthly through Stripe.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">5. Payments and Billing</h2>
            <p>
              Pro subscriptions are billed in advance on a monthly basis. All payments are
              processed securely through Stripe. You can cancel your subscription at any time
              from your Settings page. Upon cancellation, you will retain Pro access until the
              end of your current billing period. We do not offer refunds for partial billing periods.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">6. Email Access and Permissions</h2>
            <p>
              Snipcat requests read-only access to your Gmail account to scan for
              subscription-related emails. We only access email content necessary to identify
              and categorize subscriptions. You can revoke this access at any time through your
              Google account settings or within Snipcat.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">7. Acceptable Use</h2>
            <p>You agree not to:</p>
            <p className="ml-4 mt-2">
              — Use the service for any unlawful purpose<br />
              — Attempt to gain unauthorized access to our systems<br />
              — Interfere with or disrupt the service<br />
              — Scrape, crawl, or use automated tools to extract data<br />
              — Resell or redistribute the service without permission<br />
              — Upload malicious content or code
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">8. Intellectual Property</h2>
            <p>
              The Snipcat service, including its design, logo, code, and content, is owned by
              Snipcat and protected by intellectual property laws. Your subscription data belongs
              to you — we claim no ownership over it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">9. Limitation of Liability</h2>
            <p>
              Snipcat is provided "as is" without warranties of any kind. We are not responsible
              for any missed renewal dates, incorrect subscription data, or financial losses
              resulting from the use of our service. Our total liability is limited to the amount
              you have paid us in the last 12 months.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">10. Service Availability</h2>
            <p>
              We strive to maintain high availability but do not guarantee uninterrupted service.
              We may temporarily suspend the service for maintenance, updates, or other operational
              reasons. We will make reasonable efforts to provide advance notice of planned downtime.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">11. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account if you violate these
              Terms. You may delete your account at any time. Upon termination, your data will
              be deleted in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">12. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify users of material
              changes via email or through the service. Continued use of the service after
              changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">13. Governing Law</h2>
            <p>
              These Terms shall be governed by the laws of the Province of Ontario, Canada,
              without regard to conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">14. Contact Us</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us at{' '}
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
