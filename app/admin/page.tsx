'use client';

import Link from 'next/link';
import { Store, RefreshCw, BarChart3, Package } from 'lucide-react';

export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-3xl">
        <Link
          href="/admin/store"
          className="flex items-center gap-3 p-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-indigo-500 transition"
        >
          <Store className="w-8 h-8 text-indigo-400" />
          <div>
            <h2 className="font-medium text-slate-100">Store Items</h2>
            <p className="text-sm text-slate-400">Manage catalog, prices, add items</p>
          </div>
        </Link>
        <Link
          href="/admin/stats"
          className="flex items-center gap-3 p-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-indigo-500 transition"
        >
          <BarChart3 className="w-8 h-8 text-indigo-400" />
          <div>
            <h2 className="font-medium text-slate-100">Purchase Stats</h2>
            <p className="text-sm text-slate-400">Sales data, top items, revenue</p>
          </div>
        </Link>
        <Link
          href="/admin/bundles"
          className="flex items-center gap-3 p-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-indigo-500 transition"
        >
          <Package className="w-8 h-8 text-indigo-400" />
          <div>
            <h2 className="font-medium text-slate-100">Bundles</h2>
            <p className="text-sm text-slate-400">Create discounted item packs</p>
          </div>
        </Link>
        <Link
          href="/admin/sync"
          className="flex items-center gap-3 p-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-indigo-500 transition"
        >
          <RefreshCw className="w-8 h-8 text-indigo-400" />
          <div>
            <h2 className="font-medium text-slate-100">Sync</h2>
            <p className="text-sm text-slate-400">Sync avatars and store items</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
