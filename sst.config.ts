/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "kiloguessr",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: { region: "us-east-1" },
      },
    };
  },
  async run() {
    const isProd = $app.stage === "production";

    const table = new sst.aws.Dynamo("Table", {
      fields: {
        pk: "string",
        sk: "string",
        gsi1pk: "string",
        gsi1sk: "string",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      globalIndexes: {
        gsi1: { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
      },
    });

    const userPool = new sst.aws.CognitoUserPool("UserPool", {
      usernames: ["email"],
    });
    const userPoolClient = userPool.addClient("WebClient");

    const api = new sst.aws.ApiGatewayV2("Api", {
      domain: isProd ? { name: "api.kiloguessr.liftinglookup.com" } : undefined,
      cors: {
        allowOrigins: isProd
          ? ["https://kiloguessr.liftinglookup.com"]
          : ["*"],
        allowHeaders: ["authorization", "content-type"],
        allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
      },
    });

    const jwtAuthorizer = api.addAuthorizer({
      name: "cognito",
      jwt: {
        issuer: $interpolate`https://cognito-idp.us-east-1.amazonaws.com/${userPool.id}`,
        audiences: [userPoolClient.id],
      },
    });
    const authed = { auth: { jwt: { authorizer: jwtAuthorizer.id } } };

    api.route(
      "GET /v1/me",
      { handler: "packages/functions/src/me.get", link: [table] },
      authed,
    );
    api.route(
      "PATCH /v1/me",
      { handler: "packages/functions/src/me.patch", link: [table] },
      authed,
    );
    api.route("GET /v1/users/{handle}", {
      handler: "packages/functions/src/users.get",
      link: [table],
    });

    api.route(
      "POST /v1/runs",
      { handler: "packages/functions/src/runs.create", link: [table] },
      authed,
    );
    api.route(
      "POST /v1/runs/{id}/submit",
      { handler: "packages/functions/src/runs.submit", link: [table] },
      authed,
    );
    api.route("GET /v1/leaderboards/{mode}", {
      handler: "packages/functions/src/leaderboards.get",
      link: [table],
    });

    const web = new sst.aws.Nextjs("Web", {
      path: "apps/web",
      domain: isProd ? { name: "kiloguessr.liftinglookup.com" } : undefined,
      environment: {
        NEXT_PUBLIC_USER_POOL_ID: userPool.id,
        NEXT_PUBLIC_USER_POOL_CLIENT_ID: userPoolClient.id,
        NEXT_PUBLIC_API_URL: api.url,
      },
    });

    return { web: web.url, api: api.url };
  },
});
