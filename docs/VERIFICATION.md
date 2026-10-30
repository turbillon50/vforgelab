# Verification — 2026-10-30

The independent VForgeLab backend was tested on Hetzner against its own Neon
PostgreSQL database and a real NVIDIA model on Nebius Token Factory.

| Check | Observed result |
| --- | --- |
| Automated tests | 8 passed on local Node 24 and Hetzner Node 22 |
| Syntax checks | `npm run check` passed |
| Database structure | 7 tables across `app` and `llm`; `pgcrypto` and `vector` enabled |
| Inference model | `nvidia/nemotron-3-super-120b-a12b` |
| Inference provider | Nebius, `api.studio.nebius.com` |
| Explicit memory retrieval | Stored QA code `ORION-42` returned correctly on two turns |
| First live API turn | HTTP 200; 902 ms; 151 total tokens |
| Second live API turn | HTTP 200; 434 ms; 171 total tokens |
| Persisted conversation | 1 conversation, 4 messages, 1 memory, 2 successful model runs |
| Missing service credential | HTTP 401 |
| Conversation requested for a different owner | HTTP 404 for both history and chat; no model call |
| Telemetry | 1 real Hetzner OS observation stored through the API |

The named memory is a QA fixture, not customer data. The telemetry came from
actual server load and filesystem measurements. No physical device sensor is
claimed as connected. Timings describe these two requests, not a performance
guarantee. The service credential stays in protected server configuration.

The integration runtime listens on loopback. A public demo, Telegram client,
YouTube video and Devpost submission still require their separate completion
and verification. See [the integration handoff](INTEGRATION.md).
