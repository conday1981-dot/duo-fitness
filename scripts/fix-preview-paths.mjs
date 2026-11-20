// Makes `expo export --platform web` output work when hosted under any path
// (e.g. a private claude.ai artifact, which also reserves names starting "_"):
// - moves dist/_expo to dist/app and rewrites references to relative "./app/"
// - makes /assets references relative
// - sets the page background to match the app so no white edges show
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
const from = new URL('_expo', dist);
const to = new URL('app', dist);
if (existsSync(from)) {
  rmSync(to, { recursive: true, force: true });
  renameSync(from, to);
}
rmSync(new URL('metadata.json', dist), { force: true });

const file = new URL('index.html', dist);
let html = readFileSync(file, 'utf8');
html = html.replaceAll('"/_expo/', '"./app/').replaceAll('"/assets/', '"./assets/');
html = html.replace('</style>', '      html, body { background: #0E1116; }\n    </style>');
writeFileSync(file, html);
console.log('Preview ready in dist/ (relative paths).');
