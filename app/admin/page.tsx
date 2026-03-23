'use client';

import Link from 'next/link';
import {
  Store, RefreshCw, BarChart3, Package,
  CalendarCheck, Tag, Swords, Trophy, Gift, Users,
} from 'lucide-react';

const cards = [
  { href: '/admin/store', icon: Store, title: 'Store Items', desc: 'Manage catalog across all 3 upgrade domains', color: 'text-indigo-400' },
  { href: '/admin/bundles', icon: Package, title: 'Bundles', desc: 'Create discounted item packs', color: 'text-indigo-400' },
  { href: '/admin/sync', icon: RefreshCw, title: 'Avatars', desc: 'Sync avatar catalogs and pricing', color: 'text-indigo-400' },
  { href: '/admin/rewards', icon: CalendarCheck, title: 'Daily Rewards', desc: 'Configure login reward tiers and view streaks', color: 'text-emerald-400' },
  { href: '/admin/deals', icon: Tag, title: 'Deals', desc: 'Create daily/weekly discounted deals', color: 'text-emerald-400' },
  { href: '/admin/battlepass', icon: Swords, title: 'Battle Pass', desc: 'Manage seasons, tiers, and XP rewards', color: 'text-emerald-400' },
  { href: '/admin/achievements', icon: Trophy, title: 'Achievements', desc: 'Track milestones and reward players', color: 'text-amber-400' },
  { href: '/admin/gifts', icon: Gift, title: 'Gifts', desc: 'Monitor gifting activity between users', color: 'text-amber-400' },
  { href: '/admin/users', icon: Users, title: 'Users', desc: 'Look up users, manage wallets', color: 'text-amber-400' },
  { href: '/admin/stats', icon: BarChart3, title: 'Stats', desc: 'Revenue, purchases, and top items', color: 'text-purple-400' },
];

export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-2">Dashboard</h1>
      <p className="text-sm text-slate-400 mb-6">Manage your store across Avatar, Game, and Chat upgrade domains.</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ href, icon: Icon, title, desc, color }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 p-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-indigo-500 transition"
          >
            <Icon className={`w-8 h-8 shrink-0 ${color}`} />
            <div>
              <h2 className="font-medium text-slate-100">{title}</h2>
              <p className="text-sm text-slate-400">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-600/20 to-indigo-900/20 border border-indigo-500/30">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-1">Avatar Upgrades</h3>
          <p className="text-sm text-slate-400">Profile frames, avatar customizations, Spine 2D characters</p>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-600/20 to-emerald-900/20 border border-emerald-500/30">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-300 mb-1">Game Upgrades</h3>
          <p className="text-sm text-slate-400">UNO card backs, card faces, backgrounds, emotes, win effects</p>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-purple-600/20 to-purple-900/20 border border-purple-500/30">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-purple-300 mb-1">Chat Upgrades</h3>
          <p className="text-sm text-slate-400">Bubbles, wallpapers, themes, fonts, stickers, emotes</p>
        </div>
      </div>
    </div>
  );
}
