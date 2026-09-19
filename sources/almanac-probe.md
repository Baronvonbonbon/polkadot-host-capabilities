# almanac's device probe (P1–P14)

[almanac](https://github.com/Baronvonbonbon/almanac) is a private cycle tracker built as a Product.
Before building on the platform, it measured it: a probe app published as `almanacprobe.dot`, and
checks named P1–P14. The full answers are in
[docs/PROBE-REPORT.md](https://github.com/Baronvonbonbon/almanac/blob/main/docs/PROBE-REPORT.md).
Device: Pixel 10 Pro XL, Android 16, Polkadot app 1.0.0 (40), 2026-09-13 to 17, on
`product-sdk` 0.27.0 and `product-sdk-host` 0.19.1 (codec 1).

| Check | Answer | Used on |
|---|---|---|
| P1 host storage | survives restarts and new builds; 4 MiB in one record, 1.2–1.3 s. App update and reinstall not tested | [local-storage](../capabilities/local-storage.md) |
| P2 `deriveEntropy` | same bytes across restarts and builds. Reinstall and a second phone not tested | [identity-and-accounts](../capabilities/identity-and-accounts.md) |
| P3 scheduled notification | fires with the app closed | [notifications](../capabilities/notifications.md) |
| P4 exports | nothing leaves as a file; clipboard write and picked-file read work | [files-and-sharing](../capabilities/files-and-sharing.md) |
| P5 phone backups | not run | — |
| P6 `cloudStorage.upload` | always `Invalid: Payment`; the product account holds no authorization | [bulletin-storage](../capabilities/bulletin-storage.md) |
| P6b preimage submit | works; paid from a hidden slot account's quota (10 transactions and 4 MiB a claim, ~14 days) | [bulletin-storage](../capabilities/bulletin-storage.md) |
| P6c upload sizes | 16 KiB 6.7 s, 64 KiB 10.0 s, 256 KiB 16.8 s, 1 MiB 41.4 s; charged exactly by size | [bulletin-storage](../capabilities/bulletin-storage.md) |
| P7 reads and retention | the host finds BLAKE2b-256 only; the gateway finds both; retention being measured (~2 weeks) | [bulletin-storage](../capabilities/bulletin-storage.md) |
| P8 which account signs | uploads: product account #0; statements: another account, not #0–#2 | [identity-and-accounts](../capabilities/identity-and-accounts.md) |
| P9 Statement Store | replace-in-place works; subscriptions deliver existing statements; 90-day expiry accepted; capacity per account not settled | [statement-store](../capabilities/statement-store.md) |
| P9b/P9c between phones | delivery works, found by topic | [statement-store](../capabilities/statement-store.md) |
| P10 network | gateway and RPC nodes reachable; nothing blocked | [network](../capabilities/network.md) |
| P11 crypto speed | scrypt N=2¹⁶ 169 ms; XChaCha 1 MiB 24 ms; BLAKE2b 1 MiB 18 ms | [compute-and-crypto](../capabilities/compute-and-crypto.md) |
| P12 theme and camera | the host theme, not the phone's; camera and `BarcodeDetector` work | [app-and-system](../capabilities/app-and-system.md), [media-and-calls](../capabilities/media-and-calls.md) |
| P13 WebRTC between phones | not run | [media-and-calls](../capabilities/media-and-calls.md) |
| P14 QR codes on iOS | not run | — |

None of this is in `runs/` yet. almanac's report predates the run schema and uses its own check ids.
