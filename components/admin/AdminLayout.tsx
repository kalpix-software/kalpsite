'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Store, RefreshCw, LogOut, BarChart3, Package } from 'lucide-react';

const SESSION_URL = '/api/auth/session';
const SESSION_RETRY_MS = 350;

function useSession(enable: boolean) {
  const [auth, setAuth] = useState<boolean | null>(enable ? null : true);

  useEffect(() => {
    if (!enable) return;

    const check = (): Promise<boolean> =>
      fetch(SESSION_URL, { credentials: 'include', cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => d.authenticated === true)
        .catch(() => false);

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    check().then((ok) => {
      if (cancelled) return;
      if (ok) {
        setAuth(true);
        return;
      }
      timeoutId = setTimeout(() => {
        check().then((ok2) => {
          if (!cancelled) setAuth(ok2);
        });
      }, SESSION_RETRY_MS);
    });

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [enable]);

  return auth;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname?.includes('/admin/login');
  const auth = useSession(!isLoginPage);

  useEffect(() => {
    if (auth === false && pathname && !isLoginPage) {
      router.replace('/admin/login');
    }
  }, [auth, pathname, isLoginPage, router]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.replace('/admin/login');
  };

  if (!isLoginPage && auth === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!isLoginPage && auth === false) {
    return null;
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  const nav = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/sync', label: 'Avatars', icon: RefreshCw },
    { href: '/admin/store', label: 'Store Items', icon: Store },
    { href: '/admin/bundles', label: 'Bundles', icon: Package },
    { href: '/admin/stats', label: 'Stats', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen flex bg-slate-900 text-slate-200">
      <aside className="w-56 border-r border-slate-700 p-4 flex flex-col">
        <h1 className="text-lg font-bold text-slate-100 mb-6">Kalpix Admin</h1>
        <nav className="flex-1 space-y-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition ${
                pathname === href ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-red-400"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
