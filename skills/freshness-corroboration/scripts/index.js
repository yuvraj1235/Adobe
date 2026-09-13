import { fetchText, jsonLdBlocks, makeFinding, metaContent, normalizeSite, parseDateClaims, tagValues, textContent } from "../../shared/audit-utils.js";

/**
 * Infer the brand name for Wikidata corroboration.
 * Priority (high → low):
 *   1. JSON-LD Organization/Brand name (handled by caller — organizationNames[0])
 *   2. og:site_name meta tag (explicit, authoritative, never nav text)
 *   3. Cleaned hostname segment  (e.g. "Amazon" from "amazon.in")
 *   4. Shortest non-trivial segment of the first page title
 *      (e.g. "Node.js" from "Node.js — Run JavaScript Everywhere")
 *
 * Body text is intentionally NEVER used — it contains nav links, category
 * labels, and other repeated capitalized strings that are not the brand name.
 */
export function inferBrandName(site, snapshots) {
	// Priority 2: og:site_name — explicit machine-readable site label
	for (const page of snapshots) {
		const ogName = metaContent(page.body || "", "og:site_name").trim();
		if (ogName.length >= 2) return ogName;
	}

	// Priority 3: cleaned hostname (first label before the first dot, no "www")
	// e.g. "amazon.in" → "Amazon", "stripe.com" → "Stripe", "nodejs.org" → "Nodejs"
	const host = site.hostname.replace(/^www\./, "");
	const domainLabel = host.split(".")[0].replace(/-/g, " ");
	if (domainLabel.length >= 3) {
		return domainLabel.charAt(0).toUpperCase() + domainLabel.slice(1);
	}

	// Priority 4: shortest non-trivial segment of the first page title
	// Splits on " - ", " | ", " — ", ":"
	const firstTitle = snapshots[0]?.title ||
		tagValues(snapshots[0]?.body || "", "title")[0] || "";
	if (firstTitle) {
		const segments = firstTitle.split(/\s*[-—|:]\s+|\s+[-—|:]\s*/)
			.map((s) => s.trim())
			.filter((s) => s.length >= 2 && s.length <= 40 && /[A-Za-z]/.test(s));
		const candidate = segments.sort((a, b) => a.length - b.length)[0];
		if (candidate) return candidate;
	}

	return null;
}

function structuredData(page) {
	return page.jsonLd.flatMap((block) => { try { const value = JSON.parse(block); return Array.isArray(value) ? value : [value]; } catch { return []; } });
}

