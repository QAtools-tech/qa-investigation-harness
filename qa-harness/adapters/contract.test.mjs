import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  adapterError,
  validateAdapter,
  validateNormalizedRecord,
  validateReadResult,
} from "./contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const validRecord = {
  schemaVersion: 1,
  kind: "case",
  externalId: "QA-123",
  title: "Save a filter",
  excerpt: "The filter can be saved and reused.",
  truncated: false,
  source: {
    provider: "jira",
    instance: "https://example.atlassian.net",
    project: "QA",
    objectKind: "issue",
    externalId: "QA-123",
    locator: "https://example.atlassian.net/browse/QA-123",
    revision: "2026-11-10T10:00:00.000Z",
    retrievedAt: "2026-11-10T10:05:00.000Z",
  },
};

test("accepts an adapter whose declared capabilities have matching methods", () => {
  const errors = validateAdapter({
    contractVersion: 1,
    provider: "jira",
    instance: "https://example.atlassian.net",
    scope: { project: "QA" },
    capabilities: {
      caseLookup: true,
      requirementLookup: true,
      documentExcerpt: false,
      runEvidence: false,
    },
    limits: { maxPageSize: 50, maxExcerptChars: 2000 },
    lookupCase() {},
    lookupRequirement() {},
  });

  assert.deepEqual(errors, []);
});

test("rejects a capability advertised without its method and invalid page limits", () => {
  const errors = validateAdapter({
    contractVersion: 1,
    provider: "jira",
    instance: "https://example.atlassian.net",
    scope: { project: "QA" },
    capabilities: {
      caseLookup: true,
      requirementLookup: false,
      documentExcerpt: false,
      runEvidence: false,
    },
    limits: { maxPageSize: 101, maxExcerptChars: 2000 },
  });

  assert.ok(errors.some((error) => error.includes("lookupCase")));
  assert.ok(errors.some((error) => error.includes("maxPageSize")));
});

test("rejects methods hidden behind disabled capabilities", () => {
  const errors = validateAdapter({
    contractVersion: 1,
    provider: "jira",
    instance: "https://example.atlassian.net",
    scope: { project: "QA" },
    capabilities: {
      caseLookup: false,
      requirementLookup: false,
      documentExcerpt: false,
      runEvidence: false,
    },
    limits: { maxPageSize: 50, maxExcerptChars: 2000 },
    lookupCase() {},
  });

  assert.ok(errors.some((error) => error.includes("disabled capability")));
});

test("requires complete provider provenance and bounded source text", () => {
  assert.deepEqual(validateNormalizedRecord(validRecord), []);
  assert.ok(validateNormalizedRecord({ ...validRecord, source: { ...validRecord.source, locator: "" } }).some((error) => error.includes("locator")));
  assert.ok(validateNormalizedRecord({ ...validRecord, source: { ...validRecord.source, externalId: "OTHER-1" } }).some((error) => error.includes("match record.externalId")));
  assert.ok(validateNormalizedRecord({ ...validRecord, source: { ...validRecord.source, project: undefined } }).some((error) => error.includes("project")));
  assert.ok(validateNormalizedRecord({ ...validRecord, source: { ...validRecord.source, locator: "not-a-url" } }).some((error) => error.includes("locator")));
  assert.ok(validateNormalizedRecord({ ...validRecord, source: { ...validRecord.source, retrievedAt: "2026-02-30T10:00:00.000Z" } }).some((error) => error.includes("retrievedAt")));
  assert.ok(validateNormalizedRecord({ ...validRecord, title: "x".repeat(501) }).some((error) => error.includes("title")));
  assert.ok(validateNormalizedRecord({ ...validRecord, source: { ...validRecord.source, revision: "" } }).some((error) => error.includes("revision")));
  assert.ok(validateNormalizedRecord({ ...validRecord, excerpt: "x".repeat(2001) }).some((error) => error.includes("excerpt")));
  assert.ok(validateNormalizedRecord({ ...validRecord, source: { ...validRecord.source, retrievedAt: "yesterday" } }).some((error) => error.includes("retrievedAt")));
});

test("accepts one bounded page and rejects excess records or ambiguous cursors", () => {
  const page = { ok: true, records: [validRecord], page: { limit: 1, nextCursor: null, isLast: true } };
  assert.deepEqual(validateReadResult(page, { limit: 1 }), []);
  assert.ok(validateReadResult({ ...page, records: [validRecord, validRecord] }, { limit: 1 }).some((error) => error.includes("limit")));
  assert.ok(validateReadResult({ ...page, page: { limit: 1, nextCursor: null, isLast: false } }, { limit: 1 }).some((error) => error.toLowerCase().includes("cursor")));
  assert.ok(validateReadResult(page, { limit: 101 }).some((error) => error.includes("1..100")));
});

test("maps provider failures to fixed structured errors without raw payloads", () => {
  const error = adapterError("PERMISSION_DENIED");
  assert.deepEqual(error, {
    ok: false,
    error: {
      code: "PERMISSION_DENIED",
      message: "The source denied access to this record.",
      retryable: false,
    },
  });
  assert.equal(adapterError("RATE_LIMITED").error.retryable, true);
  assert.equal(adapterError("UNSUPPORTED").error.code, "UNSUPPORTED");
  assert.throws(() => adapterError("RAW", "token=secret"), /Unknown adapter error/);
});

test("ships a valid JSON schema for the normalized source record", async () => {
  const schema = JSON.parse(await readFile(path.join(repoRoot, "qa-harness/adapters/record.schema.json"), "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.properties.schemaVersion.const, 1);
  assert.deepEqual(schema.properties.kind.enum, ["case", "requirement", "documentExcerpt", "runEvidence"]);
  assert.equal(schema.properties.excerpt.maxLength, 2000);
});
