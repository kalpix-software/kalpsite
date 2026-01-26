'use client'

import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { useCountUp } from '@/hooks/useCountUp'

const stats = [
  { value: 10000, suffix: '+', label: 'Active Players', duration: 2 },
  { value: 50, suffix: '+', label: 'Games Available', duration: 2 },
  { value: 1000000, suffix: '+', label: 'Matches Played', duration: 2.5 },
  { value: 99, suffix: '%', label: 'Uptime', duration: 2 },
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
          {stats.map((stat, index) => (
            <StatCard key={index} stat={stat} inView={inView} delay={index * 0.1} />
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function StatCard({
  stat,
  inView,
  delay,
}: {
  stat: typeof stats[0]
  inView: boolean
  delay: number
}) {
  const count = useCountUp(stat.value, inView, stat.duration)

  return (
    <motion.div
      className="text-center p-6 rounded-2xl bg-slate-800/30 backdrop-blur-sm border border-slate-700/50"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ scale: 1.05, y: -5 }}
    >
      <div className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
        {count.toLocaleString()}
        {stat.suffix}
      </div>
      <div className="text-gray-400 text-sm md:text-base">{stat.label}</div>
    </motion.div>
  )
}
