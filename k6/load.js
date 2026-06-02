import http from "k6/http";
import { check, sleep } from "k6";

const apiUrl = __ENV.API_URL || "http://api:8000/events";
const sleepSeconds = Number(__ENV.K6_SLEEP || "1");

export const options = {
  vus: Number(__ENV.K6_VUS || "5"),
  duration: __ENV.K6_DURATION || "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
  summaryTrendStats: ["min", "avg", "p(90)", "p(95)", "max"],
};

export default function () {
  const response = http.post(apiUrl, null, {
    headers: { "Content-Type": "application/json" },
  });

  check(response, {
    "status is 201": (r) => r.status === 201,
    "response has message_id": (r) => Boolean(r.json("message_id")),
  });

  sleep(sleepSeconds);
}
