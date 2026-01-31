# Changelog

## [2.7.0](https://github.com/aibtcdev/aibtc-mcp-server/compare/v2.6.3...v2.7.0) (2026-01-31)


### Features

* add aibtc-bitcoin-wallet Agent Skill with ClawHub publishing ([#33](https://github.com/aibtcdev/aibtc-mcp-server/issues/33)) ([c2993ff](https://github.com/aibtcdev/aibtc-mcp-server/commit/c2993ff10d3a33e2575ed235a5226eb2275123cc))
* add yield hunter tools for DeFi analytics ([f3bc00d](https://github.com/aibtcdev/aibtc-mcp-server/commit/f3bc00d815f2a830dd516e8b85d53eb6ad25ea85))
* **bitcoin:** add deriveBitcoinKeyPair for transaction signing ([7f67c08](https://github.com/aibtcdev/aibtc-mcp-server/commit/7f67c08ed84e0a3860dc0504372044167b9ec35d))
* **btc:** implement Bitcoin transaction building and signing ([a6f6e3f](https://github.com/aibtcdev/aibtc-mcp-server/commit/a6f6e3ffe527f9001f26266951993d50dd3426a4))
* **config:** add CAIP-2 chain identifiers for Stacks and Bitcoin ([0b40345](https://github.com/aibtcdev/aibtc-mcp-server/commit/0b403455041e6a599703e558c3cf7a856b641271))
* default to mainnet, use --testnet flag for testnet ([9e24d96](https://github.com/aibtcdev/aibtc-mcp-server/commit/9e24d9646fab9ce21c418005581786611be43d3d))
* default to mainnet, use --testnet flag for testnet ([0433ee1](https://github.com/aibtcdev/aibtc-mcp-server/commit/0433ee1f57a3bdfb32273c70fbb7a1719cb0ccc6))
* improve scaffold tools UX and validation ([3a7ec77](https://github.com/aibtcdev/aibtc-mcp-server/commit/3a7ec779ec9520b7c84aa7f1b1ec805efddd29f0))
* **mempool:** add mempool.space API client for UTXO and fees ([c507f2b](https://github.com/aibtcdev/aibtc-mcp-server/commit/c507f2b12b49d4f9e30c10896534685b0da7e627))
* Pillar direct tools (agent-signed, no browser handoff) ([#32](https://github.com/aibtcdev/aibtc-mcp-server/issues/32)) ([867a2b9](https://github.com/aibtcdev/aibtc-mcp-server/commit/867a2b945a7258963189c880a759ff09c50c9292))
* Pillar MCP integration (13 tools) ([#24](https://github.com/aibtcdev/aibtc-mcp-server/issues/24)) ([b5cd9c2](https://github.com/aibtcdev/aibtc-mcp-server/commit/b5cd9c267c75b9d27dad381e9d42f1c76ced815a))
* production readiness - security, quality, and tests ([#20](https://github.com/aibtcdev/aibtc-mcp-server/issues/20)) ([da7761d](https://github.com/aibtcdev/aibtc-mcp-server/commit/da7761df26545b4c59d12ba94ac0c2516ace2902))
* **tools:** add Bitcoin L1 read-only tools (balance, fees, UTXOs) ([3f125ea](https://github.com/aibtcdev/aibtc-mcp-server/commit/3f125eabd903bf5d11ff77a5ddaf0d6506355448))
* **tools:** add transfer_btc tool for Bitcoin L1 transfers ([76d311d](https://github.com/aibtcdev/aibtc-mcp-server/commit/76d311df7da54bb542be394718a28c1d18fbf9c5))
* **tools:** expose Bitcoin address in get_wallet_info ([0c8d9e9](https://github.com/aibtcdev/aibtc-mcp-server/commit/0c8d9e9227fd7d9173a4b2907d975ad3288977f8))
* **tools:** expose Bitcoin address in wallet_status ([d4fd3db](https://github.com/aibtcdev/aibtc-mcp-server/commit/d4fd3dbbc4d0e7e91e8870a1ba9092eb2a001865))
* update pillar_dca_status for multi-schedule support ([#27](https://github.com/aibtcdev/aibtc-mcp-server/issues/27)) ([5977b09](https://github.com/aibtcdev/aibtc-mcp-server/commit/5977b096b345cb697f8c9541c14171350449934f))
* update scaffold service with production x402 patterns ([59877af](https://github.com/aibtcdev/aibtc-mcp-server/commit/59877afdb7b9542cf9f1b50ecccd2fb929bd23c7))
* **utils:** export bitcoin utilities ([c9431e2](https://github.com/aibtcdev/aibtc-mcp-server/commit/c9431e2a6754e15238373cc8c34ed1b6e887f4e6))
* **wallet:** add Bitcoin address derivation with BIP84 ([4591f29](https://github.com/aibtcdev/aibtc-mcp-server/commit/4591f29a688034fb782eda5fd0ca338fbc28aacb))
* **wallet:** add btcAddress field to Account and WalletMetadata interfaces ([e9ba504](https://github.com/aibtcdev/aibtc-mcp-server/commit/e9ba504531dee6368b56404f624f7a0ecbabf8e5))
* **wallet:** derive and store Bitcoin private key on unlock ([c921409](https://github.com/aibtcdev/aibtc-mcp-server/commit/c9214097ffc12353ad9fcf8d4c4df89e6d34301b))
* **wallet:** derive Bitcoin addresses in wallet lifecycle ([b05acf3](https://github.com/aibtcdev/aibtc-mcp-server/commit/b05acf30f4c382875302741d37bb5e8bec5a56eb))


### Bug Fixes

* correct sBTC and USDCx contract addresses ([#23](https://github.com/aibtcdev/aibtc-mcp-server/issues/23)) ([5932da4](https://github.com/aibtcdev/aibtc-mcp-server/commit/5932da41642c4e17807f1bf29d3f7519f6cab95e))
* use backend API URL as default for Pillar MCP tools ([#30](https://github.com/aibtcdev/aibtc-mcp-server/issues/30)) ([73f0aeb](https://github.com/aibtcdev/aibtc-mcp-server/commit/73f0aebe8b85d54f7dce03ea21247eb77a45cfb1))
