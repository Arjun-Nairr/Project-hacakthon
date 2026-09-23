import { useState, type ReactNode } from 'react';
import { Bell, BookOpen, CalendarDays, Home, Landmark, Target, X } from 'lucide-react';
import { Link } from 'wouter';

const navItems = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/', label: 'Plan', icon: Landmark },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/learn', label: 'Learn', icon: BookOpen },
];

function BayzatiLogo() {
  return (
    <div className="flex items-center gap-2">
      <img src="/images/bayzati-logo.png" alt="Bayzati" className="size-9 object-contain" data-testid="img-bayzati-logo" />
      <div className="leading-none">
        <p className="text-[19px] font-semibold tracking-[-.04em] text-[#003B73]">bayzati</p>
        <p className="mt-1 text-[9px] font-semibold uppercase tracking-[.13em] text-[#98A2B3]">your calmer money plan</p>
      </div>
    </div>
  );
}

export function BayzatiMobileShell({
  active,
  children,
  floatingAction,
}: {
  active: 'plan' | 'goals' | 'learn';
  children: ReactNode;
  floatingAction?: ReactNode;
}) {
  const [panel, setPanel] = useState<'notifications' | 'profile' | null>(null);

  return (
    <main className="relative mx-auto min-h-[100dvh] w-full max-w-[520px] overflow-x-hidden bg-[#F8FAFC] font-['Inter',system-ui,sans-serif] text-[#17212B] shadow-[0_0_40px_rgba(0,46,93,.06)]">
      <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-[#EAF6FD] opacity-70" />
      <div className="relative px-5 pb-40 pt-6">
        <header className="flex items-center justify-between">
          <BayzatiLogo />
          <div className="flex items-center gap-2">
            <button
              aria-label="Notifications"
              onClick={() => setPanel('notifications')}
              className="grid size-11 place-items-center rounded-full border border-[#E4E7EC] bg-white text-[#667085]"
              data-testid="button-notifications"
            >
              <Bell size={17} />
            </button>
            <button
              aria-label="Open profile"
              onClick={() => setPanel('profile')}
              className="grid size-11 place-items-center rounded-full bg-[#EAF6FD] text-[11px] font-semibold text-[#003B73]"
              data-testid="button-profile"
            >
              MA
            </button>
          </div>
        </header>
        {children}
      </div>

      {floatingAction && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[106px] z-20 mx-auto flex max-w-[520px] justify-end px-5">
          <div className="pointer-events-auto">{floatingAction}</div>
        </div>
      )}

      <nav className="fixed inset-x-4 bottom-4 z-20 mx-auto flex max-w-[488px] items-center rounded-full border border-[#E4E7EC] bg-white px-1 shadow-[0_2px_8px_rgba(0,46,93,.05)]" aria-label="Bayzati navigation">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className={`flex h-[60px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full ${active === label.toLowerCase() ? 'bg-[#EAF6FD] text-[#003B73]' : 'text-[#667085]'}`}
            data-testid={`link-nav-${label.toLowerCase()}`}
          >
            <Icon size={20} />
            <span className="text-[10px] font-semibold">{label}</span>
          </Link>
        ))}
      </nav>

      {panel && (
        <div className="fixed inset-0 z-30 bg-[#092e59]/25" onClick={() => setPanel(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="mobile-panel-title" onClick={(event) => event.stopPropagation()} className="absolute inset-x-4 bottom-28 mx-auto max-w-[488px] rounded-[18px] border border-[#E4E7EC] bg-white px-4 py-4 shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#667085]">{panel === 'notifications' ? 'Notifications' : 'Your profile'}</p>
                <h2 id="mobile-panel-title" className="mt-1 text-[21px] font-bold tracking-[-.04em] text-[#003B73]">{panel === 'notifications' ? 'You are up to date.' : 'Mariam Al Noor'}</h2>
              </div>
              <button aria-label="Close panel" onClick={() => setPanel(null)} className="grid size-11 place-items-center rounded-full border border-[#E4E7EC]" data-testid="button-close-mobile-panel"><X size={15} /></button>
            </div>
            <p className="mt-4 rounded-[15px] bg-[#EAF6FD] px-3.5 py-3 text-[12px] leading-5 text-[#003B73]">{panel === 'notifications' ? 'No new money decisions need your attention right now.' : 'Dubai · AED. Your plan is private by design.'}</p>
          </section>
        </div>
      )}
    </main>
  );
}