#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-local-project}"
EVENTS_TOPIC="${EVENTS_TOPIC:-events}"
EVENTS_SUBSCRIPTION="${EVENTS_SUBSCRIPTION:-events-sub}"
DLQ_TOPIC="${DLQ_TOPIC:-events-dlq}"
DLQ_SUBSCRIPTION="${DLQ_SUBSCRIPTION:-events-dlq-sub}"
PUBSUB_EMULATOR_HOST="${PUBSUB_EMULATOR_HOST:-pubsub:8085}"

export CLOUDSDK_CORE_PROJECT="$PROJECT_ID"
export CLOUDSDK_AUTH_DISABLE_CREDENTIALS=true

gcloud config set auth/disable_credentials true >/dev/null
gcloud config set project "$PROJECT_ID" >/dev/null
gcloud config set api_endpoint_overrides/pubsub "http://${PUBSUB_EMULATOR_HOST}/" >/dev/null

host="${PUBSUB_EMULATOR_HOST%:*}"
port="${PUBSUB_EMULATOR_HOST##*:}"

for _ in $(seq 1 60); do
  if bash -c "</dev/tcp/${host}/${port}" 2>/dev/null; then
    break
  fi
  sleep 1
done

ensure_topic() {
  local topic="$1"
  if ! gcloud pubsub topics describe "$topic" --project "$PROJECT_ID" >/dev/null 2>&1; then
    gcloud pubsub topics create "$topic" --project "$PROJECT_ID" --quiet
  fi
}

ensure_subscription() {
  local subscription="$1"
  local topic="$2"
  if ! gcloud pubsub subscriptions describe "$subscription" --project "$PROJECT_ID" >/dev/null 2>&1; then
    gcloud pubsub subscriptions create "$subscription" \
      --topic "$topic" \
      --project "$PROJECT_ID" \
      --quiet
  fi
}

ensure_topic "$EVENTS_TOPIC"
ensure_topic "$DLQ_TOPIC"
ensure_subscription "$EVENTS_SUBSCRIPTION" "$EVENTS_TOPIC"
ensure_subscription "$DLQ_SUBSCRIPTION" "$DLQ_TOPIC"

gcloud pubsub topics list --project "$PROJECT_ID" --format="table(name)"
gcloud pubsub subscriptions list --project "$PROJECT_ID" --format="table(name,topic)"
