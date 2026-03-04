import Link from 'next/link'
import PublicPageLayout from '@/components/PublicPageLayout'
import FadeIn from '@/components/FadeIn'
import { Building2, Calendar, Users, Mail, MapPin, FileCheck } from 'lucide-react'

const company = {
  name: 'Kalpix Software Private Limited',
  incorporated: '4 December 2025',
  directors: ['Dayanidhi Gupta', 'Anchal Gupta'],
  email: 'contact@kalpixgames.com',
  address: 'C/O, SUKKHOO PRASAD, O VILL PO, SUNDERPUR, Khojwa Bazar, Varanasi, Varanasi- 221010, Uttar Pradesh, India',
}

export default function AboutPage() {
  return (
    <PublicPageLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            About Us
          </h1>
          <p className="text-gray-400 text-lg mb-12">
            Kalpix Games is the social gaming platform by Kalpix Software Private Limited.
          </p>

          <div className="space-y-8">
            <section className="rounded-2xl bg-slate-800/50 border border-slate-700 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <Building2 className="w-8 h-8 text-blue-400" />
                <h2 className="text-2xl font-semibold text-white">Company</h2>
              </div>
              <p className="text-gray-300 text-lg font-medium">{company.name}</p>
              <p className="text-gray-400 mt-2">
                A private limited company registered in India. We build and operate Kalpix Games—a social gaming platform where players connect, compete, and enjoy a variety of games.
              </p>
            </section>

            <section className="rounded-2xl bg-slate-800/50 border border-slate-700 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="w-8 h-8 text-purple-400" />
                <h2 className="text-2xl font-semibold text-white">Incorporation</h2>
              </div>
              <p className="text-gray-300">Incorporated on <strong className="text-white">{company.incorporated}</strong>.</p>
              <p className="text-gray-400 mt-2">All company documents and registrations are in order and available as per applicable law.</p>
            </section>

            <section className="rounded-2xl bg-slate-800/50 border border-slate-700 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-8 h-8 text-cyan-400" />
                <h2 className="text-2xl font-semibold text-white">Directors</h2>
              </div>
              <ul className="text-gray-300 space-y-1">
                {company.directors.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl bg-slate-800/50 border border-slate-700 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-8 h-8 text-green-400" />
                <h2 className="text-2xl font-semibold text-white">Contact</h2>
              </div>
              <a href={`mailto:${company.email}`} className="text-blue-400 hover:text-blue-300 transition-colors">{company.email}</a>
              <p className="text-gray-400 mt-2">For business, support, or legal inquiries.</p>
            </section>

            <section className="rounded-2xl bg-slate-800/50 border border-slate-700 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <MapPin className="w-8 h-8 text-amber-400" />
                <h2 className="text-2xl font-semibold text-white">Registered Office</h2>
              </div>
              <p className="text-gray-300 whitespace-pre-line">{company.address}</p>
            </section>

            <section className="relative z-10 rounded-2xl bg-slate-800/50 border border-slate-700 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <FileCheck className="w-8 h-8 text-rose-400" />
                <h2 className="text-2xl font-semibold text-white">Legal</h2>
              </div>
              <p className="text-gray-400 mb-4">We are committed to transparency and compliance. Our terms, privacy policy, and cookie policy are available for your review.</p>
              <div className="flex flex-wrap gap-3">
                <Link href="/terms" className="inline-block px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors cursor-pointer">Terms of Service</Link>
                <Link href="/privacy" className="inline-block px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors cursor-pointer">Privacy Policy</Link>
                <Link href="/cookies" className="inline-block px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors cursor-pointer">Cookie Policy</Link>
              </div>
            </section>
          </div>

          <div className="mt-12 text-center">
            <Link href="/" className="text-blue-400 hover:text-blue-300 transition-colors">← Back to home</Link>
          </div>
        </FadeIn>
      </div>
    </PublicPageLayout>
  )
}
