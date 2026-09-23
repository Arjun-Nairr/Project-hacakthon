import { db, accountConnectionsTable, financialImportsTable } from "@workspace/db";
import type {
  AccountConnection,
  AccountConnectionInput,
  DocumentImportInput,
  ImportReviewInput,
  ImportedRecord,
} from "@workspace/api-zod";
import { and, eq, ne } from "drizzle-orm";
import type { FinancialEvent } from "./financial-model";

function sourceType(input: DocumentImportInput["documentType"]): ImportedRecord["source"]["type"] {
  return input;
}

function toRecord(row: typeof financialImportsTable.$inferSelect): ImportedRecord {
  return {
    id: row.id,
    source: {
      type: row.sourceType as ImportedRecord["source"]["type"],
      name: row.sourceName,
      freshness: row.freshness,
      retention: row.retention,
      deletionState: row.deletionState as ImportedRecord["source"]["deletionState"],
      objectPath: row.objectPath,
    },
    event: {
      id: row.eventId,
      label: row.label,
      amount: row.amount,
      day: row.day,
      kind: row.kind as FinancialEvent["kind"],
      paymentType: row.paymentType as FinancialEvent["paymentType"],
      status: row.status as FinancialEvent["status"],
      confidence: row.confidence as FinancialEvent["confidence"],
      amountType: row.amountType as FinancialEvent["amountType"],
      accountName: row.accountName,
      reviewed: row.reviewed,
      source: row.sourceName,
      freshness: row.freshness,
      note: row.note ?? undefined,
    },
    reviewStatus: row.reviewStatus as ImportedRecord["reviewStatus"],
    duplicateOf: row.duplicateOf,
    discoveredAt: row.discoveredAt,
  };
}

function toConnection(row: typeof accountConnectionsTable.$inferSelect): AccountConnection {
  return {
    id: row.id,
    institution: row.institution,
    accountName: row.accountName,
    accountType: row.accountType as AccountConnection["accountType"],
    permission: "read-only",
    status: row.status as AccountConnection["status"],
    connectedAt: row.connectedAt,
    lastSyncedAt: row.lastSyncedAt,
  };
}

function normalizeDocument(input: DocumentImportInput, freshness: Date): FinancialEvent {
  return {
    id: `import-event-${crypto.randomUUID()}`,
    label: input.label.trim(),
    amount: input.amount,
    day: input.day,
    kind: input.kind,
    paymentType: input.paymentType,
    status: "pending",
    confidence: input.amountType === "fixed" ? "medium" : "low",
    amountType: input.amountType,
    accountName: input.accountName.trim(),
    reviewed: false,
    source: input.fileName,
    freshness,
    note: input.note?.trim() || `Imported from ${input.fileName}`,
  };
}

async function findDuplicate(event: FinancialEvent) {
  const rows = await db
    .select()
    .from(financialImportsTable)
    .where(and(ne(financialImportsTable.reviewStatus, "rejected"), eq(financialImportsTable.deletionState, "active")));
  return rows.find((row) =>
    row.amount === event.amount &&
    row.day === event.day &&
    row.accountName.toLowerCase() === event.accountName.toLowerCase() &&
    row.kind === event.kind,
  );
}

export async function listImports() {
  const [records, connections] = await Promise.all([
    db.select().from(financialImportsTable),
    db.select().from(accountConnectionsTable),
  ]);
  return {
    records: records.filter((record) => record.deletionState !== "deleted").map(toRecord),
    connections: connections.map(toConnection),
  };
}

export async function createDocumentImport(input: DocumentImportInput): Promise<ImportedRecord> {
  const discoveredAt = new Date();
  const event = normalizeDocument(input, discoveredAt);
  const duplicate = await findDuplicate(event);
  const row = {
    id: `import-${crypto.randomUUID()}`,
    sourceType: sourceType(input.documentType),
    sourceName: input.fileName,
    freshness: discoveredAt,
    retention: "Retained for 90 days unless deleted sooner",
    deletionState: "active",
    objectPath: input.objectPath,
    eventId: event.id,
    label: event.label,
    amount: event.amount,
    day: event.day,
    kind: event.kind,
    paymentType: event.paymentType,
    status: event.status,
    confidence: duplicate ? "low" : event.confidence,
    amountType: event.amountType,
    accountName: event.accountName,
    reviewed: false,
    note: duplicate ? `${event.note ?? ""} · Possible duplicate` : event.note,
    reviewStatus: duplicate ? "duplicate" : "needs-review",
    duplicateOf: duplicate?.id ?? null,
    discoveredAt,
    eventMetadata: { contentType: input.contentType, size: input.size },
  } satisfies typeof financialImportsTable.$inferInsert;
  const [created] = await db.insert(financialImportsTable).values(row).returning();
  return toRecord(created);
}

export async function reviewImportedRecord(id: string, input: ImportReviewInput): Promise<ImportedRecord | undefined> {
  const [updated] = await db
    .update(financialImportsTable)
    .set({
      reviewStatus: input.decision === "accept" ? "accepted" : "rejected",
      status: input.decision === "accept" ? "forecasted" : "pending",
      reviewed: input.decision === "accept",
    })
    .where(eq(financialImportsTable.id, id))
    .returning();
  return updated ? toRecord(updated) : undefined;
}

export async function deleteImportedRecord(id: string) {
  const [deleted] = await db
    .update(financialImportsTable)
    .set({ deletionState: "deleted", objectPath: null, reviewStatus: "rejected", reviewed: false })
    .where(eq(financialImportsTable.id, id))
    .returning({ id: financialImportsTable.id });
  return Boolean(deleted);
}

export async function getAcceptedImportedEvents(): Promise<FinancialEvent[]> {
  const rows = await db
    .select()
    .from(financialImportsTable)
    .where(and(eq(financialImportsTable.reviewStatus, "accepted"), eq(financialImportsTable.deletionState, "active")));
  return rows.map((row) => ({
    id: row.eventId,
    label: row.label,
    amount: row.amount,
    day: row.day,
    kind: row.kind as FinancialEvent["kind"],
    paymentType: row.paymentType as FinancialEvent["paymentType"],
    status: row.status as FinancialEvent["status"],
    confidence: row.confidence as FinancialEvent["confidence"],
    amountType: row.amountType as FinancialEvent["amountType"],
    accountName: row.accountName,
    reviewed: row.reviewed,
    source: row.sourceName,
    freshness: row.freshness,
    note: row.note ?? undefined,
  }));
}

export async function startAccountConnection(input: AccountConnectionInput): Promise<AccountConnection> {
  const connectedAt = new Date();
  const [created] = await db.insert(accountConnectionsTable).values({
    id: `connection-${crypto.randomUUID()}`,
    institution: input.institution.trim(),
    accountName: input.accountName.trim(),
    accountType: input.accountType,
    permission: "read-only",
    status: "connected",
    connectedAt,
    lastSyncedAt: connectedAt,
  }).returning();
  return toConnection(created);
}