import {
  MAX_EXCERPT_CHARS,
  adapterError,
  validateNormalizedRecord,
} from "../contract.mjs";

const ISSUE_KEY = /^([A-Z][A-Z0-9_]{0,39})-(\d+)$/;
const BLOCK_NODES = new Set(["doc", "paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote", "panel", "codeBlock"]);
const STATUS_CODES = new Map([
  [401, "PERMISSION_DENIED"],
  [403, "PERMISSION_DENIED"],
  [404, "NOT_FOUND"],
  [429, "RATE_LIMITED"],
]);

function normalizedInstanceUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new TypeError("instanceUrl must be an HTTPS site origin without credentials or path");
  }
  return url.origin;
}

function normalizeIssueKey(reference, instanceUrl, projectKey) {
  if (typeof reference !== "string" || !reference.trim()) return null;
  let key = reference.trim();

  if (/^https?:\/\//i.test(key)) {
    let url;
    try {
      url = new URL(key);
    } catch {
      return null;
    }
    if (url.origin !== instanceUrl || url.username || url.password || url.search || url.hash) return null;
    const match = url.pathname.match(/^\/browse\/([^/]+)\/?$/i);
    if (!match) return null;
    key = match[1];
  }

  key = key.toUpperCase();
  const match = key.match(ISSUE_KEY);
  if (!match || match[1] !== projectKey) return null;
  return key;
}

function adfText(value) {
  if (value === null || value === undefined) return { ok: true, text: "" };
  if (typeof value === "string") return { ok: true, text: value };
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.type !== "string") {
    return { ok: false, text: "" };
  }
  if (value.type === "text") {
    return typeof value.text === "string" ? { ok: true, text: value.text } : { ok: false, text: "" };
  }
  if (value.type === "hardBreak") return { ok: true, text: "\n" };
  if (!Array.isArray(value.content)) return { ok: false, text: "" };

  const children = [];
  for (const child of value.content) {
    const childResult = adfText(child);
    if (!childResult.ok) return childResult;
    children.push(childResult.text);
  }
  const separator = BLOCK_NODES.has(value.type) ? "\n" : "";
  return { ok: true, text: children.join(separator) };
}

function errorCode(error) {
  if (error && typeof error.code === "string") {
    const known = ["NOT_FOUND", "PERMISSION_DENIED", "UNSUPPORTED", "RATE_LIMITED", "UNAVAILABLE", "INVALID_REFERENCE", "INVALID_RESPONSE"];
    if (known.includes(error.code)) return error.code;
  }
  const status = Number(error?.status ?? error?.statusCode ?? error?.response?.status);
  if (STATUS_CODES.has(status)) return STATUS_CODES.get(status);
  if (Number.isFinite(status) && status >= 500) return "UNAVAILABLE";
  return "UNAVAILABLE";
}

