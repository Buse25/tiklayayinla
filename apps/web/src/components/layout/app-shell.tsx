'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { authenticatedFetch } from '../../lib/api-client';

type Profile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
};

function profileRoleLabel(role?: string) {
  if (role === 'ADMIN') return 'Sistem Yöneticisi';
  return 'Premium Danışman';
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const res = await authenticatedFetch('users/me');
      if (res.ok) {
        const data = await res.json() as Profile;
        setProfile(data);
      }
    } catch {
      // Silently catch network errors
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const handleProfileUpdate = () => {
      void loadProfile();
    };
    window.addEventListener('profile-updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate);
    };
  }, [loadProfile]);

  const logout = useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.assign('/login');
    }
  }, [isLoggingOut]);

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: '/listings', label: 'İlanlar', icon: 'maps_home_work' },
    { href: '/listings/new', label: 'Yeni İlan', icon: 'add_circle' },
    { href: '/listings/import', label: 'İçe Aktar', icon: 'upload_file' },
    { href: '/portal-accounts', label: 'Portal Hesapları', icon: 'sync_alt' },
    { href: '/organization-applications', label: 'Kurumsal Hesap', icon: 'badge' },
    { href: '/activity', label: 'Aktivite', icon: 'history' },
    { href: '/profile', label: 'Profil', icon: 'person' },
  ];

  function isLinkActive(href: string) {
    if (href === '/listings/new') {
      return pathname === '/listings/new';
    }
    if (href === '/listings/import') {
      return pathname === '/listings/import';
    }
    if (href === '/listings') {
      return pathname.startsWith('/listings') && pathname !== '/listings/new' && pathname !== '/listings/import';
    }
    return pathname === href;
  }

  return (
    <div className="bg-background text-on-surface min-h-screen font-sans">
      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div onClick={() => setMobileSidebarOpen(false)} className="fixed inset-0 bg-black/40 z-40 lg:hidden" />
      )}

      {/* Responsive Left Sidebar */}
      <aside className={`w-[260px] h-screen fixed left-0 top-0 bg-surface-container-lowest border-r border-outline-variant shadow-[0px_4px_20px_rgba(15,23,42,0.05)] flex flex-col gap-y-4 py-8 z-50 transition-transform duration-300 lg:translate-x-0 ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-6 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-on-primary">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>real_estate_agent</span>
            </div>
            <div>
              <h1 className="font-headline-md text-headline-md font-bold text-primary leading-tight">tiklayayinla</h1>
              <p className="text-[9px] uppercase tracking-widest text-secondary font-semibold">Emlak Yönetim Paneli</p>
            </div>
          </div>
          <button onClick={() => setMobileSidebarOpen(false)} className="lg:hidden p-1 text-secondary hover:bg-surface-container-low rounded-full transition-all">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-4">
          {navLinks.map((link) => {
            const active = isLinkActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileSidebarOpen(false)}
                className={active 
                  ? "relative flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/5 text-primary border-l-4 border-primary font-semibold transition-all duration-200 ease-in-out"
                  : "flex items-center gap-3 px-4 py-3 rounded-lg text-secondary hover:bg-surface-container-low hover:text-primary transition-all duration-200 ease-in-out"
                }
              >
                <span className="material-symbols-outlined">{link.icon}</span>
                <span className="font-body-md text-body-md">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-4 space-y-2">
          <Link href="/listings/new" onClick={() => setMobileSidebarOpen(false)} className="w-full bg-primary-container text-on-primary-container py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-sm">
            <span className="material-symbols-outlined">add_circle</span>
            <span className="font-body-md text-body-md">Hızlı İlan Yayınla</span>
          </Link>
          <button onClick={logout} disabled={isLoggingOut} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-secondary hover:bg-surface-container-low hover:text-primary transition-all duration-200 ease-in-out text-left disabled:opacity-50">
            <span className="material-symbols-outlined">logout</span>
            <span className="font-body-md text-body-md">{isLoggingOut ? 'Çıkış Yapılıyor...' : 'Çıkış Yap'}</span>
          </button>
        </div>
      </aside>

      {/* Top AppBar */}
      <header className="h-16 fixed top-0 right-0 left-0 lg:left-[260px] bg-surface-container-lowest border-b border-outline-variant shadow-[0px_4px_20px_rgba(15,23,42,0.05)] flex items-center justify-between px-md z-40 transition-all duration-300">
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <button onClick={() => setMobileSidebarOpen(prev => !prev)} className="lg:hidden p-2 text-on-surface-variant hover:bg-surface-container-low rounded-full transition-all">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div className="relative group w-full hidden md:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
            <input className="w-full max-w-md bg-surface-container-low border-none rounded-full pl-10 pr-4 py-2 text-body-md focus:ring-2 focus:ring-primary/20 transition-all focus:outline-none" placeholder="Müşteri, İlan No veya Portal ara..." type="text"/>
          </div>
        </div>
        
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/settings" aria-label="Ayarlar" className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low transition-all">
            <span className="material-symbols-outlined">settings</span>
          </Link>
          <div className="h-8 w-px bg-outline-variant mx-2"></div>
          <Link href="/profile" aria-label="Profil" className="flex items-center gap-3 pl-2 rounded-xl p-1 hover:bg-surface-container-low transition-all">
            <div className="text-right hidden sm:block">
              <p className="text-body-md font-semibold text-on-surface">{profile ? `${profile.firstName} ${profile.lastName}` : 'Gayrimenkul Danışmanı'}</p>
              <p className="text-label-sm text-secondary">{profileRoleLabel(profile?.role)}</p>
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-primary/20 flex items-center justify-center bg-primary text-on-primary font-bold text-sm">
              {profile ? `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase() : 'GD'}
            </div>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="ml-0 lg:ml-[260px] pt-16 min-h-screen transition-all duration-300 bg-slate-50">
        {children}
      </main>
    </div>
  );
}
