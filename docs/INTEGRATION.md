# Frontend and Telegram integration handoff

VForgeLab is the independent NVIDIA-on-Nebius backend in this repository. The
existing VForge factory remains a separate application. This release uses its
own application records and LLM memory.

## Current integration target

The verified backend runs on Hetzner at `http://127.0.0.1:3248`. This address is
reachable by another backend on the same host; it is not a public browser URL.
The checkout and private environment are in
`/root/vforgelab-hackathon-20261030`. Read the service credential from the protected
server configuration when wiring another trusted backend. Never send that key
to a Mini App or browser.

- Server-side upstream: `http://127.0.0.1:3248`.
- Service authentication: `Authorization: Bearer <VFORGELAB_API_KEY>`.
- Data store: Neon project `odd-bonus-03878191`, database `vforgelab`.
- Provider: Nebius Token Factory, NVIDIA `nvidia/nemotron-3-super-120b-a12b`.
- Exact HTTP contract: [API.md](API.md).

## Minimal client sequence

1. Verify the end-user identity in the frontend's backend. For Telegram, verify
   signed `initData` and its age before trusting the Telegram user ID.
2. Resolve the verified Telegram ID through `POST /api/users`, with `telegram_id`
   encoded as a decimal string. Keep the returned application UUID in the
   server-side identity mapping.
3. Call `POST /api/chat` with that UUID as `user_id` and the user's `message`.
   Include `conversation_id` on subsequent turns.
4. Render `message.content`. Retain `conversation_id`, `trace_id` and `run_id` for
   history and verification. The response also includes actual `model`, `usage`
   and `latency_ms`.
5. Store explicit memory with `POST /api/memories`; recent memories are supplied
   to subsequent model calls. Embedding generation is not enabled.

The service key is a trusted-backend credential, not a user session. Derive the
application UUID from the verified identity; do not accept an arbitrary UUID
from a public client. Keep upstream calls on the server.

Device readings can be forwarded to `POST /api/telemetry` with their real source
and observation time. Telemetry ingestion by itself does not activate sensors.
The initial server is an integration runtime; public HTTPS routing and the
Telegram interface belong to the separate frontend integration.
