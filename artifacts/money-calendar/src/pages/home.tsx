import { useMemo, useState, useEffect } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, ChevronRight, ChevronDown, CircleAlert, CircleHelp, ShieldCheck, Target, TrendingDown, Wallet } from 'lucide-react';
import { Link } from 'wouter';
import { getGetMoneyCalendarQueryKey, useGetMoneyCalendar, type FinancialSnapshot, type CalendarEvent } from '@workspace/api-client-react';
import { BayzatiMobileShell } from '@/components/bayzati-mobile-shell';
import { getManualEvents, getReviewedEvents } from '@/lib/local-calendar';

const money = (value: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(Math.round(value));

function getNextPayday(asOfDate: Date, projectedPayday: number) {
  const year = asOfDate.getFullYear();
  const month = asOfDate.getMonth();
  const currentDay = asOfDate.getDate();

  let targetMonth = month;
  let targetYear = year;

  if (currentDay >= projectedPayday) {
    targetMonth = month + 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear = year + 1;
    }
  }

  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const actualPayday = Math.min(projectedPayday, daysInTargetMonth);

  return new Date(targetYear, targetMonth, actualPayday);
}

function getEventDate(eventDay: number, asOfDate: Date) {
  const year = asOfDate.getFullYear();
  const month = asOfDate.getMonth();
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(eventDay, daysInCurrentMonth));
}

function getStatus(snapshot: FinancialSnapshot, events: CalendarEvent[], tightDay: number, safeToSpend: number, reviewNeedsCount: number) {
  const asOf = new Date(snapshot.asOf);
  const currentDay = asOf.getDate();
  const pendingCommitments = events.filter(e => e.kind !== 'income' && (e.status === 'pending' || e.status === 'overdue'));
  const hasOverdue = pendingCommitments.some(e => e.status === 'overdue');

  if (safeToSpend <= 0) {
    return { tone: 'danger' as const, text: 'Cash is stretched', detail: 'Safe to spend is depleted before payday.', icon: TrendingDown };
  }

  if (hasOverdue) {
    return { tone: 'warning' as const, text: 'Action needed', detail: 'Some commitments are marked as overdue.', icon: CircleAlert };
  }

  if (reviewNeedsCount > 0) {
    return { tone: 'warning' as const, text: 'Forecast needs review', detail: 'On-track status depends on confirmation.', icon: CircleAlert };
  }

  if (currentDay >= tightDay - 3 && currentDay <= tightDay + 3) {
    return { tone: 'warning' as const, text: 'Tight days ahead', detail: `Keep your buffer untouched around the ${tightDay}th.`, icon: CircleAlert };
  }

  return { tone: 'success' as const, text: 'On track', detail: 'Sufficient safe-to-spend for the days ahead.', icon: CheckCircle2 };
}

type ViewStatus = ReturnType<typeof getStatus>;

type DashboardSummary = {
  dailyAllowance: number;
  daysLeft: number;
  nextPaydayDate: Date | null;
  status: ViewStatus | null;
  reviewNeeds: CalendarEvent[];
  upcoming: Array<CalendarEvent & { actualDate: Date }>;
  effectiveSafeToSpend: number;
  effectiveCommitmentsDue: number;
};

