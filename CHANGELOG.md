# Changelog

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
