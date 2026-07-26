import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const PORT = 8777;
const types = { '.html':'text/html', '.csv':'text/csv', '.js':'text/javascript' };

createServer((req, res) => {
  let path = req.url.split('?')[0];
  if (path === '/' || path === '') path = '/reconcile.html';
  try {
    const buf = readFileSync(join(dir, decodeURIComponent(path)));
    const ext = path.slice(path.lastIndexOf('.'));
    res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(PORT, () => console.log(`ProofSync reconciler → http://localhost:${PORT}/`));
