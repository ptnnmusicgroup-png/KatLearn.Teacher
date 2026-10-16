import { cp, mkdir, readdir, rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const publishDir = path.join(projectRoot, "dist");
const excludedTopLevel = new Set([
  ".git", ".github", ".netlify", ".wrangler", "api", "cloudflare-api",
  "dist", "functions", "netlify", "node_modules", "scripts",
]);
const excludedFiles = new Set([
  ".gitignore", "README.md", "LICENSE", "CODE_OF_CONDUCT.md",
  "CLOUDFLARE_WORKERS_MIGRATION.md", "NETLIFY_MIGRATION.md",
  "CLOUDFLARE_PAGES_MIGRATION.md", "netlify.toml", "wrangler.toml",
  "wrangler-api.toml", "package.json", "package-lock.json", "pnpm-lock.yaml",
  "yarn.lock", ".env.example", "cloudflare-worker.js", "Dockerfile.cloudflare-api",
]);

function shouldCopy(source) {
  const relative = path.relative(projectRoot, source).replaceAll("\\", "/");
  if (!relative || relative === ".") return true;
  const segments = relative.split("/");
  if (excludedTopLevel.has(segments[0])) return false;
  if (segments.some((segment) => segment.startsWith(".") && segment !== ".well-known")) return false;
  if (excludedFiles.has(relative)) return false;
  if (/(^|\/)(?:service-account[^/]*\.json|[^/]*-service-account\.json)$/i.test(relative)) return false;
  if (/\.(?:pem|key|p12|pfx|crt)$/i.test(relative)) return false;
  if (/(^|\/)\.env(?:\.|$)/i.test(relative)) return false;
  return true;
}

function siteUrl(name, fallback) {
  const value = String(process.env[name] || fallback).trim().replace(/\/+$/, "");
  let url;
  try { url = new URL(value); } catch { throw new Error(name + " must be a valid HTTPS origin."); }
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(name + " must be a bare HTTPS origin (for example, https://lms-katlearn.netlify.app).");
  }
  return url.origin;
}

const siteConfig = {
  lmsUrl: siteUrl("KATLEARN_LMS_URL", "https://lms-katlearn.netlify.app"),
  teacherUrl: siteUrl("KATLEARN_TEACHER_URL", "https://teacher-katlearn.netlify.app"),
};
const oldOrigins = [
  [/https:\/\/(?:lms-katlearn\.(?:netlify|vercel)\.app|katlearn-lms\.pages\.dev)/gi, siteConfig.lmsUrl],
  [/https:\/\/(?:teacher-katlearn\.(?:netlify|vercel)\.app|teacher\.katlearn\.vercel\.app|katlearn-teacher\.pages\.dev)/gi, siteConfig.teacherUrl],
];

await rm(publishDir, { recursive: true, force: true });
await mkdir(publishDir, { recursive: true });
for (const entry of await readdir(projectRoot, { withFileTypes: true })) {
  const source = path.join(projectRoot, entry.name);
  if (!shouldCopy(source)) continue;
  await cp(source, path.join(publishDir, entry.name), {
    recursive: true,
    force: true,
    filter: shouldCopy,
  });
}

async function walk(directory, visitor) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(target, visitor);
    else if (entry.isFile()) await visitor(target);
  }
}

await walk(publishDir, async (target) => {
  if (!/\.(?:html?|js|mjs|css|json|svg|xml|txt)$/i.test(target)) return;
  let content = await readFile(target, "utf8");
  const original = content;
  for (const [pattern, replacement] of oldOrigins) content = content.replace(pattern, replacement);
  if (content !== original) await writeFile(target, content, "utf8");
});

await writeFile(
  path.join(publishDir, "site-config.js"),
  "window.KATLEARN_CONFIG = Object.freeze(" + JSON.stringify(siteConfig) + ");\n",
  "utf8",
);

await walk(publishDir, async (target) => {
  if (!/\.html?$/i.test(target)) return;
  let html = await readFile(target, "utf8");
  const tags = [];
  if (!html.includes('src="/site-config.js"')) tags.push('<script src="/site-config.js"></script>');
  if (!html.includes('href="/katlearn-polish.css')) tags.push('<link rel="stylesheet" href="/katlearn-polish.css?v=20261013-1">');
  if (!html.includes('src="/katlearn-transition.js"')) tags.push('<script src="/katlearn-transition.js" defer></script>');
  if (!tags.length) return;
  const insertion = tags.join("\n");
  if (/<head\b[^>]*>/i.test(html)) html = html.replace(/<head\b[^>]*>/i, (head) => head + "\n" + insertion + "\n");
  else if (/<body\b/i.test(html)) html = html.replace(/<body\b/i, insertion + "\n<body");
  else html = insertion + "\n" + html;
  await writeFile(target, html, "utf8");
});

const forbiddenLegacyOrigins = /https:\/\/(?:lms-katlearn\.vercel\.app|teacher-katlearn\.vercel\.app|teacher\.katlearn\.vercel\.app|katlearn-lms\.pages\.dev|katlearn-teacher\.pages\.dev)(?:[/'"?#]|$)/i;
await walk(publishDir, async (target) => {
  if (!/\.(?:html?|js|mjs|css|json|svg|xml|txt)$/i.test(target)) return;
  const content = await readFile(target, "utf8");
  if (forbiddenLegacyOrigins.test(content)) {
    throw new Error("Legacy hosting URL remains in published asset: " + path.relative(publishDir, target));
  }
});

console.log("Netlify static assets prepared in dist/; Netlify Functions serve /api/*.");
