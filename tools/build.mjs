#!/usr/bin/env node
// Validate every run and regenerate what is derived from them:
//   - matrix.md                  every probe, every run, newest run first
//   - the "Measured" block of each capabilities/*.md, for the probes its front matter lists
//   - llms-full.txt              llms.txt followed by every page, for a model to read in one fetch
//
// No dependencies: the schema is checked by the small validator below, which covers the keywords
// schema/run.v1.schema.json uses and refuses any it does not know.
//
// Usage: node tools/build.mjs           write the generated files
//        node tools/build.mjs --check   write nothing; exit 1 if a run is invalid or a file is stale (CI)

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const read = (p) => readFileSync(join(root, p), "utf8");
const list = (dir, ext) =>
  existsSync(join(root, dir))
    ? readdirSync(join(root, dir))
        .filter((f) => f.endsWith(ext))
        .sort()
    : [];
const problems = [];

// ── schema ──────────────────────────────────────────────────────────────────
const KNOWN = new Set(["$schema", "$id", "title", "description", "type", "const", "enum", "required", "properties", "additionalProperties", "propertyNames", "pattern", "items", "format"]);
const typeOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v);

function validate(schema, value, at, out) {
  for (const k of Object.keys(schema)) if (!KNOWN.has(k)) throw new Error(`validator: unsupported keyword ${k}`);
  if (schema.type) {
    const types = [].concat(schema.type);
    const t = typeOf(value);
    if (!types.includes(t) && !(t === "integer" && types.includes("number"))) return out.push(`${at}: expected ${types.join("|")}, got ${t}`);
  }
  if ("const" in schema && value !== schema.const) out.push(`${at}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) out.push(`${at}: ${JSON.stringify(value)} is not one of ${schema.enum.join(", ")}`);
  if (schema.pattern && typeof value === "string" && !new RegExp(schema.pattern).test(value)) out.push(`${at}: "${value}" does not match ${schema.pattern}`);
  if (schema.format === "date-time" && typeof value === "string" && Number.isNaN(Date.parse(value))) out.push(`${at}: not a date-time`);
  if (typeOf(value) === "object") {
    for (const r of schema.required ?? []) if (!(r in value)) out.push(`${at}: missing ${r}`);
    for (const [k, v] of Object.entries(value)) {
      if (schema.propertyNames?.pattern && !new RegExp(schema.propertyNames.pattern).test(k)) out.push(`${at}: key "${k}" does not match ${schema.propertyNames.pattern}`);
      const sub = schema.properties?.[k] ?? schema.additionalProperties;
      if (sub === false) out.push(`${at}: unexpected ${k}`);
      else if (sub && sub !== true) validate(sub, v, `${at}.${k}`, out);
    }
  }
  if (typeOf(value) === "array" && schema.items) value.forEach((v, i) => validate(schema.items, v, `${at}[${i}]`, out));
  return out;
}

const schema = JSON.parse(read("schema/run.v1.schema.json"));

// ── runs ────────────────────────────────────────────────────────────────────
const runs = [];
for (const file of list("runs", ".json")) {
  let run;
  try {
    run = JSON.parse(read(`runs/${file}`));
  } catch (e) {
    problems.push(`runs/${file}: not JSON (${e.message})`);
    continue;
  }
  const errs = validate(schema, run, file, []);
  if (run.key && `${run.key}.json` !== file) errs.push(`${file}: key is ${run.key}, so the file must be ${run.key}.json`);
  if (run.key && run.capturedAt && !run.key.startsWith(run.capturedAt.slice(0, 10))) errs.push(`${file}: key date differs from capturedAt`);
  if (run.key && run.host && !run.key.includes(`_codec${run.host.wireCodec}_`)) errs.push(`${file}: key codec differs from host.wireCodec`);
  const hostPkg = run.host?.sdk?.["@parity/product-sdk-host"];
  if (hostPkg && !run.key?.includes(`_host-${hostPkg}_`)) errs.push(`${file}: key host version differs from host.sdk["@parity/product-sdk-host"]`);
  problems.push(...errs);
  if (!errs.length) runs.push(run);
}
runs.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));

// ── probes: every id any run reports, with the newest title seen ─────────────
const probes = new Map();
for (const run of [...runs].reverse()) for (const [id, r] of Object.entries(run.results)) probes.set(id, r.title ?? probes.get(id) ?? id);
const ids = [...probes.keys()].sort();
const groupOf = (id) => id.split(".").slice(0, 2).join(".");

const cell = (r) => {
  if (!r) return "—";
  const text = `${r.status}${r.diagnosis ? ` · ${r.diagnosis}` : ""}`;
  return r.retracted ? `~~${text}~~ probe bug` : text;
};
const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
const runHead = (run) => `[${run.key}](runs/${run.key}.json)${run.complete ? "" : " (partial)"}`;

// ── capability pages ────────────────────────────────────────────────────────
const START = "<!-- measured:start — generated by tools/build.mjs from runs/; edits here are overwritten -->";
const END = "<!-- measured:end -->";
const claimed = new Set();
const pages = {};
for (const file of list("capabilities", ".md")) {
  const text = read(`capabilities/${file}`);
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
  const wanted = fm.match(/^probes:\s*\[(.*)\]\s*$/m)?.[1].split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  wanted.forEach((id) => claimed.add(id));
  if (!text.includes(START) || !text.includes(END)) {
    problems.push(`capabilities/${file}: missing the measured block markers`);
    continue;
  }
  const shown = runs.slice(0, 4);
  const table = wanted.length
    ? [
        `| Probe | ${shown.map(runHead).join(" | ")} |`,
        `|---|${shown.map(() => "---|").join("")}`,
        ...wanted.map((id) => `| \`${id}\` ${esc(probes.get(id) ?? "")} | ${shown.map((run) => esc(cell(run.results[id]))).join(" | ")} |`),
      ].join("\n")
    : "_No probe measures this yet._";
  const details = wanted
    .map((id) => {
      const r = shown.find((run) => run.results[id])?.results[id];
      if (!r) return null;
      return `- \`${id}\` — ${r.retracted ? `**Retracted, a probe bug:** ${r.retracted} The run said: ` : ""}${r.detail ?? ""}${r.evidence ? `\n\n  \`\`\`\n${r.evidence.replace(/^/gm, "  ")}\n  \`\`\`` : ""}`;
    })
    .filter(Boolean)
    .join("\n");
  const block = `${START}\n\n${table}\n\n${details ? `Latest detail per probe:\n\n${details}\n\n` : ""}${END}`;
  pages[`capabilities/${file}`] = text.replace(new RegExp(`${START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${END}`), block);
}
const unclaimed = ids.filter((id) => !claimed.has(id));
for (const id of [...claimed].filter((id) => !probes.has(id))) console.warn(`note: ${id} is listed by a capability page but no run reports it`);

// ── matrix.md ───────────────────────────────────────────────────────────────
const lines = [
  "# Matrix",
  "",
  "Every probe in every run, newest run first. Generated by `tools/build.mjs` from `runs/` — do not edit.",
  "`—` means the run has no result for that probe (not run, or lost from a partial copy), never a pass.",
  "A struck-out result with \"probe bug\" measured a defect in the probe, not the host; the run file says what was wrong.",
  "",
  "| Run | Captured | Surface | OS | Device | WebView | Wire codec | product-sdk-host | Complete |",
  "|---|---|---|---|---|---|---|---|---|",
  ...runs.map((r) =>
    `| [${r.key}](runs/${r.key}.json) | ${r.capturedAt} | ${r.runtime.surface} | ${esc(r.runtime.os)} | ${esc(r.runtime.device)} | ${esc(r.runtime.webview ?? "?")} | ${r.host.wireCodec} | ${r.host.sdk?.["@parity/product-sdk-host"] ?? "?"} | ${r.complete ? "yes" : "no"} |`,
  ),
  "",
];
for (const group of [...new Set(ids.map(groupOf))]) {
  lines.push(`## ${group}`, "", `| Probe | ${runs.map((r) => r.key).join(" | ")} |`, `|---|${runs.map(() => "---|").join("")}`);
  for (const id of ids.filter((i) => groupOf(i) === group)) {
    lines.push(`| \`${id}\` ${esc(probes.get(id))} | ${runs.map((r) => esc(cell(r.results[id]))).join(" | ")} |`);
  }
  lines.push("");
}
if (unclaimed.length) {
  lines.push("## Not yet on a capability page", "", ...unclaimed.map((id) => `- \`${id}\` ${probes.get(id)}`), "");
}
const generated = { "matrix.md": lines.join("\n"), ...pages };

// ── llms-full.txt ───────────────────────────────────────────────────────────
const sections = [["llms.txt", read("llms.txt")]];
for (const dir of ["capabilities", "pitfalls", "sources"]) {
  for (const f of list(dir, ".md")) sections.push([`${dir}/${f}`, generated[`${dir}/${f}`] ?? read(`${dir}/${f}`)]);
}
sections.push(["matrix.md", generated["matrix.md"]]);
generated["llms-full.txt"] = sections.map(([p, t]) => `<<< ${p} >>>\n\n${t.trim()}\n`).join("\n");

// ── write or compare ────────────────────────────────────────────────────────
for (const [p, text] of Object.entries(generated)) {
  const current = existsSync(join(root, p)) ? read(p) : null;
  if (current === text) continue;
  if (check) problems.push(`${p} is stale — run node tools/build.mjs`);
  else writeFileSync(join(root, p), text);
}

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join("\n"));
  process.exit(1);
}
console.log(`${runs.length} run(s), ${ids.length} probe(s), ${unclaimed.length} not on a capability page${check ? " — up to date" : ""}`);
