'use client'

import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import {
  Users,
  Trophy,
  MessageCircle,
  Zap,
  Shield,
  Globe,
  Gamepad2,
  Sparkles,
} from 'lucide-react'

const features = [
  {
    icon: Users,
    title: 'Social Connect',
    description: 'Connect with friends, join communities, and build your gaming network.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Trophy,
    title: 'Competitive Play',
    description: 'Climb leaderboards, earn achievements, and prove your skills.',
    color: 'from-yellow-500 to-orange-500',
  },
  {
    icon: MessageCircle,
    title: 'Real-time Chat',
    description: 'Chat with friends during games and stay connected always.',
    color: 'from-green-500 to-emerald-500',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Ultra-low latency gaming experience powered by cutting-edge technology.',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: Shield,
    title: 'Secure & Safe',
    description: 'Your data and privacy are protected with enterprise-grade security.',
    color: 'from-red-500 to-rose-500',
  },
  {
    icon: Globe,
    title: 'Global Reach',
    description: 'Play with gamers from around the world, anytime, anywhere.',
    color: 'from-indigo-500 to-blue-500',
  },
  {
    icon: Gamepad2,
    title: 'Diverse Games',
    description: 'Access a wide variety of games from casual to competitive.',
    color: 'from-pink-500 to-rose-500',
  },
  {
    icon: Sparkles,
    title: 'Customizable',
    description: 'Personalize your profile, avatars, and gaming experience.',
    color: 'from-cyan-500 to-blue-500',
  },
]

export default function Features() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: 'easeOut',
      },
    },
  }

  return (
    <section
      id="features"
      ref={ref}
      className="relative py-32 px-4 sm:px-6 lg:px-8 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Powerful Features
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Everything you need for the ultimate social gaming experience
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
        >
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={index}
                variants={itemVariants}
                className="group relative p-6 rounded-2xl bg-slate-800/50 backdrop-blur-sm border border-slate-700 hover:border-slate-600 transition-all"
                whileHover={{ y: -10, scale: 1.02 }}
              >
                {/* Gradient Background on Hover */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300`}
                />

                {/* Icon */}
                <div className="relative z-10 mb-4">
                  <div
                    className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-lg`}
                  >
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                </div>

                {/* Content */}
                <div className="relative z-10">
                  <h3 className="text-xl font-bold mb-2 text-white group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-purple-400 group-hover:bg-clip-text transition-all">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                {/* Shine Effect */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
