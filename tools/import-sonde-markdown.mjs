#!/usr/bin/env node
// Turn a sonde markdown report (the "Copy markdown" button) into a run record.
//
// Prefer sonde's "Copy record" button: it emits the record directly and carries the exact SDK
// versions. This importer exists for reports copied before that button, and for partial copies —
// a phone clipboard can cut a long report off, so a missing probe is recorded as absent, never as
// passing, and the run is marked incomplete when the Everything section has fewer rows than the
// totals line counts.
//
// The markdown names probes by title, not id; tools/sonde-titles.json maps them back.
//
// What the markdown does not carry goes in raw/<key>.meta.json, next to the report:
//   { "productId": "...", "sdk": { "<package>": "<exact version>" }, "notes": ["..."],
//     "retracted": { "<probe id>": "why this result measured the probe, not the host" } }
//
// Usage: node tools/import-sonde-markdown.mjs raw/<key>.sonde.md
//        writes runs/<key>.json, where <key> is the raw file's name without .sonde.md

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = process.argv[2];
if (!src?.endsWith(".sonde.md")) {
  console.error("usage: node tools/import-sonde-markdown.mjs raw/<key>.sonde.md");
  process.exit(1);
}

const key = basename(src).replace(/\.sonde\.md$/, "");
const md = readFileSync(src, "utf8");
const metaPath = src.replace(/\.sonde\.md$/, ".meta.json");
const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, "utf8")) : {};
const titles = JSON.parse(readFileSync(join(root, "tools", "sonde-titles.json"), "utf8"));

// ── the header table ──────────────────────────────────────────────────────
const header = {};
for (const m of md.matchAll(/^\| ([^|]+?) \| (.+?) \|$/gm)) header[m[1].trim()] = m[2].trim();
const unticked = (s) => s?.replace(/^`|`$/g, "");

const ua = unticked(header["User agent"]) ?? "";
const [device, os] = (header.Device ?? "").split(" · ");
const suite = header.Suite?.match(/^(\S+) \(build (.+)\)$/);
const codec = Number(header.truapi?.match(/codec (\d+)/)?.[1]);

// ── totals, as sonde counted them ─────────────────────────────────────────
const totalsBlock = md.match(/## Totals\s+\|(.+)\|\s+\|[-|]+\|\s+\|(.+)\|/);
const totals = {};
if (totalsBlock) {
  const names = totalsBlock[1].split("|").map((s) => s.trim());
  const counts = totalsBlock[2].split("|").map((s) => Number(s.trim()));
  names.forEach((n, i) => (totals[n] = counts[i]));
}

// ── evidence blocks from "Needs attention", keyed by id ───────────────────
const evidence = {};
const attention = md.split(/^## /m).find((s) => s.startsWith("Needs attention")) ?? "";
for (const part of attention.split(/^### /m).slice(1)) {
  const id = part.match(/^`([^`]+)`/)?.[1];
  const blocks = [...part.matchAll(/```\n([\s\S]*?)\n```/g)].map((m) => m[1]);
  if (id && blocks.length) evidence[id] = blocks.join("\n\n");
}

// ── every result row ──────────────────────────────────────────────────────
const results = {};
const unknownTitles = [];
const everything = md.split(/^## Everything/m)[1] ?? "";
const row = /^- `\[.\]` \*\*(.+?)\*\* — (\w+)(?: \((\d+) ms\))?(?: · `([^`]+)`)?\n {2}(.+)$/gm;
for (const m of everything.matchAll(row)) {
  const [, title, status, ms, diagnosis, detail] = m;
  const id = titles[title];
  if (!id) {
    unknownTitles.push(title);
    continue;
  }
  results[id] = {
    title,
    status,
    diagnosis: diagnosis ?? null,
    ms: ms === undefined ? null : Number(ms),
    detail,
    ...(evidence[id] ? { evidence: evidence[id] } : {}),
  };
}
// A result that only survived in "Needs attention" (the copy was cut off before its row).
for (const part of attention.split(/^### /m).slice(1)) {
  const m = part.match(/^`([^`]+)` — (\w+)(?: \(`([^`]+)`\))?\n\n\*\*.+?\*\* — (.+)$/m);
  if (m && !results[m[1]]) {
    const title = part.match(/^\*\*(.+?)\*\* — /m)?.[1];
    results[m[1]] = { ...(title ? { title } : {}), status: m[2], diagnosis: m[3] ?? null, ms: null, detail: m[4], ...(evidence[m[1]] ? { evidence: evidence[m[1]] } : {}) };
  }
}
if (unknownTitles.length) {
  console.error(`No id for these titles — add them to tools/sonde-titles.json:\n  ${unknownTitles.join("\n  ")}`);
  process.exit(1);
}

for (const [id, why] of Object.entries(meta.retracted ?? {})) {
  if (!results[id]) {
    console.error(`${metaPath}: retracts ${id}, which this report does not have`);
    process.exit(1);
  }
  results[id].retracted = why;
}

const counted = Object.values(totals).reduce((a, b) => a + b, 0);
const found = Object.keys(results).length;
const notes = [...(meta.notes ?? [])];
if (found < counted) notes.unshift(`The report counted ${counted} probes; ${found} survived the copy. The rest are absent here, not passing.`);

const record = {
  schema: "polkadot-host-capabilities/run@1",
  key,
  capturedAt: header.When,
  complete: found >= counted,
  ...(notes.length ? { notes } : {}),
  tool: {
    name: "sonde",
    version: suite?.[1] ?? "unknown",
    ...(suite ? { build: suite[2] } : {}),
    ...(header.Source ? { source: header.Source } : {}),
    ...(header.Run ? { runId: unticked(header.Run) } : {}),
    ...(meta.productId ? { productId: meta.productId } : {}),
  },
  runtime: {
    surface: header.Surface,
    os: os ?? "unknown",
    device: device ?? "unknown",
    webview: ua.match(/Chrome\/([\d.]+)/)?.[1] ? `Chromium ${ua.match(/Chrome\/([\d.]+)/)[1]}` : null,
    appVersion: null,
  },
  host: {
    wireCodec: codec,
    truapi: Number(header.truapi?.match(/^(\d+)/)?.[1]) || null,
    ...(meta.sdk ? { sdk: meta.sdk } : {}),
  },
  results,
  totals,
};

const out = join(root, "runs", `${key}.json`);
writeFileSync(out, `${JSON.stringify(record, null, 2)}\n`);
console.log(`${out}: ${found} results${record.complete ? "" : ` (incomplete — ${counted} counted)`}`);
