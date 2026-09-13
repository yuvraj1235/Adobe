import { fetchText, jsonLdBlocks, linksFrom, makeFinding, metaContent, normalizeSite, readRobots, robotsDisallows, tagValues, textContent } from "../../shared/audit-utils.js";

export async function runCrawlAudit(siteInput) {
	const site = normalizeSite(siteInput);
	const findings = [];
	const robots = await readRobots(site);
	if (robotsDisallows(robots, site.pathname || "/")) {
		findings.push(makeFinding({ id: "CR-001", title: "Landing page is blocked by robots.txt", severity: "critical", evidence: `robots.txt disallows the audit user agent from ${site.pathname || "/"}.`, summary: "Review robots.txt and allow approved crawlers to access public marketing content.", priority: "critical" }));
		return { findings, pages: [] };
	}
	let page;
	try { page = await fetchText(site, { userAgent: "BrandAIReadinessAudit/1.0 (read-only audit)" }); }
	catch (error) {
		findings.push(makeFinding({ id: "CR-002", title: "Landing page could not be fetched", severity: "critical", evidence: `${error.name === "AbortError" ? "Request timed out" : error.message}.`, summary: "Make the public landing page reachable with a normal HTTPS request.", priority: "critical" }));
		return { findings, pages: [] };
	}
	const body = page.body;
	const visibleText = textContent(body);
	const title = tagValues(body, "title")[0] || "";
	const headings = [...body.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)].map((match) => textContent(match[1])).filter(Boolean);
	const structuredData = jsonLdBlocks(body);
	const images = [...body.matchAll(/<img\b([^>]*)>/gi)];
	const imagesWithoutAlt = images.filter((match) => !/\balt\s*=\s*["'][^"']*["']/i.test(match[1])).length;
	const scriptCount = [...body.matchAll(/<script\b/gi)].length;
	const canonical = [...body.matchAll(/<link\b[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/gi)][0]?.[1] || "";
	const noindex = /<meta\b[^>]*(?:name|property)=["'](?:robots|googlebot)["'][^>]*content=["'][^"']*noindex/i.test(body);
	if (page.redirectCount > 0) findings.push(makeFinding({ id: "CR-003", title: "Landing page requires redirects", severity: "low", evidence: `The request followed ${page.redirectCount} redirect${page.redirectCount === 1 ? "" : "s"} before reaching ${page.url}.`, summary: "Link to the final canonical URL directly where possible and keep redirect chains short.", priority: "low" }));
	if (page.status >= 300 && page.status < 400) findings.push(makeFinding({ id: "CR-015", title: "Landing page redirect could not be resolved", severity: "medium", evidence: `The request stopped at HTTP ${page.status} after ${page.redirectCount} redirect hops.`, summary: "Return a reachable final URL in the Location header and keep redirect chains within normal crawler limits.", priority: "medium" }));
	else if (page.status >= 400) findings.push(makeFinding({ id: "CR-004", title: "Landing page returns an error status", severity: "critical", evidence: `The landing page returned HTTP ${page.status}.`, summary: "Return a successful, indexable response for the public landing page.", priority: "critical" }));
	if (!/text\/html|application\/xhtml/i.test(page.headers.get("content-type") || "")) findings.push(makeFinding({ id: "CR-005", title: "Landing page is not served as HTML", severity: "high", evidence: `Content-Type was ${page.headers.get("content-type") || "missing"}.`, summary: "Serve the primary page as parseable HTML with a correct Content-Type header.", priority: "high" }));
	if (visibleText.length < 200) findings.push(makeFinding({ id: "CR-006", title: "Landing page has very little server-readable text", severity: "high", evidence: `Only ${visibleText.length} characters remained after removing scripts and markup.`, summary: "Render the brand name, offer, audience, and key facts as plain HTML text in the initial response.", priority: "high" }));
		if (visibleText.length < 200 && scriptCount >= 3) findings.push(makeFinding({ id: "CR-018", title: "Landing page appears dependent on client-side rendering", severity: "high", evidence: `The initial response contains ${scriptCount} script elements but fewer than 200 readable characters.`, summary: "Server-render primary content or provide a crawler-readable rendering path without requiring browser JavaScript execution.", priority: "high" }));
	if (!title) findings.push(makeFinding({ id: "CR-007", title: "Landing page has no title", severity: "high", evidence: "No title element was found in the fetched HTML.", summary: "Add a concise, page-specific title describing the brand and primary offer.", priority: "high" }));
	if (!metaContent(body, "description")) findings.push(makeFinding({ id: "CR-008", title: "Landing page has no meta description", severity: "medium", evidence: "No description meta tag was found.", summary: "Add a factual meta description that summarizes the page's offer and audience.", priority: "medium" }));
	if (!headings.length || !/<h1\b/i.test(body)) findings.push(makeFinding({ id: "CR-009", title: "Landing page lacks a clear H1", severity: "medium", evidence: `Found ${headings.length} heading elements and no H1 heading.`, summary: "Add one descriptive H1 that states the primary brand proposition in text.", priority: "medium" }));
	if (!structuredData.length) findings.push(makeFinding({ id: "CR-010", title: "Landing page has no JSON-LD structured data", severity: "medium", evidence: "No application/ld+json block was found in the fetched HTML.", summary: "Add accurate Organization, WebSite, and relevant Product or Service JSON-LD.", priority: "medium" }));
	else if (structuredData.some((block) => { try { JSON.parse(block); return false; } catch { return true; } })) findings.push(makeFinding({ id: "CR-014", title: "Landing page contains invalid JSON-LD", severity: "high", evidence: "At least one application/ld+json block could not be parsed as JSON.", summary: "Fix JSON syntax and validate the resulting schema.org objects before publishing them.", priority: "high" }));
	if (noindex) findings.push(makeFinding({ id: "CR-011", title: "Landing page asks crawlers not to index it", severity: "high", evidence: "A robots or googlebot meta directive contains noindex.", summary: "Remove unintended noindex directives from public pages that should be discoverable.", priority: "high" }));
	if (/noindex/i.test(page.headers.get("x-robots-tag") || "")) findings.push(makeFinding({ id: "CR-016", title: "Server headers ask crawlers not to index the page", severity: "high", evidence: `X-Robots-Tag was ${page.headers.get("x-robots-tag")}.`, summary: "Remove unintended X-Robots-Tag noindex directives from public pages that should be discoverable.", priority: "high" }));
	if (!canonical) findings.push(makeFinding({ id: "CR-012", title: "Landing page has no canonical URL", severity: "low", evidence: "No canonical link element was found.", summary: "Declare the preferred canonical URL where duplicate or alternate URLs exist.", priority: "low" }));
	if (!/<(main|nav|header|footer)\b/i.test(body)) findings.push(makeFinding({ id: "CR-013", title: "Landing page has weak semantic landmarks", severity: "low", evidence: "No main, nav, header, or footer landmark was found in the fetched HTML.", summary: "Use semantic landmarks so automated readers can separate navigation, primary content, and supporting content.", priority: "low" }));
	if (imagesWithoutAlt) findings.push(makeFinding({ id: "CR-017", title: "Images contain no machine-readable alternative text", severity: "medium", evidence: `${imagesWithoutAlt} of ${images.length} image elements have no alt attribute.`, summary: "Add concise, accurate alt text for informative images and use empty alt text only for decorative images.", priority: "medium" }));
	const landingPage = { ...page, title, headings, canonical, visibleText, links: linksFrom(body, site).map(String), jsonLd: structuredData };
	let sitemapCandidates = [];
	try {
		const sitemap = await fetchText(new URL("/sitemap.xml", site), { userAgent: "BrandAIReadinessAudit/1.0 (read-only audit)", timeoutMs: 5000 });
		if (sitemap.status >= 200 && sitemap.status < 300) sitemapCandidates = [...sitemap.body.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => { try { return new URL(match[1]); } catch { return null; } }).filter((url) => url?.origin === site.origin && !robotsDisallows(robots, url.pathname));
	} catch { /* Sitemap discovery is optional. */ }
	const candidates = [...new Set([...linksFrom(body, site), ...sitemapCandidates].filter((link) => link.origin === site.origin && !robotsDisallows(robots, link.pathname)).sort((left, right) => {
		const priority = /about|pricing|product|service|faq|contact|solution/i;
		return Number(priority.test(right.pathname)) - Number(priority.test(left.pathname));
	}).map(String))].slice(0, 4);
	const discovered = [];
	for (const candidate of candidates) {
		try {
			const result = await fetchText(candidate, { userAgent: "BrandAIReadinessAudit/1.0 (read-only audit)", timeoutMs: 7000 });
			if (!/text\/html|application\/xhtml/i.test(result.headers.get("content-type") || "")) continue;
			const candidateBody = result.body;
			discovered.push({ ...result, title: tagValues(candidateBody, "title")[0] || "", headings: [...candidateBody.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)].map((match) => textContent(match[1])).filter(Boolean), canonical: "", visibleText: textContent(candidateBody), links: linksFrom(candidateBody, site).map(String), jsonLd: jsonLdBlocks(candidateBody) });
		} catch { /* A single optional page must not fail the audit. */ }
	}
	return { findings, pages: [landingPage, ...discovered] };
}

if (process.argv[1] === new URL(import.meta.url).pathname) runCrawlAudit(process.argv[2]).then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.message); process.exitCode = 1; });
