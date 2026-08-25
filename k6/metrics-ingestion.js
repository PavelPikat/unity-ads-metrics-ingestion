import http from "k6/http";
import {check} from "k6";

const baseUrl = __ENV.BASE_URL || "http://app:3000";
const stageDuration = __ENV.K6_STAGE_DURATION || "5m";
const maxRate = positiveInteger(__ENV.K6_MAX_RATE, 1_000, "K6_MAX_RATE");
const preAllocatedVUs = positiveInteger(
    __ENV.K6_PRE_ALLOCATED_VUS,
    Math.max(50, Math.ceil(maxRate / 2)),
    "K6_PRE_ALLOCATED_VUS",
);
const maxVUs = positiveInteger(
    __ENV.K6_MAX_VUS,
    Math.max(preAllocatedVUs, maxRate * 2),
    "K6_MAX_VUS",
);

if (maxVUs < preAllocatedVUs) {
    throw new Error("K6_MAX_VUS must be greater than or equal to K6_PRE_ALLOCATED_VUS");
}

export const options = {
    discardResponseBodies: true,
    tags: {
        testid: __ENV.K6_TEST_RUN_ID || "local",
    },
    scenarios: {
        metricsIngestion: {
            executor: "ramping-arrival-rate",
            startRate: rateAt(0.05),
            timeUnit: "1s",
            preAllocatedVUs,
            maxVUs,
            gracefulStop: "30s",
            stages: [
                {duration: stageDuration, target: rateAt(0.10)},
                {duration: stageDuration, target: rateAt(0.25)},
                {duration: stageDuration, target: rateAt(0.50)},
                {duration: stageDuration, target: rateAt(0.75)},
                {duration: stageDuration, target: maxRate},
                {duration: stageDuration, target: 0},
            ],
        },
    },
    thresholds: {
        checks: ["rate>0.99"],
        dropped_iterations: ["count==0"],
        http_req_duration: ["p(95)<500"],
        http_req_failed: ["rate<0.01"],
    },
};

export default function () {
    const response = http.post(
        `${baseUrl}/v1/metrics`,
        JSON.stringify({
            eventId: randomUuid(),
            eventType: "impression",
            timestamp: new Date().toISOString(),
            deviceId: `k6-device-${__VU}`,
            adId: `k6-ad-${__ITER % 1_000}`,
        }),
        {
            headers: {"Content-Type": "application/json"},
            tags: {name: "POST /v1/metrics"},
        },
    );

    check(response, {
        "ingestion accepted": (result) => result.status === 202,
    });
}

function rateAt(fraction) {
    return Math.max(1, Math.round(maxRate * fraction));
}

function positiveInteger(value, defaultValue, variableName) {
    const parsed = value === undefined || value === ""
        ? defaultValue
        : Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${variableName} must be a positive integer`);
    }

    return parsed;
}

function randomUuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        (character) => {
            const random = Math.floor(Math.random() * 16);
            const value = character === "x" ? random : (random & 0x3) | 0x8;
            return value.toString(16);
        },
    );
}
