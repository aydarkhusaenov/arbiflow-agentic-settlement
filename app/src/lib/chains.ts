import { defineChain } from "viem";

export const arbitrumSepolia = defineChain({
  id: 421614,
  name: "Arbitrum Sepolia",
  nativeCurrency: { name: "Arbitrum Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://sepolia-rollup.arbitrum.io/rpc"] }
  },
  blockExplorers: {
    default: { name: "Arbiscan Sepolia", url: "https://sepolia.arbiscan.io" }
  },
  testnet: true
});

export const hardhat = defineChain({
  id: 31337,
  name: "Hardhat",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] }
  },
  testnet: true
});

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.chain.robinhood.com"] }
  },
  blockExplorers: {
    default: { name: "Robinhood Explorer", url: "https://explorer.testnet.chain.robinhood.com" }
  },
  testnet: true
});

export const supportedChains = [arbitrumSepolia, robinhoodTestnet, hardhat] as const;

export function targetLiveChain() {
  return process.env.NEXT_PUBLIC_CHAIN_ID === String(robinhoodTestnet.id) ? robinhoodTestnet : arbitrumSepolia;
}

export function explorerBaseForChain(chainId?: number) {
  if (chainId === arbitrumSepolia.id) return "https://sepolia.arbiscan.io";
  if (chainId === robinhoodTestnet.id) return "https://explorer.testnet.chain.robinhood.com";
  return "";
}
