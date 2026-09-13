---
name: freshness-corroboration
description: Checks recency and consistency of brand data across the web.
license: MIT
---

# freshness-corroboration

## When to use
Use this skill to verify that the brand's core facts, pricing, and messaging are up-to-date and consistent across different sources, ensuring AI agents don't hallucinate outdated information.

## Inputs
- `site` (string): An HTTP(S) URL or domain for a public website.

## Procedure
1. Extract key entities and factual claims from the target site.
2. Compare entities and claims across the bounded first-party page snapshot; use external sources only when an explicitly configured provider is available.
3. Identify discrepancies, outdated information, or conflicting claims.

## Output
Returns evidence-backed findings and states limitations rather than inventing external corroboration.
