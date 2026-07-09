// This route lives under pages/api (not app/api) intentionally.
// The OKX x402 SDK's paymentMiddleware expects Express-style (req, res, next),
// which Next.js's Pages Router API routes support natively via Node's raw
// http req/res. App Router route handlers use Web Fetch API Request/Response
// objects instead, which are not directly compatible with Express middleware.

import express from "express"
import type { Request, Response } from "express"
import {
  paymentMiddleware,
  x402ResourceServer,
} from "@okxweb3/x402-express"
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server"
import { OKXFacilitatorClient } from "@okxweb3/x402-core"
import { parseDecision } from "@/lib/parser"
import { runSimulation } from "@/lib/simulator"

const NETWORK = "eip155:196" // X Layer Mainnet
const PAY_TO = process.env.PAY_TO_ADDRESS || ""
const PRICE = process.env.FISCAL_PRICE_USD || "$0.30" // matches your registered 0.3 USDT/call

if (!PAY_TO) {
  console.error(
    "[Fiscal] PAY_TO_ADDRESS is not set — payment-gated endpoint cannot verify settlement recipient."
  )
}

const facilitatorClient = new OKXFacilitatorClient({
  apiKey: process.env.OKX_API_KEY || "",
  secretKey: process.env.OKX_SECRET_KEY || "",
  passphrase: process.env.OKX_PASSPHRASE || "",
})

const resourceServer = new x402ResourceServer(facilitatorClient)
resourceServer.register(NETWORK, new ExactEvmScheme())

const app = express()
app.use(express.json())

app.use(
  paymentMiddleware(
    {
      "POST /api/paid-simulate": {
        accepts: [
          {
            scheme: "exact",
            network: NETWORK,
            payTo: PAY_TO,
            price: PRICE,
          },
        ],
        description:
          "Fiscal — financial scenario simulation. 5-scenario risk/reward report on any plain-English financial decision.",
        mimeType: "application/json",
      },
    },
    resourceServer
  )
)

// Protected route — only reached after payment is verified by the middleware above
app.post("/api/paid-simulate", async (req: Request, res: Response) => {
  try {
    const { input } = req.body

    if (!input || typeof input !== "string" || input.trim().length < 10) {
      res.status(400).json({ error: "Please describe your financial decision in more detail" })
      return
    }

    const decision = await parseDecision(input)

    if (!decision.assets || decision.assets.length === 0) {
      res.status(400).json({
        error:
          "Could not identify any assets in your decision. Try mentioning specific assets like ETH, BTC, or AAPL.",
      })
      return
    }

    const report = await runSimulation(decision)
    console.log("[Fiscal] Payment verified, simulation delivered.")
    res.status(200).json(report)
  } catch (err: any) {
    console.error("[Fiscal] paid-simulate error:", err)
    res.status(500).json({ error: err.message || "Simulation failed" })
  }
})

// Next.js Pages API config — disable the default body parser since Express
// handles body parsing itself via express.json() above
export const config = {
  api: {
    bodyParser: false,
  },
}

export default app
