'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '../../lib/api-client';

type Profile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
};

type SearchListing = {
  id: string;
  listingNo: string;
  title: string;
  listingType: string;
  listingDomain: string;
  city: string;
  district: string;
  price: number;
  currency: string;
  status: string;
  vehicleDetails?: { brand: string; model: string } | null;
};

type SearchResponse = { data: SearchListing[] };

const searchStatusLabels: Record<string, string> = {
  DRAFT: 'Taslak', PUBLISHING: 'Yayınlanıyor', ACTIVE: 'Aktif', ARCHIVED: 'Arşivlendi', SUSPENDED: 'Askıda', DELETED: 'Silindi',
};

const searchStatusStyles: Record<string, string> = {
  DRAFT: 'bg-amber-50 text-amber-800', PUBLISHING: 'bg-blue-50 text-blue-800', ACTIVE: 'bg-emerald-50 text-emerald-800', ARCHIVED: 'bg-slate-100 text-slate-700', SUSPENDED: 'bg-orange-50 text-orange-800', DELETED: 'bg-red-50 text-red-800',
};

function formatSearchPrice(price: number, currency: string) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(price);
}

function profileRoleLabel(role?: string) {
  if (role === 'ADMIN') return 'Sistem Yöneticisi';
  return 'Premium Danışman';
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchListing[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const searchAreaRef = useRef<HTMLDivElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

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
    const normalizedQuery = searchQuery.trim();
    if (normalizedQuery.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(false);
      setSearchOpen(false);
      setActiveSearchIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      setSearchError(false);
      setSearchOpen(true);
      void authenticatedFetch(`listings?search=${encodeURIComponent(normalizedQuery)}&limit=8`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error('search_failed');
          const payload = await response.json() as SearchResponse;
          setSearchResults(payload.data);
          setActiveSearchIndex(payload.data.length ? 0 : -1);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          setSearchResults([]);
          setSearchError(true);
          setActiveSearchIndex(-1);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchLoading(false);
        });
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  useEffect(() => {
    function closeSearchOnOutsideClick(event: MouseEvent) {
      if (!searchAreaRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
        setMobileSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', closeSearchOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeSearchOnOutsideClick);
  }, []);

  useEffect(() => {
    if (mobileSearchOpen) mobileSearchInputRef.current?.focus();
  }, [mobileSearchOpen]);

  function closeSearch() {
    setSearchOpen(false);
    setMobileSearchOpen(false);
    setActiveSearchIndex(-1);
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch();
      return;
    }
    if (!searchResults.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSearchIndex((current) => (current + 1) % searchResults.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSearchIndex((current) => (current - 1 + searchResults.length) % searchResults.length);
    } else if (event.key === 'Enter' && activeSearchIndex >= 0) {
      event.preventDefault();
      router.push(`/listings/${searchResults[activeSearchIndex].id}`);
      closeSearch();
    }
  }

  function renderSearchDropdown() {
    if (!searchOpen || searchQuery.trim().length < 2) return null;
    return <div id="global-search-results" className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-2 shadow-xl">
      {searchLoading ? <div className="flex items-center gap-2 px-3 py-4 text-sm text-secondary"><span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>Aranıyor...</div> : searchError ? <p className="px-3 py-4 text-sm text-secondary">Arama şu anda kullanılamıyor.</p> : searchResults.length === 0 ? <p className="px-3 py-4 text-sm text-secondary">Sonuç bulunamadı.</p> : <ul role="listbox" aria-label="İlan arama sonuçları">
        {searchResults.map((listing, index) => <li key={listing.id}>
          <button id={`global-search-result-${index}`} className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${index === activeSearchIndex ? 'bg-primary/10' : 'hover:bg-surface-container-low'}`} onClick={() => { router.push(`/listings/${listing.id}`); closeSearch(); }} onMouseEnter={() => setActiveSearchIndex(index)} role="option" aria-selected={index === activeSearchIndex} type="button">
            <div className="flex items-start justify-between gap-3"><span className="min-w-0 flex-1 truncate font-semibold text-on-surface">{listing.title}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${searchStatusStyles[listing.status] ?? 'bg-slate-100 text-slate-700'}`}>{searchStatusLabels[listing.status] ?? listing.status}</span></div>
            <p className="mt-1 text-xs text-secondary">{listing.listingDomain === 'VEHICLE' ? 'Araç' : 'Gayrimenkul'} · {listing.listingType === 'RENT' ? 'Kiralık' : 'Satılık'}</p>
            <p className="mt-1 truncate text-xs text-secondary">{listing.listingNo} · {listing.listingDomain === 'VEHICLE' && listing.vehicleDetails ? `${listing.vehicleDetails.brand} ${listing.vehicleDetails.model} · ` : ''}{listing.city} / {listing.district} · {formatSearchPrice(listing.price, listing.currency)}</p>
          </button>
        </li>)}
      </ul>}
    </div>;
  }

  useEffect(() => {
    if (!profile) return;
    if (profile.role === 'ADMIN' && !pathname.startsWith('/admin')) router.replace('/admin');
    if (profile.role !== 'ADMIN' && pathname.startsWith('/admin')) router.replace('/dashboard');
  }, [pathname, profile, router]);

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

  const userNavLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: '/listings', label: 'İlanlar', icon: 'maps_home_work' },
    { href: '/listings/new', label: 'Yeni İlan', icon: 'add_circle' },
    { href: '/listings/import', label: 'İçe Aktar', icon: 'upload_file' },
    { href: '/portal-accounts', label: 'Portal Hesapları', icon: 'sync_alt' },
    { href: '/organization-applications', label: 'Kurumsal Hesap', icon: 'badge' },
    { href: '/activity', label: 'Aktivite', icon: 'history' },
    { href: '/plans', label: 'Paketler', icon: 'payments' },
    { href: '/profile', label: 'Profil', icon: 'person' },
  ];
  const navLinks = profile?.role === 'ADMIN'
    ? [
      { href: '/admin', label: 'Panel', icon: 'dashboard' },
      { href: '/admin/users', label: 'Kullanıcılar', icon: 'group' },
        { href: '/admin/organization-applications', label: 'Kurumsal Başvurular', icon: 'badge' },
        { href: '/admin/listings', label: 'Tüm İlanlar', icon: 'maps_home_work' },
        { href: '/admin/plans', label: 'Paketler', icon: 'payments' },
      ]
    : userNavLinks;

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
          {profile?.role !== 'ADMIN' && <Link href="/listings/new" onClick={() => setMobileSidebarOpen(false)} className="w-full bg-primary-container text-on-primary-container py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-sm">
            <span className="material-symbols-outlined">add_circle</span>
            <span className="font-body-md text-body-md">Hızlı İlan Yayınla</span>
          </Link>}
          <button onClick={logout} disabled={isLoggingOut} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-secondary hover:bg-surface-container-low hover:text-primary transition-all duration-200 ease-in-out text-left disabled:opacity-50">
            <span className="material-symbols-outlined">logout</span>
            <span className="font-body-md text-body-md">{isLoggingOut ? 'Çıkış Yapılıyor...' : 'Çıkış Yap'}</span>
          </button>
        </div>
      </aside>

      {/* Top AppBar */}
      <header className="h-16 fixed top-0 right-0 left-0 lg:left-[260px] bg-surface-container-lowest border-b border-outline-variant shadow-[0px_4px_20px_rgba(15,23,42,0.05)] flex items-center justify-between px-md z-40 transition-all duration-300">
        <div ref={searchAreaRef} className="relative flex items-center gap-3 flex-1 max-w-xl">
          <button onClick={() => setMobileSidebarOpen(prev => !prev)} className="lg:hidden p-2 text-on-surface-variant hover:bg-surface-container-low rounded-full transition-all">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <button aria-label="Arama aç" className="rounded-full p-2 text-on-surface-variant transition-all hover:bg-surface-container-low md:hidden" onClick={() => { setMobileSearchOpen(true); setSearchOpen(true); }} type="button">
            <span className="material-symbols-outlined">search</span>
          </button>
          <>
          <div className="relative group w-full hidden md:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
            <input aria-activedescendant={activeSearchIndex >= 0 ? `global-search-result-${activeSearchIndex}` : undefined} aria-autocomplete="list" aria-controls="global-search-results" aria-expanded={searchOpen} className="w-full max-w-md bg-surface-container-low border-none rounded-full pl-10 pr-4 py-2 text-body-md focus:ring-2 focus:ring-primary/20 transition-all focus:outline-none" onChange={(event) => setSearchQuery(event.target.value)} onFocus={() => { if (searchQuery.trim().length >= 2) setSearchOpen(true); }} onKeyDown={handleSearchKeyDown} placeholder="İlan başlığı, ilan no, şehir veya portal ara..." type="search" value={searchQuery}/>
            {renderSearchDropdown()}
          </div>
          {mobileSearchOpen && <div className="relative absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 shadow-xl md:hidden">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
              <input ref={mobileSearchInputRef} aria-autocomplete="list" aria-controls="global-search-results" aria-expanded={searchOpen} className="w-full rounded-full bg-surface-container-low py-2 pl-10 pr-10 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/20" onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={handleSearchKeyDown} placeholder="İlan başlığı, ilan no veya şehir ara..." type="search" value={searchQuery}/>
              <button aria-label="Aramayı kapat" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-secondary hover:bg-surface-container-high" onClick={closeSearch} type="button"><span className="material-symbols-outlined text-[18px]">close</span></button>
            </div>
            {renderSearchDropdown()}
          </div>}
          </>
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
