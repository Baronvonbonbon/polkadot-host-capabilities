---
capability: Statement Store (small signed messages between phones)
probes: [host.statement.subscribe, host.statement.createProof, host.statement.submit, host.limits.statementSize, host.limits.statementLatency, host.limits.statementExpiry, host.limits.statementCapacity]
---

# Statement Store

**Status (2026-09-19, codec 1, Android): works, including delivery between two phones.** sonde
submitted a statement from inside the app in 8.1 s (2026-09-19, 10:53). It is
tiny: 512 bytes per statement and about 1 KiB per account. Use it to find each other or to hold a
pointer, not to carry data.

## What it is good for

- **A rendezvous point.** Two phones derive a topic from a secret they share, such as a code shown
  as a QR. One publishes and the other subscribes. almanac P9b/P9c, 2026-09-17: phone B found phone
  A's statement, carrying A's signer, on a phone that never held A's keys.
- **A slot you overwrite.** Publishing again on the same `channel` replaces the earlier statement,
  and a fresh subscription sees only the new one. That makes it a mutable pointer, or a revocable
  share.
- **Late joiners.** A subscription also delivers statements that already exist, so whoever opens
  second still finds the offer.

## Use it

```ts
import { createProofAuthorized, formatHostError, fromHex, getStatementStore, requestResourceAllocation, toHex } from "@parity/product-sdk-host";

const store = await getStatementStore();                         // null when unavailable
// Needed before the first submit (almanac P9). Asking again does no harm.
await requestResourceAllocation([{ tag: "StatementStoreAllowance" }]);

// Expiry is (unix seconds << 32) | sequence; a later expiry makes a statement newer.
const expiry = BigInt(Math.floor((Date.now() + 3_600_000) / 1000)) << 32n;
const statement = { topics: [toHex(topic)], channel: toHex(channel), expiry, data: toHex(sealed) };
const proof = await createProofAuthorized(statement);             // the host signs
if (!proof.ok) throw new Error(formatHostError(proof.error));
await store!.submit({ ...statement, proof: proof.value });

const sub = store!.subscribe({ matchAny: [toHex(topic)] }, (page) => {
  for (const s of page.statements) if (s.data) heard(fromHex(s.data));
});
sub.onInterrupt(() => { /* the host dropped it: subscribe again after a pause */ });
```

almanac's working version is `app/src/platform/polkadot.ts` (`statementPort`).

## Limits

| Limit | Value | Source |
|---|---|---|
| Bytes per statement | 512 | `product-sdk-statement-store` 0.6.9 constants |
| Bytes per account | ~1 KiB | same |
| Statements per account | 2 to 4 seen, **not settled** | almanac P9: three runs disagreed, and each allowance grant may add room |
| Longest expiry | 90 days accepted | almanac P9 |
| When full | `AccountFull(submittedExpiry, minExpiry)` refuses a statement that expires sooner than the shortest one held | almanac P9 |
| No expiry | **kept as the maximum (i64::MAX), and never leaves** | sonde, 2026-09-19. The SDK's 30 s default TTL does not apply to a statement submitted through the host without one |
| Latency between phones | **not measured** | — |

## Don't

- **Don't submit without an `expiry`.** The host keeps such a statement with the maximum expiry.
  Each one fills a slot that never frees. Once the account is full of them, **every statement
  with a finite expiry is refused**, because a full account refuses anything that would expire
  sooner than the shortest it holds:
  `AccountFull(submittedExpiry=…, minExpiry=9223372036854775807)`. sonde did exactly this, one
  statement per run on a fresh topic, until its account refused everything else (2026-09-19).
  Always set an expiry, and reuse a `channel` so a new statement replaces the old one.
- **It gets worse: the account can lock up completely.** On 2026-09-19 12:55, with the account
  full of no-expiry statements, even another no-expiry statement was refused:
  `AccountFull(submittedExpiry=MAX, minExpiry=MAX)`. An equal expiry is refused too, and statements
  without a channel can't be replaced. So nothing more can be published from that account, unless
  the store drops them on its own; that isn't observed yet. sonde's `sondeprobes.dot` is in this
  state.
