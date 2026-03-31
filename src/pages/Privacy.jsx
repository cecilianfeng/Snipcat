import { Link } from 'react-router-dom'

export default function Privacy() {
  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center">
          <Link to="/" className="flex items-center gap-2 font-bold text-gray-900 hover:opacity-80 transition-opacity">
            <img src="/snipcat-logo.png" alt="Snipcat" className="w-7 h-7 object-contain" /> Snipcat
          </Link>
        </div>
      </header>

      {/* Iframe fills remaining height */}
      <iframe
        src="https://app.termly.io/policy-viewer/policy.html?policyUUID=8e8fdf26-b031-4da2-befc-909f6aea24de"
        title="Privacy Policy"
        className="flex-1 w-full border-0"
      />
    </div>
  )
}
