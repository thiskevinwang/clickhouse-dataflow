# Local Pub/Sub To ClickHouse Dataflow

![Overview](docs/image.png)

This project runs a local Pub/Sub to ClickHouse ingestion stack with Docker Compose:

- Bun/Hono API event producer that emits random OpenTelemetry LogRecord Events
- GCP Pub/Sub emulator
- Local Apache Beam `DirectRunner` execution of the upstream `PubSubToClickHouse` template
- ClickHouse with native JSON columns for OTel body, resource, scope, and attributes
- Load generator

## Run

Use `make help` to list available targets.

- `make config` validates the Compose configuration.
- `make build` builds the local API and Dataflow images.
- `make up` builds and runs the full stack in the foreground.
- `make start` builds and runs the full stack in the background.
- `make ps` shows service status.
- `make logs` shows recent Compose logs.
- `make down` stops and removes Compose containers.
- `make reset` stops the stack and removes Compose volumes; use this after
  schema changes if ClickHouse already has old local tables.
- `make schema-reset` recreates only the ClickHouse event tables for the current
  schema and restarts Dataflow so it rediscovers the table shape; this drops
  local event rows but keeps the rest of the stack and volumes.

## API

- `make health` calls the API health endpoint.
- `make event` publishes one generated OpenTelemetry event.
- `make batch COUNT=20` publishes a generated OpenTelemetry event batch.

The API publishes one OTel LogRecord/Event per Pub/Sub message. Each message uses
OTLP/JSON lower-camel field names such as `timeUnixNano`, `traceId`, `spanId`,
`severityNumber`, `body`, `resource`, `instrumentationScope`, `attributes`, and
`eventName`.

Generated event types are weighted rather than uniform, so distribution queries
show a more realistic long-tail shape.

The Pub/Sub payload keeps `attributes` in OTLP's array-of-key-values shape. The
final ClickHouse `events.attributes` JSON column stores that array under
`values` because ClickHouse 25.8 native `JSON` columns require an object at the
root.

## ClickHouse

- `make count` counts ingested events.
- `make sample` shows recent ingested events.
- `make timeseries` shows event counts over time using ClickHouse `bar()`.
- `make distribution` shows event-name distribution using ClickHouse `bar()`.

If `make sample` reports that the `events` table is not using the OpenTelemetry
schema, run `make schema-reset` and then publish new events.

The time series query groups events into buckets, counts rows and traces, counts
warning-or-higher events, and draws an inline bar scaled to the busiest bucket:

```sql
WITH toStartOfInterval(timestamp, INTERVAL 1 MINUTE) AS bucket
SELECT
    bucket,
    count() AS events,
    uniqExact(traceId) AS traces,
    countIf(severityNumber >= 13) AS warn_or_higher,
    bar(events, 0, max(events) OVER (), 40) AS events_bar
FROM events
WHERE timestamp >= now() - INTERVAL 30 MINUTE
GROUP BY bucket
ORDER BY bucket ASC;
```

Override the Make target window and bucket size as needed:

```sh
make timeseries TIME_WINDOW="1 HOUR" TIME_BUCKET="10 SECOND" BAR_WIDTH=60
```

The distribution query groups recent events by `eventName`, calculates each
event type's share of the total, and draws an inline bar scaled to the most
frequent event type:

```sql
SELECT
    eventName,
    count() AS events,
    round(events * 100.0 / sum(events) OVER (), 2) AS pct,
    countIf(severityNumber >= 13) AS warn_or_higher,
    bar(events, 0, max(events) OVER (), 40) AS events_bar
FROM events
WHERE timestamp >= now() - INTERVAL 30 MINUTE
GROUP BY eventName
ORDER BY events DESC, eventName ASC
FORMAT PrettyCompact;
```

Override the Make target window and bar width as needed:

```sh
make distribution TIME_WINDOW="1 HOUR" BAR_WIDTH=60
```

## Load Test

- `make load` runs k6 with the default settings.
- `make load K6_VUS=20 K6_DURATION=1m K6_SLEEP=0.2` overrides the default k6 settings.

## Dead Letter

- `make malformed` publishes a malformed Pub/Sub message.
- `make dead-letter` shows recent ClickHouse dead-letter rows.
