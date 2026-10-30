# Verification — 2026-10-30

## Production release

- URL: https://vforgelab.vercel.app/
- Vercel production deployment from `main`: `dca6de6`.
- 11 automated tests passed, including signed-cookie integrity and request ownership.
- Public HTTPS session creation, telemetry read and NVIDIA chat returned HTTP 200.
- Live model replied `VFORGELAB_LIVE_OK`; the visible browser chat also replied
  `VForgeLab está en línea.` with a measured 589 ms inference and saved-history status.
- Browser inspection confirmed the premium shell, automatic session and actual
  disk/RAM/load values in Energy. The collector is active every 15 seconds.
- All repository branches have been incorporated into `main`; only `main` remains.

The earlier backend-only verification below is retained as the initial baseline.

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

The operator runtime listens on loopback; the public PWA is deployed on Vercel.
Telegram, the YouTube video and Devpost submission require their separate
completion and verification. See [the integration handoff](INTEGRATION.md).
