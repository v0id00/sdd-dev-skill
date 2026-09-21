// Exercises the CLI end to end against a throwaway project: init -> new -> stats
// -> lint -> index -> install --dry-run. Nothing outside the temp dir is touched.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CLI = path.join(ROOT, 'bin', 'sdd.mjs')

async function cli(args, cwd) {
  try {
    const { stdout, stderr } = await run(process.execPath, [CLI, ...args], { cwd, maxBuffer: 8 * 1024 * 1024 })
    return { code: 0, stdout, stderr }
  } catch (err) {
    return { code: err.code ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' }
  }
}

async function tmpProject() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'sdd-test-'))
}

test('sdd init scaffolds a spec-driven project', async () => {
  const dir = await tmpProject()
  const res = await cli(['init'], dir)
  assert.equal(res.code, 0, res.stderr)
  for (const f of ['specs/README.md', 'specs/INDEX.md', 'AGENTS.md', 'CLAUDE.md', 'TODO.md', '.gitignore']) {
    await fs.access(path.join(dir, f))
  }
  assert.match(await fs.readFile(path.join(dir, '.gitignore'), 'utf8'), /\.sdd\/cache\.json/)
})

test('sdd init --dry-run writes nothing', async () => {
  const dir = await tmpProject()
  const res = await cli(['init', '--dry-run'], dir)
  assert.equal(res.code, 0)
  assert.match(res.stdout, /dry run/)
  await assert.rejects(fs.access(path.join(dir, 'AGENTS.md')))
})

