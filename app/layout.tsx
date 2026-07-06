import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Fiscal — Financial Scenario Simulator",
  description: "Describe a financial decision in plain English. Fiscal runs 5 scenarios against real data and tells you what to expect.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
