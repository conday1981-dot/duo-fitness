// Runs after `expo export --platform web`. Makes dist/ an installable,
// offline-capable web app that works under any path:
// - moves dist/_expo to dist/app (some hosts reserve "_" names) with relative links
// - adds the PWA tags, service worker registration and dark background
// - copies the on-phone text-recognition engine and English model into dist/ocr
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
const nm = new URL('../node_modules/', import.meta.url);
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
const head = [
  '<link rel="manifest" href="./manifest.webmanifest">',
  '<link rel="apple-touch-icon" href="./apple-touch-icon.png">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="DUO">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black">',
  '<meta name="theme-color" content="#0E1116">',
  // Service worker only on the real site (sandboxed previews refuse it).
  '<script>try{if("serviceWorker"in navigator&&location.protocol==="https:"&&!/claude/.test(location.hostname))navigator.serviceWorker.register("./sw.js")}catch(e){}</script>',
].join('\n    ');
html = html.replace('</head>', `    ${head}\n  </head>`);
writeFileSync(file, html);

const ocr = new URL('ocr/', dist);
mkdirSync(ocr, { recursive: true });
for (const [src, name] of [
  ['tesseract.js/dist/tesseract.min.js', 'tesseract.min.js'],
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
]) cpSync(new URL(src, nm), new URL(name, ocr));
console.log('dist/ ready: relative paths, PWA tags, offline cache, text recognition.');
