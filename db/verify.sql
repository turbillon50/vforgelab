-- Read-only verification: expected tables, ownership links, indexes, extensions.
SELECT current_database() AS database_name, now() AS checked_at;

SELECT expected.schema_name, expected.table_name,
       to_regclass(format('%I.%I', expected.schema_name, expected.table_name)) IS NOT NULL AS present
FROM (VALUES
  ('app', 'users'), ('app', 'projects'), ('app', 'telemetry_events'),
  ('llm', 'conversations'), ('llm', 'messages'), ('llm', 'model_runs'), ('llm', 'memories')
) AS expected(schema_name, table_name)
ORDER BY expected.schema_name, expected.table_name;

SELECT extname, extversion FROM pg_extension WHERE extname IN ('pgcrypto', 'vector') ORDER BY extname;

SELECT table_schema, table_name, column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema IN ('app', 'llm')
ORDER BY table_schema, table_name, ordinal_position;

SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'llm' AND table_name = 'memories'
    AND column_name = 'embedding' AND udt_name = 'vector'
) AS vector_storage_available;

SELECT ns.nspname AS schema_name, rel.relname AS table_name,
       con.conname AS constraint_name, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = rel.relnamespace
WHERE ns.nspname IN ('app', 'llm')
ORDER BY ns.nspname, rel.relname, con.conname;

SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes WHERE schemaname IN ('app', 'llm')
ORDER BY schemaname, tablename, indexname;
