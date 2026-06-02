import { Hono } from "hono";

type EventObject = {
  event_id: string;
  event_type: string;
  user_id: string;
  session_id: string;
  occurred_at: string;
  amount: number;
  quantity: number;
  source: string;
  payload: Record<string, unknown>;
};

type PublishResponse = {
  messageIds?: string[];
};

const projectId = Bun.env.PROJECT_ID ?? "local-project";
const eventsTopic = Bun.env.EVENTS_TOPIC ?? "events";
const pubsubEmulatorHost = Bun.env.PUBSUB_EMULATOR_HOST ?? "pubsub:8085";
const topicPath = `projects/${projectId}/topics/${eventsTopic}`;
const publishUrl = `http://${pubsubEmulatorHost}/v1/${topicPath}:publish`;

const eventTypes = [
  "page_view",
  "signup",
  "purchase",
  "refund",
  "cart_add",
  "checkout_start",
] as const;

const sources = ["web", "mobile", "partner", "internal"] as const;

const app = new Hono();
const byteToHex = Array.from({ length: 256 }, (_, index) => index.toString(16).padStart(2, "0"));

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(values: readonly T[]): T {
  return values[randomInt(0, values.length - 1)];
}

function occurredAt(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function uuidV7(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const timestamp = BigInt(Date.now());

  bytes[0] = Number((timestamp >> 40n) & 0xffn);
  bytes[1] = Number((timestamp >> 32n) & 0xffn);
  bytes[2] = Number((timestamp >> 24n) & 0xffn);
  bytes[3] = Number((timestamp >> 16n) & 0xffn);
  bytes[4] = Number((timestamp >> 8n) & 0xffn);
  bytes[5] = Number(timestamp & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return (
    byteToHex[bytes[0]] +
    byteToHex[bytes[1]] +
    byteToHex[bytes[2]] +
    byteToHex[bytes[3]] +
    "-" +
    byteToHex[bytes[4]] +
    byteToHex[bytes[5]] +
    "-" +
    byteToHex[bytes[6]] +
    byteToHex[bytes[7]] +
    "-" +
    byteToHex[bytes[8]] +
    byteToHex[bytes[9]] +
    "-" +
    byteToHex[bytes[10]] +
    byteToHex[bytes[11]] +
    byteToHex[bytes[12]] +
    byteToHex[bytes[13]] +
    byteToHex[bytes[14]] +
    byteToHex[bytes[15]]
  );
}

function generatePayload(eventType: (typeof eventTypes)[number]): Record<string, unknown> {
  const common = {
    app_version: `${randomInt(1, 4)}.${randomInt(0, 9)}.${randomInt(0, 9)}`,
    experiment: randomChoice(["control", "checkout-redesign", "pricing-copy"]),
    flags: {
      beta_user: Math.random() > 0.75,
      campaign_id: `cmp-${randomInt(100, 999)}`,
    },
  };

  switch (eventType) {
    case "page_view":
      return {
        ...common,
        page: randomChoice(["/", "/pricing", "/docs", "/checkout"]),
        referrer: randomChoice(["direct", "search", "newsletter", "partner"]),
      };
    case "purchase":
      return {
        ...common,
        payment_method: randomChoice(["card", "ach", "wallet"]),
        currency: "USD",
        coupon_codes: Math.random() > 0.7 ? [`SAVE${randomInt(5, 30)}`] : [],
      };
    case "refund":
      return {
        ...common,
        reason: randomChoice(["duplicate", "customer_request", "fraud_review"]),
        refunded_items: randomInt(1, 3),
      };
    default:
      return {
        ...common,
        form_factor: randomChoice(["desktop", "tablet", "phone"]),
        latency_ms: randomInt(20, 900),
      };
  }
}

function generateEvent(): EventObject {
  const eventType = randomChoice(eventTypes);

  return {
    event_id: uuidV7(),
    event_type: eventType,
    user_id: `user-${randomInt(1, 5000)}`,
    session_id: uuidV7(),
    occurred_at: occurredAt(),
    amount: Math.round((Math.random() * 499 + 1) * 100) / 100,
    quantity: randomInt(1, 12),
    source: randomChoice(sources),
    payload: generatePayload(eventType),
  };
}

async function publishEvents(events: EventObject[]): Promise<string[]> {
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
