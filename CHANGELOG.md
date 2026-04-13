# Changelog

## [1.47.2](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.47.1...mcp-server-v1.47.2) (2026-04-13)


### Bug Fixes

* **news-tools:** update beat slug examples for 12-to-3 consolidation (closes [#457](https://github.com/aibtcdev/aibtc-mcp-server/issues/457)) ([#463](https://github.com/aibtcdev/aibtc-mcp-server/issues/463)) ([eb28f6c](https://github.com/aibtcdev/aibtc-mcp-server/commit/eb28f6c24d65791157ffe1bce49e78fc5bac88bb))

## [1.47.1](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.47.0...mcp-server-v1.47.1) (2026-04-10)


### Bug Fixes

* **inbox:** handle 202 staged delivery as success ([#454](https://github.com/aibtcdev/aibtc-mcp-server/issues/454)) ([2f0dc97](https://github.com/aibtcdev/aibtc-mcp-server/commit/2f0dc974137b13b03a7a4fecc43299ee1e9b3df2))

## [1.47.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.46.3...mcp-server-v1.47.0) (2026-04-07)


### Features

* **news:** add beat editor and missing API MCP tools ([#449](https://github.com/aibtcdev/aibtc-mcp-server/issues/449)) ([ad612ae](https://github.com/aibtcdev/aibtc-mcp-server/commit/ad612aefa717eca13894390c5e00788a1e30aed9))

## [1.46.3](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.46.2...mcp-server-v1.46.3) (2026-04-03)


### Bug Fixes

* align relay payment polling contract with tx-schemas ([#439](https://github.com/aibtcdev/aibtc-mcp-server/issues/439)) ([b394f5c](https://github.com/aibtcdev/aibtc-mcp-server/commit/b394f5cb82be30e723606a8f469c526d8ee894ce))

## [1.46.2](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.46.1...mcp-server-v1.46.2) (2026-04-01)


### Bug Fixes

* **news:** include created_by in news_claim_beat payload ([#436](https://github.com/aibtcdev/aibtc-mcp-server/issues/436)) ([bff4729](https://github.com/aibtcdev/aibtc-mcp-server/commit/bff4729311fccb6d4ab140a5f4268e9b84ec018e))

## [1.46.1](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.46.0...mcp-server-v1.46.1) (2026-03-31)


### Bug Fixes

* **inbox:** extract paymentId for nonce observability ([#434](https://github.com/aibtcdev/aibtc-mcp-server/issues/434)) ([82949d1](https://github.com/aibtcdev/aibtc-mcp-server/commit/82949d15a2dff2ce8617c54bcea65d4256683525))

## [1.46.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.45.0...mcp-server-v1.46.0) (2026-03-28)


### Features

* add zest_enable_collateral tool for V2 collateral-add (closes [#422](https://github.com/aibtcdev/aibtc-mcp-server/issues/422)) ([#423](https://github.com/aibtcdev/aibtc-mcp-server/issues/423)) ([f5385fc](https://github.com/aibtcdev/aibtc-mcp-server/commit/f5385fc4d664b13bf2eb0c4e4ba647f8eed741bf))

## [1.45.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.44.0...mcp-server-v1.45.0) (2026-03-26)


### Features

* correlate sender/sponsor nonces for complete tx diagnostics (closes [#417](https://github.com/aibtcdev/aibtc-mcp-server/issues/417)) ([#419](https://github.com/aibtcdev/aibtc-mcp-server/issues/419)) ([42c51c1](https://github.com/aibtcdev/aibtc-mcp-server/commit/42c51c1700128b0325637dccfd402f3b8f915bda))

## [1.44.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.43.0...mcp-server-v1.44.0) (2026-03-26)


### Features

* **nonce:** unified sender nonce tracker with file-backed persistence ([#415](https://github.com/aibtcdev/aibtc-mcp-server/issues/415)) ([9d62348](https://github.com/aibtcdev/aibtc-mcp-server/commit/9d623485378580d26b51668ea98c75f7ddf9cb4c)), closes [#413](https://github.com/aibtcdev/aibtc-mcp-server/issues/413)

## [1.43.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.42.4...mcp-server-v1.43.0) (2026-03-25)


### Features

* **news:** add news_claim_beat tool for creating/joining beats (closes [#410](https://github.com/aibtcdev/aibtc-mcp-server/issues/410)) ([#411](https://github.com/aibtcdev/aibtc-mcp-server/issues/411)) ([f6479f7](https://github.com/aibtcdev/aibtc-mcp-server/commit/f6479f7ad02f9168dadaae1b24118fb4d5811349))

## [1.42.4](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.42.3...mcp-server-v1.42.4) (2026-03-25)


### Bug Fixes

* **inbox:** register send_inbox_message tool in registerAllTools (closes [#407](https://github.com/aibtcdev/aibtc-mcp-server/issues/407)) ([#408](https://github.com/aibtcdev/aibtc-mcp-server/issues/408)) ([a6b9640](https://github.com/aibtcdev/aibtc-mcp-server/commit/a6b9640206db2d67f69c606e9d12e8b5713a946f))

## [1.42.3](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.42.2...mcp-server-v1.42.3) (2026-03-24)


### Bug Fixes

* inbox retry honors retryAfter and reuses tx on relay-side conflicts ([#404](https://github.com/aibtcdev/aibtc-mcp-server/issues/404)) ([eb8af80](https://github.com/aibtcdev/aibtc-mcp-server/commit/eb8af80bc261173ffc624b7f099d86eb4d91bc0f))
* news_file_signal disclosure + @noble/hashes build error ([#406](https://github.com/aibtcdev/aibtc-mcp-server/issues/406)) ([14f1f4b](https://github.com/aibtcdev/aibtc-mcp-server/commit/14f1f4be8b9e5e2fed632ad92084bd16713a0bd5))

## [1.42.2](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.42.1...mcp-server-v1.42.2) (2026-03-24)


### Bug Fixes

* **x402:** break payment interceptor spiral, surface errors, extract payment_txid ([#400](https://github.com/aibtcdev/aibtc-mcp-server/issues/400)) ([0d4b2a6](https://github.com/aibtcdev/aibtc-mcp-server/commit/0d4b2a6d76d99dae2bcc5d6f365d01b6528e0b3e)), closes [#397](https://github.com/aibtcdev/aibtc-mcp-server/issues/397)

## [1.42.1](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.42.0...mcp-server-v1.42.1) (2026-03-24)


### Bug Fixes

* x402 payment flow — eliminate redundant probe, add 429 retry ([#395](https://github.com/aibtcdev/aibtc-mcp-server/issues/395)) ([4445f65](https://github.com/aibtcdev/aibtc-mcp-server/commit/4445f65dd71b8f1a456ac49973a270f14ac3a784))

## [1.42.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.41.0...mcp-server-v1.42.0) (2026-03-20)


### Features

* **jingswap:** update contract names to sbtc-stx-jing / sbtc-usdcx-jing ([#383](https://github.com/aibtcdev/aibtc-mcp-server/issues/383)) ([188740c](https://github.com/aibtcdev/aibtc-mcp-server/commit/188740c4de7c3003299193e2327be01e04893ba1))

## [1.41.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.40.0...mcp-server-v1.41.0) (2026-03-19)


### Features

* **bounty-scanner:** add bounty scanner MCP tools ([1e75a28](https://github.com/aibtcdev/aibtc-mcp-server/commit/1e75a2811a2472eaecfc75c999dba649a8715d18))
* **credentials:** add encrypted credential store MCP tools ([#371](https://github.com/aibtcdev/aibtc-mcp-server/issues/371)) ([1d690af](https://github.com/aibtcdev/aibtc-mcp-server/commit/1d690afdcb631833536950939068eb6122887bcf)), closes [#368](https://github.com/aibtcdev/aibtc-mcp-server/issues/368)
* **identity:** add ERC-8004 identity MCP tools ([#370](https://github.com/aibtcdev/aibtc-mcp-server/issues/370)) ([fed1729](https://github.com/aibtcdev/aibtc-mcp-server/commit/fed1729419fe1e75d1696e5527a0f24bb796df2f))
* **runes:** add runes MCP tools ([dc58aa6](https://github.com/aibtcdev/aibtc-mcp-server/commit/dc58aa6862c9810466e171e9a3624eeb579f0d3f))
* **stackspot:** document PostConditionMode.Allow intent for claim and cancel ([6b18ce8](https://github.com/aibtcdev/aibtc-mcp-server/commit/6b18ce84e1ca35eab18f0acd62442f89a643a0a3))
* **tools:** add souldinals MCP tool group for soul inscription management ([#372](https://github.com/aibtcdev/aibtc-mcp-server/issues/372)) ([e6febbb](https://github.com/aibtcdev/aibtc-mcp-server/commit/e6febbbb24f330c1479206e92acc2d09f50e33b8)), closes [#366](https://github.com/aibtcdev/aibtc-mcp-server/issues/366)


### Bug Fixes

* **runes:** restore Unisat wallet tools and rune transfer infrastructure ([dc15406](https://github.com/aibtcdev/aibtc-mcp-server/commit/dc154067a47e143b117eda1cb0cd202eef97a4f2))

## [1.40.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.39.0...mcp-server-v1.40.0) (2026-03-18)


### Features

* **news:** add aibtc-news MCP tools (closes [#354](https://github.com/aibtcdev/aibtc-mcp-server/issues/354)) ([#360](https://github.com/aibtcdev/aibtc-mcp-server/issues/360)) ([d8519d8](https://github.com/aibtcdev/aibtc-mcp-server/commit/d8519d875e3c3cfbc886f99c3d667b349eb02a2c))


### Bug Fixes

* **signing:** register signing tools in tools/index (closes [#356](https://github.com/aibtcdev/aibtc-mcp-server/issues/356)) ([363a3eb](https://github.com/aibtcdev/aibtc-mcp-server/commit/363a3eb66837abd36c4e16c612e3ad631aa9b9d9))

## [1.39.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.38.0...mcp-server-v1.39.0) (2026-03-17)


### Features

* **jingswap:** add multi-market support (sbtc-stx + sbtc-usdcx) ([#349](https://github.com/aibtcdev/aibtc-mcp-server/issues/349)) ([444f1a5](https://github.com/aibtcdev/aibtc-mcp-server/commit/444f1a53b92a613c9edc758fedd2564b2e75cb1c))

## [1.38.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.37.0...mcp-server-v1.38.0) (2026-03-17)


### Features

* **ordinals:** add marketplace tools for listing/buying/browsing (closes [#190](https://github.com/aibtcdev/aibtc-mcp-server/issues/190)) ([93982e3](https://github.com/aibtcdev/aibtc-mcp-server/commit/93982e3750ce5a75f30e07ecfd85e03dc685fee2))
* **reputation:** add dedicated reputation MCP tools (closes [#304](https://github.com/aibtcdev/aibtc-mcp-server/issues/304)) ([be670db](https://github.com/aibtcdev/aibtc-mcp-server/commit/be670db78d61a905e8fe04dc146f2ee0ce55614c))


### Bug Fixes

* **stacking-lottery:** register stackspot tools in tools/index (closes [#308](https://github.com/aibtcdev/aibtc-mcp-server/issues/308)) ([85b1340](https://github.com/aibtcdev/aibtc-mcp-server/commit/85b1340f7cb6910a8518c45b3068e221aebacd17))

## [1.37.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.36.1...mcp-server-v1.37.0) (2026-03-16)


### Features

* **jingswap:** add blind batch auction tools for STX/sBTC (closes [#327](https://github.com/aibtcdev/aibtc-mcp-server/issues/327)) ([fa2b051](https://github.com/aibtcdev/aibtc-mcp-server/commit/fa2b051eab436415ff100b92b82b558583431489))
* **nostr:** add Nostr protocol MCP tools (closes [#330](https://github.com/aibtcdev/aibtc-mcp-server/issues/330)) ([822c750](https://github.com/aibtcdev/aibtc-mcp-server/commit/822c750497afb805c1239550ff321dc16985faa2))
* **ordinals-p2p:** P2P ordinals trade ledger tools via ledger.drx4.xyz ([#324](https://github.com/aibtcdev/aibtc-mcp-server/issues/324)) ([8672321](https://github.com/aibtcdev/aibtc-mcp-server/commit/8672321017f06cd07cca5e9b95988043a72e24d4))
* **stacks-market:** add prediction market MCP tools (closes [#329](https://github.com/aibtcdev/aibtc-mcp-server/issues/329)) ([24d3bce](https://github.com/aibtcdev/aibtc-mcp-server/commit/24d3bceeef6f95c25cfb840fa33fd21426e1dc9f))
* **taproot-multisig:** Taproot M-of-N multisig coordination tools ([#325](https://github.com/aibtcdev/aibtc-mcp-server/issues/325)) ([b027483](https://github.com/aibtcdev/aibtc-mcp-server/commit/b02748368d9d26d0e0a9092ae684fa8e1ab56564))


### Bug Fixes

* **transactions:** add LRU size bound to nonce maps and unit tests ([#338](https://github.com/aibtcdev/aibtc-mcp-server/issues/338)) ([d845e0f](https://github.com/aibtcdev/aibtc-mcp-server/commit/d845e0fe8d61df73ea8e0e40335555d560135bf6))

## [1.36.1](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.36.0...mcp-server-v1.36.1) (2026-03-16)


### Bug Fixes

* **fees:** lower contract_call ceiling to 50k uSTX and apply clamping on all write paths ([#333](https://github.com/aibtcdev/aibtc-mcp-server/issues/333)) ([fb3fa5f](https://github.com/aibtcdev/aibtc-mcp-server/commit/fb3fa5f76a59898708e8ad288cb03539fe2a3654))
* **transactions:** track pending nonce to prevent dropped back-to-back txs (fixes [#326](https://github.com/aibtcdev/aibtc-mcp-server/issues/326)) ([#331](https://github.com/aibtcdev/aibtc-mcp-server/issues/331)) ([936594a](https://github.com/aibtcdev/aibtc-mcp-server/commit/936594a00f7fdf42efd37943c6f180b6849f6044))

## [1.36.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.35.0...mcp-server-v1.36.0) (2026-03-16)


### Features

* **dual-stacking:** add Dual Stacking MCP tools ([#305](https://github.com/aibtcdev/aibtc-mcp-server/issues/305)) ([#313](https://github.com/aibtcdev/aibtc-mcp-server/issues/313)) ([53c9d20](https://github.com/aibtcdev/aibtc-mcp-server/commit/53c9d2017bc0545753fffa33e71724c082d1201e))
* **mempool:** add mempool watch tools - get_mempool_info, get_transaction_status, get_address_txs ([#311](https://github.com/aibtcdev/aibtc-mcp-server/issues/311)) ([a61e1eb](https://github.com/aibtcdev/aibtc-mcp-server/commit/a61e1eb52bcdd19e831e324f6d1993a8eecb6f33))
* **signing:** add btc_sign_message and stacks_sign_message MCP tools (closes [#298](https://github.com/aibtcdev/aibtc-mcp-server/issues/298)) ([#314](https://github.com/aibtcdev/aibtc-mcp-server/issues/314)) ([2150207](https://github.com/aibtcdev/aibtc-mcp-server/commit/21502073ec1f0e55ae6c8bf7091c73aed21351f6))
* **tenero:** add market analytics MCP tools ([#302](https://github.com/aibtcdev/aibtc-mcp-server/issues/302)) ([#312](https://github.com/aibtcdev/aibtc-mcp-server/issues/312)) ([e81e01a](https://github.com/aibtcdev/aibtc-mcp-server/commit/e81e01a335df8f899305b8638825c51c8761ec16))


### Bug Fixes

* rename mempool tools to avoid duplicate registration ([#322](https://github.com/aibtcdev/aibtc-mcp-server/issues/322)) ([b56a7f6](https://github.com/aibtcdev/aibtc-mcp-server/commit/b56a7f6f98dcf791f811609f953a1f6ac134621c)), closes [#321](https://github.com/aibtcdev/aibtc-mcp-server/issues/321)
* **sbtc:** correct testnet contract addresses and add network mismatch guard ([#318](https://github.com/aibtcdev/aibtc-mcp-server/issues/318)) ([547386e](https://github.com/aibtcdev/aibtc-mcp-server/commit/547386eabe1c42eda0794d0ad23e6b4555f40051)), closes [#309](https://github.com/aibtcdev/aibtc-mcp-server/issues/309)

## [1.35.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.34.0...mcp-server-v1.35.0) (2026-03-13)


### Features

* add skill references and relay recovery tools ([#296](https://github.com/aibtcdev/aibtc-mcp-server/issues/296)) ([4c14238](https://github.com/aibtcdev/aibtc-mcp-server/commit/4c142387a4e27f3d578cd61eb129ec89758dac72))

## [1.34.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.33.4...mcp-server-v1.34.0) (2026-03-12)


### Features

* add Styx BTC→sBTC conversion tools ([#268](https://github.com/aibtcdev/aibtc-mcp-server/issues/268)) ([f3505ab](https://github.com/aibtcdev/aibtc-mcp-server/commit/f3505aba087277321f0a33aec05fb03c8a6441eb))

## [1.33.4](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.33.3...mcp-server-v1.33.4) (2026-03-12)


### Bug Fixes

* **pillar:** hardcode default API key for direct tools auth ([#274](https://github.com/aibtcdev/aibtc-mcp-server/issues/274)) ([c58fbc5](https://github.com/aibtcdev/aibtc-mcp-server/commit/c58fbc556a80684e9decf4df863c02ecb50ed06a))

## [1.33.3](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.33.2...mcp-server-v1.33.3) (2026-03-10)


### Bug Fixes

* **zest:** read supply from LP token balance instead of reserve data ([#285](https://github.com/aibtcdev/aibtc-mcp-server/issues/285)) ([bf25698](https://github.com/aibtcdev/aibtc-mcp-server/commit/bf25698a270b6905e4a8661d833e07a3b5f92621))

## [1.33.2](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.33.1...mcp-server-v1.33.2) (2026-03-09)


### Bug Fixes

* **deps:** add missing @scure/bip32 dependency ([#280](https://github.com/aibtcdev/aibtc-mcp-server/issues/280)) ([f3d7f2c](https://github.com/aibtcdev/aibtc-mcp-server/commit/f3d7f2c3812cb3b703f08bea3066760bf7218629))
* pre-check rewards before broadcasting zest_claim_rewards ([#281](https://github.com/aibtcdev/aibtc-mcp-server/issues/281)) ([48bff3e](https://github.com/aibtcdev/aibtc-mcp-server/commit/48bff3e4acca1216532c2caa54e6088eef919e5f))
* read LP token balance for zest supply positions ([#283](https://github.com/aibtcdev/aibtc-mcp-server/issues/283)) ([42aeee3](https://github.com/aibtcdev/aibtc-mcp-server/commit/42aeee35b64c62b26594d8a3ea617e7ec72c0fa1))

## [1.33.1](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.33.0...mcp-server-v1.33.1) (2026-03-08)


### Bug Fixes

* **zest:** update borrow-helper to v2-1-7, add Pyth price feeds and fix post-conditions ([#272](https://github.com/aibtcdev/aibtc-mcp-server/issues/272)) ([0331a66](https://github.com/aibtcdev/aibtc-mcp-server/commit/0331a66460133c393935af742e97217186465841))

## [1.33.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.32.1...mcp-server-v1.33.0) (2026-03-04)


### Features

* add sbtc_withdraw_status alias tool for sBTC peg-out status ([#259](https://github.com/aibtcdev/aibtc-mcp-server/issues/259)) ([7edc1d2](https://github.com/aibtcdev/aibtc-mcp-server/commit/7edc1d22512bf43d94e9d6c6f62e38db813ab71d)), closes [#189](https://github.com/aibtcdev/aibtc-mcp-server/issues/189)
* enable RBF on inscription txs and fix reveal fee estimation ([#262](https://github.com/aibtcdev/aibtc-mcp-server/issues/262)) ([94c62e1](https://github.com/aibtcdev/aibtc-mcp-server/commit/94c62e198df437549d56eaf9e31a0627e3eafdbe))


### Bug Fixes

* add tapInternalKey to parent input for key-path signing ([#260](https://github.com/aibtcdev/aibtc-mcp-server/issues/260)) ([80f7422](https://github.com/aibtcdev/aibtc-mcp-server/commit/80f742201c1525b7f6a8b320766d82b957ceae9d))

## [1.32.1](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.32.0...mcp-server-v1.32.1) (2026-03-04)


### Bug Fixes

* correct Xverse API field mapping in lookupParentInscription ([#256](https://github.com/aibtcdev/aibtc-mcp-server/issues/256)) ([4b6bc06](https://github.com/aibtcdev/aibtc-mcp-server/commit/4b6bc068557cdd8f7845cc5ad27a940913f7e941))

## [1.32.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.31.0...mcp-server-v1.32.0) (2026-03-04)


### Features

* parent-child inscription tools ([#254](https://github.com/aibtcdev/aibtc-mcp-server/issues/254)) ([ae9953f](https://github.com/aibtcdev/aibtc-mcp-server/commit/ae9953f3323c3dabff737a06efeddfad4062af51))

## [1.31.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.30.3...mcp-server-v1.31.0) (2026-03-04)


### Features

* return interpreted amount metadata in Bitflow quote/swap (closes [#218](https://github.com/aibtcdev/aibtc-mcp-server/issues/218)) ([#251](https://github.com/aibtcdev/aibtc-mcp-server/issues/251)) ([cde76b5](https://github.com/aibtcdev/aibtc-mcp-server/commit/cde76b5fdcf403b37f8c69471d4ee3492952baeb))

## [1.30.3](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.30.2...mcp-server-v1.30.3) (2026-03-04)


### Bug Fixes

* add preflight guardrail for suspicious amount scaling (closes [#219](https://github.com/aibtcdev/aibtc-mcp-server/issues/219)) ([#248](https://github.com/aibtcdev/aibtc-mcp-server/issues/248)) ([8d24be4](https://github.com/aibtcdev/aibtc-mcp-server/commit/8d24be4951eb25636115086b523ed5b8371c363f))
* require explicit amountUnit in Bitflow quote and swap tools (closes [#217](https://github.com/aibtcdev/aibtc-mcp-server/issues/217)) ([#246](https://github.com/aibtcdev/aibtc-mcp-server/issues/246)) ([b40ffd1](https://github.com/aibtcdev/aibtc-mcp-server/commit/b40ffd194db01edf2436adf791f5f91a34024259))

## [1.30.2](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.30.1...mcp-server-v1.30.2) (2026-03-03)


### Bug Fixes

* **x402:** skip STX gas check for sponsored sBTC payments ([#241](https://github.com/aibtcdev/aibtc-mcp-server/issues/241)) ([58a8985](https://github.com/aibtcdev/aibtc-mcp-server/commit/58a89857e42e974acaa1dfb7270ca5ec4ca04701)), closes [#238](https://github.com/aibtcdev/aibtc-mcp-server/issues/238)

## [1.30.1](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.30.0...mcp-server-v1.30.1) (2026-03-03)


### Bug Fixes

* **sbtc,psbt:** cleanup PSBT and sBTC withdrawal tools from PR [#235](https://github.com/aibtcdev/aibtc-mcp-server/issues/235) ([#239](https://github.com/aibtcdev/aibtc-mcp-server/issues/239)) ([20d17f6](https://github.com/aibtcdev/aibtc-mcp-server/commit/20d17f69e919973791e7e8f6059d2a156b628835))

## [1.30.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.29.0...mcp-server-v1.30.0) (2026-02-28)


### Features

* **sponsor:** add sponsored parameter to call_contract, transfer_stx, deploy_contract ([#221](https://github.com/aibtcdev/aibtc-mcp-server/issues/221)) ([ce4f4bb](https://github.com/aibtcdev/aibtc-mcp-server/commit/ce4f4bbaf06496187c5d9327099086e513071db6))
* **x402:** add payment-identifier extension for relay idempotency ([#226](https://github.com/aibtcdev/aibtc-mcp-server/issues/226)) ([7c96879](https://github.com/aibtcdev/aibtc-mcp-server/commit/7c968799e0e72c38eb6d65ed93120443c935a454))

## [1.29.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.28.4...mcp-server-v1.29.0) (2026-02-27)


### Features

* **signing:** add nostr_sign_event tool for NIP-01 event signing ([#211](https://github.com/aibtcdev/aibtc-mcp-server/issues/211)) ([18108de](https://github.com/aibtcdev/aibtc-mcp-server/commit/18108def78e68ef73d4449916916260e5e8ac4bc))

## [1.28.4](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.28.3...mcp-server-v1.28.4) (2026-02-27)


### Bug Fixes

* **inscriptions:** correct tapLeafScript spread and extract deriveRevealScript ([#207](https://github.com/aibtcdev/aibtc-mcp-server/issues/207)) ([89a0dab](https://github.com/aibtcdev/aibtc-mcp-server/commit/89a0dab1ec1e824fbda348fc3bcd2e61f1f0ba92))

## [1.28.3](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.28.2...mcp-server-v1.28.3) (2026-02-26)


### Bug Fixes

* **bitflow:** populate SDK token context and fix unit scaling ([#203](https://github.com/aibtcdev/aibtc-mcp-server/issues/203)) ([ba71074](https://github.com/aibtcdev/aibtc-mcp-server/commit/ba710747ef49583f46aa06edca8075daadaeb187))

## [1.28.2](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.28.1...mcp-server-v1.28.2) (2026-02-26)


### Bug Fixes

* **bitflow:** align agent quote/swap units with frontend ([#201](https://github.com/aibtcdev/aibtc-mcp-server/issues/201)) ([b519a16](https://github.com/aibtcdev/aibtc-mcp-server/commit/b519a16ccf1fe80198ca977895b4829085173991))

## [1.28.1](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.28.0...mcp-server-v1.28.1) (2026-02-26)


### Bug Fixes

* default network to mainnet instead of testnet ([#198](https://github.com/aibtcdev/aibtc-mcp-server/issues/198)) ([855fa4a](https://github.com/aibtcdev/aibtc-mcp-server/commit/855fa4aa9977e3398680a05d14f5eeab93430332))
* update test assertions to expect mainnet Bitcoin addresses ([#200](https://github.com/aibtcdev/aibtc-mcp-server/issues/200)) ([f36cea4](https://github.com/aibtcdev/aibtc-mcp-server/commit/f36cea466e35209207d65997cb9b2f5a9675dd6a))

## [1.28.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.27.0...mcp-server-v1.28.0) (2026-02-24)


### Features

* **signing:** add BIP-322 support for bc1q and bc1p addresses ([#194](https://github.com/aibtcdev/aibtc-mcp-server/issues/194)) ([9185364](https://github.com/aibtcdev/aibtc-mcp-server/commit/9185364a17e319ebd6b4f4d6a63e3b5b9979a74e))

## [1.27.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/mcp-server-v1.26.0...mcp-server-v1.27.0) (2026-02-20)


### Features

* add aibtc-bitcoin-wallet Agent Skill with ClawHub publishing ([#33](https://github.com/aibtcdev/aibtc-mcp-server/issues/33)) ([c2993ff](https://github.com/aibtcdev/aibtc-mcp-server/commit/c2993ff10d3a33e2575ed235a5226eb2275123cc))
* add BNS registration tools with V1/V2 auto-detection ([#45](https://github.com/aibtcdev/aibtc-mcp-server/issues/45)) ([df90072](https://github.com/aibtcdev/aibtc-mcp-server/commit/df90072bc5bb15144be33dfefc40c0ac97b3fa03))
* add custom fee support for Stacks transactions ([#54](https://github.com/aibtcdev/aibtc-mcp-server/issues/54)) ([b6f16d8](https://github.com/aibtcdev/aibtc-mcp-server/commit/b6f16d8ef43a44326279d7d50f6afc8830e323ad))
* add ERC-8004 identity and reputation tools ([#83](https://github.com/aibtcdev/aibtc-mcp-server/issues/83)) ([1ed5605](https://github.com/aibtcdev/aibtc-mcp-server/commit/1ed560569581f9ea2c55c6c562eade5d9609e048))
* add genesis skill reference files ([#80](https://github.com/aibtcdev/aibtc-mcp-server/issues/80)) ([824acee](https://github.com/aibtcdev/aibtc-mcp-server/commit/824acee6ddd0f61822037e0ff8c6a2168cd89678))
* add MCP registry configuration for modelcontextprotocol.io ([#68](https://github.com/aibtcdev/aibtc-mcp-server/issues/68)) ([2864b3a](https://github.com/aibtcdev/aibtc-mcp-server/commit/2864b3a07b6dc613feddfc77116c6795f70aa715))
* add mcp server with x402 tools ([1a817e6](https://github.com/aibtcdev/aibtc-mcp-server/commit/1a817e6afbadf582a173ba80a0bcf3cab1df7d20))
* add message signing tools (SIP-018, SIWS, BIP-137) ([#49](https://github.com/aibtcdev/aibtc-mcp-server/issues/49)) ([d39ace7](https://github.com/aibtcdev/aibtc-mcp-server/commit/d39ace799bd011a4143a5675c2bb1cc19abf9d89))
* add micro-ordinals support with ordinal-aware UTXO management ([#58](https://github.com/aibtcdev/aibtc-mcp-server/issues/58)) ([d2e274a](https://github.com/aibtcdev/aibtc-mcp-server/commit/d2e274a270291b34727cea61511326cedad921fb))
* add name-claim-fast for single-tx BNS V2 registration ([aae6d26](https://github.com/aibtcdev/aibtc-mcp-server/commit/aae6d26c661f84dc38cd03e7d8d1c101a3d6a01e))
* add native BTC → sBTC bridge deposit with ordinal safety ([#90](https://github.com/aibtcdev/aibtc-mcp-server/issues/90)) ([77abf0c](https://github.com/aibtcdev/aibtc-mcp-server/commit/77abf0c0c8dcacc6bc79bf98eca0fc436c290c2b))
* add post conditions to all transaction sites for PostConditionMode.Deny ([#106](https://github.com/aibtcdev/aibtc-mcp-server/issues/106)) ([404ee0f](https://github.com/aibtcdev/aibtc-mcp-server/commit/404ee0f6d17ce4fb65ed1d7bb49f753623f5ea83))
* add send_inbox_message tool with sponsored x402 flow ([#149](https://github.com/aibtcdev/aibtc-mcp-server/issues/149)) ([aa83803](https://github.com/aibtcdev/aibtc-mcp-server/commit/aa83803fc64d51d0060aad2012ae46dd42a75aa6))
* add sponsored transaction support for ERC-8004 and sBTC ([#96](https://github.com/aibtcdev/aibtc-mcp-server/issues/96)) ([30f9061](https://github.com/aibtcdev/aibtc-mcp-server/commit/30f90619bf58c101c81a651761079cecacb6affa))
* add stacks transaction packages ([8a6aefa](https://github.com/aibtcdev/aibtc-mcp-server/commit/8a6aefafaa0cfd091af8a1a8f448789b774cf89b))
* add stacks wallet helper ([fe5a567](https://github.com/aibtcdev/aibtc-mcp-server/commit/fe5a5674dcfc959cc6826213941405a625a3a8c1))
* add transaction signing and execution capabilities ([352973a](https://github.com/aibtcdev/aibtc-mcp-server/commit/352973af98d5188ec414bd01cef810cc70cc7f0d))
* add transaction tools and endpoint discovery ([96c56b2](https://github.com/aibtcdev/aibtc-mcp-server/commit/96c56b2e32a952486b1ba7691e96bdaf9b5cac90))
* add wallet_rotate_password tool ([#87](https://github.com/aibtcdev/aibtc-mcp-server/issues/87)) ([eeadc7f](https://github.com/aibtcdev/aibtc-mcp-server/commit/eeadc7fbc26604dbfa03f621384bbb9e67ba7e65))
* add x402 api client with payment interceptor ([1976b04](https://github.com/aibtcdev/aibtc-mcp-server/commit/1976b047752c87cbdce94818f73301c447f849b1))
* add x402 endpoint registry from multiple sources ([697341a](https://github.com/aibtcdev/aibtc-mcp-server/commit/697341a6efdcc811ea81b50cb2309041682f7070))
* add x402 endpoint scaffolding and OpenRouter integration tools ([7bd9b10](https://github.com/aibtcdev/aibtc-mcp-server/commit/7bd9b10dee40fe36b5f83fed5aaf44fa1ac418ed))
* add x402 endpoint scaffolding and OpenRouter integration tools ([95d654f](https://github.com/aibtcdev/aibtc-mcp-server/commit/95d654f64bb81752e08f18bb2cf41fbca18d60ea))
* add yield hunter tools for DeFi analytics ([f3bc00d](https://github.com/aibtcdev/aibtc-mcp-server/commit/f3bc00d815f2a830dd516e8b85d53eb6ad25ea85))
* **alex:** add pool discovery tool ([4f8427f](https://github.com/aibtcdev/aibtc-mcp-server/commit/4f8427f40124206300d929677dbbc03477a2b831))
* Bitcoin-first wallet experience ([#36](https://github.com/aibtcdev/aibtc-mcp-server/issues/36)) ([528ff08](https://github.com/aibtcdev/aibtc-mcp-server/commit/528ff0818a9b7c185d34f10efb62ce34032a47ca))
* **bitcoin:** add deriveBitcoinKeyPair for transaction signing ([7f67c08](https://github.com/aibtcdev/aibtc-mcp-server/commit/7f67c08ed84e0a3860dc0504372044167b9ec35d))
* **bitflow:** add Bitflow config and contract addresses ([a1fae08](https://github.com/aibtcdev/aibtc-mcp-server/commit/a1fae084f9ae5927b62264d6612181e8989b2ecd))
* **bitflow:** add Bitflow DEX service ([b105ebf](https://github.com/aibtcdev/aibtc-mcp-server/commit/b105ebf3c97eb977b6164c5a233051be90f87c45))
* **bitflow:** add Bitflow MCP tools ([397130d](https://github.com/aibtcdev/aibtc-mcp-server/commit/397130da0bf29c85f71bed6546a514f5e1a7b1f1))
* **bitflow:** register Bitflow tools ([0159f2b](https://github.com/aibtcdev/aibtc-mcp-server/commit/0159f2b3c7d3ba00eb1e991e28a60bb3bcfda333))
* **bns:** add BNS V2 API service for .btc domain lookups ([365e558](https://github.com/aibtcdev/aibtc-mcp-server/commit/365e5589a7de7596ae13c18579458acc850e3a03))
* **btc:** implement Bitcoin transaction building and signing ([a6f6e3f](https://github.com/aibtcdev/aibtc-mcp-server/commit/a6f6e3ffe527f9001f26266951993d50dd3426a4))
* **cli:** add --install flag for one-command setup ([70695b6](https://github.com/aibtcdev/aibtc-mcp-server/commit/70695b6e36ccb65a375366c57c6c5eb5f01e031c))
* complete fee support and fix ClawHub CI ([#57](https://github.com/aibtcdev/aibtc-mcp-server/issues/57)) ([da6471b](https://github.com/aibtcdev/aibtc-mcp-server/commit/da6471b69b7865f58a7a05000f0447f79f4dadfb)), closes [#53](https://github.com/aibtcdev/aibtc-mcp-server/issues/53)
* **config:** add ALEX DEX and Zest Protocol contract addresses ([99ffc35](https://github.com/aibtcdev/aibtc-mcp-server/commit/99ffc35086e7e747bab4777313a95bd831c83bdc))
* **config:** add CAIP-2 chain identifiers for Stacks and Bitcoin ([0b40345](https://github.com/aibtcdev/aibtc-mcp-server/commit/0b403455041e6a599703e558c3cf7a856b641271))
* **config:** add network and contract configuration ([27b9468](https://github.com/aibtcdev/aibtc-mcp-server/commit/27b9468617dbac959a97932ded279067030dec3d))
* default to mainnet, use --testnet flag for testnet ([9e24d96](https://github.com/aibtcdev/aibtc-mcp-server/commit/9e24d9646fab9ce21c418005581786611be43d3d))
* default to mainnet, use --testnet flag for testnet ([0433ee1](https://github.com/aibtcdev/aibtc-mcp-server/commit/0433ee1f57a3bdfb32273c70fbb7a1719cb0ccc6))
* **defi:** add ALEX DEX and Zest Protocol service ([2d2ad06](https://github.com/aibtcdev/aibtc-mcp-server/commit/2d2ad0637e393878d0fc65e92d30655a18a79e9a))
* enable Bitflow DEX tools with public API access ([#162](https://github.com/aibtcdev/aibtc-mcp-server/issues/162)) ([aec59e5](https://github.com/aibtcdev/aibtc-mcp-server/commit/aec59e5688aca8ecb8bb5c6b849552f6b706516a))
* **endpoints:** add registry and lookup helpers ([a255973](https://github.com/aibtcdev/aibtc-mcp-server/commit/a2559736881c61b1a60e94efe6b01e06a7afd479))
* improve Bitflow price impact UX and swap safety ([#164](https://github.com/aibtcdev/aibtc-mcp-server/issues/164)) ([0809c50](https://github.com/aibtcdev/aibtc-mcp-server/commit/0809c50e82586abee6644881b66d1a44c52e0d1c))
* improve scaffold tools UX and validation ([3a7ec77](https://github.com/aibtcdev/aibtc-mcp-server/commit/3a7ec779ec9520b7c84aa7f1b1ec805efddd29f0))
* **inbox:** allow inbox message resubmission with confirmed txid as payment proof ([#183](https://github.com/aibtcdev/aibtc-mcp-server/issues/183)) ([95c913b](https://github.com/aibtcdev/aibtc-mcp-server/commit/95c913bc7d403b8c150cf370232dc5b34ecb829d))
* **mempool:** add mempool.space API client for UTXO and fees ([c507f2b](https://github.com/aibtcdev/aibtc-mcp-server/commit/c507f2b12b49d4f9e30c10896534685b0da7e627))
* Pillar direct tools (agent-signed, no browser handoff) ([#32](https://github.com/aibtcdev/aibtc-mcp-server/issues/32)) ([867a2b9](https://github.com/aibtcdev/aibtc-mcp-server/commit/867a2b945a7258963189c880a759ff09c50c9292))
* Pillar MCP integration (13 tools) ([#24](https://github.com/aibtcdev/aibtc-mcp-server/issues/24)) ([b5cd9c2](https://github.com/aibtcdev/aibtc-mcp-server/commit/b5cd9c267c75b9d27dad381e9d42f1c76ced815a))
* **pillar:** add stacking tools, desktop install, and security improvements ([#108](https://github.com/aibtcdev/aibtc-mcp-server/issues/108)) ([01556c5](https://github.com/aibtcdev/aibtc-mcp-server/commit/01556c575d7f0cf60eeb29d1526d545873e14685))
* production readiness - security, quality, and tests ([#20](https://github.com/aibtcdev/aibtc-mcp-server/issues/20)) ([da7761d](https://github.com/aibtcdev/aibtc-mcp-server/commit/da7761df26545b4c59d12ba94ac0c2516ace2902))
* replace x402-stacks SDK with native relay and protocol helpers ([#158](https://github.com/aibtcdev/aibtc-mcp-server/issues/158)) ([fdd306f](https://github.com/aibtcdev/aibtc-mcp-server/commit/fdd306f3675b7c05e1608df1955346e1d3650d9e))
* **services:** add core protocol services ([d7e679a](https://github.com/aibtcdev/aibtc-mcp-server/commit/d7e679a2475ad8c31b580ebff70dfe6f00b5cc11))
* **services:** add wallet manager with session management ([7162f2b](https://github.com/aibtcdev/aibtc-mcp-server/commit/7162f2b5b356e6c47490ad2bfaae76141b76bc71))
* **services:** integrate wallet manager into x402 service ([5240357](https://github.com/aibtcdev/aibtc-mcp-server/commit/5240357e0e7dff00b70898c84d8391c1c40aa92c))
* **settings:** add runtime Hiro API key management via MCP tools ([da43caf](https://github.com/aibtcdev/aibtc-mcp-server/commit/da43caff2197a11296e7d5c990504566ea9161a3)), closes [#120](https://github.com/aibtcdev/aibtc-mcp-server/issues/120)
* **signing:** add schnorr_sign_digest and schnorr_verify_digest for Taproot multisig ([#163](https://github.com/aibtcdev/aibtc-mcp-server/issues/163)) ([089fc41](https://github.com/aibtcdev/aibtc-mcp-server/commit/089fc4159c2d742270f6f364fc5102864898dda9))
* support multiple API sources with client caching ([6b84882](https://github.com/aibtcdev/aibtc-mcp-server/commit/6b848824f084dcdbf4fc8cd7ad0d48a60274c3b2))
* **tools:** add Bitcoin L1 read-only tools (balance, fees, UTXOs) ([3f125ea](https://github.com/aibtcdev/aibtc-mcp-server/commit/3f125eabd903bf5d11ff77a5ddaf0d6506355448))
* **tools:** add DeFi MCP tools for ALEX and Zest ([e100e8d](https://github.com/aibtcdev/aibtc-mcp-server/commit/e100e8dbee779b82a7ff268167ad61961a5ffb6a))
* **tools:** add tool definitions and registry ([fa9e37d](https://github.com/aibtcdev/aibtc-mcp-server/commit/fa9e37d8a664d1c42113ec3ea8385659d0cc0ec4))
* **tools:** add transfer_btc tool for Bitcoin L1 transfers ([76d311d](https://github.com/aibtcdev/aibtc-mcp-server/commit/76d311df7da54bb542be394718a28c1d18fbf9c5))
* **tools:** add wallet management MCP tools ([f66c83c](https://github.com/aibtcdev/aibtc-mcp-server/commit/f66c83ced16831a262125f0ac97b272eb5d1bd0d))
* **tools:** expose Bitcoin address in get_wallet_info ([0c8d9e9](https://github.com/aibtcdev/aibtc-mcp-server/commit/0c8d9e9227fd7d9173a4b2907d975ad3288977f8))
* **tools:** expose Bitcoin address in wallet_status ([d4fd3db](https://github.com/aibtcdev/aibtc-mcp-server/commit/d4fd3dbbc4d0e7e91e8870a1ba9092eb2a001865))
* **tools:** register DeFi tools ([87682ec](https://github.com/aibtcdev/aibtc-mcp-server/commit/87682ec90499e4cf8b72982da198b77daf6000e6))
* **tools:** register wallet management tools ([34c92e5](https://github.com/aibtcdev/aibtc-mcp-server/commit/34c92e5cf7bbd3aa396117337f5f190b296bd1f2))
* **tools:** update get_wallet_info with agent-centric UX ([8ca83fb](https://github.com/aibtcdev/aibtc-mcp-server/commit/8ca83fb480ccdd1cb27be14fa57e756d4a9a7261))
* **transactions:** add builders and helpers ([411a660](https://github.com/aibtcdev/aibtc-mcp-server/commit/411a6604e8fe7e6e98487f195fbd1e9446d55f95))
* update pillar_dca_status for multi-schedule support ([#27](https://github.com/aibtcdev/aibtc-mcp-server/issues/27)) ([5977b09](https://github.com/aibtcdev/aibtc-mcp-server/commit/5977b096b345cb697f8c9541c14171350449934f))
* update scaffold service with production x402 patterns ([59877af](https://github.com/aibtcdev/aibtc-mcp-server/commit/59877afdb7b9542cf9f1b50ecccd2fb929bd23c7))
* update to registerTool API and limit apiUrl to known sources ([2ce1c79](https://github.com/aibtcdev/aibtc-mcp-server/commit/2ce1c79af66c1dfe15b4c33be6cc7187c186f714))
* upgrade x402-stacks to v2 + aibtc.com inbox support ([#93](https://github.com/aibtcdev/aibtc-mcp-server/issues/93)) ([8c15e36](https://github.com/aibtcdev/aibtc-mcp-server/commit/8c15e365c145e4f8c363f9cb43c148f7128e48cd))
* **utils:** add AES-256-GCM encryption utilities ([0c1b48a](https://github.com/aibtcdev/aibtc-mcp-server/commit/0c1b48adb8feccfeb1f8669189c18d2523e4a69c))
* **utils:** add validation and formatting helpers ([ec0c4fd](https://github.com/aibtcdev/aibtc-mcp-server/commit/ec0c4fd7ffc48099ed159cb0e8a76287dcf54ef1))
* **utils:** add wallet storage utilities ([6584f7a](https://github.com/aibtcdev/aibtc-mcp-server/commit/6584f7a111a4f6f0d84b308b58a984033cea7281))
* **utils:** add wallet-specific error classes ([98ee404](https://github.com/aibtcdev/aibtc-mcp-server/commit/98ee404271e19241fc98cdc05a59e060166faed6))
* **utils:** export bitcoin utilities ([c9431e2](https://github.com/aibtcdev/aibtc-mcp-server/commit/c9431e2a6754e15238373cc8c34ed1b6e887f4e6))
* **utils:** export encryption and storage modules ([f0d6f43](https://github.com/aibtcdev/aibtc-mcp-server/commit/f0d6f437fd786949ecd1bac4db442fa993609b8c))
* **wallet:** add Bitcoin address derivation with BIP84 ([4591f29](https://github.com/aibtcdev/aibtc-mcp-server/commit/4591f29a688034fb782eda5fd0ca338fbc28aacb))
* **wallet:** add btcAddress field to Account and WalletMetadata interfaces ([e9ba504](https://github.com/aibtcdev/aibtc-mcp-server/commit/e9ba504531dee6368b56404f624f7a0ecbabf8e5))
* **wallet:** derive and store Bitcoin private key on unlock ([c921409](https://github.com/aibtcdev/aibtc-mcp-server/commit/c9214097ffc12353ad9fcf8d4c4df89e6d34301b))
* **wallet:** derive Bitcoin addresses in wallet lifecycle ([b05acf3](https://github.com/aibtcdev/aibtc-mcp-server/commit/b05acf30f4c382875302741d37bb5e8bec5a56eb))
* **x402:** add probe-before-pay flow to prevent sBTC loss ([6f10042](https://github.com/aibtcdev/aibtc-mcp-server/commit/6f10042c583f34008cfaabe042eedab17050126d)), closes [#119](https://github.com/aibtcdev/aibtc-mcp-server/issues/119)
* **zest:** add complete asset configuration with LP tokens and oracles ([3a2bb81](https://github.com/aibtcdev/aibtc-mcp-server/commit/3a2bb81f6f280f2c37e87ada6fc7861e649336d7))


### Bug Fixes

* add allowUnknownOutputs flag to inscription builder ([#185](https://github.com/aibtcdev/aibtc-mcp-server/issues/185)) ([9a68c6f](https://github.com/aibtcdev/aibtc-mcp-server/commit/9a68c6fc5b762622d7a8e74380003041388d3139)), closes [#184](https://github.com/aibtcdev/aibtc-mcp-server/issues/184)
* add relay health monitoring and nonce gap detection ([88d1126](https://github.com/aibtcdev/aibtc-mcp-server/commit/88d1126a4046570efa5444d88c5433ef95248231)), closes [#172](https://github.com/aibtcdev/aibtc-mcp-server/issues/172) [#173](https://github.com/aibtcdev/aibtc-mcp-server/issues/173)
* Add relay health monitoring and nonce gap detection ([#174](https://github.com/aibtcdev/aibtc-mcp-server/issues/174)) ([88d1126](https://github.com/aibtcdev/aibtc-mcp-server/commit/88d1126a4046570efa5444d88c5433ef95248231))
* address PR review feedback ([#66](https://github.com/aibtcdev/aibtc-mcp-server/issues/66)) ([a54aa78](https://github.com/aibtcdev/aibtc-mcp-server/commit/a54aa7893e1036c713b47b0d2d2b7ef50256f8e8))
* **api:** document HIRO_API_KEY and complete rate limit handling ([#116](https://github.com/aibtcdev/aibtc-mcp-server/issues/116)) ([b6dc824](https://github.com/aibtcdev/aibtc-mcp-server/commit/b6dc824179eae5a9bfc4750a266a4582b2a524da)), closes [#114](https://github.com/aibtcdev/aibtc-mcp-server/issues/114)
* **bns:** use BNS V2 API for .btc domain lookups ([a278d0d](https://github.com/aibtcdev/aibtc-mcp-server/commit/a278d0dedbe80d7cb8e3f2860f3db8842fae1cb0))
* **ci:** integrate publish workflow into release-please ([#60](https://github.com/aibtcdev/aibtc-mcp-server/issues/60)) ([abdc2fd](https://github.com/aibtcdev/aibtc-mcp-server/commit/abdc2fdd36c410ea0f6c1a1cd0570d797484b36e))
* **ci:** pass token explicitly to clawhub CLI ([#39](https://github.com/aibtcdev/aibtc-mcp-server/issues/39)) ([8e2153e](https://github.com/aibtcdev/aibtc-mcp-server/commit/8e2153e08f8b464ace9440f711cf2ecc086233ed))
* **contracts:** distinguish native and AMM ALEX token addresses ([d5d1e9d](https://github.com/aibtcdev/aibtc-mcp-server/commit/d5d1e9dc80726653e37d18c5a8cd5a28bab3cbec))
* correct contract call arguments in sbtc_transfer, give_feedback, and get_reputation ([#103](https://github.com/aibtcdev/aibtc-mcp-server/issues/103)) ([b10bfa4](https://github.com/aibtcdev/aibtc-mcp-server/commit/b10bfa40b41e6412d8fef4e856dd0e910bcd0474)), closes [#102](https://github.com/aibtcdev/aibtc-mcp-server/issues/102)
* correct sBTC and USDCx contract addresses ([#23](https://github.com/aibtcdev/aibtc-mcp-server/issues/23)) ([5932da4](https://github.com/aibtcdev/aibtc-mcp-server/commit/5932da41642c4e17807f1bf29d3f7519f6cab95e))
* **defi:** properly handle contract error responses ([a0574d5](https://github.com/aibtcdev/aibtc-mcp-server/commit/a0574d59c29bdcabd37317c49c97f7e87edf02b5))
* **hiro-api:** handle serializeCV returning hex string ([4454a76](https://github.com/aibtcdev/aibtc-mcp-server/commit/4454a76dcc465958d1b096479c23f0775e49b201))
* **hiro-api:** use imported serializeCV instead of require ([165a364](https://github.com/aibtcdev/aibtc-mcp-server/commit/165a36417a7cb4aaefca43ead25f5067ca9d9f72))
* **inbox:** make send_inbox_message resilient to stale relay dedup ([#181](https://github.com/aibtcdev/aibtc-mcp-server/issues/181)) ([341613d](https://github.com/aibtcdev/aibtc-mcp-server/commit/341613d7b74cc614d628752844c54eed5e2689c9))
* make release publish resilient to already-published versions ([#91](https://github.com/aibtcdev/aibtc-mcp-server/issues/91)) ([0df6d06](https://github.com/aibtcdev/aibtc-mcp-server/commit/0df6d064b5deca1d48ac5ba3a5237dc5413be9e5))
* nonce conflicts and inbox reliability (supersedes [#155](https://github.com/aibtcdev/aibtc-mcp-server/issues/155), [#150](https://github.com/aibtcdev/aibtc-mcp-server/issues/150)) ([#168](https://github.com/aibtcdev/aibtc-mcp-server/issues/168)) ([079727d](https://github.com/aibtcdev/aibtc-mcp-server/commit/079727d09630d3aca80531efee0b2a81b7cd8d72))
* prevent wasted payments, clamp fees, add retry logic ([#126](https://github.com/aibtcdev/aibtc-mcp-server/issues/126)) ([34b8297](https://github.com/aibtcdev/aibtc-mcp-server/commit/34b82971a5fc15f35eaced35c89b444be64da1a5))
* prevent x402 payment retry loop and inscription pubkey error ([#142](https://github.com/aibtcdev/aibtc-mcp-server/issues/142)) ([6b950e0](https://github.com/aibtcdev/aibtc-mcp-server/commit/6b950e0d86a3a10903dcb30ab1a8ba4dde6eb312))
* remove double-encoding in sponsored transaction serialization ([#98](https://github.com/aibtcdev/aibtc-mcp-server/issues/98)) ([9f173b8](https://github.com/aibtcdev/aibtc-mcp-server/commit/9f173b869f44b36b667840c559b964536da3595f))
* remove serialize() double-encoding from all transaction sites ([#101](https://github.com/aibtcdev/aibtc-mcp-server/issues/101)) ([508b43b](https://github.com/aibtcdev/aibtc-mcp-server/commit/508b43baf9b22838ddd3ed8d54f353651a80c0af))
* replace @noble/hashes import with @stacks/encryption ([#62](https://github.com/aibtcdev/aibtc-mcp-server/issues/62)) ([dc6a7a4](https://github.com/aibtcdev/aibtc-mcp-server/commit/dc6a7a4e2b31976f7e8178fa8e484e28484665fd))
* **scaffold:** add startup validation and replace TODO placeholders ([14c558c](https://github.com/aibtcdev/aibtc-mcp-server/commit/14c558c1a90689d9a9985f8bdd159b39b5941008))
* **signing:** update Account field names after refactor ([#52](https://github.com/aibtcdev/aibtc-mcp-server/issues/52)) ([0a41ef3](https://github.com/aibtcdev/aibtc-mcp-server/commit/0a41ef3ad63357ff2a6140b64611426e4c43ad55))
* update explorer URL to explorer.hiro.so ([25ca9a5](https://github.com/aibtcdev/aibtc-mcp-server/commit/25ca9a59bc7d124c51c218f617d5db54da0e074a))
* update explorer URL to explorer.hiro.so ([0381526](https://github.com/aibtcdev/aibtc-mcp-server/commit/0381526819bb917a91f505c9ee280042dd5c8c8b))
* update package description for MCP registry ([#71](https://github.com/aibtcdev/aibtc-mcp-server/issues/71)) ([da24fec](https://github.com/aibtcdev/aibtc-mcp-server/commit/da24fec7695d85de79eea8a2cc35b956c3790591))
* update README description to match package metadata ([#73](https://github.com/aibtcdev/aibtc-mcp-server/issues/73)) ([b9fc23f](https://github.com/aibtcdev/aibtc-mcp-server/commit/b9fc23f968a04c442af0f4f1a5ef10268787522a))
* use backend API URL as default for Pillar MCP tools ([#30](https://github.com/aibtcdev/aibtc-mcp-server/issues/30)) ([73f0aeb](https://github.com/aibtcdev/aibtc-mcp-server/commit/73f0aebe8b85d54f7dce03ea21247eb77a45cfb1))
* **version:** add version detection to identify stale NPX cache ([#124](https://github.com/aibtcdev/aibtc-mcp-server/issues/124)) ([0820df0](https://github.com/aibtcdev/aibtc-mcp-server/commit/0820df06a2fa59deaaf6d46ecc1fd58c9c975068))
* **wallet:** add divider before mnemonic in wallet_create response ([#41](https://github.com/aibtcdev/aibtc-mcp-server/issues/41)) ([88a4c2c](https://github.com/aibtcdev/aibtc-mcp-server/commit/88a4c2ce2adde0b2f1113d4ea7be8d20b672f7e3))
* x402 registry paths and balance pre-checks ([#136](https://github.com/aibtcdev/aibtc-mcp-server/issues/136)) ([cc5339a](https://github.com/aibtcdev/aibtc-mcp-server/commit/cc5339a29e7ade3794d6fd2b826d0caf444266da))
* x402 v2 probe parsing, slow sBTC execution, and payment formatting ([#131](https://github.com/aibtcdev/aibtc-mcp-server/issues/131)) ([48ed098](https://github.com/aibtcdev/aibtc-mcp-server/commit/48ed098646828cb010a2b7eadb7f469d7fc28a5c))
* **yield-hunter:** rename feeBuffer to reserve with default 0 ([#48](https://github.com/aibtcdev/aibtc-mcp-server/issues/48)) ([6ad7c43](https://github.com/aibtcdev/aibtc-mcp-server/commit/6ad7c434aa17af660d1b348ffabf3aa9e4a5a5b6)), closes [#44](https://github.com/aibtcdev/aibtc-mcp-server/issues/44)
* **zest:** correct function signatures for all Zest operations ([9e66394](https://github.com/aibtcdev/aibtc-mcp-server/commit/9e66394666d31a6216e75024b3e05ab1a204e1b1))
* **zest:** security improvements and yield hunter documentation ([#42](https://github.com/aibtcdev/aibtc-mcp-server/issues/42)) ([5b5dbde](https://github.com/aibtcdev/aibtc-mcp-server/commit/5b5dbde4fbd8e7ddebe00d9a35902c5d2727a7e3))

## [1.26.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.25.0...v1.26.0) (2026-02-20)


### Features

* **inbox:** allow inbox message resubmission with confirmed txid as payment proof ([#183](https://github.com/aibtcdev/aibtc-mcp-server/issues/183)) ([95c913b](https://github.com/aibtcdev/aibtc-mcp-server/commit/95c913bc7d403b8c150cf370232dc5b34ecb829d))


### Bug Fixes

* add relay health monitoring and nonce gap detection ([88d1126](https://github.com/aibtcdev/aibtc-mcp-server/commit/88d1126a4046570efa5444d88c5433ef95248231)), closes [#172](https://github.com/aibtcdev/aibtc-mcp-server/issues/172) [#173](https://github.com/aibtcdev/aibtc-mcp-server/issues/173)
* Add relay health monitoring and nonce gap detection ([#174](https://github.com/aibtcdev/aibtc-mcp-server/issues/174)) ([88d1126](https://github.com/aibtcdev/aibtc-mcp-server/commit/88d1126a4046570efa5444d88c5433ef95248231))
* **inbox:** make send_inbox_message resilient to stale relay dedup ([#181](https://github.com/aibtcdev/aibtc-mcp-server/issues/181)) ([341613d](https://github.com/aibtcdev/aibtc-mcp-server/commit/341613d7b74cc614d628752844c54eed5e2689c9))

## [1.25.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.24.1...v1.25.0) (2026-02-20)


### Features

* enable Bitflow DEX tools with public API access ([#162](https://github.com/aibtcdev/aibtc-mcp-server/issues/162)) ([aec59e5](https://github.com/aibtcdev/aibtc-mcp-server/commit/aec59e5688aca8ecb8bb5c6b849552f6b706516a))
* improve Bitflow price impact UX and swap safety ([#164](https://github.com/aibtcdev/aibtc-mcp-server/issues/164)) ([0809c50](https://github.com/aibtcdev/aibtc-mcp-server/commit/0809c50e82586abee6644881b66d1a44c52e0d1c))
* **signing:** add schnorr_sign_digest and schnorr_verify_digest for Taproot multisig ([#163](https://github.com/aibtcdev/aibtc-mcp-server/issues/163)) ([089fc41](https://github.com/aibtcdev/aibtc-mcp-server/commit/089fc4159c2d742270f6f364fc5102864898dda9))

## [1.24.1](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.24.0...v1.24.1) (2026-02-19)


### Bug Fixes

* nonce conflicts and inbox reliability (supersedes [#155](https://github.com/aibtcdev/aibtc-mcp-server/issues/155), [#150](https://github.com/aibtcdev/aibtc-mcp-server/issues/150)) ([#168](https://github.com/aibtcdev/aibtc-mcp-server/issues/168)) ([079727d](https://github.com/aibtcdev/aibtc-mcp-server/commit/079727d09630d3aca80531efee0b2a81b7cd8d72))

## [1.24.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.23.0...v1.24.0) (2026-02-18)


### Features

* replace x402-stacks SDK with native relay and protocol helpers ([#158](https://github.com/aibtcdev/aibtc-mcp-server/issues/158)) ([fdd306f](https://github.com/aibtcdev/aibtc-mcp-server/commit/fdd306f3675b7c05e1608df1955346e1d3650d9e))

## [1.23.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.22.4...v1.23.0) (2026-02-17)


### Features

* add send_inbox_message tool with sponsored x402 flow ([#149](https://github.com/aibtcdev/aibtc-mcp-server/issues/149)) ([aa83803](https://github.com/aibtcdev/aibtc-mcp-server/commit/aa83803fc64d51d0060aad2012ae46dd42a75aa6))

## [1.22.4](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.22.3...v1.22.4) (2026-02-17)


### Bug Fixes

* prevent x402 payment retry loop and inscription pubkey error ([#142](https://github.com/aibtcdev/aibtc-mcp-server/issues/142)) ([6b950e0](https://github.com/aibtcdev/aibtc-mcp-server/commit/6b950e0d86a3a10903dcb30ab1a8ba4dde6eb312))

## [1.22.3](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.22.2...v1.22.3) (2026-02-16)


### Bug Fixes

* x402 registry paths and balance pre-checks ([#136](https://github.com/aibtcdev/aibtc-mcp-server/issues/136)) ([cc5339a](https://github.com/aibtcdev/aibtc-mcp-server/commit/cc5339a29e7ade3794d6fd2b826d0caf444266da))

## [1.22.2](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.22.1...v1.22.2) (2026-02-16)


### Bug Fixes

* x402 v2 probe parsing, slow sBTC execution, and payment formatting ([#131](https://github.com/aibtcdev/aibtc-mcp-server/issues/131)) ([48ed098](https://github.com/aibtcdev/aibtc-mcp-server/commit/48ed098646828cb010a2b7eadb7f469d7fc28a5c))

## [1.22.1](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.22.0...v1.22.1) (2026-02-16)


### Bug Fixes

* prevent wasted payments, clamp fees, add retry logic ([#126](https://github.com/aibtcdev/aibtc-mcp-server/issues/126)) ([34b8297](https://github.com/aibtcdev/aibtc-mcp-server/commit/34b82971a5fc15f35eaced35c89b444be64da1a5))

## [1.22.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.21.1...v1.22.0) (2026-02-16)


### Features

* add name-claim-fast for single-tx BNS V2 registration ([aae6d26](https://github.com/aibtcdev/aibtc-mcp-server/commit/aae6d26c661f84dc38cd03e7d8d1c101a3d6a01e))
* **settings:** add runtime Hiro API key management via MCP tools ([da43caf](https://github.com/aibtcdev/aibtc-mcp-server/commit/da43caff2197a11296e7d5c990504566ea9161a3)), closes [#120](https://github.com/aibtcdev/aibtc-mcp-server/issues/120)
* **x402:** add probe-before-pay flow to prevent sBTC loss ([6f10042](https://github.com/aibtcdev/aibtc-mcp-server/commit/6f10042c583f34008cfaabe042eedab17050126d)), closes [#119](https://github.com/aibtcdev/aibtc-mcp-server/issues/119)


### Bug Fixes

* **version:** add version detection to identify stale NPX cache ([#124](https://github.com/aibtcdev/aibtc-mcp-server/issues/124)) ([0820df0](https://github.com/aibtcdev/aibtc-mcp-server/commit/0820df06a2fa59deaaf6d46ecc1fd58c9c975068))

## [1.21.1](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.21.0...v1.21.1) (2026-02-14)


### Bug Fixes

* **api:** document HIRO_API_KEY and complete rate limit handling ([#116](https://github.com/aibtcdev/aibtc-mcp-server/issues/116)) ([b6dc824](https://github.com/aibtcdev/aibtc-mcp-server/commit/b6dc824179eae5a9bfc4750a266a4582b2a524da)), closes [#114](https://github.com/aibtcdev/aibtc-mcp-server/issues/114)

## [1.21.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.20.0...v1.21.0) (2026-02-13)


### Features

* **pillar:** add stacking tools, desktop install, and security improvements ([#108](https://github.com/aibtcdev/aibtc-mcp-server/issues/108)) ([01556c5](https://github.com/aibtcdev/aibtc-mcp-server/commit/01556c575d7f0cf60eeb29d1526d545873e14685))

## [1.20.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.19.2...v1.20.0) (2026-02-13)


### Features

* add post conditions to all transaction sites for PostConditionMode.Deny ([#106](https://github.com/aibtcdev/aibtc-mcp-server/issues/106)) ([404ee0f](https://github.com/aibtcdev/aibtc-mcp-server/commit/404ee0f6d17ce4fb65ed1d7bb49f753623f5ea83))

## [1.19.2](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.19.1...v1.19.2) (2026-02-12)


### Bug Fixes

* correct contract call arguments in sbtc_transfer, give_feedback, and get_reputation ([#103](https://github.com/aibtcdev/aibtc-mcp-server/issues/103)) ([b10bfa4](https://github.com/aibtcdev/aibtc-mcp-server/commit/b10bfa40b41e6412d8fef4e856dd0e910bcd0474)), closes [#102](https://github.com/aibtcdev/aibtc-mcp-server/issues/102)

## [1.19.1](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.19.0...v1.19.1) (2026-02-12)


### Bug Fixes

* remove double-encoding in sponsored transaction serialization ([#98](https://github.com/aibtcdev/aibtc-mcp-server/issues/98)) ([9f173b8](https://github.com/aibtcdev/aibtc-mcp-server/commit/9f173b869f44b36b667840c559b964536da3595f))
* remove serialize() double-encoding from all transaction sites ([#101](https://github.com/aibtcdev/aibtc-mcp-server/issues/101)) ([508b43b](https://github.com/aibtcdev/aibtc-mcp-server/commit/508b43baf9b22838ddd3ed8d54f353651a80c0af))

## [1.19.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.18.0...v1.19.0) (2026-02-12)


### Features

* add sponsored transaction support for ERC-8004 and sBTC ([#96](https://github.com/aibtcdev/aibtc-mcp-server/issues/96)) ([30f9061](https://github.com/aibtcdev/aibtc-mcp-server/commit/30f90619bf58c101c81a651761079cecacb6affa))

## [1.18.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.17.0...v1.18.0) (2026-02-12)


### Features

* upgrade x402-stacks to v2 + aibtc.com inbox support ([#93](https://github.com/aibtcdev/aibtc-mcp-server/issues/93)) ([8c15e36](https://github.com/aibtcdev/aibtc-mcp-server/commit/8c15e365c145e4f8c363f9cb43c148f7128e48cd))


### Bug Fixes

* make release publish resilient to already-published versions ([#91](https://github.com/aibtcdev/aibtc-mcp-server/issues/91)) ([0df6d06](https://github.com/aibtcdev/aibtc-mcp-server/commit/0df6d064b5deca1d48ac5ba3a5237dc5413be9e5))

## [1.17.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.16.0...v1.17.0) (2026-02-12)


### Features

* add native BTC → sBTC bridge deposit with ordinal safety ([#90](https://github.com/aibtcdev/aibtc-mcp-server/issues/90)) ([77abf0c](https://github.com/aibtcdev/aibtc-mcp-server/commit/77abf0c0c8dcacc6bc79bf98eca0fc436c290c2b))
* add wallet_rotate_password tool ([#87](https://github.com/aibtcdev/aibtc-mcp-server/issues/87)) ([eeadc7f](https://github.com/aibtcdev/aibtc-mcp-server/commit/eeadc7fbc26604dbfa03f621384bbb9e67ba7e65))


### Bug Fixes

* address PR review feedback ([#66](https://github.com/aibtcdev/aibtc-mcp-server/issues/66)) ([a54aa78](https://github.com/aibtcdev/aibtc-mcp-server/commit/a54aa7893e1036c713b47b0d2d2b7ef50256f8e8))

## [1.16.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.15.0...v1.16.0) (2026-02-12)


### Features

* add ERC-8004 identity and reputation tools ([#83](https://github.com/aibtcdev/aibtc-mcp-server/issues/83)) ([1ed5605](https://github.com/aibtcdev/aibtc-mcp-server/commit/1ed560569581f9ea2c55c6c562eade5d9609e048))

## [1.15.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.14.2...v1.15.0) (2026-02-11)


### Features

* add genesis skill reference files ([#80](https://github.com/aibtcdev/aibtc-mcp-server/issues/80)) ([824acee](https://github.com/aibtcdev/aibtc-mcp-server/commit/824acee6ddd0f61822037e0ff8c6a2168cd89678))

## [1.14.2](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.14.1...v1.14.2) (2026-02-08)


### Bug Fixes

* update README description to match package metadata ([#73](https://github.com/aibtcdev/aibtc-mcp-server/issues/73)) ([b9fc23f](https://github.com/aibtcdev/aibtc-mcp-server/commit/b9fc23f968a04c442af0f4f1a5ef10268787522a))

## [1.14.1](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.14.0...v1.14.1) (2026-02-08)


### Bug Fixes

* update package description for MCP registry ([#71](https://github.com/aibtcdev/aibtc-mcp-server/issues/71)) ([da24fec](https://github.com/aibtcdev/aibtc-mcp-server/commit/da24fec7695d85de79eea8a2cc35b956c3790591))

## [1.14.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.13.1...v1.14.0) (2026-02-08)


### Features

* add MCP registry configuration for modelcontextprotocol.io ([#68](https://github.com/aibtcdev/aibtc-mcp-server/issues/68)) ([2864b3a](https://github.com/aibtcdev/aibtc-mcp-server/commit/2864b3a07b6dc613feddfc77116c6795f70aa715))

## [1.13.1](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.13.0...v1.13.1) (2026-02-03)


### Bug Fixes

* replace @noble/hashes import with @stacks/encryption ([#62](https://github.com/aibtcdev/aibtc-mcp-server/issues/62)) ([dc6a7a4](https://github.com/aibtcdev/aibtc-mcp-server/commit/dc6a7a4e2b31976f7e8178fa8e484e28484665fd))

## [1.13.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.12.0...v1.13.0) (2026-02-03)


### Features

* add micro-ordinals support with ordinal-aware UTXO management ([#58](https://github.com/aibtcdev/aibtc-mcp-server/issues/58)) ([d2e274a](https://github.com/aibtcdev/aibtc-mcp-server/commit/d2e274a270291b34727cea61511326cedad921fb))


### Bug Fixes

* **ci:** integrate publish workflow into release-please ([#60](https://github.com/aibtcdev/aibtc-mcp-server/issues/60)) ([abdc2fd](https://github.com/aibtcdev/aibtc-mcp-server/commit/abdc2fdd36c410ea0f6c1a1cd0570d797484b36e))

## [1.12.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.11.0...v1.12.0) (2026-02-02)


### Features

* add custom fee support for Stacks transactions ([#54](https://github.com/aibtcdev/aibtc-mcp-server/issues/54)) ([b6f16d8](https://github.com/aibtcdev/aibtc-mcp-server/commit/b6f16d8ef43a44326279d7d50f6afc8830e323ad))
* complete fee support and fix ClawHub CI ([#57](https://github.com/aibtcdev/aibtc-mcp-server/issues/57)) ([da6471b](https://github.com/aibtcdev/aibtc-mcp-server/commit/da6471b69b7865f58a7a05000f0447f79f4dadfb)), closes [#53](https://github.com/aibtcdev/aibtc-mcp-server/issues/53)

## [1.11.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.10.0...v1.11.0) (2026-02-02)


### Features

* add message signing tools (SIP-018, SIWS, BIP-137) ([#49](https://github.com/aibtcdev/aibtc-mcp-server/issues/49)) ([d39ace7](https://github.com/aibtcdev/aibtc-mcp-server/commit/d39ace799bd011a4143a5675c2bb1cc19abf9d89))


### Bug Fixes

* **signing:** update Account field names after refactor ([#52](https://github.com/aibtcdev/aibtc-mcp-server/issues/52)) ([0a41ef3](https://github.com/aibtcdev/aibtc-mcp-server/commit/0a41ef3ad63357ff2a6140b64611426e4c43ad55))
* **yield-hunter:** rename feeBuffer to reserve with default 0 ([#48](https://github.com/aibtcdev/aibtc-mcp-server/issues/48)) ([6ad7c43](https://github.com/aibtcdev/aibtc-mcp-server/commit/6ad7c434aa17af660d1b348ffabf3aa9e4a5a5b6)), closes [#44](https://github.com/aibtcdev/aibtc-mcp-server/issues/44)
* **zest:** security improvements and yield hunter documentation ([#42](https://github.com/aibtcdev/aibtc-mcp-server/issues/42)) ([5b5dbde](https://github.com/aibtcdev/aibtc-mcp-server/commit/5b5dbde4fbd8e7ddebe00d9a35902c5d2727a7e3))

## [1.10.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.9.1...v1.10.0) (2026-01-31)


### Features

* add BNS registration tools with V1/V2 auto-detection ([#45](https://github.com/aibtcdev/aibtc-mcp-server/issues/45)) ([df90072](https://github.com/aibtcdev/aibtc-mcp-server/commit/df90072bc5bb15144be33dfefc40c0ac97b3fa03))

## [1.9.1](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.9.0...v1.9.1) (2026-01-31)


### Bug Fixes

* **ci:** pass token explicitly to clawhub CLI ([#39](https://github.com/aibtcdev/aibtc-mcp-server/issues/39)) ([8e2153e](https://github.com/aibtcdev/aibtc-mcp-server/commit/8e2153e08f8b464ace9440f711cf2ecc086233ed))
* **wallet:** add divider before mnemonic in wallet_create response ([#41](https://github.com/aibtcdev/aibtc-mcp-server/issues/41)) ([88a4c2c](https://github.com/aibtcdev/aibtc-mcp-server/commit/88a4c2ce2adde0b2f1113d4ea7be8d20b672f7e3))

## [1.9.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.8.0...v1.9.0) (2026-01-31)


### Features

* Bitcoin-first wallet experience ([#36](https://github.com/aibtcdev/aibtc-mcp-server/issues/36)) ([528ff08](https://github.com/aibtcdev/aibtc-mcp-server/commit/528ff0818a9b7c185d34f10efb62ce34032a47ca))

## [1.8.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/v1.7.0...v1.8.0) (2026-01-31)


### Features

* add aibtc-bitcoin-wallet Agent Skill with ClawHub publishing ([#33](https://github.com/aibtcdev/aibtc-mcp-server/issues/33)) ([c2993ff](https://github.com/aibtcdev/aibtc-mcp-server/commit/c2993ff10d3a33e2575ed235a5226eb2275123cc))
