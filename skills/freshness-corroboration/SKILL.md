---
name: freshness-corroboration
description: Checks the recency, consistency, and public corroboration of brand facts, identity, and pricing across crawled pages and the Wikidata knowledge base. Use when verifying that AI agents will not hallucinate stale information, when assessing entity disambiguation risk, or when validating cross-source brand identity.
license: MIT
---

# freshness-corroboration

## When to use
Use this skill to verify that the brand's core facts, pricing, and messaging are up-to-date and consistent across different sources, ensuring AI agents don't cite or hallucinate outdated information.

## Dependencies
Imports from `../../shared/audit-utils.js` (`fetchText`, `jsonLdBlocks`, `makeFinding`, `metaContent`, `normalizeSite`, `parseDateClaims`, `tagValues`, `textContent`).

## External Data Access
This skill makes **exactly one** bounded, read-only HTTP GET to the Wikidata public search API:
```
https://www.wikidata.org/w/api.php?action=wbsearchentities&search=<brand_name>&language=en&format=json&limit=5
```
The brand name (derived in priority order from: JSON-LD `Organization.name` → `og:site_name` meta tag → cleaned domain label) is sent as a query parameter. No authentication credentials are used and no data is stored or logged. The call has a 6-second timeout and any network failure is silently caught — it never blocks the primary audit.

## Inputs
- `siteInput` (string): An HTTP(S) URL or domain for a public website.
- `pages` (array, optional): Pre-fetched page snapshot from `crawl-render-audit`. If omitted, the skill fetches the landing page independently.

## Procedure
1. Extract all JSON-LD structured data blocks from the page snapshot.
2. Identify machine-readable organization identity (`Organization`, `LocalBusiness`, `Brand` types) and check for `sameAs` corroborating links.
3. Detect conflicting organization names across structured data blocks.
4. Parse date claims and identify potentially stale year assertions (> 3 years old, not attributed to history/founding).
5. Check for stale or absent copyright year and other freshness signals (last-updated, published date).
6. Detect conflicting pricing claims across fetched pages.
7. Check for inconsistent page titles across discovered pages (deduplicated per URL).
8. Infer the brand name via `inferBrandName()` (og:site_name → domain label → title segment; body/nav text intentionally excluded) and make one bounded Wikidata GET to check for entity recognition, exact match, and name collision/disambiguation.

## Output
Returns `{ findings }` — an array of evidence-backed findings with `id`, `title`, `severity`, `evidence`, and `suggested_action` (`summary`, `priority`, `effort`).
