import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { config } from "@/lib/config";
import {
  database,
  hash,
  sameOrigin,
  privateHeaders,
  deleteRoom,
} from "@/lib/server";
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return new NextResponse(null, { status: 403 });
  const receipt = req.cookies.get("callaid-receipt")?.value;
  if (!receipt || !/^[a-f0-9]{64}$/.test(receipt))
    return new NextResponse(null, { status: 204 });
  try {
    const c = config(),
      db = database(c);
    const { data, error } = await db.rpc("demo_session_receipt", {
      p_receipt: hash(receipt),
    });
    if (error) throw error;
    if (data?.room_name) {
      await deleteRoom(
        new RoomServiceClient(
          c.LIVEKIT_URL,
          c.LIVEKIT_API_KEY,
          c.LIVEKIT_API_SECRET,
        ),
        data.room_name,
      );
      await db.rpc("finish_demo_session", {
        p_room: data.room_name,
        p_status: "aborted",
      });
    }
    return new NextResponse(null, { status: 204, headers: privateHeaders });
  } catch {
    return NextResponse.json(
      { error: "Disconnecting. The server time limit still applies." },
      { status: 503, headers: privateHeaders },
    );
  }
}
