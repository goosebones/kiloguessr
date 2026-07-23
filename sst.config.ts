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
      transform: {
        // guard against an accidental table delete (PITR is already on)
        table: (args) => {
          args.deletionProtectionEnabled = isProd;
        },
      },
    });

    const userPool = new sst.aws.CognitoUserPool("UserPool", {
      usernames: ["email"],
      transform: {
        userPool: {
          // Length over composition rules: a long passphrase beats "Password1!".
          passwordPolicy: {
            minimumLength: 10,
            requireLowercase: false,
            requireUppercase: false,
            requireNumbers: false,
            requireSymbols: false,
            temporaryPasswordValidityDays: 7,
          },
          deletionProtection: isProd ? "ACTIVE" : "INACTIVE",
        },
      },
    });
    const userPoolClient = userPool.addClient("WebClient", {
      transform: {
        client: (args) => {
          // don't reveal whether an email is registered (blocks enumeration)
          args.preventUserExistenceErrors = "ENABLED";
          // app uses SRP auth, not the hosted UI — turn OAuth off entirely
          args.allowedOauthFlowsUserPoolClient = false;
          args.allowedOauthFlows = [];
          args.allowedOauthScopes = [];
          args.callbackUrls = [];
        },
      },
    });

    const api = new sst.aws.ApiGatewayV2("Api", {
      domain: isProd ? { name: "api.kiloguessr.liftinglookup.com" } : undefined,
      cors: {
        allowOrigins: isProd
          ? ["https://kiloguessr.liftinglookup.com"]
          : ["*"],
        allowHeaders: ["authorization", "content-type"],
        allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      },
      transform: {
        // cap request rate per route so nobody can hammer the public
        // endpoints and run up DynamoDB/Lambda cost (429 over the limit)
        stage: (args) => {
          args.defaultRouteSettings = {
            throttlingBurstLimit: 40,
            throttlingRateLimit: 20,
          };
        },
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
    api.route(
      "DELETE /v1/me",
      {
        handler: "packages/functions/src/account.remove",
        link: [table],
        environment: { USER_POOL_ID: userPool.id },
        permissions: [
          { actions: ["cognito-idp:AdminDeleteUser"], resources: [userPool.arn] },
        ],
      },
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
