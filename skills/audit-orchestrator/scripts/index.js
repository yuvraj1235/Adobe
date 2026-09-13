import { dedupeFindings, makeFinding, normalizeSite, summarizeFindings } from "../../shared/audit-utils.js";
import { runCrawlAudit } from "../../crawl-render-audit/scripts/index.js";
import { runFreshnessAudit } from "../../freshness-corroboration/scripts/index.js";
import { runEngagementAudit } from "../../engagement-audit/scripts/index.js";

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

export async function runAudit(siteInput) {
	const auditStart = Date.now();
	const site = normalizeSite(siteInput);
	const findings = [];
	let crawl = { findings: [], pages: [] };
	process.stderr.write(`[orchestrator] START site=${site.href}\n`);
	try {
		crawl = await runCrawlAudit(site.href);
		findings.push(...crawl.findings);
		process.stderr.write(`[orchestrator] crawl-render-audit done: ${crawl.findings.length} finding(s), ${crawl.pages.length} page(s) collected\n`);
	} catch (error) {
		process.stderr.write(`[orchestrator] crawl-render-audit THREW: ${error.message}\n`);
		findings.push(makeFinding({ id: "OR-001", title: "Technical crawl skill failed", severity: "high", evidence: error.message, summary: "Rerun the audit after the technical collection skill is available.", priority: "high" }));
	}
	if (!crawl.pages.length) {
		process.stderr.write(`[orchestrator] No pages collected — skipping specialist skills. Total wall-clock: ${Date.now() - auditStart}ms\n`);
		const sortedEarly = dedupeFindings(findings)
			.sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity])
			.map((finding, index) => ({ ...finding, id: `F-${String(index + 1).padStart(3, "0")}` }));
		return { site: site.href, audited_at: new Date().toISOString(), summary: summarizeFindings(sortedEarly), findings: sortedEarly };
	}
	for (const [label, runner] of [["freshness", runFreshnessAudit], ["engagement", runEngagementAudit]]) {
		try {
			const result = await runner(site.href, crawl.pages);
			findings.push(...result.findings);
			process.stderr.write(`[orchestrator] ${label} skill done: ${result.findings.length} finding(s) — ${result.findings.length ? result.findings.map(f => `${f.id}:${f.title}`).join(", ") : "all checks passed"}\n`);
		} catch (error) {
			process.stderr.write(`[orchestrator] ${label} skill THREW: ${error.message}\n`);
			findings.push(makeFinding({ id: `OR-${label === "freshness" ? "002" : "003"}`, title: `${label} audit skill failed`, severity: "medium", evidence: error.message, summary: "Treat this area as unverified and rerun the audit when the skill is available.", priority: "medium" }));
		}
	}
	const unique = dedupeFindings(findings)
		.sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity])
		.map((finding, index) => ({ ...finding, id: `F-${String(index + 1).padStart(3, "0")}` }));
	process.stderr.write(`[orchestrator] DONE total_findings=${unique.length} wall-clock=${Date.now() - auditStart}ms\n`);
	return { site: site.href, audited_at: new Date().toISOString(), summary: summarizeFindings(unique), findings: unique };
}

if (process.argv[1] === new URL(import.meta.url).pathname) runAudit(process.argv[2]).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
