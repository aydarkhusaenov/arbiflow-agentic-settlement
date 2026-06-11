import { formatUnits, isAddress, zeroAddress } from "viem";

export const ARBITRUM_SEPOLIA_USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as const;
export const ROBINHOOD_TSLA_ADDRESS = "0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E" as const;
export const ROBINHOOD_AMZN_ADDRESS = "0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02" as const;

export function getUsdcAddress() {
  const configured = process.env.NEXT_PUBLIC_USDC_ADDRESS;
  return (configured && isAddress(configured) ? configured : ARBITRUM_SEPOLIA_USDC_ADDRESS) as `0x${string}`;
}

export function isNativeToken(token: `0x${string}`) {
  return token.toLowerCase() === zeroAddress;
}

export function isUsdcToken(token: `0x${string}`) {
  return token.toLowerCase() === getUsdcAddress().toLowerCase();
}

export function stockTokenSymbol(token: `0x${string}`) {
  const lower = token.toLowerCase();
  if (lower === ROBINHOOD_TSLA_ADDRESS.toLowerCase()) return "TSLA";
  if (lower === ROBINHOOD_AMZN_ADDRESS.toLowerCase()) return "AMZN";
  return "";
}

export function tokenMeta(token: `0x${string}`) {
  if (isNativeToken(token)) return { symbol: "ETH", decimals: 18 };
  if (isUsdcToken(token)) return { symbol: "USDC", decimals: 6 };
  const stockSymbol = stockTokenSymbol(token);
  if (stockSymbol) return { symbol: stockSymbol, decimals: 18 };
  return { symbol: "TOKEN", decimals: 18 };
}

export function formatTokenAmount(value: bigint, token: `0x${string}`) {
  const meta = tokenMeta(token);
  return `${trimDecimal(formatUnits(value, meta.decimals))} ${meta.symbol}`;
}

function trimDecimal(value: string) {
  return value.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}
