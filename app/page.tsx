"use client"

import { useState, useEffect } from "react"
import { SimulationReport } from "@/lib/types"
import ReportView from "@/components/ReportView"
import LoadingScreen from "@/components/LoadingScreen"

const EXAMPLES = [
  "Should I put $5k into ETH or hold USDC for 3 months?",
  "Is now a good time to buy AAPL with $2,000?",
  "Should I split $10k between BTC and S&P 500?",
  "I have $3k — DCA into SOL weekly or go all in now?",
]

export default function Home() {
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<SimulationReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  async function runSimulation() {
    if (!input.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Simulation failed")
      setReport(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setReport(null)
    setInput("")
    setError(null)
  }

  if (loading) return <LoadingScreen />
  if (report) return <ReportView report={report} onReset={reset} />

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .fade-up {
          opacity: 0;
          animation: fadeUp 0.6s ease forwards;
        }
        .fade-in {
          opacity: 0;
          animation: fadeIn 0.5s ease forwards;
        }
        .example-btn:hover {
          border-color: var(--accent) !important;
          color: var(--text) !important;
          background: rgba(200,255,0,0.03) !important;
        }
        .run-btn:hover:not(:disabled) {
          background: #d4ff1a !important;
          transform: translateX(2px);
        }
        .run-btn {
          transition: background 0.15s ease, transform 0.15s ease !important;
        }
        .input-wrap:focus-within {
          border-color: #333 !important;
        }
      `}</style>

      <main style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
      }}>
        {/* Subtle dot grid */}
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundImage: "radial-gradient(circle, #1e1e1e 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          opacity: mounted ? 0.6 : 0,
          transition: "opacity 1.2s ease",
          pointerEvents: "none",
        }} />

        {/* Header */}
        <header
          className="fade-in"
          style={{
            animationDelay: "0.1s",
            borderBottom: "1px solid var(--border)",
            padding: "16px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            zIndex: 1,
          }}
        >
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
              FINANCIAL SCENARIO SIMULATOR
            </span>
          </div>
          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            <span style={{ color: "var(--muted)", fontSize: "10px", letterSpacing: "0.08em" }}>
              CRYPTO · TRADFI · AI-POWERED
            </span>
            <span style={{
              border: "1px solid var(--border)",
              color: "var(--muted)",
              fontSize: "10px",
              padding: "3px 8px",
              letterSpacing: "0.06em",
            }}>
              OKX.AI ASP
            </span>
          </div>
        </header>

        {/* Main */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "64px 24px",
          position: "relative",
          zIndex: 1,
        }}>
          <div style={{ width: "100%", maxWidth: "640px" }}>

            {/* Hero text */}
            <div
              className="fade-up"
              style={{ animationDelay: "0.2s", marginBottom: "48px" }}
            >
              <p style={{
                color: "var(--accent)",
                fontSize: "10px",
                letterSpacing: "0.2em",
                marginBottom: "16px",
              }}>
                MAKE BETTER FINANCIAL DECISIONS
              </p>
              <h1 style={{
                fontSize: "clamp(32px, 6vw, 56px)",
                fontWeight: "700",
                lineHeight: "1.05",
                letterSpacing: "-0.03em",
                marginBottom: "16px",
              }}>
                Describe your<br />
                financial decision.
              </h1>
              <p style={{
                color: "var(--muted)",
                fontSize: "14px",
                lineHeight: "1.6",
                maxWidth: "460px",
              }}>
                Plain English. Crypto or stocks. Fiscal pulls live market data,
                runs 5 scenarios, and gives you a structured risk breakdown.
              </p>
            </div>

            {/* Input */}
            <div
              className="fade-up input-wrap"
              style={{
                animationDelay: "0.35s",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                marginBottom: "10px",
                transition: "border-color 0.2s ease",
              }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runSimulation()
                }}
                placeholder="e.g. Should I put $5k into ETH or hold USDC for 3 months?"
                rows={3}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--text)",
                  padding: "18px 18px 12px",
                  fontSize: "14px",
                  resize: "none",
                  lineHeight: "1.6",
                  letterSpacing: "0.01em",
                }}
              />
              <div style={{
                borderTop: "1px solid var(--border)",
                padding: "10px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <span style={{ color: "var(--muted)", fontSize: "10px", letterSpacing: "0.06em" }}>
                  ⌘ ENTER TO RUN
                </span>
                <button
                  className="run-btn"
                  onClick={runSimulation}
                  disabled={!input.trim()}
                  style={{
                    background: input.trim() ? "var(--accent)" : "var(--border)",
                    color: input.trim() ? "#000" : "var(--muted)",
                    border: "none",
                    padding: "8px 20px",
                    fontSize: "11px",
                    fontWeight: "700",
                    letterSpacing: "0.1em",
                    cursor: input.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  RUN SIMULATION →
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="fade-up"
                style={{
                  border: "1px solid var(--red)",
                  padding: "12px 16px",
                  color: "var(--red)",
                  fontSize: "12px",
                  marginBottom: "10px",
                  letterSpacing: "0.02em",
                }}
              >
                ✕ {error}
              </div>
            )}

            {/* Examples */}
            <div
              className="fade-up"
              style={{ animationDelay: "0.5s" }}
            >
              <p style={{
                color: "var(--muted)",
                fontSize: "10px",
                letterSpacing: "0.12em",
                marginBottom: "10px",
                marginTop: "32px",
              }}>
                TRY AN EXAMPLE
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    className="example-btn"
                    onClick={() => setInput(ex)}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--border)",
                      color: "var(--muted)",
                      padding: "11px 14px",
                      textAlign: "left",
                      fontSize: "12px",
                      cursor: "pointer",
                      letterSpacing: "0.01em",
                      transition: "border-color 0.15s ease, color 0.15s ease, background 0.15s ease",
                      opacity: 0,
                      animation: "fadeUp 0.5s ease forwards",
                      animationDelay: `${0.55 + i * 0.07}s`,
                    }}
                  >
                    <span style={{ color: "var(--accent)", marginRight: "10px", fontSize: "10px" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer
          className="fade-in"
          style={{
            animationDelay: "0.8s",
            borderTop: "1px solid var(--border)",
            padding: "12px 32px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", gap: "24px" }}>
            {["GROQ", "COINGECKO", "ALPHA VANTAGE"].map((s) => (
              <span key={s} style={{ color: "var(--muted)", fontSize: "9px", letterSpacing: "0.1em" }}>
                {s}
              </span>
            ))}
          </div>
          <span style={{ color: "var(--muted)", fontSize: "9px", letterSpacing: "0.08em" }}>
            NOT FINANCIAL ADVICE
          </span>
        </footer>
      </main>
    </>
  )
}
