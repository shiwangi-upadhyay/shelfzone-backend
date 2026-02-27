-- NOTE: These require TimescaleDB extension. Wrapped in DO block with exception handling
-- so migration doesn't fail on standard PostgreSQL (graceful degradation).

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS timescaledb;
  PERFORM create_hypertable('agent_sessions', 'created_at', if_not_exists => TRUE);
  PERFORM create_hypertable('agent_cost_ledger', 'created_at', if_not_exists => TRUE);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'TimescaleDB not available — using standard tables (this is fine for dev)';
END $$;

-- Production: Enable compression after 7 days
-- SELECT add_compression_policy('agent_sessions', INTERVAL '7 days');
-- SELECT add_compression_policy('agent_cost_ledger', INTERVAL '7 days');
