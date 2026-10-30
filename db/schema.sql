-- VForgeLab — application data and LLM history. Safe to re-run.
-- Run with an application database owner; no users or sample data are seeded.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS llm;

CREATE TABLE IF NOT EXISTS app.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id text UNIQUE,
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (telegram_id IS NULL OR telegram_id ~ '^[0-9]{1,20}$')
);

CREATE TABLE IF NOT EXISTS app.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES app.users(id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  description text,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.telemetry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users(id),
  source text NOT NULL CHECK (length(btrim(source)) BETWEEN 1 AND 120),
  observed_at timestamptz NOT NULL DEFAULT now(),
  metrics jsonb NOT NULL CHECK (jsonb_typeof(metrics) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS llm.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users(id),
  title text NOT NULL DEFAULT 'New conversation' CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

CREATE TABLE IF NOT EXISTS llm.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES app.users(id),
  role text NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content text NOT NULL CHECK (length(content) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, conversation_id),
  FOREIGN KEY (conversation_id, user_id) REFERENCES llm.conversations(id, user_id)
);

CREATE TABLE IF NOT EXISTS llm.model_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users(id),
  conversation_id uuid,
  message_id uuid,
  provider text NOT NULL CHECK (length(btrim(provider)) BETWEEN 1 AND 80),
  model text NOT NULL CHECK (length(btrim(model)) BETWEEN 1 AND 200),
  status text NOT NULL CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
  usage jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(usage) = 'object'),
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  trace_id text NOT NULL DEFAULT gen_random_uuid()::text,
  error_code text CHECK (error_code IS NULL OR error_code ~ '^[A-Za-z0-9_.:-]{1,100}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  FOREIGN KEY (conversation_id, user_id) REFERENCES llm.conversations(id, user_id),
  FOREIGN KEY (message_id, conversation_id) REFERENCES llm.messages(id, conversation_id),
  CHECK (message_id IS NULL OR conversation_id IS NOT NULL),
  CHECK (completed_at IS NULL OR completed_at >= created_at)
);

CREATE TABLE IF NOT EXISTS llm.memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users(id),
  content text NOT NULL CHECK (length(btrim(content)) > 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  embedding vector,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_user_created_idx ON app.projects (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS telemetry_user_observed_idx ON app.telemetry_events (user_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS telemetry_source_observed_idx ON app.telemetry_events (source, observed_at DESC);
CREATE INDEX IF NOT EXISTS conversations_user_updated_idx ON llm.conversations (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON llm.messages (conversation_id, created_at, id);
CREATE INDEX IF NOT EXISTS messages_user_created_idx ON llm.messages (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS model_runs_user_created_idx ON llm.model_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS model_runs_conversation_created_idx ON llm.model_runs (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS model_runs_trace_idx ON llm.model_runs (trace_id);
CREATE INDEX IF NOT EXISTS memories_user_created_idx ON llm.memories (user_id, created_at DESC);

COMMENT ON SCHEMA app IS 'VForgeLab application identities, projects and telemetry';
COMMENT ON SCHEMA llm IS 'Persisted conversation history, inference traces and user memories; not model weights';
COMMENT ON COLUMN llm.model_runs.error_code IS 'Sanitized application error code only; never provider response bodies, credentials or raw exception messages';
COMMENT ON TABLE llm.memories IS 'User-owned text memories; embeddings remain null until generated by a real, versioned embedding model';

COMMIT;
