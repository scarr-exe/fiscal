import Groq from "groq-sdk"
import { ParsedDecision } from "./types"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SYSTEM_PROMPT = `You are a financial decision parser. Extract structured data from a user's plain English financial question or decision.

Return ONLY valid JSON with this exact shape:
{
  "assets": ["string"],         // list of assets mentioned (e.g. "ETH", "BTC", "AAPL", "S&P 500", "USDC")
  "amount": number | null,      // dollar amount if mentioned, else null
  "currency": "string",         // currency of the amount (default "USD")
  "horizon": "string",          // human-readable time horizon (e.g. "3 months", "1 year")
  "horizonDays": number,        // horizon converted to days (e.g. 90, 365)
  "riskContext": "low" | "moderate" | "high", // inferred risk tolerance
  "domain": "crypto" | "tradfi" | "mixed",    // inferred from assets
  "comparison": boolean         // true if user is comparing two or more options
}

Rules:
- If no amount is mentioned, set amount to null
- If no horizon is mentioned, default to 90 days ("3 months")
- Infer domain from asset types: crypto = BTC/ETH/DeFi tokens, tradfi = stocks/bonds/indices, mixed = both
- Do not include any text outside the JSON object`

export async function parseDecision(raw: string): Promise<ParsedDecision> {
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.1,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: raw },
    ],
  })

  const text = response.choices[0].message.content || "{}"

  try {
    const clean = text.replace(/```json|```/g, "").trim()
    const parsed = JSON.parse(clean)
    return { raw, ...parsed } as ParsedDecision
  } catch {
    throw new Error("Failed to parse decision: " + text)
  }
}
