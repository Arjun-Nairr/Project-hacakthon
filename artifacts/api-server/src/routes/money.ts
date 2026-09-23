import { Router, type IRouter } from "express";
import {
  CheckAffordabilityBody,
  CheckAffordabilityResponse,
  CompareRentVsBuyBody,
  CompareRentVsBuyResponse,
  RunStressTestBody,
  RunStressTestResponse,
  GetMoneyCalendarResponse,
} from "@workspace/api-zod";
import {
  calculateFinancialSnapshot,
  findTightDay,
  profileToFinancialFacts,
  type FinancialEvent,
  type FinancialFacts,
} from "../lib/financial-model";
import { getAcceptedImportedEvents } from "../lib/imports";
import { getFinancialProfile } from "../lib/profile";
import { calculateAmortisation, calculateDebtBurden, calculateDubaiPurchaseCosts } from "../lib/money-engine";
import { ruleAssumption, ruleNumber } from "../lib/uae-rules";

const router: IRouter = Router();

const income = {
  basic: 22_000,
  housingAllowance: 3_000,
  variable: 0,
};

const bufferTarget = 15_000;
const seededSource = "seeded-demo";
const seededFreshness = new Date("2026-09-01T00:00:00.000Z");

const eventDefinitions: FinancialEvent[] = [
  {
    id: "salary",
    label: "Salary",
    amount: 25_000,
    day: 1,
    kind: "income",
    paymentType: "salary",
    status: "forecasted",
    confidence: "high",
    amountType: "fixed",
    accountName: "Main current account",
    reviewed: true,
    source: seededSource,
    freshness: seededFreshness,
    note: "Basic + housing allowance",
  },
  {
    id: "rent",
    label: "Rent · cheque 2 of 2",
    amount: 33_000,
    day: 3,
    kind: "lump",
    paymentType: "rent",
    status: "forecasted",
    confidence: "high",
    amountType: "fixed",
    accountName: "Main current account",
    reviewed: true,
    source: seededSource,
    freshness: seededFreshness,
    note: "Two-cheque lease",
  },
  {
    id: "car",
    label: "Car loan",
    amount: 2_800,
    day: 5,
    kind: "fixed",
    paymentType: "loan",
    status: "forecasted",
    confidence: "high",
    amountType: "fixed",
    accountName: "Main current account",
    reviewed: true,
    source: seededSource,
    freshness: seededFreshness,
    note: "Existing instalment",
    isDebtPayment: true,
  },
  {
    id: "school",
    label: "School fees",
    amount: 18_000,
    day: 10,
    kind: "lump",
    paymentType: "school",
    status: "forecasted",
    confidence: "medium",
    amountType: "fixed",
    accountName: "Main current account",
    reviewed: false,
    source: seededSource,
    freshness: seededFreshness,
    note: "Two children · term 1",
  },
  {
    id: "card",
    label: "Card minimums",
    amount: 600,
    day: 15,
    kind: "fixed",
    paymentType: "credit-card",
    status: "forecasted",
    confidence: "high",
    amountType: "fixed",
    accountName: "Credit card",
    reviewed: true,
    source: seededSource,
    freshness: seededFreshness,
    note: "Existing commitment",
    isDebtPayment: true,
  },
  {
    id: "insurance",
    label: "Insurance set-aside",
    amount: 2_400,
    day: 20,
    kind: "goal",
    paymentType: "insurance",
    status: "forecasted",
    confidence: "medium",
    amountType: "fixed",
    accountName: "Main current account",
    reviewed: false,
    source: seededSource,
    freshness: seededFreshness,
    note: "Annual renewal in March",
    isGoalContribution: true,
  },
  {
    id: "savings",
    label: "Monthly savings goal",
    amount: 3_000,
    day: 25,
    kind: "goal",
    paymentType: "goal",
    status: "forecasted",
    confidence: "medium",
    amountType: "fixed",
    accountName: "Main current account",
    reviewed: true,
    source: seededSource,
    freshness: seededFreshness,
    note: "Pauseable if needed",
    isGoalContribution: true,
  },
];

