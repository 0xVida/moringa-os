import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const targetUrl = req.nextUrl.searchParams.get("url");
  if (!targetUrl) return new Response("Missing URL", { status: 400 });

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!['host', 'origin', 'referer', 'content-length'].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const body = await req.arrayBuffer();

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers,
    body,
    // @ts-ignore
    duplex: 'half'
  });

  const resBody = await response.arrayBuffer();
  
  const resHeaders = new Headers();
  response.headers.forEach((value, key) => {
    resHeaders.set(key, value);
  });

  return new Response(resBody, {
    status: response.status,
    statusText: response.statusText,
    headers: resHeaders
  });
}

export async function GET(req: NextRequest) {
  const targetUrl = req.nextUrl.searchParams.get("url");
  if (!targetUrl) return new Response("Missing URL", { status: 400 });

  const response = await fetch(targetUrl);
  const resBody = await response.arrayBuffer();
  
  const resHeaders = new Headers();
  response.headers.forEach((value, key) => {
    resHeaders.set(key, value);
  });

  return new Response(resBody, {
    status: response.status,
    statusText: response.statusText,
    headers: resHeaders
  });
}
