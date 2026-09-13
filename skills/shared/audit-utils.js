export const SEVERITIES = ["critical", "high", "medium", "low"];

export function normalizeSite(value) {
  if (!value || typeof value !== "string") throw new Error("A site URL or domain is required");
  const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  const url = new URL(candidate);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Only HTTP and HTTPS sites are supported");
  url.hash = "";
  return url;
}

export function makeFinding({ id, title, severity, evidence, summary, priority = severity }) {
  if (!SEVERITIES.includes(severity)) throw new Error(`Invalid severity: ${severity}`);
  return { id, title, severity, evidence, suggested_action: { summary, priority } };
}

export function textContent(html) {
  return html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, " ").trim();
}

export function tagValues(html, tag) {
  return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))].map((match) => textContent(match[1])).filter(Boolean);
}

export function metaContent(html, name) {
  const pattern = new RegExp(`<meta\\b[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["'][^>]*>`, "i");
  const reversePattern = new RegExp(`<meta\\b[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["'][^>]*>`, "i");
  return html.match(pattern)?.[1] || html.match(reversePattern)?.[1] || "";
}

export function linksFrom(html, base) {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map((match) => { try { return new URL(match[1], base); } catch { return null; } }).filter(Boolean);
}

export function jsonLdBlocks(html) {
  return [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1].trim());
}

export function detectBotBlock(page) {
  if (!page || !page.body) return { isBlocked: true, reason: "Empty response body", signature: "empty_body", findingTitle: "Crawler blocked or served incomplete content" };
  const body = page.body;
  const status = page.status;
  const bytes = page.bytes || Buffer.byteLength(body);

  // 1. Keyword / signature matching (challenge pages, CAPTCHAs, WAF intercepts)
  const signatures = [
    { pattern: /To discuss automated access to Amazon data please contact/i, name: "Amazon automated access notice" },
    { pattern: /Type the characters you see in this image|Enter the characters you see below/i, name: "Amazon/General image CAPTCHA" },
    { pattern: /\b(g-recaptcha|recaptcha|hcaptcha|cf-turnstile)\b/i, name: "Interactive CAPTCHA widget" },
    { pattern: /\b(unusual traffic|verify you are human|are you a human|robot check|automated queries)\b/i, name: "Bot challenge / human verification prompt" },
    { pattern: /\b(cf-browser-verification|challenge-running|just a moment\.\.\.|attention required!\s*\|\s*cloudflare)\b/i, name: "Cloudflare challenge page" },
    { pattern: /\b(perimeterx|distil networks|datadome|incapsula|shieldsquare|akamaighost)\b/i, name: "WAF bot protection intercept" },
    { pattern: /<title>\s*(?:Robot Check|Access Denied|Security Challenge|Attention Required|Just a moment\.\.\.)\s*<\/title>/i, name: "Challenge page title" }
  ];

  for (const sig of signatures) {
    if (sig.pattern.test(body)) {
      return { isBlocked: true, reason: `Matched bot-block signature: ${sig.name}`, signature: sig.name, findingTitle: "Crawler blocked or served incomplete content" };
    }
  }

  // 2. HTTP status blocking (no need for text analysis)
  if ([401, 403, 429, 503].includes(status)) {
    return { isBlocked: true, reason: `Server returned HTTP ${status} blocking automated access`, signature: `HTTP ${status}`, findingTitle: "Crawler blocked or served incomplete content" };
  }

  // 3. Short error body lacking basic structure
  if (bytes < 300 && !/<body[\s>]/i.test(body) && status >= 400) {
    return { isBlocked: true, reason: "Incomplete error response with minimal markup", signature: `HTTP ${status} short body`, findingTitle: "Crawler blocked or served incomplete content" };
  }

  // 4. Content-emptiness heuristic (threshold-based, keyword-independent).
  //    A page under 8 KB that strips to fewer than 10 readable characters is almost
  //    certainly a bot-gate stub, JS-only render shell, or incomplete redirect body.
  //    This fires on HTTP 200 responses too — the absence of text is the signal, not
  //    the status code. Threshold chosen to:
  //      - catch: 2161-byte/0-char JS stubs (e.g. amazon.in mobile shell)
  //      - miss:  339-byte/48-char noscript pages (JS-only SPA with fallback text)
  const visibleLen = textContent(body).length;
  if (bytes < 8000 && visibleLen < 10) {
    return {
      isBlocked: true,
      reason: `Content-emptiness threshold: ${bytes} bytes, ${visibleLen} stripped chars`,
      signature: "content_empty",
      findingTitle: "Fetched content is empty or non-representative — possible bot-block, redirect stub, or JS-only render"
    };
  }

  return { isBlocked: false, reason: "", signature: "", findingTitle: "" };
}


export async function fetchText(url, { userAgent = "BrandAIReadinessAudit/1.0", timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    let currentUrl = String(url);
    let redirectCount = 0;
    let response;
    for (; redirectCount <= 3; redirectCount += 1) {
      response = await fetch(currentUrl, { redirect: "manual", signal: controller.signal, headers: { "user-agent": userAgent, accept: "text/html,application/xhtml+xml,text/plain,*/*;q=0.1" } });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location || redirectCount === 3) break;
      currentUrl = new URL(location, currentUrl).href;
    }
    const body = await response.text();
    return { url: response.url || currentUrl, status: response.status, headers: response.headers, body, bytes: Buffer.byteLength(body), durationMs: Date.now() - started, redirectCount };
  } finally { clearTimeout(timer); }
}

export async function readRobots(site) {
  try {
    const result = await fetchText(new URL("/robots.txt", site));
    return { ...result, rules: result.body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) };
  } catch (error) { return { status: 0, body: "", rules: [], error: error.name === "AbortError" ? "timeout" : error.message }; }
}

export function robotsDisallows(robots, path) {
  let applies = false;
  const matches = [];
  for (const line of robots.rules) {
    const [key, rawValue = ""] = line.split(":", 2);
    const normalizedKey = key.toLowerCase();
    const value = rawValue.trim();
    if (normalizedKey === "user-agent") applies = value === "*" || /brandaireadinessaudit/i.test(value);
    if (applies && (normalizedKey === "allow" || normalizedKey === "disallow") && value && path.startsWith(value)) matches.push({ type: normalizedKey, length: value.length });
  }
  if (!matches.length) return false;
  const longest = Math.max(...matches.map((match) => match.length));
  return matches.some((match) => match.length === longest && match.type === "disallow");
}

export function parseDateClaims(html) {
  return [...html.matchAll(/\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2}|20\d{2})\b/g)].map((match) => match[1]);
}

export function summarizeFindings(findings) {
  const counts = Object.fromEntries(SEVERITIES.map((severity) => [severity, findings.filter((item) => item.severity === severity).length]));
  return { total_findings: findings.length, ...counts };
}

export function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => { const key = `${finding.title}|${finding.evidence}`; if (seen.has(key)) return false; seen.add(key); return true; });
}