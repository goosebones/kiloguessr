import { randomUUID } from "node:crypto";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import {
  RANKED_ENDURANCE,
  RANKED_SETTINGS,
  boardSortKey,
  generateRunCards,
  isEndurance,
  isRankedMode,
  rankValue,
  scoreRun,
  weekKey,
  type RankedMode,
  type SubmittedAnswer,
} from "@kiloguessr/engine";
import { TABLE, ddb, json, subOf } from "./lib/db";
import { RateLimited, checkRunRate } from "./lib/rate";

const RUN_TTL_DAYS = 90;
/** A run must be submitted within this window of being issued. */
const RUN_MAX_AGE_MS = 20 * 60 * 1000;
/** Slack between claimed play time and wall-clock time (fetch, render, submit). */
const WALL_CLOCK_SLACK_MS = 5000;

async function profileOf(sub: string) {
  const res = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { pk: `USER#${sub}`, sk: "PROFILE" } }),
  );
  return res.Item;
}

export const create = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const sub = subOf(event);
  let body: { mode?: unknown };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }
  const mode = String(body.mode ?? "");
  if (!isRankedMode(mode)) return json(400, { error: "Unknown game mode." });

  const profile = await profileOf(sub);
  if (!profile?.handle) {
    return json(409, {
      error: "Claim a handle on your account page before playing ranked.",
    });
  }

  try {
    await checkRunRate(sub);
  } catch (e) {
    if (e instanceof RateLimited) return json(429, { error: e.message });
    throw e;
  }

  const runId = randomUUID();
  const seed = Math.floor(Math.random() * 2 ** 31);
  const issuedAt = Date.now();

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `USER#${sub}`,
        sk: `RUN#${runId}`,
        mode,
        seed,
        issuedAt,
        status: "open",
        ttl: Math.floor(issuedAt / 1000) + RUN_TTL_DAYS * 86400,
      },
    }),
  );

  return json(200, {
    runId,
    mode,
    issuedAt,
    settings: RANKED_SETTINGS,
    endurance: RANKED_ENDURANCE,
    // only the plate layout — the total is the thing being asked
    cards: generateRunCards(mode as RankedMode, seed).map((c) => ({
      sidePlates: c.sidePlates,
    })),
  });
};

export const submit = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const sub = subOf(event);
  const runId = event.pathParameters?.id;
  if (!runId) return json(400, { error: "Missing run id." });

  let body: { answers?: unknown };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }
  const answers = (Array.isArray(body.answers) ? body.answers : []) as SubmittedAnswer[];

  const runRes = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { pk: `USER#${sub}`, sk: `RUN#${runId}` } }),
  );
  const run = runRes.Item;
  if (!run) return json(404, { error: "No such run." });
  if (run.status !== "open") return json(409, { error: "This run was already submitted." });

  // Close the run first: a replay of the same token can never score twice.
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { pk: `USER#${sub}`, sk: `RUN#${runId}` },
        UpdateExpression: "SET #s = :done, submittedAt = :now",
        ConditionExpression: "#s = :open",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":done": "submitted",
          ":open": "open",
          ":now": Date.now(),
        },
      }),
    );
  } catch {
    return json(409, { error: "This run was already submitted." });
  }

  const mode = run.mode as RankedMode;
  const submittedAt = Date.now();
  const elapsed = submittedAt - Number(run.issuedAt);

  if (elapsed > RUN_MAX_AGE_MS) {
    return json(200, { ranked: false, reason: "This run expired before it was submitted." });
  }

  const result = scoreRun(mode, Number(run.seed), answers);
  if (!result.valid) return json(200, { ranked: false, reason: result.reason, ...result });

  const claimed = answers.reduce((t, a) => t + (Number(a.ms) || 0), 0);
  if (claimed > elapsed + WALL_CLOCK_SLACK_MS) {
    return json(200, {
      ranked: false,
      reason: "Reported times don't match the clock.",
      ...result,
    });
  }

  const profile = await profileOf(sub);
  const handle = profile?.handle as string | undefined;
  if (!handle) {
    return json(200, { ranked: false, reason: "Claim a handle to appear on the boards.", ...result });
  }

  // Personal best
  let isPersonalBest = false;
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { pk: `USER#${sub}`, sk: `BEST#${mode}` },
        UpdateExpression: "SET score = :s, rv = :rv, submittedAt = :now",
        ConditionExpression: "attribute_not_exists(rv) OR rv < :rv",
        ExpressionAttributeValues: {
          ":s": result.score,
          ":rv": rankValue(mode, result.score),
          ":now": submittedAt,
        },
      }),
    );
    isPersonalBest = true;
  } catch {
    // existing best is better — leave it
  }

  // Board rows: one per user per window, holding that window's best
  const windows = ["ALL", weekKey(new Date(submittedAt))];
  for (const window of windows) {
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { pk: `LBROW#${mode}#${window}`, sk: `USER#${sub}` },
          UpdateExpression:
            "SET gsi1pk = :gpk, gsi1sk = :gsk, rv = :rv, score = :s, handle = :h, instagram = :ig, submittedAt = :now",
          ConditionExpression: "attribute_not_exists(rv) OR rv < :rv",
          ExpressionAttributeValues: {
            ":gpk": `LB#${mode}#${window}`,
            ":gsk": boardSortKey(mode, result.score, submittedAt),
            ":rv": rankValue(mode, result.score),
            ":s": result.score,
            ":h": handle,
            ":ig": (profile?.instagram as string) ?? null,
            ":now": submittedAt,
          },
        }),
      );
    } catch {
      // window best already better — leave it
    }
    // pointer so account deletion can find every board this user appears on
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: { pk: `USER#${sub}`, sk: `LBREF#${mode}#${window}`, mode, window },
      }),
    );
  }

  // Where the score just played would land on the all-time board — count the
  // board scores strictly better than THIS run (the board keeps each lifter's
  // best, so a worse run shouldn't inherit that best's rank).
  const runSortKey = boardSortKey(mode, result.score, submittedAt);
  const ahead = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: "gsi1",
      KeyConditionExpression: "gsi1pk = :pk AND gsi1sk > :sk",
      ExpressionAttributeValues: { ":pk": `LB#${mode}#ALL`, ":sk": runSortKey },
      Select: "COUNT",
    }),
  );
  const rankPos = (ahead.Count ?? 0) + 1;

  const mine = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { pk: `LBROW#${mode}#ALL`, sk: `USER#${sub}` },
    }),
  );

  return json(200, {
    ranked: true,
    mode,
    score: result.score,
    correct: result.correct,
    attempts: result.attempts,
    accuracy: result.accuracy,
    verdicts: result.verdicts,
    isPersonalBest,
    bestScore: mine.Item?.score ?? result.score,
    rankPos,
    higherIsBetter: isEndurance(mode),
  });
};
