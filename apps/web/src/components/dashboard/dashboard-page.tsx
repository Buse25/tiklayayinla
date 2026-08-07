'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authenticatedFetch } from '../../lib/api-client';

type DashboardSummary = {
  listings: { total: number; draft: number; publishing: number; active: number; archived: number };
  portalAccounts: { total: number; connected: number; failed: number; notTested: number };
  publications: { total: number; queued: number; processing: number; published: number; failed: number };
  recentPublications: Array<{ publicationId: string; listingId: string; listingTitle: string; portalName: string; status: string; externalUrl: string | null; publishedAt: string | null; updatedAt: string }>;
  recentErrors: Array<{ publicationId: string; listingId: string; listingTitle: string; portalName: string; lastError: string | null; updatedAt: string }>;
};

type Portal = {
  id: string;
  name: string;
  code: string;
  connectionType: string;
  logoUrl?: string | null;
  documentationUrl?: string | null;
  isActive: boolean;
};

type Account = {
  id: string;
  connectionStatus: string;
  lastCheckedAt?: string | null;
  lastError?: string | null;
  portal: { name: string; code: string };
};

type Profile = {
  firstName: string;
  lastName: string;
  role: string;
};

const publicationLabels: Record<string, string> = {
  PENDING: 'Bekliyor',
  QUEUED: 'Sırada',
  PROCESSING: 'Yayınlanıyor',
  PUBLISHED: 'Yayınlandı',
  FAILED: 'Başarısız',
  UNPUBLISHED: 'Yayından kaldırıldı'
};

const portalIcons: Record<string, string> = {
  'mock-xml': 'home',
  'mock-rest': 'public',
  'emlakjet': 'home',
  'sahibinden': 'public',
  'hepsiemlak': 'location_on',
  'rightmove': 'language',
};

function formatRelativeTime(dateStr: string) {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Az önce';
    if (diffMins < 60) return `${diffMins} dk`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} sa`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} gün`;
  } catch {
    return 'Yakın zamanda';
  }
}

