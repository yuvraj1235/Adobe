# Brand AI Readiness Audit

A read-only Agent Skill Marketplace that audits a public website for AI discoverability, crawlability, content freshness, and on-site engagement problems. It produces a single structured JSON report with prioritized, evidenced findings.

## Quick Start

Requires **Node.js 18** or newer. From the marketplace root:

```bash
npm install                                               # first-time only
node skills/audit-orchestrator/scripts/index.js https://example.com
```

Run `npm test` to execute the unit test suite.
Run `npm run validate` to check the manifest and skill folders.
Run `npm run package` to validate, test, and create `dist/brand-ai-readiness-audit.zip`.

Every fetch is a **read-only GET**. The audit never logs in, submits forms, alters the site, or makes authenticated requests. Requests are time-bounded and `robots.txt` is honoured.

## How the Orchestrator Composes Results

`audit-orchestrator` is the single entrypoint. It runs the three specialist skills in sequence and merges their findings:

```
runAudit(siteInput)
  │
  ├─ 1. crawl-render-audit       ← fetches landing page + up to 4 sub-pages
  │       └─ returns: findings[], pages[]
  │
  ├─ [early exit if pages=[] — bot-block or crawl failure]
  │
  ├─ 2. freshness-corroboration  ← receives pages[] from step 1 (no re-fetch)
  │       └─ returns: findings[]
  │
  ├─ 3. engagement-audit         ← receives pages[] from step 1 (no re-fetch)
  │       └─ returns: findings[]
  │
  └─ merge → deduplicate → sort by severity → assign stable F-NNN IDs → emit report
```

Each skill is wrapped in a try/catch. A failing skill adds one `OR-NNN` finding and does not abort the remaining skills.

Skill invocation and per-finding contribution is logged to **stderr** on every run, e.g.:
```
[orchestrator] START site=https://example.com/
[orchestrator] crawl-render-audit done: 4 finding(s), 2 page(s) collected
[orchestrator] freshness skill done: 2 finding(s) — FR-009:Copyright year stale, FR-008:Brand name ambiguous
[orchestrator] engagement skill done: 0 finding(s) — all checks passed
[orchestrator] DONE total_findings=6 wall-clock=2341ms
```

## Skills and Checks Owned by Each

### 1. `audit-orchestrator`
Single entrypoint. No content checks of its own — only composes, deduplicates, sorts, and assigns report IDs.

### 2. `crawl-render-audit`
**Reachability and HTML delivery:**
- Bot-block / content-emptiness detection (HTTP status + byte/text threshold)
- Landing page fetch failure or timeout
- HTTP error status (4xx/5xx)
- Redirect chain length
- Non-HTML Content-Type
- `robots.txt` disallow for the audit user agent

**Content structure:**
- Very little server-readable text (< 200 chars after stripping)
- JS-only render gap (< 200 chars + ≥ 3 script tags)
- Missing `<title>`
- Missing meta description
- Missing `<h1>`
- Missing JSON-LD structured data / invalid JSON-LD
- `noindex` meta or X-Robots-Tag
- Missing canonical URL
- Weak semantic landmarks (`main`, `nav`, `header`, `footer`)
- Images without `alt` text

**Discovery:** fetches up to 4 priority sub-pages from links + sitemap.xml and passes all pages to downstream skills.

### 3. `freshness-corroboration`
**Identity and naming:**
- No machine-readable Organization/LocalBusiness/Brand in JSON-LD
- Organization identity lacks `sameAs` corroborating links
- Conflicting organization names across structured data
- Inconsistent page titles across discovered pages (deduplicated per URL)

**Date/freshness signals:**
- Potentially stale year claims (> 3 years old) not attributed to history/founding
- Stale copyright year in footer (> 1 year behind current)
- No visible freshness signal at all (no copyright year, no last-updated date)

**Cross-source corroboration (always-on, one bounded read-only Wikidata GET):**
- Brand name not found in Wikidata — entity may lack public recognition
- Brand name has ambiguous entity matches — name collision / disambiguation problem (Appendix D)
- No brand name detectable at all — JSON-LD absent and no repeated proper noun found

**Content consistency:**
- Conflicting pricing claims across fetched pages

### 4. `engagement-audit`
**Proposition and orientation:**
- Content too sparse to orient a new visitor (< 350 chars)
- Audience or use-case language absent

**Action and conversion:**
- No action-oriented CTA text (Get Started, Buy, Demo, Trial, Contact, etc.)
- No conversion path language (pricing, plans, booking, trial, free)

**Direct answers and trust:**
- No FAQ, help centre, or "how it works" content
- No trust/support signals (contact, support, privacy, security, testimonials)

**Navigation:**
- No `<nav>` element and no search input — agents and returning visitors cannot orient themselves

**Question-oriented content:**
- No question-phrased headings or explanatory question language

## Report Schema

```jsonc
{
  "site": "https://example.com/",
  "audited_at": "2026-09-13T07:00:00.000Z",
  "summary": {
    "total_findings": 4,
    "critical": 0, "high": 1, "medium": 2, "low": 1
  },
  "findings": [
    {
      "id": "F-001",
      "title": "...",
      "severity": "high",        // critical | high | medium | low
      "evidence": "...",         // specific observed values (status, bytes, counts, text)
      "suggested_action": {
        "summary": "...",
        "priority": "high"
      }
    }
  ]
}
```

Finding IDs are sequential (`F-001`, `F-002`, …) sorted by severity descending. They are stable within a run but may shift between runs as findings appear or disappear.

## Layout

```
skills/
  audit-orchestrator/       ← entrypoint
  crawl-render-audit/       ← reachability + HTML structure
  freshness-corroboration/  ← identity, dates, cross-source corroboration
  engagement-audit/         ← proposition, CTA, trust, navigation
  shared/
    audit-utils.js          ← fetchText, detectBotBlock, makeFinding, etc.
marketplace.json
test/
  audit.test.js
```

`marketplace.json` lists the four skills and marks exactly one entrypoint. The marketplace completes within the five-minute runtime target for typical sites.
