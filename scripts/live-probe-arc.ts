import { probeEndpoint } from "../src/services/x402.service.ts";

async function main() {
  const url = "https://arc0btc.com/api/reports/arc-field-guide";
  console.log("PROBE", url, "asset=sBTC");
  try {
    const result = await probeEndpoint({ method: "GET", url, asset: "sBTC" });
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("ERROR", e);
    process.exit(1);
  }
}
main();
