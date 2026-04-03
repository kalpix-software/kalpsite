'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Store, RefreshCw, LogOut, BarChart3, Package,
  CalendarCheck, Tag, Swords, Trophy, Gift, ChevronDown, ChevronRight,
  MessageSquare, Gamepad2, Users, Flag, MessageCircleWarning,
} from 'lucide-react';

const SESSION_URL = '/api/auth/session';
const SESSION_RETRY_MS = 350;
const SESSION_RETRY_MS_SECOND = 500;

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
    let timeout1: ReturnType<typeof setTimeout> | undefined;
    let timeout2: ReturnType<typeof setTimeout> | undefined;

    check().then((ok) => {
      if (cancelled) return;
      if (ok) {
        setAuth(true);
        return;
      }
      timeout1 = setTimeout(() => {
        check().then((ok2) => {
          if (cancelled) return;
          if (ok2) {
            setAuth(true);
            return;
          }
          timeout2 = setTimeout(() => {
            check().then((ok3) => {
              if (!cancelled) setAuth(ok3);
            });
          }, SESSION_RETRY_MS_SECOND);
        });
      }, SESSION_RETRY_MS);
    });

    return () => {
      cancelled = true;
      if (timeout1) clearTimeout(timeout1);
      if (timeout2) clearTimeout(timeout2);
    };
  }, [enable]);

  return auth;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname?.includes('/admin/login');
  const auth = useSession(!isLoginPage);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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

  const navGroups: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/admin/play', label: 'Player view (Shop)', icon: Gamepad2 },
        { href: '/admin/stats', label: 'Stats', icon: BarChart3 },
      ],
    },
    {
      label: 'Catalog',
      items: [
        { href: '/admin/store', label: 'Store Items', icon: Store },
        { href: '/admin/bundles', label: 'Bundles', icon: Package },
        { href: '/admin/sync', label: 'Avatars', icon: RefreshCw },
      ],
    },
    {
      label: 'Live Ops',
      items: [
        { href: '/admin/rewards', label: 'Daily Rewards', icon: CalendarCheck },
        { href: '/admin/deals', label: 'Deals', icon: Tag },
        { href: '/admin/battlepass', label: 'Battle Pass', icon: Swords },
      ],
    },
    {
      label: 'Engagement',
      items: [
        { href: '/admin/achievements', label: 'Achievements', icon: Trophy },
        { href: '/admin/gifts', label: 'Gifts', icon: Gift },
      ],
    },
    {
      label: 'Support',
      items: [
        { href: '/admin/users', label: 'Users', icon: Users },
        { href: '/admin/reports', label: 'User Reports', icon: Flag },
        { href: '/admin/message-reports', label: 'Message Reports', icon: MessageCircleWarning },
        { href: '/admin/chat', label: 'Bot Chats', icon: MessageSquare },
      ],
    },
  ];

  const toggle = (label: string) =>
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <div className="min-h-screen flex bg-slate-900 text-slate-200">
      <aside className="w-60 border-r border-slate-700 p-4 flex flex-col">
        <h1 className="text-lg font-bold text-slate-100 mb-5">Kalpix Admin</h1>
        <nav className="flex-1 space-y-3 overflow-y-auto">
          {navGroups.map((group) => {
            const isOpen = !collapsed[group.label];
            const groupActive = group.items.some((i) => pathname === i.href);
            return (
              <div key={group.label}>
                <button
                  onClick={() => toggle(group.label)}
                  className="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 mb-1 px-2"
                >
                  {group.label}
                  {isOpen ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className={`w-3 h-3 ${groupActive ? 'text-indigo-400' : ''}`} />
                  )}
                </button>
                {isOpen && (
                  <div className="space-y-0.5">
                    {group.items.map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                          pathname === href
                            ? 'bg-indigo-600 text-white'
                            : 'hover:bg-slate-800 text-slate-400'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-red-400 mt-2"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
