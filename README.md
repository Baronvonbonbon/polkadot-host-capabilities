# Polkadot host capabilities

What a **Product**, a web app running inside the Polkadot app, can and cannot do, **measured from
inside the app** on real phones, with the code that works.

It is written for people building Products and for LLMs helping them. A model can fetch
[`llms.txt`](llms.txt) for the index, or [`llms-full.txt`](llms-full.txt) for everything in one
file.

## Why it's keyed the way it is

No host API reports the Polkadot app's version. What decides whether a Product works is:

- the **TrUAPI wire codec** the app answers (a mismatch makes every host call hang)
- the **SDK** the Product was built with
- the **OS**

So every run is keyed by those, plus the date:

```
2026-09-19_codec1_host-0.19.1_android-16
 date      codec  product-sdk-host  os-major
```

If someone read the app version off the phone, it goes in `runtime.appVersion`.

## Layout

| Path | What |
|---|---|
| [`capabilities/`](capabilities/) | One page per capability: status, working code, what not to do, and a **Measured** table generated from the runs |
| [`pitfalls/`](pitfalls/) | Tooling traps: the codec pin, hanging calls, SDK quirks, deploying, DotNS |
| [`matrix.md`](matrix.md) | Every probe in every run (generated) |
| [`runs/`](runs/) | One JSON record per run, in the format of [`schema/run.v1.schema.json`](schema/run.v1.schema.json) |
| [`raw/`](raw/) | Reports as copied from the phone, kept as the source of any run converted from them |
| [`sources/`](sources/) | Where findings came from: sonde, almanac's probe, FARE's designs |
| [`tools/`](tools/) | `build.mjs` (validate and generate), `import-sonde-markdown.mjs` |

## Adding a run

Measure from inside the app with [sonde](https://github.com/Baronvonbonbon/sonde) at
`sondeprobes.dot`: run it, tap **Copy record**, and save the result as `runs/<key>.json`. Then:

```sh
node tools/build.mjs          # validates every run and regenerates matrix.md, the Measured tables and llms-full.txt
```

and open a pull request. CI runs `node tools/build.mjs --check`, which fails on an invalid run or a
stale generated file. The tools need Node 18+ and nothing else.

A run from another tool is welcome if it matches the schema. Use probe ids of the form
`host.<area>.<name>` or `web.<area>.<name>`, and set `tool` to say what measured it.

## Growing it

The repository is meant to grow as the app does:

- **A new probe** needs no change here. Its id shows up in the matrix, under "Not yet on a
  capability page", until a page claims it.
- **A new capability** is a new `capabilities/<name>.md` with `probes: [...]` in its front matter
  and the `measured` markers. `build.mjs` fills in the table.
- **A limit worth tracking** (bytes accepted, seconds taken) goes in a result's `measures` object.
- **A result that measured the probe, not the host,** is kept and marked `retracted`, with the
  reason. The matrix strikes it out.

Everything is dated. When a newer run contradicts a page, update the page and say what changed and
when; don't just delete the old claim.

## License

MIT, see [LICENSE](LICENSE). Findings are offered as measured, with no guarantee they still hold on
a newer app.
