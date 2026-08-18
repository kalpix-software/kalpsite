import Link from 'next/link'
import PublicPageLayout from '@/components/PublicPageLayout'
import FadeIn from '@/components/FadeIn'
import {
  AlertTriangle,
  Building2,
  LifeBuoy,
  Mail,
  MapPin,
  Phone,
  Scale,
  ScrollText,
  ShieldCheck,
} from 'lucide-react'
import {
  APP,
  COMPANY,
  CONTACTS,
  DATA_PROTECTION_CONTACT,
  GRIEVANCE_OFFICER,
  SLA,
  pendingDisclosures,
} from '@/lib/company'

const cardClass =
  'rounded-2xl bg-slate-800/50 border border-slate-700 p-6 md:p-8'

export default function ContactPage() {
  const pending = pendingDisclosures()

  return (
    <PublicPageLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Contact Us
          </h1>
          <p className="text-gray-400 text-lg mb-12">
            Who we are, and the right address for whatever you need. Pick the
            route that matches your question and you will get a faster answer.
          </p>

          {pending.length > 0 && (
            <div className="mb-10 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-100">
                <p className="font-semibold mb-1">
                  This page is not ready to publish.
                </p>
                <p>
                  These statutory disclosures are still placeholders:{' '}
                  {pending.join(', ')}. Fill them in{' '}
                  <code className="text-amber-200">lib/company.ts</code> before
                  the site goes live.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-8">
            <section className={cardClass}>
              <div className="flex items-center gap-3 mb-4">
                <Building2 className="w-8 h-8 text-blue-400" />
                <h2 className="text-xl font-semibold text-white">
                  Legal entity
                </h2>
              </div>
              <p className="text-gray-300 text-lg font-medium">
                {COMPANY.legalName}
              </p>
              <p className="text-gray-400 mt-2">
                A private limited company registered in India. It owns and
                operates {APP.name}.
              </p>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex flex-wrap gap-x-3">
                  <dt className="text-gray-400 w-40 shrink-0">
                    Corporate Identity Number
                  </dt>
                  <dd className="text-gray-200 font-mono break-all">
                    {COMPANY.cin}
                  </dd>
                </div>
                <div className="flex flex-wrap gap-x-3">
                  <dt className="text-gray-400 w-40 shrink-0">GSTIN</dt>
                  <dd className="text-gray-200 font-mono break-all">
                    {COMPANY.gstin}
                  </dd>
                </div>
                <div className="flex flex-wrap gap-x-3">
                  <dt className="text-gray-400 w-40 shrink-0">Website</dt>
                  <dd>
                    <a
                      href={COMPANY.website}
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {COMPANY.websiteLabel}
                    </a>
                  </dd>
                </div>
              </dl>
            </section>

            <section className={cardClass}>
              <div className="flex items-center gap-3 mb-4">
                <MapPin className="w-8 h-8 text-amber-400" />
                <h2 className="text-xl font-semibold text-white">
                  Registered office
                </h2>
              </div>
              <address className="not-italic text-gray-300 leading-relaxed">
                {COMPANY.registeredOffice.lines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
              <p className="text-gray-400 mt-3 text-sm">
                This is also the address for service of any legal notice.
              </p>
            </section>

            <section className={cardClass}>
              <div className="flex items-center gap-3 mb-4">
                <Phone className="w-8 h-8 text-emerald-400" />
                <h2 className="text-xl font-semibold text-white">
                  Customer care
                </h2>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Published as required by the Consumer Protection (E-Commerce)
                Rules, 2020.
              </p>
              <dl className="space-y-3">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <dt className="text-gray-400 w-28 shrink-0 text-sm">
                    Telephone
                  </dt>
                  <dd className="text-gray-200 font-mono break-all">
                    {COMPANY.phone}
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <dt className="text-gray-400 w-28 shrink-0 text-sm">Email</dt>
                  <dd>
                    <a
                      href={`mailto:${CONTACTS.support}`}
                      className="text-blue-400 hover:text-blue-300 transition-colors break-all"
                    >
                      {CONTACTS.support}
                    </a>
                  </dd>
                </div>
              </dl>
            </section>

            <section className={cardClass}>
              <div className="flex items-center gap-3 mb-4">
                <LifeBuoy className="w-8 h-8 text-green-400" />
                <h2 className="text-xl font-semibold text-white">
                  Support (accounts, purchases, gameplay)
                </h2>
              </div>
              <a
                href={`mailto:${CONTACTS.support}`}
                className="text-blue-400 hover:text-blue-300 text-lg transition-colors break-all"
              >
                {CONTACTS.support}
              </a>
              <p className="text-gray-400 mt-2">
                We aim to respond within {SLA.supportResponse}. Include your
                username, and the order ID if it is about a purchase. Common
                questions are already answered on the{' '}
                <Link
                  href="/help"
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  help page
                </Link>
                .
              </p>
            </section>

            <section className={cardClass}>
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="w-8 h-8 text-purple-400" />
                <h2 className="text-xl font-semibold text-white">
                  Privacy and data protection
                </h2>
              </div>
              <a
                href={`mailto:${DATA_PROTECTION_CONTACT.email}`}
                className="text-blue-400 hover:text-blue-300 text-lg transition-colors break-all"
              >
                {DATA_PROTECTION_CONTACT.email}
              </a>
              <p className="text-gray-400 mt-2">
                {DATA_PROTECTION_CONTACT.name},{' '}
                {DATA_PROTECTION_CONTACT.designation}. Use this address to
                access, correct or erase your personal data, or to ask how we
                handle it. See the{' '}
                <Link
                  href="/privacy"
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  privacy policy
                </Link>
                .
              </p>
            </section>

            <section className={cardClass}>
              <div className="flex items-center gap-3 mb-4">
                <ScrollText className="w-8 h-8 text-rose-400" />
                <h2 className="text-xl font-semibold text-white">
                  Grievances and complaints
                </h2>
              </div>
              <a
                href={`mailto:${GRIEVANCE_OFFICER.email}`}
                className="text-blue-400 hover:text-blue-300 text-lg transition-colors break-all"
              >
                {GRIEVANCE_OFFICER.email}
              </a>
              <p className="text-gray-400 mt-2">
                {GRIEVANCE_OFFICER.name}, {GRIEVANCE_OFFICER.designation},
                appointed under the IT (Intermediary Guidelines and Digital
                Media Ethics Code) Rules, 2021. We acknowledge complaints within{' '}
                {SLA.grievanceAcknowledgement} and resolve them within{' '}
                {SLA.grievanceResolution}. Full process on the{' '}
                <Link
                  href="/grievance"
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  grievance page
                </Link>
                .
              </p>
            </section>

            <section className={cardClass}>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-8 h-8 text-red-400" />
                <h2 className="text-xl font-semibold text-white">
                  Urgent safety reports
                </h2>
              </div>
              <a
                href={`mailto:${CONTACTS.childSafety}`}
                className="text-blue-400 hover:text-blue-300 text-lg transition-colors break-all"
              >
                {CONTACTS.childSafety}
              </a>
              <p className="text-gray-400 mt-2">
                Child sexual abuse material, threats to someone&apos;s life, or
                non-consensual intimate imagery. Handled ahead of everything
                else. See the{' '}
                <Link
                  href="/child-safety"
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  child safety page
                </Link>
                . If someone is in immediate danger, contact your local
                emergency services first.
              </p>
            </section>

            <section className={cardClass}>
              <div className="flex items-center gap-3 mb-4">
                <Scale className="w-8 h-8 text-cyan-400" />
                <h2 className="text-xl font-semibold text-white">
                  Law enforcement and legal notices
                </h2>
              </div>
              <a
                href={`mailto:${CONTACTS.legal}`}
                className="text-blue-400 hover:text-blue-300 text-lg transition-colors break-all"
              >
                {CONTACTS.legal}
              </a>
              <p className="text-gray-400 mt-2">
                Requests for user information, preservation requests and content
                removal orders. Please send the request on official letterhead
                and cite the legal authority you are acting under. Security
                researchers reporting a vulnerability should write to{' '}
                <a
                  href={`mailto:${CONTACTS.security}`}
                  className="text-blue-400 hover:text-blue-300 transition-colors break-all"
                >
                  {CONTACTS.security}
                </a>{' '}
                instead.
              </p>
            </section>

            <section className={cardClass}>
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-8 h-8 text-blue-400" />
                <h2 className="text-xl font-semibold text-white">
                  Everything else
                </h2>
              </div>
              <a
                href={`mailto:${CONTACTS.general}`}
                className="text-blue-400 hover:text-blue-300 text-lg transition-colors break-all"
              >
                {CONTACTS.general}
              </a>
              <p className="text-gray-400 mt-2">
                Business, press and partnership enquiries.
              </p>
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
        </FadeIn>
      </div>
    </PublicPageLayout>
  )
}
