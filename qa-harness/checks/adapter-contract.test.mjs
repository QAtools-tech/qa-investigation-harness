import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function readRepoFile(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function assertTargetsExist(content, relativePath) {
  const targets = [...content.matchAll(/qa-harness\/(?:stages\/[^\s`'"),]+\.md|INTAKE\.md|CONTRACT\.md|RULES\.md)/g)];
  for (const [target] of targets) await access(path.join(repoRoot, target));
  assert.ok(targets.length > 0, `${relativePath} should point to shared QA instructions`);
}

test("Codex stage skills cover all direct entry points and route to shared files", async () => {
  const stages = {
    "qa-intake": ["qa-harness/stages/intake.md", "qa-harness/INTAKE.md"],
    "qa-review-plan": ["qa-harness/stages/review-plan.md"],
    "qa-status-resume": ["qa-harness/stages/00-status-and-resume.md"],
    "qa-explore": ["qa-harness/stages/01-explore.md"],
    "qa-model": ["qa-harness/stages/02-model.md"],
    "qa-challenge": ["qa-harness/stages/03-challenge.md"],
    "qa-validate": ["qa-harness/stages/05-validate.md"],
  };

  for (const [skill, targets] of Object.entries(stages)) {
    const relativePath = `.agents/skills/${skill}/SKILL.md`;
    const content = await readRepoFile(relativePath);
    for (const target of targets) assert.ok(content.includes(target), `${relativePath} must route to ${target}`);
    await assertTargetsExist(content, relativePath);
  }
});

test("Claude and Copilot direct adapters point to canonical stages", async () => {
  const adapters = [
    ".claude/skills/qa/SKILL.md",
    ".claude/skills/qa-intake/SKILL.md",
    ".claude/skills/qa-review-plan/SKILL.md",
    ".claude/skills/qa-explore/SKILL.md",
    ".claude/skills/qa-model/SKILL.md",
    ".claude/skills/qa-challenge/SKILL.md",
    ".claude/skills/qa-validate/SKILL.md",
    ".github/prompts/qa.prompt.md",
    ".github/prompts/qa-intake.prompt.md",
    ".github/prompts/qa-review-plan.prompt.md",
    ".github/prompts/qa-explore.prompt.md",
    ".github/prompts/qa-model.prompt.md",
    ".github/prompts/qa-challenge.prompt.md",
    ".github/prompts/qa-validate.prompt.md",
  ];
  for (const relativePath of adapters) await assertTargetsExist(await readRepoFile(relativePath), relativePath);
});

test("reviewer roles have read/search-only tool access where the host supports it", async () => {
  const claudeFiles = [
    ".claude/agents/qa-risk-challenger.md",
    ".claude/agents/qa-validation-reviewer.md",
  ];
  for (const relativePath of claudeFiles) {
    const content = await readRepoFile(relativePath);
    assert.match(content, /^tools:\s*Read, Grep, Glob$/m);
    assert.doesNotMatch(content, /^tools:.*\b(?:Write|Edit|Bash)\b/m);
    await assertTargetsExist(content, relativePath);
  }

  const copilotFiles = [
    ".github/agents/qa-risk-challenger.agent.md",
    ".github/agents/qa-validation-reviewer.agent.md",
  ];
  for (const relativePath of copilotFiles) {
    const content = await readRepoFile(relativePath);
    assert.match(content, /^tools:\s*\['read', 'search'\]$/m);
    await assertTargetsExist(content, relativePath);
  }
});

test("Codex reviewer skills state their tool-restriction limitation", async () => {
  for (const skill of ["qa-risk-review", "qa-validation-review"]) {
    const content = await readRepoFile(`.agents/skills/${skill}/SKILL.md`);
    assert.match(content, /does not enforce a tool allowlist/i);
    await assertTargetsExist(content, `.agents/skills/${skill}/SKILL.md`);
  }
});

test("status/resume prompt does not receive Playwright tools", async () => {
  const prompt = await readRepoFile(".github/prompts/qa.prompt.md");
  assert.doesNotMatch(prompt, /^tools:\s*.*playwright/im);
  assert.match(prompt, /\$\{input:action\}/);
  assert.match(prompt, /\$\{input:investigationId\}/);
});

test("reviewer examples cover candidate risk, missing/stale approval, and weak assertion stops", async () => {
  const readme = await readRepoFile("qa-harness/fixtures/reviewers/README.md");
  for (const scenario of ["risk-candidate", "missing-approval", "stale-approval", "weak-assertion"]) {
    assert.ok(readme.includes(`\`${scenario}/\``), `review examples must include ${scenario}`);
  }

  const riskInstructions = await readRepoFile("qa-harness/stages/risk-reviewer.md");
  assert.match(riskInstructions, /Risk or transition reference/);
  assert.match(riskInstructions, /Evidence gap/);

  const validationInstructions = await readRepoFile("qa-harness/stages/validation-reviewer.md");
  assert.match(validationInstructions, /approval is absent\/stale/i);
  assert.match(validationInstructions, /stop the affected conformance\s+judgment/i);

  const resolver = await readRepoFile("qa-harness/stages/00-status-and-resume.md");
  assert.match(resolver, /`flow-model\.md` exists, `risks\.md` does not[\s\S]*?Challenge Part A/i);
  assert.match(resolver, /`risks\.md` has `PROPOSED` rows but no `APPROVED` rows[\s\S]*?Do not export/i);
  assert.match(resolver, /Current `APPROVED` rows exist, but any required approval\/dependency is stale or missing[\s\S]*?Stop export/i);
  assert.match(resolver, /must stop for human risk\s+review, before any Part B without fresh approval/i);

  const pending = await readRepoFile("qa-harness/fixtures/reviewers/missing-approval/risks.md");
  assert.match(pending, /\| R1 \|[^\n]*\| PROPOSED \|/);
  assert.doesNotMatch(pending, /Generated mapping/);

  const stale = await readRepoFile("qa-harness/fixtures/reviewers/stale-approval/risks.md");
  assert.match(stale, /\| D1 \| R1 \| APPROVED \| 2026-11-10 \|[^\n]*\| flow-model\.md@2026-11-10 \|/);
  assert.match(stale, /Source: flow-model\.md \(2026-11-11\)/);
  assert.match(stale, /Generated mapping/);

  const weak = await readRepoFile("qa-harness/fixtures/reviewers/weak-assertion/test-evidence.md");
  assert.match(weak, /visible.*toast/i);
  assert.doesNotMatch(weak, /\b(?:test|expect)\s*\(/);
});
