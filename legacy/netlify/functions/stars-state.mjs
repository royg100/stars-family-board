import { getStore } from "@netlify/blobs";

const STORE_NAME = "stars-behavior-board";
const BLOB_KEY = "app-state";

function unauthorized() {
  return new Response("Forbidden", { status: 403 });
}

function checkToken(request) {
  const expected = (process.env.STARS_ACCESS_TOKEN || "").trim();
  if (!expected) return true;
  const url = new URL(request.url);
  const q = (url.searchParams.get("token") || "").trim();
  const h = (request.headers.get("x-stars-token") || "").trim();
  return q === expected || h === expected;
}

export default async (request) => {
  if (!checkToken(request)) return unauthorized();

  const store = getStore(STORE_NAME);

  if (request.method === "GET") {
    const data = await store.get(BLOB_KEY, { type: "json" });
    return Response.json(data ?? {});
  }

  if (request.method === "PUT") {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Bad JSON", { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return new Response("State must be a JSON object", { status: 400 });
    }
    await store.setJSON(BLOB_KEY, body);
    return Response.json({ ok: true });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  return new Response("Method Not Allowed", { status: 405 });
};
