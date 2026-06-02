.DEFAULT_GOAL := help

COMPOSE ?= docker compose
API_URL ?= http://localhost:8000
COUNT ?= 20
K6_VUS ?= 5
K6_DURATION ?= 30s
K6_SLEEP ?= 1
TAIL ?= 100
MALFORMED_MESSAGE ?= not valid json

.PHONY: help
help: ALIGN=24
help: ## Print this message
	@awk -F '::? .*## ' "/^[^':]+::? .*## / { printf \"%-$(ALIGN)s %s\n\", \$$1, \$$2 }" $(MAKEFILE_LIST)

.PHONY: config
config: ## Validate the Docker Compose configuration
	$(COMPOSE) config

.PHONY: build
build: ## Build all Docker Compose images
	$(COMPOSE) build

.PHONY: up
up: ## Build and run the full stack in the foreground
	$(COMPOSE) up --build

.PHONY: start
start: ## Build and run the full stack in the background
	$(COMPOSE) up -d --build

.PHONY: down
down: ## Stop and remove Compose containers
	$(COMPOSE) down

.PHONY: ps
ps: ## Show Compose service status
	$(COMPOSE) ps

.PHONY: logs
logs: ## Show recent Compose logs (TAIL=100)
	$(COMPOSE) logs --tail=$(TAIL)

.PHONY: health
health: ## Call the API health endpoint
	curl -fsS "$(API_URL)/health"

.PHONY: event
event: ## Publish one generated event through the API
	curl -fsS -X POST "$(API_URL)/events"

.PHONY: batch
batch: ## Publish a generated event batch through the API (COUNT=20)
	curl -fsS -X POST "$(API_URL)/events/batch?count=$(COUNT)"

.PHONY: count
count: ## Count ingested events in ClickHouse
	$(COMPOSE) exec -T clickhouse clickhouse-client --query "SELECT count() FROM events"

.PHONY: sample
sample: ## Show recent ingested events in ClickHouse
	$(COMPOSE) exec -T clickhouse clickhouse-client --query "SELECT event_id, event_type, source, occurred_at, payload FROM events ORDER BY occurred_at DESC LIMIT 5 FORMAT Vertical"

.PHONY: load
load: ## Run k6 against the API (K6_VUS=5 K6_DURATION=30s K6_SLEEP=1)
	$(COMPOSE) --profile load run --rm \
		-e K6_VUS="$(K6_VUS)" \
		-e K6_DURATION="$(K6_DURATION)" \
		-e K6_SLEEP="$(K6_SLEEP)" \
		k6

.PHONY: malformed
malformed: ## Publish a malformed Pub/Sub message to exercise dead-letter handling
	$(COMPOSE) exec -T pubsub sh -lc '\
		export PUBSUB_EMULATOR_HOST=localhost:8085; \
		export CLOUDSDK_CORE_PROJECT=local-project; \
		export CLOUDSDK_AUTH_DISABLE_CREDENTIALS=true; \
		/google-cloud-sdk/bin/gcloud config set auth/disable_credentials true >/dev/null; \
		/google-cloud-sdk/bin/gcloud config set project local-project >/dev/null; \
		/google-cloud-sdk/bin/gcloud config set api_endpoint_overrides/pubsub http://localhost:8085/ >/dev/null; \
		/google-cloud-sdk/bin/gcloud pubsub topics publish events --message="$(MALFORMED_MESSAGE)" --project=local-project; \
	'

.PHONY: dead-letter
dead-letter: ## Show recent ClickHouse dead-letter rows
	$(COMPOSE) exec -T clickhouse clickhouse-client --query "SELECT raw_message, error_message, failed_at FROM events_dead_letter ORDER BY failed_at DESC LIMIT 5 FORMAT Vertical"
