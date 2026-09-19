# sonde: measuring from inside the app

[sonde](https://github.com/Baronvonbonbon/sonde) is a Product that probes the platform from inside
the Polkadot app. It is published at `sondeprobes.dot`. It runs about 130 probes over the host API
and the web platform. Every probe is bounded by a deadline, so a hang reads as `timeout` instead of
a frozen page. It separates **absent** (`unsupported`), **forbidden** (`blocked`) and **broken**
(`fail`), and records a diagnosis such as `host-callback-missing` or `policy-blocked-by-embedder`.

## Tiers

- **T0 detect** and **T1 invoke** have no side effects.
- **T2 prompt** shows host prompts; tap through them.
- **T3 spend** writes to chain: a Bulletin upload and a statement. It runs only on chains in sonde's
  spend allowlist, which holds the devnet "Next" chains and refuses mainnet by name.

## Adding a run to this repository

1. Open `sondeprobes.dot` in the Polkadot app, run the tiers you're comfortable with, and tap
   **Copy record**. The record has addresses, keys and picked file names removed. It leaves out
   language, time zone and screen size.
2. Save it as `runs/<key>.json`. The key is in the record: date, wire codec, `product-sdk-host`
   version, OS and the time of capture.
3. If you skipped a probe by hand, or read the app version off the phone, add a line to `notes` or
   set `runtime.appVersion`.
4. Run `node tools/build.mjs` and open a pull request.

Reports copied before the Copy record button existed can be converted with
`tools/import-sonde-markdown.mjs` (see `raw/`).

## When a result is the probe's fault

A result that measured a bug in the probe is kept, with a `retracted` note saying what was wrong.
The matrix strikes it out. Three from 2026-09-19 were retracted:

- a made-up genesis hash, so `getChainSpec` waited forever
- a SHA-256 CID that the host's lookup can never find
- `navigateTo` pointed at the page's own URL, which reloads it

All three are fixed in sonde. The 10:05 run confirmed the fixes: the genesis resolved, the read
passed in 245 ms, and `navigateTo` returned without a reload. That run showed a fourth problem of
the same kind: sonde's spend allowlist didn't hold the one chain the host resolved (Paseo Asset
Hub), so the upload and statement-submit probes were refused again. Those are retracted too, and the
allowlist is fixed. Read a probe's source before filing a platform bug on its result.
