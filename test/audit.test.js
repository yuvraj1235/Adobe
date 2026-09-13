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
  assert.ok(report.findings.every((item) => item.id && item.title && item.evidence && item.suggested_action.summary && item.suggested_action.priority));
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