import {
  decideZSocialAccess,
  zSocialGraphSnapshot,
} from "../../src/lib/z-social-graph-demo";

type PagesContext = {
  request: Request;
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const url = new URL(context.request.url);
  const viewer = url.searchParams.get("viewer") ?? "subscriber-8f2";
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(viewer)) {
    return Response.json({ error: "INVALID_DEMO_VIEWER" }, { status: 400, headers: JSON_HEADERS });
  }
  return Response.json({
    service: "zeeroagent-access-brain",
    status: "live-read-only",
    mode: "synthetic-demo",
    grantsProtectedAccess: false,
    receiptOwnershipVerified: false,
    checkedAt: new Date().toISOString(),
    decision: decideZSocialAccess(viewer),
    graph: zSocialGraphSnapshot,
    boundaries: [
      "GET-only demo endpoint",
      "no wallet connection",
      "no signing",
      "no Devnet mutation",
      "no graph signature publication",
      "no private notes, witnesses, balances, or keys",
    ],
  }, { headers: JSON_HEADERS });
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === "GET") return onRequestGet(context);
  if (context.request.method === "HEAD") {
    const response = await onRequestGet(context);
    return new Response(null, { status: response.status, headers: response.headers });
  }
  return Response.json({ error: "METHOD_NOT_ALLOWED" }, {
    status: 405,
    headers: { ...JSON_HEADERS, allow: "GET, HEAD" },
  });
}
