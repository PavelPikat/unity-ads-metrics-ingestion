import assert from "node:assert/strict";
import {test} from "node:test";
import {
    DEFAULT_MAX_INFLIGHT_PUBLISHES,
    loadConfig,
} from "../src/config.js";

test("loads default application configuration", () => {
    assert.deepEqual(loadConfig({}), {
        host: "0.0.0.0",
        port: 3000,
        maxInflightPublishes: DEFAULT_MAX_INFLIGHT_PUBLISHES,
    });
});

test("loads the configured maximum number of in-flight publishes", () => {
    assert.equal(
        loadConfig({MAX_INFLIGHT_PUBLISHES: "25"}).maxInflightPublishes,
        25,
    );
});

test("rejects an invalid maximum number of in-flight publishes", () => {
    assert.throws(() => loadConfig({MAX_INFLIGHT_PUBLISHES: "0"}));
    assert.throws(() => loadConfig({MAX_INFLIGHT_PUBLISHES: "1.5"}));
    assert.throws(() => loadConfig({MAX_INFLIGHT_PUBLISHES: "invalid"}));
});