const baseFinancialFacts: FinancialFacts = {
  asOf: "2026-09-01",
  currency: "AED",
  currentAvailableBalance: 51_450,
  recommendedEmergencyBuffer: bufferTarget,
  projectedPayday: 25,
  events: eventDefinitions,
};

export async function buildCalendar() {
  const profile = await getFinancialProfile();
  const baseFacts = profile ? profileToFinancialFacts(profile) : baseFinancialFacts;
  const events = [...baseFacts.events, ...(await getAcceptedImportedEvents())].sort((a, b) => a.day - b.day);
  const financialFacts = { ...baseFacts, events };
  const financialSnapshot = calculateFinancialSnapshot(financialFacts);
  const monthlyIncome = profile
    ? profile.basicSalary + profile.housingAllowance + profile.variableIncome
    : income.basic + income.housingAllowance + income.variable;
  return {
    persona: profile
      ? `${profile.householdType} household · AED ${Math.round(monthlyIncome).toLocaleString()} monthly income`
      : "Salaried expat · AED 25k household income",
    month: "2026-09",
    monthLabel: "September 2026",
    safeToSpend: financialSnapshot.safeToSpendUntilPayday,
    projectedPayday: baseFacts.projectedPayday,
    tightDay: profile ? findTightDay(financialFacts) : 27,
    bufferTarget: baseFacts.recommendedEmergencyBuffer,
    financialSnapshot,
    income: profile
      ? { basic: profile.basicSalary, housingAllowance: profile.housingAllowance, variable: profile.variableIncome }
      : income,
    events,
    assumptions: [
      profile
        ? `Available balance is based on ${profile.mainAccount} as entered during setup.`
        : "Current available balance is based on the connected main current account as of 1 September.",
      "Income, commitments, debt minimums, and goal contributions are separated before the emergency buffer.",
      profile
        ? "Profile inputs are reviewed by you; confidence still indicates how steady each amount is expected to be."
        : "School fees and insurance are forecasted with medium confidence until reviewed.",
      ...(events.length > eventDefinitions.length ? ["Accepted imported records are included; new discoveries stay out until reviewed."] : []),
    ],
  };
}

