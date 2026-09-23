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
  type FinancialEvent,
  type FinancialFacts,
} from "../lib/financial-model";

const router: IRouter = Router();

const income = {
  basic: 22_000,
  housingAllowance: 3_000,
  variable: 0,
};

const recognizedIncome = income.basic + income.housingAllowance * 0.5;
const existingInstallments = 3_400;
const bufferTarget = 15_000;

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
    note: "Pauseable if needed",
    isGoalContribution: true,
  },
];

const financialFacts: FinancialFacts = {
  asOf: "2026-09-01",
  currency: "AED",
  currentAvailableBalance: 51_450,
  recommendedEmergencyBuffer: bufferTarget,
  projectedPayday: 25,
  events: eventDefinitions,
};
const financialSnapshot = calculateFinancialSnapshot(financialFacts);

const calendar = {
  persona: "Salaried expat · AED 25k household income",
  month: "2026-09",
  monthLabel: "September 2026",
  safeToSpend: financialSnapshot.safeToSpendUntilPayday,
  projectedPayday: 25,
  tightDay: 27,
  bufferTarget,
  financialSnapshot,
  income,
  events: eventDefinitions,
  assumptions: [
    "Current available balance is based on the connected main current account as of 1 September.",
    "Income, commitments, debt minimums, and goal contributions are separated before the emergency buffer.",
    "School fees and insurance are forecasted with medium confidence until reviewed.",
  ],
};

function monthlyPayment(amount: number, annualRate: number, tenureMonths: number) {
  const rate = annualRate / 100 / 12;
  if (rate === 0) return amount / tenureMonths;
  return (amount * rate * (1 + rate) ** tenureMonths) / ((1 + rate) ** tenureMonths - 1);
}

function checkAffordability(input: {
  amount: number;
  annualRate: number;
  tenureMonths: number;
  upfrontCash: number;
  financedFee: boolean;
}) {
  const fee = input.amount * 0.01;
  const financedAmount = input.amount + (input.financedFee ? fee : 0);
  const installment = monthlyPayment(financedAmount, input.annualRate, input.tenureMonths);
  const debtRatio = (existingInstallments + installment) / recognizedIncome;
  const salaryMultiple = input.amount / income.basic;
  const legalPasses = debtRatio <= 0.5 && salaryMultiple <= 20 && input.tenureMonths <= 48;
  const lowestBalance = calendar.safeToSpend - installment;
  const calendarPasses = lowestBalance >= 0;
  const bufferAfterUpfront = bufferTarget - input.upfrontCash;
  const monthlyBurn = 8_500 + installment;
  const monthsSurvived = Math.max(0, bufferAfterUpfront / monthlyBurn);
  const resiliencePasses = bufferAfterUpfront >= bufferTarget && monthsSurvived >= 2;
  const maxInstallment = Math.max(0, Math.min(
    recognizedIncome * 0.5 - existingInstallments,
    calendar.safeToSpend,
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
        : `Cash goes negative around the ${calendar.tightDay}th in the tight month.`,
    monthlyInstallment: Math.round(installment),
    maxInstallment: Math.round(maxInstallment),
    legal: {
      passes: legalPasses,
      debtRatio: Number((debtRatio * 100).toFixed(1)),
      maxDebtRatio: 50,
      salaryMultiple: Number(salaryMultiple.toFixed(1)),
      maxSalaryMultiple: 20,
      maxTermMonths: 48,
    },
    calendar: {
      passes: calendarPasses,
      worstMonth: "September · school fees + rent cheque",
      lowestBalance: Math.round(lowestBalance),
    },
    resilience: {
      bufferAfterUpfront: Math.round(bufferAfterUpfront),
      monthsSurvived: Number(monthsSurvived.toFixed(1)),
      targetBuffer: bufferTarget,
    },
    suggestions,
    assumptions: [
      "CBUAE screen: total instalments ≤ 50% of recognized income.",
      "Personal loans are capped at 20× basic salary and 48 months.",
      `Processing fee is ${input.financedFee ? "financed" : "paid upfront"} at 1% for this comparison.`,
    ],
  };
}

router.get("/money-calendar", (_req, res) => {
  res.json(GetMoneyCalendarResponse.parse(calendar));
});

router.post("/affordability", (req, res) => {
  const input = CheckAffordabilityBody.parse(req.body);
  res.json(CheckAffordabilityResponse.parse(checkAffordability(input)));
});

router.post("/rent-vs-buy", (req, res) => {
  const input = CompareRentVsBuyBody.parse(req.body);
  const downPayment = input.homePrice * 0.2;
  const fees = input.homePrice * 0.065;
  const dayOneCash = downPayment + fees;
  const mortgagePayment = monthlyPayment(input.homePrice * 0.8, 4.5, 300);
  const monthlyOwning = mortgagePayment + 1_200;
  const annualRent = input.monthlyRent * 12;
  const annualOwning = monthlyOwning * 12;
  const breakEvenYear = Math.max(3, Math.round(dayOneCash / Math.max(1, annualRent - annualOwning)));
  const horizon = input.yearsToStay;
  const priceScenarios = [
    { label: "Flat prices", growth: 0 },
    { label: "+3% / year", growth: 0.03 },
    { label: "−10% shock", growth: -0.1 },
  ];
  const scenarios = priceScenarios.map(({ label, growth }) => ({
    label,
    netPosition: Math.round(input.homePrice * ((1 + growth) ** horizon - 1) - dayOneCash - Math.max(0, annualOwning - annualRent) * horizon),
  }));
  const verdict = input.yearsToStay >= breakEvenYear + 2 ? "buy" : input.yearsToStay >= breakEvenYear ? "buy-if" : "rent-for-now";

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
      : "A 15% price drop or a shorter stay would flip this result.",
    assumptions: [
      "First-home down payment is 20% for a property under AED 5m.",
      "Fees are modelled at 6.5%: DLD, agent, registration, trustee, valuation, and bank fee.",
      "Ownership includes AED 1,200/month service charge and a 4.5% reducing mortgage over 25 years.",
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