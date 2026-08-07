'use client';

import Link from 'next/link';
import { Activity, LayoutDashboard, ShieldCheck, User, FileText } from 'lucide-react';
import { getProfileNavigationLinks, type ProfileRole } from '../../lib/profile-summary';

type AppNavigationProps = {
  role?: ProfileRole | null;
  activeHref?: string;
  className?: string;
};

export function AppNavigation({ role, activeHref, className }: AppNavigationProps) {
  const links = getProfileNavigationLinks(role);

  return (
    <nav className={className ?? 'flex flex-wrap gap-2'}>
      {links.map((link) => {
        const active = link.href === activeHref;
        const icon = iconFor(link.href);
        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={[
              'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition',
              active ? 'border-teal-600 bg-teal-700 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50',
            ].join(' ')}
            href={link.href}
            key={link.href}
          >
            <span aria-hidden="true">{icon}</span>
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function iconFor(href: string) {
  if (href === '/dashboard') return <LayoutDashboard size={16} />;
  if (href === '/profile') return <User size={16} />;
  if (href === '/organization-applications') return <FileText size={16} />;
  if (href === '/activity') return <Activity size={16} />;
  return <ShieldCheck size={16} />;
}
