"use client"

import { useState, useRef, useEffect } from "react"
import { SimulationReport, ChatMessage, Scenario } from "@/lib/types"

interface Props {
  report: SimulationReport
  onReset: () => void
}

function RiskBar({ score }: { score: number }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setWidth(score * 10), 300)
    return () => clearTimeout(t)
  }, [score])

  const color = score <= 3 ? "var(--green)" : score <= 6 ? "var(--yellow)" : "var(--red)"
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
      <div style={{
        flex: 1,
        height: "2px",
        background: "var(--border)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute",
          left: 0, top: 0,
          height: "100%",
          width: `${width}%`,
          background: color,
          transition: "width 1s cubic-bezier(0.16,1,0.3,1)",
        }} />
      </div>
      <span style={{ color, fontWeight: "700", fontSize: "14px", minWidth: "36px" }}>
        {score}/10
      </span>
    </div>
  )
}

function ScenarioRow({ scenario, index, amount }: { scenario: Scenario; index: number; amount: number }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 200 + index * 100)
    return () => clearTimeout(t)
  }, [index])

  const totalReturn = scenario.outcomes.reduce((sum, o) => sum + o.returnAbs, 0)
  const isPositive = totalReturn >= 0.5

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "190px 1fr 130px",
      borderBottom: "1px solid var(--border)",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(8px)",
      transition: "opacity 0.4s ease, transform 0.4s ease",
    }}>
      <div style={{ padding: "16px 14px", borderRight: "1px solid var(--border)" }}>
        <p style={{ fontSize: "12px", fontWeight: "700", marginBottom: "5px", letterSpacing: "0.01em" }}>
          {scenario.label}
        </p>
        <p style={{ fontSize: "10px", color: "var(--muted)", lineHeight: "1.5" }}>
          {scenario.description.split(" (estimated")[0]}
        </p>
        {scenario.description.includes("estimated") && (
          <p style={{ fontSize: "9px", color: "var(--accent)", marginTop: "4px", opacity: 0.7 }}>
            ⚠ estimated
          </p>
        )}
      </div>

      <div style={{
        padding: "16px 14px",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        alignContent: "center",
      }}>
        {scenario.outcomes.map((o) => (
          <div key={o.asset} style={{
            border: "1px solid var(--border)",
            padding: "5px 10px",
            fontSize: "11px",
            background: "var(--surface)",
          }}>
            <span style={{ color: "var(--muted)", fontSize: "10px" }}>{o.asset} </span>
            <span style={{
              color: o.returnPct >= 0 ? "var(--green)" : "var(--red)",
              fontWeight: "700",
            }}>
              {o.returnPct >= 0 ? "+" : ""}{o.returnPct}%
            </span>
            <span style={{ color: "var(--muted)", marginLeft: "6px", fontSize: "10px" }}>
              ({o.returnAbs >= 0 ? "+" : ""}${Math.abs(o.returnAbs).toFixed(0)})
            </span>
          </div>
        ))}
      </div>

      <div style={{
        padding: "16px 14px",
        display: "flex",
        alignItems: "center",
      }}>
        <span style={{
          color: isPositive ? "var(--green)" : "var(--red)",
          fontSize: "12px",
          fontWeight: "700",
        }}>
          {scenario.verdict}
        </span>
      </div>
    </div>
  )
}

