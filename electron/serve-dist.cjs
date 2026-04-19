const http = require('node:http')
const fs = require('node:fs/promises')
const path = require('node:path')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
}

function contentType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
}

/**
 * Serves Vite `dist/` over http://127.0.0.1:port so OAuth has a real web origin
 * (file:// is not allowed for Google Identity Services Web client).
 *
 * @param {{ distRoot: string; port: number; host?: string }} opts
 * @returns {Promise<{ url: string; close: () => Promise<void> }>}
 */
async function startDistServer({ distRoot, port, host = '127.0.0.1' }) {
  const distResolved = path.resolve(distRoot)

  const server = http.createServer(async (req, res) => {
    try {
      const rawUrl = req.url || '/'
      const u = new URL(rawUrl, `http://${host}`)
      let pathname = decodeURIComponent(u.pathname)
      if (pathname === '/' || pathname === '') {
        pathname = '/index.html'
      }

      const relPieces = pathname.replace(/^[/\\]+/, '').split(/[/\\]+/).filter(Boolean)
      const candidate = path.resolve(distResolved, ...relPieces)
      const relToDist = path.relative(distResolved, candidate)
      if (relToDist.startsWith('..') || path.isAbsolute(relToDist)) {
        res.writeHead(403).end()
        return
      }

      let stat
      try {
        stat = await fs.stat(candidate)
      } catch {
        stat = null
      }

      if (!stat || !stat.isFile()) {
        const idx = path.join(distResolved, 'index.html')
        try {
          const html = await fs.readFile(idx)
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          })
          res.end(html)
        } catch {
          res.writeHead(404).end('Not found')
        }
        return
      }

      const body = await fs.readFile(candidate)
      res.writeHead(200, {
        'Content-Type': contentType(candidate),
        'Cache-Control': 'no-store',
      })
      res.end(body)
    } catch (e) {
      res.writeHead(500).end(String(e && e.message ? e.message : e))
    }
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      server.off('error', reject)
      resolve()
    })
  })

  const url = `http://${host}:${port}/`
  return {
    url,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      }),
  }
}

module.exports = { startDistServer }
