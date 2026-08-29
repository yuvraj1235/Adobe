# Brand AI Readiness Audit

This project contains a modular Agent Skill Marketplace to perform a comprehensive brand AI readiness audit. 

## Orchestration Flow
1. **Audit Orchestrator (`audit-orchestrator`)**: The entrypoint that coordinates the entire audit process, delegates tasks to specialized skills, and aggregates the final JSON report.
2. **Crawl & Render Audit (`crawl-render-audit`)**: Analyzes the site's renderability, JavaScript dependencies, and discoverability for AI agents and LLM crawlers.
3. **Freshness Corroboration (`freshness-corroboration`)**: Checks the recency, accuracy, and consistency of the brand's data across knowledge graphs and standard sources.
4. **Engagement Audit (`engagement-audit`)**: Evaluates how conversational AIs (e.g., ChatGPT, Perplexity) interact with, summarize, and surface the brand's content.
