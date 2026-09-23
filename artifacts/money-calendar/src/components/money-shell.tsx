import type { ReactNode } from 'react';
import { BarChart3, CalendarDays, ChevronRight, Home, Landmark, ShieldCheck, Target } from 'lucide-react';
import { Link, useLocation } from 'wouter';

const navItems = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/', label: 'Plan', icon: Landmark },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
];

export function MoneyShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  if (location === '/onboarding') {
    return <>{children}</>;
  }
  if (location === '/' || location === '/home' || location === '/goals' || location === '/calendar' || location === '/imports' || location === '/loan' || location === '/plan/rent-vs-buy') {
    return <>{children}</>;
  }
  return (
    <div className="page-grain min-h-[100dvh] bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col bg-sidebar px-5 py-6 text-sidebar-foreground md:flex">
        <Link href="/" className="mb-12 flex items-center gap-3" data-testid="link-brand">
          <span className="grid size-10 place-items-center rounded-[13px] bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <img src="/images/bayzati-logo.png" alt="Bayzati" className="size-8 object-contain" data-testid="img-shell-bayzati-logo" />
          </span>
          <span>
            <span className="block font-display text-[27px] leading-none tracking-tight">bayzati</span>
            <span className="mt-1 block font-mono-data text-[9px] uppercase tracking-[0.18em] text-sidebar-foreground/55">your calmer money plan</span>
          </span>
        </Link>
        <nav className="space-y-1" aria-label="Main navigation">
          <p className="mb-3 px-3 font-mono-data text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/45">Your decisions</p>
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return (
              <Link
                href={href}
                key={href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`}
                data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}
              >
                <Icon className={`size-[17px] ${active ? 'text-sidebar-primary' : 'text-sidebar-foreground/45 group-hover:text-sidebar-primary'}`} strokeWidth={1.8} />
                <span>{label}</span>
                {active && <ChevronRight className="ml-auto size-4 text-sidebar-primary" />}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-4">
          <div className="mb-3 flex items-center gap-2 text-sidebar-primary">
            <ShieldCheck className="size-4" />
            <span className="font-mono-data text-[10px] uppercase tracking-[0.16em]">Private by design</span>
          </div>
          <p className="text-xs leading-5 text-sidebar-foreground/65">A decision lens for your salary, commitments, and the months between them.</p>
        </div>
        <div className="mt-5 flex items-center gap-3 border-t border-sidebar-border pt-5">
          <span className="grid size-9 place-items-center rounded-full bg-sidebar-primary/15 font-mono-data text-xs text-sidebar-primary">MA</span>
          <div>
            <p className="text-sm">Mariam Al Noor</p>
            <p className="text-[11px] text-sidebar-foreground/45">Dubai · AED</p>
          </div>
        </div>
      </aside>

      <div className="md:pl-[252px]">
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-border/75 bg-background/90 px-5 backdrop-blur-md md:px-10">
          <div className="flex items-center gap-3 md:hidden">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><img src="/images/bayzati-logo.png" alt="Bayzati" className="size-7 object-contain" data-testid="img-mobile-bayzati-logo" /></span>
            <span className="font-display text-xl">bayzati</span>
          </div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
            <BarChart3 className="size-4 text-primary" />
            <span>One view for the money decisions that matter.</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-border bg-card px-3 py-1.5 font-mono-data text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:inline-flex">Dubai · AED</span>
            <span className="size-2 rounded-full bg-[hsl(var(--chart-3))]" title="Connected" />
          </div>
        </header>
        <main className="mx-auto max-w-[1320px] px-5 py-8 pb-24 md:px-10 md:py-10">{children}</main>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-2xl border border-border/80 bg-card/95 p-2 shadow-lg backdrop-blur-md md:hidden" aria-label="Mobile navigation">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = location === href;
          return (
            <Link key={href} href={href} className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] ${active ? 'bg-secondary text-primary' : 'text-muted-foreground'}`} data-testid={`link-mobile-${href.slice(1) || 'calendar'}`}>
              <Icon className="size-4" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
