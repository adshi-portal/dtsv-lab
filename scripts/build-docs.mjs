import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/opt/npm-tools/node_modules/');
const { marked } = require('marked');
const md = readFileSync('docs/01-analiz-specyfikatsiia.md', 'utf8');
const html = `<!DOCTYPE html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Специфікація ДТСВ-лабораторії</title>
<style>body{font:15px/1.55 "Segoe UI",Roboto,Arial,sans-serif;max-width:1100px;margin:2rem auto;padding:0 1rem;color:#14213d;background:#f5f3ee}h1,h2,h3{font-family:Cambria,Georgia,serif}table{border-collapse:collapse;width:100%;background:#fff;font-size:.88rem;margin:.6rem 0}th,td{border:1px solid #d9d5cc;padding:.4rem .5rem;vertical-align:top;text-align:left}th{background:#eef1f6}code{background:#ebe7df;padding:0 .3em;border-radius:3px}a{color:#0f766e}</style></head><body><p><a href="../index.html">← До лабораторії</a></p>${marked.parse(md)}</body></html>`;
writeFileSync('docs/specyfikatsiia.html', html);
console.log('ok');
