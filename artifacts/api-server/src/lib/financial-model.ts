export type FinancialEventKind = "income" | "fixed" | "lump" | "goal";
export type FinancialEventStatus = "actual" | "forecasted" | "pending" | "overdue";
export type FinancialEventConfidence = "high" | "medium" | "low";
export type FinancialAmountType = "fixed" | "variable" | "range";

export type FinancialEvent = {
  id: string;
  label: string;
  amount: number;
  day: number;
  kind: FinancialEventKind;
  paymentType: "salary" | "rent" | "loan" | "school" | "credit-card" | "insurance" | "goal";
  status: FinancialEventStatus;
  confidence: FinancialEventConfidence;
  amountType: FinancialAmountType;
  accountName: string;
  reviewed: boolean;
  balanceAfter?: number;
  note?: string;
  isDebtPayment?: boolean;
  isGoalContribution?: boolean;
};

export type FinancialFacts = {
  asOf: string;
  currency: "AED";
  currentAvailableBalance: number;
  recommendedEmergencyBuffer: number;
  projectedPayday: number;
  events: FinancialEvent[];
};

export function calculateFinancialSnapshot(facts: FinancialFacts) {
  const incomeBeforePayday = facts.events
    .filter((event) => event.kind === "income" && event.day <= facts.projectedPayday)
    .reduce((total, event) => total + event.amount, 0);
  const commitmentsBeforePayday = facts.events
    .filter((event) => event.kind !== "income" && event.day <= facts.projectedPayday)
    .reduce((total, event) => total + event.amount, 0);
  const minimumDebtPayments = facts.events
    .filter((event) => event.isDebtPayment)
    .reduce((total, event) => total + event.amount, 0);
  const plannedGoalContributions = facts.events
    .filter((event) => event.isGoalContribution)
    .reduce((total, event) => total + event.amount, 0);
  const safeToSpend = Math.max(
    0,
    facts.currentAvailableBalance +
      incomeBeforePayday -
      commitmentsBeforePayday -
      facts.recommendedEmergencyBuffer,
  );
  const scenarios = [0, 500, 2_000, 10_000].map((spendAmount) => ({
    spendAmount,
    safeToSpendAfter: safeToSpend - spendAmount,
  }));

  return {
    asOf: facts.asOf,
    currency: facts.currency,
    currentAvailableBalance: facts.currentAvailableBalance,
    expectedIncomeBeforeNextPayday: incomeBeforePayday,
    billsAndCommitmentsDueBeforeNextPayday: commitmentsBeforePayday,
    minimumDebtPayments,
    plannedGoalContributions,
    recommendedEmergencyBuffer: facts.recommendedEmergencyBuffer,
    safeToSpendUntilPayday: safeToSpend,
    safeToSpendThisMonth: safeToSpend,
    scenarios,
  };
}
