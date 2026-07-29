import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { isRankedMode, weekKey } from "@kiloguessr/engine";
import { TABLE, ddb, json } from "./lib/db";

const TOP_N = 100;

export const get = async (event: APIGatewayProxyEventV2) => {
  const mode = event.pathParameters?.mode ?? "";
  if (!isRankedMode(mode)) return json(400, { error: "Unknown game mode." });

  const wantWeek = event.queryStringParameters?.window === "week";
  const window = wantWeek ? weekKey() : "ALL";

  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: "gsi1",
      KeyConditionExpression: "gsi1pk = :pk",
      ExpressionAttributeValues: { ":pk": `LB#${mode}#${window}` },
      ScanIndexForward: false, // best first
      Limit: TOP_N,
    }),
  );

  return json(200, {
    mode,
    window: wantWeek ? "week" : "all",
    weekKey: window,
    rows: (res.Items ?? []).map((item, i) => ({
      rank: i + 1,
      handle: item.handle,
      instagram: item.instagram ?? null,
      score: item.score,
      submittedAt: item.submittedAt,
      // whether the run behind this score was flagged — the reason itself
      // stays server-side so it can't be used to tune around the check
      suspect: Boolean(item.suspicious),
    })),
  });
};
