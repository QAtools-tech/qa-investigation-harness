const MAX_SCALAR_LENGTH = 2000;

function boundedString(value, maxLength = MAX_SCALAR_LENGTH) {
  return typeof value === "string" ? value.slice(0, maxLength) : null;
}

function numeric(value) {
  return Number.isFinite(value) ? value : null;
}

function pointerPart(value) {
  return String(value).replaceAll("~", "~0").replaceAll("/", "~1");
}

function aggregateStatus(value) {
  switch (value) {
    case "expected":
    case "unexpected":
    case "skipped":
    case "flaky":
      return value === "unexpected" ? "failure" : value;
    default:
      return "unknown";
  }
}

export class PlaywrightReportError extends Error {
  constructor(message) {
    super(String(message).slice(0, 300));
    this.name = "PlaywrightReportError";
  }
}

/** Normalize the stable, review-relevant subset of a Playwright JSON report. */
export function parsePlaywrightReport(report, options = {}) {
  if (!report || typeof report !== "object" || Array.isArray(report) || !Array.isArray(report.suites)) {
    throw new PlaywrightReportError("Playwright JSON report must contain a top-level suites array.");
  }

  const tests = [];
  const projectNames = new Set();

  function visitSuite(suite, suitePath, pointer, inheritedFile) {
    if (!suite || typeof suite !== "object" || Array.isArray(suite)) return;
    const title = boundedString(suite.title, 500);
    const titles = title ? [...suitePath, title] : suitePath;
    const file = boundedString(suite.file, 2000) ?? inheritedFile;

    if (Array.isArray(suite.specs)) {
      suite.specs.forEach((spec, specIndex) => visitSpec(spec, titles, `${pointer}/specs/${specIndex}`, file));
    }
    if (Array.isArray(suite.suites)) {
      suite.suites.forEach((child, childIndex) => visitSuite(child, titles, `${pointer}/suites/${childIndex}`, file));
    }
  }

  function visitSpec(spec, suitePath, pointer, inheritedFile) {
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
      throw new PlaywrightReportError("Playwright JSON report contains a malformed spec record.");
    }
    if (!Array.isArray(spec.tests)) {
      throw new PlaywrightReportError("Playwright JSON report spec is missing its tests array.");
    }
    const specTitle = boundedString(spec.title, 500);
    const titlePath = specTitle ? [...suitePath, specTitle] : suitePath;
    const file = boundedString(spec.file, 2000) ?? inheritedFile;
    if (!specTitle || !file) {
      throw new PlaywrightReportError("Playwright JSON report spec is missing its title or source file.");
    }
    const line = numeric(spec.line);
    const column = numeric(spec.column);

    spec.tests.forEach((entry, testIndex) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry) || !Array.isArray(entry.results)) {
        throw new PlaywrightReportError("Playwright JSON report contains a malformed test record or missing results array.");
      }
      const projectName = boundedString(entry.projectName, 200);
      if (projectName) projectNames.add(projectName);
      const attempts = entry.results.map((result, attemptIndex) => {
        if (!result || typeof result !== "object" || Array.isArray(result) || typeof result.status !== "string") {
          throw new PlaywrightReportError("Playwright JSON report contains a malformed result attempt.");
        }
        return {
          status: boundedString(result.status, 100),
          duration: numeric(result.duration),
          retry: numeric(result.retry) ?? attemptIndex,
          startTime: boundedString(result.startTime, 100),
          attachments: (Array.isArray(result.attachments) ? result.attachments : [])
            .filter((attachment) => attachment && typeof attachment === "object" && !Array.isArray(attachment))
            .map((attachment) => ({
              name: boundedString(attachment.name, 500),
              contentType: boundedString(attachment.contentType, 200),
              candidatePath: boundedString(attachment.path),
            })),
        };
      });

      tests.push({
        order: tests.length,
        projectName,
        titlePath,
        file,
        line,
        column,
        expectedStatus: boundedString(entry.expectedStatus, 100),
        status: aggregateStatus(entry.status),
        attempts,
        sourcePointer: `${pointer}/tests/${testIndex}`.split("/").map(pointerPart).join("/"),
      });
    });
  }

  report.suites.forEach((suite, index) => visitSuite(suite, [], `/suites/${index}`, null));
  if (tests.length === 0) {
    throw new PlaywrightReportError("Playwright JSON report contains no recognizable tests in its suites.");
  }

  return {
    metadata: {
      projectNames: [...projectNames],
      startedAt: boundedString(report.stats?.startTime, 100),
      source: boundedString(options.source, 1000),
    },
    tests,
  };
}
