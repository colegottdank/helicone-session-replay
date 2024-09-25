import { randomUUID } from "crypto";
import { resolve } from "path";

require("dotenv").config({ path: resolve(__dirname, "../.env") });

const SESSION_ID_TO_REPLAY = process.env.SESSION_ID;
const HELICONE_API_KEY = process.env.HELICONE_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const SESSION_NAME = "Capital_Finder";

if (!SESSION_ID_TO_REPLAY) {
  console.error("Error: SESSION_ID is not set in the .env file.");
  process.exit(1);
}

type ParsedRequestData = {
  created_at: string;
  session: string;
  signed_body_url: string;
  request_path: string;
  path: string;
};

type RequestBody = {
  model?: string;
  messages?: any[];
  input?: string | string[];
};

type HeliconeMetadata = {
  sessionId: string;
  sessionName: string;
  path: string;
};

// Abstracted helper functions

/**
 * Fetches the session data from Helicone.
 */
async function queryHeliconeSession(): Promise<ParsedRequestData[]> {
  const response = await fetch("https://api.helicone.ai/v1/request/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HELICONE_API_KEY}`,
    },
    body: JSON.stringify({
      filter: {
        properties: {
          "Helicone-Session-Id": {
            equals: SESSION_ID_TO_REPLAY,
          },
        },
      },
    }),
  });

  const data = await response.json();

  return data.data.map((request: any) => ({
    created_at: request.request_created_at,
    session: request.request_properties?.["Helicone-Session-Id"] || "",
    signed_body_url: request.signed_body_url || "",
    request_path: request.request_path || "",
    path: request.request_properties?.["Helicone-Session-Path"] || "/",
  }));
}

/**
 * Modifies the request body as needed before replaying.
 */
function modifyRequestBody(requestBody: RequestBody): RequestBody {
  if (requestBody.messages) {
    const systemMessageIndex = requestBody.messages.findIndex(
      (message) => message.role === "system"
    );

    if (systemMessageIndex !== -1) {
      // Append to existing system message
      requestBody.messages[systemMessageIndex].content +=
        " Return response in French";
    } else {
      // If no system message exists, add a new one at the beginning
      requestBody.messages.unshift({
        role: "system",
        content: "This is an additional system prompt.",
      });
    }
  }

  return requestBody;
}

/**
 * Handles chat completion requests.
 */
async function handleChatCompletion(
  requestPath: string,
  body: RequestBody,
  metadata: HeliconeMetadata
) {
  console.log(`Calling chat/completions for ${metadata.path}`);
  const response = await fetch(requestPath, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Helicone-Auth": `Bearer ${HELICONE_API_KEY}`,
      "Helicone-Session-Id": metadata.sessionId,
      "Helicone-Session-Name": metadata.sessionName,
      "Helicone-Session-Path": metadata.path,
    },
    body: JSON.stringify({ model: body.model, messages: body.messages }),
  });

  const responseData = await response.json();
  console.log(`Response for ${metadata.path}:`, responseData);
}

/**
 * Handles embedding requests.
 */
async function handleEmbedding(
  requestPath: string,
  body: RequestBody,
  metadata: HeliconeMetadata
) {
  console.log(`Calling embeddings for ${metadata.path}`);
  const response = await fetch(requestPath, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Helicone-Auth": `Bearer ${HELICONE_API_KEY}`,
      "Helicone-Session-Id": metadata.sessionId,
      "Helicone-Session-Name": metadata.sessionName,
      "Helicone-Session-Path": metadata.path,
    },
    body: JSON.stringify({ model: body.model, input: body.input }),
  });

  const responseData = await response.json();
  console.log(`Response for ${metadata.path}:`, responseData);
}

/**
 * Main function to rerun the session.
 */
async function rerunSession(requests: ParsedRequestData[]) {
  const newSessionId = randomUUID();

  // Sort the requests by created_at timestamp
  requests.sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Process each request sequentially
  for (const request of requests) {
    await processSingleRequest(request, newSessionId);
  }
}

/**
 * Processes a single request.
 */
async function processSingleRequest(
  request: ParsedRequestData,
  newSessionId: string
): Promise<void> {
  const bodyResponse = await fetch(request.signed_body_url);
  const bodyData = await bodyResponse.json();
  let requestBody: RequestBody = bodyData.request;

  // Modify the request body if needed
  requestBody = modifyRequestBody(requestBody);

  const metadata: HeliconeMetadata = {
    sessionId: newSessionId,
    sessionName: SESSION_NAME,
    path: request.path,
  };

  if (request.request_path.includes("chat/completions")) {
    await handleChatCompletion(request.request_path, requestBody, metadata);
  } else if (request.request_path.includes("embeddings")) {
    await handleEmbedding(request.request_path, requestBody, metadata);
  } else {
    console.log(`Unknown request type for ${metadata.path}`);
  }
}

/**
 * Entry point of the script.
 */
queryHeliconeSession()
  .then(rerunSession)
  .catch((error) => console.error("Error:", error));
