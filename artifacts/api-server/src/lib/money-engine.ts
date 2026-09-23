import { ruleAssumption, ruleBoolean, ruleNumber } from "./uae-rules.ts";

export type RateType = "flat" | "reducing";

export type AmortisationResult = {
  installment: number;
  totalInterest: number;
  reducingEquivalentRatePct: number;
  aprPct: number;
  totalCostAbovePrincipal: number;
  costPerAed1000: number;
  assumptions: string[];
};

function reducingPayment(principal: number, annualRatePct: number, months: number): number {
  const monthlyRate = annualRatePct / 100 / 12;
  if (monthlyRate === 0) return principal / months;
  const factor = (1 + monthlyRate) ** months;
  return principal * monthlyRate * factor / (factor - 1);
}

function solveReducingRateForPayment(principal: number, months: number, payment: number): number {
  if (payment <= principal / months) return 0;
  let low = 0;
  let high = 1;
  for (let index = 0; index < 100; index += 1) {
    const midpoint = (low + high) / 2;
    if (reducingPayment(principal, midpoint * 100, months) < payment) low = midpoint;
    else high = midpoint;
  }
  return (low + high) / 2 * 100;
}

function monthlyIrr(received: number, payment: number, months: number): number {
  if (received <= 0 || payment <= 0) return 0;
  let low = 0;
  let high = 1;
  for (let index = 0; index < 120; index += 1) {
    const midpoint = (low + high) / 2;
    let presentValue = 0;
    for (let month = 1; month <= months; month += 1) presentValue += payment / (1 + midpoint) ** month;
    if (presentValue > received) low = midpoint;
    else high = midpoint;
  }
  return (low + high) / 2;
}

export function calculateAmortisation(input: {
  principal: number;
  annualRatePct: number;
  tenorMonths: number;
  rateType: RateType;
  processingFeePct?: number;
  feeFinanced?: boolean;
  processingFeeRuleUsed?: boolean;
}): AmortisationResult {
  assertFiniteNonnegative(input.principal, "principal");
  assertFiniteNonnegative(input.annualRatePct, "annualRatePct");
  assertPositive(input.tenorMonths, "tenorMonths");
  assertFiniteNonnegative(input.processingFeePct ?? 0, "processingFeePct");
  if (input.rateType !== "flat" && input.rateType !== "reducing") throw new Error("rateType must be flat or reducing.");
  const feePct = input.processingFeePct ?? 0;
  const fee = input.principal * feePct / 100;
  const financedPrincipal = input.principal + (input.feeFinanced ? fee : 0);
  const installment = input.rateType === "flat"
    ? (financedPrincipal + financedPrincipal * input.annualRatePct / 100 * input.tenorMonths / 12) / input.tenorMonths
    : reducingPayment(financedPrincipal, input.annualRatePct, input.tenorMonths);
  const totalPayments = installment * input.tenorMonths;
  const totalInterest = totalPayments - financedPrincipal;
  const reducingEquivalentRatePct = input.rateType === "flat"
    ? solveReducingRateForPayment(financedPrincipal, input.tenorMonths, installment)
    : input.annualRatePct;
  const received = input.feeFinanced ? input.principal : input.principal - fee;
  const aprPct = monthlyIrr(received, installment, input.tenorMonths) * 12 * 100;
  const assumptions = [
    ...(input.rateType === "flat" ? ruleAssumption("flat_rate_effective_equivalent") : []),
    ...(feePct > 0
      ? input.processingFeeRuleUsed === false
        ? ["processingFeePercentage override supplied by caller."]
        : ruleAssumption("loan_processing_fee_rate")
      : []),
  ];
  return {
    installment,
    totalInterest,
    reducingEquivalentRatePct,
    aprPct,
    totalCostAbovePrincipal: totalPayments + (input.feeFinanced ? 0 : fee) - input.principal,
    costPerAed1000: (totalPayments + (input.feeFinanced ? 0 : fee) - input.principal) / input.principal * 1000,
    assumptions,
  };
}

