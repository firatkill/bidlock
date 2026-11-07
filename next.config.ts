import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/": ["./bench/results/latest.json"],
    "/how-it-works": [
      "./bench/results/latest.json",
      "./src/components/how/state-machine.svg",
    ],
  },
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  agentRules: false,
};
export default config;
