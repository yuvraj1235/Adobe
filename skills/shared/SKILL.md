---
name: shared-utils
description: Internal shared utilities for the brand-ai-readiness-audit marketplace. Not a standalone skill — provides makeFinding, fetchText, detectBotBlock, dedupeFindings, summarizeFindings, normalizeSite, and related helpers consumed by all other skills in this marketplace.
license: MIT
---

# shared-utils

> [!NOTE]
> This is an **internal** module, not a user-facing entrypoint skill. It is listed in `marketplace.json` with `"internal": true` so marketplace runners include it when cloning the skill graph.

## Exports

| Function | Description |
|---|---|
| `normalizeSite(value)` | Parses and validates an HTTP/HTTPS URL; rejects `file://`, `ftp://`, etc. |
| `makeFinding({id, title, severity, evidence, summary, priority, effort})` | Creates a validated finding object. Throws on unknown severity or effort values. |
| `fetchText(url, options)` | Read-only GET with timeout, manual redirect tracking (cap: 3 hops), and diagnostic metadata. |
| `readRobots(site)` | Fetches and parses `robots.txt` into a structured rules array. |
| `robotsDisallows(robots, path)` | Longest-match robots.txt rule resolution — Allow wins over shorter Disallow. |
| `detectBotBlock(page)` | Four-path bot-block detection: keyword signatures → HTTP status → short error body → content-emptiness threshold. |
| `textContent(html)` | Strips scripts, styles, comments, and HTML tags; decodes common HTML entities. |
| `tagValues(html, tag)` | Returns text contents of all matching elements. |
| `metaContent(html, name)` | Returns the `content` attribute of a named/property meta tag (attribute-order independent). |
| `linksFrom(html, base)` | Extracts all anchor href values as resolved URL objects. |
| `jsonLdBlocks(html)` | Extracts all `<script type="application/ld+json">` block contents. |
| `parseDateClaims(html)` | Extracts ISO-like and 4-digit year strings from HTML for freshness checking. |
| `summarizeFindings(findings)` | Produces `{ total_findings, critical, high, medium, low }` severity counts. |
| `dedupeFindings(findings)` | Removes duplicate findings using a `title|evidence` composite key. |
