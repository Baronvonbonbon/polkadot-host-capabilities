# The devnet DotNS registrar moved

**Symptom:** a read-only ownership lookup says a name you just registered has no owner, or `pad`
and your own scripts disagree about a name.

**Cause:** on the Paseo Asset Hub EVM (`https://eth-rpc-testnet.polkadot.io/`, chain id 420420417),
the DotNS registrar was redeployed. Names registered after the move exist only in the new one.

| Contract | Address (as `pad` 0.16.6 has it, 2026-09-18) |
|---|---|
| Registrar (ERC-721; tokenId = namehash of `label.dot`) | `0xc609e0c2DAB4433d55a32FB098Db8788C1956302` |
| Personhood rules (`POP_RULES`) | `0xD5Ee34610F06f7FF4668aB4fabE2393B65a43AE7` |
| Registry | `0xb052E5EfC5ADEff1f21d48DEfb5169Cb394A1a73` |
| Content resolver | `0x7e75491ecfb04900EB05ee63CABA2B33900aABB5` |

**Do:** read contract addresses from the installed `pad` package rather than hard-coding them, or
re-check them whenever `pad` updates. sonde's and almanac's `tools/whois.mjs` show a read-only
lookup.
