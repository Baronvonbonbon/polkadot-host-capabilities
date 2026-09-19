---
capability: Bulletin storage (uploads and reads through the host)
probes: [host.cloud.allowance, host.preimage.submit, host.cloud.upload, host.cloud.roundTrip, host.cloud.read, host.preimage.lookup, host.cloud.seal, host.limits.retention, host.limits.preimageSize, host.limits.bulletinQuota]
---

# Bulletin storage

**Status (2026-09-19, codec 1, Android): works through the host's preimage manager. It does not work
through the SDK's `cloudStorage.upload`.** Data is public by content hash and lasts about two
weeks.

## Use it

1. Request a `BulletinAllowance`. Spell it exactly that way, even though the type says otherwise.
2. Request the `PreimageSubmit` permission.
3. Upload with `getPreimageManager().submit(bytes)`. It returns a BLAKE2b-256 key.
4. Read with `lookup(key, callback)`.

```ts
import { formatHostError, getPreimageManager, requestPermission, requestResourceAllocation } from "@parity/product-sdk-host";

// The TypeScript type spells it "BulletInAllowance", and that spelling throws. Only this one allocates.
await requestResourceAllocation([{ tag: "BulletinAllowance", value: undefined } as never]);
const p = await requestPermission({ tag: "PreimageSubmit", value: undefined });
if (!p.ok || !p.value) throw new Error(p.ok ? "user said no" : formatHostError(p.error));
const manager = await getPreimageManager();            // null when the host offers no storage
const key = await manager!.submit(bytes);              // hex BLAKE2b-256; give it a deadline (1 MiB took 41 s)

// A lookup is a subscription that stays SILENT until the bytes arrive. There is no "not found".
function get(key: `0x${string}`, ms = 30_000): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const sub = manager!.lookup(key, (b) => { if (b) { clearTimeout(t); sub.unsubscribe(); resolve(b); } });
    const t = setTimeout(() => { sub.unsubscribe(); resolve(null); }, ms);
  });
}
```

## Who pays, and how much fits

- **The payer is a slot account the host keeps the key for.** No Product API names it. The
  allowance reaches it by XCM from the People chain. Each claim is **10 transactions and 4 MiB**,
  and it expires about 14 days (201,600 blocks) after it lands. The account holds no balance, so
  this is quota, never a fee. (almanac P6b)
- **One upload is one transaction, charged at exactly its own size.** 16 KiB took 6.7 s, 64 KiB
  10.0 s, 256 KiB 16.8 s and **1 MiB 41.4 s** on a Pixel 10 Pro XL. Each came back byte for byte.
  (almanac P6c)
- **Allowances and slot accounts are per product id**, meaning the `.dot` label. Two names give two
  separate quotas.

## Don't

- **Don't use `app.cloudStorage.upload`.** It signs with product account #0, which holds no Bulletin
  authorization, so every upload is refused with `Invalid: Payment`, even right after `Allocated`.
  (almanac P6, read on chain with a positive control.) sonde saw the same on 2026-09-19 at 10:53:
  a 26-byte canary failed with `ProductCloudStorageError` in 3.7 s, straight after `Allocated`.
- **Don't expect SHA-256 CIDs to come back through the host.** The host's lookup takes a bare
  32-byte digest and finds BLAKE2b-256 content only. A `bafkrei…` or `bafybei…` CID, like the ones
  `pad` makes for a site bundle, waits out the SDK's 30 s timeout instead of failing. The devnet
  IPFS gateway serves both kinds. (almanac P7)
