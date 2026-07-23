import {
  BatchWriteCommand,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { TABLE, ddb, json, subOf } from "./lib/db";

const cognito = new CognitoIdentityProviderClient({});

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
 * run history, every leaderboard row, and — last — the Cognito account
 * itself (the only place their email lives). Deleting Cognito server-side
 * makes email removal guaranteed rather than reliant on the browser.
 * For this pool the Cognito Username equals the `sub`.
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

  // Remove the login and its email from Cognito. If this throws, the handler
  // 500s and the client can retry — the DynamoDB deletes above are idempotent.
  await cognito.send(
    new AdminDeleteUserCommand({
      UserPoolId: process.env.USER_POOL_ID,
      Username: sub,
    }),
  );

  return json(200, { deleted: true });
};
