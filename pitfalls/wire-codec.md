# The TrUAPI wire codec must match the app

**Symptom:** inside the app, **every** host call hangs, or fails at the handshake with "the host did
not answer on wire codec 2". Container detection still says you're inside the app, and nothing else
works.

**Cause:** `@parity/truapi` changed its wire codec from 1 to 2 in 0.16.0. A Product built on codec 2
talks past an app that only answers codec 1. The app doesn't reject the message; it just never
answers.

**As of 2026-09-19 the Polkadot app on Android answers codec 1 only.** The last SDK set on codec 1:

```json
{
  "@parity/product-sdk": "0.27.0",
  "@parity/product-sdk-host": "0.19.1",
  "@parity/product-sdk-keys": "0.3.24",
  "@parity/product-sdk-statement-store": "0.6.9",
  "@parity/product-sdk-terminal": "0.8.2",
  "@parity/truapi": "0.13.1"
}
```

`product-sdk-host` 0.20 and later depend on truapi ≥ 0.16, which is codec 2.

## Do

- **Pin exact versions** (no `^`). A routine `npm update` moves you onto codec 2.
- **Check what you shipped:** `import { TRUAPI_CODEC_VERSION } from "@parity/truapi"`, and show it
  in a debug footer.
- **Give the handshake and the first host call a deadline**, so a mismatch reads as "host didn't
  answer" and not as a spinner that never stops.
- **When a new app ships,** run a probe built on the newer SDK (sonde records the codec in every
  run). The first run where a codec 2 handshake passes is when to move.

Measured by sonde on 2026-09-18: a codec 2 build failed every handshake. Pinned back to codec 1 on
2026-09-19, the handshake passed in 36 ms.
