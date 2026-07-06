import type { AgentResult, AgentRunOpts } from './agent'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const TARGET = { title: 't', absFile: '/repo/t.spec.ts', line: 3, projectName: 'chromium', status: 'unexpected', errors: 'boom' }

// KINORA_AGENT_CMD is read at module load, so the fake agent binary must exist and be
// in the env before agent.ts is imported (fresh module registry per test). The fake is
// a self-executable node script that ignores claude's CLI flags.
async function runFake(body: string, opts: AgentRunOpts = {}): Promise<{ output: string, result: AgentResult }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kinora-fake-agent-'))
  const bin = path.join(dir, 'fake-agent.mjs')
  fs.writeFileSync(bin, `#!/usr/bin/env node\n${body}`)
  fs.chmodSync(bin, 0o755)
  vi.stubEnv('KINORA_AGENT_CMD', bin)
  vi.resetModules()
  const { startAgentFix } = await import('./agent')
  try {
    let output = ''
    const result = await new Promise<AgentResult>((resolve) => {
      startAgentFix(dir, TARGET, (chunk) => {
        output += chunk
      }, resolve, opts)
    })
    return { output, result }
  }
  finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

// Echoes what the agent process actually received (argv + stdin) back through
// stream-json text, so tests can assert on the real spawn contract.
const ECHO_AGENT = `
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  const prompt = Buffer.concat(chunks).toString()
  const say = o => process.stdout.write(JSON.stringify(o) + '\\n')
  say({ type: 'system', subtype: 'init', model: 'fake', session_id: 'sess-42' })
  say({ type: 'assistant', message: { content: [{ type: 'text', text: 'ARGS:' + process.argv.slice(2).join(' ') }] } })
  say({ type: 'assistant', message: { content: [{ type: 'text', text: 'PROMPT:' + prompt.split('\\n')[0] }] } })
  say({ type: 'result', subtype: 'success', is_error: false })
`

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('startAgentFix (fake agent binary)', () => {
  it('feeds the prompt on stdin and streams formatted events', async () => {
    const { output, result } = await runFake(`
      const chunks = []
      for await (const c of process.stdin) chunks.push(c)
      const prompt = Buffer.concat(chunks).toString()
      const say = o => process.stdout.write(JSON.stringify(o) + '\\n')
      say({ type: 'system', subtype: 'init', model: 'fake-model' })
      say({ type: 'assistant', message: { content: [{ type: 'text', text: 'PROMPT_HAS_ERROR:' + prompt.includes('boom') }] } })
      say({ type: 'result', subtype: 'success', is_error: false })
    `)
    expect(output).toContain('▸ agent started (fake-model)')
    expect(output).toContain('PROMPT_HAS_ERROR:true')
    expect(output).toContain('✔ agent finished')
    expect(result).toEqual({ ok: true, error: undefined })
  })

  it('captures the session id and omits --resume on a fresh run', async () => {
    const { output, result } = await runFake(ECHO_AGENT)
    expect(result.sessionId).toBe('sess-42')
    expect(output).not.toContain('--resume')
    expect(output).toContain('PROMPT:This Playwright test is failing')
  })

  it('passes --resume and the caller-built prompt when resuming', async () => {
    const { output, result } = await runFake(ECHO_AGENT, { resumeSessionId: 'sess-42', resumePrompt: 'RESUME-PROMPT here' })
    expect(result.ok).toBe(true)
    expect(output).toContain('--resume sess-42')
    expect(output).toContain('PROMPT:RESUME-PROMPT here')
  })

  it('reports cost and duration from the result event', async () => {
    const { result } = await runFake(`
      process.stdin.resume()
      process.stdin.on('end', () => {
        process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.1234, duration_ms: 4200 }) + '\\n')
        process.exit(0)
      })
    `)
    expect(result.costUsd).toBeCloseTo(0.1234)
    expect(result.durationMs).toBe(4200)
  })

  it('reports a non-zero exit as an error', async () => {
    const { result } = await runFake('process.stdin.resume(); process.stdin.on(\'end\', () => process.exit(2))')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('exited with code 2')
  })

  it('kills a wedged agent at the wall-clock timeout', async () => {
    const start = Date.now()
    const { output, result } = await runFake(
      'process.stdin.resume(); setTimeout(() => process.exit(0), 30_000)',
      { timeoutMs: 500 },
    )
    expect(Date.now() - start).toBeLessThan(10_000)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('timed out')
    expect(output).toContain('timed out')
  })

  it('surfaces a missing binary with an install hint', async () => {
    vi.stubEnv('KINORA_AGENT_CMD', '/nonexistent/claude')
    vi.resetModules()
    const { startAgentFix } = await import('./agent')
    const result = await new Promise<AgentResult>((resolve) => {
      startAgentFix(os.tmpdir(), TARGET, () => {}, resolve)
    })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not found')
    expect(result.error).toContain('npm install -g')
  })
})
