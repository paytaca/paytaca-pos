# Historical NFC contract audit and implementation

Updated November 9, 2026. Initial investigation used POS `bc67f42` and the local
sibling `nfc-card/nfc-card-server` checkout. Changes are local and uncommitted.
No production database, secret or live card was accessed; no payment was sent.

## Confirmed issue

The POS reconstructed addresses and BCH preimages with one bundled artifact per
V1/V2 label. Historical revisions within V1 therefore used the wrong script.
The server ownership-balance fix preserved stored source, but its payment
builder/finalizer still substituted the current artifact. An address-only POS
fix would not have made historical contracts spendable. FT payments also skipped
independent transaction/preimage comparison.

The user supplied contract 61's actual serialized ID. The regression retains its
encoded constructor field, not database ID 61. Decoded parameters are:

- backend HASH160: `69dd099440a5460d86c07ad086e3ac507c6c4704`
- constructor category: `7510c9fc1a830960f094d79408b25d45dc3cb8c33cbe4f6d7bd41ee5517b3ad0`

Historical source before server commit `56aeb95` reproduces
`bitcoincash:pd78tqvzy7fxgc0lav8dqd08ywd50wwfl3fawjlshyjhxtcp70mdzahfkdqvv`.
Current V1 with those parameters produces
`bitcoincash:pvwlwn6p6qkp4jtkudwll6tah8p4uttz0xljfxmsy2t4ty5cs84ny6c42ww59`.
The source is pinned in the server fixture `contract-api/test/fixtures/pre-mutate-v1.cash`.
Its POS artifact was compiled using the installed server cashc 0.11.5, with debug
metadata omitted. POS's top-level cashc is older and cannot compile this source.
Tests pin the shipped historical source/bytecode to the original verified fixture.
No replacement serialized ID was invented for contract 61.

Before this change, ownership NFTs at the historical address were missed and
the POS showed “Unable to derive the auth category from the origin ownership
tokens” before requesting preimages/signing. Even if discovery were corrected,
historical preimages failed comparison against a current V1 rebuild; current
unlockers also failed against historical P2SH32 outputs. These are locally
reproduced mismatches, not evidence that contract 61 has no funds or is V2.

## Implemented flow and responsibility

1. The native NFC adapter and `usePaymentTracking.js` extract UID, PICC/CMAC URI
   and NDEF `backend_pk:category[:version]`. Missing NDEF version still means V1.
2. `src/card/contract/revisions.js` independently derives approved origin
   addresses using NDEF parameters. V1 candidates are current V1 and the exact
   pre-mutate V1 revision; V2 has only current V2. It checks ownership tokens at
   both candidates, requires one identifiable origin, then invokes the existing
   on-chain auth-category/version-pointer resolver. Read failures and ambiguous
   origins reject. A historical origin may point to current V2.
3. The POS sends merchant/recipient/amount/PICC/CMAC and optional FT fields to
   `cards.preimage` or REST `/cards/preimage/`. The NFC server authenticates the
   merchant, validates card proof/state, selects the stored payment contract and
   delegates its serialized ID to version-routed contract-api. The POS does not
   parse a serialized ID or accept server-provided source/constructor parameters.
4. The backend selects only an exact locally allowlisted source for signing:
   current V1 or pre-mutate V1 under V1; current V2 under V2. It uses that artifact
   for address/UTXO queries, output construction, preimages, persisted contract
   identity and final unlocking scripts. Unknown stored source rejects signing.
5. The preimage response now includes required `contract_address` for the active
   payment contract. The POS checks the lineage hint against on-chain resolution,
   derives approved candidate addresses locally (current V1 first, historical
   V1 second), requires a match and requires that revision to agree with its
   independent chain resolution. The address is a selector/check, not trusted
   evidence of ownership. BCH/token encodings of the same mainnet P2SH payload
   are equivalent; wrong network/type/payload is rejected.
6. `src/card/contract/taptopay.js` fetches ownership, authorization, BCH and FT
   UTXOs from Watchtower at the selected address. `spend.js` independently builds
   **both BCH and FT** transactions, preserving authorization NFTs, recipient,
   FT category/quantity, FT change, BCH change, input order and fees. FT selection
   mirrors contract-api's deterministic exact-single/exact-pair/minimal-cover
   policy and minimal BCH funding. Immutable NFT inputs are excluded from FT
   funding. Only transaction locktime comes from the server build.
7. `verifySpendBuild` compares every preimage and the entire placeholder
   transaction, plus server input references when present. Any mismatch rejects
   before `signPreimages` is invoked. Inputs/outputs are never adopted from the
   server merely to make the comparison pass.
8. Merchant signatures use the existing double hash, Schnorr and `0x41` path.
   The POS submits UID, authenticated merchant, `tx_id` and indexed signatures
   through WS or REST. Backend finalization uses the matching artifact and
   checks the stored contract identity and authenticated merchant before adding
   backend signatures. Reservations, TTL, replay and broadcast checks remain.
9. The POS still shows errors from rejected payments and success only on a
   successful spend response. No local broadcast or success bypass was added.

## Script-sensitive code

