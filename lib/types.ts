export type Domain = "crypto" | "tradfi" | "mixed"

export type RiskLevel = "low" | "moderate" | "high"

export interface ParsedDecision {
  raw: string
  assets: string[]
  amount: number | null
  currency: string
  horizon: string
  horizonDays: number
  riskContext: RiskLevel
  domain: Domain
  comparison: boolean // true if user is comparing two options
}

export type ScenarioType =
  | "bull"
  | "bear"
  | "historical_base"
  | "stress_volatility"
  | "stress_macro"

export interface Scenario {
  type: ScenarioType
  label: string
  description: string
  outcomes: AssetOutcome[]
  verdict: string
}

export interface AssetOutcome {
  asset: string
  startValue: number
  endValue: number
  returnPct: number
  returnAbs: number
}

export interface SimulationReport {
  decision: ParsedDecision
  scenarios: Scenario[]
  riskScore: number // 1-10
  recommendation: string
  reasoning: string
  generatedAt: string
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}
