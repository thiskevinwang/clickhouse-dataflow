CREATE TABLE IF NOT EXISTS events
(
    event_id String,
    event_type String,
    user_id String,
    session_id String,
    occurred_at DateTime,
    amount Float64,
    quantity UInt32,
    source String,
    payload JSON
)
ENGINE = MergeTree()
ORDER BY (occurred_at, event_id);

CREATE TABLE IF NOT EXISTS events_ingest
(
    event_id String,
    event_type String,
    user_id String,
    session_id String,
    occurred_at DateTime,
    amount Float64,
    quantity UInt32,
    source String,
    payload Nullable(String)
)
ENGINE = MergeTree()
ORDER BY (occurred_at, event_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS events_ingest_to_events
TO events
AS
SELECT
    event_id,
    event_type,
    user_id,
    session_id,
    occurred_at,
    amount,
    quantity,
    source,
    coalesce(payload, '{}')::JSON AS payload
FROM events_ingest;

CREATE TABLE IF NOT EXISTS events_dead_letter
(
    raw_message String,
    error_message String,
    stack_trace String,
    failed_at DateTime
)
ENGINE = MergeTree()
ORDER BY failed_at;