export function calculateCardPayoff(input: {
  closingBalance: number;
  annualRatePct?: number;
  minimumPaymentRate?: number;
  minimumPaymentFloor?: number;
}) {
  assertFiniteNonnegative(input.closingBalance, "closingBalance");
  if (input.annualRatePct !== undefined) assertFiniteNonnegative(input.annualRatePct, "annualRatePct");
  if (input.minimumPaymentRate !== undefined) assertFiniteNonnegative(input.minimumPaymentRate, "minimumPaymentRate");
  if (input.minimumPaymentFloor !== undefined) assertFiniteNonnegative(input.minimumPaymentFloor, "minimumPaymentFloor");
  const annualRate = input.annualRatePct ?? ruleNumber("card_annual_interest_rate_default") * 100;
  const minimumRate = input.minimumPaymentRate ?? ruleNumber("card_minimum_payment_rate");
  const floor = input.minimumPaymentFloor ?? ruleNumber("card_minimum_payment_floor");
  let balance = input.closingBalance;
  let totalInterest = 0;
  let months = 0;
  while (balance > 0.0000001 && months < 10_000) {
    const interest = balance * annualRate / 100 / 12;
    const closing = balance + interest;
    const payment = Math.min(closing, Math.max(closing * minimumRate, floor));
    balance = closing - payment;
    totalInterest += interest;
    months += 1;
  }
  return {
    months,
    totalInterest,
    assumptions: [
      ...ruleAssumption("card_minimum_payment_rate", "card_minimum_payment_floor"),
      ...(input.annualRatePct === undefined
        ? ruleAssumption("card_annual_interest_rate_default")
        : ["annualRatePct override supplied by caller."]),
    ],
  };
}

export function calculateGratuity(input: { basicMonthlySalary: number; years: number; months?: number }) {
  assertFiniteNonnegative(input.basicMonthlySalary, "basicMonthlySalary");
  assertFiniteNonnegative(input.years, "years");
  assertFiniteNonnegative(input.months ?? 0, "months");
  const totalMonths = input.years * 12 + (input.months ?? 0);
  if (totalMonths < 12) {
    return { uncapped: 0, capped: 0, appliedCap: false, assumptions: ruleAssumption("gratuity_minimum_service_years") };
  }
  const firstFiveYears = Math.min(totalMonths, 60) / 12;
  const laterYears = Math.max(totalMonths - 60, 0) / 12;
  const dailyWage = input.basicMonthlySalary / ruleNumber("gratuity_day_divisor");
  const uncapped = dailyWage * (firstFiveYears * ruleNumber("gratuity_days_first_five_years") + laterYears * ruleNumber("gratuity_days_after_five_years"));
  const cap = input.basicMonthlySalary * ruleNumber("gratuity_cap_months");
  return {
    uncapped,
    capped: Math.min(uncapped, cap),
    appliedCap: uncapped > cap,
    assumptions: ruleAssumption("gratuity_days_first_five_years", "gratuity_days_after_five_years", "gratuity_cap_months", "gratuity_minimum_service_years", "gratuity_basic_salary_only", "gratuity_partial_year_proration", "gratuity_day_divisor"),
  };
}

export function calculateDebtBurden(input: {
  basicIncome: number;
  fixedAllowance: number;
  variablePay: number;
  existingInstallments: number;
  retired?: boolean;
}) {
  assertFiniteNonnegative(input.basicIncome, "basicIncome");
  assertFiniteNonnegative(input.fixedAllowance, "fixedAllowance");
  assertFiniteNonnegative(input.variablePay, "variablePay");
  assertFiniteNonnegative(input.existingInstallments, "existingInstallments");
  const countedIncome = input.basicIncome * ruleNumber("income_weight_basic")
    + input.fixedAllowance * ruleNumber("income_weight_fixed_allowance")
    + input.variablePay * ruleNumber("income_weight_variable_pay");
  const cap = countedIncome * ruleNumber(input.retired ? "debt_burden_retired_income_cap" : "debt_burden_gross_income_cap");
  return {
    countedIncome,
    cap,
    headroom: cap - input.existingInstallments,
    debtBurdenPct: countedIncome > 0 ? input.existingInstallments / countedIncome * 100 : 0,
    assumptions: ruleAssumption("income_weight_basic", "income_weight_fixed_allowance", "income_weight_variable_pay", input.retired ? "debt_burden_retired_income_cap" : "debt_burden_gross_income_cap"),
  };
}

