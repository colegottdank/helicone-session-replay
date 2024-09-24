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
 * Abstracted function to build the request tree.
 */
function buildRequestTree(requests: ParsedRequestData[]): TreeNode[] {
  const requestMap: Record<string, TreeNode> = {};
  const roots: TreeNode[] = [];

  // Normalize paths and initialize the request map with empty children arrays
  requests.forEach((request) => {
    const normalizedPath =
      request.path.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
    requestMap[normalizedPath] = {
      ...request,
      path: normalizedPath,
      children: [],
    };
  });

  // Build the tree by linking parents and children
  Object.values(requestMap).forEach((node) => {
    if (node.path === "/") {
      roots.push(node); // Root node
    } else {
      const parentPath =
        node.path.substring(0, node.path.lastIndexOf("/")) || "/";
      const parentNode = requestMap[parentPath];
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        roots.push(node); // In case parent is missing, consider as root
      }
    }
  });

  return roots;
}

/**
 * Abstracted function to process a request node.
 */
async function processRequestNode(
  node: TreeNode,
  newSessionId: string
): Promise<void> {
  const bodyResponse = await fetch(node.signed_body_url);
  const bodyData = await bodyResponse.json();
  let requestBody: RequestBody = bodyData.request;

  // Modify the request body if needed
  requestBody = modifyRequestBody(requestBody);

  const metadata: HeliconeMetadata = {
    sessionId: newSessionId,
    sessionName: SESSION_NAME,
    path: node.path,
  };

  if (node.request_path.includes("chat/completions")) {
    await handleChatCompletion(node.request_path, requestBody, metadata);
  } else if (node.request_path.includes("embeddings")) {
    await handleEmbedding(node.request_path, requestBody, metadata);
  } else {
    console.log(`Unknown request type for ${node.path}`);
  }

  // Process children
  for (const child of node.children) {
    await processRequestNode(child, newSessionId);
  }
}

/**
 * Main function to rerun the session.
 */
async function rerunSession(requests: ParsedRequestData[]) {
  const newSessionId = randomUUID();
  const roots = buildRequestTree(requests);
  console.log(`Roots: ${JSON.stringify(roots)}`);

  // Start processing from the root nodes
  for (const root of roots) {
    await processRequestNode(root, newSessionId);
  }
}

/**
 * Type definitions for TreeNode.
 */
type TreeNode = ParsedRequestData & { children: TreeNode[] };

/**
 * Entry point of the script.
 */
queryHeliconeSession()
  .then(rerunSession)
  .catch((error) => console.error("Error:", error));
