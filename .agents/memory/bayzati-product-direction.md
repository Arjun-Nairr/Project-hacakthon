---
name: Bayzati product direction
description: Product architecture and sequencing principles for Bayzati as a UAE future cash-flow planner.
---

Bayzati should use a hub architecture: accounts, documents, and manual inputs feed one structured financial data layer, which then powers the money timeline, safe-to-spend forecasts, goals, loan comparisons, and future chat.

**Why:** Separate interpretations for calendar, chat, and bank data would create contradictions. The product’s trust depends on showing one consistent financial picture with known, forecasted, pending, uncertain, and user-reviewed information clearly distinguished.

**How to apply:** Build the central financial model and safe-to-spend calculation before adding agent behavior. Treat chat as a later action-and-explanation layer over the same data, with previews and explicit confirmation for any plan change. Prioritize UAE salaried residents and families, read-only imports, documents, recurring-payment review, money timeline, goals, and responsible borrowing comparisons.