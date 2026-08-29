---
name: engagement-audit
description: Evaluates how conversational AIs interact with and cite brand content.
license: MIT
---

# engagement-audit

## When to use
Use this skill to assess the readiness of a brand's content for consumption, summarization, and citation by conversational LLMs and RAG (Retrieval-Augmented Generation) systems.

## Inputs
- `site` (string): The URL of the brand's website to audit.

## Procedure
1. Simulate typical user queries related to the brand's products or services.
2. Analyze the site's content density, clarity, and formatting for optimal LLM context window ingestion.
3. Check for the presence of highly-citable content (e.g., concise FAQs, clear value propositions).

## Output
Returns a structured list of findings related to conversational AI readiness and content optimization strategies.
