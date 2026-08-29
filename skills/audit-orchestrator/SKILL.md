---
name: audit-orchestrator
description: Orchestrates the brand AI readiness audit and aggregates findings from specialized skills.
license: MIT
---

# audit-orchestrator

## When to use
Use this skill as the primary entrypoint to run a full brand AI readiness audit. It is responsible for orchestrating the sub-audits, managing context, and producing the final comprehensive JSON report.

## Inputs
- `site` (string): The URL of the brand's website to audit.

## Procedure
1. Initialize the audit process and record the start time.
2. Invoke `crawl-render-audit` to evaluate technical discoverability and payload efficiency.
3. Invoke `freshness-corroboration` to check data consistency and knowledge graph alignment.
4. Invoke `engagement-audit` to assess conversational AI readiness and citation likelihood.
5. Aggregate all findings, calculate the summary statistics, and return the final report.

## Output
The final output must strictly adhere to the following JSON schema:
```json
{
  "site": "string",
  "audited_at": "string (ISO 8601 datetime)",
  "summary": {
    "total_findings": "number",
    "critical": "number",
    "high": "number",
    "medium": "number"
  },
  "findings": [
    {
      "id": "string",
      "title": "string",
      "severity": "string (critical|high|medium|low)",
      "evidence": "string",
      "suggested_action": "string"
    }
  ]
}
```
