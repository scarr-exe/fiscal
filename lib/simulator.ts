import Groq from "groq-sdk"
import {
  ParsedDecision,
  Scenario,
  SimulationReport,
  AssetOutcome,
  ScenarioType,
} from "./types"
import { fetchAssetHistory, OHLCVData, isStablecoin } from "./fetcher"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// Get actual historical return from price data
function getHistoricalReturn(history: OHLCVData[]): number {
  const startPrice = history[0].price
  const endPrice = history[history.length - 1].price
  return ((endPrice - startPrice) / startPrice) * 100
}

function calcOutcomeFromPct(
  pct: number,
  amount: number,
  asset: string,
  history: OHLCVData[]
): AssetOutcome {
  const returnAbs = amount * (pct / 100)
  return {
    asset,
    startValue: amount,
    endValue: parseFloat((amount + returnAbs).toFixed(2)),
    returnPct: parseFloat(pct.toFixed(2)),
    returnAbs: parseFloat(returnAbs.toFixed(2)),
  }
}

// Scenario return % per asset type and time horizon
function getScenarioReturns(
  historicalPct: number,
  domain: string,
  horizonDays: number,
  sym: string
): Record<ScenarioType, number> {
  const isStable = isStablecoin(sym)
  if (isStable) {
    // Stablecoins: always near 0 in all scenarios
    return {
      historical_base: 0.05,
      bull: 0.08,
      bear: -0.02,
      stress_volatility: -0.1,
      stress_macro: 0.05,
    }
  }

  const isCrypto = domain !== "tradfi"

  // Bull: market-specific upside for the horizon
  const bullReturn = isCrypto
    ? horizonDays <= 30 ? 15 : horizonDays <= 90 ? 35 : 65
    : horizonDays <= 30 ? 5 : horizonDays <= 90 ? 12 : 22

  // Bear: realistic downside
  const bearReturn = isCrypto
    ? horizonDays <= 30 ? -18 : horizonDays <= 90 ? -35 : -55
    : horizonDays <= 30 ? -8 : horizonDays <= 90 ? -15 : -25

  // Stress: sharper downside
  const stressVolatility = isCrypto ? -45 : -30
  const stressMacro = isCrypto ? -8 : -12

  return {
    historical_base: historicalPct,
    bull: bullReturn,
    bear: bearReturn,
    stress_volatility: stressVolatility,
    stress_macro: stressMacro,
  }
}

async function buildScenarios(
  decision: ParsedDecision,
  historicalData: Record<string, OHLCVData[]>,
  syntheticAssets: string[]
): Promise<Scenario[]> {
  const amount = decision.amount ?? 1000
  const assets = decision.assets.filter((a) => historicalData[a])

  const scenarioDefs: {
    type: ScenarioType
    label: string
    description: string
  }[] = [
    {
      type: "historical_base",
      label: "Historical Base",
      description: `Actual price movement over the last ${decision.horizon}`,
    },
    {
      type: "bull",
      label: "Bull Case",
      description: "Favorable market conditions — based on typical upside for this asset class and horizon",
    },
    {
      type: "bear",
      label: "Bear Case",
      description: "Adverse market conditions — based on typical downside for this asset class and horizon",
    },
    {
      type: "stress_volatility",
      label: decision.domain === "tradfi" ? "Recession Scenario" : "Volatility Spike",
      description:
        decision.domain === "tradfi"
          ? "Broad market downturn with accelerated selling pressure"
          : "Sudden high-volatility event — simulates a 30-50% drawdown",
    },
    {
      type: "stress_macro",
      label: decision.domain === "tradfi" ? "Rate Hike Scenario" : "Sideways / Macro Pressure",
      description:
        decision.domain === "tradfi"
          ? "Aggressive interest rate hikes suppress asset prices"
          : "Extended sideways action with macro headwinds",
    },
  ]

  return scenarioDefs.map((def) => {
    const outcomes: AssetOutcome[] = []

    for (const asset of assets) {
      const history = historicalData[asset]
      const historicalPct = getHistoricalReturn(history)
      const returns = getScenarioReturns(
        historicalPct,
        decision.domain,
        decision.horizonDays,
        asset
      )
      const pct = returns[def.type]
      const perAsset = amount / assets.length
      outcomes.push(calcOutcomeFromPct(pct, perAsset, asset, history))
    }

    const totalReturn = outcomes.reduce((sum, o) => sum + o.returnAbs, 0)
    const absReturn = Math.abs(totalReturn)
    const verdict =
      absReturn < 0.5
        ? "$0 net change"
        : totalReturn > 0
        ? `+$${absReturn.toFixed(0)} net gain`
        : `-$${absReturn.toFixed(0)} net loss`

    return {
      type: def.type,
      label: def.label,
      description:
        syntheticAssets.length > 0
          ? def.description + ` (estimated — live data unavailable for: ${syntheticAssets.join(", ")})`
          : def.description,
      outcomes,
      verdict,
    }
  })
}

async function generateRecommendation(
  decision: ParsedDecision,
  scenarios: Scenario[]
): Promise<{ riskScore: number; recommendation: string; reasoning: string }> {
  const scenarioSummary = scenarios
    .map(
      (s) =>
        `${s.label}: ${s.verdict} | ${s.outcomes.map((o) => `${o.asset} ${o.returnPct >= 0 ? "+" : ""}${o.returnPct}%`).join(", ")}`
    )
    .join("\n")

  const prompt = `You are a financial analyst. Based on this scenario analysis, provide a risk score and recommendation.

Decision: "${decision.raw}"
Assets: ${decision.assets.join(", ")}
Amount: ${decision.amount ? `$${decision.amount}` : "unspecified"}
Horizon: ${decision.horizon}
Domain: ${decision.domain}

Scenario Results:
${scenarioSummary}

Return ONLY valid JSON, no markdown:
{
  "riskScore": number,
  "recommendation": "string",
  "reasoning": "string"
}

Rules:
- riskScore: 1-10 based on downside exposure across scenarios
- recommendation: 1-2 sentences, direct, specific to the assets and amounts mentioned
- reasoning: 2-3 sentences citing specific scenario numbers`

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  })

  const text = response.choices[0].message.content || "{}"
  const clean = text.replace(/```json|```/g, "").trim()
  return JSON.parse(clean)
}

export async function runSimulation(
  decision: ParsedDecision
): Promise<SimulationReport> {
  const historicalData: Record<string, OHLCVData[]> = {}
  const syntheticAssets: string[] = []

  await Promise.all(
    decision.assets.map(async (asset) => {
      const { data, synthetic } = await fetchAssetHistory(asset, decision.horizonDays)
      historicalData[asset] = data
      if (synthetic) syntheticAssets.push(asset)
    })
  )

  const scenarios = await buildScenarios(decision, historicalData, syntheticAssets)
  const { riskScore, recommendation, reasoning } = await generateRecommendation(
    decision,
    scenarios
  )

  return {
    decision,
    scenarios,
    riskScore,
    recommendation,
    reasoning,
    generatedAt: new Date().toISOString(),
  }
}
