---
name: freshness-corroboration
description: Checks recency and consistency of brand data across the web.
license: MIT
---

# freshness-corroboration

## When to use
Use this skill to verify that the brand's core facts, pricing, and messaging are up-to-date and consistent across different sources, ensuring AI agents don't hallucinate outdated information.

## Inputs
- `site` (string): The URL of the brand's website to audit.

## Procedure
1. Extract key entities and factual claims from the target site.
2. Cross-reference these entities with external knowledge graphs and standard search indexes.
3. Identify discrepancies, outdated information, or conflicting claims.

## Output
Returns a structured list of findings highlighting data inconsistencies and freshness issues.
