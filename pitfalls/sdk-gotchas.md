# SDK gotchas

Small things in `@parity/product-sdk*` that cost an afternoon each.

- **Two `Result` conventions.** The top-level wrappers in `@parity/product-sdk-host`
  (`requestDevicePermission`, `requestPermission`, `deriveEntropy`, `getChainSpec`, `navigateTo`,
  `requestResourceAllocation`, `createProofAuthorized`…) return `@parity/result`'s
  `{ ok, value } | { ok, error }`. The raw truapi client and `AccountsProvider` return neverthrow's
  `ResultAsync`, which has `.match()` and **no `.ok`**. Reading `.ok` off the second yields
  `undefined`, so every call looks like a failure.
- **`BulletinAllowance`, not `BulletInAllowance`.** The TypeScript type spells it with a capital I,
  and that spelling throws. Cast: `{ tag: "BulletinAllowance", value: undefined } as never`.
- **`Allocated` doesn't mean an upload will work.** Through `cloudStorage.upload` it never does
  (`Invalid: Payment`). Use `getPreimageManager().submit()`
  ([capabilities/bulletin-storage.md](../capabilities/bulletin-storage.md)).
- **`createApp`'s cloud storage defaults to `"paseo"`.** Pass `cloudStorage: { environment: "devnet" }`
  when you publish to devnet, or `createApp` throws that the chain isn't supported.
- **Connected isn't selected.** After `wallet.connect()`, call `wallet.selectAccount(address)`, or
  storage calls stall.
- **Statement expiry is `(unix seconds << 32) | sequence`**, as a bigint. **Leaving it out does
  not mean "short-lived".** The host keeps the statement with the maximum expiry, forever, and a
  handful of those will block every later statement that has a real expiry
  (`AccountFull(…, minExpiry=9223372036854775807)`). See
  [statement-store](../capabilities/statement-store.md).
- **The host's lookup takes a bare 32-byte digest**, not a CID. `cidToPreimageKey` accepts SHA-256
  CIDs, but only BLAKE2b-256 content is found.
- **`getAnonymousAlias()` returns `null`.** Don't design on the Ring VRF alias yet.
