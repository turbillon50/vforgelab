# VForgeLab — submission draft

## Project name

VForgeLab

## Recommended track

**Best Apps and Agents.** This release demonstrates an application with persistent
conversations, explicit memory and NVIDIA inference. Select Coding and Agentic
Engineering only if the submitted working build also demonstrates agents that
write, execute or test code. A developer-oriented API alone does not establish
that behavior.

## Short description

VForgeLab connects application data, conversation history and NVIDIA inference
in an independent, auditable backend. It makes AI conversations durable and
connects model responses to stored execution records.

## Inspiration

We already operate VForge, an application factory. Building practical AI tools
exposed a recurring problem: the application state, the chat history and the
model's execution evidence often live in different places. A response can appear
successful while its context is lost or its inference path cannot be verified.

VForgeLab explores a smaller, inspectable foundation that keeps those records
together while giving the new application its own data boundary.

## What it does

The API creates application users and conversations, persists messages, invokes
an NVIDIA model on Nebius Token Factory, and stores the assistant response with
an inference-run record. It also supports explicit text memories and an ingestion
route for observations labelled with their source and timestamp.

The database separates ordinary application records in the `app` schema from
conversation, memory and execution records in the `llm` schema. Conversation
ownership is checked in the API and reinforced by database constraints.

## How we built it

The application uses a Node.js HTTP API and PostgreSQL. Its model requests use
the Nebius Token Factory OpenAI-compatible inference API at
`https://api.studio.nebius.com/v1`, with the NVIDIA model
`nvidia/nemotron-3-super-120b-a12b` configured on the server.

API authentication and provider authentication remain server-side. Each chat
operation is associated with the owning application user and a conversation.
Model-run records preserve the provider, model identifier, execution outcome,
usage metrics, latency and trace identifier without exposing credentials.

Explicit memories are persisted text. The schema also permits future real
embeddings through `pgvector`; no embedding generation, vector retrieval or
training is claimed by the initial release.

## NVIDIA and Nebius usage

The qualifying integration is a runtime model request to **Nebius Token Factory**
using an **NVIDIA open-source model**. The judge-facing demonstration should show
the resulting assistant output and matching persisted run record. A configured
key, model name or HTTP health response alone is not proof of a successful model
execution.

The database host and the API host are independent of the inference provider.
This release does not claim that its PostgreSQL database or Node.js process runs
on Nebius AI Cloud.

## Existing project and work completed for the hackathon

**Existing foundation:** VForge is the separate application factory that
motivated this experiment. It already exists and remains a distinct product.

**Hackathon work:** VForgeLab introduces an independent API and database boundary,
separate application and LLM schemas, persistent conversations and explicit
memory, a direct NVIDIA-on-Nebius inference path, and auditable model-run records.
The hackathon application does not require copying private memory from another
assistant or exposing VForge's operator credentials.

The submitted repository's commits and live evidence should identify the actual
changes made during the official submission period. Do not attribute older
factory capabilities to this new application.

## Challenges

The main engineering challenge is making a model response verifiable beyond the
chat window: preserving ownership, writing a coherent conversation history and
recording a sanitized execution result when the upstream provider succeeds or
fails. Keeping the experiment independent from the existing factory also makes
its dependencies and data scope easier to inspect.

## Feedback on the tools

Nebius Token Factory's OpenAI-compatible API allowed a focused integration using
ordinary HTTP requests. A useful improvement for builders would be clearer
guidance about output-token budgets and reasoning output: a successful HTTP
request with a very small token budget can still yield no usable final answer.
Applications should verify final assistant content, retain token usage and
distinguish provider availability from a completed user-visible answer.

This feedback describes the integration work. Do not add benchmark comparisons,
cost savings or production-reliability claims without measured evidence.

## Current scope and next steps

The initial deliverable is a service-authenticated backend. Telegram Mini Apps,
verified end-user sessions, connected collectors and device sensors are future
integrations. Autonomous execution, infrastructure repair and model training are
not demonstrated by this release.

Next steps are a verified user-facing client, a tightly scoped telemetry adapter
and retrieval based on explicitly selected user memory. Each will need its own
working evidence before it is described as implemented.

## Final submission checklist

- [ ] Public repository URL resolves for a signed-out reviewer.
- [ ] Open-source `LICENSE` is present and visible on the repository page.
- [x] README setup and run instructions match the final code.
- [ ] Working hosted demo or test-build URL has been checked.
- [x] Real NVIDIA-on-Nebius inference produces nonempty assistant output.
- [x] Database contains the demonstrated conversation, messages and model run.
- [ ] Public YouTube video is three minutes or shorter.
- [ ] Description and track match the behavior actually demonstrated.
- [x] Significant hackathon changes to the existing foundation are disclosed.
- [x] Nebius/NVIDIA feedback is included.
- [ ] Credentials, private connection strings and private user data are absent
      from the public repository and video.
- [ ] Devpost entry is submitted and its confirmation is checked.

No deployment URL, video URL or submission confirmation is invented in this draft.
