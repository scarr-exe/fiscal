import { createMcpHandler } from "mcp-handler"
import { z } from "zod"
import { NextRequest, NextResponse } from "next/server"
import { parseDecision } from "@/lib/parser"
import { runSimulation } from "@/lib/simulator"
import { validateRequest } from "@/lib/auth"

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "simulate_financial_decision",
      "Takes a financial decision described in plain English (crypto or traditional " +
        "finance) and returns a structured report: 5 scenarios (bull, bear, historical " +
        "base, volatility spike, macro/sideways pressure), a risk score from 1-10, and a " +
        "direct recommendation. Pulls live price data from CoinGecko (crypto) or Alpha " +
        "Vantage (stocks).",
      {
        decision: z
          .string()
          .min(10)
          .describe(
            "The financial decision in plain English, e.g. 'Should I put $5k into ETH or hold USDC for 3 months?'"
          ),
      },
      async ({ decision }) => {
        const parsed = await parseDecision(decision)

        if (!parsed.assets || parsed.assets.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "Could not identify any assets in this decision. Mention specific assets like ETH, BTC, or AAPL.",
              },
            ],
            isError: true,
          }
        }

        const report = await runSimulation(parsed)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(report, null, 2),
            },
          ],
        }
      }
    )
  },
  {
    capabilities: {
      tools: {},
    },
  },
  {
    verboseLogs: false,
    maxDuration: 60,
  }
)

// Wrap with the same auth/rate-limit gate used on /api/simulate and /api/chat
async function guardedHandler(req: NextRequest) {
  const auth = validateRequest(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  return handler(req)
}

export { guardedHandler as GET, guardedHandler as POST, guardedHandler as DELETE }
