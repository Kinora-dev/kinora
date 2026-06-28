import { describe, expect, it } from 'vitest'
import { formatSize, resourceCategory, resourcesForAction, statusClass, toCurl } from '../src/ui/lib/network'

type Res = Parameters<typeof resourceCategory>[0]

function res(opts: {
  url?: string
  method?: string
  status?: number
  type?: string
  mime?: string
  contentSize?: number
  transferSize?: number
  reqHeaders?: { name: string, value: string }[]
  respHeaders?: { name: string, value: string }[]
  postData?: string
  monotonicTime?: number
  time?: number
} = {}): Res {
  return {
    id: 'r1',
    request: {
      url: opts.url ?? 'https://example.com/path/file.js',
      method: opts.method ?? 'GET',
      headers: opts.reqHeaders ?? [],
      postData: opts.postData ? { text: opts.postData } : undefined,
    },
    response: {
      status: opts.status ?? 200,
      content: { mimeType: opts.mime ?? '', size: opts.contentSize },
      _transferSize: opts.transferSize,
      headers: opts.respHeaders ?? [],
    },
    _resourceType: opts.type,
    _monotonicTime: opts.monotonicTime ?? 0,
    time: opts.time ?? 1,
  } as unknown as Res
}

describe('resourceCategory', () => {
  it('classifies by resource type', () => {
    expect(resourceCategory(res({ type: 'document' }))).toBe('HTML')
    expect(resourceCategory(res({ type: 'stylesheet' }))).toBe('CSS')
    expect(resourceCategory(res({ type: 'script' }))).toBe('JS')
    expect(resourceCategory(res({ type: 'font' }))).toBe('Font')
    expect(resourceCategory(res({ type: 'image' }))).toBe('Image')
    expect(resourceCategory(res({ type: 'xhr' }))).toBe('Fetch')
  })

  it('falls back to the mime type, then Other', () => {
    expect(resourceCategory(res({ mime: 'text/html' }))).toBe('HTML')
    expect(resourceCategory(res({ mime: 'image/png' }))).toBe('Image')
    expect(resourceCategory(res({ type: 'manifest', mime: 'application/manifest+json' }))).toBe('Other')
  })
})

describe('formatSize', () => {
  it('formats bytes, KB, MB and dashes empty', () => {
    expect(formatSize(0)).toBe('-')
    expect(formatSize(-1)).toBe('-')
    expect(formatSize(512)).toBe('512 B')
    expect(formatSize(2048)).toBe('2.0 KB')
    expect(formatSize(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})

describe('statusClass', () => {
  it('maps status ranges to tone classes', () => {
    expect(statusClass(0)).toBe('text-muted-foreground')
    expect(statusClass(200)).toBe('text-pass')
    expect(statusClass(301)).toBe('text-flaky')
    expect(statusClass(404)).toBe('text-fail')
    expect(statusClass(503)).toBe('text-fail')
  })
})

describe('toCurl', () => {
  it('builds a GET curl with just the url', () => {
    expect(toCurl(res({ url: 'https://x/a' }))).toBe(`curl 'https://x/a'`)
  })

  it('adds method, headers, and a shell-quoted body', () => {
    const curl = toCurl(res({
      url: 'https://x/a',
      method: 'POST',
      reqHeaders: [{ name: 'Content-Type', value: 'application/json' }],
      postData: '{"a":1}',
    }))
    expect(curl).toContain(`curl 'https://x/a'`)
    expect(curl).toContain('-X POST')
    expect(curl).toContain(`-H 'Content-Type: application/json'`)
    expect(curl).toContain(`--data-raw '{"a":1}'`)
  })

  it('escapes single quotes in values', () => {
    expect(toCurl(res({ url: `https://x/it's` }))).toContain(`'https://x/it'\\''s'`)
  })
})

describe('resourcesForAction', () => {
  type Action = Parameters<typeof resourcesForAction>[1]
  const action = { startTime: 100, endTime: 200 } as unknown as Action

  it('returns rows up to the action end time, skipping later ones', () => {
    const rows = resourcesForAction(
      [
        res({ url: 'https://x/early', monotonicTime: 150, status: 200 }),
        res({ url: 'https://x/late', monotonicTime: 250 }),
      ],
      action,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].url).toBe('https://x/early')
  })

  it('returns nothing without an action', () => {
    expect(resourcesForAction([res({})], undefined)).toEqual([])
  })

  it('resolves the response size: content size, then transfer size, then content-length', () => {
    const action = { startTime: 0, endTime: 1000 } as unknown as Action
    const [content] = resourcesForAction([res({ contentSize: 900, transferSize: 1234, monotonicTime: 10 })], action)
    expect(content.size).toBe(900)
    const [transfer] = resourcesForAction([res({ contentSize: 0, transferSize: 1234, monotonicTime: 10 })], action)
    expect(transfer.size).toBe(1234)
    const [header] = resourcesForAction([res({ contentSize: 0, respHeaders: [{ name: 'Content-Length', value: '500' }], monotonicTime: 10 })], action)
    expect(header.size).toBe(500)
  })
})
