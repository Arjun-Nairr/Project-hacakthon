import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// This repo has no React-rendering test harness (no jsdom/RTL), and adding one
// just for a single button would be disproportionate for a hackathon pass.
// This is the smallest seam available: assert the wiring in source, so a
// regression (re-disabling the button, or pointing it elsewhere) fails a test.
function sourceOf(relativePath: string): string {
  const path = fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
  return readFileSync(path, "utf8");
}

// bayzati-mobile-shell.tsx is the sole owner of this button: pages/money-calendar.tsx
// (which used to have its own copy) was superseded by pages/plan.tsx, which renders
// via BayzatiMobileShell instead of duplicating the button markup.
const targets = ["src/components/bayzati-mobile-shell.tsx"];

for (const path of targets) {
  test(`sparkle button in ${path} navigates to /chat and is enabled`, () => {
    const source = sourceOf(path);
    const buttonMatch = source.match(/<Link[^>]*data-testid="button-reserved-quick-action"[^>]*>/);
    assert.ok(buttonMatch, "expected a Link with data-testid=button-reserved-quick-action");
    const tag = buttonMatch![0];

    assert.match(tag, /href="\/chat"/);
    assert.match(tag, /aria-label="Open finance assistant"/);
    assert.equal(tag.includes("disabled"), false);
  });
}