export function calculateLegalLoanLimits(input: { monthlyIncome: number; vehicleValue?: number }) {
  assertFiniteNonnegative(input.monthlyIncome, "monthlyIncome");
  assertFiniteNonnegative(input.vehicleValue ?? 0, "vehicleValue");
  return {
    personal: {
      maxAmount: input.monthlyIncome * ruleNumber("personal_loan_salary_multiple"),
      maxTermMonths: ruleNumber("personal_loan_max_term_months"),
    },
    car: {
      maxAmount: (input.vehicleValue ?? 0) * ruleNumber("car_loan_max_ltv"),
      maxTermMonths: ruleNumber("car_loan_max_term_months"),
    },
    assumptions: ruleAssumption("personal_loan_salary_multiple", "personal_loan_max_term_months", "car_loan_max_ltv", "car_loan_max_term_months"),
  };
}

export function calculateMortgage(input: { principal: number; annualRatePct: number; tenorYears?: number }) {
  assertFiniteNonnegative(input.principal, "principal");
  assertFiniteNonnegative(input.annualRatePct, "annualRatePct");
  assertPositive(input.tenorYears ?? ruleNumber("mortgage_max_term_years"), "tenorYears");
  const tenorYears = input.tenorYears ?? ruleNumber("mortgage_max_term_years");
  const amortisation = calculateAmortisation({
    principal: input.principal,
    annualRatePct: input.annualRatePct,
    tenorMonths: tenorYears * 12,
    rateType: "reducing",
  });
  let balance = input.principal;
  let firstYearInterest = 0;
  const monthlyRate = input.annualRatePct / 100 / 12;
  for (let month = 0; month < 12; month += 1) {
    const interest = balance * monthlyRate;
    firstYearInterest += interest;
    balance -= amortisation.installment - interest;
  }
  return { ...amortisation, firstYearInterest, assumptions: [...amortisation.assumptions, ...ruleAssumption("mortgage_max_term_years")] };
}

export function calculateDubaiPurchaseCosts(input: { propertyPrice: number; mortgagePrincipal: number }) {
  assertFiniteNonnegative(input.propertyPrice, "propertyPrice");
  assertFiniteNonnegative(input.mortgagePrincipal, "mortgagePrincipal");
  const vat = ruleNumber("vat_rate");
  const agentFeeIsTaxable = ruleBoolean("agent_fee_vat_applicability");
  const trustee = input.propertyPrice >= ruleNumber("trustee_fee_threshold")
    ? ruleNumber("trustee_fee_above_threshold")
    : ruleNumber("trustee_fee_below_threshold");
  const costs = {
    dld: input.propertyPrice * ruleNumber("dld_purchase_fee_rate") + ruleNumber("dld_admin_fee"),
    agent: input.propertyPrice * ruleNumber("agent_fee_rate") * (agentFeeIsTaxable ? 1 + vat : 1),
    mortgageRegistration: input.mortgagePrincipal * ruleNumber("mortgage_registration_rate")
      + ruleNumber("mortgage_registration_admin_fee"),
    trustee: trustee * (1 + vat),
    titleAndMap: ruleNumber("title_deed_fee") + ruleNumber("map_fee")
      + ruleNumber("knowledge_fee") + ruleNumber("innovation_fee"),
    valuation: ruleNumber("valuation_fee") * (1 + vat),
    bank: input.mortgagePrincipal * ruleNumber("bank_fee_rate") * (1 + vat),
  };
  return {
    ...costs,
    total: Object.values(costs).reduce((sum, value) => sum + value, 0),
    assumptions: ruleAssumption(
      "dld_purchase_fee_rate", "dld_admin_fee", "agent_fee_rate", "vat_rate",
      "mortgage_registration_rate", "mortgage_registration_admin_fee",
      "trustee_fee_threshold", trustee === ruleNumber("trustee_fee_above_threshold") ? "trustee_fee_above_threshold" : "trustee_fee_below_threshold",
      "title_deed_fee", "map_fee", "knowledge_fee", "innovation_fee", "valuation_fee", "bank_fee_rate",
      "dld_agent_fee_financing_prohibition", "agent_fee_vat_applicability",
    ),
  };
}

function assertFiniteNonnegative(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be finite and nonnegative.`);
}

function assertPositive(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be finite and positive.`);
}