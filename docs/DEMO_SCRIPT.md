# VForgeLab — demonstration script

Target length: **2 minutes 45 seconds**, leaving room below the official
three-minute maximum. Record the functioning application; use actual API results
and database records. Keep credentials and private connection strings off screen.

## Before recording

1. Start the API and verify its application status with a private service client.
2. Prepare an application user and keep its UUID available in the client.
3. Verify one real NVIDIA inference through Nebius with nonempty final content.
4. Prepare a database view or query limited to the demonstration user's records.
5. Confirm that the client and database views hide secrets. Do not record the
   `.env` file, authorization headers or unrelated personal data.

## 0:00–0:20 — The problem

**Say:** “VForgeLab is an independent application that makes AI conversations
persistent and model execution inspectable. Our existing VForge factory inspired
the project, but this app has its own API, database and NVIDIA inference path.”

**Show:** The project name and the short architecture explanation in the README.

## 0:20–0:45 — Application data and ownership

**Say:** “We start with an application user. Conversations, messages and explicit
memories belong to this user, so the application can check ownership before
reading context or generating an answer.”

**Show:** A successful user creation or an existing demonstration user's record.
Show the returned UUID and a conversation request without displaying the API key.

## 0:45–1:25 — Live NVIDIA inference on Nebius

**Say:** “This request calls NVIDIA Nemotron through Nebius Token Factory at
runtime. The server stores the input, receives the model's answer and records
the inference trace.”

**Do:** Send `POST /api/chat` with a short practical prompt such as:

> Explain in two sentences why an app should store conversation history and
> model execution traces separately.

**Show:** The real nonempty response, conversation identifier, model identifier
and trace identifier. If the request fails, do not substitute a prerecorded or
invented answer and describe it as live.

## 1:25–1:55 — Persistence and execution evidence

**Say:** “The reply is not only visible in the client. The conversation and both
messages are stored in PostgreSQL, and this run record identifies the provider,
model, outcome and execution measurements.”

**Show:** Read the conversation's stored messages. Then show the matching
`llm.model_runs` row by trace identifier with only safe columns: provider, model,
status, latency, token usage and timestamps. Use observed values only.

## 1:55–2:20 — Explicit memory

**Say:** “A user can also save an explicit memory and read it back. This is
application-owned persistence. Saving a fact does not train the model or imply
that vector search has already been implemented.”

**Do:** Store the harmless fact “This demo uses PostgreSQL for persistence” using
`POST /api/memories`. Read it using `GET /api/memories?user_id=...`.

**Show:** The same stored fact returned from the API. Only demonstrate automatic
memory retrieval in inference if the final implementation and tests prove it.

## 2:20–2:45 — What is new and how to try it

**Say:** “For this hackathon we built the isolated application API, the app and
LLM database schemas, persistent history, explicit memory and the NVIDIA-on-Nebius
integration with execution records. The public repository includes the setup
instructions and license. Telegram and connected sensors are next integrations;
they are not part of this backend demonstration.”

**Show:** The actual public repository and its README and license. Show the
verified hosted demo URL only after it exists.

## Publish and submit

Upload the finished video as a **public YouTube video of three minutes or less**.
Check the video and repository from a signed-out session. Copy the real video
URL and verified working demo URL into the Devpost entry, then verify the final
submission confirmation. Recording or uploading a video does not itself submit
the project to the hackathon.
