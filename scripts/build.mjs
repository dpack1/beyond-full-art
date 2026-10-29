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
  await mkdir(path.join(distRoot, 'background'), {recursive: true});
  await mkdir(path.join(distRoot, 'icons'), {recursive: true});
  await mkdir(path.join(distRoot, 'popup'), {recursive: true});
  await mkdir(path.join(distRoot, 'folder'), {recursive: true});
}

async function copyManifest() {
  await copyFile(
      path.join(repoRoot, 'manifest.json'),
      path.join(distRoot, 'manifest.json'),
  );
}

async function copyIcons() {
  await Promise.all([
    copyFile(
        path.join(repoRoot, 'assets/icons/icon-16.png'),
        path.join(distRoot, 'icons/icon-16.png'),
    ),
    copyFile(
        path.join(repoRoot, 'assets/icons/icon-32.png'),
        path.join(distRoot, 'icons/icon-32.png'),
    ),
    copyFile(
        path.join(repoRoot, 'assets/icons/icon-48.png'),
        path.join(distRoot, 'icons/icon-48.png'),
    ),
    copyFile(
        path.join(repoRoot, 'assets/icons/icon-128.png'),
        path.join(distRoot, 'icons/icon-128.png'),
    ),
  ]);
}

async function writeReadme() {
  const contents = [
    '# Beyond Full Art',
    '',
    'Load `dist/` as an unpacked Chrome extension.',
  ].join('\n');
  await writeFile(path.join(distRoot, 'README.txt'), contents, 'utf8');
}

async function copyPopupHtml() {
  await copyFile(
      path.join(repoRoot, 'src/popup/settings.html'),
      path.join(distRoot, 'popup/settings.html'),
  );
  await copyFile(
      path.join(repoRoot, 'src/folder/setup.html'),
      path.join(distRoot, 'folder/setup.html'),
  );
}

async function buildOnce() {
  await ensureDistRoot();
  await Promise.all([
    copyManifest(),
    copyIcons(),
    copyPopupHtml(),
    writeReadme(),
  ]);

  await Promise.all([
    esbuild.build({
      absWorkingDir: repoRoot,
      bundle: true,
      entryPoints: ['src/content/character-sheet-entry.ts'],
      format: 'iife',
      outfile: 'dist/content/character-sheet-entry.js',
      platform: 'browser',
      plugins: [rawCssPlugin],
      sourcemap: true,
      target: 'chrome114',
    }),
    esbuild.build({
      absWorkingDir: repoRoot,
      bundle: true,
      entryPoints: ['src/content/card-portraits-entry.ts'],
      format: 'iife',
      outfile: 'dist/content/card-portraits-entry.js',
      platform: 'browser',
      plugins: [rawCssPlugin],
      sourcemap: true,
      target: 'chrome114',
    }),
    esbuild.build(characterDeletionBuildOptions('src/content/character-deletion-entry.ts', 'dist/content/character-deletion-entry.js')),
    esbuild.build(characterDeletionBuildOptions('src/content/character-deletion-main.ts', 'dist/content/character-deletion-main.js')),
    esbuild.build(characterDeletionBuildOptions('src/content/character-copy-entry.ts', 'dist/content/character-copy-entry.js')),
    esbuild.build({
      absWorkingDir: repoRoot,
      bundle: true,
      entryPoints: ['src/background/service-worker.ts'],
      format: 'iife',
      outfile: 'dist/background/service-worker.js',
      platform: 'browser',
      plugins: [rawCssPlugin],
      sourcemap: true,
      target: 'chrome114',
    }),
    esbuild.build({
      absWorkingDir: repoRoot,
      bundle: true,
      entryPoints: ['src/popup/settings.ts'],
      format: 'iife',
      outfile: 'dist/popup/settings.js',
      platform: 'browser',
      plugins: [rawCssPlugin],
      sourcemap: true,
      target: 'chrome114',
    }),
    esbuild.build(folderSetupBuildOptions()),
  ]);
}

function characterDeletionBuildOptions(entryPoint, outfile) {
  return {
    absWorkingDir: repoRoot,
    bundle: true,
    entryPoints: [entryPoint],
    format: 'iife',
    outfile,
    platform: 'browser',
    plugins: [rawCssPlugin],
    sourcemap: true,
    target: 'chrome114',
  };
}

function folderSetupBuildOptions() {
  return {
    absWorkingDir: repoRoot,
    bundle: true,
    entryPoints: ['src/folder/setup.ts'],
    format: 'iife',
    outfile: 'dist/folder/setup.js',
    platform: 'browser',
    plugins: [rawCssPlugin],
    sourcemap: true,
    target: 'chrome114',
  };
}

async function main() {
  if (!isWatchMode) {
    await buildOnce();
    return;
  }

  await ensureDistRoot();
  await Promise.all([
    copyManifest(),
    copyIcons(),
    copyPopupHtml(),
    writeReadme(),
  ]);

  const contentContext = await esbuild.context({
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

  const backgroundContext = await esbuild.context({
    absWorkingDir: repoRoot,
    bundle: true,
    entryPoints: ['src/background/service-worker.ts'],
    format: 'iife',
    outfile: 'dist/background/service-worker.js',
    platform: 'browser',
    plugins: [rawCssPlugin],
    sourcemap: true,
    target: 'chrome114',
  });

  const cardPortraitsContext = await esbuild.context({
    absWorkingDir: repoRoot,
    bundle: true,
    entryPoints: ['src/content/card-portraits-entry.ts'],
    format: 'iife',
    outfile: 'dist/content/card-portraits-entry.js',
    platform: 'browser',
    plugins: [rawCssPlugin],
    sourcemap: true,
    target: 'chrome114',
  });

  const popupContext = await esbuild.context({
    absWorkingDir: repoRoot,
    bundle: true,
    entryPoints: ['src/popup/settings.ts'],
    format: 'iife',
    outfile: 'dist/popup/settings.js',
    platform: 'browser',
    plugins: [rawCssPlugin],
    sourcemap: true,
    target: 'chrome114',
  });

  const folderSetupContext = await esbuild.context(folderSetupBuildOptions());
  const deletionContext = await esbuild.context(characterDeletionBuildOptions(
      'src/content/character-deletion-entry.ts',
      'dist/content/character-deletion-entry.js',
  ));
  const deletionMainContext = await esbuild.context(characterDeletionBuildOptions(
      'src/content/character-deletion-main.ts',
      'dist/content/character-deletion-main.js',
  ));
  const copyContext = await esbuild.context(characterDeletionBuildOptions(
      'src/content/character-copy-entry.ts',
      'dist/content/character-copy-entry.js',
  ));

  await Promise.all([
    contentContext.watch(),
    backgroundContext.watch(),
    cardPortraitsContext.watch(),
    popupContext.watch(),
    folderSetupContext.watch(),
    deletionContext.watch(),
    deletionMainContext.watch(),
    copyContext.watch(),
  ]);
}

await main();
