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

    new sst.aws.Nextjs("Web", {
      path: "apps/web",
      domain: isProd
        ? { name: "kiloguessr.liftinglookup.com" }
        : undefined,
    });
  },
});
