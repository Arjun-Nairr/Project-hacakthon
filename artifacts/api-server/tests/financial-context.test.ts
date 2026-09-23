import { test } from "node:test";
import assert from "node:assert/strict";
import { toFinancialContext } from "../src/lib/financial-context";

function fakeCalendar() {
  return {
    persona: "Test household",
    month: "2026-09",
    monthLabel: "September 2026",
    safeToSpend: 12_500,
    projectedPayday: 25,
    tightDay: 27,
    bufferTarget: 15_000,
    income: { basic: 22_000, housingAllowance: 3_000, variable: 0 },
    events: [
      {
        id: "rent",
        label: "Rent",
        amount: 33_000,
        day: 3,
        kind: "lump",
        paymentType: "rent",
        status: "forecasted",
        confidence: "high",
        amountType: "fixed",
        accountName: "Main",
        reviewed: true,
        source: "seeded-demo",
        freshness: new Date(),
      },
    ],
    financialSnapshot: {
      asOf: "2026-09-01",
      currency: "AED" as const,
      currentAvailableBalance: 51_450,
      expectedIncomeBeforeNextPayday: 25_000,
      billsAndCommitmentsDueBeforeNextPayday: 33_000,
      minimumDebtPayments: 2_800,
      plannedGoalContributions: 3_000,
      recommendedEmergencyBuffer: 15_000,
      safeToSpendUntilPayday: 12_500,
      safeToSpendThisMonth: 12_500,
      scenarios: [],
    },
    assumptions: [],
  };
}

test("toFinancialContext traces every number back to the calendar it was built from", () => {
  const calendar = fakeCalendar();
  const context = toFinancialContext(calendar);

  assert.equal(context.safeToSpend, calendar.safeToSpend);
  assert.equal(context.bufferTarget, calendar.bufferTarget);
  assert.equal(context.tightDay, calendar.tightDay);
  assert.equal(context.snapshot.currentAvailableBalance, calendar.financialSnapshot.currentAvailableBalance);
  assert.equal(context.upcomingEvents.length, 1);
  assert.equal(context.upcomingEvents[0].label, "Rent");
  assert.equal(context.upcomingEvents[0].amount, 33_000);
});

test("toFinancialContext drops internal-only fields (accountName, source, freshness)", () => {
  const context = toFinancialContext(fakeCalendar());
  const event = context.upcomingEvents[0] as Record<string, unknown>;
  assert.equal("accountName" in event, false);
  assert.equal("source" in event, false);
  assert.equal("freshness" in event, false);
});

test("toFinancialContext caps events at 30, preferring the nearest by day", () => {
  const calendar = fakeCalendar();
  calendar.events = Array.from({ length: 45 }, (_, i) => ({
    ...calendar.events[0],
    id: `event-${i}`,
    label: `Event ${i}`,
    day: 45 - i, // days 45..1, deliberately unsorted-from-nearest going in
  }));

  const context = toFinancialContext(calendar);
  assert.equal(context.upcomingEvents.length, 30);
  // Nearest (lowest day number) first, and only the 30 nearest survive.
  assert.equal(context.upcomingEvents[0].day, 1);
  assert.equal(context.upcomingEvents[29].day, 30);
  assert.ok(context.upcomingEvents.every((event) => event.day <= 30));
});
