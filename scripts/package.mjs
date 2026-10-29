import {spawnSync} from 'node:child_process';
import {copyFile, mkdir, readFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(repoRoot, 'dist');
const releaseRoot = path.join(repoRoot, 'release');

const build = spawnSync(process.execPath, ['scripts/build.mjs', '--release'], {
  cwd: repoRoot,
  stdio: 'inherit',
});
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const manifest = JSON.parse(await readFile(path.join(repoRoot, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
if (pkg.version !== manifest.version) {
  console.error(`package.json is ${pkg.version} and manifest.json is ${manifest.version}. Use one version.`);
  process.exit(1);
}

await copyFile(path.join(repoRoot, 'LICENSE'), path.join(distRoot, 'LICENSE'));
await copyFile(path.join(repoRoot, 'NOTICE'), path.join(distRoot, 'NOTICE'));
await mkdir(releaseRoot, {recursive: true});

const zipName = `beyond-full-art-${manifest.version}.zip`;
const zipPath = path.join(releaseRoot, zipName);
await rm(zipPath, {force: true});
const zip = spawnSync('zip', ['-r', '-X', zipPath, '.', '-x', '*.map', '-x', 'README.txt', '-x', '*/.DS_Store'], {
  cwd: distRoot,
  stdio: 'inherit',
});
if (zip.status !== 0) {
  process.exit(zip.status ?? 1);
}

const listing = spawnSync('unzip', ['-Z1', zipPath], {encoding: 'utf8'});
if (listing.status !== 0) {
  process.exit(listing.status ?? 1);
}
const names = listing.stdout.split('\n').filter((name) => name !== '');
const problems = [];
if (!names.includes('manifest.json')) {
  problems.push('manifest.json is not at the zip root');
}
if (names.some((name) => name.endsWith('.map'))) {
  problems.push('the zip still contains a source map');
}
if (names.some((name) => name.startsWith('..') || name.startsWith('/'))) {
  problems.push('the zip contains a path outside the extension');
}
if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`Wrote ${path.relative(repoRoot, zipPath)} (${names.length} files)`);
