import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { TABLE, ddb, json } from "./lib/db";

/** Best score per ranked mode for a user, keyed by mode. */
export async function bestsOf(sub: string) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: { ":pk": `USER#${sub}`, ":sk": "BEST#" },
    }),
  );
  const bests: Record<string, { score: number; submittedAt: number }> = {};
  for (const item of res.Items ?? []) {
    const mode = String(item.sk).slice("BEST#".length);
    bests[mode] = {
      score: Number(item.score),
      submittedAt: Number(item.submittedAt),
    };
  }
  return bests;
}

export const get = async (event: APIGatewayProxyEventV2) => {
  const handle = event.pathParameters?.handle?.trim().toLowerCase();
  if (!handle) return json(400, { error: "Missing handle." });

  const claim = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { pk: `HANDLE#${handle}`, sk: "CLAIM" } }),
  );
  if (!claim.Item) return json(404, { error: "No such lifter." });

  const sub = String(claim.Item.sub);
  const [profile, bests] = await Promise.all([
    ddb.send(
      new GetCommand({ TableName: TABLE, Key: { pk: `USER#${sub}`, sk: "PROFILE" } }),
    ),
    bestsOf(sub),
  ]);

  return json(200, {
    handle,
    instagram: (profile.Item?.instagram as string) ?? null,
    createdAt: (profile.Item?.createdAt as string) ?? null,
    bests,
  });
};
