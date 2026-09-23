export type RuleTier = "law" | "official_fee" | "market_norm" | "derived";

export type RuleEntry = {
  value: number | string | boolean;
  unit: string;
  tier: RuleTier;
  source_description: string;
  source_url: string;
};

export type RulesDocument = {
  version: number;
  rules: Record<string, RuleEntry>;
};

// esbuild bundles this JSON import into the server artifact; it never reads from cwd.
import rawRules from "../../../../uae_rules.json" with { type: "json" };

const tiers = new Set<RuleTier>(["law", "official_fee", "market_norm", "derived"]);

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function loadRules(input: unknown): RulesDocument {
  if (!input || typeof input !== "object") throw new Error("uae_rules.json must be an object.");
  const document = input as Partial<RulesDocument>;
  if (typeof document.version !== "number" || !document.rules || typeof document.rules !== "object") {
    throw new Error("uae_rules.json must contain a numeric version and rules object.");
  }
  for (const [id, raw] of Object.entries(document.rules)) {
    if (!raw || typeof raw !== "object") throw new Error(`Rule ${id} must be an object.`);
    const rule = raw as Partial<RuleEntry>;
    if (rule.value === undefined || !["number", "string", "boolean"].includes(typeof rule.value)) throw new Error(`Rule ${id} has an invalid value.`);
    if (typeof rule.unit !== "string" || !tiers.has(rule.tier as RuleTier) || typeof rule.source_description !== "string" || typeof rule.source_url !== "string" || !/^https?:\/\//.test(rule.source_url)) {
      throw new Error(`Rule ${id} is missing valid metadata.`);
    }
  }
  return deepFreeze(document as RulesDocument);
}

export const uaeRules = loadRules(rawRules);

export function getRule(id: string): RuleEntry {
  const rule = uaeRules.rules[id];
  if (!rule) throw new Error(`Missing UAE rule: ${id}`);
  return rule;
}

export function ruleNumber(id: string): number {
  const value = getRule(id).value;
  if (typeof value !== "number") throw new Error(`Rule ${id} is not numeric.`);
  return value;
}

export function ruleBoolean(id: string): boolean {
  const value = getRule(id).value;
  if (typeof value !== "boolean") throw new Error(`Rule ${id} is not boolean.`);
  return value;
}

export function ruleAssumption(...ids: string[]): string[] {
  return ids.map((id) => {
    const rule = getRule(id);
    return `${id}: ${rule.source_description} Source: ${rule.source_url}`;
  });
}