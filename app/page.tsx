'use client'

import { useEffect } from 'react'
import Navigation from '@/components/Navigation'
import Hero from '@/components/Hero'
import Features from '@/components/Features'
import Games from '@/components/Games'
import AppShowcase from '@/components/AppShowcase'
import About from '@/components/About'
import Stats from '@/components/Stats'
import CTA from '@/components/CTA'
import Footer from '@/components/Footer'
import ParticleBackground from '@/components/ParticleBackground'

export default function Home() {
  // Scroll to `#features`, `#showcase`, etc. after paint and on in-page hash changes.
  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash
      if (!hash || hash.length < 2) return
      const id = hash.slice(1)
      window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 80)
    }
    scrollToHash()
    window.addEventListener('hashchange', scrollToHash)
    return () => window.removeEventListener('hashchange', scrollToHash)
  }, [])

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <ParticleBackground />
      <Navigation />
      <Hero />
      <Features />
      <Games />
      <AppShowcase />
      <Stats />
      <About />
      <CTA />
      <Footer />
    </main>
  )
}