function quoteJqlValue(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

function buildScopedJql(projectKey, issueTypes, filters) {
  if (!Array.isArray(filters) || filters.length === 0 || filters.length > 5) return null;
  const clauses = [];

  for (const filter of filters) {
    if (!filter || typeof filter !== "object" || typeof filter.value !== "string" || !filter.value.trim() || filter.value.length > 256 || /[\u0000-\u001f]/.test(filter.value)) return null;
    if (filter.field === "summary" && filter.operator === "contains") {
      clauses.push(`summary ~ ${quoteJqlValue(filter.value)}`);
    } else if ((filter.field === "status" || filter.field === "label") && filter.operator === "eq") {
      const field = filter.field === "label" ? "labels" : "status";
      clauses.push(`${field} = ${quoteJqlValue(filter.value)}`);
    } else {
      return null;
    }
  }

  const types = issueTypes.map(quoteJqlValue).join(", ");
  return `project = ${quoteJqlValue(projectKey)} AND issuetype in (${types}) AND ${clauses.join(" AND ")}`;
}

function singleRecordResult(record, limit) {
  const validationErrors = validateNormalizedRecord(record);
  if (validationErrors.length) return adapterError("INVALID_RESPONSE");
  return {
    ok: true,
    records: [record],
    page: { limit, nextCursor: null, isLast: true },
  };
}

export function normalizeJiraIssue(raw, context) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !raw.fields || typeof raw.fields !== "object") {
    return adapterError("INVALID_RESPONSE");
  }

  const issueKey = typeof raw.key === "string" ? raw.key.toUpperCase() : "";
  const keyMatch = issueKey.match(ISSUE_KEY);
  const projectKey = String(context?.projectKey ?? "").toUpperCase();
  const returnedProject = typeof raw.fields.project?.key === "string" ? raw.fields.project.key.toUpperCase() : "";
  if (!keyMatch || keyMatch[1] !== projectKey || returnedProject !== projectKey) return adapterError("INVALID_RESPONSE");

  const issueType = raw.fields.issuetype?.name;
  const mapping = Object.fromEntries(
    Object.entries(context?.issueTypeMap ?? {}).map(([name, kind]) => [name.trim().toLowerCase(), kind]),
  );
  const expectedKind = mapping[String(issueType ?? "").trim().toLowerCase()];
  if (!expectedKind || expectedKind !== context.recordKind) return adapterError("UNSUPPORTED");
  if (expectedKind !== "case" && expectedKind !== "requirement") return adapterError("INVALID_RESPONSE");

  const summary = raw.fields.summary;
  if (typeof summary !== "string" || !summary.trim() || summary.length > 500) return adapterError("INVALID_RESPONSE");
  const instanceUrl = context?.instanceUrl;
  if (typeof instanceUrl !== "string") return adapterError("INVALID_RESPONSE");
  const retrievedAt = context?.retrievedAt;
  if (typeof retrievedAt !== "string" || !Number.isFinite(Date.parse(retrievedAt))) return adapterError("INVALID_RESPONSE");

  const extracted = adfText(raw.fields.description);
  if (!extracted.ok) return adapterError("INVALID_RESPONSE");
  const fullExcerpt = extracted.text.trim();
  const excerptCharacters = Array.from(fullExcerpt);
  const wasTruncated = excerptCharacters.length > MAX_EXCERPT_CHARS;
  const excerpt = excerptCharacters.slice(0, MAX_EXCERPT_CHARS).join("");

  const record = {
    schemaVersion: 1,
    kind: expectedKind,
    externalId: issueKey,
    title: summary.trim(),
    ...(excerpt ? { excerpt } : {}),
    truncated: wasTruncated,
    source: {
      provider: "jira",
      instance: instanceUrl,
      project: projectKey,
      objectKind: "issue",
      externalId: issueKey,
      locator: `${instanceUrl}/browse/${issueKey}`,
      revision: typeof raw.fields.updated === "string" ? raw.fields.updated : null,
      retrievedAt,
    },
  };

  return singleRecordResult(record, 1);
}

