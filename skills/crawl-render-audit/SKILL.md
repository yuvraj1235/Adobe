---
name: crawl-render-audit
description: Analyzes a website's HTTP delivery, HTML structure, structured data, and AI-crawler discoverability. Use when assessing robots.txt compliance, rendering gaps, JSON-LD validity, OpenGraph completeness, hreflang targeting, or when collecting a bounded page snapshot for downstream skills.
license: MIT
---

# crawl-render-audit

## When to use
Use this skill to determine if a website can be effectively crawled, parsed, and semantically understood by modern AI agents and LLM web crawlers without executing heavy JavaScript payloads.

## Dependencies
Imports from `../../shared/audit-utils.js` (`detectBotBlock`, `fetchText`, `jsonLdBlocks`, `linksFrom`, `makeFinding`, `metaContent`, `normalizeSite`, `readRobots`, `robotsDisallows`, `tagValues`, `textContent`).

## Inputs
- `site` (string): An HTTP(S) URL or domain for a public website.

## Procedure
1. Fetch and parse `robots.txt`; emit CR-001 and return immediately if the landing page is disallowed.
2. Fetch the landing page with a 10 s timeout; emit CR-002 and return if unreachable.
3. Run multi-path bot-block detection (keyword signatures, HTTP status, short-error-body heuristic, content-emptiness threshold < 8 KB / < 10 stripped chars); emit CR-000 and return if blocked — all downstream content checks are suppressed to prevent false positives on non-representative responses.
4. Check HTTP delivery: status codes, redirect chains (cap: 3 hops), Content-Type header.
5. Check HTML content: visible text length, JS-render dependency, `<title>`, meta description, `<h1>`, `noindex` directives (`meta` and `X-Robots-Tag`), canonical URL, semantic landmarks, images without alt text.
6. Check structured data: JSON-LD presence (CR-010), JSON-LD syntax validity (CR-014), schema.org `WebSite` + `SearchAction` (CR-020).
7. Check AI discoverability extras: Open Graph completeness — `og:title`, `og:description`, `og:image` (CR-019); `hreflang` for international domains (CR-021).
8. Discover up to 4 same-origin sub-pages from links and `sitemap.xml`, prioritising `/about`, `/pricing`, `/product`, `/faq`, `/contact`, `/solution`. Return all pages as a snapshot for downstream skills.

## Output
Returns `{ findings, pages }`. `pages` is a bounded array (max 5 entries) consumed by `freshness-corroboration` and `engagement-audit` — no re-fetch is needed. The skill never follows unbounded links or modifies the target site.