async function checkAffordability(input: {
  amount: number;
  annualRate: number;
  tenureMonths: number;
  upfrontCash: number;
  financedFee: boolean;
  rateType?: "flat" | "reducing";
  processingFeePercentage?: number;
}) {
  const amortisation = calculateAmortisation({
    principal: input.amount,
    annualRatePct: input.annualRate,
    tenorMonths: input.tenureMonths,
    rateType: input.rateType ?? "reducing",
    processingFeePct: input.processingFeePercentage ?? ruleNumber("loan_processing_fee_rate") * 100,
    feeFinanced: input.financedFee,
    processingFeeRuleUsed: input.processingFeePercentage === undefined,
  });
  const installment = amortisation.installment;
  const currentCalendar = await buildCalendar();
  const planIncome = currentCalendar.income ?? income;
  const existingInstallments = currentCalendar.financialSnapshot.minimumDebtPayments;
  const debtBurden = calculateDebtBurden({
    basicIncome: planIncome.basic,
    fixedAllowance: planIncome.housingAllowance,
    variablePay: planIncome.variable,
    existingInstallments,
  });
  const recognizedIncome = debtBurden.countedIncome;
  const debtRatio = (existingInstallments + installment) / Math.max(recognizedIncome, 1);
  const salaryMultiple = input.amount / Math.max(recognizedIncome, 1);
  const legalPasses = debtRatio <= ruleNumber("debt_burden_gross_income_cap")
    && salaryMultiple <= ruleNumber("personal_loan_salary_multiple")
    && input.tenureMonths <= ruleNumber("personal_loan_max_term_months");
  const lowestBalance = currentCalendar.safeToSpend - installment;
  const calendarPasses = lowestBalance >= 0;
  const bufferAfterUpfront = currentCalendar.bufferTarget - input.upfrontCash;
  const monthlyBurn = Math.max(currentCalendar.financialSnapshot.billsAndCommitmentsDueBeforeNextPayday, 1) + installment;
  const monthsSurvived = Math.max(0, bufferAfterUpfront / monthlyBurn);
  const resiliencePasses = bufferAfterUpfront >= currentCalendar.bufferTarget && monthsSurvived >= ruleNumber("resilience_target_months");
  const maxInstallment = Math.max(0, Math.min(
    debtBurden.headroom,
    currentCalendar.safeToSpend,
  ));
  const passes = legalPasses && calendarPasses && resiliencePasses;
  const verdict = passes ? "fits" : legalPasses && resiliencePasses ? "fits-if" : "doesnt-fit";
  const suggestions = [
    `Max instalment that clears this calendar: AED ${Math.round(maxInstallment).toLocaleString()}.`,
    installment > maxInstallment ? `Reduce the amount to about AED ${Math.round(maxInstallment / installment * input.amount).toLocaleString()}.` : "Keep the monthly savings goal active.",
    input.upfrontCash > 0 ? "Wait until the buffer is rebuilt after the upfront cash." : "A save-first plan keeps the buffer at target.",
  ];

  return {
    verdict,
    headline: passes
      ? "This clears the legal, calendar, and resilience checks."
      : calendarPasses
        ? "It is legal on paper, but the buffer is too thin for this household."
        : `Cash goes negative around the ${currentCalendar.tightDay}th in the tight month.`,
    monthlyInstallment: Math.round(installment),
    maxInstallment: Math.round(maxInstallment),
    reducingEquivalentRate: Number(amortisation.reducingEquivalentRatePct.toFixed(4)),
    apr: Number(amortisation.aprPct.toFixed(4)),
    legal: {
      passes: legalPasses,
      debtRatio: Number((debtRatio * 100).toFixed(1)),
      maxDebtRatio: ruleNumber("debt_burden_gross_income_cap") * 100,
      salaryMultiple: Number(salaryMultiple.toFixed(1)),
      maxSalaryMultiple: ruleNumber("personal_loan_salary_multiple"),
      maxTermMonths: ruleNumber("personal_loan_max_term_months"),
    },
    calendar: {
      passes: calendarPasses,
      worstMonth: `${currentCalendar.monthLabel} · tightest planned cash flow`,
      lowestBalance: Math.round(lowestBalance),
    },
    resilience: {
      bufferAfterUpfront: Math.round(bufferAfterUpfront),
      monthsSurvived: Number(monthsSurvived.toFixed(1)),
      targetBuffer: currentCalendar.bufferTarget,
    },
    suggestions,
    assumptions: [
      ...debtBurden.assumptions,
      ...ruleAssumption("personal_loan_salary_multiple", "personal_loan_max_term_months", "resilience_target_months"),
      `Processing fee is ${input.financedFee ? "financed" : "paid upfront"} at ${(input.processingFeePercentage ?? ruleNumber("loan_processing_fee_rate") * 100).toFixed(2)}% for this comparison.`,
      ...amortisation.assumptions,
    ],
  };
}

router.get("/money-calendar", async (_req, res): Promise<void> => {
  res.json(GetMoneyCalendarResponse.parse(await buildCalendar()));
});

router.post("/affordability", async (req, res): Promise<void> => {
  const input = CheckAffordabilityBody.parse(req.body);
  res.json(CheckAffordabilityResponse.parse(await checkAffordability(input)));
});

