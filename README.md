# Helicone Session Replay Example

A simple Node.js and TypeScript project demonstrating how to replay a Helicone session.

## Setup

1. **Install Dependencies:**

   ```bash
   yarn install
   ```

2. **Configure Environment Variables:**

   Create a `.env` file in the root directory:

   ```
   HELICONE_API_KEY=your_helicone_api_key
   OPENAI_API_KEY=your_openai_api_key
   ```

3. **Running the Script:**

   ```bash
   yarn start
   ```

## What it does

This script queries a specific Helicone session, retrieves all the requests made during that session, and then replays those requests while creating a new session. It handles both chat completions and embeddings requests.

## Note

Make sure you have the necessary API keys and permissions to use both Helicone and OpenAI services.
