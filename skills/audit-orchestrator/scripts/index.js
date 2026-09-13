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
		findings.push(makeFinding({ id: "OR-001", title: "Technical crawl skill failed", severity: "high", evidence: error.message, summary: "Rerun the audit after the technical collection skill is available.", priority: "high", effort: "medium" }));
	}
	if (!crawl.pages.length) {
		process.stderr.write(`[orchestrator] No pages collected — skipping specialist skills. Total wall-clock: ${Date.now() - auditStart}ms\n`);
		const sortedEarly = dedupeFindings(findings)
			.sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity])
			.map((finding, index) => ({ ...finding, id: `F-${String(index + 1).padStart(3, "0")}` }));
		const earlyActionPlan = buildActionPlan(sortedEarly);
		return { site: site.href, audited_at: new Date().toISOString(), summary: summarizeFindings(sortedEarly), action_plan: earlyActionPlan, findings: sortedEarly };
	}
	const specialistTasks = [
		{ label: "freshness", runner: runFreshnessAudit, errId: "OR-002" },
		{ label: "engagement", runner: runEngagementAudit, errId: "OR-003" }
	];

	const specialistResults = await Promise.allSettled(
		specialistTasks.map(async ({ label, runner, errId }) => {
			try {
				const result = await runner(site.href, crawl.pages);
				process.stderr.write(`[orchestrator] ${label} skill done: ${result.findings.length} finding(s) — ${result.findings.length ? result.findings.map(f => `${f.id}:${f.title}`).join(", ") : "all checks passed"}\n`);
				return result.findings;
			} catch (error) {
				process.stderr.write(`[orchestrator] ${label} skill THREW: ${error.message}\n`);
				return [makeFinding({ id: errId, title: `${label} audit skill failed`, severity: "medium", evidence: error.message, summary: "Treat this area as unverified and rerun the audit when the skill is available.", priority: "medium", effort: "medium" })];
			}
		})
	);

	for (const res of specialistResults) {
		if (res.status === "fulfilled") findings.push(...res.value);
	}
	const unique = dedupeFindings(findings)
		.sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity])
		.map((finding, index) => ({ ...finding, id: `F-${String(index + 1).padStart(3, "0")}` }));
	process.stderr.write(`[orchestrator] DONE total_findings=${unique.length} wall-clock=${Date.now() - auditStart}ms\n`);
	return { site: site.href, audited_at: new Date().toISOString(), summary: summarizeFindings(unique), action_plan: buildActionPlan(unique), findings: unique };
}

/**
 * Build a ≤3-item executive action plan from the highest-severity, lowest-effort findings.
 * Prioritises critical/high findings first, then breaks ties by effort (low before high).
 */
function buildActionPlan(findings) {
	const effortOrder = { low: 0, medium: 1, high: 2 };
	return findings
		.filter((f) => f.severity === "critical" || f.severity === "high")
		.sort((a, b) => {
			const sev = severityOrder[a.severity] - severityOrder[b.severity];
			if (sev !== 0) return sev;
			return (effortOrder[a.suggested_action.effort] ?? 1) - (effortOrder[b.suggested_action.effort] ?? 1);
		})
		.slice(0, 3)
		.map((f) => ({
			finding_id: f.id,
			title: f.title,
			action: f.suggested_action.summary,
			priority: f.suggested_action.priority,
			effort: f.suggested_action.effort
		}));
}

if (process.argv[1] === new URL(import.meta.url).pathname) runAudit(process.argv[2]).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
