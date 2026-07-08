import axios from "axios"

const COINGECKO_BASE = "https://api.coingecko.com/api/v3"
const ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query"

const COINGECKO_ID_MAP: Record<string, string> = {
  BTC: "bitcoin",
  BITCOIN: "bitcoin",
  ETH: "ethereum",
  ETHEREUM: "ethereum",
  SOL: "solana",
  SOLANA: "solana",
  BNB: "binancecoin",
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "dai",
  MATIC: "matic-network",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  UNI: "uniswap",
  AAVE: "aave",
  OKB: "okb",
  XRP: "ripple",
  ADA: "cardano",
  DOT: "polkadot",
  DOGE: "dogecoin",
}

// Known volatility profiles for synthetic fallback (annualized daily %)
const VOLATILITY_PROFILE: Record<string, number> = {
  BTC: 0.035,
  ETH: 0.042,
  SOL: 0.055,
  BNB: 0.038,
  AVAX: 0.060,
  LINK: 0.050,
  UNI: 0.055,
  AAVE: 0.052,
  MATIC: 0.058,
  OKB: 0.040,
  XRP: 0.045,
  ADA: 0.050,
  DOT: 0.052,
  DOGE: 0.065,
  DEFAULT_CRYPTO: 0.045,
  DEFAULT_STOCK: 0.018,
}

// Approximate current prices for synthetic baseline
const APPROX_PRICES: Record<string, number> = {
  BTC: 97000,
  ETH: 3400,
  SOL: 175,
  BNB: 620,
  AVAX: 38,
  LINK: 18,
  UNI: 12,
  AAVE: 280,
  MATIC: 0.95,
  OKB: 52,
  XRP: 0.62,
  ADA: 0.48,
  DOT: 8.5,
  DOGE: 0.18,
}

export interface OHLCVData {
  timestamp: number
  price: number
}

const GENERIC_STABLECOIN_TERMS = ["STABLECOIN", "STABLE COIN", "STABLECOINS", "STABLE"]

export function isStablecoin(symbol: string): boolean {
  const upper = symbol.toUpperCase()
  return (
    ["USDC", "USDT", "DAI", "BUSD", "TUSD"].includes(upper) ||
    GENERIC_STABLECOIN_TERMS.includes(upper)
  )
}

export function isCryptoAsset(symbol: string): boolean {
  return symbol.toUpperCase() in COINGECKO_ID_MAP
}

export function generateStablecoinHistory(days: number): OHLCVData[] {
  const now = Date.now()
  return Array.from({ length: Math.max(days, 2) }, (_, i) => ({
    timestamp: now - (days - i) * 86400000,
    price: 1,
  }))
}

// Synthetic price history using geometric Brownian motion
export function generateSyntheticHistory(
  symbol: string,
  days: number,
  isCrypto: boolean
): OHLCVData[] {
  const key = symbol.toUpperCase()
  const basePrice = APPROX_PRICES[key] ?? (isCrypto ? 100 : 150)
  const volatility = VOLATILITY_PROFILE[key] ?? (isCrypto ? VOLATILITY_PROFILE.DEFAULT_CRYPTO : VOLATILITY_PROFILE.DEFAULT_STOCK)

  const now = Date.now()
  const points = Math.max(days, 2)
  const history: OHLCVData[] = []
  let price = basePrice

  // Walk backwards from today so historical direction is realistic
  for (let i = 0; i < points; i++) {
    const rand = (Math.random() - 0.5) * 2
    price = price * (1 + volatility * rand)
    price = Math.max(price, 0.001)
    history.unshift({
      timestamp: now - (points - 1 - i) * 86400000,
      price,
    })
  }

  return history
}

export async function fetchCryptoPriceHistory(
  symbol: string,
  days: number
): Promise<OHLCVData[]> {
  const id = COINGECKO_ID_MAP[symbol.toUpperCase()]
  if (!id) throw new Error(`Unknown crypto asset: ${symbol}`)

  const headers: Record<string, string> = {
    Accept: "application/json",
  }

  // CoinGecko Pro/Demo key goes in the header
  if (process.env.COINGECKO_API_KEY) {
    headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY
  }

  const res = await axios.get(`${COINGECKO_BASE}/coins/${id}/market_chart`, {
    headers,
    params: {
      vs_currency: "usd",
      days: String(Math.min(days, 365)),
      interval: days <= 30 ? "daily" : "daily",
    },
    timeout: 10000,
  })

  const prices = res.data.prices
  if (!prices || prices.length === 0) throw new Error(`No price data returned for ${symbol}`)

  return prices.map(([timestamp, price]: [number, number]) => ({
    timestamp,
    price,
  }))
}

export async function fetchStockPriceHistory(
  symbol: string,
  days: number
): Promise<OHLCVData[]> {
  const res = await axios.get(ALPHA_VANTAGE_BASE, {
    params: {
      function: "TIME_SERIES_DAILY",
      symbol: symbol.toUpperCase(),
      outputsize: days > 100 ? "full" : "compact",
      apikey: process.env.ALPHA_VANTAGE_API_KEY,
    },
    timeout: 10000,
  })

  const series = res.data["Time Series (Daily)"]
  if (!series) throw new Error(`No data for stock: ${symbol}`)

  const entries = Object.entries(series)
    .slice(0, days)
    .map(([date, values]: [string, any]) => ({
      timestamp: new Date(date).getTime(),
      price: parseFloat(values["4. close"]),
    }))
    .reverse()

  if (entries.length === 0) throw new Error(`Empty series for ${symbol}`)
  return entries
}

// Main entry — always returns data, falls back to synthetic if API fails
export async function fetchAssetHistory(
  symbol: string,
  days: number
): Promise<{ data: OHLCVData[]; synthetic: boolean }> {
  const sym = symbol.toUpperCase()

  if (isStablecoin(sym)) {
    return { data: generateStablecoinHistory(days), synthetic: false }
  }

  const crypto = isCryptoAsset(sym)

  try {
    const data = crypto
      ? await fetchCryptoPriceHistory(sym, days)
      : await fetchStockPriceHistory(sym, days)
    return { data, synthetic: false }
  } catch (err) {
    console.warn(`[Fiscal] Live fetch failed for ${sym}, using synthetic data:`, err)
    return { data: generateSyntheticHistory(sym, days, crypto), synthetic: true }
  }
}
