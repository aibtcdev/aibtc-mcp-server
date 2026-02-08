# Changelog

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
