import { createConfig, http, injected } from "wagmi";
import { arbitrumSepolia, hardhat } from "wagmi/chains";

export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia, hardhat],
  connectors: [injected({ shimDisconnect: true })],
  ssr: true,
  transports: {
    [arbitrumSepolia.id]: http("https://sepolia-rollup.arbitrum.io/rpc"),
    [hardhat.id]: http("http://127.0.0.1:8545")
  }
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
