import { fetchText, makeFinding, normalizeSite, tagValues, textContent } from "../../shared/audit-utils.js";

// Checks owned by engagement-audit (crawl-render-audit owns: semantic landmarks, title,
// meta description, H1, JSON-LD, canonical, alt text, redirect, noindex, render-gap).
// This skill focuses on: proposition clarity, audience language, CTA quality,
// direct-answer content (FAQ), trust signals, conversion path, and
// context-retention / navigation clarity signals.

export async function runEngagementAudit(siteInput, pages = []) {
	const site = normalizeSite(siteInput);
	let snapshots = pages;
	if (!snapshots.length) {
		try {
			const page = await fetchText(site);
			snapshots = [{ ...page, visibleText: textContent(page.body), title: tagValues(page.body, "title")[0] || "", body: page.body }];
		} catch (error) {
			return { findings: [makeFinding({ id: "EN-001", title: "Engagement audit could not access site content", severity: "medium", evidence: error.message, summary: "Provide a reachable public page so visitors' first experience can be evaluated.", priority: "medium" })] };
		}
	}
	const findings = [];
	const text = snapshots.map((page) => page.visibleText || textContent(page.body || "")).join(" ");
	const firstPage = snapshots[0];
	const firstBody = firstPage.body || "";

	// EN-002: Content density — page must have enough words to orient a new visitor
	// (threshold 350 chars ~ 50 words; crawl-render-audit uses 200 for technical emptiness)
	if (text.length < 350) findings.push(makeFinding({ id: "EN-002", title: "The first page does not explain enough for a new visitor", severity: "high", evidence: `The audited pages contain ${text.length} readable characters — too sparse to answer basic visitor questions.`, summary: "State what the brand offers, who it serves, the main outcome, and the next step in concise HTML text.", priority: "high" }));

	// EN-003: Audience / use-case language
	if (!/\b(for|built for|help|solution|platform|service|product|customers?|teams?|businesses|enterprises?|developers?|individuals?)\b/i.test(text)) findings.push(makeFinding({ id: "EN-003", title: "Audience or use case is unclear", severity: "high", evidence: "No explicit audience, customer segment, product category, or use-case language was detected in the fetched content.", summary: "Add an explicit audience statement and concrete use cases near the primary proposition.", priority: "high" }));

	// EN-004: Visible call-to-action — anchor or button with action-oriented text
	// (crawl-render-audit checks structural presence of <a>/<button>; here we check
	// whether any CTA link carries meaningful action text, not just a bare href)
	const ctaPattern = /\b(get started|sign up|try|start|buy|shop|learn more|contact|demo|free trial|subscribe|register|download|book)\b/i;
	if (!ctaPattern.test(text) && !/<button\b/i.test(firstBody)) {
		findings.push(makeFinding({ id: "EN-004", title: "No action-oriented call-to-action language found", severity: "high", evidence: "The first page contains no button element and no action-oriented CTA text (e.g. Get Started, Try, Buy, Contact, Demo).", summary: "Provide a prominent, descriptive CTA that tells the visitor the concrete next step and what happens after it.", priority: "high" }));
	}

	// EN-005: Direct-answer / FAQ content
	if (!/(faq|frequently asked|questions answered|help centre|help center|how (it works|do i|do you|to))/i.test(text)) findings.push(makeFinding({ id: "EN-005", title: "No FAQ or direct-answer content was found", severity: "medium", evidence: "The fetched readable content contains no FAQ, help centre, or 'how it works' section.", summary: "Add concise question-and-answer content for the decisions and objections customers commonly have.", priority: "medium" }));

	// EN-006: Trust and support context
	if (!/(contact|support|privacy|terms|about us|security|customer|case stud|testimonial|partner|review|certification)/i.test(text)) findings.push(makeFinding({ id: "EN-006", title: "Trust or support context is difficult to find", severity: "medium", evidence: "No contact, support, company, policy, security, customer proof, or partner terms were found in the fetched content.", summary: "Expose verifiable company context, support routes, policies, and customer proof near relevant decisions.", priority: "medium" }));

	// EN-007: Conversion path — pricing / purchase / trial / booking language
	if (!/(pricing|plans?|cost|quote|buy|shop|book|demo|trial|contact us|get started|free)/i.test(text)) findings.push(makeFinding({ id: "EN-007", title: "The page lacks a clear conversion path", severity: "medium", evidence: "No pricing, purchase, booking, demo, trial, or get-started language was detected.", summary: "Connect the proposition to a low-friction next action and explain what happens after it.", priority: "medium" }));

	// EN-008: Question-oriented content structure
	if (!/(how|what|why|when|where)\s+\w/i.test(text) && !/\?/.test(text)) findings.push(makeFinding({ id: "EN-008", title: "Content is not organized around visitor questions", severity: "low", evidence: "No question-oriented headings or explanatory question language (how, what, why, when, where) was detected.", summary: "Organize key content around the questions visitors and assistants need answered, using descriptive headings.", priority: "low" }));

	// EN-009: Navigation / context-retention — look for persistent nav, search, or breadcrumbs
	// These signal that a site supports orientation for returning visitors and automated agents
	if (!/<(nav|[a-z]+ role="navigation")\b/i.test(firstBody) && !/<input\b[^>]*(?:type=["']?search|placeholder=["'][^"']*search)/i.test(firstBody)) {
		findings.push(makeFinding({ id: "EN-009", title: "No navigation or search mechanism detected", severity: "low", evidence: "The first page lacks a <nav> element and no search input was found — visitors and automated agents cannot orient themselves beyond the landing page.", summary: "Add a clear navigation structure (top nav or sidebar) and/or site search so visitors can explore content and context-retention is supported.", priority: "low" }));
	}

	return { findings };
}

if (process.argv[1] === new URL(import.meta.url).pathname) runEngagementAudit(process.argv[2]).then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.message); process.exitCode = 1; });
