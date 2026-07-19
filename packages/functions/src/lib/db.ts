import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";

export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLE = (Resource as unknown as { Table: { name: string } }).Table
  .name;

export const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const subOf = (event: APIGatewayProxyEventV2WithJWTAuthorizer): string =>
  String(event.requestContext.authorizer.jwt.claims.sub);
