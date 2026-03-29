import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const repoRoot = process.cwd();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-from-npm-'));

const readPackageName = () => {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return packageJson.name;
};

const parsePreserveList = (value) => {
  const rawEntries = (value || '.git,.github,node_modules,.env,scripts')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return new Set(rawEntries);
};

const shouldPreserve = (entryName, preserveList) => {
  return preserveList.has(entryName);
};

const removeUnsyncedEntries = (sourceRoot, preserveList, dryRun) => {
  for (const entry of fs.readdirSync(repoRoot)) {
    if (shouldPreserve(entry, preserveList)) {
      continue;
    }

    const targetPath = path.join(repoRoot, entry);
    const sourcePath = path.join(sourceRoot, entry);

    if (fs.existsSync(sourcePath)) {
      continue;
    }

    if (dryRun) {
      console.log(`Would remove ${entry}`);
      continue;
    }

    fs.rmSync(targetPath, { recursive: true, force: true });
  }
};

const copyPackageEntries = (sourceRoot, preserveList, dryRun) => {
  for (const entry of fs.readdirSync(sourceRoot)) {
    if (shouldPreserve(entry, preserveList)) {
      console.log(`Skipping preserved path ${entry}`);
      continue;
    }

    const sourcePath = path.join(sourceRoot, entry);
    const targetPath = path.join(repoRoot, entry);

    if (dryRun) {
      console.log(`Would sync ${entry}`);
      continue;
    }

    fs.rmSync(targetPath, { recursive: true, force: true });
    fs.cpSync(sourcePath, targetPath, { recursive: true });
  }
};

const packageName = process.env.NPM_PACKAGE_NAME || readPackageName();
const requestedVersion = process.env.NPM_SYNC_VERSION?.trim();
const distTag = process.env.NPM_SYNC_DIST_TAG?.trim() || 'latest';
const preserveList = parsePreserveList(process.env.NPM_SYNC_PRESERVE_PATHS);
const dryRun = process.env.NPM_SYNC_DRY_RUN === '1';
const packageSpec = requestedVersion ? `${packageName}@${requestedVersion}` : `${packageName}@${distTag}`;

try {
  console.log(`Packing ${packageSpec}`);
  const packedTarball = execFileSync('npm', ['pack', packageSpec, '--silent'], {
    cwd: tempRoot,
    encoding: 'utf8',
  }).trim().split('\n').pop();

  if (!packedTarball) {
    throw new Error(`Failed to pack ${packageSpec}`);
  }

  execFileSync('tar', ['-xzf', packedTarball], { cwd: tempRoot });

  const sourceRoot = path.join(tempRoot, 'package');
  if (!fs.existsSync(sourceRoot)) {
    throw new Error('Packed npm tarball did not contain a package/ directory.');
  }

  removeUnsyncedEntries(sourceRoot, preserveList, dryRun);
  copyPackageEntries(sourceRoot, preserveList, dryRun);

  const syncedPackageJson = JSON.parse(
    fs.readFileSync(path.join(sourceRoot, 'package.json'), 'utf8')
  );

  console.log(`Synced ${packageName} version ${syncedPackageJson.version}`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
