import { NextRequest } from "next/server"

// OKX.AI sends a shared secret in the header after Payment SDK integration
// Set this in your .env.local and in Vercel env vars
const API_SECRET = process.env.FISCAL_API_SECRET

// Rate limiting — simple in-memory store (per serverless instance)
// For production scale, replace with Redis/Upstash
const requestLog = new Map<string, { count: number; windowStart: number }>()

const RATE_LIMIT = 30        // max requests
const WINDOW_MS = 60 * 1000  // per 60 seconds

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  )
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = requestLog.get(ip)

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    requestLog.set(ip, { count: 1, windowStart: now })
    return false
  }

  if (entry.count >= RATE_LIMIT) return true

  entry.count++
  return false
}

export type AuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

export function validateRequest(req: NextRequest): AuthResult {
  const ip = getClientIP(req)

  // Rate limit check
  if (isRateLimited(ip)) {
    return {
      ok: false,
      status: 429,
      error: "Rate limit exceeded. Try again in a moment.",
    }
  }

  // Skip secret check if no secret is configured (local dev)
  if (!API_SECRET) return { ok: true }

  // Once OKX Payment SDK is wired in, requests carry this header
  const providedSecret = req.headers.get("x-fiscal-secret")

  // Allow requests from the same origin (UI calling its own API)
  const origin = req.headers.get("origin")
  const host = req.headers.get("host")
  const isSameOrigin = origin ? origin.includes(host || "") : false

  if (isSameOrigin) return { ok: true }

  if (!providedSecret || providedSecret !== API_SECRET) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
    }
  }

  return { ok: true }
}
