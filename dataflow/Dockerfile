# syntax=docker/dockerfile:1.7

FROM maven:3.9-eclipse-temurin-17 AS builder

ARG DATAFLOW_TEMPLATES_REF=2026-05-26-00_RC00

WORKDIR /opt
RUN git clone --depth 1 --branch "${DATAFLOW_TEMPLATES_REF}" \
    https://github.com/GoogleCloudPlatform/DataflowTemplates.git dataflow-templates

WORKDIR /opt/dataflow-templates
RUN sed -i '/<!-- Testing -->/,/<\/dependencies>/ { /<\/dependencies>/!d; }' \
    v2/googlecloud-to-clickhouse/pom.xml
RUN --mount=type=cache,target=/root/.m2 \
    mvn -pl v2/googlecloud-to-clickhouse -am \
    -DskipTests \
    -Dmaven.test.skip=true \
    -DskipITs \
    -Djib.skip=true \
    install
RUN --mount=type=cache,target=/root/.m2 \
    mvn -f v2/googlecloud-to-clickhouse/pom.xml \
    -DskipTests \
    -Dmaven.test.skip=true \
    -Djib.skip=true \
    dependency:build-classpath \
    -Dmdep.includeScope=compile \
    -Dmdep.outputFile=/opt/dataflow-classpath.txt && \
    cp -a /root/.m2 /opt/m2

FROM maven:3.9-eclipse-temurin-17

WORKDIR /opt/dataflow

COPY --from=builder /opt/m2 /root/.m2
COPY --from=builder /opt/dataflow-templates/v2/googlecloud-to-clickhouse/target /opt/dataflow/target
COPY --from=builder /opt/dataflow-classpath.txt /opt/dataflow/classpath.txt
COPY run.sh /opt/dataflow/run.sh

RUN chmod +x /opt/dataflow/run.sh

ENTRYPOINT ["/opt/dataflow/run.sh"]
