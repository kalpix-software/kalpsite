'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import PublicPageLayout from '@/components/PublicPageLayout'

const SECTIONS = [
  ['1. Who we are', 'This Privacy Policy applies to Kalpix Games operated by Kalpix Software Private Limited, a company incorporated in India. Registered office: C/O, SUKKHOO PRASAD, O VILL PO, SUNDERPUR, Khojwa Bazar, Varanasi, Varanasi- 221010, Uttar Pradesh, India. Contact: contact@kalpixgames.com.'],
  ['2. Information we collect', 'We may collect account and profile information (e.g. email, username), device and technical data (e.g. device ID, platform, IP) for authentication, game play and usage data, and communications when you contact us.'],
  ['3. How we use it', 'We use your information to provide and improve Kalpix Games, authenticate you, communicate, enforce our terms, and comply with law. We do not sell your personal data.'],
  ['4. Data sharing', 'We may share data with service providers who assist in operating our platform, under confidentiality. We may disclose information where required by law or to protect rights and safety.'],
  ['5. Security and retention', 'We retain data as long as needed for the service and legal obligations. We implement measures to protect your data against unauthorised access or misuse.'],
  ['6. Your rights', 'You may have rights to access, correct, delete, or port your data. Contact contact@kalpixgames.com. You may lodge a complaint with a supervisory authority.'],
  ['7. Children', 'Our services are not directed at children under the age required by law. We do not knowingly collect their data. Contact us to request deletion if applicable.'],
  ['8. Changes', 'We may update this policy. The updated version will be posted here. Continued use constitutes acceptance.'],
]

export default function PrivacyPage() {
  return (
    <PublicPageLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Privacy Policy</h1>
          <p className="text-gray-400 mb-2">Last updated: December 2025</p>
          <p className="text-gray-400 mb-12">Kalpix Software Private Limited is committed to protecting your privacy when you use Kalpix Games.</p>
          <div className="space-y-8">
            {SECTIONS.map(([title, content], i) => (
              <section key={i} className="rounded-2xl bg-slate-800/50 border border-slate-700 p-6">
                <h2 className="text-xl font-semibold text-white mb-3">{title}</h2>
                <p className="text-gray-400 leading-relaxed">{content}</p>
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
