# Deploying KiloGuessr

Production deploys run in **GitHub Actions** (`.github/workflows/deploy.yml`),
which assumes an AWS IAM role via **OIDC** — a short-lived, repo-scoped token,
no long-lived access key anywhere. Pushing to `main` deploys.

SST v3 keeps its state in AWS (an S3 bucket + SSM in the account), so CI
continues the same stack local deploys created — nothing is recreated.

---

## One-time setup

Run these from the repo root. AWS commands use your `kiloguessr-deploy` profile;
you (not Claude) run them — IAM changes need your hands.

Account id: **248898759724**. Your repo: **goosebones/kiloguessr**. Both are
hardcoded below — don't use shell variables in the trust policy (unset vars
silently produce a broken policy, which fails with
`Not authorized to perform sts:AssumeRoleWithWebIdentity`).

### 1. Create the GitHub repo and push

With the `gh` CLI (`brew install gh && gh auth login`):

```sh
gh repo create "$REPO" --private --source=. --remote=origin --push
```

Or via the web: create an empty repo, then:

```sh
git remote add origin "git@github.com:$REPO.git"
git push -u origin main
```

### 2. Register GitHub's OIDC provider in AWS (skip if it already exists)

```sh
aws --profile kiloguessr-deploy iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

(AWS validates GitHub's token against its own trust store now; the thumbprint is
required by the API but no longer load-bearing.)

### 3. Create the deploy role, trusted only by this repo's `main`

Write the trust policy with **literal values** (single-quoted heredoc, no
expansion):

```sh
cat > /tmp/kiloguessr-ci-trust.json <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::248898759724:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:goosebones/kiloguessr:ref:refs/heads/main"
      }
    }
  }]
}
JSON

# create the role (or, if it already exists, use update-assume-role-policy):
aws --profile kiloguessr-deploy iam create-role \
  --role-name kiloguessr-ci-deploy \
  --assume-role-policy-document file:///tmp/kiloguessr-ci-trust.json
# aws --profile kiloguessr-deploy iam update-assume-role-policy \
#   --role-name kiloguessr-ci-deploy --policy-document file:///tmp/kiloguessr-ci-trust.json

# SST needs broad permissions; scope later if desired. The win here is that
# there is no standing key — only this repo's main branch can assume it.
aws --profile kiloguessr-deploy iam attach-role-policy \
  --role-name kiloguessr-ci-deploy \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

Role ARN: `arn:aws:iam::248898759724:role/kiloguessr-ci-deploy`

Verify the policy took (no blank `iam:::` or `repo::ref`):

```sh
aws --profile kiloguessr-deploy iam get-role \
  --role-name kiloguessr-ci-deploy --query "Role.AssumeRolePolicyDocument"
```

### 4. Tell the workflow which role to assume

```sh
gh variable set AWS_DEPLOY_ROLE_ARN \
  --body "arn:aws:iam::${ACCOUNT}:role/kiloguessr-ci-deploy"
```

Or in the web UI: **Settings → Secrets and variables → Actions → Variables →
New variable**, name `AWS_DEPLOY_ROLE_ARN`.

### 5. Deploy

The push in step 1 already kicked off a run that **failed** at "Assume AWS role"
(the role/variable didn't exist yet — expected). Now that steps 2–4 are done,
re-run it: **Actions → Deploy → Run workflow**, or push any commit to `main`.

### 6. Retire the local keys

List the keys — the `AccessKeyId` values in the output are what go in the
`--access-key-id` slot below:

```sh
aws --profile kiloguessr-deploy iam list-access-keys --user-name kiloguessr-deploy
```

There are two, deleted at different times:

- **The old compromised key** (its secret was echoed to a terminal) — delete it
  **now**, it's unused:
  ```sh
  aws --profile kiloguessr-deploy iam delete-access-key \
    --user-name kiloguessr-deploy --access-key-id AKIATT44FVQWPJIAMCFQ
  ```
- **The current key** the local profile uses — delete it **after** a CI deploy
  succeeds, so nothing standing remains:
  ```sh
  aws --profile kiloguessr-deploy iam delete-access-key \
    --user-name kiloguessr-deploy --access-key-id AKIATT44FVQWE4PB4WHC
  ```

You can keep the `kiloguessr-deploy` user (now keyless) for occasional local use
via `aws login`, or delete it entirely.

---

## Local deploy (fallback, while the key still exists)

```sh
pnpm deploy   # cleans .next/.open-next, then sst deploy via the local profile
```