function profileRoleLabel(role?: string) {
  if (role === 'ADMIN') return 'Sistem Yöneticisi';
  return 'Premium Danışman';
}

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [portals, setPortals] = useState<Portal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const [summaryRes, profileRes, portalsRes, accountsRes] = await Promise.all([
          authenticatedFetch('dashboard/summary'),
          authenticatedFetch('users/me'),
          authenticatedFetch('portals'),
          authenticatedFetch('portal-accounts'),
        ]);

        if (!summaryRes.ok || !profileRes.ok || !portalsRes.ok || !accountsRes.ok) {
          if (summaryRes.status !== 401 && active) setError(true);
          return;
        }

        const summaryData = await summaryRes.json() as DashboardSummary;
        const profileData = await profileRes.json() as Profile;
        const portalsData = await portalsRes.json() as Portal[];
        const accountsData = await accountsRes.json() as Account[];

        if (active) {
          setSummary(summaryData);
          setProfile(profileData);
          setPortals(portalsData);
          setAccounts(accountsData);
        }
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [reloadKey]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="bg-background text-on-surface min-h-screen flex flex-col items-center justify-center p-md">
        <section className="max-w-md w-full rounded-2xl border border-error bg-surface-container-lowest p-6 shadow-lg text-center">
          <span className="material-symbols-outlined text-[48px] text-error mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
          <h2 className="text-headline-md font-bold mb-2">Dashboard verileri alınamadı</h2>
          <p className="text-secondary text-body-md mb-6">Sunucu bağlantısı sırasında bir hata oluştu. Lütfen tekrar deneyin.</p>
          <button 
            className="w-full bg-primary text-white py-3 px-4 rounded-xl font-bold hover:opacity-90 transition-opacity" 
            onClick={() => setReloadKey(prev => prev + 1)}
            type="button"
          >
            Tekrar Dene
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-surface min-h-screen font-sans">
      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div onClick={() => setMobileSidebarOpen(false)} className="fixed inset-0 bg-black/40 z-40 lg:hidden" />
      )}

      {/* Fixed Left Sidebar (SideNavBar) */}
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
          <Link className="relative flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/5 text-primary border-l-4 border-primary font-semibold transition-all duration-200 ease-in-out" href="/dashboard">
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-body-md text-body-md">Panel</span>
          </Link>
          <Link className="flex items-center gap-3 px-4 py-3 rounded-lg text-secondary hover:bg-surface-container-low hover:text-primary transition-all duration-200 ease-in-out" href="/listings">
            <span className="material-symbols-outlined">maps_home_work</span>
            <span className="font-body-md text-body-md">İlanlar</span>
          </Link>
          <Link className="flex items-center gap-3 px-4 py-3 rounded-lg text-secondary hover:bg-surface-container-low hover:text-primary transition-all duration-200 ease-in-out" href="/portal-accounts">
            <span className="material-symbols-outlined">sync_alt</span>
            <span className="font-body-md text-body-md">Portallar</span>
          </Link>
          <Link className="flex items-center gap-3 px-4 py-3 rounded-lg text-secondary hover:bg-surface-container-low hover:text-primary transition-all duration-200 ease-in-out" href="/activity">
            <span className="material-symbols-outlined">analytics</span>
            <span className="font-body-md text-body-md">Analizler</span>
          </Link>
        </nav>
        <div className="mt-auto px-4">
          <Link href="/listings/new" className="w-full bg-primary-container text-on-primary-container py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-sm">
            <span className="material-symbols-outlined">add_circle</span>
            <span className="font-body-md text-body-md">Hızlı İlan Yayınla</span>
          </Link>
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
        
        <div className="flex items-center gap-4">
          <button className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low transition-all relative">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full"></span>
          </button>
          <button className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low transition-all">
            <span className="material-symbols-outlined">settings</span>
          </button>
          <div className="h-8 w-px bg-outline-variant mx-2"></div>
          <div className="flex items-center gap-3 pl-2">
            <div className="text-right hidden sm:block">
              <p className="text-body-md font-semibold text-on-surface">{profile ? `${profile.firstName} ${profile.lastName}` : 'Gayrimenkul Danışmanı'}</p>
              <p className="text-label-sm text-secondary">{profileRoleLabel(profile?.role)}</p>
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-primary/20 p-0.5">
              <img className="w-full h-full rounded-full object-cover" alt="Kullanıcı Fotoğrafı" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBPcxHUAI7YYimNWNzyb1uC3L9gP7YShCRnLzzFSg31tdbgzJFUN7u1jW01gCr7LgzHVYj3sotaLI5KYp4C4bbf2cc7r3XZQge9cNhrlac2Y_WIFLck2AfSfBqzmgWn5Tz14Z68Es3BHKQmuohgyR1co3dTzmlBYgNA1V3gf-B1s5VqEkUdvxiVboIdVwUrvpVl8ToYzeRm8kPeG08b0x0uEqOwtFcmzIHSHtaqAuO-kQ_c3BAzUeZd"/>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="ml-0 lg:ml-[260px] pt-16 min-h-screen p-md max-w-[1600px] transition-all duration-300">
        {/* Header Section */}
        <section className="mb-lg flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Merhaba, {profile ? `${profile.firstName} ${profile.lastName}` : 'Gayrimenkul Danışmanı'}</h2>
            <p className="text-secondary font-body-md">
              Bugün portallarında toplam {summary?.listings.active ?? 0} aktif ilan ve {summary?.publications.queued ?? 0} sırada bekleyen yayın işlemin var.
            </p>
          </div>
          <Link href="/listings/new" className="bg-primary-container text-on-primary-container px-lg py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-lg shadow-primary-container/20">
            <span className="material-symbols-outlined">rocket_launch</span>
            <span className="font-headline-md text-headline-md">Hızlı İlan Yayınla</span>
          </Link>
        </section>

        {/* Ana İlan İstatistikleri */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-lg">
          {/* Aktif İlanlar */}
          <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant shadow-[0px_4px_20px_rgba(15,23,42,0.05)] hover:-translate-y-1 transition-transform duration-300">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
              </div>
              <span className="text-primary font-semibold text-label-md flex items-center gap-1 bg-primary/5 px-2 py-1 rounded">
                <span className="material-symbols-outlined text-[14px]">trending_up</span> +12%
              </span>
            </div>
            <h3 className="text-secondary font-label-md mb-1">Aktif İlanlar</h3>
            <p className="text-headline-xl font-headline-xl text-on-surface">{summary?.listings.active ?? 0}</p>
            <div className="mt-4 h-1 bg-surface-container-low rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500" 
                style={{ width: `${summary ? (summary.listings.active / (summary.listings.total || 1)) * 100 : 75}%` }}
              />
            </div>
          </div>

          {/* Yayınlanan İlanlar */}
          <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant shadow-[0px_4px_20px_rgba(15,23,42,0.05)] hover:-translate-y-1 transition-transform duration-300">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-secondary-container rounded-lg text-on-secondary-container">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_done</span>
              </div>
              <span className="text-primary font-semibold text-label-md flex items-center gap-1 bg-primary/5 px-2 py-1 rounded">
                <span className="material-symbols-outlined text-[14px]">trending_up</span> +8%
              </span>
            </div>
            <h3 className="text-secondary font-label-md mb-1">Yayınlanan İlanlar</h3>
            <p className="text-headline-xl font-headline-xl text-on-surface">{summary?.publications.published ?? 0}</p>
            <div className="mt-4 flex gap-1 items-end h-8">
              <div className="bg-primary/20 w-full h-[40%] rounded-t-sm"></div>
              <div className="bg-primary/20 w-full h-[60%] rounded-t-sm"></div>
              <div className="bg-primary/20 w-full h-[45%] rounded-t-sm"></div>
              <div className="bg-primary/20 w-full h-[80%] rounded-t-sm"></div>
              <div className="bg-primary w-full h-[100%] rounded-t-sm animate-pulse"></div>
            </div>
          </div>

          {/* Toplam Görüntülenme -> Bağlı Portallar */}
          <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant shadow-[0px_4px_20px_rgba(15,23,42,0.05)] hover:-translate-y-1 transition-transform duration-300">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-tertiary-fixed rounded-lg text-on-tertiary-fixed-variant">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>sync</span>
              </div>
              <div className="w-24 h-8">
                <svg className="w-full h-full stroke-primary fill-none stroke-[3]" viewBox="0 0 100 40">
                  <path d="M0,35 Q10,10 20,30 T40,20 T60,35 T80,10 T100,25"></path>
                </svg>
              </div>
            </div>
            <h3 className="text-secondary font-label-md mb-1">Bağlı Portallar</h3>
            <p className="text-headline-xl font-headline-xl text-on-surface">
              {summary ? `${summary.portalAccounts.connected}/${summary.portalAccounts.total}` : '0/0'}
            </p>
            <p className="text-label-sm text-secondary mt-2">Aktif portal bağlantıları</p>
          </div>
        </section>

        {/* Content Grid: Portal Sync & Leads */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          {/* Portal Senkronizasyon Durumu */}
          <section className="lg:col-span-8">
            <div className="flex items-center justify-between mb-sm">
              <h3 className="font-headline-md text-headline-md text-on-surface">Portal Senkronizasyon Durumu</h3>
              <button 
                onClick={() => setReloadKey(prev => prev + 1)}
                className="text-primary font-semibold text-body-md flex items-center gap-1 hover:underline active:scale-95 transition-transform"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span> Tümünü Güncelle
              </button>
            </div>
            
            {portals.filter(p => p.isActive).length === 0 ? (
              <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant text-center shadow-sm">
                <span className="material-symbols-outlined text-[48px] text-outline mb-2">sync_disabled</span>
                <p className="text-secondary font-body-md mb-4">Aktif portal kataloğu bulunamadı.</p>
                <Link href="/portal-accounts" className="inline-block bg-primary text-white font-semibold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity">
                  Hesap Ayarlarına Git
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {portals.filter(p => p.isActive).map(portal => {
                  const account = accounts.find(a => a.portal.code === portal.code);
                  const isConnected = !!account;
                  const statusVal = account?.connectionStatus;
                  
                  let statusBadge = (
                    <span className="flex items-center gap-1 text-[10px] text-outline font-bold uppercase tracking-wider bg-surface-container-low px-2 py-0.5 rounded">
                      <span className="w-1.5 h-1.5 rounded-full bg-outline"></span> Bağlı Değil
                    </span>
                  );
                  let subtext = "Lütfen hesap bilgilerinizi bağlayın";
                  let iconColorClass = "text-secondary group-hover:bg-secondary group-hover:text-white";
                  
                  if (isConnected) {
                    if (statusVal === 'CONNECTED') {
                      statusBadge = (
                        <span className="flex items-center gap-1 text-[10px] text-primary font-bold uppercase tracking-wider bg-primary/5 px-2 py-0.5 rounded">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span> Aktif
                        </span>
                      );
                      subtext = account.lastCheckedAt 
                        ? `${formatRelativeTime(account.lastCheckedAt)} önce senkronize edildi` 
                        : "Senkronize edildi";
                      iconColorClass = "text-primary group-hover:bg-primary group-hover:text-white";
                    } else if (statusVal === 'FAILED') {
                      statusBadge = (
                        <span className="flex items-center gap-1 text-[10px] text-error font-bold uppercase tracking-wider bg-error/5 px-2 py-0.5 rounded">
                          <span className="w-1.5 h-1.5 rounded-full bg-error"></span> Hata
                        </span>
                      );
                      subtext = account.lastError || "Kimlik doğrulaması gerekiyor";
                      iconColorClass = "text-error group-hover:bg-error group-hover:text-white";
                    } else {
                      statusBadge = (
                        <span className="flex items-center gap-1 text-[10px] text-on-tertiary-container font-bold uppercase tracking-wider bg-tertiary-container/10 px-2 py-0.5 rounded italic">
                          <span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container animate-ping"></span> Sync...
                        </span>
                      );
                      subtext = "Bağlantı doğrulanıyor";
                      iconColorClass = "text-outline group-hover:bg-outline group-hover:text-white";
                    }
                  }
                  
                  const iconSymbol = portalIcons[portal.code] || 'language';
                  
                  return (
                    <Link 
                      key={portal.id} 
                      href="/portal-accounts"
                      className="bg-surface-container-lowest p-sm rounded-xl border border-outline-variant flex items-center gap-4 hover:border-primary transition-all group cursor-pointer shadow-sm hover:shadow-md animate-fade-in"
                    >
                      <div className={`w-12 h-12 bg-surface-container-low rounded-lg flex items-center justify-center transition-colors duration-200 ${iconColorClass}`}>
                        <span className="material-symbols-outlined text-[32px]">{iconSymbol}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <h4 className="font-semibold text-body-lg truncate">{portal.name}</h4>
                          {statusBadge}
                        </div>
                        <p className="text-label-sm text-secondary truncate">{subtext}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Async Visual Element */}
            <div className="mt-8 relative overflow-hidden rounded-2xl bg-surface-container-highest h-48 group">
              <div className="relative z-10 p-lg flex flex-col justify-center h-full max-w-md">
                <h4 className="font-headline-md text-headline-md mb-2 text-on-surface">Akıllı Eşleştirme Motoru</h4>
                <p className="text-body-md text-secondary mb-4">Portallardan gelen veriler yapay zeka ile analiz edilerek en doğru alıcılarla eşleştiriliyor.</p>
                <Link href="/listings" className="bg-white text-primary border border-primary px-4 py-2 rounded-lg font-semibold w-fit hover:bg-primary hover:text-white transition-all text-center">
                  Detayları Gör
                </Link>
              </div>
            </div>
          </section>

          {/* Son Aday Müşteriler -> Son Yayınlar & Hatalar */}
          <section className="lg:col-span-4 flex flex-col gap-6">
            <div>
              <div className="flex items-center justify-between mb-sm">
                <h3 className="font-headline-md text-headline-md text-on-surface">Son Yayınlar</h3>
                <Link className="text-label-md text-primary hover:underline font-semibold" href="/listings">Tümünü Gör</Link>
              </div>
              
              <div className="space-y-4">
                {summary?.recentPublications.length === 0 ? (
                  <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant text-center shadow-sm">
                    <span className="material-symbols-outlined text-[40px] text-outline mb-2">cloud_off</span>
                    <p className="text-[12px] text-secondary">Henüz yayınlanmış bir ilan bulunmuyor.</p>
                    <Link href="/listings/new" className="mt-3 inline-block bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-primary/20 transition-colors">
                      İlk İlanı Yayınla
                    </Link>
                  </div>
                ) : (
                  summary?.recentPublications.map(item => {
                    const initials = item.portalName ? item.portalName.substring(0, 2).toUpperCase() : 'PT';
                    const isPublished = item.status === 'PUBLISHED';
                    
                    return (
                      <div key={item.publicationId} className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-sm">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="font-semibold text-body-md truncate">{item.listingTitle}</h5>
                            <p className="text-[11px] text-secondary">{formatRelativeTime(item.updatedAt)} önce</p>
                          </div>
                          <div>
                            <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${
                              isPublished ? 'bg-primary/10 text-primary' : 'bg-secondary-container text-on-secondary-container'
                            }`}>
                              {publicationLabels[item.status] ?? item.status}
                            </span>
                          </div>
                        </div>
                        
                        <div className="bg-surface-container-low p-2 rounded-lg mb-3">
                          <p className="text-[12px] text-secondary italic truncate">
                            {item.portalName} platformunda {isPublished ? 'yayında' : 'yayın sürecinde'}.
                          </p>
                        </div>
                        
                        <div className="flex gap-2">
                          {item.externalUrl ? (
                            <a 
                              href={item.externalUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="flex-1 bg-primary text-white py-2 rounded-lg text-body-md font-semibold flex items-center justify-center gap-1 hover:opacity-90 transition-opacity text-center text-xs"
                            >
                              <span className="material-symbols-outlined text-[16px]">open_in_new</span> İlana Git
                            </a>
                          ) : (
                            <Link 
                              href={`/listings/${item.listingId}`}
                              className="flex-1 bg-primary text-white py-2 rounded-lg text-body-md font-semibold flex items-center justify-center gap-1 hover:opacity-90 transition-opacity text-center text-xs"
                            >
                              <span className="material-symbols-outlined text-[16px]">visibility</span> Detay
                            </Link>
                          )}
                          <Link 
                            href={`/listings/${item.listingId}`}
                            className="flex-1 bg-surface-container-low text-on-surface py-2 rounded-lg text-body-md font-semibold flex items-center justify-center gap-1 hover:bg-surface-container-high transition-colors text-center text-xs"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span> Düzenle
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-sm">
                <h3 className="font-headline-md text-headline-md text-on-surface">Son Yayın Hataları</h3>
              </div>
              
              <div className="space-y-4">
                {summary?.recentErrors.length === 0 ? (
                  <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant text-center shadow-sm">
                    <span className="material-symbols-outlined text-[40px] text-primary mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <p className="text-[12px] text-secondary">Herhangi bir yayın hatası bulunmuyor. Her şey yolunda!</p>
                  </div>
                ) : (
                  summary?.recentErrors.map(item => {
                    const initials = item.portalName ? item.portalName.substring(0, 2).toUpperCase() : 'ERR';
                    
                    return (
                      <div key={item.publicationId} className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full bg-error-container flex items-center justify-center text-on-error-container font-bold text-sm">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="font-semibold text-body-md truncate">{item.listingTitle}</h5>
                            <p className="text-[11px] text-secondary">{formatRelativeTime(item.updatedAt)} önce</p>
                          </div>
                          <div>
                            <span className="bg-error/10 text-error text-[10px] px-2 py-1 rounded-full font-bold">HATA</span>
                          </div>
                        </div>
                        
                        <div className="bg-error-container/10 p-2.5 rounded-lg border border-error-container/20 mb-3">
                          <p className="text-[12px] text-error font-medium line-clamp-2">
                            {item.lastError || "Bilinmeyen bir entegrasyon hatası oluştu."}
                          </p>
                        </div>
                        
                        <div className="flex gap-2">
                          <Link 
                            href={`/listings/${item.listingId}`}
                            className="flex-1 bg-primary text-white py-2 rounded-lg text-body-md font-semibold flex items-center justify-center gap-1 hover:opacity-90 transition-opacity text-center text-xs"
                          >
                            <span className="material-symbols-outlined text-[16px]">build</span> Çöz / Düzenle
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="bg-background text-on-surface min-h-screen font-sans">
      {/* Sidebar skeleton */}
      <aside className="w-[260px] h-screen fixed left-0 top-0 bg-surface-container-lowest border-r border-outline-variant shadow-[0px_4px_20px_rgba(15,23,42,0.05)] flex flex-col gap-y-4 py-8 z-50 hidden lg:flex">
        <div className="px-6 mb-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface-container-low animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-surface-container-low animate-pulse rounded" />
            <div className="h-2.5 w-20 bg-surface-container-low animate-pulse rounded" />
          </div>
        </div>
        <div className="flex-1 space-y-3 px-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-surface-container-low animate-pulse rounded-lg" />
          ))}
        </div>
      </aside>

      {/* Header skeleton */}
      <header className="h-16 fixed top-0 right-0 left-0 lg:left-[260px] bg-surface-container-lowest border-b border-outline-variant shadow-[0px_4px_20px_rgba(15,23,42,0.05)] flex items-center justify-between px-md z-40">
        <div className="w-48 h-10 bg-surface-container-low animate-pulse rounded-full hidden md:block" />
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-surface-container-low animate-pulse" />
          <div className="w-10 h-10 rounded-full bg-surface-container-low animate-pulse" />
          <div className="h-8 w-px bg-outline-variant mx-2" />
          <div className="flex items-center gap-3">
            <div className="space-y-2 text-right hidden sm:block">
              <div className="h-3 w-24 bg-surface-container-low animate-pulse rounded" />
              <div className="h-2 w-16 bg-surface-container-low animate-pulse rounded" />
            </div>
            <div className="w-10 h-10 rounded-full bg-surface-container-low animate-pulse" />
          </div>
        </div>
      </header>

      {/* Main Content skeleton */}
      <main className="ml-0 lg:ml-[260px] pt-16 min-h-screen p-md max-w-[1600px] transition-all duration-300">
        <section className="mb-lg flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-surface-container-low animate-pulse rounded" />
            <div className="h-4 w-96 bg-surface-container-low animate-pulse rounded" />
          </div>
          <div className="w-40 h-12 bg-surface-container-low animate-pulse rounded-xl" />
        </section>
        
        <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-lg">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant shadow-[0px_4px_20px_rgba(15,23,42,0.05)] h-[142px]">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-surface-container-low animate-pulse rounded-lg" />
                <div className="w-12 h-6 bg-surface-container-low animate-pulse rounded" />
              </div>
              <div className="h-4 w-24 bg-surface-container-low animate-pulse rounded mb-2" />
              <div className="h-10 w-16 bg-surface-container-low animate-pulse rounded mb-4" />
              <div className="h-2 bg-surface-container-low animate-pulse rounded-full w-full" />
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          <section className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="h-6 w-48 bg-surface-container-low animate-pulse rounded" />
              <div className="h-4 w-24 bg-surface-container-low animate-pulse rounded" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-surface-container-lowest p-sm rounded-xl border border-outline-variant flex items-center gap-4 h-[76px]">
                  <div className="w-12 h-12 bg-surface-container-low animate-pulse rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 bg-surface-container-low animate-pulse rounded" />
                    <div className="h-3 w-32 bg-surface-container-low animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
            <div className="h-48 bg-surface-container-low animate-pulse rounded-2xl" />
          </section>
          <section className="lg:col-span-4 space-y-6">
            <div className="flex items-center justify-between">
              <div className="h-6 w-32 bg-surface-container-low animate-pulse rounded" />
              <div className="h-4 w-16 bg-surface-container-low animate-pulse rounded" />
            </div>
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-sm space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-container-low animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-24 bg-surface-container-low animate-pulse rounded" />
                      <div className="h-3 w-16 bg-surface-container-low animate-pulse rounded" />
                    </div>
                  </div>
                  <div className="h-8 bg-surface-container-low animate-pulse rounded-lg w-full" />
                  <div className="flex gap-2">
                    <div className="h-8 bg-surface-container-low animate-pulse rounded-lg flex-1" />
                    <div className="h-8 bg-surface-container-low animate-pulse rounded-lg flex-1" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
