---
name: Bayzati product direction
description: Product architecture and sequencing principles for Bayzati as a UAE future cash-flow planner.
---

Bayzati should use a hub architecture: accounts, documents, and manual inputs feed one structured financial data layer, which then powers the money timeline, safe-to-spend forecasts, goals, loan comparisons, and future chat.

**Why:** Separate interpretations for calendar, chat, and bank data would create contradictions. The product’s trust depends on showing one consistent financial picture with known, forecasted, pending, uncertain, and user-reviewed information clearly distinguished.

**How to apply:** Build the central financial model and safe-to-spend calculation before adding agent behavior. Treat chat as a later action-and-explanation layer over the same data, with previews and explicit confirmation for any plan change. Prioritize UAE salaried residents and families, read-only imports, documents, recurring-payment review, money timeline, goals, and responsible borrowing comparisons.

For document imports, keep file bytes in private App Storage and persist only the object path plus normalized metadata and review state in PostgreSQL. Do not let pending or duplicate discoveries enter forecast calculations.

**Why:** Financial documents need explicit retention and deletion behavior, while review-gated records protect the safe-to-spend view from uncertain or repeated discoveries.

**How to apply:** Keep the import queue and accepted-event projection on the same API contract as Plan and Calendar; accepted records may affect forecasts, while deleted records must be excluded.

Onboarding is another reviewed source in that same layer: persist the normalized household profile, preserve source/confidence/reviewed/freshness metadata, and derive Plan and Calendar events from it rather than from browser-only state.

**Why:** A profile that only exists in local storage cannot keep Safe to Spend consistent across reloads or future data imports.

**How to apply:** Treat the seeded persona as an explicit fallback only when no profile exists; once a profile is saved, all financial views should consume its balance, income, commitments, goals, and buffer inputs.