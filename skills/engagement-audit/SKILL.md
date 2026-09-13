---
name: engagement-audit
description: Evaluates how conversational AIs and first-time visitors can understand, navigate, and cite a brand's web content. Use when assessing proposition clarity, CTA quality, FAQ presence, trust signals, conversion path, or navigation structure for LLM and RAG readiness.
license: MIT
---

# engagement-audit

## When to use
Use this skill to assess the readiness of a brand's content for consumption, summarization, and citation by conversational LLMs and RAG (Retrieval-Augmented Generation) systems, and to evaluate the first-visit experience for new human visitors.

## Dependencies
Imports from `../../shared/audit-utils.js` (`fetchText`, `makeFinding`, `normalizeSite`, `tagValues`, `textContent`).

## Inputs
- `siteInput` (string): An HTTP(S) URL or domain for a public website.
- `pages` (array, optional): Pre-fetched page snapshot from `crawl-render-audit`. If omitted, the skill fetches the landing page independently.

## Procedure
1. Measure readable content density across all snapshot pages (threshold: 350 chars ≈ 50 words). Note: `crawl-render-audit` uses 200 chars for technical emptiness — this threshold is distinct and higher.
2. Detect explicit audience, customer segment, product category, or use-case language.
3. Check for action-oriented CTA text (`get started`, `try`, `buy`, `contact`, `demo`, etc.). Note: `crawl-render-audit` checks structural `<a>`/`<button>` presence; this check is distinct — it verifies that anchor or button text carries actionable meaning.
4. Check for FAQ, help centre, or "how it works" direct-answer content — the most citable format for LLMs.
5. Check for trust and support signals (contact, privacy, security, customer proof, testimonials, certifications).
6. Check for conversion path language (pricing, plans, booking, trial, free, demo).
7. Check for question-oriented headings and explanatory question language (`how`, `what`, `why`).
8. Check for navigation structure (`<nav>`) or site search input for context-retention and agent orientation.

## Output
Returns `{ findings }` — an array of evidence-backed findings with `id`, `title`, `severity`, `evidence`, and `suggested_action` (`summary`, `priority`, `effort`).
