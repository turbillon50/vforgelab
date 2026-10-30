# VForgeLab

**Live demo:** https://vforgelab.vercel.app/

Production is deployed from `main` to Vercel. The PWA opens a signed demo session
without requiring visitors to enter a service token. Its chat uses NVIDIA on
Nebius and persists conversation history in Neon. The Energy view receives real
Hetzner measurements collected every 15 seconds. The scanner is visibly marked
as disconnected; no cleanup operation is enabled.

A small, independent application backend for persistent conversations, explicit
user memory and traceable NVIDIA inference on Nebius. Built for the **Nebius ×
NVIDIA Global AI Hackathon**.

VForge is our existing application factory. VForgeLab is a separate hackathon
application: it has its own API, database and model integration. It does not
require access to the factory's private repositories or operator credentials.

## What this release demonstrates

- An application user and a conversation stored in PostgreSQL.
- A real runtime request to an NVIDIA model through Nebius Token Factory.
- Persisted user input, assistant response and inference-run records.
- Explicit user-owned text memories and a source-labelled telemetry ingestion API.
- Separate `app` and `llm` schemas for application data and LLM history.

The public interface is a PWA backed by signed demo sessions. The operator HTTP
API remains service-authenticated. Telegram integration, connected phone sensors
and autonomous code execution are outside this release. Text memories are stored
data, not model training.

## Architecture

An operator or trusted server calls the Node.js API. The API validates its service
credential and record ownership, stores application data in PostgreSQL, and calls
Nebius Token Factory using a server-side provider key. Model-run records connect
the reply with its model, outcome, latency, usage and trace identifier.

| Layer | Technology or purpose |
| --- | --- |
| API | Node.js HTTP server |
| Database | PostgreSQL; Neon can host it |
| Application data | `app.users`, `app.projects`, `app.telemetry_events` |
| LLM persistence | `llm.conversations`, `llm.messages`, `llm.model_runs`, `llm.memories` |
| Inference provider | Nebius Token Factory, OpenAI-compatible API |
| NVIDIA model | `nvidia/nemotron-3-super-120b-a12b` |
| Optional future vector data | `pgvector`; no fabricated embeddings |

## Run locally

Requirements: Node.js 20.6 or newer, npm, PostgreSQL with `pgcrypto` and `vector`
available, the `psql` client, and a Nebius Token Factory API key entitled to the
configured model. The database role must be able to create the application
schemas and required extensions.

1. Clone this repository and enter its root directory.
2. Install the locked dependencies:

   ```sh
   npm ci
   ```

3. Copy `.env.example` to a local `.env` file and fill in the values described
   below. Keep `.env` out of version control.
4. Apply the additive database schema, with `DATABASE_URL` loaded into the shell:

   ```sh
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/schema.sql
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/verify.sql
   ```

5. Start the API:

   ```sh
   node --env-file=.env src/server.mjs
   ```

`node --env-file` loads variables for Node only. It does not load them into an
earlier `psql` process. Configure `DATABASE_URL` in that process's environment
without printing the connection string.

### Configuration

Keep the database URL, provider key and API service key on the server. Never place
them in a browser bundle, public demo, URL, screenshot or repository.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string, including required TLS settings. |
| `VFORGELAB_API_KEY` | Private operator/service credential; at least 32 characters. |
| `NEBIUS_API_KEY` | Server-side Nebius Token Factory inference credential. |
| `NEBIUS_BASE_URL` | Nebius inference base URL: `https://api.studio.nebius.com/v1`. |
| `NEBIUS_MODEL` | NVIDIA model identifier: `nvidia/nemotron-3-super-120b-a12b`. |
| `HOST` | Listen address; default `127.0.0.1`. |
| `PORT` | HTTP listen port; default `3248`. |
| `NEBIUS_TIMEOUT_MS` | Provider request timeout; default `120000`. |
| `NEBIUS_MAX_TOKENS` | Provider output token budget; default `4096`. |

## Use the API

See [the API contract](docs/API.md) for exact routes, payloads, ownership rules and
error behavior. `GET /health` is a minimal liveness check. All application routes
require `Authorization: Bearer <VFORGELAB_API_KEY>`.

The basic sequence is:

1. Create an application user with `POST /api/users`.
2. Send that user's message to `POST /api/chat`.
3. Save the returned conversation and trace identifiers.
4. Read the conversation messages and verify that the input and response persist.
5. Save and read an explicit memory with `/api/memories`.

The service key authorizes trusted operators. A caller-supplied `user_id` is not
end-user authentication. A public browser or Telegram client requires its own
server-verified user session before these routes can be exposed to it.

## Verification

Live database, memory and NVIDIA inference checks passed on 2026-10-30.
See [the observed results](docs/VERIFICATION.md) and
[the frontend integration handoff](docs/INTEGRATION.md).

```sh
npm test
```

Tests run through Node's test runner. Local automated tests are separate from
live verification: a working demonstration must also show a real successful
Nebius inference and the corresponding persisted records. Use `db/verify.sql`
for database structure checks; it does not prove inference availability.

## Hackathon materials

- [Submission description and checklist](docs/SUBMISSION.md)
- [Three-minute demonstration script](docs/DEMO_SCRIPT.md)
- [Official event requirements](https://nebiusglobalaihackathon.devpost.com/)
- [Official rules](https://nebiusglobalaihackathon.devpost.com/rules)

The public deployment URL, public YouTube video and submitted Devpost entry must
be added only after they exist and have been checked. This repository does not
claim an entry has been submitted.

## License

See the repository's `LICENSE` file. The final public submission must include an
open-source license visible on the repository page.
