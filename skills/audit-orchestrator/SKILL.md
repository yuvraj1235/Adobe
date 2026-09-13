---
name: audit-orchestrator
description: Orchestrates the full brand AI readiness audit and aggregates findings from specialist skills into one report. Use this as the primary entrypoint when you need a complete, prioritised audit of a public website's AI discoverability and on-site engagement.
license: MIT
---

# audit-orchestrator

## When to use
Use this skill as the primary entrypoint to run a full brand AI readiness audit. It orchestrates the three specialist skills, deduplicates and severity-ranks their findings, and returns a single structured JSON report with an executive action plan.

## Dependencies
All skills in this marketplace (including this one) share `../../shared/audit-utils.js` which provides `makeFinding`, `fetchText`, `detectBotBlock`, `dedupeFindings`, `summarizeFindings`, and related helpers. This module must be present at `skills/shared/audit-utils.js` relative to the marketplace root.

## Inputs
- `site` (string): An HTTP(S) URL or domain for a public website.

## Procedure
1. Normalise and validate the site URL (HTTP/HTTPS only; `file://` and `ftp://` are rejected immediately).
2. Invoke `crawl-render-audit` to evaluate technical discoverability, HTML delivery, structured data, and collect a bounded page snapshot.
3. If the crawl returns zero pages (bot-block, error, or robots disallow), emit a partial report immediately — downstream skills are skipped to avoid false positives on non-representative content.
4. Invoke `freshness-corroboration` with the page snapshot (no re-fetch) to check entity identity, date freshness, and Wikidata corroboration.
5. Invoke `engagement-audit` with the page snapshot (no re-fetch) to assess CTA quality, FAQ presence, trust signals, and navigation.
6. Merge all findings, deduplicate by `title|evidence` composite key, sort by severity descending, assign stable sequential `F-NNN` IDs, and derive an `action_plan` of the top 3 critical/high findings ranked by severity then implementation effort (low effort first).
7. Each specialist is individually try/catch-wrapped. A failing skill adds one `OR-NNN` graceful finding and does not abort remaining skills.

## Output
The final output strictly adheres to the following JSON schema:
```json
{
  "site": "string (normalised URL)",
  "audited_at": "string (ISO 8601 datetime)",
  "summary": {
    "total_findings": "number",
    "critical": "number",
    "high": "number",
    "medium": "number",
    "low": "number"
  },
  "action_plan": [
    {
      "finding_id": "string (e.g. F-001)",
      "title": "string",
      "action": "string",
      "priority": "string (critical|high|medium|low)",
      "effort": "string (low|medium|high)"
    }
  ],
  "findings": [
    {
      "id": "string (F-NNN sequential)",
      "title": "string",
      "severity": "string (critical|high|medium|low)",
      "evidence": "string",
      "suggested_action": {
        "summary": "string",
        "priority": "string (critical|high|medium|low)",
        "effort": "string (low|medium|high)"
      }
    }
  ]
}
```
