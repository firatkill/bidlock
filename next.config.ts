import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: { "/": ["./bench/results/latest.json"] },
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  agentRules: false,
};
export default config;
