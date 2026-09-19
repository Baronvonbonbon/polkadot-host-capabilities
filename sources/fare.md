# FARE: designs that work around the gaps

[FARE](https://github.com/Baronvonbonbon/fare) is a delivery and ride Product. Its contracts are on
Paseo Asset Hub, and its driver and customer surfaces run inside the Polkadot app. Three of its
designs answer gaps measured here. The detail is in FARE's `docs/POLKADOT-PLATFORM-PLAN.md`
(§4.7, §4.10–§4.12).

## Settling without GPS (built)

Location is unavailable ([capabilities/location.md](../capabilities/location.md)). FARE's guarantee
was never the geometry; it is **two parties with opposite interests signing the same thing**:

- **Pickup:** the driver signs the venue's published pin.
- **Dropoff:** the customer builds the driver's commitment from the drop position and a fresh salt,
  and shows it as a QR code (`makeDropoffRequest`). The driver scans it and signs it blind
  (`signDropoffRequest`).

The Groth16 proximity circuit is unchanged, and a test runs it against a real proof
(`test/gps-free-settlement.test.ts`). Code: `web/src/handoff.ts`, `web/src/geo.ts`,
`web/src/host.ts`.

## Signalling over the Statement Store, data over WebRTC (designed)

A statement holds 512 bytes, and an account about 1 KiB. So the Statement Store carries only the
connection setup, and WebRTC carries the payload:

- **Non-trickle, minified SDP.** Wait for ICE gathering to finish, then send only ufrag, password,
  DTLS fingerprint and a few candidates: about 150–250 bytes. Rebuild the full SDP from a template
  at the other end.
- **One statement per side per order, replaced in place:** the offer, then the answer.
- **Sealed, on a topic derived from a secret the parties share.** Candidates carry IP addresses, and
  statements are public.

Risks, in order: carrier-grade NAT on cellular (plan a TURN relay), linkage through the product's
allowance account, and both parties having to be online.

## Bulletin as dispute evidence (designed)

Delivery photos go to Bulletin through the host, and live about 14 days. That lifetime is the
evidence window, if:

1. The photo's BLAKE2b-256 key is **committed in something signed at the event**, not cited later.
2. The dispute clock fits inside the storage clock: for example, open within 72 h and rule within
   10 days. Re-uploading the same bytes renews them under the same key.
3. Only the arbiter can read it: sealed, with the key encrypted to the arbiter at filing.
4. The arbiter can fetch outside the app, through the devnet IPFS gateway.

Limit: Bulletin is on the devnet, which resets, while the contracts are on Paseo. Fine for a demo,
not for production.
