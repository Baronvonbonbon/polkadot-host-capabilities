# Host calls can hang instead of failing

Many host calls, when they can't do what was asked, **never settle**: no value, no error. A Product
that awaits one without a deadline freezes, and never reaches its fallback.

| Call | When it goes silent | Seen |
|---|---|---|
| Every host call | the SDK speaks a wire codec the app doesn't ([wire-codec.md](wire-codec.md)) | sonde 2026-09-18 |
| `isInsideContainer()` | outside the app: nobody is there to answer | by design |
| `preimageManager.lookup(key, cb)` | the content is absent, or was stored under SHA-256: there is no "not found" | almanac P7, sonde |
| `cloudStorage.fetch(cid)` | the same, until the SDK's own 30 s timeout | almanac P7, sonde |
| `getChainSpec(genesis)` | a genesis the host doesn't carry: the run waited 45 s | sonde 2026-09-19 |
| `paymentManager.subscribeBalance(cb)` | always, so far | sonde 2026-09-19 |
| `cloudStorage.upload` | S1: hung 180 s with no error | FARE |
| `wallet.signMessage` | until the user answers the prompt | by design |

## Do

```ts
export function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([
    p,
    new Promise<never>((_, reject) => { t = setTimeout(() => reject(new Error(`${what}: no answer in ${ms / 1000} s`)), ms); }),
  ]).finally(() => clearTimeout(t));
}
```

Suggested deadlines, from measurements:

| Kind of call | Deadline |
|---|---|
| Detection | 1.5 s |
| A prompt the user must read and tap | 60 s |
| A Bulletin upload | 120–180 s (1 MiB took 41 s) |
| A lookup the host holds | 30 s (a hit comes back in under 1 s) |

For subscriptions, resolve on the first useful callback, unsubscribe when the timer fires, and
treat silence as "unknown", never as "absent".
