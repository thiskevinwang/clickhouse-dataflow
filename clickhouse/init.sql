CREATE TABLE IF NOT EXISTS events
(
    timeUnixNano UInt64,
    observedTimeUnixNano UInt64,
    timestamp DateTime64(9, 'UTC'),
    observedTimestamp DateTime64(9, 'UTC'),
    traceId String,
    spanId String,
    flags UInt32,
    severityNumber UInt8,
    severityText LowCardinality(String),
    body JSON,
    resource JSON,
    instrumentationScope JSON,
    attributes JSON,
    droppedAttributesCount UInt32,
    eventName LowCardinality(String)
)
ENGINE = MergeTree()
ORDER BY (timestamp, eventName, traceId);

CREATE TABLE IF NOT EXISTS events_ingest
(
    timeUnixNano String,
    observedTimeUnixNano String,
    traceId String,
    spanId String,
    flags UInt32,
    severityNumber UInt8,
    severityText String,
    body Nullable(String),
    resource Nullable(String),
    instrumentationScope Nullable(String),
    attributes Nullable(String),
    droppedAttributesCount UInt32,
    eventName String
)
ENGINE = MergeTree()
ORDER BY (timeUnixNano, eventName, traceId);

CREATE MATERIALIZED VIEW IF NOT EXISTS events_ingest_to_events
TO events
AS
SELECT
    toUInt64(timeUnixNano) AS timeUnixNano,
    toUInt64(observedTimeUnixNano) AS observedTimeUnixNano,
    fromUnixTimestamp64Nano(toInt64(timeUnixNano)) AS timestamp,
    fromUnixTimestamp64Nano(toInt64(observedTimeUnixNano)) AS observedTimestamp,
    traceId,
    spanId,
    flags,
    severityNumber,
    severityText,
    coalesce(body, '{"stringValue":""}')::JSON AS body,
    coalesce(resource, '{"attributes":[],"droppedAttributesCount":0}')::JSON AS resource,
    coalesce(instrumentationScope, '{"name":"","version":"","attributes":[],"droppedAttributesCount":0}')::JSON AS instrumentationScope,
    concat('{"values":', coalesce(attributes, '[]'), '}')::JSON AS attributes,
    droppedAttributesCount,
    eventName
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