- POS `src/card/contract/taptopay.js`: artifact mapping, approved historical
  constructor selection, address derivation and Watchtower queries.
- POS `src/card/contract/revisions.js`: approved revision enumeration, address
  matching and independent origin/migration discovery.
- POS `src/card/contract/spend.js`, `ft-selection.js`: authorization selection,
  deterministic funding, outputs, placeholder unlockers and sighash preimages.
- POS `src/card/payment.js`: version/address/revision gates, unconditional BCH/FT
  validation, merchant signing and WS/REST submission.
- POS `src/card/contract/verify.js`, `locktime.js`, `src/card/utils.js`: existing
  comparison, locktime decoding and cryptographic signing helpers.
- Server `main/views.py:646`, `main/consumers.py:196`,
  `main/utils/contract/client.py:300`: existing authenticated routing and stored
  contract-ID delegation; response fields pass through without Python changes.
- Server `contract-api/src/main/tap-to-pay.js`: approved source selection,
  reconstruction, preimage response address, persisted identity and finalization.
- Server `contract-api/src/contracts/TapToPayV1PreMutate.cash`: exact historical
  source, shipped alongside current V1/V2 sources.

## Security and compatibility decisions

The user's follow-up authorizes support for this particular historical V1
revision. This is not automatic support for arbitrary embedded source. The
backend compares exact stored source text with its local allowlist and rejects
unknown revisions. The POS only uses shipped artifacts. No constructor values,
script code or active version are trusted solely because the server supplied them.

Historical V1 retains its hardcoded 100,000-satoshi global-auth ceiling and lacks
`mutate`; current V1 continues to use the NFT-encoded limit. V1 FT is rejected
explicitly by both builders; current server REST/WS V1 policy remains. V2 retains
its separate FT/BCH change behavior. Existing merchant authorization, backend
key-hash binding, contract/merchant record binding and transaction checks remain.

The candidate origin probe is necessary before the preimage request because
NDEF has no source fingerprint and the existing migration lookup needs the
origin address. It avoids an extra trusted lookup endpoint or silently treating
a missing token at today's V1 address as proof of migration. It adds one
independent NFT lookup for V1, performed alongside the current candidate lookup.

## Tests

- `npm test`: **87 passed**, including production payment orchestration with mocked HTTP/Watchtower,
  all three BCH revisions, V2 FT exact/cover/pair cases with and without BCH
  funding, token/BCH change, tampering before signing, missing/unknown addresses,
  version mismatch, ambiguity, read errors, historical-origin V2 pointer,
  historical spending ceiling, authorization rejection and NFT exclusion.
- `tests/card-historical-contract.test.mjs`: exact contract-61 address pair,
  production artifact/source pin, why version-only discovery fails, historical
  versus current preimage rejection, dummy-key signatures and local input VM
  verification against each matching and substituted script.
- `node tests/integration/run-card-backend-tests.mjs`: **7 passed**, real POS-builder /
  backend-builder compatibility cases against the sibling server checkout and
  its installed test dependencies. Exact transaction/preimage equality for
  historical V1/current V1/current V2 BCH and four V2 FT funding/change cases;
  real POS signatures are finalized with `broadcast: false` and every final
  input passes local BCH VM verification. Historical records are rejected under
  the current V1 identity. All services/UTXOs/height/persistence are mocked and
  dotenv is mocked before imports. This runner never loads app environment files.
- Server `historical-signing.test.js`: historical address/identity, unknown-source
  rejection, V1/V2 label separation and current generated contract identities.
  Existing ownership/builder/authorization/broadcast/reservation tests also run.
  The V2-mode payment/authorization/signing regression gate passed **91 tests**.

The full backend test attempt found two failures in the unchanged
`test/watchtower-client.test.js`: installed SDK `getUri()` returns relative URLs
where that test expects absolute URLs. Its adapter remains in-memory. The
localhost authorization suite initially hit an environment restriction; rerun
with a permitted local listener passed all 61 cases. These SDK assertions are
separate from payment compatibility and have not been changed to conceal them.

## Rollout and remaining staging checks

Deploy the backend change **before** this POS version. The POS requires
`contract_address`; old backends fail closed rather than bypassing validation.
Drain in-flight preimage records during coordinated rollout. Historical source
matching is intentionally exact: additional revisions require review and tests.

Independent Watchtower reads may differ from server reservation/indexer state.
A differing selection is rejected, including FT; retry after reconciliation.
This is a compatibility/availability limit, not permission to skip validation.

Staging must still verify native taps, REST and WS fallback/replay, indexer
response normalization and concurrent UTXO/reservation changes for historical
V1/current V1/current V2 and historical-origin migration to V2. Also verify V1
FT rejection and all merchant/contract/signature/transaction rejection paths.
Use isolated dummy fixtures and non-broadcast finalization first. These tests do
not prove production deployment, mempool acceptance or contract 61's current
merchant authorization/provisioning state. Its reported unmoved linking NFT is
a separate fact; this change does not activate cards or move ownership tokens.

Whether historical cards reached users remains unknown. Inventory/distribution
review can inform retirement later; no automatic migration or phase-out is part
of this implementation.