- **Don't put plaintext in it.** Statements are public gossip, and anyone can compute a topic
  derived from a public id. Seal the data, and derive topics from a shared secret.
- **Don't assume the signer is the user.** Statements are signed by the product's allowance account,
  not by product account #0 (almanac P8). It is per product, not per user, so a user's statements
  can still be linked to each other within one product.
- **Don't stream through it.** For anything larger, open WebRTC and use statements only for the
  offer and answer. A minified, non-trickle SDP is about 150–250 bytes, which fits in one statement
  ([sources/fare.md](../sources/fare.md)). WebRTC between two phones inside the app is **not
  measured yet** (almanac P13).

## Measured

<!-- measured:start — generated by tools/build.mjs from runs/; edits here are overwritten -->

| Probe | [2026-09-19_codec1_host-0.19.1_android-16_1131](runs/2026-09-19_codec1_host-0.19.1_android-16_1131.json) | [2026-09-19_codec1_host-0.19.1_android-16_1053](runs/2026-09-19_codec1_host-0.19.1_android-16_1053.json) | [2026-09-19_codec1_host-0.19.1_android-16_1038](runs/2026-09-19_codec1_host-0.19.1_android-16_1038.json) (partial) | [2026-09-19_codec1_host-0.19.1_android-16_1005](runs/2026-09-19_codec1_host-0.19.1_android-16_1005.json) |
|---|---|---|---|---|
| `host.statement.subscribe` Statement Store — subscribe (read-only) | pass | pass | pass | pass |
| `host.statement.createProof` Statement Store — createProofAuthorized | pass | pass | pass | pass |
| `host.statement.submit` Statement Store — submit | pass | pass | ~~skip · spend-refused-by-allowlist~~ probe bug | ~~skip · spend-refused-by-allowlist~~ probe bug |
| `host.limits.statementSize` Statement Store — exact size limit | ~~fail · wrong-result~~ probe bug | — | — | — |
| `host.limits.statementLatency` Statement Store — time from submit to delivery | ~~fail · wrong-result~~ probe bug | — | — | — |
| `host.limits.statementExpiry` Statement Store — longest expiry | skip | — | — | — |
| `host.limits.statementCapacity` Statement Store — how many one account holds | skip | — | — | — |

Latest detail per probe:

- `host.statement.subscribe` — 1 page(s) delivered.
- `host.statement.createProof` — Host produced an authorized proof.
- `host.statement.submit` — Statement submitted.
- `host.limits.statementSize` — **Retracted, a probe bug:** Not a size limit: the account was full of statements with no expiry, which sonde's own host.statement.submit had been adding every run, so any statement with a finite expiry was refused AccountFull(minExpiry=i64::MAX). The refusal itself is a real platform behaviour (see the Statement Store page). Fixed in sonde (a4683ff). The run said: Even 256 bytes was refused. — measures: `largestOkBytes=0` `beyond=256 B: refused — statement submit failed: Error: Fatal statement store submission error: Rejected(AccountFull(submittedExpiry=7687222428765782016, minExpiry=9223372036854775807)`

  ```
  256 B                 : refused — statement submit failed: Error: Fatal statement store submission error: Rejected(AccountFull(submittedExpiry=7687222428765782016, minExpiry=9223372036854775807)
  ```
- `host.limits.statementLatency` — **Retracted, a probe bug:** Not measured: refused for the same reason as host.limits.statementSize — the account was full of sonde's own no-expiry statements. Fixed in sonde (a4683ff). The run said: Submit refused — statement submit failed: Error: Fatal statement store submission error: Rejected(AccountFull(submittedExpiry=7687222454535585792, minExpiry=9223372036854775807).
- `host.limits.statementExpiry` — Opt-in (spends-quota) — not selected for this run. Run it from its card, or tick the opt-in box.
- `host.limits.statementCapacity` — Opt-in (spends-quota) — not selected for this run. Run it from its card, or tick the opt-in box.

<!-- measured:end -->
