#!/usr/bin/env node
/** Zero-dependency static server for local dev / Playwright. */
import http from 'node:http'
import { createReadStream, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const port = Number(process.env.PORT) || 5173
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.mod': 'application/octet-stream',
  '.xm': 'application/octet-stream',
  '.s3m': 'application/octet-stream',
  '.it': 'application/octet-stream',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
}

const server = http.createServer((req, res) => {
  let url
  try { url = decodeURIComponent(new URL(req.url, 'http://x').pathname) } catch { res.writeHead(400); return res.end('bad url') }
  if (url.endsWith('/')) url += 'index.html'
  const file = normalize(join(root, url))
  if (!file.startsWith(root)) { res.writeHead(403); return res.end('no') }
  try {
    const st = statSync(file)
    if (st.isDirectory()) { res.writeHead(302, { location: url + '/' }); return res.end() }
    res.writeHead(200, {
      'content-type': types[extname(file)] || 'application/octet-stream',
      'content-length': st.size,
      'cache-control': 'no-store',
      'cross-origin-opener-policy': 'same-origin',
    })
    createReadStream(file).pipe(res)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('404: the file has left the chat')
  }
})
server.listen(port, () => console.log(`TRACKER TRASH dev server: http://localhost:${port}`))
