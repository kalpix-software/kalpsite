'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { WalletCards, Puzzle } from 'lucide-react'

const games = [
  {
    id: 'tero',
    icon: WalletCards,
    image: '/tero_card_game.png',
    title: 'Tero Card',
    tagline: 'UNO reimagined',
    color: 'from-amber-500 to-orange-500',
    description: 'A fast-paced card game that takes the best of classic UNO and makes it uniquely yours. Play with friends in real time with smooth, responsive gameplay.',
    highlights: [
      'Multiple Tero card decks — collect and play with different themed decks so every round feels fresh.',
      'Animated backgrounds — choose from a variety of dynamic themes that bring the table to life.',
      'Real-time multiplayer — drop cards, stack +2s, and call UNO with friends across the globe.',
      'Built for social play — chat, react, and compete on leaderboards without leaving the game.',
    ],
  },
  {
    id: 'puzzle',
    icon: Puzzle,
    image: '/puzzle_master.png',
    title: 'Puzzle Master',
    tagline: 'Race to solve',
    color: 'from-emerald-500 to-teal-500',
    description: 'A competitive puzzle arena where players race to solve challenges. First to finish wins — but every puzzle type keeps you on your toes.',
    highlights: [
      'Multiple puzzle types — spot the difference, find hidden objects, logic puzzles, and quick maths challenges.',
      'Head-to-head races — go head-to-head with friends or match with players of similar skill.',
      'Short, sharp rounds — perfect for quick sessions: solve fast, climb the ranks, and unlock new challenge sets.',
      'Something for everyone — from observation and pattern games to number puzzles and mini brain teasers.',
    ],
  },
]

export default function Games() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 })

  return (
    <section
      id="games"
      ref={ref}
      className="relative py-32 px-4 sm:px-6 lg:px-8 overflow-hidden"
    >
      <motion.div
        className="text-center mb-20"
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Our Games
        </h2>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Two ways to play, connect, and compete — with more on the way.
        </p>
      </motion.div>

      <div className="max-w-6xl mx-auto space-y-16">
        {games.map((game, index) => {
          const Icon = game.icon
          return (
            <motion.article
              key={game.id}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              className="rounded-2xl bg-slate-800/50 backdrop-blur-sm border border-slate-700 overflow-hidden hover:border-slate-600 transition-all"
            >
              <div className="flex flex-col md:flex-row">
                <div className="relative w-full md:w-2/5 min-h-[220px] md:min-h-0 md:aspect-[4/3] bg-slate-900/50 flex items-center justify-center">
                  <Image
                    src={game.image}
                    alt={game.title}
                    fill
                    className="object-contain object-center"
                    sizes="(max-width: 768px) 100vw, 40vw"
                    priority={index === 0}
                  />
                </div>
                <div className="p-8 md:p-10 flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center shadow-lg`}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-400">{game.tagline}</p>
                      <h3 className="text-2xl font-bold text-white">{game.title}</h3>
                    </div>
                  </div>
                  <p className="text-gray-300 leading-relaxed mb-6">
                    {game.description}
                  </p>
                  <ul className="space-y-2">
                    {game.highlights.map((item, i) => (
                      <li key={i} className="flex gap-3 text-gray-400 text-sm">
                        <span className="text-slate-500 mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.article>
          )
        })}
      </div>
    </section>
  )
}
