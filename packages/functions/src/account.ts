import {
  BatchWriteCommand,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { TABLE, ddb, json, subOf } from "./lib/db";

type Key = { pk: string; sk: string };

async function deleteAll(keys: Key[]) {
  for (let i = 0; i < keys.length; i += 25) {
    const chunk = keys.slice(i, i + 25);
    await ddb.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE]: chunk.map((Key) => ({ DeleteRequest: { Key } })),
        },
      }),
    );
  }
}

/**
 * Erase everything we hold for this lifter: profile, handle claim, bests,
 * run history, and every leaderboard row. The Cognito account itself is
 * deleted by the browser afterwards via its own access token.
 */
export const remove = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const sub = subOf(event);

  const owned = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": `USER#${sub}` },
    }),
  );
  const items = owned.Items ?? [];

  const keys: Key[] = items.map((i) => ({ pk: String(i.pk), sk: String(i.sk) }));

  // leaderboard rows live under their own partition
  for (const item of items) {
    if (String(item.sk).startsWith("LBREF#")) {
      keys.push({
        pk: `LBROW#${item.mode}#${item.window}`,
        sk: `USER#${sub}`,
      });
    }
  }

  // release the handle
  const profile = items.find((i) => i.sk === "PROFILE");
  if (profile?.handle) {
    const claim = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: `HANDLE#${profile.handle}`, sk: "CLAIM" },
      }),
    );
    if (claim.Item?.sub === sub) {
      keys.push({ pk: `HANDLE#${profile.handle}`, sk: "CLAIM" });
    }
  }

  await deleteAll(keys);
  return json(200, { deleted: true });
};
