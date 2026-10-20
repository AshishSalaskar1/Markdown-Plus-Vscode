import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Exercise the production module/chunk build and the actual webview HTML/CSP.
const buildArgs = process.env.MARKDOWN_PRO_TEST_BUILD === 'development'
  ? ['esbuild.config.mjs'] : ['esbuild.config.mjs', '--production'];
execFileSync(process.execPath, buildArgs, { stdio: 'inherit' });
const result = await build({
  entryPoints: ['src/utils/html.ts'], bundle: true, platform: 'node', format: 'cjs', write: false,
  plugins: [{
    name: 'vscode-stub',
    setup(builder) {
      builder.onResolve({ filter: /^vscode$/ }, () => ({ path: 'vscode', namespace: 'stub' }));
      builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents: `export const Uri = { joinPath: (_base, ...parts) => '/' + parts.join('/') };`,
      }));
    },
  }],
});
const module = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const root = resolve('dist');
const mimeTypes = { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };

createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:4173');
  if (url.pathname === '/') {
    const html = module.exports.getWebviewHtml({ cspSource: "'self'", asWebviewUri: uri => uri }, {}, false, '/docs/');
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end(html);
    return;
  }
  const file = resolve(root, url.pathname.replace(/^\/dist\//, ''));
  if (!url.pathname.startsWith('/dist/') || !file.startsWith(root + sep)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const content = await readFile(file);
    response.writeHead(200, { 'Content-Type': mimeTypes[extname(file)] ?? 'application/octet-stream' });
    response.end(content);
  } catch {
    response.writeHead(404).end();
  }
}).listen(4173, '127.0.0.1');
