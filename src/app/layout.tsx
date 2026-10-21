import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { Schibsted_Grotesk, JetBrains_Mono } from "next/font/google";
import { Shell } from "@/components/shell/Shell";
import { env } from "@/server/env";
import "./globals.css";
const sans = Schibsted_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-schibsted",
});
const mono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-jetbrains",
});
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Bidlock",
  description: "A live auction engine that stays correct under load.",
};
const themeScript =
  "try{var t=localStorage.getItem('bl_theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:'system'}catch{}";
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable}`}
    >
      <head>
        <script nonce={nonce}>{themeScript}</script>
      </head>
      <body>
        <Shell mode={env().DEMO_MODE}>{children}</Shell>
      </body>
    </html>
  );
}
