import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "marketplace.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

if (manifest.name !== "brand-ai-readiness-audit") throw new Error("marketplace.json has an unexpected name");
if (!Array.isArray(manifest.skills) || manifest.skills.length === 0) throw new Error("marketplace.json must list skills");
if (manifest.skills.filter((skill) => skill.entrypoint === true).length !== 1) throw new Error("marketplace.json must have exactly one entrypoint");

const ids = new Set();
for (const skill of manifest.skills) {
  if (!skill.id || !skill.path || ids.has(skill.id)) throw new Error(`Invalid or duplicate skill id: ${skill.id || "missing"}`);
  ids.add(skill.id);
  const skillPath = path.join(root, skill.path);
  const definitionPath = path.join(skillPath, "SKILL.md");
  if (!fs.existsSync(definitionPath)) throw new Error(`${skill.id} is missing SKILL.md`);
  const definition = fs.readFileSync(definitionPath, "utf8");
  if (!definition.startsWith("---\n") || !/^name:\s*\S+/m.test(definition) || !/^description:\s*\S+/m.test(definition)) throw new Error(`${skill.id} has invalid SKILL.md frontmatter`);
  if (skill.entrypoint === true && !fs.existsSync(path.join(skillPath, "scripts/index.js"))) throw new Error(`${skill.id} is missing scripts/index.js`);
}

console.log(`Marketplace valid: ${manifest.skills.length} skills, 1 entrypoint`);