import { NextRequest, NextResponse } from "next/server"
import { parseDecision } from "@/lib/parser"
import { runSimulation } from "@/lib/simulator"
import { validateRequest } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const auth = validateRequest(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const { input } = await req.json()

    if (!input || typeof input !== "string") {
      return NextResponse.json({ error: "input is required" }, { status: 400 })
    }

    if (input.trim().length < 10) {
      return NextResponse.json(
        { error: "Please describe your financial decision in more detail" },
        { status: 400 }
      )
    }

    const decision = await parseDecision(input)

    if (!decision.assets || decision.assets.length === 0) {
      return NextResponse.json(
        { error: "Could not identify any assets in your decision. Try mentioning specific assets like ETH, BTC, or AAPL." },
        { status: 400 }
      )
    }

    const report = await runSimulation(decision)

    return NextResponse.json(report)
  } catch (err: any) {
    console.error("Simulate error:", err)
    return NextResponse.json(
      { error: err.message || "Simulation failed" },
      { status: 500 }
    )
  }
}
