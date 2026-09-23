import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const financialImportsTable = pgTable("financial_imports", {
  id: text("id").primaryKey(),
  sourceType: text("source_type").notNull(),
  sourceName: text("source_name").notNull(),
  freshness: timestamp("freshness", { withTimezone: true }).notNull(),
  retention: text("retention").notNull(),
  deletionState: text("deletion_state").notNull().default("active"),
  objectPath: text("object_path"),
  eventId: text("event_id").notNull(),
  label: text("label").notNull(),
  amount: real("amount").notNull(),
  day: integer("day").notNull(),
  kind: text("kind").notNull(),
  paymentType: text("payment_type").notNull(),
  status: text("status").notNull(),
  confidence: text("confidence").notNull(),
  amountType: text("amount_type").notNull(),
  accountName: text("account_name").notNull(),
  reviewed: boolean("reviewed").notNull().default(false),
  note: text("note"),
  reviewStatus: text("review_status").notNull(),
  duplicateOf: text("duplicate_of"),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull(),
  eventMetadata: jsonb("event_metadata"),
});

export const insertFinancialImportSchema = createInsertSchema(financialImportsTable).omit({ id: true });
export type InsertFinancialImport = z.infer<typeof insertFinancialImportSchema>;
export type FinancialImport = typeof financialImportsTable.$inferSelect;

export const accountConnectionsTable = pgTable("account_connections", {
  id: text("id").primaryKey(),
  institution: text("institution").notNull(),
  accountName: text("account_name").notNull(),
  accountType: text("account_type").notNull(),
  permission: text("permission").notNull().default("read-only"),
  status: text("status").notNull().default("connected"),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
});

export const insertAccountConnectionSchema = createInsertSchema(accountConnectionsTable).omit({ id: true });
export type InsertAccountConnection = z.infer<typeof insertAccountConnectionSchema>;
export type AccountConnectionRow = typeof accountConnectionsTable.$inferSelect;