import { makeContractDeploy, type SignedContractDeployOptions } from "@stacks/transactions";

export function makeContractDeployForEpoch(
  options: Omit<SignedContractDeployOptions, "clarityVersion">
): ReturnType<typeof makeContractDeploy> {
  return makeContractDeploy({ ...options, clarityVersion: undefined });
}
