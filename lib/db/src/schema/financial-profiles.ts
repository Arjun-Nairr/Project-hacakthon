import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const financialProfilesTable = pgTable("financial_profiles", {
  id: text("id").primaryKey(),
  profile: jsonb("profile").notNull(),
  source: text("source").notNull(),
  confidence: text("confidence").notNull(),
  reviewed: boolean("reviewed").notNull().default(true),
  freshness: timestamp("freshness", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const insertFinancialProfileSchema = createInsertSchema(financialProfilesTable);
export type InsertFinancialProfile = z.infer<typeof insertFinancialProfileSchema>;
export type FinancialProfileRow = typeof financialProfilesTable.$inferSelect;