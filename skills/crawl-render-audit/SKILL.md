---
name: crawl-render-audit
description: Analyzes site renderability and discoverability for LLM web crawlers.
license: MIT
---

# crawl-render-audit

## When to use
Use this skill to determine if a website can be effectively crawled, parsed, and semantically understood by modern AI agents without executing heavy JavaScript payloads.

## Inputs
- `site` (string): An HTTP(S) URL or domain for a public website.

## Procedure
1. Fetch the target URL simulating common AI user agents (e.g., GPTBot, ClaudeBot).
2. Analyze the DOM for semantic HTML, proper meta tags, and structured data (JSON-LD).
3. Evaluate potential crawl blockers (e.g., overly restrictive robots.txt, JS-only rendering), metadata, semantic landmarks, structured data validity, and up to four relevant same-origin pages.

## Output
Returns findings plus the bounded page snapshot used by the composing skills. It never follows unbounded links or changes the target site.
