> Why the ingest table exists: the upstream Beam ClickHouseIO parser in this Dataflow template cannot parse native ClickHouse JSON columns during schema discovery. I verified that payload JSON directly on the Dataflow target fails at startup. The staging table keeps the real upstream template working while the final analytical table gets a native ClickHouse JSON column.

Reference docs used:

- ClickHouse JSON type: https://clickhouse.com/docs/sql-reference/data-types/newjson
- Upstream Pub/Sub to ClickHouse template source: https://raw.githubusercontent.com/GoogleCloudPlatform/DataflowTemplates/2026-05-26-00_RC00/v2/googlecloud-to-clickhouse/src/main/java/com/google/cloud/teleport/v2/clickhouse/templates/PubSubToClickHouse.java
