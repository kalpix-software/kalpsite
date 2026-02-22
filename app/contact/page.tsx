'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import PublicPageLayout from '@/components/PublicPageLayout'
import { Mail, MapPin, Building2 } from 'lucide-react'

const company = {
  name: 'Kalpix Software Private Limited',
  email: 'contact@kalpixgames.com',
  address: 'C/O, SUKKHOO PRASAD, O VILL PO, SUNDERPUR, Khojwa Bazar, Varanasi, Varanasi- 221010, Uttar Pradesh, India',
}

export default function ContactPage() {
  return (
    <PublicPageLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Contact Us
          </h1>
          <p className="text-gray-400 text-lg mb-12">
            Get in touch for business inquiries, support, or partnerships.
          </p>

          <div className="space-y-8">
            <section className="rounded-2xl bg-slate-800/50 border border-slate-700 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <Building2 className="w-8 h-8 text-blue-400" />
                <h2 className="text-xl font-semibold text-white">Company</h2>
              </div>
              <p className="text-gray-300">{company.name}</p>
            </section>

            <section className="rounded-2xl bg-slate-800/50 border border-slate-700 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-8 h-8 text-green-400" />
                <h2 className="text-xl font-semibold text-white">Email</h2>
              </div>
              <a
                href={`mailto:${company.email}`}
                className="text-blue-400 hover:text-blue-300 text-lg transition-colors"
              >
                {company.email}
              </a>
              <p className="text-gray-400 mt-2">We aim to respond within 1–2 business days.</p>
            </section>

            <section className="rounded-2xl bg-slate-800/50 border border-slate-700 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <MapPin className="w-8 h-8 text-amber-400" />
                <h2 className="text-xl font-semibold text-white">Registered Office</h2>
              </div>
              <p className="text-gray-300 whitespace-pre-line">{company.address}</p>
            </section>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              ← Back to home
            </Link>
          </div>
        </motion.div>
      </div>
    </PublicPageLayout>
  )
}
