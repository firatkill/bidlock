import "server-only";
import { z } from "zod";
// postgres.js returns scalar timestamptz as Date; JSON timestamps remain ISO strings.
function serializeDates(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeDates);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeDates(item)]),
    );
  return value;
}
export function row<S extends z.ZodType>(
  schema: S,
  rows: unknown,
): z.output<S> {
  const result = z.array(schema).length(1).parse(serializeDates(rows));
  const first = result[0];
  if (first === undefined) throw new Error("Missing SQL result");
  return first;
}
export function jsonResult<S extends z.ZodType>(
  schema: S,
  rows: unknown,
): z.output<S> {
  return schema.parse(
    row(z.object({ result: z.unknown() }).strict(), rows).result,
  );
}
