import { describe, expect, it } from "vitest";

// The *.postgres.test.ts suites skip themselves without MODULE_TEST_DATABASE_URL.
// CI sets REQUIRE_MODULE_TEST_DATABASE so losing that variable fails the run
// instead of silently skipping the isolation checks.
describe.runIf(process.env.REQUIRE_MODULE_TEST_DATABASE === "true")("PostgreSQL test harness", () => {
  it("points the PostgreSQL suites at the dedicated local database", () => {
    const url = new URL(process.env.MODULE_TEST_DATABASE_URL ?? "missing://");
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.pathname).toBe("/modules_185_test");
  });
});
