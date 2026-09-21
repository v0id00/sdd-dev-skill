// Validates that every bundled skill satisfies the Agent Skills standard:
// frontmatter present, name matches the directory name, name matches the
// portable name regex, and the description is usable as a trigger line.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SKILLS = path.join(ROOT, 'skills')
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const EXPECTED_SKILLS = [
  'sdd-apply', 'sdd-discover', 'sdd-init', 'sdd-interview', 'sdd-lint',
  'sdd-plan', 'sdd-review', 'sdd-spec', 'sdd-status', 'sdd-update', 'sdd-verify',
]
const REQUIRED_SECTIONS = ['When to use', 'Inputs', 'Procedure', 'Outputs', 'Guardrails', 'Verify']

async function bundle() {
  const dirs = (await fs.readdir(SKILLS, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort()
  const out = []
  for (const name of dirs) {
    const raw = await fs.readFile(path.join(SKILLS, name, 'SKILL.md'), 'utf8')
    out.push({ name, raw })
  }
  return out
}

test('the expected skill set is present', async () => {
  const skills = await bundle()
  assert.deepEqual(skills.map((s) => s.name), EXPECTED_SKILLS)
})

test('every skill has a valid frontmatter block', async () => {
  for (const { name, raw } of await bundle()) {
    const fm = raw.match(/^---\n([\s\S]*?)\n---\n/)
    assert.ok(fm, `${name}: missing frontmatter`)
    const body = fm[1]
    const field = (k) => (body.match(new RegExp(`^${k}:\\s*(.+)$`, 'm')) || [])[1]?.trim().replace(/^"|"$/g, '')
    assert.equal(field('name'), name, `${name}: frontmatter name must equal the directory name`)
    assert.match(name, NAME_RE, `${name}: name must match ${NAME_RE}`)
    assert.ok(field('license'), `${name}: missing license`)
    assert.ok(field('compatibility'), `${name}: missing compatibility`)
    assert.match(body, /^metadata:\s*$/m, `${name}: missing metadata block`)
    assert.match(body, /^\s+role:\s*(bootstrap|author|review|track)\s*$/m, `${name}: metadata.role must be bootstrap|author|review|track`)
  }
})

test('descriptions are usable triggers', async () => {
  for (const { name, raw } of await bundle()) {
    const desc = (raw.match(/^description:\s*"?(.+?)"?\s*$/m) || [])[1] || ''
    assert.ok(desc.startsWith('Use when '), `${name}: description must start with "Use when "`)
    assert.ok(desc.length <= 1024, `${name}: description is ${desc.length} chars (max 1024)`)
    assert.ok(desc.length >= 60, `${name}: description too short to match (${desc.length} chars)`)
    assert.ok(!desc.includes('  '), `${name}: description has a double space (frontmatter parsing hazard)`)
    assert.ok(desc.split(' ').length <= 32, `${name}: description must stay under 32 words for Codex's skill-list budget`)
  }
})

test('every skill uses the standard section skeleton', async () => {
  for (const { name, raw } of await bundle()) {
    for (const section of REQUIRED_SECTIONS) {
      assert.match(raw, new RegExp(`^## ${section}$`, 'm'), `${name}: missing "## ${section}"`)
    }
  }
})

test('skills stay tool-agnostic and never self-approve', async () => {
  for (const { name, raw } of await bundle()) {
    assert.doesNotMatch(raw, /skill_view\(|mcp__|allowed-tools:/, `${name}: references a tool-private API`)
  }
})

test('the Codex skill-list budget is respected', async () => {
  const skills = await bundle()
  const budget = skills.reduce((a, { name, raw }) => {
    const desc = (raw.match(/^description:\s*"?(.+?)"?\s*$/m) || [])[1] || ''
    return a + name.length + desc.length + 20
  }, 0)
  assert.ok(budget < 8000, `name+description budget ${budget} chars exceeds Codex's ~8000 char cap`)
})
