'use client'

import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'

/**
 * What the app actually offers. Deliberately no counts, percentages or
 * uptime figures: nothing here is measured, so nothing here is asserted as a
 * number. Every line must stay true of the shipped app.
 */
const highlights = [
  {
    headline: 'Tero',
    label: 'Card game with two, three and four player tables, plus 2v2 teams',
  },
  {
    headline: 'Chess',
    label: 'Classic one on one chess, with chat at the board',
  },
  {
    headline: 'Chat',
    label: 'Direct messages, groups and lounges with photos, video, GIFs and stickers',
  },
  {
    headline: 'Avatars',
    label: 'Pick an avatar, change its skin and background whenever you like',
  },
]

export default function Stats() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.3,
  })

  return (
    <section
      ref={ref}
      className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden"
    >
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 via-purple-900/20 to-pink-900/20" />

      <div className="relative max-w-7xl mx-auto">
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-8"
          initial={{ opacity: 0, y: 50 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.6 }}
        >
          {highlights.map((highlight, index) => (
            <HighlightCard
              key={highlight.headline}
              highlight={highlight}
              inView={inView}
              delay={index * 0.1}
            />
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function HighlightCard({
  highlight,
  inView,
  delay,
}: {
  highlight: (typeof highlights)[0]
  inView: boolean
  delay: number
}) {
  return (
    <motion.div
      className="text-center p-6 rounded-2xl bg-slate-800/30 backdrop-blur-sm border border-slate-700/50"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ scale: 1.05, y: -5 }}
    >
      <div className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent min-h-[3rem] flex items-center justify-center">
        <span>{highlight.headline}</span>
      </div>
      <div className="text-gray-400 text-sm md:text-base">{highlight.label}</div>
    </motion.div>
  )
}
