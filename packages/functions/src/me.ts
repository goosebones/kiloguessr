import {
  GetCommand,
  PutCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { TABLE, ddb, json, subOf } from "./lib/db";

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
const IG_RE = /^[A-Za-z0-9._]{1,30}$/;
const DENYLIST = new Set([
  "admin", "administrator", "mod", "moderator", "root", "support",
  "staff", "official", "kiloguessr", "liftinglookup",
]);

async function readProfile(sub: string) {
  const res = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { pk: `USER#${sub}`, sk: "PROFILE" } }),
  );
  return res.Item;
}

function publicProfile(item: Record<string, unknown> | undefined) {
  return {
    handle: (item?.handle as string) ?? null,
    instagram: (item?.instagram as string) ?? null,
    createdAt: (item?.createdAt as string) ?? null,
  };
}

export const get = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const sub = subOf(event);
  let item = await readProfile(sub);
  if (!item) {
    item = { pk: `USER#${sub}`, sk: "PROFILE", createdAt: new Date().toISOString() };
    try {
      await ddb.send(
        new PutCommand({
          TableName: TABLE,
          Item: item,
          ConditionExpression: "attribute_not_exists(pk)",
        }),
      );
    } catch {
      item = (await readProfile(sub)) ?? item;
    }
  }
  return json(200, publicProfile(item));
};

export const patch = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const sub = subOf(event);
  let body: { handle?: unknown; instagram?: unknown };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  if (body.handle !== undefined) {
    const handle = String(body.handle).trim().toLowerCase();
    if (!HANDLE_RE.test(handle)) {
      return json(400, {
        error: "Handles are 3–20 characters: letters, numbers, underscore.",
      });
    }
    if (DENYLIST.has(handle)) return json(400, { error: "That handle isn't available." });

    const current = await readProfile(sub);
    if (current?.handle !== handle) {
      const tx: NonNullable<
        ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"]
      > = [
        {
          Put: {
            TableName: TABLE,
            Item: { pk: `HANDLE#${handle}`, sk: "CLAIM", sub },
            ConditionExpression: "attribute_not_exists(pk)",
          },
        },
        {
          Update: {
            TableName: TABLE,
            Key: { pk: `USER#${sub}`, sk: "PROFILE" },
            UpdateExpression: "SET handle = :h, createdAt = if_not_exists(createdAt, :now)",
            ExpressionAttributeValues: {
              ":h": handle,
              ":now": new Date().toISOString(),
            },
          },
        },
      ];
      if (current?.handle) {
        tx.push({
          Delete: {
            TableName: TABLE,
            Key: { pk: `HANDLE#${current.handle}`, sk: "CLAIM" },
            ConditionExpression: "#s = :sub",
            ExpressionAttributeNames: { "#s": "sub" },
            ExpressionAttributeValues: { ":sub": sub },
          },
        });
      }
      try {
        await ddb.send(new TransactWriteCommand({ TransactItems: tx }));
      } catch {
        return json(409, { error: "That handle is taken." });
      }
    }
  }

  if (body.instagram !== undefined) {
    const raw = String(body.instagram ?? "").trim().replace(/^@/, "");
    if (raw === "") {
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { pk: `USER#${sub}`, sk: "PROFILE" },
          UpdateExpression: "REMOVE instagram",
        }),
      );
    } else {
      if (!IG_RE.test(raw)) {
        return json(400, { error: "That doesn't look like an Instagram username." });
      }
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { pk: `USER#${sub}`, sk: "PROFILE" },
          UpdateExpression: "SET instagram = :ig, createdAt = if_not_exists(createdAt, :now)",
          ExpressionAttributeValues: {
            ":ig": raw,
            ":now": new Date().toISOString(),
          },
        }),
      );
    }
  }

  return json(200, publicProfile(await readProfile(sub)));
};
