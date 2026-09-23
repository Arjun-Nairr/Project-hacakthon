import test from "node:test";
import assert from "node:assert/strict";
import { CheckAffordabilityBody } from "../../../../lib/api-zod/src/generated/api.ts";
import {
  calculateAmortisation,
  calculateCardPayoff,
  calculateDebtBurden,
  calculateDubaiPurchaseCosts,
  calculateGratuity,
  calculateLegalLoanLimits,
  calculateMortgage,
} from "./money-engine.ts";
import { uaeRules } from "./uae-rules.ts";

const money = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 0.01, `${actual} ≠ ${expected}`);
const rate = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 0.001, `${actual} ≠ ${expected}`);

test("flat 100000 / 3.99% / 48 fixture", () => {
  const result = calculateAmortisation({ principal: 100_000, annualRatePct: 3.99, tenorMonths: 48, rateType: "flat" });
  money(result.installment, 2_415.83);
  money(result.totalInterest, 15_960);
  rate(result.reducingEquivalentRatePct, 7.456);
  rate(result.aprPct, 7.456);
});

test("reducing 100000 / 7.5% / 48 fixtures", () => {
  const result = calculateAmortisation({ principal: 100_000, annualRatePct: 7.5, tenorMonths: 48, rateType: "reducing" });
  money(result.installment, 2_417.89);
  money(result.totalInterest, 16_058.73);
  rate(result.aprPct, 7.5);
  const upfront = calculateAmortisation({ principal: 100_000, annualRatePct: 7.5, tenorMonths: 48, rateType: "reducing", processingFeePct: 1, feeFinanced: false });
  rate(upfront.aprPct, 8.022);
  money(upfront.totalCostAbovePrincipal, 17_058.73);
  const financed = calculateAmortisation({ principal: 100_000, annualRatePct: 7.5, tenorMonths: 48, rateType: "reducing", processingFeePct: 1, feeFinanced: true });
  money(financed.installment, 2_442.07);
  rate(financed.aprPct, 8.017);
  money(financed.totalCostAbovePrincipal, 17_219.32);
});

test("card 20000 at 39% fixture", () => {
  const result = calculateCardPayoff({ closingBalance: 20_000, annualRatePct: 39 });
  assert.equal(result.months, 152);
  money(result.totalInterest, 31_862.91);
  assert.ok(!result.assumptions.some((item) => item.includes("card_annual_interest_rate_default")));
});

test("debt burden and legal loan fixtures", () => {
  const burden = calculateDebtBurden({ basicIncome: 25_000, fixedAllowance: 10_000, variablePay: 0, existingInstallments: 6_000 });
  money(burden.countedIncome, 35_000);
  money(burden.cap, 17_500);
  money(burden.headroom, 11_500);
  const limits = calculateLegalLoanLimits({ monthlyIncome: 20_000, vehicleValue: 150_000 });
  money(limits.personal.maxAmount, 400_000);
  assert.equal(limits.personal.maxTermMonths, 48);
  money(limits.car.maxAmount, 120_000);
  assert.equal(limits.car.maxTermMonths, 60);
});

test("gratuity fixtures", () => {
  const sevenYears = calculateGratuity({ basicMonthlySalary: 10_000, years: 7, months: 4 });
  money(sevenYears.capped, 58_333.33);
  const thirtyYears = calculateGratuity({ basicMonthlySalary: 5_000, years: 30 });
  money(thirtyYears.uncapped, 142_500);
  money(thirtyYears.capped, 120_000);
});

test("mortgage and affordability loan fixtures", () => {
  const four = calculateMortgage({ principal: 1_600_000, annualRatePct: 4, tenorYears: 25 });
  money(four.installment, 8_445.39);
  money(four.firstYearInterest, 63_307.68);
  const six = calculateMortgage({ principal: 1_600_000, annualRatePct: 6, tenorYears: 25 });
  money(six.installment, 10_308.82);
  const loan = calculateAmortisation({ principal: 80_000, annualRatePct: 7.5, tenorMonths: 48, rateType: "reducing" });
  money(loan.installment, 1_934.31);
  const burden = calculateDebtBurden({ basicIncome: 28_000, fixedAllowance: 0, variablePay: 0, existingInstallments: 2_300 + loan.installment });
  rate(Number(burden.debtBurdenPct.toFixed(1)), 15.1);
});

test("rules have complete metadata and are immutable", () => {
  for (const [id, rule] of Object.entries(uaeRules.rules)) {
    assert.ok(rule.value !== undefined, id);
    assert.ok(rule.unit && rule.tier && rule.source_description && /^https?:\/\//.test(rule.source_url), id);
    assert.ok(["law", "official_fee", "market_norm", "derived"].includes(rule.tier), id);
    assert.ok(Object.isFrozen(rule), id);
  }
  assert.ok(Object.isFrozen(uaeRules));
  assert.throws(() => { (uaeRules.rules.debt_burden_gross_income_cap as { value: number }).value = 0; }, TypeError);
});

test("old affordability caller receives generated defaults", () => {
  const parsed = CheckAffordabilityBody.parse({ amount: 80_000, annualRate: 7.5, tenureMonths: 48, upfrontCash: 0 });
  assert.equal(parsed.rateType, "reducing");
  assert.equal(parsed.processingFeePercentage, 1);
  assert.equal(parsed.financedFee, false);
});

test("Dubai purchase costs use atomic fee assumptions", () => {
  const result = calculateDubaiPurchaseCosts({ propertyPrice: 2_000_000, mortgagePrincipal: 1_600_000 });
  assert.ok(result.total > 0);
  for (const id of ["dld_purchase_fee_rate", "agent_fee_rate", "mortgage_registration_rate", "trustee_fee_above_threshold", "valuation_fee", "bank_fee_rate"]) {
    assert.ok(result.assumptions.some((item) => item.startsWith(`${id}:`)));
  }
});

test("engine rejects invalid financial inputs", () => {
  assert.throws(() => calculateAmortisation({ principal: -1, annualRatePct: 1, tenorMonths: 12, rateType: "reducing" }));
  assert.throws(() => calculateAmortisation({ principal: 1, annualRatePct: 1, tenorMonths: 0, rateType: "reducing" }));
  assert.throws(() => calculateCardPayoff({ closingBalance: Number.NaN }));
  assert.throws(() => calculateDebtBurden({ basicIncome: 1, fixedAllowance: 1, variablePay: 1, existingInstallments: -1 }));
});