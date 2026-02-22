'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import PublicPageLayout from '@/components/PublicPageLayout'

const sections = [
  { title: '1. What are cookies', content: 'Cookies are small text files stored on your device when you visit a website. They help the site remember your preferences, keep you logged in, and understand how the site is used. We use cookies and similar technologies (e.g. local storage) to provide and improve Kalpix Games and our website.' },
  { title: '2. How we use cookies', content: 'We use cookies to: (a) keep you signed in to Kalpix Games (e.g. session and authentication cookies); (b) remember your preferences and settings; (c) understand how our services are used (analytics) so we can improve them; (d) protect against fraud and abuse; and (e) comply with legal or regulatory requirements.' },
  { title: '3. Types of cookies we use', content: 'Strictly necessary cookies: required for the service to work (e.g. login session). Functional cookies: remember choices you make. Analytics cookies: help us see how visitors use our site (we may use first-party or trusted third-party tools). We do not use cookies for third-party advertising on our main gaming platform without your consent where required by law.' },
  { title: '4. Your choices', content: 'Most browsers let you block or delete cookies via settings. Blocking strictly necessary cookies may prevent you from using parts of Kalpix Games (e.g. staying logged in). You can also opt out of non-essential cookies where we offer that option. For more on your privacy rights, see our Privacy Policy.' },
  { title: '5. Updates', content: 'We may update this Cookie Policy from time to time to reflect changes in our practices or the law. We will post the updated version on this page. Continued use of our services after changes constitutes acceptance.' },
]

export default function CookiesPage() {
  return (
    <PublicPageLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Cookie Policy
          </h1>
          <p className="text-gray-400 mb-2">Last updated: December 2025</p>
          <p className="text-gray-400 mb-12">
            This Cookie Policy explains how Kalpix Software Private Limited uses cookies and similar technologies when you use Kalpix Games and our website.
          </p>

          <div className="space-y-8">
            {sections.map((s, i) => (
              <section key={i} className="rounded-2xl bg-slate-800/50 border border-slate-700 p-6">
                <h2 className="text-xl font-semibold text-white mb-3">{s.title}</h2>
                <p className="text-gray-400 leading-relaxed">{s.content}</p>
              </section>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link href="/" className="text-blue-400 hover:text-blue-300 transition-colors">← Back to home</Link>
          </div>
        </motion.div>
      </div>
    </PublicPageLayout>
  )
}
