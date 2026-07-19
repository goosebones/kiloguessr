import { Amplify } from "aws-amplify";

let configured = false;

export function ensureAmplify() {
  if (configured) return;
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID!,
        userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID!,
      },
    },
  });
  configured = true;
}

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

/** Fetch an API route with the caller's Cognito ID token attached. */
export async function authedFetch(path: string, init?: RequestInit) {
  ensureAmplify();
  const { fetchAuthSession } = await import("aws-amplify/auth");
  const token = (await fetchAuthSession()).tokens?.idToken?.toString();
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  });
}
