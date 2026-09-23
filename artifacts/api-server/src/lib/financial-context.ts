import { buildCalendar } from "../routes/money";

export type FinancialContext = {
  asOf: string;
  currency: "AED";
  monthLabel: string;
  safeToSpend: number;
  bufferTarget: number;
  tightDay: number;
  projectedPayday: number;
  income: { basic: number; housingAllowance: number; variable: number };
  snapshot: {
    currentAvailableBalance: number;
    expectedIncomeBeforeNextPayday: number;
    billsAndCommitmentsDueBeforeNextPayday: number;
    minimumDebtPayments: number;
    plannedGoalContributions: number;
    recommendedEmergencyBuffer: number;
  };
  upcomingEvents: Array<{
    label: string;
    amount: number;
    day: number;
    kind: string;
    status: string;
    confidence: string;
  }>;
};

type Calendar = Awaited<ReturnType<typeof buildCalendar>>;

const MAX_CONTEXT_EVENTS = 30;

/** Pure: reshapes an already-built money calendar into a compact, LLM-sized context.
 * Caps events to the nearest MAX_CONTEXT_EVENTS by day, so the context stays small
 * even for a household with a long history of imported records. */
export function toFinancialContext(calendar: Calendar): FinancialContext {
  return {
    asOf: calendar.financialSnapshot.asOf,
    currency: "AED",
    monthLabel: calendar.monthLabel,
    safeToSpend: calendar.safeToSpend,
    bufferTarget: calendar.bufferTarget,
    tightDay: calendar.tightDay,
    projectedPayday: calendar.projectedPayday,
    income: calendar.income ?? { basic: 0, housingAllowance: 0, variable: 0 },
    snapshot: {
      currentAvailableBalance: calendar.financialSnapshot.currentAvailableBalance,
      expectedIncomeBeforeNextPayday: calendar.financialSnapshot.expectedIncomeBeforeNextPayday,
      billsAndCommitmentsDueBeforeNextPayday: calendar.financialSnapshot.billsAndCommitmentsDueBeforeNextPayday,
      minimumDebtPayments: calendar.financialSnapshot.minimumDebtPayments,
      plannedGoalContributions: calendar.financialSnapshot.plannedGoalContributions,
      recommendedEmergencyBuffer: calendar.financialSnapshot.recommendedEmergencyBuffer,
    },
    upcomingEvents: [...calendar.events]
      .sort((a, b) => a.day - b.day)
      .slice(0, MAX_CONTEXT_EVENTS)
      .map((event) => ({
        label: event.label,
        amount: event.amount,
        day: event.day,
        kind: event.kind,
        status: event.status,
        confidence: event.confidence,
      })),
  };
}

/** Reads the existing calendar/profile/import services; no second persistence layer. */
export async function getFinancialContext(): Promise<FinancialContext> {
  return toFinancialContext(await buildCalendar());
}