- **Don't treat a lookup that never calls back as proof of anything.** The read-only lookup probe
  (almanac's fixture key) got no callback in 5 s at 10:38, 10:53 and 11:31, then answered at
  14:06, on the same phone. Give lookups a generous timeout and retry.
- **Don't treat silence as "not found".** A lookup of absent content never calls back. Always race
  it against a timer.
- **Don't store anything readable.** Anyone can fetch it by hash. Encrypt first; WebCrypto
  AES-GCM works (`host.cloud.seal`). Treat ciphertext as possibly permanent and plaintext
  retention as possibly shorter than you hoped.

## Measured by sonde

`getPreimageManager().submit()` stored 64 random bytes in **29.8 s** and read them back by key in
154 ms, byte for byte (2026-09-19 12:55). almanac's 256-byte upload took 4.1–8.8 s, so upload time
varies a lot. Show progress, and give uploads a generous deadline.

## Reading through the SDK works for BLAKE2b content

On 2026-09-19 at 10:05, `app.cloudStorage.fetch()` of a 79-byte BLAKE2b-256 blob, stored five days
earlier, came back in **245 ms**, and its CID verified. The same call on a SHA-256 CID times out
after 30 s.

## Retention

Measured about two weeks, while the docs say content persists. almanac follows two fixture CIDs
from a desktop (`npm run retention` in almanac). The first 15-day checks fall on 2026-09-28 and
2026-09-29. In the app, sonde's `host.limits.retention` looks up its own earlier uploads at the
start of each run: at 14:06 it found 2 of 2, the oldest 0.03 days old. That only shows the lookup
path works, not how long content lasts; the ages grow as runs continue. Plan for expiry: FARE uses the ~14-day life as a dispute-evidence window
([sources/fare.md](../sources/fare.md)).

## Measured

<!-- measured:start — generated by tools/build.mjs from runs/; edits here are overwritten -->

| Probe | [2026-09-19_codec1_host-0.19.1_android-16_1406](runs/2026-09-19_codec1_host-0.19.1_android-16_1406.json) | [2026-09-19_codec1_host-0.19.1_android-16_1131](runs/2026-09-19_codec1_host-0.19.1_android-16_1131.json) | [2026-09-19_codec1_host-0.19.1_android-16_1053](runs/2026-09-19_codec1_host-0.19.1_android-16_1053.json) | [2026-09-19_codec1_host-0.19.1_android-16_1038](runs/2026-09-19_codec1_host-0.19.1_android-16_1038.json) (partial) |
|---|---|---|---|---|
| `host.cloud.allowance` Request a Bulletin allowance | timeout · never-settled | pass | pass | pass |
| `host.preimage.submit` Preimage submit — upload through the host, then read it back | ~~skip · spend-refused-by-allowlist~~ probe bug | ~~skip~~ probe bug | — | — |
| `host.cloud.upload` Cloud storage upload (canary, then payload) | ~~skip · spend-refused-by-allowlist~~ probe bug | fail · allowance-missing | fail · allowance-missing | ~~skip · spend-refused-by-allowlist~~ probe bug |
| `host.cloud.roundTrip` Fetch → CID verify → decrypt | skip | skip | skip | ~~skip~~ probe bug |
| `host.cloud.read` Cloud storage read (no signature needed) | pass | pass | pass | pass |
| `host.preimage.lookup` Preimage lookup (read-only) | pass | fail · wrong-result | fail · wrong-result | fail · wrong-result |
| `host.cloud.seal` Seal under a crypto-shred key (WebCrypto) | pass | pass | pass | pass |
| `host.limits.retention` Bulletin retention — can earlier uploads still be read? | pass (tracked 2, found 2, oldestFoundDays 0.03) | skip | — | — |
| `host.limits.preimageSize` Largest single Bulletin upload (2, 3, 4 MiB) | skip | skip | — | — |
| `host.limits.bulletinQuota` Bulletin quota — what happens when it runs out | skip | skip | — | — |

Latest detail per probe:

- `host.cloud.allowance` — Never settled after 150s. A call that neither resolves nor rejects is worse than one that fails.
- `host.preimage.submit` — **Retracted, a probe bug:** Not measured: sonde's spend gate needs an identified chain, and getChainSpec answered for no chain this run. Fixed in sonde (89bab46): it falls back to isChainSupported. The run said: No genesis hash resolved yet — run host.chain.genesis first. Spending on an unidentified chain is refused.
- `host.cloud.upload` — **Retracted, a probe bug:** Not measured: sonde's spend gate needs an identified chain, and getChainSpec answered for no chain this run. Fixed in sonde (89bab46): it falls back to isChainSupported. The run said: No genesis hash resolved yet — run host.chain.genesis first. Spending on an unidentified chain is refused.
- `host.cloud.roundTrip` — Needs "host.cloud.upload", which came back skip. Running anyway would test a placeholder.
- `host.cloud.read` — Fetched 0.1 KiB in 52 ms and the CID verifies. Reads work.
- `host.preimage.lookup` — Lookup answered.
- `host.cloud.seal` — Sealed a placeholder in 3 ms (run the camera probe first for a real payload).
- `host.limits.retention` — 2 of 2 earlier uploads still readable; oldest found 0.0 days. — measures: `tracked=2` `found=2` `oldestFoundDays=0.03` `youngestMissingDays=-1`
- `host.limits.preimageSize` — Opt-in (spends-quota) — not selected for this run. Run it from its card, or tick the opt-in box.
- `host.limits.bulletinQuota` — Opt-in (spends-quota) — not selected for this run. Run it from its card, or tick the opt-in box.

<!-- measured:end -->
