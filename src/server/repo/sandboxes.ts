import "server-only";
import { sql } from "../db";
import { row, jsonResult } from "./result";
import { SandboxResultRow, SandboxBots } from "@/domain/schemas";
export async function createSandbox(
  owner: string,
  ipHash: string,
  seed: number | null = null,
) {
  return row(
    SandboxResultRow,
    await sql`select * from bidlock.create_sandbox(${owner},${ipHash},${seed})`,
  );
}
export async function sandboxBots(owner: string, id: string) {
  return jsonResult(
    SandboxBots.nullable(),
    await sql`select bidlock.sandbox_bots(${owner},${id}) as result`,
  );
}
