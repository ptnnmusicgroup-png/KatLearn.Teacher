import { readdir, readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const skipDirs = new Set([".git", ".netlify", ".vercel", "node_modules", "dist"]);
const htmlFiles = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && skipDirs.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
    } else if (entry.isFile() && /\.html?$/i.test(entry.name)) {
      htmlFiles.push(full);
    }
  }
}

await walk(root);
const temp = await mkdtemp(path.join(tmpdir(), "katlearn-inline-check-"));
let checked = 0;
const errors = [];

try {
  for (const file of htmlFiles) {
    const html = await readFile(file, "utf8");
    const scriptTag = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
    let match;
    let scriptIndex = 0;

    while ((match = scriptTag.exec(html))) {
      const attributes = match[1] || "";
      const source = match[2] || "";
      scriptIndex += 1;
      if (!source.trim() || /\bsrc\s*=/i.test(attributes)) continue;

      const typeMatch = attributes.match(/\btype\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
      const type = String(typeMatch?.[1] || typeMatch?.[2] || typeMatch?.[3] || "")
        .trim()
        .toLowerCase();
      const isModule = type === "module";
      if (type && !isModule && !["text/javascript", "application/javascript", "text/ecmascript", "application/ecmascript"].includes(type)) {
        continue;
      }

      checked += 1;
      const tempFile = path.join(temp, "inline-" + checked + "." + (isModule ? "mjs" : "cjs"));
      await writeFile(tempFile, source, "utf8");
      const result = spawnSync(process.execPath, ["--check", tempFile], { encoding: "utf8" });
      if (result.status !== 0) {
        errors.push({
          file: path.relative(root, file).replaceAll("\\", "/"),
          scriptIndex,
          output: String(result.stderr || result.stdout || "Node syntax check failed").trim(),
        });
      }
    }
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}

if (errors.length) {
  for (const error of errors) {
    console.error("\n[Inline JavaScript] " + error.file + " (script #" + error.scriptIndex + ")\n" + error.output);
  }
  console.error("\nFailed: " + errors.length + " inline script(s). Checked " + checked + " script(s) in " + htmlFiles.length + " HTML file(s).");
  process.exitCode = 1;
} else {
  console.log("Inline JavaScript syntax OK: checked " + checked + " script(s) in " + htmlFiles.length + " HTML file(s).");
}
