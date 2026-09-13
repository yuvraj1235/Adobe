# Brand AI Readiness Audit

A read-only Agent Skill Marketplace that audits a public website for AI discoverability and on-site engagement problems.

## Run

Requires Node.js 18 or newer. From the marketplace root:

```bash
node skills/audit-orchestrator/scripts/index.js https://example.com
```

Run `npm run validate` before packaging to check the manifest and skill folders.

Run `npm run package` to validate, test, and create `dist/brand-ai-readiness-audit.zip`. The package excludes Git metadata, generated output, dependencies, and the project handout.

The command emits one JSON report to stdout. It never logs in, submits forms, alters a site, or makes authenticated requests. Requests are bounded and robots.txt is checked before the landing page is fetched.

## Skills

1. `audit-orchestrator` is the single entrypoint. It composes the specialist results, removes duplicates, assigns stable report IDs, and calculates severity counts.
2. `crawl-render-audit` checks HTTP reachability, redirects, HTML delivery, server-readable text, titles, descriptions, headings, canonical URLs, robots directives, server noindex headers, semantic landmarks, JSON-LD validity, image alternatives, and up to four relevant same-origin pages discovered from links or sitemap.xml.
3. `freshness-corroboration` checks machine-readable identity, repeated brand naming, dated claims, and conflicting pricing statements in fetched first-party content.
4. `engagement-audit` checks proposition clarity, audience/use-case language, next steps, direct answers, trust/support context, conversion paths, and question-oriented content.

## Report

The report contains `site`, `audited_at`, `summary`, and `findings`. Every finding includes an ID, title, severity, observed evidence, and a prioritized suggested action. External search corroboration is disabled by default. Set `BRAND_AUDIT_EXTERNAL=1` to perform one bounded Wikidata lookup for a detected organization name; failures are ignored and never presented as corroboration. The default implementation reports only evidence observed from bounded public-page requests.

## Layout

`marketplace.json` lists the four skills and marks exactly one entrypoint. The specialist scripts share utilities from `skills/shared/audit-utils.js`. The marketplace is recommend-only and should complete within the challenge's five-minute runtime target for typical sites.