test('sdd new allocates sequential ids and fills the template', async () => {
  const dir = await tmpProject()
  await cli(['init'], dir)
  const a = await cli(['new', 'Retry budget', '--json'], dir)
  const b = await cli(['new', 'Token rotation', '--json'], dir)
  assert.equal(a.code, 0, a.stderr)
  assert.equal(JSON.parse(a.stdout).id, '0001')
  assert.equal(JSON.parse(b.stdout).id, '0002')
  const spec = await fs.readFile(path.join(dir, 'specs/0001-retry-budget.md'), 'utf8')
  assert.match(spec, /^# 0001 — Retry budget$/m)
  assert.match(spec, /- \*\*Status:\*\* Draft/)
  assert.doesNotMatch(spec, /YYYY-MM-DD/)
  assert.doesNotMatch(spec, /NNNN/)
})

test('sdd stats and sdd lint report a clean tree and ignore the cache', async () => {
  const dir = await tmpProject()
  await cli(['init'], dir)
  await cli(['new', 'Retry budget'], dir)
  await cli(['index'], dir)
  const stats = await cli(['stats', '--json'], dir)
  assert.equal(stats.code, 0, stats.stderr)
  const parsed = JSON.parse(stats.stdout)
  assert.equal(parsed.total, 1)
  assert.equal(parsed.counts.Draft, 1)
  assert.equal(parsed.errors, 0)

  // a Draft with a full template body lints clean (only the missing sections warning is allowed)
  const lint = await cli(['lint', '--json'], dir)
  const lintJson = JSON.parse(lint.stdout)
  assert.equal(lintJson.errors, 0, JSON.stringify(lintJson.issues))
  assert.equal(lintJson.ok, true)

  // second run must hit the parse cache and still be correct
  const again = await cli(['stats', '--json', '--verbose'], dir)
  assert.equal(JSON.parse(again.stdout).total, 1)
})

test('sdd lint catches format breaks, duplicate ids and broken references', async () => {
  const dir = await tmpProject()
  await cli(['init'], dir)
  const specs = path.join(dir, 'specs')
  await fs.writeFile(path.join(specs, '0001-broken.md'), [
    '# 0002 — Wrong number',
    '',
    '- **Status:** shipped',
    '',
    '## Purpose',
    '',
    'x',
    '',
    '## Acceptance Criteria',
    '',
    '- [ ] AC1: something',
    '',
    '- [missing](nope.md)',
    '',
  ].join('\n'))
  await fs.writeFile(path.join(specs, '0002-broken.md'), [
    '# 0002 — Duplicate',
    '',
    '- **Status:** Implemented',
    '',
    '## Purpose',
    '',
    'x',
    '',
    '## Acceptance Criteria',
    '',
    '- [ ] AC1: unchecked',
    '',
  ].join('\n'))
  const lint = await cli(['lint', '--json', '--no-cache'], dir)
  assert.equal(lint.code, 1, 'lint must exit 1 when there are errors')
  const { issues } = JSON.parse(lint.stdout)
  const rules = new Set(issues.map((i) => i.rule))
  for (const expected of ['id-mismatch', 'status-invalid', 'broken-ref', 'duplicate-id', 'implemented-unchecked']) {
    assert.ok(rules.has(expected), `expected rule ${expected} in ${[...rules].join(', ')}`)
  }
})

test('sdd index regenerates INDEX.md and detects drift', async () => {
  const dir = await tmpProject()
  await cli(['init'], dir)
  await cli(['new', 'Retry budget'], dir)
  const first = await cli(['index', '--json'], dir)
  assert.equal(JSON.parse(first.stdout).changed, true, 'index was empty for zero specs, so adding one changes it')
  const second = await cli(['index', '--json'], dir)
  assert.equal(JSON.parse(second.stdout).changed, false)
  await fs.writeFile(path.join(dir, 'specs/INDEX.md'), '# stale\n')
  const lint = await cli(['lint', '--json', '--no-cache'], dir)
  assert.ok(JSON.parse(lint.stdout).issues.some((i) => i.rule === 'index-stale'))
})

test('sdd install --dry-run plans the right paths for every tool', async () => {
  const dir = await tmpProject()
  const res = await cli(['install', '--all', '--dry-run', '--json'], dir)
  assert.equal(res.code, 0, res.stderr)
  const parsed = JSON.parse(res.stdout)
  const paths = parsed.plan.join('\n')
  for (const fragment of ['.claude/skills', '.opencode/skills', '.agents/skills', '.cursor/rules/sdd.mdc', 'gemini-extension.json']) {
    assert.ok(paths.includes(fragment), `expected ${fragment} in the plan`)
  }
  // hermes is global-only: project scope must report it instead of pretending to install
  const hermes = parsed.results.find((r) => r.tool === 'hermes')
  assert.equal(hermes.installed, 0)
  assert.match(hermes.note, /global-only/)
})

test('sdd install copies the full skill set for claude', async () => {
  const dir = await tmpProject()
  const res = await cli(['install', '--tool', 'claude', '--json'], dir)
  assert.equal(res.code, 0, res.stderr)
  const installed = await fs.readdir(path.join(dir, '.claude/skills'))
  assert.equal(installed.length, 11)
  const skill = await fs.readFile(path.join(dir, '.claude/skills/sdd-init/SKILL.md'), 'utf8')
  assert.match(skill, /^---\nname: sdd-init\n/)
})

test('sdd doctor validates the bundled skills', async () => {
  const dir = await tmpProject()
  const res = await cli(['doctor', '--json'], dir)
  assert.equal(res.code, 0, res.stdout + res.stderr)
  const report = JSON.parse(res.stdout)
  assert.equal(report.ok, true, JSON.stringify(report.issues))
  assert.equal(report.skills.length, 11)
  assert.ok(report.codexSkillListChars < 8000)
})

test('companion files in specs/ subdirectories are not read as specs', async () => {
  const dir = await tmpProject()
  await cli(['init'], dir)
  await cli(['new', 'Retry budget'], dir)
  await fs.mkdir(path.join(dir, 'specs/plans'), { recursive: true })
  await fs.mkdir(path.join(dir, 'specs/evidence'), { recursive: true })
  await fs.writeFile(path.join(dir, 'specs/plans/0001-retry-budget.plan.md'), '# 0001 — plan\n\n- **Status:** Draft\n\n## Purpose\n\nplan\n\n## Acceptance Criteria\n\n- [ ] AC1: task\n')
  await fs.writeFile(path.join(dir, 'specs/evidence/0001-verify.md'), '# evidence\n\n```\n$ npm test\nok\n```\n')
  await cli(['index'], dir)
  const lint = await cli(['lint', '--json', '--no-cache'], dir)
  const parsed = JSON.parse(lint.stdout)
  assert.equal(parsed.scanned, 1, 'only the real spec is scanned')
  assert.equal(parsed.errors, 0, JSON.stringify(parsed.issues))
  const stats = JSON.parse((await cli(['stats', '--json', '--no-cache'], dir)).stdout)
  assert.equal(stats.total, 1)

  // the flat layout is the mistake this convention exists to prevent
  await fs.rename(path.join(dir, 'specs/plans/0001-retry-budget.plan.md'), path.join(dir, 'specs/0001-retry-budget.plan.md'))
  const flat = JSON.parse((await cli(['lint', '--json', '--no-cache'], dir)).stdout)
  assert.ok(flat.issues.some((i) => i.rule === 'duplicate-id'), 'a flat plan file is caught as a duplicate id')
})

test('unknown commands and tools exit 2', async () => {
  const dir = await tmpProject()
  assert.equal((await cli(['nope'], dir)).code, 2)
  assert.equal((await cli(['install', '--tool', 'vim'], dir)).code, 2)
})
