import { NextRequest, NextResponse } from "next/server";
import { databaseConfig } from "@/lib/config";
import { z } from "zod";
import { database, hash, privateHeaders } from "@/lib/server";
export async function GET(req: NextRequest) {
  const receipt = req.cookies.get("callaid-receipt")?.value;
  if (!receipt || !/^[a-f0-9]{64}$/.test(receipt))
    return NextResponse.json(
      { status: "unavailable" },
      { headers: privateHeaders },
    );
  try {
    const { data, error } = await database(databaseConfig()).rpc(
      "demo_session_receipt",
      { p_receipt: hash(receipt) },
    );
    if (error) throw error;
    return NextResponse.json(
      {
        status:
          typeof data?.status === "string" &&
          [
            "reserved",
            "active",
            "aborted",
            "expired",
            "failed",
            "completed",
            "incomplete",
          ].includes(data.status)
            ? data.status
            : "unavailable",
        publication: [
          "pending",
          "published",
          "withheld",
          "failed",
          "unavailable",
        ].includes(data?.publication)
          ? data.publication
          : "unavailable",
        recordAvailable:
          data?.publication === "published" &&
          z.uuid().safeParse(data?.case_id).success,
        ...(data?.publication === "published" &&
        z.uuid().safeParse(data?.case_id).success
          ? {
              caseId: data.case_id,
              caseStatus:
                data.case_status === "completed" ? "completed" : "incomplete",
            }
          : {}),
      },
      { headers: privateHeaders },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: privateHeaders },
    );
  }
}
