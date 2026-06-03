import { Hono } from "hono";

type AnyValue =
  | { stringValue: string }
  | { intValue: string }
  | { doubleValue: number }
  | { boolValue: boolean }
  | { arrayValue: { values: AnyValue[] } }
  | { kvlistValue: { values: KeyValue[] } };

type KeyValue = {
  key: string;
  value: AnyValue;
};

type OtelEvent = {
  timeUnixNano: string;
  observedTimeUnixNano: string;
  traceId: string;
  spanId: string;
  flags: number;
  severityNumber: number;
  severityText: string;
  body: AnyValue;
  resource: {
    attributes: KeyValue[];
    droppedAttributesCount: number;
  };
  instrumentationScope: {
    name: string;
    version: string;
    attributes: KeyValue[];
    droppedAttributesCount: number;
  };
  attributes: KeyValue[];
  droppedAttributesCount: number;
  eventName: string;
};

type PublishResponse = {
  messageIds?: string[];
};

const projectId = Bun.env.PROJECT_ID ?? "local-project";
const eventsTopic = Bun.env.EVENTS_TOPIC ?? "events";
const pubsubEmulatorHost = Bun.env.PUBSUB_EMULATOR_HOST ?? "pubsub:8085";
const topicPath = `projects/${projectId}/topics/${eventsTopic}`;
const publishUrl = `http://${pubsubEmulatorHost}/v1/${topicPath}:publish`;

const eventTemplates = [
  { name: "app.page.viewed", body: "Page viewed", severityNumber: 9, severityText: "INFO", weight: 42 },
  { name: "app.cart.item_added", body: "Item added to cart", severityNumber: 9, severityText: "INFO", weight: 24 },
  { name: "app.checkout.started", body: "Checkout started", severityNumber: 9, severityText: "INFO", weight: 15 },
  { name: "app.payment.succeeded", body: "Payment succeeded", severityNumber: 9, severityText: "INFO", weight: 10 },
  { name: "app.user.signed_up", body: "User signed up", severityNumber: 9, severityText: "INFO", weight: 7 },
  { name: "app.payment.refunded", body: "Payment refunded", severityNumber: 13, severityText: "WARN", weight: 2 },
] as const;

const serviceNames = ["checkout-api", "catalog-api", "identity-api", "billing-worker"] as const;
const deploymentEnvironments = ["local", "staging", "production"] as const;
const clientPlatforms = ["web", "ios", "android", "partner-api"] as const;

const app = new Hono();
const byteToHex = Array.from({ length: 256 }, (_, index) => index.toString(16).padStart(2, "0"));

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(values: readonly T[]): T {
  return values[randomInt(0, values.length - 1)];
}

function randomWeighted<T extends { weight: number }>(values: readonly T[]): T {
  const totalWeight = values.reduce((sum, value) => sum + value.weight, 0);
  let threshold = Math.random() * totalWeight;

  for (const value of values) {
    threshold -= value.weight;
    if (threshold < 0) {
      return value;
    }
  }

  return values[values.length - 1];
}

function unixNanoNow(offsetMillis = 0): string {
  return (BigInt(Date.now() + offsetMillis) * 1_000_000n + BigInt(randomInt(0, 999_999))).toString();
}

function randomHex(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (byte) => byteToHex[byte]).join("");
}

function stringValue(value: string): AnyValue {
  return { stringValue: value };
}

function intValue(value: number): AnyValue {
  return { intValue: String(value) };
}

function doubleValue(value: number): AnyValue {
  return { doubleValue: value };
}

function boolValue(value: boolean): AnyValue {
  return { boolValue: value };
}

function keyValue(key: string, value: AnyValue): KeyValue {
  return { key, value };
}

