export const ADAPTER_CONTRACT_VERSION = 1;
export const MAX_PAGE_SIZE = 100;
export const MAX_EXCERPT_CHARS = 2000;

export const CAPABILITY_METHODS = Object.freeze({
  caseLookup: "lookupCase",
  requirementLookup: "lookupRequirement",
  documentExcerpt: "getDocumentExcerpt",
  runEvidence: "lookupRunEvidence",
});

export const ERROR_MESSAGES = Object.freeze({
  NOT_FOUND: "The source record was not found.",
  PERMISSION_DENIED: "The source denied access to this record.",
  UNSUPPORTED: "The adapter does not support this source or operation.",
  RATE_LIMITED: "The source rate limit was reached; retry later.",
  UNAVAILABLE: "The source is temporarily unavailable; retry later.",
  INVALID_REFERENCE: "The supplied source reference is invalid.",
  INVALID_RESPONSE: "The source returned a response the adapter cannot normalize.",
});

const RETRYABLE_ERRORS = new Set(["RATE_LIMITED", "UNAVAILABLE"]);
const RECORD_KINDS = new Set(["case", "requirement", "documentExcerpt", "runEvidence"]);
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDateTime(value) {
  if (typeof value !== "string" || !ISO_DATE_TIME.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const date = value.slice(0, 10);
  return new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) === date;
}

function isHttpUrl(value) {
  if (!nonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function adapterError(code) {
  const message = ERROR_MESSAGES[code];
  if (!message) throw new Error(`Unknown adapter error code: ${code}`);

  return {
    ok: false,
    error: {
      code,
      message,
      retryable: RETRYABLE_ERRORS.has(code),
    },
  };
}

export function validateAdapter(adapter) {
  const errors = [];
  if (!adapter || typeof adapter !== "object" || Array.isArray(adapter)) return ["adapter must be an object"];
  if (adapter.contractVersion !== ADAPTER_CONTRACT_VERSION) errors.push("contractVersion must be 1");
  if (!nonEmptyString(adapter.provider)) errors.push("provider must be a non-empty string");
  if (!isHttpUrl(adapter.instance)) errors.push("instance must be an HTTP(S) URL without embedded credentials");
  if (!adapter.scope || typeof adapter.scope !== "object" || Array.isArray(adapter.scope)) errors.push("scope must be an object");

  if (!adapter.capabilities || typeof adapter.capabilities !== "object" || Array.isArray(adapter.capabilities)) {
    errors.push("capabilities must be an object");
  } else {
    for (const capability of Object.keys(CAPABILITY_METHODS)) {
      if (typeof adapter.capabilities[capability] !== "boolean") {
        errors.push(`capabilities.${capability} must be boolean`);
      } else if (adapter.capabilities[capability] && typeof adapter[CAPABILITY_METHODS[capability]] !== "function") {
        errors.push(`capabilities.${capability} requires method ${CAPABILITY_METHODS[capability]}`);
      } else if (!adapter.capabilities[capability] && typeof adapter[CAPABILITY_METHODS[capability]] === "function") {
        errors.push(`disabled capability ${capability} must not expose method ${CAPABILITY_METHODS[capability]}`);
      }
    }
    for (const capability of Object.keys(adapter.capabilities)) {
      if (!Object.hasOwn(CAPABILITY_METHODS, capability)) errors.push(`unknown capability ${capability}`);
    }
  }

  if (!adapter.limits || typeof adapter.limits !== "object" || Array.isArray(adapter.limits)) {
    errors.push("limits must be an object");
  } else {
    const { maxPageSize, maxExcerptChars } = adapter.limits;
    if (!Number.isInteger(maxPageSize) || maxPageSize < 1 || maxPageSize > MAX_PAGE_SIZE) {
      errors.push(`limits.maxPageSize must be an integer in 1..${MAX_PAGE_SIZE}`);
    }
    if (!Number.isInteger(maxExcerptChars) || maxExcerptChars < 0 || maxExcerptChars > MAX_EXCERPT_CHARS) {
      errors.push(`limits.maxExcerptChars must be an integer in 0..${MAX_EXCERPT_CHARS}`);
    }
  }

  return errors;
}

export function validateNormalizedRecord(record) {
  const errors = [];
  if (!record || typeof record !== "object" || Array.isArray(record)) return ["record must be an object"];
  if (record.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!RECORD_KINDS.has(record.kind)) errors.push("kind must be a supported normalized record kind");
  if (!nonEmptyString(record.externalId) || record.externalId.length > 256) errors.push("externalId must be a non-empty string no longer than 256 characters");
  if (!nonEmptyString(record.title) || record.title.length > 500) errors.push("title must be a non-empty string no longer than 500 characters");
  if (record.excerpt !== undefined && typeof record.excerpt !== "string") errors.push("excerpt must be a string when present");
  else if (typeof record.excerpt === "string" && record.excerpt.length > MAX_EXCERPT_CHARS) errors.push(`excerpt must not exceed ${MAX_EXCERPT_CHARS} characters`);
  if (typeof record.truncated !== "boolean") errors.push("truncated must be boolean");

  const source = record.source;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    errors.push("source must be an object");
    return errors;
  }
  for (const field of ["provider", "objectKind", "externalId"]) {
    if (!nonEmptyString(source[field])) errors.push(`source.${field} must be a non-empty string`);
  }
  for (const field of ["instance", "locator"]) {
    if (!isHttpUrl(source[field])) errors.push(`source.${field} must be an HTTP(S) URL without embedded credentials`);
  }
  if (source.project !== null && !nonEmptyString(source.project)) errors.push("source.project must be a non-empty string or null");
  if (source.revision !== null && !nonEmptyString(source.revision)) errors.push("source.revision must be a non-empty string or null");
  if (source.externalId !== record.externalId) errors.push("source.externalId must match record.externalId");
  if (!isIsoDateTime(source.retrievedAt)) errors.push("source.retrievedAt must be an ISO date-time");
  return errors;
}

export function validateReadResult(result, { limit } = {}) {
  const errors = [];
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) return [`limit must be an integer in 1..${MAX_PAGE_SIZE}`];
  if (!result || typeof result !== "object" || Array.isArray(result)) return ["result must be an object"];

  if (result.ok === false) {
    const failure = result.error;
    if (!failure || !Object.hasOwn(ERROR_MESSAGES, failure.code)) errors.push("error.code must be a supported adapter error code");
    if (!nonEmptyString(failure?.message)) errors.push("error.message must be a non-empty string");
    if (typeof failure?.retryable !== "boolean") errors.push("error.retryable must be boolean");
    return errors;
  }

  if (result.ok !== true) errors.push("ok must be true or false");
  if (!Array.isArray(result.records)) errors.push("records must be an array");
  else {
    if (result.records.length > limit) errors.push("records must not exceed the requested limit");
    result.records.forEach((record, index) => {
      for (const error of validateNormalizedRecord(record)) errors.push(`records[${index}].${error}`);
    });
  }

  const page = result.page;
  if (!page || typeof page !== "object" || Array.isArray(page)) {
    errors.push("page must be an object");
    return errors;
  }
  if (page.limit !== limit) errors.push("page.limit must equal the requested limit");
  if (typeof page.isLast !== "boolean") errors.push("page.isLast must be boolean");
  if (page.isLast === true && page.nextCursor !== null) errors.push("a last page must have a null nextCursor");
  if (page.isLast === false && !nonEmptyString(page.nextCursor)) errors.push("a non-last page must have a non-empty nextCursor");
  return errors;
}
