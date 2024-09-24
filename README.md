# Helicone Session Replay and Modification Example

A Node.js and TypeScript project showcasing how to:

- **Replay a Helicone session:** Fetch and execute the exact sequence of API calls from a previous session.
- **Modify session messages:** Change the content of the messages to see how different inputs affect the session's outcomes.
- **Analyze new sessions in Helicone:** The replayed and modified sessions will appear in Helicone for further analysis.

## Prerequisites

- **Node.js** installed (version 14 or higher recommended)
- **Yarn** package manager installed
- **Helicone API Key:** Obtain from [Helicone](https://www.helicone.ai/)
- **OpenAI API Key:** Obtain from [OpenAI](https://platform.openai.com/account/api-keys)

## Setup

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/yourusername/helicone-session-replay.git
   cd helicone-session-replay
   ```

2. **Install Dependencies:**

   ```bash
   yarn install
   ```

3. **Configure Environment Variables:**

   Create a `.env` file in the root directory with the following content:

   ```
   HELICONE_API_KEY=your_helicone_api_key
   OPENAI_API_KEY=your_openai_api_key
   SESSION_ID=your_session_id_to_replay
   ```

   - Replace `your_helicone_api_key` and `your_openai_api_key` with your actual API keys.
   - Replace `your_session_id_to_replay` with the Helicone session ID you wish to replay.

4. **Modify Session Messages (Optional):**

   If you want to experiment by changing the messages or inputs in the session:

   - Open `src/index.ts`.
   - Locate the `modifyRequestBody` function.
   - Implement your logic to alter the `requestBody` as desired.

   ```typescript
   function modifyRequestBody(requestBody: RequestBody): RequestBody {
     // Example modification: Add a prefix to all messages
     if (requestBody.messages) {
       requestBody.messages = requestBody.messages.map((message) => ({
         ...message,
         content: `Modified: ${message.content}`,
       }));
     }
     return requestBody;
   }
   ```

5. **Running the Script:**

   ```bash
   yarn start
   ```

## What It Does

This script:

- **Queries a specific Helicone session** based on the `SESSION_ID` you provided.
- **Retrieves all the requests** made during that session.
- **Allows modification** of the session's messages or inputs before replaying.
- **Replays the modified requests**, creating a new session.
- **Handles various request types**, such as chat completions and embeddings.

## Viewing the New Session in Helicone

After running the script:

- Log into your Helicone dashboard.
- Navigate to the sessions view.
- You will see a new session with the modified requests, identified by a new `sessionId`.

## Important Notes

- **Session ID:** The `SESSION_ID` in the `.env` file is crucial for querying the correct session. Ensure you set it to the session you intend to replay.
- **API Keys:** Make sure your `HELICONE_API_KEY` and `OPENAI_API_KEY` are valid and have the necessary permissions.
- **Data Privacy:** Be cautious with any sensitive data contained in the sessions you replay or modify.
- **Modifications:** Changing the messages can significantly impact the responses from the OpenAI API.

## Troubleshooting

- **Missing SESSION_ID:** If you receive an error about a missing `SESSION_ID`, ensure you have set it correctly in your `.env` file.
- **Invalid API Keys:** Double-check that your API keys are correct and have not expired.
- **API Errors:** If you encounter errors from OpenAI's API, review your request modifications for correctness.

## Contact

For issues or questions, please contact [support@helicone.ai](mailto:support@helicone.ai) or open an issue on this repository.
