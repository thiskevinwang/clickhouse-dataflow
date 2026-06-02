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

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(values: readonly T[]): T {
  return values[randomInt(0, values.length - 1)];
}

function occurredAt(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function generateEvent(): EventObject {
  return {
    event_id: crypto.randomUUID(),
    event_type: randomChoice(eventTypes),
    user_id: `user-${randomInt(1, 5000)}`,
    session_id: crypto.randomUUID(),
    occurred_at: occurredAt(),
    amount: Math.round((Math.random() * 499 + 1) * 100) / 100,
    quantity: randomInt(1, 12),
    source: randomChoice(sources),
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