/** Return the current copyright year extracted from visible text, or null. */
function extractCopyrightYear(texts) {
	for (const text of texts) {
		const match = text.match(/©\s*(20\d{2})|copyright\s*(?:©)?\s*(20\d{2})/i);
		if (match) return Number(match[1] || match[2]);
	}
	return null;
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
	const data = snapshots.flatMap(structuredData);
	const organizationNames = data.filter((item) => /Organization|LocalBusiness|Brand/i.test(String(item["@type"]))).map((item) => item.name).filter(Boolean);

	// Deduplicate page titles before reporting — collect one title per unique URL
	const pageTitlePairs = snapshots
		.map((page) => ({ url: page.url || "", title: page.title || tagValues(page.body || "", "title")[0] || "" }))
		.filter((pair) => pair.title);
	const uniqueTitles = [...new Map(pageTitlePairs.map((p) => [p.title, p])).values()];

	// FR-002: No machine-readable organization identity
	if (!organizationNames.length && !data.length) findings.push(makeFinding({ id: "FR-002", title: "No machine-readable organization identity was found", severity: "medium", evidence: "The fetched pages contain no Organization, LocalBusiness, Brand, or other JSON-LD identity object.", summary: "Publish one canonical organization identity with name, URL, logo, contact details, and sameAs links.", priority: "medium" }));

	// FR-007: Organization identity has no corroborating sameAs links
	if (organizationNames.length && data.filter((item) => /Organization|LocalBusiness|Brand/i.test(String(item["@type"]))).every((item) => !item.sameAs)) findings.push(makeFinding({ id: "FR-007", title: "Organization identity has no corroborating profile links", severity: "low", evidence: "Organization structured data was found, but none of its identity objects contains sameAs links.", summary: "Add accurate sameAs links to authoritative profiles so assistants can distinguish and corroborate the brand entity.", priority: "low" }));

	// FR-003: Conflicting organization names across structured data
	if (organizationNames.length > 1 && !organizationNames.every((name) => name === organizationNames[0])) findings.push(makeFinding({ id: "FR-003", title: "Organization names conflict across structured data", severity: "high", evidence: `Found multiple organization names: ${[...new Set(organizationNames)].join(", ")}.`, summary: "Choose one canonical brand name and use it consistently across pages and structured data.", priority: "high" }));

	// FR-004: Potentially stale year claims
	const dates = snapshots.flatMap((page) => parseDateClaims(page.body || ""));
	const oldYears = dates.filter((date) => Number.parseInt(date.slice(0, 4), 10) < new Date().getUTCFullYear() - 3);
	if (oldYears.length && !/copyright|founded|established|history/i.test(texts.join(" "))) findings.push(makeFinding({ id: "FR-004", title: "Pages contain potentially stale year claims", severity: "medium", evidence: `Found year claims older than three years: ${[...new Set(oldYears)].slice(0, 5).join(", ")}.`, summary: "Review dated claims and add explicit updated or valid-through dates where facts remain current.", priority: "medium" }));

	// FR-009: Stale or absent copyright year in page footer
	const copyrightYear = extractCopyrightYear(texts);
	const currentYear = new Date().getUTCFullYear();
	if (copyrightYear !== null && copyrightYear < currentYear - 1) {
		findings.push(makeFinding({ id: "FR-009", title: "Copyright year in page footer appears stale", severity: "medium", evidence: `Detected copyright year ${copyrightYear}; current year is ${currentYear}. Stale copyright notices signal infrequently updated content to automated readers.`, summary: "Update the copyright year and add a visible last-updated or published date to key content pages.", priority: "medium" }));
	} else if (copyrightYear === null && !/last.?updated|published|modified|updated\s+\d{4}/i.test(texts.join(" "))) {
		findings.push(makeFinding({ id: "FR-010", title: "No visible freshness signal found on the page", severity: "low", evidence: "No copyright year, last-updated date, or publication date was detected in the fetched content.", summary: "Add a visible freshness signal (e.g. last updated date, copyright year) so automated readers can assess content recency.", priority: "low" }));
	}

	// FR-005: Inconsistent page titles suggesting unstable brand identity (deduplicated)
	if (uniqueTitles.length > 1 && organizationNames.length === 0) {
		const titleEvidence = uniqueTitles.slice(0, 4).map((p) => `"${p.title}" (${p.url})`).join(" | ");
		findings.push(makeFinding({ id: "FR-005", title: "Page naming does not establish a stable brand identity", severity: "low", evidence: `Observed ${uniqueTitles.length} distinct page titles: ${titleEvidence}.`, summary: "Use a consistent brand name and canonical site identity in titles, headings, and structured data.", priority: "low" }));
	}

	// FR-006: Conflicting pricing claims
	// FR-006: Conflicting pricing claims — require at least one digit to avoid noise words
	const claims = texts.flatMap((text) => [...text.matchAll(/(?:price|cost|starts? at|from)\s*[:$€£]?\s*[$€£]?\s*[\d][\d,.]*(?:\s*(?:per|\/|a)\s*\w+)?/gi)].map((match) => match[0].trim()));
	if (new Set(claims).size > 1) findings.push(makeFinding({ id: "FR-006", title: "Pricing claims vary across fetched content", severity: "high", evidence: `Found distinct pricing statements: ${[...new Set(claims)].slice(0, 4).join("; ")}.`, summary: "Centralize pricing, state currency and billing period, and mark plan availability and effective dates clearly.", priority: "high" }));

	// FR-008 / FR-011: Cross-source entity corroboration via Wikidata (always-on, one bounded read-only GET).
	// Brand name is resolved by inferBrandName() which uses a strict priority chain
	// (og:site_name → domain label → title segment) and never reads body/nav text.
	const nameForCorroboration = organizationNames[0] ?? inferBrandName(site, snapshots);

	if (nameForCorroboration) {
		try {
			const query = encodeURIComponent(nameForCorroboration);
			const response = await fetchText(
				`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${query}&language=en&format=json&limit=5`,
				{ userAgent: "BrandAIReadinessAudit/1.0 (read-only corroboration)", timeoutMs: 6000 }
			);
			const results = JSON.parse(response.body).search || [];
			const exact = results.find((item) => item.label?.toLowerCase() === nameForCorroboration.toLowerCase());
			if (!results.length) {
				findings.push(makeFinding({ id: "FR-011", title: "Brand name not found in public knowledge base", severity: "medium", evidence: `Wikidata search for "${nameForCorroboration}" returned no results. The brand may be too new, use a common-noun name, or lack public entity records.`, summary: "Ensure the brand has a Wikidata entry, Wikipedia article, or sameAs link to a recognized authority source so AI assistants can corroborate and disambiguate it.", priority: "medium" }));
			} else if (!exact && results.length) {
				// Name collision / disambiguation problem — other entities share the name
				const collisions = results.slice(0, 3).map((item) => `"${item.label}"${item.description ? ` (${item.description})` : ""}`).join("; ");
				findings.push(makeFinding({ id: "FR-008", title: "Brand name has ambiguous entity matches in public knowledge base", severity: "medium", evidence: `Wikidata search for "${nameForCorroboration}" returned ${results.length} candidate(s), none an exact match: ${collisions}. Entity disambiguation may be needed.`, summary: "Add sameAs links in structured data pointing to an authoritative external record (Wikidata, Wikipedia, LinkedIn) and ensure the official brand name matches exactly.", priority: "medium" }));
			}
			// If exact match found: no finding — corroboration passes silently
		} catch { /* Cross-source corroboration is optional and must never block a first-party audit. */ }
	} else {
		findings.push(makeFinding({ id: "FR-012", title: "No brand name could be detected for cross-source corroboration", severity: "low", evidence: "No Organization name was found in JSON-LD and no sufficiently repeated proper noun was detected in the fetched content.", summary: "Publish an Organization entity in JSON-LD with a clear, consistent name to enable automated brand recognition and corroboration.", priority: "low" }));
	}

	return { findings };
}

if (process.argv[1] === new URL(import.meta.url).pathname) runFreshnessAudit(process.argv[2]).then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.message); process.exitCode = 1; });
