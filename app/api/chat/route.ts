import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"
import { SimulationReport, ChatMessage } from "@/lib/types"
import { validateRequest } from "@/lib/auth"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  const auth = validateRequest(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const {
      message,
      history,
      report,
    }: {
      message: string
      history: ChatMessage[]
      report: SimulationReport
    } = await req.json()

    const systemPrompt = `You are Fiscal, a financial scenario analyst. The user just ran a simulation and you have full context of the results.

Their decision: "${report.decision.raw}"
Assets analyzed: ${report.decision.assets.join(", ")}
Amount: ${report.decision.amount ? `$${report.decision.amount}` : "unspecified"}
Time horizon: ${report.decision.horizon}
Domain: ${report.decision.domain}
Risk score: ${report.riskScore}/10

Scenario results:
${report.scenarios.map((s) => `- ${s.label}: ${s.verdict}`).join("\n")}

Your recommendation: ${report.recommendation}
Reasoning: ${report.reasoning}

Answer the user's follow-up questions directly and specifically based on this context.
Be concise. Be direct. No generic financial disclaimers.`

    const messages = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: message },
    ]

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    })

    const reply = response.choices[0].message.content || ""
    return NextResponse.json({ reply })
  } catch (err: any) {
    console.error("Chat error:", err)
    return NextResponse.json({ error: err.message || "Chat failed" }, { status: 500 })
  }
}
