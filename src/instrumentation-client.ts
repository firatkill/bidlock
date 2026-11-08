import { z } from "zod";

// FR-86 / T-47: avoid even a caught eval probe under the nonce-only CSP.
// Next loads this before application client modules; server parsing is unchanged.
z.config({ jitless: true });
