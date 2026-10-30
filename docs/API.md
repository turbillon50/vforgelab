# VForgeLab API contract

The service-authenticated operator API described below runs internally. The
deployed PWA uses a separate signed-cookie gateway under `/mia/api/` for session,
chat, telemetry and scanner status. See INTEGRATION.md. The public gateway never
accepts a caller-selected user UUID or exposes the operator credential.

This document defines the initial server API. It does not claim an endpoint has
been deployed or Telegram has been implemented.

## Authentication and ownership

Every route except the minimal liveness endpoint `GET /health` requires
`Authorization: Bearer <VFORGELAB_API_KEY>`. The server environment holds this key;
never embed it in a browser, Telegram Mini App, bot message, URL or repository.
`GET /health` may be protected too, but its public response must disclose only
basic availability, without configuration or database details.

`user_id` identifies the owner of records. The server verifies each conversation
belongs to that user before reading history, writing messages or invoking the
model. Access to memories and telemetry must also be scoped by `user_id`.
The API key is currently an operator/service credential; passing `user_id` is
not end-user authentication. A public client requires a server-verified user
session before receiving access to these routes. Telegram `initData` verification
and a Telegram-to-app user mapping are a later integration, not part of this base.

IDs are UUID strings. `telegram_id` is a decimal string to preserve integer
precision. Timestamps use ISO 8601 with timezone; JSON payloads use UTF-8.

## Routes

| Method and route | Request | Result |
| --- | --- | --- |
| `GET /health` | None | Minimal liveness status. |
| `GET /api/status` | None | Authenticated database/model readiness; no secret values. |
| `POST /api/users` | `{ "telegram_id"?: "123456789", "display_name": "Luis" }` | Creates or resolves an application user. A duplicate Telegram ID must not silently transfer ownership. |
| `POST /api/conversations` | `{ "user_id": "uuid", "title"?: "Infrastructure" }` | Creates a conversation owned by the specified existing user. |
| `GET /api/conversations/:id/messages?user_id=uuid` | Owner in query | Returns the owner's messages in chronological order. |
| `POST /api/chat` | `{ "user_id": "uuid", "conversation_id"?: "uuid", "message": "Review these metrics" }` | Creates or checks a conversation, persists the user input, calls the configured NVIDIA model on Nebius, persists the assistant reply and inference trace. |
| `GET /api/memories?user_id=uuid` | Owner in query | Returns only that user's stored memories. |
| `POST /api/memories` | `{ "user_id": "uuid", "content": "A saved fact", "metadata"?: {} }` | Persists user-owned text memory; does not invent embeddings. |
| `POST /api/telemetry` | `{ "user_id": "uuid", "source": "hetzner", "metrics": { "disk_used_pct": 76 }, "observed_at"?: "2026-10-30T16:00:00Z" }` | Records an observation with source, owner and observation time. Only real observations are submitted. |

Success JSON must contain the created/read resource or an explicit `ok` status.
Chat results should include `conversation_id`, assistant message, provider/model,
and `trace_id` so the caller can connect a visible reply with a stored run.
Validate request sizes and types before database or provider calls. Use 400 for
invalid input, 401 for missing/invalid service authentication, 404 for missing or
inaccessible resources, and a sanitized 5xx error when an upstream service fails.
Do not return raw provider response bodies, connection strings or stack traces.

## Database mapping

Apply `db/schema.sql` to the application's PostgreSQL database, then inspect
`db/verify.sql`. The migration is additive and safe to re-run. No sample users or
invented data are seeded.

| Table | Purpose |
| --- | --- |
| `app.users` | Application UUID, optional unique Telegram identifier, display name. |
| `app.projects` | Optional user ownership, project name, status and metadata. |
| `app.telemetry_events` | User, source, actual observation timestamp, metrics JSON. |
| `llm.conversations` | User-owned conversation title and timestamps. |
| `llm.messages` | Conversation, user, role, content and timestamp. A composite foreign key enforces matching conversation ownership. |
| `llm.model_runs` | User/conversation, associated input message, provider/model, status, usage JSON, latency, trace and sanitized error code. |
| `llm.memories` | User-owned text, metadata and optional real embedding. |

`llm.model_runs.status` is one of `pending`, `running`, `succeeded`, `failed`.
Provider errors are recorded only as safe codes such as `provider_timeout`.
The `usage` object stores numeric token counts and equivalent provider metrics;
it must not become a container for prompts, credentials or raw errors.

`pgcrypto` supplies UUID generation. `pgvector` supplies
`llm.memories.embedding vector` without a fixed dimension. Both extensions are
enabled by the migration; Neon PostgreSQL supports them. Keep embeddings null
until a real embedding model has been selected. Record its provider/model/version and
dimension in metadata, and never compare vectors from incompatible models.
There is no vector ANN index until a concrete model and dimensionality are known.

The `llm` schema stores history and memory, **not trained model weights**. Persisting
messages does not train or fine-tune the NVIDIA model. Retrieval, embedding
generation and any training pipeline are separate capabilities.

## Initial integration boundary

The application calls NVIDIA through Nebius at runtime using server-side
credentials and a configured model identifier. Do not claim readiness from a
configured environment variable alone: verify one real successful model call.
Existing VForge infrastructure may provide observations through a backend adapter;
keep its operator keys and existing private memories inside their own services.
This initial API contains no Telegram bot, Mini App, device-sensor collection,
payment, deployment or infrastructure-control endpoints.
