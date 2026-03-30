import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

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

export default function Terms() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-gray-900">
            <CatLogo size={28} /> Snipcat
          </div>
          <Link
            to="/"
            className="text-sm text-gray-500 hover:text-[#F97316] transition-colors"
          >
            &larr; Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">TERMS OF SERVICE</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: March 30, 2026</p>

        <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed space-y-8">

          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Agreement to Terms</h2>
            <p>
              These Terms of Service ("Terms") constitute a legally binding agreement between you and <strong>Snipcat</strong>
              ("Company," "we," "us," or "our"), governing your access
              to and use of the Snipcat website located at{' '}
              <a href="https://www.snipcat.app" className="text-[#F97316] hover:underline">https://www.snipcat.app</a>{' '}
              and its associated SaaS platform (collectively, the "Service").
            </p>
            <p className="mt-3">
              By accessing or using the Service, you confirm that you are at least 18 years of age, that you have
              read and understood these Terms, and that you agree to be bound by them. If you do not agree to these
              Terms, you must not access or use the Service.
            </p>
            <p className="mt-3">
              Snipcat is an AI-powered subscription management tool that helps users track, manage, and cancel
              their recurring subscriptions. It connects to users' Gmail accounts (read-only access) to
              automatically detect subscription-related emails and identify active subscriptions, renewal dates,
              and costs.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. User Accounts</h2>
            <p>
              To access the Service, you must register for an account. You agree to provide accurate, current,
              and complete information during registration and to keep your account information up to date.
            </p>
            <p className="mt-3">
              You are solely responsible for maintaining the confidentiality of your account credentials and for
              all activities that occur under your account. You must notify us immediately at{' '}
              <a href="mailto:hellosnipcat@gmail.com" className="text-[#F97316] hover:underline">hellosnipcat@gmail.com</a>{' '}
              if you suspect any unauthorized use of your account.
            </p>
            <p className="mt-3">
              Accounts are for personal use only. You may not transfer, sell, or assign your account to any other
              person or entity. We reserve the right to terminate accounts that violate these Terms.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Subscriptions &amp; Payments</h2>
            <p>
              Access to Snipcat requires a paid subscription. Subscriptions are billed on a monthly basis and
              automatically renew at the end of each billing cycle unless cancelled. There is no free trial period.
            </p>
            <p className="mt-3">
              We accept the following payment methods: Visa, Mastercard, American Express, and Discover. All
              charges are in United States Dollars (USD).
            </p>
            <p className="mt-3">
              <strong>No Refunds.</strong> All fees paid are non-refundable. If you wish to cancel your
              subscription, you must contact customer service at{' '}
              <a href="mailto:hellosnipcat@gmail.com" className="text-[#F97316] hover:underline">hellosnipcat@gmail.com</a>.
              Cancellation will take effect at the end of the current billing period; you will retain access to
              the Service until that date.
            </p>
            <p className="mt-3">
              We reserve the right to change our pricing at any time. Price changes will be communicated to you
              via email at least 30 days before they take effect.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Prohibited Activities</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Use the Service for any unlawful purpose or in violation of any applicable laws or regulations.</li>
              <li>Use the Service to advertise, promote, or sell products or services to other users.</li>
              <li>Transfer, sell, or assign your account or profile to any third party.</li>
              <li>Attempt to gain unauthorized access to any portion of the Service or its related systems.</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service.</li>
              <li>Interfere with or disrupt the integrity or performance of the Service.</li>
              <li>Collect or harvest any personally identifiable information from the Service.</li>
              <li>Use any automated means (bots, scrapers, etc.) to access the Service without our prior written consent.</li>
              <li>Impersonate any person or entity or misrepresent your affiliation with any person or entity.</li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Intellectual Property</h2>
            <p>
              The Service and its original content, features, and functionality are and will remain the exclusive
              property of Snipcat and its licensors. Our trademarks, service
              marks, logos, and trade names may not be used in connection with any product or service without our
              prior written consent.
            </p>
            <p className="mt-3">
              By connecting your Gmail account to the Service, you grant us a limited, non-exclusive, read-only
              license to access your email data solely for the purpose of providing the subscription detection and
              management features of the Service. We do not store the content of your emails beyond what is
              necessary to deliver the Service.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Third-Party Links</h2>
            <p>
              The Service may contain links to third-party websites or services that are not owned or controlled
              by Snipcat. We have no control over, and assume no responsibility for, the content, privacy
              policies, or practices of any third-party websites or services.
            </p>
            <p className="mt-3">
              We strongly advise you to read the terms and privacy policies of any third-party websites you visit.
              Your interactions with third-party websites are solely between you and that third party.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT ANY WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE
              UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Limitation of Liability</h2>
            <p>
              TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL SNIPCAT, ITS OFFICERS,
              DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
              OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE.
            </p>
            <p className="mt-3">
              IN ALL CASES, OUR TOTAL CUMULATIVE LIABILITY TO YOU FOR ANY CLAIMS ARISING OUT OF OR RELATED TO
              THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE TOTAL AMOUNT YOU PAID TO SNIPCAT IN THE SIX (6)
              MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
            </p>
            <p className="mt-3">
              ANY CLAIM YOU MAY HAVE ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE MUST BE COMMENCED
              WITHIN SIX (6) MONTHS AFTER THE CAUSE OF ACTION ACCRUES; OTHERWISE, SUCH CLAIM IS PERMANENTLY
              BARRED.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Dispute Resolution</h2>
            <p>
              <strong>Informal Negotiations.</strong> Before initiating any formal dispute proceedings, you agree
              to first attempt to resolve any dispute informally by contacting us at{' '}
              <a href="mailto:hellosnipcat@gmail.com" className="text-[#F97316] hover:underline">hellosnipcat@gmail.com</a>.
              We will attempt to resolve the dispute informally within thirty (30) days of receiving notice.
            </p>
            <p className="mt-3">
              <strong>Binding Arbitration.</strong> If the dispute is not resolved through informal negotiations,
              you agree that any dispute, claim, or controversy arising out of or relating to these Terms or the
              Service shall be resolved by binding arbitration rather than in court, except that you may assert
              claims in small claims court if your claims qualify.
            </p>
            <p className="mt-3">
              <strong>No Class Actions.</strong> You agree to bring disputes only in your individual capacity
              and not as a plaintiff or class member in any purported class or representative proceeding.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the Province of
              Ontario and the federal laws of Canada applicable therein, without regard to conflict of law
              principles. Any legal proceedings not subject to the arbitration clause above shall be brought
              exclusively in the courts located in Ontario, Canada.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Privacy Policy</h2>
            <p>
              Your use of the Service is also governed by our Privacy Policy, which is incorporated into these
              Terms by reference. Please review our Privacy Policy at{' '}
              <a href="https://www.snipcat.app/privacy" className="text-[#F97316] hover:underline">https://www.snipcat.app/privacy</a>{' '}
              to understand our practices regarding the collection and use of your personal information.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. When we make material changes, we will
              notify you by sending an email to the address associated with your account at{' '}
              <a href="mailto:hellosnipcat@gmail.com" className="text-[#F97316] hover:underline">hellosnipcat@gmail.com</a>.
              Your continued use of the Service after the effective date of the revised Terms constitutes your
              acceptance of the changes.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Contact Information</h2>
            <p>If you have any questions about these Terms, please contact us:</p>
            <address className="mt-3 not-italic text-gray-600">
              <strong>Snipcat</strong><br />
              <a href="mailto:hellosnipcat@gmail.com" className="text-[#F97316] hover:underline">hellosnipcat@gmail.com</a>
            </address>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-6 mt-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center text-sm text-gray-400">
          &copy; 2026 Snipcat. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
