import {mkdir, readFile, rm, writeFile, copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const distRoot = path.join(repoRoot, 'dist');
const isWatchMode = process.argv.includes('--watch');

const rawCssPlugin = {
  name: 'raw-css',
  setup(build) {
    build.onResolve({filter: /\.css\?raw$/}, (args) => {
      const resolvedPath = args.path.replace(/\?raw$/, '');
      return {
        namespace: 'raw-css',
        path: path.resolve(args.resolveDir, resolvedPath),
      };
    });

    build.onLoad({filter: /\.css$/, namespace: 'raw-css'}, async (args) => {
      const contents = await readFile(args.path, 'utf8');
      return {
        contents: `export default ${JSON.stringify(contents)};`,
        loader: 'js',
      };
    });
  },
};

async function ensureDistRoot() {
  await rm(distRoot, {force: true, recursive: true});
  await mkdir(path.join(distRoot, 'content'), {recursive: true});
}

async function copyManifest() {
  await copyFile(
      path.join(repoRoot, 'manifest.json'),
      path.join(distRoot, 'manifest.json'),
  );
}

async function writeReadme() {
  const contents = [
    '# Beyond Full Art',
    '',
    'Load `dist/` as an unpacked Chrome extension.',
  ].join('\n');
  await writeFile(path.join(distRoot, 'README.txt'), contents, 'utf8');
}

async function buildOnce() {
  await ensureDistRoot();
  await Promise.all([
    copyManifest(),
    writeReadme(),
  ]);

  await esbuild.build({
    absWorkingDir: repoRoot,
    bundle: true,
    entryPoints: ['src/content/character-sheet-entry.ts'],
    format: 'iife',
    outfile: 'dist/content/character-sheet-entry.js',
    platform: 'browser',
    plugins: [rawCssPlugin],
    sourcemap: true,
    target: 'chrome114',
  });
}

async function main() {
  if (!isWatchMode) {
    await buildOnce();
    return;
  }

  await ensureDistRoot();
  await Promise.all([
    copyManifest(),
    writeReadme(),
  ]);

  const context = await esbuild.context({
    absWorkingDir: repoRoot,
    bundle: true,
    entryPoints: ['src/content/character-sheet-entry.ts'],
    format: 'iife',
    outfile: 'dist/content/character-sheet-entry.js',
    platform: 'browser',
    plugins: [rawCssPlugin],
    sourcemap: true,
    target: 'chrome114',
  });

  await context.watch();
}

await main();
