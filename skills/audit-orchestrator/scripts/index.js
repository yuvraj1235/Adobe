import { dedupeFindings, makeFinding, normalizeSite, summarizeFindings } from "../../shared/audit-utils.js";
import { runCrawlAudit } from "../../crawl-render-audit/scripts/index.js";
import { runFreshnessAudit } from "../../freshness-corroboration/scripts/index.js";
import { runEngagementAudit } from "../../engagement-audit/scripts/index.js";

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

export async function runAudit(siteInput) {
	const site = normalizeSite(siteInput);
	const findings = [];
	let crawl = { findings: [], pages: [] };
	try { crawl = await runCrawlAudit(site.href); findings.push(...crawl.findings); }
	catch (error) { findings.push(makeFinding({ id: "OR-001", title: "Technical crawl skill failed", severity: "high", evidence: error.message, summary: "Rerun the audit after the technical collection skill is available.", priority: "high" })); }
	if (!crawl.pages.length) return { site: site.href, audited_at: new Date().toISOString(), summary: summarizeFindings(findings), findings };
	for (const [label, runner] of [["freshness", runFreshnessAudit], ["engagement", runEngagementAudit]]) {
		try { findings.push(...(await runner(site.href, crawl.pages)).findings); }
		catch (error) { findings.push(makeFinding({ id: `OR-${label === "freshness" ? "002" : "003"}`, title: `${label} audit skill failed`, severity: "medium", evidence: error.message, summary: "Treat this area as unverified and rerun the audit when the skill is available.", priority: "medium" })); }
	}
	const unique = dedupeFindings(findings).map((finding, index) => ({ ...finding, id: `F-${String(index + 1).padStart(3, "0")}` })).sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity]);
	return { site: site.href, audited_at: new Date().toISOString(), summary: summarizeFindings(unique), findings: unique };
}

if (process.argv[1] === new URL(import.meta.url).pathname) runAudit(process.argv[2]).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
