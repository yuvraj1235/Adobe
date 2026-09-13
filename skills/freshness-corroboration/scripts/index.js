import { fetchText, jsonLdBlocks, makeFinding, normalizeSite, parseDateClaims, tagValues, textContent } from "../../shared/audit-utils.js";

function structuredData(page) {
	return page.jsonLd.flatMap((block) => { try { const value = JSON.parse(block); return Array.isArray(value) ? value : [value]; } catch { return []; } });
}

export async function runFreshnessAudit(siteInput, pages = []) {
	const site = normalizeSite(siteInput);
	const findings = [];
	let snapshots = pages;
	if (!snapshots.length) {
		try {
			const page = await fetchText(site);
			snapshots = [{ ...page, body: page.body, jsonLd: jsonLdBlocks(page.body) }];
		} catch (error) {
			findings.push(makeFinding({ id: "FR-001", title: "Freshness audit could not access site content", severity: "medium", evidence: error.message, summary: "Provide a reachable public page so factual claims can be checked for consistency and recency.", priority: "medium" }));
			return { findings };
		}
	}
	const texts = snapshots.map((page) => page.visibleText || textContent(page.body || ""));
	const names = texts.flatMap((text) => text.match(/\b[A-Z][A-Za-z0-9&.-]{2,}(?:\s+[A-Z][A-Za-z0-9&.-]{2,}){0,3}\b/g) || []);
	const nameCounts = new Map(names.map((name) => [name, names.filter((candidate) => candidate === name).length]));
	const likelyNames = [...nameCounts.entries()].filter(([, count]) => count > 1).map(([name]) => name);
	const data = snapshots.flatMap(structuredData);
	const organizationNames = data.filter((item) => /Organization|LocalBusiness|Brand/i.test(String(item["@type"]))).map((item) => item.name).filter(Boolean);
	const pageTitles = snapshots.map((page) => page.title || tagValues(page.body || "", "title")[0]).filter(Boolean);
	const distinctNames = new Set([...organizationNames, ...likelyNames]);
	if (!organizationNames.length && !data.length) findings.push(makeFinding({ id: "FR-002", title: "No machine-readable organization identity was found", severity: "medium", evidence: "The fetched pages contain no Organization, LocalBusiness, Brand, or other JSON-LD identity object.", summary: "Publish one canonical organization identity with name, URL, logo, contact details, and sameAs links.", priority: "medium" }));
	if (organizationNames.length && data.filter((item) => /Organization|LocalBusiness|Brand/i.test(String(item["@type"]))).every((item) => !item.sameAs)) findings.push(makeFinding({ id: "FR-007", title: "Organization identity has no corroborating profile links", severity: "low", evidence: "Organization structured data was found, but none of its identity objects contains sameAs links.", summary: "Add accurate sameAs links to authoritative profiles so assistants can distinguish and corroborate the brand entity.", priority: "low" }));
	if (distinctNames.size > 1 && organizationNames.length && !organizationNames.every((name) => name === organizationNames[0])) findings.push(makeFinding({ id: "FR-003", title: "Organization names conflict across structured data", severity: "high", evidence: `Found multiple organization names: ${[...new Set(organizationNames)].join(", ")}.`, summary: "Choose one canonical brand name and use it consistently across pages and structured data.", priority: "high" }));
	const dates = snapshots.flatMap((page) => parseDateClaims(page.body || ""));
	const oldYears = dates.filter((date) => Number.parseInt(date.slice(0, 4), 10) < new Date().getUTCFullYear() - 3);
	if (oldYears.length && !/copyright|founded|established|history/i.test(texts.join(" "))) findings.push(makeFinding({ id: "FR-004", title: "Pages contain potentially stale year claims", severity: "medium", evidence: `Found year claims older than three years: ${[...new Set(oldYears)].slice(0, 5).join(", ")}.`, summary: "Review dated claims and add explicit updated or valid-through dates where facts remain current.", priority: "medium" }));
	if (new Set(pageTitles).size > 1 && organizationNames.length === 0) findings.push(makeFinding({ id: "FR-005", title: "Page naming does not establish a stable brand identity", severity: "low", evidence: `Observed page titles: ${pageTitles.slice(0, 5).join(" | ")}.`, summary: "Use a consistent brand name and canonical site identity in titles, headings, and structured data.", priority: "low" }));
	const claims = texts.flatMap((text) => [...text.matchAll(/(?:price|cost|starts? at|from)\s*[:$]?\s*([$€£]?\s?[\d,.]+(?:\s*(?:per|\/|a)\s*\w+)?)/gi)].map((match) => match[0].trim()));
	if (new Set(claims).size > 1) findings.push(makeFinding({ id: "FR-006", title: "Pricing claims vary across fetched content", severity: "high", evidence: `Found distinct pricing statements: ${[...new Set(claims)].slice(0, 4).join("; ")}.`, summary: "Centralize pricing, state currency and billing period, and mark plan availability and effective dates clearly.", priority: "high" }));
	if (process.env.BRAND_AUDIT_EXTERNAL === "1" && organizationNames[0]) {
		try {
			const query = encodeURIComponent(organizationNames[0]);
			const response = await fetchText(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${query}&language=en&format=json&limit=3`, { userAgent: "BrandAIReadinessAudit/1.0 (optional corroboration)", timeoutMs: 5000 });
			const results = JSON.parse(response.body).search || [];
			const exact = results.some((item) => item.label?.toLowerCase() === organizationNames[0].toLowerCase());
			if (!exact && results.length) findings.push(makeFinding({ id: "FR-008", title: "External entity matches are ambiguous", severity: "low", evidence: `Wikidata returned possible matches for "${organizationNames[0]}": ${results.map((item) => item.label).join(", ")}.`, summary: "Publish unambiguous entity identifiers and verify official external profiles before linking them as sameAs sources.", priority: "low" }));
		} catch { /* External corroboration is optional and must not block a first-party audit. */ }
	}
	return { findings };
}

if (process.argv[1] === new URL(import.meta.url).pathname) runFreshnessAudit(process.argv[2]).then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.message); process.exitCode = 1; });
