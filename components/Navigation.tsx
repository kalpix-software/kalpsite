'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import ComingSoonModal from '@/components/ComingSoonModal'

export default function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showComingSoon, setShowComingSoon] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const pathname = usePathname() ?? ''
  const isHome = pathname === '/'
  const navItems = [
    { name: 'Home', href: '/' },
    { name: 'Features', href: isHome ? '#features' : '/#features' },
    { name: 'Spaces', href: isHome ? '#games' : '/#games' },
    { name: 'App', href: isHome ? '#showcase' : '/#showcase' },
    { name: 'About', href: '/about' },
    { name: 'Contact', href: '/contact' },
  ]

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-slate-900/80 backdrop-blur-md shadow-lg'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <motion.span
              className="flex items-center space-x-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-slate-900/70 border border-slate-700/60">
                <Image
                  src="/kalpix_logo_cropped.jpeg"
                  alt="Kalpix Software logo"
                  fill
                  sizes="36px"
                  className="object-contain"
                />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Kalpix
              </span>
            </motion.span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item, index) => (
              <Link key={item.name} href={item.href}>
                <motion.span
                  className="text-gray-300 hover:text-white transition-colors relative group block"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -2 }}
                >
                  {item.name}
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 group-hover:w-full transition-all duration-300" />
                </motion.span>
              </Link>
            ))}
            <Link href="/admin/login">
              <motion.span
                className="text-sm text-slate-500 hover:text-slate-400 transition-colors mr-4"
                whileHover={{ opacity: 1 }}
              >
                Admin
              </motion.span>
            </Link>
            <motion.button
              onClick={() => setShowComingSoon(true)}
              className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full text-white font-semibold hover:shadow-lg hover:shadow-blue-500/50 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Get Started
            </motion.button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-gray-300 hover:text-white transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-slate-900/95 backdrop-blur-md border-t border-slate-800"
          >
            <div className="px-4 py-4 space-y-4">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="block text-gray-300 hover:text-white transition-colors py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <Link
                href="/admin/login"
                className="block text-slate-500 hover:text-white py-2 text-sm"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Admin
              </Link>
              <button
                onClick={() => { setShowComingSoon(true); setIsMobileMenuOpen(false) }}
                className="w-full px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full text-white font-semibold"
              >
                Get Started
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ComingSoonModal open={showComingSoon} onClose={() => setShowComingSoon(false)} />
    </motion.nav>
  )
}
