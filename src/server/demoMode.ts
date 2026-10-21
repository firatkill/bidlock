import "server-only";
import { env } from "./env";
export function demoMode() {
  return env().DEMO_MODE;
}
