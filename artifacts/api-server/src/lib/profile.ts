import { db, financialProfilesTable } from "@workspace/db";
import {
  GetFinancialProfileResponse,
  SaveFinancialProfileBody,
  SaveFinancialProfileResponse,
  type FinancialProfileInput,
} from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const PROFILE_ID = "default";
const PROFILE_SOURCE = "onboarding";

export async function getFinancialProfile() {
  const [row] = await db
    .select({ profile: financialProfilesTable.profile })
    .from(financialProfilesTable)
    .where(eq(financialProfilesTable.id, PROFILE_ID));
  return GetFinancialProfileResponse.parse(row?.profile ?? null);
}

export async function saveFinancialProfile(input: FinancialProfileInput) {
  const freshness = new Date();
  const profile = {
    id: PROFILE_ID,
    ...input,
    source: PROFILE_SOURCE,
    confidence: "high",
    reviewed: true,
    freshness,
    commitments: input.commitments.map((commitment) => ({
      ...commitment,
      source: PROFILE_SOURCE,
      reviewed: true,
      freshness,
    })),
    goals: input.goals.map((goal) => ({
      ...goal,
      confidence: goal.confidence ?? "medium",
      source: PROFILE_SOURCE,
      reviewed: true,
      freshness,
    })),
  };
  const parsed = SaveFinancialProfileResponse.parse(profile);

  await db
    .insert(financialProfilesTable)
    .values({
      id: PROFILE_ID,
      profile: parsed,
      source: PROFILE_SOURCE,
      confidence: parsed.confidence,
      reviewed: parsed.reviewed,
      freshness,
      updatedAt: freshness,
    })
    .onConflictDoUpdate({
      target: financialProfilesTable.id,
      set: {
        profile: parsed,
        source: PROFILE_SOURCE,
        confidence: parsed.confidence,
        reviewed: parsed.reviewed,
        freshness,
        updatedAt: freshness,
      },
    });

  return parsed;
}