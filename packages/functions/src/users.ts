import { GetCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { TABLE, ddb, json } from "./lib/db";

export const get = async (event: APIGatewayProxyEventV2) => {
  const handle = event.pathParameters?.handle?.trim().toLowerCase();
  if (!handle) return json(400, { error: "Missing handle." });

  const claim = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { pk: `HANDLE#${handle}`, sk: "CLAIM" } }),
  );
  if (!claim.Item) return json(404, { error: "No such lifter." });

  const profile = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { pk: `USER#${claim.Item.sub}`, sk: "PROFILE" },
    }),
  );
  return json(200, {
    handle,
    instagram: (profile.Item?.instagram as string) ?? null,
    createdAt: (profile.Item?.createdAt as string) ?? null,
  });
};
