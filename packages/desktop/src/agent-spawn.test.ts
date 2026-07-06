import type { AgentResult } from './agent'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const TARGET = { title: 't', absFile: '/repo/t.spec.ts', line: 3, projectName: 'chromium', status: 'unexpected', errors: 'boom' }

// KINORA_AGENT_CMD is read at module load, so the fake agent binary must exist and be
// in the env before agent.ts is imported (fresh module registry per test). The fake is
// a self-executable node script that ignores claude's CLI flags.
async function runFake(body: string): Promise<{ output: string, result: AgentResult }> {
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
      }, resolve)
    })
    return { output, result }
  }
  finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

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

  it('reports a non-zero exit as an error', async () => {
    const { result } = await runFake('process.stdin.resume(); process.stdin.on(\'end\', () => process.exit(2))')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('exited with code 2')
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
