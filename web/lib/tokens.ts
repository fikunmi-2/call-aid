import { AccessToken, TrackSource } from "livekit-server-sdk";
// Derived from official starter app/api/token/route.ts; no caller-supplied grants/config.
export async function token(
  key: string,
  secret: string,
  room: string,
  identity: string,
) {
  const at = new AccessToken(key, secret, { identity, ttl: 60 });
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canPublishSources: [TrackSource.MICROPHONE],
    canSubscribe: true,
    canPublishData: false,
    canUpdateOwnMetadata: false,
  });
  return at.toJwt();
}
