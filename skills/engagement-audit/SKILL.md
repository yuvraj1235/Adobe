---
name: engagement-audit
description: Evaluates how conversational AIs interact with and cite brand content.
license: MIT
---

# engagement-audit

## When to use
Use this skill to assess the readiness of a brand's content for consumption, summarization, and citation by conversational LLMs and RAG (Retrieval-Augmented Generation) systems.

## Inputs
- `site` (string): An HTTP(S) URL or domain for a public website.

## Procedure
1. Inspect the readable content a new visitor and retrieval system can access from the bounded page snapshot.
2. Analyze the site's content density, clarity, and formatting for optimal LLM context window ingestion.
3. Check for the presence of highly-citable content (e.g., concise FAQs, clear value propositions).

## Output
Returns evidence-backed findings and prioritized actions for clearer visitor orientation and citable answers.