function eventAttributes(eventName: string): KeyValue[] {
  const common = [
    keyValue("session.id", stringValue(randomHex(16))),
    keyValue("user.id", stringValue(`user-${randomInt(1, 5000)}`)),
    keyValue("client.platform", stringValue(randomChoice(clientPlatforms))),
    keyValue("app.version", stringValue(`${randomInt(1, 4)}.${randomInt(0, 9)}.${randomInt(0, 9)}`)),
    keyValue("feature.flag.variant", stringValue(randomChoice(["control", "checkout-redesign", "pricing-copy"]))),
    keyValue("campaign.id", stringValue(`cmp-${randomInt(100, 999)}`)),
    keyValue("synthetic", boolValue(true)),
  ];

  switch (eventName) {
    case "app.page.viewed":
      return [
        ...common,
        keyValue("url.path", stringValue(randomChoice(["/", "/pricing", "/docs", "/checkout"]))),
        keyValue("http.request.method", stringValue("GET")),
        keyValue("http.response.status_code", intValue(randomChoice([200, 200, 200, 304, 404]))),
        keyValue("referrer.type", stringValue(randomChoice(["direct", "search", "newsletter", "partner"]))),
      ];
    case "app.payment.succeeded":
      return [
        ...common,
        keyValue("payment.method", stringValue(randomChoice(["card", "ach", "wallet"]))),
        keyValue("payment.amount", doubleValue(Math.round((Math.random() * 499 + 1) * 100) / 100)),
        keyValue("payment.currency", stringValue("USD")),
        keyValue("cart.item_count", intValue(randomInt(1, 12))),
      ];
    case "app.payment.refunded":
      return [
        ...common,
        keyValue("payment.amount", doubleValue(Math.round((Math.random() * 249 + 1) * 100) / 100)),
        keyValue("payment.currency", stringValue("USD")),
        keyValue("refund.reason", stringValue(randomChoice(["duplicate", "customer_request", "fraud_review"]))),
        keyValue("cart.item_count", intValue(randomInt(1, 3))),
      ];
    case "app.cart.item_added":
      return [
        ...common,
        keyValue("cart.item_count", intValue(randomInt(1, 12))),
        keyValue("product.sku", stringValue(`sku-${randomInt(10000, 99999)}`)),
        keyValue("product.price", doubleValue(Math.round((Math.random() * 99 + 1) * 100) / 100)),
      ];
    case "app.checkout.started":
      return [
        ...common,
        keyValue("cart.item_count", intValue(randomInt(1, 12))),
        keyValue("checkout.step", stringValue(randomChoice(["shipping", "payment", "review"]))),
        keyValue("server.latency_ms", intValue(randomInt(20, 900))),
      ];
    default:
      return [
        ...common,
        keyValue("auth.provider", stringValue(randomChoice(["password", "github", "google", "saml"]))),
        keyValue("signup.plan", stringValue(randomChoice(["free", "team", "enterprise"]))),
      ];
  }
}

function generateEvent(): OtelEvent {
  const template = randomWeighted(eventTemplates);
  const serviceName = randomChoice(serviceNames);
  const timeUnixNano = unixNanoNow(-randomInt(0, 2_000));

  return {
    timeUnixNano,
    observedTimeUnixNano: unixNanoNow(),
    traceId: randomHex(16),
    spanId: randomHex(8),
    flags: 1,
    severityNumber: template.severityNumber,
    severityText: template.severityText,
    body: stringValue(template.body),
    resource: {
      attributes: [
        keyValue("service.name", stringValue(serviceName)),
        keyValue("service.namespace", stringValue("clickhouse-dataflow")),
        keyValue("service.instance.id", stringValue(`${serviceName}-${randomInt(1, 8)}`)),
        keyValue("deployment.environment.name", stringValue(randomChoice(deploymentEnvironments))),
        keyValue("telemetry.sdk.name", stringValue("opentelemetry")),
        keyValue("telemetry.sdk.language", stringValue("bun")),
        keyValue("telemetry.sdk.version", stringValue("synthetic")),
      ],
      droppedAttributesCount: 0,
    },
    instrumentationScope: {
      name: "clickhouse-dataflow.synthetic-events",
      version: "0.1.0",
      attributes: [keyValue("generator.name", stringValue("api"))],
      droppedAttributesCount: 0,
    },
    attributes: eventAttributes(template.name),
    droppedAttributesCount: 0,
    eventName: template.name,
  };
}

async function publishEvents(events: OtelEvent[]): Promise<string[]> {
  const response = await fetch(publishUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: events.map((event) => ({
        data: Buffer.from(JSON.stringify(event)).toString("base64"),
      })),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Pub/Sub publish failed: ${response.status} ${body}`);
  }

  const result = (await response.json()) as PublishResponse;
  if (!result.messageIds || result.messageIds.length !== events.length) {
    throw new Error("Pub/Sub publish response did not include all message IDs");
  }

  return result.messageIds;
}

app.onError((error, c) => {
  console.error(error);
  return c.json({ error: error.message }, 500);
});

app.get("/health", (c) =>
  c.json({
    status: "ok",
    project_id: projectId,
    topic: topicPath,
    pubsub_emulator_host: pubsubEmulatorHost,
    runtime: "bun",
  }),
);

app.post("/events", async (c) => {
  const event = generateEvent();
  const [messageId] = await publishEvents([event]);

  return c.json({ message_id: messageId, event }, 201);
});

app.post("/events/batch", async (c) => {
  const rawCount = c.req.query("count") ?? "10";
  const count = Number(rawCount);

  if (!Number.isInteger(count) || count < 1 || count > 1000) {
    return c.json({ error: "count must be an integer between 1 and 1000" }, 400);
  }

  const events = Array.from({ length: count }, generateEvent);
  const messageIds = await publishEvents(events);

  return c.json(
    {
      count,
      published: events.map((event, index) => ({
        message_id: messageIds[index],
        event,
      })),
    },
    201,
  );
});

export default {
  port: Number(Bun.env.PORT ?? "8000"),
  fetch: app.fetch,
};
