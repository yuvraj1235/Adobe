---
name: crawl-render-audit
description: Analyzes site renderability and discoverability for LLM web crawlers.
license: MIT
---

# crawl-render-audit

## When to use
Use this skill to determine if a website can be effectively crawled, parsed, and semantically understood by modern AI agents without executing heavy JavaScript payloads.

## Inputs
- `site` (string): The URL of the brand's website to audit.

## Procedure
1. Fetch the target URL simulating common AI user agents (e.g., GPTBot, ClaudeBot).
2. Analyze the DOM for semantic HTML, proper meta tags, and structured data (JSON-LD).
3. Evaluate potential crawl blockers (e.g., overly restrictive robots.txt, JS-only rendering).

## Output
Returns a structured list of findings detailing technical blockers and recommendations for improving LLM crawlability.
