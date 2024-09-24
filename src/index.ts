import { randomUUID } from "crypto";
import { resolve } from "path";

require("dotenv").config({ path: resolve(__dirname, "../.env") });

type ParsedRequestData = {
  created_at: string;
  latest_request_created_at: string;
  session: string;
  total_cost: number;
  total_requests: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  signed_body_url: string;
  request_path: string;
  path: string; // Add this line
};

async function queryHeliconeSession(): Promise<ParsedRequestData[]> {
  const requests = await fetch("https://api.helicone.ai/v1/request/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.HELICONE_API_KEY || ""}`,
    },
    body: JSON.stringify({
      filter: {
        properties: {
          "Helicone-Session-Id": {
            equals: "ab264595-30be-4828-b401-3de6ea8446f5",
          },
        },
      },
    }),
  });

  const requestsData = await requests.json();
  const parsedRequestsData = parseRequestData(requestsData);

  return parsedRequestsData;
}

function parseRequestData(requestData: any): ParsedRequestData[] {
  return requestData.data
    .map((request: any) => ({
      created_at: request.request_created_at,
      latest_request_created_at: request.response_created_at,
      session: request.request_properties?.["Helicone-Session-Id"] || "",
      total_cost: request.costUSD || 0,
      total_requests: "1", // Each request represents one API call
      prompt_tokens: request.prompt_tokens || 0,
      completion_tokens: request.completion_tokens || 0,
      total_tokens: request.total_tokens || 0,
      signed_body_url: request.signed_body_url || "",
      request_path: request.request_path || "",
      path:
        (request.request_properties?.["Helicone-Session-Path"] as string) ??
        "/",
    }))
    .sort(
      (a: ParsedRequestData, b: ParsedRequestData) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
}

type RequestBody = {
  model?: string;
  messages?: any[];
  input?: string | string[];
  type?: string;
};

type HeliconeMetadata = {
  sessionId: string;
  sessionName: string;
  path: string;
};

async function rerunSession(sessionData: ParsedRequestData[]) {
  // Sort the requests by path and then by creation time
  const sessionId = randomUUID();
  const sortedRequests = sessionData.sort((a, b) => {
    if (a.path === b.path) {
      return (
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }
    return a.path.localeCompare(b.path);
  });

  for (const request of sortedRequests) {
    const bodyResponse = await fetch(request.signed_body_url);
    const bodyData: { request: RequestBody } = await bodyResponse.json();

    const { request: requestBody } = bodyData;

    if (request.request_path.includes("chat/completions")) {
      await handleChatCompletion(request, requestBody, {
        sessionId,
        path: request.path,
        sessionName: request.session,
      });
    } else if (request.request_path.includes("embeddings")) {
      await handleEmbedding(request, requestBody, {
        sessionId,
        path: request.path,
        sessionName: request.session,
      });
    } else if (requestBody.type === "vector_db") {
      console.log(`Ignoring vector_db call for ${request.path}`);
    } else {
      console.log(`Unknown request type for ${request.path}`);
    }
  }
}

async function handleChatCompletion(
  request: ParsedRequestData,
  body: RequestBody,
  heliconeMetadata: HeliconeMetadata
) {
  console.log(`Calling chat/completions for ${request.path}`);
  const response = await fetch(request.request_path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
      "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY || ""}`,
      "Helicone-Session-Id": heliconeMetadata.sessionId,
      "Helicone-Session-Name": heliconeMetadata.sessionName,
      "Helicone-Session-Path": heliconeMetadata.path,
    },
    body: JSON.stringify({ model: body.model, messages: body.messages }),
  });

  const responseData = await response.json();
  console.log(`Response for ${request.path}:`, responseData);
}

async function handleEmbedding(
  request: ParsedRequestData,
  body: RequestBody,
  heliconeMetadata: HeliconeMetadata
) {
  console.log(`Calling embeddings for ${request.path}`);
  const response = await fetch(request.request_path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
      "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY || ""}`,
      "Helicone-Session-Id": heliconeMetadata.sessionId,
      "Helicone-Session-Path": heliconeMetadata.path,
      "Helicone-Session-Name": heliconeMetadata.sessionName,
    },
    body: JSON.stringify({ model: body.model, input: body.input }),
  });

  const responseData = await response.json();
  console.log(`Response for ${request.path}:`, responseData);
}

queryHeliconeSession().then((data) => rerunSession(data));
