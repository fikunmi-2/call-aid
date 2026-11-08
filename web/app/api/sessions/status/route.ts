import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { database, hash, privateHeaders } from "@/lib/server";
export async function GET(req: NextRequest) {
  const receipt = req.cookies.get("callaid-receipt")?.value;
  if (!receipt || !/^[a-f0-9]{64}$/.test(receipt))
    return NextResponse.json(
      { status: "unavailable" },
      { headers: privateHeaders },
    );
  try {
    const { data, error } = await database(config()).rpc(
      "demo_session_receipt",
      { p_receipt: hash(receipt) },
    );
    if (error) throw error;
    return NextResponse.json(
      { status: data?.status || "unavailable", recordAvailable: false },
      { headers: privateHeaders },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: privateHeaders },
    );
  }
}
