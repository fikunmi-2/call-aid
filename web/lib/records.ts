import "server-only";
import { z } from "zod";
import { databaseConfig } from "./config";
import { database } from "./server";
import { parsePublishedReport, type IntakeReport } from "./intake-report";

const count = z.number().int().min(0).max(1000000);
const response = z
  .object({
    records: z.array(z.unknown()).max(20),
    stats: z
      .object({
        total: count,
        completed: count,
        incomplete: count,
        flagged: count,
      })
      .strict(),
  })
  .strict();
export type RecordList = {
  records: IntakeReport[];
  stats: z.infer<typeof response>["stats"];
};
export async function readRecords(id?: string, page = 0): Promise<RecordList> {
  if (id && !z.uuid().safeParse(id).success)
    return {
      records: [],
      stats: { total: 0, completed: 0, incomplete: 0, flagged: 0 },
    };
  const { data, error } = await database(databaseConfig()).rpc(
    "read_demo_records",
    { p_id: id || null, p_offset: page * 20, p_limit: 20 },
  );
  if (error) throw new Error("records_unavailable");
  const parsed = response.parse(data);
  const records = parsed.records.map(parsePublishedReport);
  if (records.some((record) => !record)) throw new Error("records_invalid");
  return { records: records as IntakeReport[], stats: parsed.stats };
}
