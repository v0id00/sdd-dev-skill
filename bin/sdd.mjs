#!/usr/bin/env node
// sdd — spec-driven development toolkit.
// Zero dependencies. Installs the bundled skills into an agentic coding tool and
// operates on a project's specs/ directory (parse, lint, index, scaffold).
//
// Exit codes: 0 ok · 1 findings (lint/strict) · 2 usage error · 3 I/O error

import { promises as fs } from 'node:fs'
import { existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const SKILLS_DIR = path.join(ROOT, 'skills')
const TEMPLATES_DIR = path.join(ROOT, 'templates')
const VERSION = '0.1.0'
const CACHE_TTL_MS = 60 * 60 * 1000

// ---------------------------------------------------------------- tool matrix

const TOOLS = {
  claude: {
    label: 'Claude Code',
    binary: 'claude',
    project: '.claude/skills',
    global: '~/.claude/skills',
    invocation: '/sdd-<name>',
    note: 'Also the format used by the Agent Skills open standard.',
  },
  opencode: {
    label: 'opencode',
    binary: 'opencode',
    project: '.opencode/skills',
    global: '~/.config/opencode/skills',
    invocation: 'skill tool',
    note: 'opencode also reads .claude/skills and .agents/skills.',
  },
  codex: {
    label: 'Codex',
    binary: 'codex',
    project: '.agents/skills',
    global: '~/.agents/skills',
    invocation: '$sdd-<name>',
    note: 'Skills list is capped at ~8k chars; keep descriptions short.',
  },
  hermes: {
    label: 'Hermes',
    binary: 'hermes',
    project: null,
    global: '~/.hermes/skills/spec-driven-development',
    invocation: 'skill_view(name="sdd-<name>")',
    globalOnly: true,
    note: 'Hermes skills are user-global; project-local install is not supported.',
  },
  gemini: {
    label: 'Gemini CLI',
    binary: 'gemini',
    project: '.gemini/extensions/sdd',
    global: '~/.gemini/extensions/sdd',
    invocation: 'extension skill',
    extension: true,
    note: 'Installed as a Gemini CLI extension; run `gemini extensions link <dir>` for a local one.',
  },
  cursor: {
    label: 'Cursor',
    binary: 'cursor-agent',
    project: '.agents/skills',
    global: '~/.agents/skills',
    invocation: 'rule + skill files',
    rules: true,
    note: 'Cursor skill discovery is unstable; the installer also writes a .cursor/rules pointer.',
  },
}

// ------------------------------------------------------------------- utilities

const C = process.stdout.isTTY && !process.env.NO_COLOR && !process.argv.includes('--no-color')
const paint = (code, s) => (C ? `\u001b[${code}m${s}\u001b[0m` : s)
const bold = (s) => paint('1', s)
const dim = (s) => paint('2', s)
const red = (s) => paint('31', s)
const green = (s) => paint('32', s)
const yellow = (s) => paint('33', s)
const cyan = (s) => paint('36', s)

const STATUSES = ['Draft', 'Approved', 'Implemented', 'Rejected', 'Superseded']
const REQUIRED_SECTIONS = ['Purpose', 'Acceptance Criteria']
const EXPECTED_SECTIONS = ['Out of Scope', 'Behavior', 'Interfaces', 'Data Model', 'Open Questions', 'Decision Log', 'References']
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

function expandHome(p) {
  if (!p) return p
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function daysBetween(iso, now = new Date()) {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.floor((now.getTime() - t) / 86400000)
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıİi]/g, 'i')
    .replace(/[öÖ]/g, 'o').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

async function readIfExists(p) {
  try {
    return await fs.readFile(p, 'utf8')
  } catch {
    return null
  }
}

async function writeFileEnsured(p, content) {
  await fs.mkdir(path.dirname(p), { recursive: true })
  await fs.writeFile(p, content, 'utf8')
}

async function exists(p) {
  try {
    await fs.lstat(p)
    return true
  } catch {
    return false
  }
}

function fail(msg, code = 3) {
  process.stderr.write(`${red('error')} ${msg}\n`)
  process.exit(code)
}

// -------------------------------------------------------------- arg parsing

function parseArgs(argv) {
  const opts = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') {
      opts._.push(...argv.slice(i + 1))
      break
    }
    if (a.startsWith('--')) {
      const [k, inline] = a.slice(2).split('=')
      const key = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      if (inline !== undefined) opts[key] = inline
      else if (argv[i + 1] && !argv[i + 1].startsWith('-')) opts[key] = argv[++i]
      else opts[key] = true
    } else if (a.startsWith('-') && a.length > 1) {
      for (const ch of a.slice(1)) {
        if (ch === 'h') opts.help = true
        else if (ch === 'j') opts.json = true
        else if (ch === 'v') opts.verbose = true
        else if (ch === 'y') opts.yes = true
        else opts._.push(`-${ch}`)
      }
    } else {
      opts._.push(a)
    }
  }
  return opts
}

// ------------------------------------------------------------------- spec I/O

const cachePath = (specsDir) => path.join(path.dirname(specsDir), '.sdd', 'cache.json')

async function loadCache(specsDir, enabled) {
  if (!enabled) return {}
  try {
    const raw = await fs.readFile(cachePath(specsDir), 'utf8')
    const data = JSON.parse(raw)
    const fresh = {}
    const now = Date.now()
    for (const [k, v] of Object.entries(data.entries || {})) {
      if (now - (v.at || 0) < (data.ttlMs || CACHE_TTL_MS)) fresh[k] = v
    }
    return fresh
  } catch {
    return {}
  }
}

