"use client"

import { useEffect, useState } from "react"

const STEPS = [
  "Fetching market data",
  "Running 5 scenarios",
  "Generating recommendation",
]

export default function LoadingScreen() {
  const [activeStep, setActiveStep] = useState(0)
  const [dots, setDots] = useState("")
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Advance steps
    const stepTimers = [
      setTimeout(() => setActiveStep(1), 2000),
      setTimeout(() => setActiveStep(2), 4500),
    ]

    // Animate dots
    const dotInterval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."))
    }, 400)

    // Smooth progress bar
    const start = Date.now()
    const duration = 7000
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - start
      const raw = Math.min((elapsed / duration) * 95, 95)
      setProgress(raw)
    }, 50)

    return () => {
      stepTimers.forEach(clearTimeout)
      clearInterval(dotInterval)
      clearInterval(progressInterval)
    }
  }, [])

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 100,
    }}>
      {/* Subtle grid background */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `
          linear-gradient(var(--border) 1px, transparent 1px),
          linear-gradient(90deg, var(--border) 1px, transparent 1px)
        `,
        backgroundSize: "48px 48px",
        opacity: 0.3,
      }} />

      <div style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        maxWidth: "420px",
        padding: "0 24px",
      }}>
        {/* Logo */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "64px",
        }}>
          <span style={{
            background: "var(--accent)",
            color: "#000",
            fontWeight: "700",
            fontSize: "11px",
            padding: "3px 8px",
            letterSpacing: "0.12em",
          }}>FISCAL</span>
        </div>

        {/* Steps */}
        <div style={{
          width: "100%",
          marginBottom: "40px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}>
          {STEPS.map((step, i) => {
            const done = i < activeStep
            const active = i === activeStep
            return (
              <div
                key={step}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  opacity: done ? 0.4 : active ? 1 : 0.2,
                  transition: "opacity 0.5s ease",
                }}
              >
                {/* Icon */}
                <div style={{
                  width: "20px",
                  height: "20px",
                  border: `1px solid ${done ? "var(--accent)" : active ? "var(--accent)" : "var(--border)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "border-color 0.4s ease",
                }}>
                  {done ? (
                    <span style={{ color: "var(--accent)", fontSize: "10px" }}>✓</span>
                  ) : active ? (
                    <span style={{
                      width: "6px",
                      height: "6px",
                      background: "var(--accent)",
                      display: "block",
                      animation: "pulse 1s ease-in-out infinite",
                    }} />
                  ) : (
                    <span style={{
                      width: "4px",
                      height: "4px",
                      background: "var(--muted)",
                      display: "block",
                    }} />
                  )}
                </div>

                {/* Label */}
                <span style={{
                  fontSize: "13px",
                  color: active ? "var(--text)" : done ? "var(--muted)" : "var(--muted)",
                  letterSpacing: "0.02em",
                  transition: "color 0.4s ease",
                }}>
                  {step}{active ? dots : ""}
                </span>
              </div>
            )
          })}
        </div>

        {/* Progress bar */}
        <div style={{
          width: "100%",
          height: "1px",
          background: "var(--border)",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${progress}%`,
            background: "var(--accent)",
            transition: "width 0.1s linear",
          }} />
        </div>

        <p style={{
          color: "var(--muted)",
          fontSize: "10px",
          letterSpacing: "0.08em",
          marginTop: "16px",
        }}>
          {Math.round(progress)}%
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>
    </div>
  )
}
