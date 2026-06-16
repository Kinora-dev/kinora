import type { AddressInfo } from 'node:net'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
  '.zip': 'application/zip',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
}

function mimeFor(p: string): string {
  return MIME[path.extname(p).toLowerCase()] ?? 'application/octet-stream'
}

// Range-capable file send. The vendored SW reads zips via zip.js HttpReader,
// which issues Range GETs, so 206 + Content-Range is mandatory for any .zip.
function sendFile(req: http.IncomingMessage, res: http.ServerResponse, absPath: string): void {
  fs.stat(absPath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('not found')
      return
    }
    res.setHeader('Content-Type', mimeFor(absPath))
    res.setHeader('Accept-Ranges', 'bytes')

    const range = req.headers.range
    const m = range ? /bytes=(\d*)-(\d*)/.exec(range) : null
    if (m) {
      let start: number
      let end: number
      if (m[1] === '' && m[2] !== '') {
        // suffix range: last N bytes (reads the zip end-of-central-directory)
        start = Math.max(0, st.size - Number.parseInt(m[2], 10))
        end = st.size - 1
      }
      else {
        start = m[1] ? Number.parseInt(m[1], 10) : 0
        end = m[2] ? Number.parseInt(m[2], 10) : st.size - 1
      }
      if (end >= st.size)
        end = st.size - 1
      if (Number.isNaN(start) || start > end || start >= st.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${st.size}` })
        res.end()
        return
      }
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${st.size}`,
        'Content-Length': end - start + 1,
      })
      fs.createReadStream(absPath, { start, end }).pipe(res)
      return
    }

    res.writeHead(200, { 'Content-Length': st.size })
    fs.createReadStream(absPath).pipe(res)
  })
}

export interface ServeDirs {
  viewerDir: string
  homeDir: string
}

export interface StartedServer {
  port: number
  server: http.Server
}

// Serve a static dir mounted under a URL prefix (e.g. /trace, /home), Range-capable.
function serveMounted(req: http.IncomingMessage, res: http.ServerResponse, dir: string, prefix: string, pathname: string): void {
  const rel = pathname.slice(prefix.length) || '/index.html'
  const abs = path.join(dir, rel)
  if (!abs.startsWith(dir)) {
    res.writeHead(403)
    res.end('forbidden')
    return
  }
  sendFile(req, res, abs)
}

// Loopback server: home UI under /home/, trace viewer under /trace/, local zip via /file?path=.
export function startServer({ viewerDir, homeDir }: ServeDirs): Promise<StartedServer> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url ?? '/', `http://${req.headers.host}`)

      // Local trace access. Restricted to .zip so the loopback server can't be used as an
      // arbitrary local-file read (it only ever serves Playwright trace archives).
      if (u.pathname === '/file') {
        const p = u.searchParams.get('path')
        if (!p) {
          res.writeHead(400)
          res.end('missing path')
          return
        }
        const abs = path.resolve(p)
        if (!abs.toLowerCase().endsWith('.zip')) {
          res.writeHead(403)
          res.end('forbidden')
          return
        }
        sendFile(req, res, abs)
        return
      }

      if (u.pathname === '/' || u.pathname === '/home') {
        res.writeHead(302, { Location: '/home/index.html' })
        res.end()
        return
      }
      if (u.pathname === '/trace') {
        res.writeHead(302, { Location: '/trace/index.html' })
        res.end()
        return
      }

      if (u.pathname.startsWith('/home/')) {
        serveMounted(req, res, homeDir, '/home', u.pathname)
        return
      }
      if (u.pathname.startsWith('/trace/')) {
        serveMounted(req, res, viewerDir, '/trace', u.pathname)
        return
      }

      res.writeHead(404)
      res.end('not found')
    })

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({ port, server })
    })
  })
}