router.post("/rent-vs-buy", (req, res) => {
  const input = CompareRentVsBuyBody.parse(req.body);
  const mortgagePrincipal = input.homePrice * ruleNumber(
    input.homePrice <= ruleNumber("mortgage_property_value_threshold")
      ? "mortgage_expat_first_home_ltv_upto_5m"
      : "mortgage_expat_first_home_ltv_above_5m",
  );
  const purchaseCosts = calculateDubaiPurchaseCosts({
    propertyPrice: input.homePrice,
    mortgagePrincipal,
  });
  const fees = purchaseCosts.total;
  const downPayment = input.homePrice - mortgagePrincipal;
  const dayOneCash = downPayment + fees;
  const mortgagePayment = calculateAmortisation({
    principal: mortgagePrincipal,
    annualRatePct: ruleNumber("rent_buy_default_mortgage_rate") * 100,
    tenorMonths: ruleNumber("rent_buy_default_mortgage_term_months"),
    rateType: "reducing",
  }).installment;
  const monthlyOwning = mortgagePayment + ruleNumber("rent_buy_service_charge_monthly");
  const annualRent = input.monthlyRent * 12;
  const annualOwning = monthlyOwning * 12;
  const breakEvenYear = Math.max(ruleNumber("rent_buy_break_even_floor_years"), Math.round(dayOneCash / Math.max(1, annualRent - annualOwning)));
  const horizon = input.yearsToStay;
  const priceScenarios = [
    { label: "Flat prices", growth: ruleNumber("rent_buy_flat_price_growth") },
    { label: "+3% / year", growth: ruleNumber("rent_buy_positive_price_growth") },
    { label: "−10% shock", growth: ruleNumber("rent_buy_price_shock") },
  ];
  const scenarios = priceScenarios.map(({ label, growth }) => ({
    label,
    netPosition: Math.round(input.homePrice * ((1 + growth) ** horizon - 1) - dayOneCash - Math.max(0, annualOwning - annualRent) * horizon),
  }));
  const verdict = input.yearsToStay >= breakEvenYear + ruleNumber("rent_buy_verdict_margin_years") ? "buy" : input.yearsToStay >= breakEvenYear ? "buy-if" : "rent-for-now";

  res.json(CompareRentVsBuyResponse.parse({
    verdict,
    headline: verdict === "buy"
      ? `Buy works if you stay about ${input.yearsToStay} years.`
      : verdict === "buy-if"
        ? `Buy only starts to work if you stay at least ${breakEvenYear} years.`
        : `Rent for now; the upfront cash takes too long to earn back.`,
    dayOneCash: Math.round(dayOneCash),
    monthlyOwning: Math.round(monthlyOwning),
    monthlyRenting: Math.round(input.monthlyRent),
    breakEvenYear,
    scenarios,
    flipFactor: input.yearsToStay < breakEvenYear
      ? `Staying ${breakEvenYear - input.yearsToStay} more year(s) is the clearest flip factor.`
      : `A ${Math.abs(ruleNumber("rent_buy_price_shock") * 100).toFixed(0)}% price shock or a shorter stay would flip this result.`,
    assumptions: [
       ...ruleAssumption(
         "mortgage_property_value_threshold",
         "mortgage_expat_first_home_ltv_upto_5m",
         "mortgage_expat_first_home_ltv_above_5m",
         "rent_buy_default_mortgage_rate",
         "rent_buy_default_mortgage_term_months",
         "rent_buy_service_charge_monthly",
         "rent_buy_break_even_floor_years",
         "rent_buy_verdict_margin_years",
         "rent_buy_flat_price_growth",
         "rent_buy_positive_price_growth",
         "rent_buy_price_shock",
       ),
       ...purchaseCosts.assumptions,
    ],
  }));
});

router.post("/stress", (req, res) => {
  const input = RunStressTestBody.parse(req.body);
  const stressedMonthlyCommitment = input.monthlyCommitments * (1 + input.rateIncrease / 100);
  const endingBuffer = input.buffer - stressedMonthlyCommitment * input.noIncomeMonths;
  const monthsSurvived = Math.max(0, input.buffer / stressedMonthlyCommitment);
  res.json(RunStressTestResponse.parse({
    monthsSurvived: Number(monthsSurvived.toFixed(1)),
    stressedMonthlyCommitment: Math.round(stressedMonthlyCommitment),
    endingBuffer: Math.round(endingBuffer),
    headline: endingBuffer >= 0
      ? `The buffer survives ${input.noIncomeMonths} months without income.`
      : `The buffer runs out after about ${monthsSurvived.toFixed(1)} months without income.`,
  }));
});

export default router;