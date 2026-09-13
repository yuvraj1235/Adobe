import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { runAudit } from "../skills/audit-orchestrator/scripts/index.js";
import { runCrawlAudit } from "../skills/crawl-render-audit/scripts/index.js";

test("orchestrator returns the required report contract", async (t) => {
  const server = createServer((request, response) => {
    if (request.url === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("User-agent: *\nAllow: /");
      return;
    }
  if (request.url === "/sitemap.xml") {
    response.writeHead(200, { "content-type": "application/xml" });
    response.end(`<urlset><url><loc>http://127.0.0.1:${server.address().port}/hidden-pricing</loc></url></urlset>`);
    return;
  }
    response.writeHead(200, { "content-type": "text/html" });
    if (request.url === "/about") {
      response.end("<html><head><title>Acme About</title></head><body><main><h1>About Acme Analytics</h1><p>Acme Analytics was founded in 2020.</p></main></body></html>");
      return;
    }
    response.end(`<!doctype html><html><head><title>Acme Analytics</title><meta name="description" content="Analytics for teams"><link rel="canonical" href="http://localhost/"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme Analytics"}</script></head><body><header><nav><a href="/about">About</a></nav></header><main><h1>Analytics for growing teams</h1><p>Acme Analytics helps teams understand product usage and improve customer outcomes.</p><h2>Frequently Asked Questions</h2><p>How does it work? Contact our support team for a demo and pricing.</p></main><footer>Contact, privacy and security</footer></body></html>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const address = server.address();
  const report = await runAudit(`http://127.0.0.1:${address.port}`);
  assert.equal(report.site, `http://127.0.0.1:${address.port}/`);
  assert.equal(report.summary.total_findings, report.findings.length);
  assert.equal(report.summary.critical, report.findings.filter((item) => item.severity === "critical").length);
  assert.ok(report.findings.every((item) => item.id && item.title && item.evidence && item.suggested_action.summary && item.suggested_action.priority && item.suggested_action.effort));
  assert.ok(Array.isArray(report.action_plan));
});

test("crawl audit discovers a relevant page from sitemap.xml", async (t) => {
  const server = createServer((request, response) => {
    if (request.url === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("User-agent: *\nAllow: /");
      return;
    }
    if (request.url === "/sitemap.xml") {
      response.writeHead(200, { "content-type": "application/xml" });
      response.end(`<urlset><url><loc>http://127.0.0.1:${server.address().port}/pricing</loc></url></urlset>`);
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end(request.url === "/pricing" ? "<html><head><title>Pricing</title></head><body><main><h1>Pricing</h1><p>Plans from $10 per month.</p></main></body></html>" : "<html><head><title>Home</title></head><body><main><h1>Home</h1><p>Useful public content for visitors.</p></main></body></html>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const address = server.address();
  const result = await runCrawlAudit(`http://127.0.0.1:${address.port}`);
  assert.ok(result.pages.some((page) => page.url.endsWith("/pricing")));
});

test("crawl audit reports invalid JSON-LD", async (t) => {
  const server = createServer((request, response) => {
    if (request.url === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("User-agent: *\nAllow: /");
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<html><head><title>Broken Data</title><script type=\"application/ld+json\">{broken</script></head><body><main><h1>Broken Data</h1><p>Readable content.</p></main></body></html>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const address = server.address();
  const report = await runAudit(`http://127.0.0.1:${address.port}`);
  assert.ok(report.findings.some((item) => item.title === "Landing page contains invalid JSON-LD"));
});

test("crawl audit stops when robots.txt disallows the landing page", async (t) => {
  let pageRequests = 0;
  const server = createServer((request, response) => {
    if (request.url === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("User-agent: *\nDisallow: /");
      return;
    }
    pageRequests += 1;
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<h1>Should not be fetched</h1>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const address = server.address();
  const report = await runAudit(`http://127.0.0.1:${address.port}`);
  assert.equal(pageRequests, 0);
  assert.ok(report.findings.some((item) => item.title === "Landing page is blocked by robots.txt"));
});

test("robots.txt allows a longer matching exception", async (t) => {
  const server = createServer((request, response) => {
    if (request.url === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("User-agent: *\nDisallow: /\nAllow: /public");
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<html><head><title>Public</title></head><body><main><h1>Public page</h1><p>Readable public content for visitors and assistants.</p></main></body></html>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const address = server.address();
  const report = await runAudit(`http://127.0.0.1:${address.port}/public`);
  assert.ok(!report.findings.some((item) => item.title === "Landing page is blocked by robots.txt"));
});

test("bot-block challenge response emits critical finding and suppresses false-positive content checks", async (t) => {
  const server = createServer((request, response) => {
    if (request.url === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("User-agent: *\nAllow: /");
      return;
    }
    response.writeHead(503, { "content-type": "text/html" });
    response.end("<html><head><title>Robot Check</title></head><body><p>To discuss automated access to Amazon data please contact api-services-support@amazon.com</p><p>Enter the characters you see below: captcha</p></body></html>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const address = server.address();
  const report = await runAudit(`http://127.0.0.1:${address.port}`);
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].id, "F-001");
  assert.equal(report.findings[0].title, "Crawler blocked or served incomplete content");
  assert.equal(report.findings[0].severity, "critical");
  assert.equal(report.summary.critical, 1);
  assert.equal(report.summary.total_findings, 1);
  // Ensure downstream false positives were NOT produced
  assert.ok(!report.findings.some((item) => item.title.includes("JSON-LD")));
  assert.ok(!report.findings.some((item) => item.title.includes("H1")));
  assert.ok(!report.findings.some((item) => item.title.includes("organization identity")));
});

test("richly-marked-up HTML fixture confirms valid JSON-LD detection and entity corroboration", async (t) => {
  const server = createServer((request, response) => {
    if (request.url === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("User-agent: *\nAllow: /");
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html>
<html>
<head>
  <title>Acme Cloud Services - Scalable Cloud Infrastructure</title>
  <meta name="description" content="Acme Cloud Services provides scalable cloud infrastructure and analytics for enterprise teams.">
  <link rel="canonical" href="http://127.0.0.1:${server.address().port}/">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Acme Cloud Services",
    "url": "http://127.0.0.1:${server.address().port}/",
    "logo": "http://127.0.0.1:${server.address().port}/logo.png",
    "sameAs": [
      "https://twitter.com/acmecloud",
      "https://linkedin.com/company/acmecloud",
      "https://github.com/acmecloud"
    ]
  }
  </script>
</head>
<body>
  <header>
    <nav aria-label="Main Navigation">
      <a href="/">Home</a>
      <a href="/pricing">Pricing</a>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
    </nav>
  </header>
  <main>
    <h1>Scalable Cloud Infrastructure for Enterprise Teams</h1>
    <p>Acme Cloud Services helps engineering and data teams build, deploy, and scale modern web applications with guaranteed 99.99% reliability.</p>
    <h2>What solutions do we offer?</h2>
    <p>We provide automated cluster management, unified logging, and real-time observability built for fast-growing companies.</p>
    <h2>Frequently Asked Questions</h2>
    <p>How do I get started with Acme Cloud Services? Contact our technical team for pricing or start a 14-day free trial today.</p>
    <a href="/trial">Start Free Trial</a>
  </main>
  <footer>
    <p>&copy; ${new Date().getUTCFullYear()} Acme Cloud Services. All rights reserved. <a href="/privacy">Privacy Policy</a> | <a href="/terms">Terms of Service</a> | <a href="/support">Support</a></p>
  </footer>
</body>
</html>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const address = server.address();
  const report = await runAudit(`http://127.0.0.1:${address.port}`);
  
  // Confirms JSON-LD structured data is detected (no missing JSON-LD findings)
  assert.ok(!report.findings.some((item) => item.title === "Landing page has no JSON-LD structured data"));
  assert.ok(!report.findings.some((item) => item.title === "No machine-readable organization identity was found"));
  assert.ok(!report.findings.some((item) => item.title === "Organization identity has no corroborating profile links"));
  assert.ok(!report.findings.some((item) => item.title === "Landing page contains invalid JSON-LD"));

  // Confirm finding sorting order: critical > high > medium > low, and sequential IDs
  const severityRank = { critical: 0, high: 1, medium: 2, low: 3 };
  for (let i = 0; i < report.findings.length - 1; i++) {
    assert.ok(severityRank[report.findings[i].severity] <= severityRank[report.findings[i + 1].severity], `Finding ${report.findings[i].id} (${report.findings[i].severity}) should be >= ${report.findings[i+1].id} (${report.findings[i+1].severity})`);
    assert.equal(report.findings[i].id, `F-${String(i + 1).padStart(3, "0")}`);
  }
});

test("content-emptiness threshold fires on HTTP-200 stub with zero stripped text (no captcha keyword) and suppresses all downstream content checks", async (t) => {
  // Simulates a JS-render-shell or bot-intercept that returns HTTP 200 but contains
  // no readable text — only script loader markup. No captcha keywords present.
  // This is the threshold-based path, distinct from the keyword-matching path.
  const server = createServer((request, response) => {
    if (request.url === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("User-agent: *\nAllow: /");
      return;
    }
    // 1762-byte shell: all script tags, no visible body text, no captcha/CAPTCHA keywords
    response.writeHead(200, { "content-type": "text/html" });
    response.end([
      "<!doctype html>",
      "<html>",
      "<head>",
      '<meta charset="utf-8">',
      '<script src="/_next/static/chunks/webpack-abc123.js" defer></script>',
      '<script src="/_next/static/chunks/main-def456.js" defer></script>',
      '<script src="/_next/static/chunks/pages/index-ghi789.js" defer></script>',
      '<link rel="preload" href="/_next/static/css/app.css" as="style">',
      "</head>",
      "<body>",
      '<div id="__next"></div>',
      '<script>window.__NEXT_DATA__={"props":{},"page":"/","buildId":"abc123"}</script>',
      "</body>",
      "</html>"
    ].join("\n"));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const address = server.address();
  const report = await runAudit(`http://127.0.0.1:${address.port}`);

  // Exactly one finding, from the emptiness-threshold path
  assert.equal(report.findings.length, 1, `Expected 1 finding, got ${report.findings.length}: ${report.findings.map(f => f.title).join(", ")}`);
  assert.equal(report.findings[0].id, "F-001");
  assert.equal(report.findings[0].title, "Fetched content is empty or non-representative — possible bot-block, redirect stub, or JS-only render");
  assert.equal(report.findings[0].severity, "high");
  assert.equal(report.summary.high, 1);
  assert.equal(report.summary.total_findings, 1);
  assert.equal(report.summary.critical, 0);

  // Confirm evidence contains the key diagnostics
  assert.ok(report.findings[0].evidence.includes("bytes"), "Evidence should include byte count");
  assert.ok(report.findings[0].evidence.includes("stripped chars"), "Evidence should include stripped char count");
  assert.ok(report.findings[0].evidence.includes("content_empty") || report.findings[0].evidence.includes("Content-emptiness"), "Evidence should mention emptiness threshold");

  // Confirm no downstream false positives (title, H1, org identity, etc.)
  assert.ok(!report.findings.some((item) => item.title.includes("JSON-LD")));
  assert.ok(!report.findings.some((item) => item.title.includes("H1")));
  assert.ok(!report.findings.some((item) => item.title.includes("organization identity")));
  assert.ok(!report.findings.some((item) => item.title.includes("FAQ")));
  assert.ok(!report.findings.some((item) => item.title.includes("trust")));
});

// ---------------------------------------------------------------------------
// Brand-name extraction unit tests
// ---------------------------------------------------------------------------
import { inferBrandName } from "../skills/freshness-corroboration/scripts/index.js";
import { normalizeSite } from "../skills/shared/audit-utils.js";

test("inferBrandName: og:site_name wins over misleading capitalized nav/body text", (t) => {
  const site = normalizeSite("http://shop.example.com");
  // Page body contains many repeated capitalized nav/category strings that look
  // like brand names ("Samsung Products", "Alexa Skills", "Categories Electronics")
  // but the real brand is declared in og:site_name.
  const body = `<!doctype html>
<html>
<head>
  <meta property="og:site_name" content="TrueStore">
  <title>TrueStore — Online Marketplace</title>
</head>
<body>
  <nav>
    <a href="/samsung">Samsung Products</a>
    <a href="/samsung/phones">Samsung Products</a>
    <a href="/samsung/tablets">Samsung Products</a>
    <a href="/apple">Apple Devices</a>
    <a href="/apple/watch">Apple Devices</a>
    <a href="/categories">Categories Electronics</a>
    <a href="/alexa">Alexa Skills</a>
    <a href="/alexa/home">Alexa Skills</a>
    <a href="/alexa/music">Alexa Skills</a>
  </nav>
  <main><h1>Welcome to TrueStore</h1></main>
</body>
</html>`;
  const snapshots = [{ body, url: "http://shop.example.com/", title: "TrueStore — Online Marketplace" }];
  const name = inferBrandName(site, snapshots);
  assert.equal(name, "TrueStore", `Expected "TrueStore" from og:site_name, got "${name}"`);
});

test("inferBrandName: falls back to cleaned domain label when og:site_name is absent", (t) => {
  const site = normalizeSite("https://amazon.in");
  // No og:site_name, no JSON-LD — should derive "Amazon" from domain "amazon.in"
  const body = `<!doctype html>
<html>
<head><title>Online Shopping site in India - Amazon.in</title></head>
<body>
  <nav>
    <a href="/categories">All Categories</a>
    <a href="/alexa">Alexa Skills</a>
    <a href="/tc">Terms Conditions</a>
  </nav>
  <main><h1>Shop online</h1></main>
</body>
</html>`;
  const snapshots = [{ body, url: "https://www.amazon.in/", title: "Online Shopping site in India - Amazon.in" }];
  const name = inferBrandName(site, snapshots);
  assert.equal(name, "Amazon", `Expected "Amazon" from domain label, got "${name}"`);
  // Confirm it did NOT pick nav text
  assert.ok(name !== "Alexa Skills", "Must not select nav category text");
  assert.ok(name !== "Categories", "Must not select nav label");
  assert.ok(name !== "Terms Conditions", "Must not select legal nav text");
});

test("crawl audit detects missing Open Graph tags (CR-019) and WebSite JSON-LD (CR-020)", async (t) => {
  const server = createServer((request, response) => {
    if (request.url === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("User-agent: *\nAllow: /");
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><html><head><title>Simple Title</title></head><body><main><h1>Heading</h1><p>Some text content here.</p></main></body></html>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const address = server.address();
  const report = await runAudit(`http://127.0.0.1:${address.port}`);
  assert.ok(report.findings.some((item) => item.id.startsWith("F-") && item.title === "Landing page is missing core Open Graph tags"));
  assert.ok(report.findings.some((item) => item.id.startsWith("F-") && item.title === "No WebSite structured data found"));
});

test("crawl audit detects missing hreflang on international domains (CR-021)", async (t) => {
  const server = createServer((request, response) => {
    if (request.url === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("User-agent: *\nAllow: /");
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><html><head><title>International Store</title></head><body><main><h1>Global Store</h1><p>International delivery available.</p></main></body></html>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const address = server.address();
  const report = await runAudit(`http://127.0.0.1:${address.port}/en/products`);
  assert.ok(report.findings.some((item) => item.title === "No hreflang tags found on a likely international domain"));
});

test("orchestrator builds action_plan prioritizing critical/high findings with low effort first", async (t) => {
  const server = createServer((request, response) => {
    if (request.url === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("User-agent: *\nAllow: /");
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    // Minimal page triggering multiple high/medium findings with different efforts
    response.end("<!doctype html><html><head><title>Title</title></head><body><main><h1>Proposition</h1><p>Brief text.</p></main></body></html>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const address = server.address();
  const report = await runAudit(`http://127.0.0.1:${address.port}`);
  assert.ok(Array.isArray(report.action_plan));
  assert.ok(report.action_plan.length <= 3);
  if (report.action_plan.length > 0) {
    assert.ok(report.action_plan[0].finding_id);
    assert.ok(report.action_plan[0].title);
    assert.ok(report.action_plan[0].action);
    assert.ok(["critical", "high"].includes(report.action_plan[0].priority));
    assert.ok(["low", "medium", "high"].includes(report.action_plan[0].effort));
  }
});

test("crawl audit detects AI search crawlers blocked in robots.txt (CR-022)", async (t) => {
  const server = createServer((request, response) => {
    if (request.url === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("User-agent: *\nAllow: /\nUser-agent: GPTBot\nDisallow: /\nUser-agent: ClaudeBot\nDisallow: /");
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><html><head><title>Test Site</title></head><body><main><h1>Public</h1></main></body></html>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const address = server.address();
  const report = await runAudit(`http://127.0.0.1:${address.port}`);
  const finding = report.findings.find((item) => item.title === "robots.txt explicitly blocks major AI search crawlers");
  assert.ok(finding);
  assert.ok(finding.evidence.includes("GPTBot"));
  assert.ok(finding.evidence.includes("ClaudeBot"));
});

test("freshness audit correctly resolves multi-year copyright ranges (e.g. 2020-2026)", async (t) => {
  const server = createServer((request, response) => {
    if (request.url === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("User-agent: *\nAllow: /");
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html><html><head><title>Acme</title></head><body><main><h1>Acme</h1></main><footer><p>&copy; 2019-${new Date().getUTCFullYear()} Acme Corp. All rights reserved.</p></footer></body></html>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const address = server.address();
  const report = await runAudit(`http://127.0.0.1:${address.port}`);
  // Current year is in the copyright range, so it must NOT trigger stale copyright year
  assert.ok(!report.findings.some((item) => item.title === "Copyright year in page footer appears stale"));
});