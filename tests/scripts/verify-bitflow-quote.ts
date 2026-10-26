import { BitflowService } from "../../src/services/bitflow.service.js";
import { BITFLOW_READONLY_HOST } from "../../src/config/contracts.js";

(async () => {
  console.log("readonly host in use:", BITFLOW_READONLY_HOST);
  const svc = new BitflowService("mainnet");

  const pairs: Array<[string, string, number]> = [
    ["token-stx", "token-sbtc", 10],
    ["token-sbtc", "token-stx", 0.001],
    ["token-stx", "token-ststx", 1],
    ["token-stx", "token-aeusdc", 10],
  ];

  for (const [x, y, amount] of pairs) {
    const t0 = Date.now();
    try {
      const q = await svc.getSwapQuote(x, y, amount);
      const ms = Date.now() - t0;
      console.log(
        `OK  ${x} -> ${y} (in=${amount}) → out=${q.expectedAmountOut} route=[${q.route.join(",")}] impact=${q.priceImpact?.combinedImpactPct ?? "n/a"} ${ms}ms`
      );
    } catch (e: any) {
      const ms = Date.now() - t0;
      console.log(`FAIL ${x} -> ${y} (in=${amount}) → ${e.message} ${ms}ms`);
    }
  }
})();
