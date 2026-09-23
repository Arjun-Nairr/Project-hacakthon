import { useMemo, useState } from 'react';
import { ArrowUpRight, Check, CircleAlert, Clock3, CloudSun, Info, Loader2, ShieldCheck, Sparkles, Wind } from 'lucide-react';
import { Link } from 'wouter';
import { getGetMoneyCalendarQueryKey, useGetMoneyCalendar, useRunStressTest, type MoneyCalendar, type StressResult } from '@workspace/api-client-react';

const money = (value: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(Math.round(value));
const moneyShort = (value: number) => `AED ${money(value)}`;

function CalendarSkeleton() {
  return <div className="space-y-5" data-testid="loading-calendar"><div className="h-44 animate-pulse rounded-3xl bg-muted" /><div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><div className="h-80 animate-pulse rounded-2xl bg-muted" /><div className="h-80 animate-pulse rounded-2xl bg-muted" /></div></div>;
}

function EventRow({ event }: { event: MoneyCalendar['events'][number] }) {
  const kindStyles: Record<string, string> = {
    income: 'bg-[hsl(var(--chart-3)/.16)] text-[hsl(var(--chart-3))]',
    fixed: 'bg-[hsl(var(--chart-4)/.13)] text-[hsl(var(--chart-4))]',
    lump: 'bg-[hsl(var(--chart-2)/.18)] text-[hsl(var(--primary))]',
    goal: 'bg-secondary text-primary',
  };
  return (
    <div className="group flex items-center gap-4 border-b border-border/70 py-3.5 last:border-0" data-testid={`row-event-${event.id}`}>
      <div className="w-8 text-center">
        <span className="font-mono-data text-[11px] text-muted-foreground">DAY</span>
        <span className="mt-0.5 block text-lg leading-none text-foreground">{event.day}</span>
      </div>
      <div className={`size-2 shrink-0 rounded-full ${event.kind === 'income' ? 'bg-[hsl(var(--chart-3))]' : event.kind === 'goal' ? 'bg-accent' : 'bg-[hsl(var(--chart-4))]'}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{event.label}</p>
        {event.note && <p className="mt-0.5 truncate text-xs text-muted-foreground">{event.note}</p>}
      </div>
      <span className={`rounded-full px-2 py-1 font-mono-data text-[10px] ${kindStyles[event.kind] ?? 'bg-muted text-muted-foreground'}`}>{event.kind === 'income' ? '+' : '−'}{money(event.amount)}</span>
    </div>
  );
}

function EmptyCalendarState() {
  return <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center" data-testid="empty-calendar"><Wind className="mx-auto mb-3 size-7 text-muted-foreground/50" /><p className="font-display text-2xl">A quiet month ahead</p><p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">No cash-flow events are on this calendar yet. When they arrive, this is where the shape of your month will show up.</p></div>;
}

function StressCard({ calendar, result, onResult }: { calendar: MoneyCalendar; result: StressResult | undefined; onResult: (value: StressResult) => void }) {
  const stress = useRunStressTest();
  const income = (calendar.income?.basic ?? 0) + (calendar.income?.housingAllowance ?? 0) + (calendar.income?.variable ?? 0);
  const commitments = calendar.events.filter((event) => event.kind === 'fixed' || event.kind === 'lump').reduce((sum, event) => sum + event.amount, 0);
  const run = () => stress.mutate({ data: { monthlyIncome: income, monthlyCommitments: commitments, buffer: calendar.bufferTarget, rateIncrease: 1.5, priceDrop: 10, noIncomeMonths: 3 } }, { onSuccess: onResult });
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="card-stress-test">
      <div className="flex items-start justify-between gap-4">
        <div><div className="mb-2 flex items-center gap-2 text-[hsl(var(--primary))]"><ShieldCheck className="size-4" /><span className="font-mono-data text-[10px] uppercase tracking-[.16em]">Quiet confidence check</span></div><h2 className="font-display text-2xl">What if income pauses?</h2><p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">A small reality check before a big commitment. Three months without salary, plus a rate bump.</p></div>
        <div className="hidden size-12 place-items-center rounded-full bg-secondary sm:grid"><CloudSun className="size-5 text-primary" /></div>
      </div>
      {result ? <div className="mt-5 rounded-xl bg-secondary/60 p-4"><p className="text-sm font-medium">{result.headline}</p><div className="mt-3 grid grid-cols-3 gap-3"><div><p className="font-mono-data text-lg text-primary">{result.monthsSurvived}</p><p className="text-[10px] text-muted-foreground">months covered</p></div><div><p className="font-mono-data text-lg text-primary">{moneyShort(result.stressedMonthlyCommitment)}</p><p className="text-[10px] text-muted-foreground">stressed monthly</p></div><div><p className="font-mono-data text-lg text-primary">{moneyShort(result.endingBuffer)}</p><p className="text-[10px] text-muted-foreground">ending buffer</p></div></div></div> : <button onClick={run} disabled={stress.isPending} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60" data-testid="button-run-stress">{stress.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Run the quiet check</button>}
    </section>
  );
}

export default function MoneyCalendarPage() {
  const { data: calendar, isLoading, isError, refetch } = useGetMoneyCalendar({ query: { queryKey: getGetMoneyCalendarQueryKey() } });
  const [stressResult, setStressResult] = useState<StressResult>();
  const [stayingPut, setStayingPut] = useState(false);
  const pendingHome = typeof window !== 'undefined' ? window.sessionStorage.getItem('money-calendar-home-plan') : null;
  const events = useMemo(() => [...(calendar?.events ?? [])].sort((a, b) => a.day - b.day), [calendar?.events]);

  if (isLoading) return <CalendarSkeleton />;
  if (isError || !calendar) return <div className="mx-auto max-w-md rounded-2xl border border-[hsl(var(--destructive)/.25)] bg-card p-8 text-center" data-testid="error-calendar"><CircleAlert className="mx-auto mb-3 size-8 text-destructive" /><h1 className="font-display text-3xl">The calendar is taking a breath.</h1><p className="mt-2 text-sm text-muted-foreground">We couldn't load your seeded month. Your decisions are still safe.</p><button onClick={() => refetch()} className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" data-testid="button-retry-calendar">Try again</button></div>;

  const incomeTotal = (calendar.income?.basic ?? 0) + (calendar.income?.housingAllowance ?? 0) + (calendar.income?.variable ?? 0);
  return (
    <div className="space-y-7">
      <section className="reveal flex flex-col justify-between gap-5 sm:flex-row sm:items-end" data-testid="section-calendar-intro">
        <div><div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-[hsl(var(--chart-3))]" />{calendar.persona}<span className="text-border">/</span>{calendar.monthLabel}</div><h1 className="font-display text-5xl leading-[.95] tracking-tight text-primary md:text-6xl">Your month,<br /><em className="text-foreground">made legible.</em></h1><p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">The amount you can spend with a clear head, after life has taken its share.</p></div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-4 text-primary" />Payday projected on the {calendar.projectedPayday}th</div>
      </section>

      {pendingHome && <div className="reveal-delay-1 reveal flex items-center justify-between gap-4 rounded-xl border border-accent/50 bg-accent/15 px-4 py-3" data-testid="status-home-plan"><div className="flex items-center gap-3"><Sparkles className="size-4 text-primary" /><p className="text-sm"><span className="font-semibold">Home decision held for review.</span> Your calendar is ready when you are.</p></div><button onClick={() => window.sessionStorage.removeItem('money-calendar-home-plan')} className="text-xs font-semibold text-primary underline-offset-4 hover:underline" data-testid="button-dismiss-home-plan">Dismiss</button></div>}

      <section className="reveal reveal-delay-1 overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-lg" data-testid="card-safe-to-spend">
        <div className="relative grid gap-8 p-6 md:grid-cols-[1.1fr_.9fr] md:p-9">
          <div className="absolute -right-20 -top-28 size-80 rounded-full border border-primary-foreground/10" /><div className="absolute -right-4 -top-12 size-52 rounded-full border border-primary-foreground/10" />
          <div className="relative"><div className="mb-10 flex items-center gap-2 text-[11px] uppercase tracking-[.17em] text-primary-foreground/60"><span className="size-2 rounded-full bg-accent" />Safe to spend</div><p className="font-mono-data text-5xl tracking-[-.07em] md:text-7xl" data-testid="text-safe-to-spend">AED {money(calendar.safeToSpend)}</p><p className="mt-3 max-w-sm text-sm leading-5 text-primary-foreground/70">Available after your known commitments, with a {moneyShort(calendar.bufferTarget)} breathing room.</p></div>
          <div className="relative grid grid-cols-2 gap-3 self-end md:pb-1"><div className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 p-4"><p className="font-mono-data text-[10px] uppercase tracking-[.13em] text-primary-foreground/55">Tightest day</p><p className="mt-2 text-2xl font-medium">Day {calendar.tightDay}</p><p className="mt-1 text-xs text-primary-foreground/60">Keep a little space here</p></div><div className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 p-4"><p className="font-mono-data text-[10px] uppercase tracking-[.13em] text-primary-foreground/55">Monthly income</p><p className="mt-2 text-2xl font-medium">{moneyShort(incomeTotal)}</p><p className="mt-1 text-xs text-primary-foreground/60">Before commitments</p></div></div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
        <section className="reveal reveal-delay-2 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6" data-testid="section-cash-flow">
          <div className="mb-4 flex items-start justify-between"><div><p className="font-mono-data text-[10px] uppercase tracking-[.16em] text-muted-foreground">Cash-flow map</p><h2 className="mt-1 font-display text-3xl">The shape of {calendar.monthLabel}</h2></div><span className="rounded-full bg-secondary px-2.5 py-1 font-mono-data text-[10px] text-primary">{events.length} signals</span></div>
          <div className="calendar-grid mb-4 grid grid-cols-7 overflow-hidden rounded-xl border border-border/60 bg-background/50 px-2 py-2 text-center font-mono-data text-[9px] uppercase tracking-[.12em] text-muted-foreground"><span>01</span><span>05</span><span>10</span><span>15</span><span>20</span><span>25</span><span>30</span></div>
          {events.length ? <div>{events.map((event) => <EventRow key={event.id} event={event} />)}</div> : <EmptyCalendarState />}
        </section>
        <div className="reveal reveal-delay-3 space-y-5">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="section-decision-path"><div className="mb-5 flex items-center justify-between"><div><p className="font-mono-data text-[10px] uppercase tracking-[.16em] text-muted-foreground">Your next question</p><h2 className="mt-1 font-display text-2xl">Name the decision.</h2></div><ArrowUpRight className="size-5 text-primary" /></div><div className="space-y-2"><Link href="/loan" className="soft-lift flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3.5" data-testid="link-loan-decision"><span><span className="block text-sm font-medium">Can I safely borrow?</span><span className="mt-0.5 block text-xs text-muted-foreground">Run the legal + calendar lens</span></span><ArrowUpRight className="size-4 text-primary" /></Link><Link href="/home" className="soft-lift flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3.5" data-testid="link-home-decision"><span><span className="block text-sm font-medium">Rent or buy?</span><span className="mt-0.5 block text-xs text-muted-foreground">See what your horizon can carry</span></span><ArrowUpRight className="size-4 text-primary" /></Link></div><button onClick={() => setStayingPut((value) => !value)} className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm transition-colors ${stayingPut ? 'border-[hsl(var(--chart-3)/.45)] bg-[hsl(var(--chart-3)/.1)] text-[hsl(var(--chart-3))]' : 'border-border text-muted-foreground hover:bg-muted'}`} data-testid="button-do-nothing">{stayingPut ? <Check className="size-4" /> : <Info className="size-4" />} {stayingPut ? 'A clear no is still a decision.' : 'Do nothing for now'}</button></section>
          <StressCard calendar={calendar} result={stressResult} onResult={setStressResult} />
        </div>
      </div>

      <section className="border-t border-border pt-5" data-testid="section-assumptions"><div className="flex items-center gap-2 text-xs font-semibold text-foreground"><Info className="size-4 text-primary" />What this view assumes</div><div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">{calendar.assumptions.map((assumption, index) => <p key={assumption} className="text-xs text-muted-foreground"><span className="mr-2 font-mono-data text-primary">0{index + 1}</span>{assumption}</p>)}</div></section>
    </div>
  );
}
