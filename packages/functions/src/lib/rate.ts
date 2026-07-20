import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { TABLE, ddb } from "./db";

/** Minimum gap between starting runs — stops a script spraying run tokens. */
const MIN_GAP_MS = 3000;
/** Ceiling on runs started in one clock hour. */
const RUNS_PER_HOUR = 90;

export class RateLimited extends Error {}

/**
 * Throws RateLimited if this user is starting runs too fast. Both checks are
 * conditional writes, so concurrent requests can't slip past together.
 */
export async function checkRunRate(sub: string, now = Date.now()) {
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { pk: `USER#${sub}`, sk: "PROFILE" },
        UpdateExpression: "SET lastRunAt = :now",
        ConditionExpression: "attribute_not_exists(lastRunAt) OR lastRunAt < :cutoff",
        ExpressionAttributeValues: { ":now": now, ":cutoff": now - MIN_GAP_MS },
      }),
    );
  } catch {
    throw new RateLimited("You're starting runs too quickly — give it a second.");
  }

  const hour = Math.floor(now / 3600000);
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { pk: `USER#${sub}`, sk: `RATE#${hour}` },
        UpdateExpression: "ADD started :one SET expiresAt = :ttl",
        ConditionExpression: "attribute_not_exists(started) OR started < :max",
        ExpressionAttributeValues: {
          ":one": 1,
          ":max": RUNS_PER_HOUR,
          ":ttl": Math.floor(now / 1000) + 7200,
        },
      }),
    );
  } catch {
    throw new RateLimited("That's a lot of runs this hour. Take a breather.");
  }
}