export default function ReportView({ report, onReset }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(false)
  const [decisionVisible, setDecisionVisible] = useState(false)
  const [bottomVisible, setBottomVisible] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" })
    setTimeout(() => setHeaderVisible(true), 50)
    setTimeout(() => setDecisionVisible(true), 200)
    setTimeout(() => setBottomVisible(true), 800)
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function sendMessage() {
    if (!chatInput.trim() || chatLoading) return
    const userMsg: ChatMessage = { role: "user", content: chatInput }
    const newHistory = [...messages, userMsg]
    setMessages(newHistory)
    setChatInput("")
    setChatLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: chatInput, history: messages, report }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessages([...newHistory, { role: "assistant", content: data.reply }])
    } catch (err: any) {
      setMessages([...newHistory, { role: "assistant", content: `Error: ${err.message}` }])
    } finally {
      setChatLoading(false)
    }
  }

  const { decision, scenarios, riskScore, recommendation, reasoning } = report

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .back-btn:hover {
          border-color: var(--accent) !important;
          color: var(--accent) !important;
        }
        .send-btn:hover:not(:disabled) {
          color: var(--accent) !important;
        }
        .chat-input-wrap:focus-within {
          border-top-color: #333 !important;
        }
      `}</style>

      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>

        {/* Header */}
        <header style={{
          borderBottom: "1px solid var(--border)",
          padding: "14px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          opacity: headerVisible ? 1 : 0,
          transition: "opacity 0.4s ease",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{
              background: "var(--accent)",
              color: "#000",
              fontWeight: "700",
              fontSize: "11px",
              padding: "3px 8px",
              letterSpacing: "0.12em",
            }}>FISCAL</span>
            <span style={{ color: "var(--muted)", fontSize: "11px", letterSpacing: "0.06em" }}>
              SIMULATION REPORT
            </span>
          </div>
          <button
            className="back-btn"
            onClick={onReset}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--muted)",
              padding: "7px 16px",
              fontSize: "10px",
              cursor: "pointer",
              letterSpacing: "0.08em",
              transition: "border-color 0.15s ease, color 0.15s ease",
            }}
          >
            ← NEW SIMULATION
          </button>
        </header>

        <div style={{
          maxWidth: "960px",
          margin: "0 auto",
          width: "100%",
          padding: "40px 32px 64px",
        }}>

          {/* Decision block */}
          <div style={{
            border: "1px solid var(--border)",
            padding: "20px 24px",
            marginBottom: "32px",
            opacity: decisionVisible ? 1 : 0,
            transform: decisionVisible ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}>
            <p style={{ color: "var(--muted)", fontSize: "9px", letterSpacing: "0.14em", marginBottom: "8px" }}>
              DECISION
            </p>
            <p style={{ fontSize: "15px", lineHeight: "1.5", marginBottom: "16px" }}>
              {decision.raw}
            </p>
            <div style={{ display: "flex", gap: "28px", flexWrap: "wrap" }}>
              {[
                ["ASSETS", decision.assets.join(", ")],
                ["AMOUNT", decision.amount ? `$${decision.amount.toLocaleString()}` : "—"],
                ["HORIZON", decision.horizon],
                ["DOMAIN", decision.domain.toUpperCase()],
                ["RISK", decision.riskContext.toUpperCase()],
              ].map(([label, value]) => (
                <div key={label}>
                  <p style={{ color: "var(--muted)", fontSize: "9px", letterSpacing: "0.12em", marginBottom: "3px" }}>
                    {label}
                  </p>
                  <p style={{ fontSize: "12px", color: "var(--accent)", fontWeight: "700" }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Scenarios */}
          <p style={{
            color: "var(--muted)",
            fontSize: "9px",
            letterSpacing: "0.14em",
            marginBottom: "12px",
            opacity: decisionVisible ? 1 : 0,
            transition: "opacity 0.5s ease 0.2s",
          }}>
            SCENARIO ANALYSIS
          </p>
          <div style={{
            border: "1px solid var(--border)",
            overflow: "hidden",
            marginBottom: "24px",
          }}>
            {/* Table header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "190px 1fr 130px",
              background: "var(--surface)",
              borderBottom: "1px solid var(--border)",
            }}>
              {["SCENARIO", "ASSET OUTCOMES", "VERDICT"].map((h, i) => (
                <div key={h} style={{
                  padding: "10px 14px",
                  fontSize: "9px",
                  color: "var(--muted)",
                  letterSpacing: "0.12em",
                  borderRight: i < 2 ? "1px solid var(--border)" : "none",
                }}>
                  {h}
                </div>
              ))}
            </div>

            {scenarios.map((s, i) => (
              <ScenarioRow
                key={s.type}
                scenario={s}
                index={i}
                amount={decision.amount ?? 1000}
              />
            ))}
          </div>

          {/* Risk + Recommendation */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.4fr",
            gap: "16px",
            marginBottom: "24px",
            opacity: bottomVisible ? 1 : 0,
            transform: bottomVisible ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}>
            <div style={{ border: "1px solid var(--border)", padding: "20px 24px" }}>
              <p style={{ color: "var(--muted)", fontSize: "9px", letterSpacing: "0.14em", marginBottom: "16px" }}>
                RISK SCORE
              </p>
              <RiskBar score={riskScore} />
              <p style={{ color: "var(--muted)", fontSize: "11px", marginTop: "12px", lineHeight: "1.5" }}>
                {riskScore <= 3 ? "Low risk — conservative play"
                  : riskScore <= 6 ? "Moderate risk — manageable exposure"
                  : "High risk — significant downside possible"}
              </p>
            </div>

            <div style={{ border: "1px solid var(--border)", padding: "20px 24px" }}>
              <p style={{ color: "var(--muted)", fontSize: "9px", letterSpacing: "0.14em", marginBottom: "12px" }}>
                RECOMMENDATION
              </p>
              <p style={{ fontSize: "14px", lineHeight: "1.55", marginBottom: "10px", fontWeight: "600" }}>
                {recommendation}
              </p>
              <p style={{ color: "var(--muted)", fontSize: "12px", lineHeight: "1.6" }}>
                {reasoning}
              </p>
            </div>
          </div>

          {/* Chat */}
          <div style={{
            border: "1px solid var(--border)",
            opacity: bottomVisible ? 1 : 0,
            transition: "opacity 0.6s ease 0.15s",
          }}>
            <div style={{
              borderBottom: "1px solid var(--border)",
              padding: "12px 20px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--surface)",
            }}>
              <span style={{
                width: "6px", height: "6px",
                borderRadius: "50%",
                background: "var(--accent)",
                display: "inline-block",
                animation: "pulse 2s ease-in-out infinite",
              }} />
              <span style={{ fontSize: "10px", letterSpacing: "0.12em", color: "var(--muted)" }}>
                ASK FISCAL
              </span>
              <span style={{ color: "var(--border)", marginLeft: "4px", fontSize: "10px" }}>—</span>
              <span style={{ color: "var(--muted)", fontSize: "10px" }}>
                dig deeper into any scenario
              </span>
            </div>

            <div style={{
              minHeight: "72px",
              maxHeight: "300px",
              overflowY: "auto",
            }}>
              {messages.length === 0 ? (
                <div style={{ padding: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {[
                    "What happens if ETH drops 50%?",
                    "Which scenario is most likely?",
                    "How does this compare to just holding cash?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => setChatInput(q)}
                      style={{
                        background: "transparent",
                        border: "1px solid var(--border)",
                        color: "var(--muted)",
                        padding: "7px 12px",
                        fontSize: "11px",
                        cursor: "pointer",
                        letterSpacing: "0.01em",
                        transition: "border-color 0.15s, color 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--accent)"
                        e.currentTarget.style.color = "var(--text)"
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border)"
                        e.currentTarget.style.color = "var(--muted)"
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} style={{
                    padding: "16px 20px",
                    borderBottom: i < messages.length - 1 ? "1px solid var(--border)" : "none",
                    background: msg.role === "user" ? "transparent" : "var(--surface)",
                    animation: "fadeUp 0.3s ease",
                  }}>
                    <p style={{
                      color: msg.role === "user" ? "var(--accent)" : "var(--muted)",
                      fontSize: "9px",
                      letterSpacing: "0.14em",
                      marginBottom: "6px",
                    }}>
                      {msg.role === "user" ? "YOU" : "FISCAL"}
                    </p>
                    <p style={{ fontSize: "13px", lineHeight: "1.65", whiteSpace: "pre-wrap" }}>
                      {msg.content}
                    </p>
                  </div>
                ))
              )}
              {chatLoading && (
                <div style={{ padding: "16px 20px", background: "var(--surface)" }}>
                  <p style={{ color: "var(--muted)", fontSize: "9px", letterSpacing: "0.14em", marginBottom: "6px" }}>FISCAL</p>
                  <p style={{ color: "var(--muted)", fontSize: "12px" }}>
                    <span style={{ animation: "pulse 1s ease infinite", display: "inline-block" }}>···</span>
                  </p>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div
              className="chat-input-wrap"
              style={{
                borderTop: "1px solid var(--border)",
                display: "flex",
                transition: "border-top-color 0.2s ease",
              }}
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendMessage() }}
                placeholder="Ask a follow-up question..."
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--text)",
                  padding: "16px 20px",
                  fontSize: "13px",
                  letterSpacing: "0.01em",
                }}
              />
              <button
                className="send-btn"
                onClick={sendMessage}
                disabled={chatLoading || !chatInput.trim()}
                style={{
                  background: "transparent",
                  border: "none",
                  borderLeft: "1px solid var(--border)",
                  color: chatInput.trim() ? "var(--text)" : "var(--muted)",
                  padding: "16px 22px",
                  fontSize: "10px",
                  fontWeight: "700",
                  letterSpacing: "0.1em",
                  cursor: chatInput.trim() ? "pointer" : "not-allowed",
                  transition: "color 0.15s ease",
                }}
              >
                SEND →
              </button>
            </div>
          </div>

          <p style={{
            color: "var(--muted)",
            fontSize: "9px",
            textAlign: "center",
            marginTop: "32px",
            letterSpacing: "0.08em",
            opacity: bottomVisible ? 0.6 : 0,
            transition: "opacity 0.6s ease 0.3s",
          }}>
            GENERATED {new Date(report.generatedAt).toUTCString()} · NOT FINANCIAL ADVICE
          </p>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </>
  )
}
