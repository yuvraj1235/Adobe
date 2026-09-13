import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputDirectory = path.join(root, "dist");
const output = path.join(outputDirectory, "brand-ai-readiness-audit.zip");

execFileSync("npm", ["run", "validate"], { cwd: root, stdio: "inherit" });
execFileSync("npm", ["test"], { cwd: root, stdio: "inherit" });
fs.mkdirSync(outputDirectory, { recursive: true });
if (fs.existsSync(output)) fs.rmSync(output);
execFileSync("zip", ["-qr", output, ".", "-x", ".git/*", "dist/*", "node_modules/*", "projectdesc/*", "skills/skills/*", "*.zip"], { cwd: root, stdio: "inherit" });

const size = fs.statSync(output).size;
if (size > 50 * 1024 * 1024) throw new Error(`Package is ${size} bytes, above the 50 MB limit`);
console.log(`Package created: ${path.relative(root, output)} (${size} bytes)`);