export default function HomePage() {
  const { data: calendar, isLoading, isError, refetch } = useGetMoneyCalendar({ query: { queryKey: getGetMoneyCalendarQueryKey() } });

  const [manualEvents, setManualEvents] = useState<CalendarEvent[]>([]);
  const [reviewedEvents, setReviewedEvents] = useState<Record<string, boolean>>({});
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    setManualEvents(getManualEvents());
    setReviewedEvents(getReviewedEvents());
  }, []);

  const { dailyAllowance, daysLeft, nextPaydayDate, status, reviewNeeds, upcoming, effectiveSafeToSpend, effectiveCommitmentsDue } = useMemo<DashboardSummary>(() => {
    if (!calendar) {
      return {
        dailyAllowance: 0,
        daysLeft: 0,
        nextPaydayDate: null,
        status: null,
        reviewNeeds: [],
        upcoming: [],
        effectiveSafeToSpend: 0,
        effectiveCommitmentsDue: 0,
      };
    }

    const asOfDate = new Date(calendar.financialSnapshot.asOf);
    const nextPayday = getNextPayday(asOfDate, calendar.projectedPayday);

    const diffTime = nextPayday.getTime() - asOfDate.getTime();
    let daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (daysLeft <= 0) daysLeft = 1;

    const allEvents = [...calendar.events, ...manualEvents];

    const manualCommitmentsInCycle = manualEvents.filter(e => {
      if (e.kind === 'income') return false;
      const eventDate = getEventDate(e.day, asOfDate);
      return eventDate >= asOfDate && eventDate < nextPayday;
    });
    const manualCommitmentsAmount = manualCommitmentsInCycle.reduce((sum, e) => sum + e.amount, 0);

    const effectiveSafeToSpend = calendar.financialSnapshot.safeToSpendUntilPayday - manualCommitmentsAmount;
    const effectiveCommitmentsDue = calendar.financialSnapshot.billsAndCommitmentsDueBeforeNextPayday + manualCommitmentsAmount;

    const dailyAllowance = effectiveSafeToSpend / daysLeft;

    const reviewNeeds = calendar.events.filter(e => {
      const isReviewed = reviewedEvents[e.id] ?? e.reviewed;
      return !isReviewed && (e.status === 'forecasted' || e.status === 'pending');
    });

    const currentStatus = getStatus(calendar.financialSnapshot, calendar.events, calendar.tightDay, effectiveSafeToSpend, reviewNeeds.length);

    const upcoming = allEvents
      .filter(e => e.kind !== 'income')
      .map(e => ({ ...e, actualDate: getEventDate(e.day, asOfDate) }))
      .filter(e => e.actualDate >= asOfDate)
      .sort((a,b) => a.actualDate.getTime() - b.actualDate.getTime());

    return {
      dailyAllowance,
      daysLeft,
      nextPaydayDate: nextPayday,
      status: currentStatus,
      reviewNeeds,
      upcoming,
      effectiveSafeToSpend,
      effectiveCommitmentsDue
    };
  }, [calendar, manualEvents, reviewedEvents]);

  if (isLoading) {
    return (
      <BayzatiMobileShell active="home">
        <div className="space-y-5 py-5" data-testid="loading-dashboard">
          <div className="h-48 animate-pulse rounded-[18px] bg-[#E4E7EC]" />
          <div className="h-32 animate-pulse rounded-[18px] bg-[#E4E7EC]" />
          <div className="h-40 animate-pulse rounded-[18px] bg-[#E4E7EC]" />
        </div>
      </BayzatiMobileShell>
    );
  }

  if (isError || !calendar || !status || !nextPaydayDate) {
    return (
      <BayzatiMobileShell active="home">
        <div className="mt-10 rounded-[18px] border border-[#D20A58]/25 bg-white p-8 text-center" data-testid="error-dashboard">
          <CircleHelp className="mx-auto mb-3 size-8 text-[#D20A58]" />
          <h1 className="text-2xl font-bold text-[#003B73]">We couldn't load your view.</h1>
          <p className="mt-2 text-sm text-[#667085]">Your data is safe, but we're having trouble reaching it.</p>
          <button onClick={() => refetch()} className="mt-5 rounded-xl bg-[#003B73] px-4 py-3 text-sm font-semibold text-white">
            Try again
          </button>
        </div>
      </BayzatiMobileShell>
    );
  }

  const StatusIcon = status.icon;
  const statusColor = status.tone === 'success' ? 'text-[#12A66A] bg-[#12A66A]/10' : status.tone === 'warning' ? 'text-[#F59E0B] bg-[#F59E0B]/10' : 'text-[#D20A58] bg-[#D20A58]/10';
  const hasLocalAdditions = manualEvents.length > 0;

  return (
    <BayzatiMobileShell active="home">
      <div data-testid="page-dashboard-home">
        <header className="mt-7 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#667085]">Overview</p>
            <h1 className="mt-1 text-[28px] font-bold leading-none tracking-[-.04em] text-[#003B73]">
              Your money today.
            </h1>
          </div>
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold ${statusColor}`} data-testid="status-indicator">
            <StatusIcon className="size-3.5" />
            <span>{status.text}</span>
          </div>
        </header>

        <section className="mt-6 overflow-hidden rounded-[18px] bg-[#003B73] p-5 text-white shadow-md" data-testid="card-daily-allowance">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.13em] text-[#EAF6FD]">
              <ShieldCheck size={14} className="text-[#139BE8]" /> Daily allowance
            </p>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-[#C4E5EF]">
              Next {daysLeft} days
            </span>
          </div>

          <div className="mt-4 flex items-baseline gap-2">
            <p className="text-[42px] font-bold tabular-nums leading-none tracking-[-.07em]" data-testid="text-daily-allowance">
              AED {money(dailyAllowance)}
            </p>
            <span className="text-[12px] font-medium text-[#C4E5EF]">/ day</span>
          </div>

          <p className="mt-3 text-[12px] leading-5 text-[#EAF6FD]">
            Your safe-to-spend divided until your projected payday on {nextPaydayDate.toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/15 pt-4">
            <div>
              <p className="text-[10px] text-[#98A2B3]">Safe to spend total</p>
              <p className="mt-1 text-[14px] font-bold" data-testid="text-safe-to-spend">AED {money(effectiveSafeToSpend)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#98A2B3]">Emergency buffer</p>
              <p className="mt-1 text-[14px] font-bold text-[#55D5EE]">AED {money(calendar.bufferTarget)}</p>
            </div>
          </div>
        </section>

        {hasLocalAdditions && (
          <p className="mt-3 text-center text-[10px] text-[#667085]">
            <CheckCircle2 className="inline size-3 text-[#12A66A] mr-1" />
            Your local device calendar additions are included in this estimate.
          </p>
        )}

        <section className="mt-4 rounded-[18px] border border-[#E4E7EC] bg-white p-4" data-testid="card-commitments-status">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-[#F2F4F7] text-[#003B73]">
                <Wallet className="size-4" />
              </span>
              <h2 className="text-[16px] font-bold text-[#003B73]">Commitments</h2>
            </div>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${statusColor}`}>
              <StatusIcon className="size-3" />
              {status.text}
            </span>
          </div>

          <p className="mb-4 text-[12px] leading-5 text-[#667085]">{status.detail}</p>

          <div className="grid grid-cols-2 gap-3 border-t border-[#F2F4F7] pt-4">
            <div>
              <p className="text-[10px] text-[#98A2B3]">Due before payday</p>
              <p className="mt-1 text-[14px] font-bold text-[#003B73]">AED {money(effectiveCommitmentsDue)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#98A2B3]">Minimum debt</p>
              <p className="mt-1 text-[14px] font-bold text-[#003B73]">AED {money(calendar.financialSnapshot.minimumDebtPayments)}</p>
            </div>
          </div>
        </section>

        {reviewNeeds.length > 0 && (
          <section className="mt-4 rounded-[18px] border border-[#F59E0B]/25 bg-[#FFFBEB] p-4" data-testid="card-review-needs">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[#F59E0B]">
                <CircleAlert className="size-4" />
              </span>
              <div>
                <h3 className="text-[15px] font-bold text-[#003B73]">Review needed</h3>
                <p className="mt-1 text-[11px] leading-5 text-[#667085]">
                  You have {reviewNeeds.length} forecasted {reviewNeeds.length === 1 ? 'item' : 'items'} that need confirmation before they shape your plan.
                </p>
                <Link href="/calendar" className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#D20A58]">
                  Review in calendar <ChevronRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </section>
        )}

        <div className="mt-4 grid grid-cols-2 gap-4">
          <Link href="/calendar" className="group flex flex-col justify-between rounded-[18px] border border-[#E4E7EC] bg-white p-4 transition-shadow hover:shadow-sm">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="grid size-8 place-items-center rounded-full bg-[#F2F4F7] text-[#667085] transition-colors group-hover:bg-[#EAF6FD] group-hover:text-[#139BE8]">
                  <CalendarDays className="size-4" />
                </span>
                {upcoming.length > 0 && (
                  <span className="text-[10px] font-semibold text-[#D20A58]">
                    {upcoming[0].actualDate.getDate()} {calendar.monthLabel.split(' ')[0]?.slice(0,3)}
                  </span>
                )}
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-[#98A2B3]">Coming up</p>
              <h3 className="mt-1 truncate text-[14px] font-bold text-[#003B73]">
                {upcoming.length > 0 ? upcoming[0].label : 'Nothing scheduled'}
              </h3>
              <p className="mt-1 text-[11px] text-[#667085]">
                {upcoming.length > 0 ? `AED ${money(upcoming[0].amount)}` : 'A quiet week'}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[#F2F4F7] pt-3 text-[10px] font-semibold text-[#139BE8]">
              <span>View calendar</span>
              <ArrowRight className="size-3" />
            </div>
          </Link>

          <Link href="/goals" className="group flex flex-col justify-between rounded-[18px] border border-[#E4E7EC] bg-white p-4 transition-shadow hover:shadow-sm">
            <div>
              <span className="mb-3 grid size-8 place-items-center rounded-full bg-[#F2F4F7] text-[#667085] transition-colors group-hover:bg-[#EAF6FD] group-hover:text-[#139BE8]">
                <Target className="size-4" />
              </span>
              <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-[#98A2B3]">Goals</p>
              <h3 className="mt-1 text-[14px] font-bold text-[#003B73]">
                AED {money(calendar.financialSnapshot.plannedGoalContributions)}
              </h3>
              <p className="mt-1 text-[11px] text-[#667085]">Planned contributions</p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[#F2F4F7] pt-3 text-[10px] font-semibold text-[#139BE8]">
              <span>Manage goals</span>
              <ArrowRight className="size-3" />
            </div>
          </Link>
        </div>

        <div className="mt-6 rounded-[18px] border border-[#E4E7EC] bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="flex w-full cursor-pointer items-center justify-between p-4 text-[13px] font-bold text-[#003B73] outline-none"
            data-testid="button-toggle-audit-details"
          >
            <span>How this is calculated</span>
            <ChevronDown className={`size-4 text-[#667085] transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
          </button>

          {detailsOpen && (
            <div className="border-t border-[#F2F4F7] p-4 pt-3 text-[11px] leading-5 text-[#667085]" data-testid="section-audit-details">
              <div className="space-y-2">
                <div className="flex justify-between"><span>Current available balance</span> <span className="font-semibold text-[#17212B]">AED {money(calendar.financialSnapshot.currentAvailableBalance)}</span></div>
                <div className="flex justify-between"><span>Expected income</span> <span className="font-semibold text-[#17212B]">AED {money(calendar.financialSnapshot.expectedIncomeBeforeNextPayday)}</span></div>
                <div className="flex justify-between"><span>Commitments due</span> <span className="font-semibold text-[#17212B]">AED {money(effectiveCommitmentsDue)}</span></div>
                <div className="flex justify-between"><span>Minimum debt</span> <span className="font-semibold text-[#17212B]">AED {money(calendar.financialSnapshot.minimumDebtPayments)}</span></div>
                <div className="flex justify-between"><span>Planned goals</span> <span className="font-semibold text-[#17212B]">AED {money(calendar.financialSnapshot.plannedGoalContributions)}</span></div>
                <div className="flex justify-between"><span>Emergency buffer</span> <span className="font-semibold text-[#17212B]">AED {money(calendar.financialSnapshot.recommendedEmergencyBuffer)}</span></div>
                <div className="mt-2 flex justify-between border-t border-[#F2F4F7] pt-2 font-bold text-[#003B73]"><span>Safe to spend</span> <span>AED {money(effectiveSafeToSpend)}</span></div>
              </div>
              <div className="mt-4 space-y-1 text-[10px]">
                <p>Data freshness: {new Date(calendar.financialSnapshot.asOf).toLocaleString('en-AE')}</p>
                <p>Assumptions: {calendar.assumptions.join(' · ')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </BayzatiMobileShell>
  );
}
