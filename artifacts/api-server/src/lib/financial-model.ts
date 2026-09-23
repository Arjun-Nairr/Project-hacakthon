import type { FinancialProfile, ProfileCommitment, ProfileGoal } from "@workspace/api-zod";

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
  source: string;
  freshness: Date;
  balanceAfter?: number;
  note?: string;
  isDebtPayment?: boolean;
  isGoalContribution?: boolean;
};

export type ImportedRecordStatus = "needs-review" | "duplicate" | "accepted" | "rejected";

export type FinancialFacts = {
  asOf: string;
  currency: "AED";
  currentAvailableBalance: number;
  recommendedEmergencyBuffer: number;
  projectedPayday: number;
  events: FinancialEvent[];
};

const profilePaymentType: Record<string, FinancialEvent["paymentType"]> = {
  Housing: "rent",
  Loan: "loan",
  School: "school",
  Insurance: "insurance",
  Family: "goal",
  Other: "goal",
};

function monthsUntilGoal(date: string, month = "2026-09") {
  const [year, monthNumber] = date.split("-").map(Number);
  const [currentYear, currentMonth] = month.split("-").map(Number);
  return Math.max(1, (year - currentYear) * 12 + monthNumber - currentMonth + 1);
}

type StoredFinancialProfile = Omit<FinancialProfile, "commitments" | "goals"> & {
  commitments: ProfileCommitment[];
  goals: ProfileGoal[];
};

export function profileToFinancialFacts(profile: StoredFinancialProfile): FinancialFacts {
  const monthlyIncome = profile.basicSalary + profile.housingAllowance + profile.variableIncome;
  const commitmentsTotal = profile.commitments.reduce((total, commitment) => total + commitment.amount, 0);
  const bufferTarget = profile.bufferPreference === "custom"
    ? profile.bufferAmount
    : Math.max(2_500, commitmentsTotal * 0.75);
  const profileEvents: FinancialEvent[] = [
    {
      id: "profile-salary",
      label: "Monthly income",
      amount: monthlyIncome,
      day: profile.payday,
      kind: "income",
      paymentType: "salary",
      status: "forecasted",
      confidence: "high",
      amountType: "fixed",
      accountName: profile.mainAccount,
      reviewed: profile.reviewed,
      source: profile.source,
      freshness: profile.freshness,
      note: `${profile.payFrequency} · basic salary${profile.housingAllowance ? " + housing allowance" : ""}`,
    },
    ...profile.commitments.map((commitment, index): FinancialEvent => ({
      id: `profile-commitment-${index + 1}`,
      label: commitment.name,
      amount: commitment.amount,
      day: commitment.day,
      kind: "fixed",
      paymentType: profilePaymentType[commitment.category] ?? "goal",
      status: "forecasted",
      confidence: commitment.confidence,
      amountType: "fixed",
      accountName: profile.mainAccount,
      reviewed: commitment.reviewed,
      source: commitment.source,
      freshness: commitment.freshness,
      note: `${commitment.category} commitment`,
      isDebtPayment: commitment.category === "Loan",
    })),
    ...profile.goals.map((goal, index): FinancialEvent => ({
      id: `profile-goal-${index + 1}`,
      label: `${goal.name} contribution`,
      amount: Math.ceil(goal.target / monthsUntilGoal(goal.date)),
      day: profile.payday,
      kind: "goal",
      paymentType: "goal",
      status: "forecasted",
      confidence: goal.confidence,
      amountType: "fixed",
      accountName: profile.mainAccount,
      reviewed: goal.reviewed,
      source: goal.source,
      freshness: goal.freshness,
      note: `Target AED ${Math.round(goal.target).toLocaleString()} by ${goal.date}`,
      isGoalContribution: true,
    })),
  ];

  return {
    asOf: "2026-09-01",
    currency: "AED",
    currentAvailableBalance: profile.availableBalance,
    recommendedEmergencyBuffer: bufferTarget,
    projectedPayday: profile.payday,
    events: profileEvents,
  };
}

export function findTightDay(facts: FinancialFacts) {
  let balance = facts.currentAvailableBalance;
  let lowestBalance = balance;
  let tightDay = facts.projectedPayday;
  for (const event of [...facts.events].sort((a, b) => a.day - b.day)) {
    balance += event.kind === "income" ? event.amount : -event.amount;
    if (balance < lowestBalance) {
      lowestBalance = balance;
      tightDay = event.day;
    }
  }
  return tightDay;
}

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
