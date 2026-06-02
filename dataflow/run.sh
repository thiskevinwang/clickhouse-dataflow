#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-local-project}"
PUBSUB_ROOT_URL="${PUBSUB_ROOT_URL:-http://pubsub:8085}"
INPUT_SUBSCRIPTION="${INPUT_SUBSCRIPTION:-projects/local-project/subscriptions/events-sub}"
DEAD_LETTER_TOPIC="${DEAD_LETTER_TOPIC:-projects/local-project/topics/events-dlq}"
CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://clickhouse:8123}"
CLICKHOUSE_DATABASE="${CLICKHOUSE_DATABASE:-default}"
CLICKHOUSE_TABLE="${CLICKHOUSE_TABLE:-events}"
CLICKHOUSE_USERNAME="${CLICKHOUSE_USERNAME:-default}"
CLICKHOUSE_PASSWORD="${CLICKHOUSE_PASSWORD:-}"
CLICKHOUSE_DEAD_LETTER_TABLE="${CLICKHOUSE_DEAD_LETTER_TABLE:-events_dead_letter}"
WINDOW_SECONDS="${WINDOW_SECONDS:-5}"
BATCH_ROW_COUNT="${BATCH_ROW_COUNT:-10}"

jar="$(find /opt/dataflow/target -maxdepth 1 -name 'googlecloud-to-clickhouse-*.jar' ! -name 'original-*' | head -n 1)"
if [[ -z "${jar}" ]]; then
  echo "Unable to find googlecloud-to-clickhouse jar in /opt/dataflow/target" >&2
  exit 1
fi

classpath="${jar}:$(cat /opt/dataflow/classpath.txt)"

args=(
  "--runner=DirectRunner"
  "--project=${PROJECT_ID}"
  "--streaming=true"
  "--pubsubRootUrl=${PUBSUB_ROOT_URL}"
  "--inputSubscription=${INPUT_SUBSCRIPTION}"
  "--clickHouseUrl=${CLICKHOUSE_URL}"
  "--clickHouseDatabase=${CLICKHOUSE_DATABASE}"
  "--clickHouseTable=${CLICKHOUSE_TABLE}"
  "--clickHouseUsername=${CLICKHOUSE_USERNAME}"
  "--clickHousePassword=${CLICKHOUSE_PASSWORD}"
  "--clickHouseDeadLetterTable=${CLICKHOUSE_DEAD_LETTER_TABLE}"
  "--deadLetterTopic=${DEAD_LETTER_TOPIC}"
  "--windowSeconds=${WINDOW_SECONDS}"
  "--batchRowCount=${BATCH_ROW_COUNT}"
)

echo "Starting PubSubToClickHouse pipeline"
exec java ${JAVA_OPTS:-} -cp "${classpath}" \
  com.google.cloud.teleport.v2.clickhouse.templates.PubSubToClickHouse \
  "${args[@]}"
