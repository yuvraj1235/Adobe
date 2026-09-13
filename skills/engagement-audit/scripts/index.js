import { fetchText, makeFinding, normalizeSite, tagValues, textContent } from "../../shared/audit-utils.js";

export async function runEngagementAudit(siteInput, pages = []) {
	const site = normalizeSite(siteInput);
	let snapshots = pages;
	if (!snapshots.length) {
		try { const page = await fetchText(site); snapshots = [{ ...page, visibleText: textContent(page.body), title: tagValues(page.body, "title")[0] || "" }]; }
		catch (error) { return { findings: [makeFinding({ id: "EN-001", title: "Engagement audit could not access site content", severity: "medium", evidence: error.message, summary: "Provide a reachable public page so visitors' first experience can be evaluated.", priority: "medium" })] }; }
	}
	const findings = [];
	const text = snapshots.map((page) => page.visibleText || textContent(page.body || "")).join(" ");
	const firstPage = snapshots[0];
	if (text.length < 350) findings.push(makeFinding({ id: "EN-002", title: "The first page does not explain enough for a new visitor", severity: "high", evidence: `The audited pages contain ${text.length} readable characters.`, summary: "State what the brand offers, who it serves, the main outcome, and the next step in concise HTML text.", priority: "high" }));
	if (!/\b(for|built for|help|solution|platform|service|product|customers?|teams?)\b/i.test(text)) findings.push(makeFinding({ id: "EN-003", title: "Audience or use case is unclear", severity: "high", evidence: "No clear audience, customer, product, service, or use-case language was detected.", summary: "Add an explicit audience statement and concrete use cases near the primary proposition.", priority: "high" }));
	if (!/<(?:a|button)\b/i.test(firstPage.body || "")) findings.push(makeFinding({ id: "EN-004", title: "No visible next step was found", severity: "high", evidence: "The first page contains no anchor or button element.", summary: "Provide a prominent, descriptive next step such as contact, trial, demo, documentation, or purchase.", priority: "high" }));
	if (!/(faq|frequently asked|questions)/i.test(text)) findings.push(makeFinding({ id: "EN-005", title: "No FAQ or direct-answer content was found", severity: "medium", evidence: "The fetched readable content contains no FAQ or frequently asked questions section.", summary: "Add concise question-and-answer content for the decisions and objections customers commonly have.", priority: "medium" }));
	if (!/(contact|support|privacy|terms|about us|security|customer|case stud)/i.test(text)) findings.push(makeFinding({ id: "EN-006", title: "Trust or support context is difficult to find", severity: "medium", evidence: "No contact, support, company, policy, security, or customer-proof terms were found.", summary: "Expose verifiable company context, support routes, policies, and customer proof near relevant decisions.", priority: "medium" }));
	if (!/(pricing|plans?|cost|quote|buy|book|demo|trial|contact|learn more|get started)/i.test(text)) findings.push(makeFinding({ id: "EN-007", title: "The page lacks a clear conversion path", severity: "medium", evidence: "No pricing, purchase, booking, demo, trial, contact, or start language was detected.", summary: "Connect the proposition to a low-friction next action and explain what happens after it.", priority: "medium" }));
	if (!/(\?|how|what|why|when|where)/i.test(text)) findings.push(makeFinding({ id: "EN-008", title: "Content is not organized around visitor questions", severity: "low", evidence: "No question-oriented headings or explanatory question language was detected.", summary: "Organize key content around the questions visitors and assistants need answered, using descriptive headings.", priority: "low" }));
	return { findings };
}

if (process.argv[1] === new URL(import.meta.url).pathname) runEngagementAudit(process.argv[2]).then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.message); process.exitCode = 1; });