export function createJiraAdapter({ client, cloudId, instanceUrl, projectKey, issueTypeMap = {}, now = () => new Date().toISOString() }) {
  if (!client || typeof client.getIssue !== "function") throw new TypeError("client.getIssue is required");
  if (typeof cloudId !== "string" || !cloudId.trim()) throw new TypeError("cloudId is required");
  const siteUrl = normalizedInstanceUrl(instanceUrl);
  const normalizedProject = String(projectKey ?? "").toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{0,39}$/.test(normalizedProject)) throw new TypeError("projectKey must be a valid Jira project key");
  if (!issueTypeMap || typeof issueTypeMap !== "object" || Array.isArray(issueTypeMap)) throw new TypeError("issueTypeMap must be an object");

  const mapping = {};
  const issueTypeNames = {};
  for (const [type, kind] of Object.entries(issueTypeMap)) {
    const normalizedType = type.trim().toLowerCase();
    if (!normalizedType || (kind !== "case" && kind !== "requirement")) throw new TypeError("issueTypeMap values must be case or requirement");
    mapping[normalizedType] = kind;
    issueTypeNames[normalizedType] = type.trim();
  }

  const canLookupCases = Object.values(mapping).includes("case");
  const canLookupRequirements = Object.values(mapping).includes("requirement");
  const adapter = {
    contractVersion: 1,
    provider: "jira",
    instance: siteUrl,
    scope: { project: normalizedProject },
    capabilities: {
      caseLookup: canLookupCases,
      requirementLookup: canLookupRequirements,
      documentExcerpt: false,
      runEvidence: false,
    },
    limits: { maxPageSize: 50, maxExcerptChars: MAX_EXCERPT_CHARS },
  };

  const lookup = (recordKind) => async (reference, options = {}) => {
    const limit = options.limit ?? 1;
    if (limit !== 1 || options.cursor !== undefined) return adapterError("INVALID_REFERENCE");
    const issueKey = normalizeIssueKey(reference, siteUrl, normalizedProject);
    if (!issueKey) return adapterError("INVALID_REFERENCE");

    let raw;
    try {
      raw = await client.getIssue({ cloudId, issueIdOrKey: issueKey, view: "evidence" });
    } catch (error) {
      return adapterError(errorCode(error));
    }

    return normalizeJiraIssue(raw, {
      recordKind,
      instanceUrl: siteUrl,
      projectKey: normalizedProject,
      issueTypeMap: mapping,
      retrievedAt: now(),
    });
  };

  const search = (recordKind) => async (filters, options = {}) => {
    const limit = options.limit ?? 25;
    const cursor = options.cursor;
    const typeNames = Object.entries(mapping)
      .filter(([, kind]) => kind === recordKind)
      .map(([name]) => issueTypeNames[name]);
    if (typeof client.searchIssues !== "function" || typeNames.length === 0) return adapterError("UNSUPPORTED");
    if (!Number.isInteger(limit) || limit < 1 || limit > adapter.limits.maxPageSize) return adapterError("INVALID_REFERENCE");
    if (cursor !== undefined && (typeof cursor !== "string" || !cursor.trim() || cursor.length > 2048)) return adapterError("INVALID_REFERENCE");
    const jql = buildScopedJql(normalizedProject, typeNames, filters);
    if (!jql) return adapterError("INVALID_REFERENCE");

    let page;
    try {
      page = await client.searchIssues({
        cloudId,
        jql,
        maxResults: limit,
        ...(cursor !== undefined ? { nextPageToken: cursor } : {}),
        view: "evidence",
      });
    } catch (error) {
      return adapterError(errorCode(error));
    }

    if (!page || typeof page !== "object" || !Array.isArray(page.issues) || typeof page.isLast !== "boolean") {
      return adapterError("INVALID_RESPONSE");
    }
    const nextCursor = page.nextPageToken ?? null;
    if (page.issues.length > limit || (page.isLast && nextCursor !== null) || (!page.isLast && (typeof nextCursor !== "string" || !nextCursor.trim()))) {
      return adapterError("INVALID_RESPONSE");
    }

    const records = [];
    const retrievedAt = now();
    for (const raw of page.issues) {
      const normalized = normalizeJiraIssue(raw, {
        recordKind,
        instanceUrl: siteUrl,
        projectKey: normalizedProject,
        issueTypeMap: mapping,
        retrievedAt,
      });
      if (!normalized.ok) return normalized;
      records.push(...normalized.records);
    }

    return {
      ok: true,
      records,
      page: { limit, nextCursor, isLast: page.isLast },
    };
  };

  if (canLookupCases) adapter.lookupCase = lookup("case");
  if (canLookupRequirements) adapter.lookupRequirement = lookup("requirement");
  if (canLookupCases && typeof client.searchIssues === "function") adapter.searchCases = search("case");
  if (canLookupRequirements && typeof client.searchIssues === "function") adapter.searchRequirements = search("requirement");
  return adapter;
}
