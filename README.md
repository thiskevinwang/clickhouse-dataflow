# Local Pub/Sub To ClickHouse Dataflow

![Overview](docs/image.png)

This project runs a local Pub/Sub to ClickHouse ingestion stack with Docker Compose:

- Bun/Hono API event producer
- GCP Pub/Sub emulator
- Local Apache Beam `DirectRunner` execution of the upstream `PubSubToClickHouse` template
- ClickHouse
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

## API

- `make health` calls the API health endpoint.
- `make event` publishes one generated event.
- `make batch COUNT=20` publishes a generated event batch.

## ClickHouse

- `make count` counts ingested events.
- `make sample` shows recent ingested events.

## Load Test

- `make load` runs k6 with the default settings.
- `make load K6_VUS=20 K6_DURATION=1m K6_SLEEP=0.2` overrides the default k6 settings.

## Dead Letter

- `make malformed` publishes a malformed Pub/Sub message.
- `make dead-letter` shows recent ClickHouse dead-letter rows.