async function saveCache(specsDir, entries) {
  try {
    await writeFileEnsured(cachePath(specsDir), JSON.stringify({ ttlMs: CACHE_TTL_MS, entries }, null, 2))
  } catch {
    /* cache is best-effort */
  }
}

function parseSpec(file, text) {
  const spec = {
    file,
    name: path.basename(file),
    id: null,
    slug: null,
    title: null,
    status: null,
    owner: null,
    created: null,
    updated: null,
    supersedes: null,
    supersededBy: null,
    rejectedReason: null,
    sections: [],
    acs: [],
    refs: [],
    issues: [],
  }

  const m = spec.name.match(/^(\d{4})-(.+)\.md$/)
  if (m) {
    spec.id = m[1]
    spec.slug = m[2]
  } else {
    spec.issues.push({ level: 'error', rule: 'filename', message: `"${spec.name}" is not NNNN-slug.md` })
  }

  const head = text.match(/^#\s+(?:Spec\s+)?(\d{4})?\s*[—:-]?\s*(.+)$/m)
  if (head) {
    spec.headingId = head[1] || null
    spec.title = head[2].trim()
    if (spec.id && spec.headingId && spec.id !== spec.headingId) {
      spec.issues.push({ level: 'error', rule: 'id-mismatch', message: `heading says ${spec.headingId}, file says ${spec.id}` })
    }
  } else {
    spec.issues.push({ level: 'error', rule: 'heading', message: 'missing "# NNNN — Title" heading' })
  }

  const field = (label) => {
    const r = text.match(new RegExp(`^-\\s*\\*\\*${label}:\\*\\*\\s*(.+)$`, 'mi'))
    return r ? r[1].trim() : null
  }

  spec.status = field('Status')
  spec.owner = field('Owner')
  spec.created = field('Created')
  spec.updated = field('Updated')
  spec.supersedes = field('Supersedes')
  spec.supersededBy = field('Superseded by')
  spec.rejectedReason = field('Rejected reason')

  if (!spec.status) {
    spec.issues.push({ level: 'error', rule: 'status-missing', message: 'no "- **Status:**" line' })
  } else if (!STATUSES.includes(spec.status)) {
    spec.issues.push({ level: 'error', rule: 'status-invalid', message: `"${spec.status}" is not one of ${STATUSES.join(', ')}` })
  }
  if (spec.status === 'Rejected' && !spec.rejectedReason) {
    spec.issues.push({ level: 'error', rule: 'rejected-reason', message: 'Rejected spec has no "- **Rejected reason:**"' })
  }
  if (spec.status === 'Superseded' && !spec.supersededBy) {
    spec.issues.push({ level: 'error', rule: 'superseded-link', message: 'Superseded spec has no "- **Superseded by:**"' })
  }

  for (const sm of text.matchAll(/^##\s+(.+?)\s*$/gm)) spec.sections.push(sm[1])
  for (const need of REQUIRED_SECTIONS) {
    if (!spec.sections.some((s) => s.toLowerCase() === need.toLowerCase())) {
      spec.issues.push({ level: 'error', rule: 'section-missing', message: `missing "## ${need}"` })
    }
  }
  for (const want of EXPECTED_SECTIONS) {
    if (spec.sections.length && !spec.sections.some((s) => s.toLowerCase() === want.toLowerCase())) {
      spec.issues.push({ level: 'warn', rule: 'section-expected', message: `no "## ${want}" section` })
    }
  }

  for (const am of text.matchAll(/^\s*-\s*\[([ xX])\]\s*(AC\d+)?\s*:?\s*(.*)$/gm)) {
    spec.acs.push({ id: am[2] || null, checked: am[1].toLowerCase() === 'x', text: am[3].trim() })
  }

  for (const rm of text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    const target = rm[2]
    if (/^(https?:|mailto:|#)/.test(target)) continue
    spec.refs.push({ label: rm[1], target })
  }

  const acsDone = spec.acs.filter((a) => a.checked).length
  spec.acsTotal = spec.acs.length
  spec.acsDone = acsDone

  if (spec.status === 'Implemented' && spec.acsTotal > 0 && acsDone !== spec.acsTotal) {
    spec.issues.push({ level: 'error', rule: 'implemented-unchecked', message: `Implemented but ${spec.acsTotal - acsDone}/${spec.acsTotal} ACs unchecked` })
  }
  if (spec.status === 'Approved' && spec.acsTotal === 0) {
    spec.issues.push({ level: 'error', rule: 'no-acs', message: 'Approved spec has no acceptance criteria' })
  }
  if (spec.acsTotal > 0 && spec.acs.some((a) => !a.id)) {
    spec.issues.push({ level: 'warn', rule: 'ac-unnumbered', message: 'acceptance criteria without ACn ids' })
  }
  if (!spec.updated) {
    spec.issues.push({ level: 'warn', rule: 'updated-missing', message: 'no "- **Updated:**" line' })
  }

  return spec
}

async function loadSpecs(specsDir, { cache = true, verbose = false } = {}) {
  if (!(await exists(specsDir))) return { specs: [], specFiles: [] }
  const names = (await fs.readdir(specsDir)).filter((f) => /^\d{4}-.+\.md$/.test(f)).sort()
  const cached = await loadCache(specsDir, cache)
  const entries = {}
  const specs = []
  let hits = 0
  for (const name of names) {
    const full = path.join(specsDir, name)
    const st = await fs.stat(full)
    const key = full
    const c = cached[key]
    if (cache && c && c.size === st.size && c.mtimeMs === st.mtimeMs) {
      specs.push(c.spec)
      entries[key] = c
      hits++
      continue
    }
    const spec = parseSpec(full, await fs.readFile(full, 'utf8'))
    specs.push(spec)
    entries[key] = { at: Date.now(), size: st.size, mtimeMs: st.mtimeMs, spec }
  }
  if (verbose && hits) process.stderr.write(dim(`cache: ${hits}/${names.length} specs reused\n`))
  if (cache) await saveCache(specsDir, entries)
  return { specs, specFiles: names }
}

function crossCheck(specs, specsDir, { staleDays = 14, staleApprovedDays = 60 } = {}) {
  const out = []
  const byId = new Map()
  for (const s of specs) {
    for (const iss of s.issues) out.push({ ...iss, file: s.name })
    // the heading id is the authority; a file whose heading id collides with
    // another spec's is a traceability break even if the file prefixes differ
    const key = s.headingId || s.id
    if (!key) continue
    if (byId.has(key)) out.push({ level: 'error', rule: 'duplicate-id', file: s.name, message: `id ${key} also claimed by ${byId.get(key).name}` })
    else byId.set(key, s)
  }
  for (const s of specs) if (s.id && !byId.has(s.id)) byId.set(s.id, s)

  for (const s of specs) {
    for (const ref of s.refs) {
      const target = path.resolve(path.dirname(s.file), ref.target.split('#')[0])
      if (!existsSync(target)) {
        out.push({ level: 'error', rule: 'broken-ref', file: s.name, message: `reference "${ref.target}" does not exist` })
      }
    }
    for (const [label, value] of [['Supersedes', s.supersedes], ['Superseded by', s.supersededBy]]) {
      if (!value) continue
      const ids = [...String(value).matchAll(/\b(\d{4})\b/g)].map((m) => m[1])
      for (const id of ids) {
        if (!byId.has(id)) out.push({ level: 'error', rule: 'missing-target', file: s.name, message: `${label}: spec ${id} does not exist` })
      }
    }
    // cascade leak: a live spec citing a Draft or Superseded spec
    if (s.status === 'Approved' || s.status === 'Implemented') {
      for (const ref of s.refs) {
        const t = byId.get((ref.target.match(/^(\d{4})/) || [])[1])
        if (t && (t.status === 'Draft' || t.status === 'Superseded')) {
          out.push({ level: 'warn', rule: 'cascade-leak', file: s.name, message: `${s.status} spec references ${t.status} spec ${t.id} (${t.name})` })
        }
      }
    }
    const age = s.updated ? daysBetween(s.updated) : null
    if (age !== null && s.status === 'Draft' && age > staleDays) {
      out.push({ level: 'warn', rule: 'stale-draft', file: s.name, message: `Draft untouched for ${age} days` })
    }
    if (age !== null && s.status === 'Approved' && age > staleApprovedDays) {
      out.push({ level: 'warn', rule: 'stale-approved', file: s.name, message: `Approved but untouched for ${age} days` })
    }
    if (s.status === 'Implemented' && s.acsTotal === 0) {
      out.push({ level: 'warn', rule: 'no-acs', file: s.name, message: 'Implemented spec has no acceptance criteria' })
    }
  }
  return out
}

function renderIndex(specs) {
  const rows = [...specs].sort((a, b) => String(a.id).localeCompare(String(b.id)))
  const line = (s) => {
    const acs = s.acsTotal ? `${s.acsDone}/${s.acsTotal}` : '—'
    const title = s.title || s.name
    const href = `./${s.name}`
    return `| ${s.id || '????'} | [${title}](${href}) | ${s.status || '?'} | ${acs} | ${s.owner || '—'} | ${s.updated || '—'} |`
  }
  const counts = STATUSES.map((st) => `${st}: ${rows.filter((s) => s.status === st).length}`).join(' · ')
  return [
    '# Spec index',
    '',
    '> Generated by `sdd index`. Do not edit by hand.',
    '',
    counts,
    '',
    '| ID | Title | Status | ACs | Owner | Updated |',
    '|---|---|---|---|---|---|',
    ...rows.map(line),
    '',
  ].join('\n')
}

// ------------------------------------------------------------------ installing

async function bundledSkills() {
  const names = (await fs.readdir(SKILLS_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
  const skills = []
  for (const name of names) {
    const dir = path.join(SKILLS_DIR, name)
    const md = await readIfExists(path.join(dir, 'SKILL.md'))
    if (!md) continue
    const description = (md.match(/^description:\s*(.+)$/m) || [])[1] || ''
    const frontName = (md.match(/^name:\s*(.+)$/m) || [])[1] || ''
    skills.push({
      name,
      dir,
      description: description.replace(/^["']|["']$/g, '').trim(),
      frontName: frontName.trim(),
      extras: (await fs.readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name),
    })
  }
  return skills
}

function validateSkill(s) {
  const issues = []
  if (s.frontName !== s.name) issues.push(`frontmatter name "${s.frontName}" != directory "${s.name}"`)
  if (!NAME_RE.test(s.name)) issues.push('name must match ^[a-z0-9]+(-[a-z0-9]+)*$')
  if (!s.description) issues.push('missing description')
  else if (s.description.length > 1024) issues.push(`description is ${s.description.length} chars (max 1024)`)
  const md = s.raw || ''
  if (!/^---\n[\s\S]*?\n---\n/.test(md)) issues.push('missing YAML frontmatter block')
  return issues
}

async function cmdInstall(opts) {
  const all = !!opts.all
  const tools = all ? Object.keys(TOOLS) : String(opts.tool || '').split(',').map((t) => t.trim()).filter(Boolean)
  if (!tools.length) fail('usage: sdd install --tool <claude|opencode|codex|hermes|gemini|cursor|all> [--global|--project] [--link]', 2)
  for (const t of tools) if (!TOOLS[t]) fail(`unknown tool "${t}" (known: ${Object.keys(TOOLS).join(', ')})`, 2)

  const scope = opts.global ? 'global' : 'project'
  const projectDir = path.resolve(opts.dir || process.cwd())
  const skills = (await bundledSkills()).map((s) => ({ ...s, raw: '' }))
  for (const s of skills) s.raw = (await readIfExists(path.join(s.dir, 'SKILL.md'))) || ''
  if (!skills.length) fail('no bundled skills found — is the package intact?')

  const plan = []
  const results = []
  const started = Date.now()
  let step = 0
  const totalSteps = tools.length * skills.length

  for (const tool of tools) {
    const conf = TOOLS[tool]
    if (conf.globalOnly && scope === 'project') {
      results.push({ tool, scope, target: conf.global, installed: 0, note: `${conf.label} is global-only; use --global` })
      continue
    }
    let base
    if (tool === 'gemini') base = expandHome(scope === 'global' ? conf.global : path.join(projectDir, conf.project))
    else base = expandHome(scope === 'global' ? conf.global : path.join(projectDir, conf.project))

    if (conf.extension) {
      const manifest = {
        name: 'sdd',
        version: VERSION,
        description: 'Spec-driven development skills: bootstrap, author, review, apply and verify specs.',
      }
      const files = [
        [path.join(base, 'gemini-extension.json'), JSON.stringify(manifest, null, 2) + '\n'],
        [path.join(base, 'GEMINI.md'), geminiContext()],
      ]
      for (const [f, content] of files) {
        if (opts.dryRun) plan.push(f)
        else await writeFileEnsured(f, content)
      }
      base = path.join(base, 'skills')
    }

    if (conf.rules) {
      const rulesFile = expandHome(
        scope === 'global' ? path.join(os.homedir(), '.cursor', 'rules', 'sdd.mdc') : path.join(projectDir, '.cursor', 'rules', 'sdd.mdc'),
      )
      if (opts.dryRun) plan.push(rulesFile)
      else await writeFileEnsured(rulesFile, cursorRule(skills))
    }

    let installed = 0
    let skipped = 0
    for (const s of skills) {
      const target = path.join(base, s.name)
      step++
      const pct = Math.round((step / totalSteps) * 100)
      const elapsed = (Date.now() - started) / 1000
      if (!opts.json && !opts.dryRun) {
        const eta = step > 1 ? Math.max(0, Math.round((elapsed / step) * (totalSteps - step))) : 0
        process.stderr.write(`\r${dim(`[${step}/${totalSteps}] ${pct}% eta ${eta}s`)} ${tool}:${s.name}${' '.repeat(12)}`)
      }
      if (opts.dryRun) {
        plan.push(target)
        installed++
        continue
      }
      if (await exists(target)) {
        if (!opts.force) {
          skipped++
          continue
        }
        await fs.rm(target, { recursive: true, force: true })
      }
      await fs.mkdir(base, { recursive: true })
      if (opts.link) {
        await fs.symlink(s.dir, target, 'dir')
      } else {
        await fs.cp(s.dir, target, { recursive: true })
      }
      installed++
    }
    if (!opts.json && !opts.dryRun) process.stderr.write('\r' + ' '.repeat(80) + '\r')
    results.push({ tool, label: conf.label, scope, target: base, installed, skipped, invocation: conf.invocation, note: conf.note })
  }

  if (opts.json) {
    out(JSON.stringify({ ok: true, dryRun: !!opts.dryRun, link: !!opts.link, scope, results, plan }, null, 2))
    return
  }

  if (opts.dryRun) {
    const unique = [...new Set(plan)]
    out(bold(`dry run — would install ${unique.length} paths:`))
    for (const p of unique) out(`  ${cyan(p)}`)
    return
  }

  for (const r of results) {
    if (!r.installed && r.note && !r.skipped) {
      out(`${yellow('skip')} ${r.label}: ${r.note}`)
      continue
    }
    out(`${green('✓')} ${bold(r.label)} → ${cyan(r.target)}  ${dim(`(${r.installed} installed${r.skipped ? `, ${r.skipped} skipped — use --force to overwrite` : ''})`)}`)
    out(dim(`   invoke with: ${r.invocation}`))
  }
  const gem = results.find((r) => r.tool === 'gemini')
  if (gem && !gem.skipped) out(dim(`\nGemini CLI: run \`gemini extensions link ${gem.target}\` once to register the local extension.`))
  out(dim(`\nNext: \`sdd init\` in your project to create specs/.`))
}

function geminiContext() {
  return `# SDD (spec-driven development)

This extension bundles the \`sdd\` skill set. \`specs/\` in the workspace is the source of truth.

Hard rules: no code for a \`Draft\` spec; \`Draft → Approved\` is the user's decision only; spec changes come before code;
acceptance criteria must be proven with real output; specs are superseded, never deleted.

Available skills: ${Object.keys(TOOL_SKILLS).join(', ')}.
Run \`sdd lint\` and \`sdd stats\` from the workspace to see the state of the specs.
`
}

const TOOL_SKILLS = {
  'sdd-init': 'bootstrap a spec-driven repo',
  'sdd-discover': 'reverse-engineer existing behavior into draft specs',
  'sdd-spec': 'author one spec',
  'sdd-interview': 'structured question rounds',
  'sdd-review': 'review and approve/reject',
  'sdd-update': 'change an existing spec with cascades',
  'sdd-plan': 'approved spec to task breakdown',
  'sdd-apply': 'implement under an approved spec',
  'sdd-verify': 'prove acceptance criteria',
  'sdd-status': 'status dashboard and stats',
  'sdd-lint': 'consistency and format check',
}

function cursorRule(skills) {
  const list = skills.map((s) => `- \`${s.name}\`: ${s.description}`).join('\n')
  return `---
description: Spec-driven development. specs/ is the source of truth.
globs:
alwaysApply: true
---

# Spec-driven development

This project is spec-driven: \`specs/\` is the source of truth and code follows specs.

Read \`specs/README.md\` before changing behavior. Hard rules:

1. No implementation for a \`Draft\` spec.
2. \`Draft → Approved\` requires explicit user approval — never self-approve.
3. Spec change first, code second, same commit.
4. Acceptance criteria are proven with real command/test output.
5. Specs are superseded, never deleted.

## Skills available

${list}

Load the relevant skill file from \`.agents/skills/<name>/SKILL.md\` when its trigger matches, and follow it.
Run \`sdd lint\` / \`sdd stats\` / \`sdd index\` for the deterministic parts.
`
}

// ---------------------------------------------------------------- cmd: init

async function cmdInit(opts) {
  const target = path.resolve(opts._[0] || opts.dir || process.cwd())
  const specsDir = path.join(target, 'specs')
  const plan = []

  const ensure = async (p, content, { force = false } = {}) => {
    const full = path.join(target, p)
    if (!force && (await exists(full))) return { p, action: 'exists' }
    plan.push(full)
    if (opts.dryRun) return { p, action: 'would-create' }
    await writeFileEnsured(full, content)
    return { p, action: 'created' }
  }

  const results = []
  results.push(await ensure('specs/README.md', await fs.readFile(path.join(TEMPLATES_DIR, 'specs-README.md'), 'utf8'), { force: true }))
  results.push(await ensure('specs/INDEX.md', renderIndex([]), { force: true }))
  results.push(await ensure('AGENTS.md', await fs.readFile(path.join(TEMPLATES_DIR, 'AGENTS.md'), 'utf8')))
  results.push(await ensure('CLAUDE.md', await fs.readFile(path.join(TEMPLATES_DIR, 'CLAUDE.md'), 'utf8')))
  results.push(await ensure('TODO.md', await fs.readFile(path.join(TEMPLATES_DIR, 'TODO.md'), 'utf8')))

  const gitignorePath = path.join(target, '.gitignore')
  const current = (await readIfExists(gitignorePath)) || ''
  const wanted = ['.sdd/cache.json']
  const missing = wanted.filter((w) => !current.split('\n').map((l) => l.trim()).includes(w))
  if (missing.length) {
    plan.push(gitignorePath)
    if (!opts.dryRun) {
      const next = (current && !current.endsWith('\n') ? current + '\n' : current) + missing.join('\n') + '\n'
      await writeFileEnsured(gitignorePath, next)
    }
  }

  if (opts.json) {
    out(JSON.stringify({ ok: true, dryRun: !!opts.dryRun, target, specsDir, results, plan }, null, 2))
    return
  }
  if (opts.dryRun) {
    out(bold('dry run — would create:'))
    for (const p of plan) out(`  ${cyan(p)}`)
    return
  }
  out(`${green('✓')} SDD scaffold in ${cyan(target)}`)
  for (const r of results) out(`  ${r.action === 'created' ? green('+') : dim('=')} ${r.p} ${r.action === 'exists' ? dim('(kept)') : ''}`)
  out(dim('\nNext:') + ` ask your agent to run ${bold('sdd-discover')} (existing code) or ${bold('sdd-spec')} (new work).`)
}

// ---------------------------------------------------------------- cmd: new

async function cmdNew(opts) {
  const title = opts._.join(' ').trim()
  if (!title) fail('usage: sdd new "<title>" [--specs specs] [--json]', 2)
  const specsDir = path.resolve(opts.specs || 'specs')
  if (!(await exists(specsDir))) fail(`no specs directory at ${specsDir} — run \`sdd init\` first`)
  const files = (await fs.readdir(specsDir)).filter((f) => /^\d{4}-/.test(f))
  const nextId = String(
    Math.max(0, ...files.map((f) => Number.parseInt(f.slice(0, 4), 10) || 0)) + 1,
  ).padStart(4, '0')
  const slug = slugify(title) || 'spec'
  const file = path.join(specsDir, `${nextId}-${slug}.md`)
  let body = await fs.readFile(path.join(TEMPLATES_DIR, 'spec.md'), 'utf8')
  body = body
    .replace(/^# NNNN — Title$/m, `# ${nextId} — ${title}`)
    .replace(/YYYY-MM-DD/g, today())
    .replace(/- \*\*Owner:\*\* unassigned/, `- **Owner:** ${opts.owner || 'unassigned'}`)
  if (await exists(file)) fail(`${file} already exists`)
  if (opts.dryRun) {
    out(opts.json ? JSON.stringify({ ok: true, dryRun: true, file }) : `${dim('dry run —')} would create ${cyan(file)}`)
    return
  }
  await writeFileEnsured(file, body)
  if (opts.json) out(JSON.stringify({ ok: true, file, id: nextId, slug }, null, 2))
  else {
    out(`${green('+')} ${cyan(file)} ${dim('(Status: Draft)')}`)
    out(dim('Fill Purpose → Acceptance Criteria, then run `sdd-interview` before asking for approval.'))
  }
}

// ------------------------------------------------------------- cmd: stats

async function cmdStats(opts) {
  const specsDir = path.resolve(opts.specs || 'specs')
  const { specs } = await loadSpecs(specsDir, { cache: !opts.noCache, verbose: opts.verbose })
  const issues = crossCheck(specs, specsDir, { staleDays: Number(opts.staleDays || 14) })
  const counts = Object.fromEntries(STATUSES.map((s) => [s, specs.filter((x) => x.status === s).length]))
  const acs = specs.reduce((a, s) => ({ total: a.total + s.acsTotal, done: a.done + s.acsDone }), { total: 0, done: 0 })
  const warnings = issues.filter((i) => i.level === 'warn').length
  const errors = issues.filter((i) => i.level === 'error').length
  const stale = specs
    .filter((s) => s.status === 'Draft' && s.updated && daysBetween(s.updated) > Number(opts.staleDays || 14))
    .map((s) => ({ id: s.id, file: s.name, age: daysBetween(s.updated) }))

  const payload = {
    specsDir,
    total: specs.length,
    counts,
    acceptanceCriteria: acs,
    errors,
    warnings,
    stale,
    specs: specs.map((s) => ({
      id: s.id, file: s.name, title: s.title, status: s.status, owner: s.owner,
      updated: s.updated, acs: `${s.acsDone}/${s.acsTotal}`,
    })),
  }
  if (opts.json) {
    out(JSON.stringify(payload, null, 2))
    return errors > 0 ? 1 : 0
  }

  if (!specs.length) {
    out(yellow(`no specs found in ${specsDir}`) + dim(' — run `sdd init` and ask your agent for `sdd-discover`'))
    return 0
  }
  const bar = (n) => '█'.repeat(n)
  out(bold(`specs in ${specsDir}`) + `  ${specs.length} total`)
  for (const st of STATUSES) {
    const n = counts[st]
    out(`  ${st.padEnd(12)} ${String(n).padStart(3)}  ${dim(bar(Math.min(n, 40)))}`)
  }
  const pct = acs.total ? Math.round((acs.done / acs.total) * 100) : 0
  out(`  ${'ACs'.padEnd(12)} ${String(`${acs.done}/${acs.total}`).padStart(3)}  ${dim(`${pct}% proven`)}`)
  if (stale.length) {
    out(`\n${yellow('stale drafts')} (older than ${opts.staleDays || 14} days):`)
    for (const s of stale) out(`  ${s.id} ${dim(s.file)} — ${s.age}d`)
  }
  out(`\n${errors ? red(`${errors} errors`) : green('0 errors')} · ${warnings ? yellow(`${warnings} warnings`) : '0 warnings'} ${dim('(sdd lint for detail)')}`)
  return errors > 0 ? 1 : 0
}

// -------------------------------------------------------------- cmd: lint

const RULE_DOCS = {
  filename: 'Rename to NNNN-slug.md (4-digit id, lowercase hyphen slug).',
  heading: 'Add "# NNNN — Title" as the first heading.',
  'id-mismatch': 'Make the file name and the heading use the same id.',
  'status-missing': 'Add "- **Status:** Draft|Approved|Implemented|Rejected|Superseded".',
  'status-invalid': `Use one of: ${STATUSES.join(', ')}.`,
  'rejected-reason': 'Rejected specs keep a "- **Rejected reason:**" line.',
  'superseded-link': 'Superseded specs keep a "- **Superseded by:** NNNN" link.',
  'section-missing': 'Purpose and Acceptance Criteria are required.',
  'section-expected': 'Add the section, or state explicitly why it is not applicable.',
  'implemented-unchecked': 'Tick every AC before marking Implemented — or revert to Approved.',
  'no-acs': 'Write testable acceptance criteria as "- [ ] ACn: ...".',
  'ac-unnumbered': 'Number the criteria AC1, AC2, ... so they can be referenced.',
  'duplicate-id': 'Re-using an id breaks traceability; allocate the next free number.',
  'broken-ref': 'Fix or remove the reference.',
  'missing-target': 'Point at an existing spec id.',
  'cascade-leak': 'A live spec citing a Draft/Superseded spec is a cascade leak: update or cite the replacement.',
  'stale-draft': 'Finish the interview round and ask for approval, or reject it.',
  'stale-approved': 'Implementation drifted: re-open the spec or move it to Implemented.',
}

async function cmdLint(opts) {
  const specsDir = path.resolve(opts.specs || 'specs')
  if (!(await exists(specsDir))) {
    if (opts.json) out(JSON.stringify({ ok: false, error: `no specs directory at ${specsDir}` }, null, 2))
    else out(yellow(`no specs directory at ${specsDir}`) + dim(' — nothing to lint'))
    return 0
  }
  const { specs, specFiles } = await loadSpecs(specsDir, { cache: !opts.noCache, verbose: opts.verbose })
  const issues = crossCheck(specs, specsDir, {
    staleDays: Number(opts.staleDays || 14),
    staleApprovedDays: Number(opts.staleApprovedDays || 60),
  })

  const indexPath = path.join(specsDir, 'INDEX.md')
  const indexRaw = await readIfExists(indexPath)
  if (indexRaw === null) {
    issues.push({ level: 'warn', rule: 'index-missing', file: 'INDEX.md', message: 'index not generated' })
    RULE_DOCS['index-missing'] = 'Run `sdd index`.'
  } else if (indexRaw.trim() !== renderIndex(specs).trim()) {
    issues.push({ level: 'warn', rule: 'index-stale', file: 'INDEX.md', message: 'index differs from generated output' })
    RULE_DOCS['index-stale'] = 'Run `sdd index` to regenerate.'
  }

  // unrecognised markdown in specs/ (not a spec, not the index/readme)
  for (const f of await fs.readdir(specsDir)) {
    if (!f.endsWith('.md')) continue
    if (/^\d{4}-/.test(f) || f === 'README.md' || f === 'INDEX.md') continue
    issues.push({ level: 'warn', rule: 'stray-file', file: f, message: 'markdown in specs/ that is neither a spec nor README/INDEX' })
    RULE_DOCS['stray-file'] = 'Move it out of specs/, or rename it to NNNN-slug.md if it is a spec.'
  }

  const errors = issues.filter((i) => i.level === 'error')
  const warnings = issues.filter((i) => i.level === 'warn')
  const failed = errors.length > 0 || (opts.strict && warnings.length > 0)

  if (opts.json) {
    out(JSON.stringify({
      ok: !failed, strict: !!opts.strict, specsDir,
      scanned: specFiles.length, errors: errors.length, warnings: warnings.length, issues,
    }, null, 2))
    return failed ? 1 : 0
  }

  out(bold(`lint ${specsDir}`) + dim(` — ${specFiles.length} specs scanned`))
  if (!issues.length) {
    out(`${green('✓')} clean`)
    return 0
  }
  for (const level of ['error', 'warn']) {
    const group = issues.filter((i) => i.level === level)
    if (!group.length) continue
    out(`\n${level === 'error' ? red(`${group.length} error(s)`) : yellow(`${group.length} warning(s)`)}`)
    for (const i of group) {
      out(`  ${level === 'error' ? red('✗') : yellow('!')} ${bold(i.file)} ${dim(`[${i.rule}]`)} ${i.message}`)
      if (opts.verbose && RULE_DOCS[i.rule]) out(dim(`      fix: ${RULE_DOCS[i.rule]}`))
    }
  }
  if (!opts.verbose) out(dim('\n--verbose shows the fix for each rule.'))
  return failed ? 1 : 0
}

// ------------------------------------------------------------- cmd: index

async function cmdIndex(opts) {
  const specsDir = path.resolve(opts.specs || 'specs')
  const { specs } = await loadSpecs(specsDir, { cache: !opts.noCache })
  const content = renderIndex(specs)
  const indexPath = path.join(specsDir, 'INDEX.md')
  const current = await readIfExists(indexPath)
  const changed = current === null || current.trim() !== content.trim()
  if (opts.dryRun) {
    if (opts.json) out(JSON.stringify({ ok: true, dryRun: true, changed, indexPath }, null, 2))
    else out(changed ? `${dim('dry run —')} INDEX.md would change` : `${dim('dry run —')} INDEX.md already up to date`)
    return 0
  }
  if (!changed) {
    if (opts.json) out(JSON.stringify({ ok: true, changed: false, indexPath }, null, 2))
    else out(`${green('✓')} INDEX.md already up to date`)
    return 0
  }
  await writeFileEnsured(indexPath, content)
  if (opts.json) out(JSON.stringify({ ok: true, changed: true, indexPath, specs: specs.length }, null, 2))
  else out(`${green('✓')} ${cyan(indexPath)} ${dim(`(${specs.length} specs)`)}`)
  return 0
}

// -------------------------------------------------------------- cmd: list / doctor

async function cmdList(opts) {
  const skills = await bundledSkills()
  if (opts.json) {
    out(JSON.stringify({ ok: true, version: VERSION, count: skills.length, skills: skills.map(({ name, description }) => ({ name, description })) }, null, 2))
    return 0
  }
  out(bold(`sdd-skills v${VERSION}`) + dim(` — ${skills.length} skills`))
  for (const s of skills) out(`  ${cyan(s.name.padEnd(14))} ${s.description}`)
  return 0
}

async function cmdDoctor(opts) {
  const skills = await bundledSkills()
  const report = { ok: true, version: VERSION, skills: [], tools: [], issues: [] }

  for (const s of skills) {
    const raw = (await readIfExists(path.join(s.dir, 'SKILL.md'))) || ''
    const issues = validateSkill({ ...s, raw })
    report.skills.push({ name: s.name, bytes: Buffer.byteLength(raw), extras: s.extras, issues })
    for (const i of issues) report.issues.push({ scope: 'skill', name: s.name, message: i })
  }

  const budget = skills.reduce((a, s) => a + s.name.length + s.description.length + 20, 0)
  report.codexSkillListChars = budget
  if (budget > 8000) report.issues.push({ scope: 'codex', name: 'skills-list', message: `name+description budget ${budget} chars exceeds Codex's ~8000 char skill list cap` })

  for (const [key, conf] of Object.entries(TOOLS)) {
    const project = conf.project ? path.join(process.cwd(), conf.project) : null
    const global = expandHome(conf.global)
    const entry = {
      tool: key, label: conf.label, binary: conf.binary,
      binaryFound: whichSync(conf.binary),
      project: project && (await exists(project)) ? project : null,
      global: (await exists(global)) ? global : null,
    }
    report.tools.push(entry)
  }

  for (const s of report.skills) if (s.issues.length) report.ok = false
  if (opts.json) {
    out(JSON.stringify(report, null, 2))
    return report.ok ? 0 : 1
  }
  out(bold(`doctor — sdd-skills v${VERSION}`))
  out(`\n${bold('bundled skills')} ${dim(`(codex list budget ${report.codexSkillListChars}/8000 chars)`)}`)
  for (const s of report.skills) {
    out(`  ${s.issues.length ? red('✗') : green('✓')} ${s.name.padEnd(14)} ${dim(`${s.bytes}B${s.extras.length ? ' +' + s.extras.join(',') : ''}`)}`)
    for (const i of s.issues) out(`      ${red(i)}`)
  }
  out(`\n${bold('tool installs')}`)
  for (const t of report.tools) {
    const where = [t.project && `project dir: ${t.project}`, t.global && `global dir: ${t.global}`].filter(Boolean)
    out(`  ${t.binaryFound ? green('✓') : dim('–')} ${t.label.padEnd(12)} ${dim(t.binaryFound ? 'cli on PATH' : 'cli not on PATH')}  ${where.length ? where.join('  ') : dim('not installed')}`)
  }
  return report.ok ? 0 : 1
}

function whichSync(bin) {
  const dirs = (process.env.PATH || '').split(path.delimiter)
  for (const d of dirs) {
    const p = path.join(d, bin)
    if (existsSync(p)) return p
  }
  return null
}

// ------------------------------------------------------------------- help

const HELP = `sdd — spec-driven development toolkit (skills + specs/ tooling)

USAGE
  sdd <command> [options]

COMMANDS
  install   Copy the bundled skills into an agentic coding tool
  init      Scaffold specs/, AGENTS.md, CLAUDE.md, TODO.md in a project
  new       Create the next spec file from the template
  stats     Status counts, acceptance-criteria progress, stale specs
  lint      Format, duplicate ids, broken links, cascade leaks, staleness
  index     Regenerate specs/INDEX.md
  list      List the bundled skills
  doctor    Validate the bundled skills and detect tool installs

GLOBAL OPTIONS
  --json              Machine-readable output (every command)
  --verbose, -v       Extra detail (lint shows the fix per rule)
  --dry-run           Print what would change, change nothing
  --no-cache          Ignore the .sdd/cache.json parse cache
  --help, -h          Show help (also per command)
  --version           Print the version

COMMON OPTIONS
  install  --tool <claude|opencode|codex|hermes|gemini|cursor|all>
           --global | --project      Install scope (default: project)
           --link                    Symlink instead of copy (development)
           --force                   Overwrite skills that already exist
           --dir <path>              Project root (default: cwd)
  init     [dir]                      Target project (default: cwd)
  new      "<title>" [--owner NAME] [--specs specs]
  stats    [--specs specs] [--stale-days 14]
  lint     [--specs specs] [--strict] [--stale-days 14] [--stale-approved-days 60]
  index    [--specs specs]

EXIT CODES
  0 success · 1 findings (lint errors, or warnings with --strict) · 2 usage · 3 I/O

EXAMPLES
  sdd install --tool claude --global        # skills for every Claude Code session
  sdd install --all --dry-run               # see every path first
  sdd init                                  # specs/ in the current repo
  sdd stats --json | jq .counts             # dashboard for automation
  sdd lint --verbose                        # findings plus how to fix each
`

const COMMANDS = {
  install: cmdInstall,
  init: cmdInit,
  new: cmdNew,
  stats: cmdStats,
  lint: cmdLint,
  index: cmdIndex,
  list: cmdList,
  doctor: cmdDoctor,
}

function out(s) {
  process.stdout.write(s + '\n')
}

async function main() {
  const argv = process.argv.slice(2)
  if (!argv.length || argv[0] === '--help' || argv[0] === '-h' || argv[0] === 'help') {
    out(HELP)
    return 0
  }
  if (argv[0] === '--version' || argv[0] === '-V') {
    out(VERSION)
    return 0
  }
  const cmd = argv[0]
  const opts = parseArgs(argv.slice(1))
  if (opts.help) {
    out(HELP)
    return 0
  }
  if (!COMMANDS[cmd]) {
    process.stderr.write(`${red('error')} unknown command "${cmd}"\n\n${HELP}`)
    return 2
  }
  const result = await COMMANDS[cmd](opts)
  return typeof result === 'number' ? result : 0
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`${red('error')} ${err?.stack || err}\n`)
    process.exit(3)
  })
