# Publish with a local deploy key, not the phone

**Symptom:** `pad deploy` gets as far as "Link content" and reverts with
`Revive.ContractReverted`. Or `pad` refuses because the name "is already owned by 0x…", and that
address is one you don't recognise. `pad whoami` shows "Product address: unresolved".

**Cause:** when `pad` signs through the phone, the signer is a **product account the wallet
derives and never reveals.** The app answers signing requests but never answers `pad`'s request
for that account's key, so `pad` *displays* the root account instead. Then:

- A name registered in August is owned by the account the wallet signed as then. That account came
  from the old public derivation (`product-sdk-keys` 0.3).
- A name registered in September was handed to the root `pad` displayed.
- The September app signs as a **third** account. It derives from a key the wallet holds
  (`product-sdk-keys` 0.4), so it **can't be computed** off the phone. It was found by reading the
  signer out of the raw extrinsic on chain.

So neither name can be updated from the phone.

## Do

Hold a deploy key on your computer and run `pad` as a library:

- The key owns the name and signs DotNS.
- One of `pad`'s pool accounts signs the Bulletin upload. An owner key isn't authorized to store on
  devnet, and a pool account can spend upload quota but never own or repoint the name.
- Pass **`transferToSignedInUser: false`**. `pad` turns it on whenever a login session exists, and
  would hand the finished name to the phone account.

```js
import { derivePoolAccounts } from "@polkadot-community-foundation/polkadot-app-deploy";
import { deploy } from "@polkadot-community-foundation/polkadot-app-deploy/deploy";
const pool = derivePoolAccounts();
const up = pool[Math.floor(Math.random() * pool.length)];
await deploy("dist", "yourlabel.dot", {
  mnemonic,                          // the deploy key, from a mode-600 file outside the repo
  storageSigner: up.signer,
  storageSignerAddress: up.address,
  transferToSignedInUser: false,
  env: "devnet",
  jsMerkle: true,
});
```

Working scripts: sonde's `tools/deploy-key.mjs` and `tools/deploy.mjs`, and almanac's equivalents.
Before registering, check the name's owner with a read-only lookup (`tools/whois.mjs`). Refuse if
the owner is not your key, and make registering an explicit, typed-back step.

## Also

- **`PRODUCT_ID` must equal the `.dot` label.** The host keys product accounts, local storage and
  allowances by it. If they drift apart, host probes exercise an identity that never published
  anything.
- **Labels:** a signer with no personhood can register a base of **9 or more letters**, with or
  without two trailing digits. A base of 6–8 letters with two digits needs Personhood Lite. `pad`'s
  preflight is not a stopping point: for an eligible name it goes straight on to registration. So
  never loop `pad` over candidate names; each one it's allowed to register, it registers, at about
  10 PAS.
- **Debugging a revert:** read the signer off the raw extrinsic before forming a theory. An
  afternoon went to two wrong ones.
