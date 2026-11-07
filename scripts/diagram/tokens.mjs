import { readFileSync, writeFileSync } from "node:fs";
const path = "src/components/how/state-machine.svg";
const svg = readFileSync(path, "utf8");
// Mermaid owns geometry; the application owns typography and theme colors.
// Strip its generated theme CSS (including unused colors and animations).
const css = `
.statediagram { font-family: var(--font-sans), sans-serif; font-size: 14px; color: var(--ink); fill: var(--ink); }
.statediagram .nodeLabel, .statediagram .edgeLabel, .statediagram .cluster-label { color: var(--ink); }
.statediagram .label p { margin: 0; }
.statediagram foreignObject { overflow: visible; }
.statediagram .labelBkg, .statediagram .edgeLabel { background: var(--ground); }
.statediagram rect { fill: var(--surface); stroke: var(--rule-strong); stroke-width: 1px; }
.statediagram .statediagram-cluster > rect { fill: var(--ground); }
.statediagram .transition, .statediagram .outer-path { fill: none; stroke: var(--ink-2); stroke-width: 1.5px; }
.statediagram .state-start, .statediagram circle, .statediagram marker path { fill: var(--ink); stroke: var(--ink); }
`;
writeFileSync(
  path,
  svg
    .replace(/<style>[\s\S]*?<\/style>/, `<style>${css}</style>`)
    .replace(/<filter[\s\S]*?<\/filter>/g, "")
    .replace(/\sfilter="[^"]*"/g, "")
    .replace(/(fill|stroke)="#[0-9a-fA-F]+"/g, '$1="var(--ink)"'),
);
