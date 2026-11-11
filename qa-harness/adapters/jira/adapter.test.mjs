import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateAdapter, validateReadResult } from "../contract.mjs";
import { createJiraAdapter, normalizeJiraIssue } from "./adapter.mjs";

const fixtureRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const issue = JSON.parse(await readFile(path.join(fixtureRoot, "issue.json"), "utf8"));
const providerErrors = JSON.parse(await readFile(path.join(fixtureRoot, "error-responses.json"), "utf8"));
const config = {
  cloudId: "example-cloud-id",
  instanceUrl: "https://example.atlassian.net",
  projectKey: "QA",
  issueTypeMap: { "Test Case": "case", Story: "requirement" },
};

function createFakeClient(result = issue) {
  const calls = [];
  return {
    calls,
    async getIssue(request) {
      calls.push(request);
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

test("declares only configured Jira lookup capabilities", () => {
  const adapter = createJiraAdapter({ ...config, client: createFakeClient() });
  assert.deepEqual(validateAdapter(adapter), []);
  assert.equal(adapter.provider, "jira");
  assert.deepEqual(adapter.capabilities, {
    caseLookup: true,
    requirementLookup: true,
    documentExcerpt: false,
    runEvidence: false,
  });
  assert.equal("getDocumentExcerpt" in adapter, false);
  assert.equal("lookupRunEvidence" in adapter, false);
});

test("looks up one scoped issue and preserves locator, revision, and retrieval time", async () => {
  const client = createFakeClient();
  const adapter = createJiraAdapter({ ...config, client, now: () => "2026-11-11T10:00:00.000Z" });
  const result = await adapter.lookupCase("QA-123");

  assert.deepEqual(client.calls, [{ cloudId: "example-cloud-id", issueIdOrKey: "QA-123", view: "evidence" }]);
  assert.deepEqual(validateReadResult(result, { limit: 1 }), []);
  assert.equal(result.records[0].kind, "case");
  assert.equal(result.records[0].source.locator, "https://example.atlassian.net/browse/QA-123");
  assert.equal(result.records[0].source.revision, "2026-11-10T10:00:00.000Z");
  assert.equal(result.records[0].source.retrievedAt, "2026-11-11T10:00:00.000Z");
  assert.match(result.records[0].excerpt, /remains available after reload/);
});

test("accepts same-site Jira browse URLs and rejects other projects or sites before lookup", async () => {
  const client = createFakeClient();
  const adapter = createJiraAdapter({ ...config, client });

  assert.equal((await adapter.lookupCase("https://example.atlassian.net/browse/QA-123")).ok, true);
  assert.equal((await adapter.lookupCase("https://other.atlassian.net/browse/QA-123")).error.code, "INVALID_REFERENCE");
  assert.equal((await adapter.lookupCase("OTHER-12")).error.code, "INVALID_REFERENCE");
  assert.equal(client.calls.length, 1);
});

test("does not infer missing expectations from a blank Jira description", async () => {
  const blank = structuredClone(issue);
  blank.fields.description = null;
  const result = await createJiraAdapter({ ...config, client: createFakeClient(blank) }).lookupCase("QA-123");

  assert.equal(result.ok, true);
  assert.equal(result.records[0].excerpt, undefined);
  assert.equal(result.records[0].truncated, false);
});

test("converts Jira ADF text without serializing object syntax", () => {
  const raw = structuredClone(issue);
  raw.fields.description = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Step one." }] },
      { type: "paragraph", content: [{ type: "text", text: "Expected state." }] },
    ],
  };
  const result = normalizeJiraIssue(raw, { recordKind: "case", ...config, retrievedAt: "2026-11-11T10:00:00.000Z" });

  assert.equal(result.ok, true);
  assert.equal(result.records[0].excerpt, "Step one.\nExpected state.");
  assert.doesNotMatch(result.records[0].excerpt, /\[object Object\]|"type"/);
});

test("clips source excerpts at the declared limit and marks truncation", () => {
  const raw = structuredClone(issue);
  raw.fields.description = "x".repeat(2500);
  const result = normalizeJiraIssue(raw, { recordKind: "case", ...config, retrievedAt: "2026-11-11T10:00:00.000Z" });

  assert.equal(result.records[0].excerpt.length, 2000);
  assert.equal(result.records[0].truncated, true);
});

test("rejects unsupported issue types and wrong project payloads", () => {
  const otherType = structuredClone(issue);
  otherType.fields.issuetype.name = "Epic";
  assert.equal(normalizeJiraIssue(otherType, { recordKind: "case", ...config, retrievedAt: "2026-11-11T10:00:00.000Z" }).error.code, "UNSUPPORTED");

  const otherProject = structuredClone(issue);
  otherProject.fields.project.key = "OTHER";
  assert.equal(normalizeJiraIssue(otherProject, { recordKind: "case", ...config, retrievedAt: "2026-11-11T10:00:00.000Z" }).error.code, "INVALID_RESPONSE");
});

test("maps permission, absence, rate limiting, and outage errors without provider text", async () => {
  const expected = [
    [providerErrors.permissionDenied, "PERMISSION_DENIED", false],
    [providerErrors.notFound, "NOT_FOUND", false],
    [providerErrors.rateLimited, "RATE_LIMITED", true],
    [providerErrors.temporarilyUnavailable, "UNAVAILABLE", true],
  ];
  for (const [providerError, code, retryable] of expected) {
    const result = await createJiraAdapter({ ...config, client: createFakeClient(Object.assign(new Error(providerError.message), providerError)) }).lookupCase("QA-123");
    assert.equal(result.error.code, code);
    assert.equal(result.error.retryable, retryable);
    assert.doesNotMatch(result.error.message, /private example detail|token|secret/i);
  }
});

test("re-fetches an explicitly selected issue to refresh revision without writing", async () => {
  const updated = structuredClone(issue);
  updated.fields.updated = "2026-11-12T10:00:00.000Z";
  const client = createFakeClient(issue);
  client.getIssue = async function getIssue(request) {
    this.calls.push(request);
    return this.calls.length === 1 ? issue : updated;
  };
  const adapter = createJiraAdapter({ ...config, client, now: () => "2026-11-12T10:05:00.000Z" });

  const first = await adapter.lookupCase("QA-123");
  const second = await adapter.lookupCase("QA-123");
  assert.equal(first.records[0].source.revision, "2026-11-10T10:00:00.000Z");
  assert.equal(second.records[0].source.revision, "2026-11-12T10:00:00.000Z");
  assert.equal(client.calls.length, 2);
});

test("scopes Jira search to the configured project and returns one bounded page", async () => {
  const client = createFakeClient();
  client.searchIssues = async (request) => {
    client.calls.push(request);
    return { issues: [issue], nextPageToken: "opaque-next-page", isLast: false };
  };
  const adapter = createJiraAdapter({ ...config, client, now: () => "2026-11-11T10:00:00.000Z" });
  const result = await adapter.searchCases([{ field: "summary", operator: "contains", value: "Save" }], { limit: 1 });

  assert.deepEqual(client.calls, [{
    cloudId: "example-cloud-id",
    jql: 'project = "QA" AND issuetype in ("Test Case") AND summary ~ "Save"',
    maxResults: 1,
    view: "evidence",
  }]);
  assert.deepEqual(validateReadResult(result, { limit: 1 }), []);
  assert.equal(result.page.nextCursor, "opaque-next-page");
  assert.equal(result.page.isLast, false);
  assert.equal(client.calls.length, 1);
});

test("uses the opaque cursor only when the caller requests the next page", async () => {
  const client = createFakeClient();
  client.searchIssues = async (request) => {
    client.calls.push(request);
    return request.nextPageToken
      ? { issues: [issue], nextPageToken: null, isLast: true }
      : { issues: [issue], nextPageToken: "opaque-next-page", isLast: false };
  };
  const adapter = createJiraAdapter({ ...config, client });
  const filters = [{ field: "status", operator: "eq", value: "Open" }];

  const firstPage = await adapter.searchCases(filters, { limit: 1 });
  assert.equal(client.calls.length, 1);
  const secondPage = await adapter.searchCases(filters, { limit: 1, cursor: firstPage.page.nextCursor });

  assert.equal(client.calls.length, 2);
  assert.equal(client.calls[1].nextPageToken, "opaque-next-page");
  assert.equal(secondPage.page.isLast, true);
  assert.equal(secondPage.page.nextCursor, null);
});

test("rejects broad or invalid Jira searches before provider access", async () => {
  const client = createFakeClient();
  client.searchIssues = async (request) => {
    client.calls.push(request);
    return { issues: [], nextPageToken: null, isLast: true };
  };
  const adapter = createJiraAdapter({ ...config, client });

  assert.equal((await adapter.searchCases([])).error.code, "INVALID_REFERENCE");
  assert.equal((await adapter.searchCases([{ field: "project", operator: "eq", value: "OTHER" }])).error.code, "INVALID_REFERENCE");
  assert.equal((await adapter.searchCases([{ field: "status", operator: "eq", value: "Open" }], { limit: 51 })).error.code, "INVALID_REFERENCE");
  assert.equal(client.calls.length, 0);
});

test("reports malformed pages and unsupported search without dropping issues", async () => {
  const noSearch = createJiraAdapter({ ...config, client: createFakeClient() });
  assert.equal("searchCases" in noSearch, false);

  const malformedClient = createFakeClient();
  malformedClient.searchIssues = async () => ({ issues: [issue], nextPageToken: "bad", isLast: true });
  const malformed = createJiraAdapter({ ...config, client: malformedClient });
  assert.equal((await malformed.searchCases([{ field: "summary", operator: "contains", value: "Save" }])).error.code, "INVALID_RESPONSE");
});

test("escapes filter values before constructing project-scoped JQL", async () => {
  const client = createFakeClient();
  client.searchIssues = async (request) => {
    client.calls.push(request);
    return { issues: [issue], nextPageToken: null, isLast: true };
  };
  const adapter = createJiraAdapter({ ...config, client });
  const result = await adapter.searchCases([{ field: "summary", operator: "contains", value: 'Save" OR project = "OTHER' }]);

  assert.equal(result.ok, true);
  assert.equal(client.calls[0].jql, 'project = "QA" AND issuetype in ("Test Case") AND summary ~ "Save\\" OR project = \\"OTHER"');
});
