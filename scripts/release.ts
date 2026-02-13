#!/usr/bin/env bun
/**
 * Release script for Rin
 * 
 * Usage:
 *   bun scripts/release.ts <version> [options]
 * 
 * Examples:
 *   bun scripts/release.ts patch          # 0.1.0 -> 0.1.1
 *   bun scripts/release.ts minor          # 0.1.0 -> 0.2.0
 *   bun scripts/release.ts major          # 0.1.0 -> 1.0.0
 *   bun scripts/release.ts 1.2.3          # Set specific version
 *   bun scripts/release.ts minor --dry-run # Preview changes without applying
 * 
 * Options:
 *   --dry-run    Preview changes without modifying files
 *   --skip-git   Skip git operations (tagging and committing)
 *   --force      Force release even if checks fail
 */

import { $ } from "bun";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const VALID_BUMPS = ['patch', 'minor', 'major'] as const;
type BumpType = typeof VALID_BUMPS[number];

interface ReleaseOptions {
  dryRun: boolean;
  skipGit: boolean;
  force: boolean;
}

interface PackageJson {
  version: string;
  [key: string]: unknown;
}

function parseArgs(): { version: string; options: ReleaseOptions } {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Error: Version argument required');
    console.error('Usage: bun scripts/release.ts <version>');
    console.error('  version: patch | minor | major | x.y.z');
    process.exit(1);
  }

  const version = args[0];
  const options: ReleaseOptions = {
    dryRun: args.includes('--dry-run'),
    skipGit: args.includes('--skip-git'),
    force: args.includes('--force'),
  };

  return { version, options };
}

function isValidVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/.test(version);
}

function bumpVersion(currentVersion: string, bumpType: BumpType): string {
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Invalid bump type: ${bumpType}`);
  }
}

function getNewVersion(currentVersion: string, versionArg: string): string {
  if (VALID_BUMPS.includes(versionArg as BumpType)) {
    return bumpVersion(currentVersion, versionArg as BumpType);
  }
  
  if (isValidVersion(versionArg)) {
    return versionArg;
  }
  
  throw new Error(`Invalid version format: ${versionArg}`);
}

async function getCurrentVersion(): Promise<string> {
  const packageJson = await readFile('package.json', 'utf-8');
  const pkg = JSON.parse(packageJson) as PackageJson;
  return pkg.version;
}

async function updatePackageJson(version: string, dryRun: boolean): Promise<void> {
  const files = ['package.json', 'client/package.json', 'server/package.json'];
  
  for (const file of files) {
    if (!existsSync(file)) {
      console.log(`  ⚠️  Skipping ${file} (not found)`);
      continue;
    }

    const content = await readFile(file, 'utf-8');
    const pkg = JSON.parse(content) as PackageJson;
    const oldVersion = pkg.version;
    pkg.version = version;
    
    if (dryRun) {
      console.log(`  📄 ${file}: ${oldVersion} -> ${version} (dry-run)`);
    } else {
      await writeFile(file, JSON.stringify(pkg, null, 2) + '\n');
      console.log(`  ✅ ${file}: ${oldVersion} -> ${version}`);
    }
  }
}

async function checkGitStatus(): Promise<{ clean: boolean; branch: string }> {
  try {
    const status = await $`git status --porcelain`.quiet().text();
    const branch = await $`git branch --show-current`.quiet().text();
    return {
      clean: status.trim() === '',
      branch: branch.trim(),
    };
  } catch {
    return { clean: false, branch: 'unknown' };
  }
}

async function checkChangelog(version: string): Promise<boolean> {
  if (!existsSync('CHANGELOG.md')) {
    return false;
  }
  
  const changelog = await readFile('CHANGELOG.md', 'utf-8');
  return changelog.includes(`## [${version}]`);
}

async function runPreReleaseChecks(version: string, options: ReleaseOptions): Promise<boolean> {
  console.log('\n🔍 Running pre-release checks...\n');
  
  const checks: boolean[] = [];
  
  // Check 1: Git status
  const gitStatus = await checkGitStatus();
  if (!gitStatus.clean && !options.force) {
    console.error('  ❌ Git working directory is not clean');
    console.error('     Commit or stash changes before releasing');
    checks.push(false);
  } else if (!gitStatus.clean) {
    console.log('  ⚠️  Git working directory is not clean (forced)');
    checks.push(true);
  } else {
    console.log('  ✅ Git working directory is clean');
    checks.push(true);
  }
  
  // Check 2: Branch
  if (gitStatus.branch !== 'main' && gitStatus.branch !== 'master' && !options.force) {
    console.error(`  ❌ Not on main/master branch (current: ${gitStatus.branch})`);
    checks.push(false);
  } else if (gitStatus.branch !== 'main' && gitStatus.branch !== 'master') {
    console.log(`  ⚠️  Not on main/master branch (current: ${gitStatus.branch}, forced)`);
    checks.push(true);
  } else {
    console.log(`  ✅ On ${gitStatus.branch} branch`);
    checks.push(true);
  }
  
  // Check 3: CHANGELOG
  const hasChangelog = await checkChangelog(version);
  if (!hasChangelog && !options.force) {
    console.error(`  ❌ CHANGELOG.md does not contain entry for v${version}`);
    console.error('     Add changelog entry before releasing');
    checks.push(false);
  } else if (!hasChangelog) {
    console.log(`  ⚠️  No CHANGELOG entry for v${version} (forced)`);
    checks.push(true);
  } else {
    console.log(`  ✅ CHANGELOG.md contains v${version}`);
    checks.push(true);
  }
  
  // Check 4: TypeScript
  console.log('  ⏳ Running typecheck...');
  try {
    await $`bun run check`.quiet();
    console.log('  ✅ TypeScript check passed');
    checks.push(true);
  } catch {
    console.error('  ❌ TypeScript check failed');
    checks.push(options.force ? true : false);
  }
  
  // Check 5: Build
  console.log('  ⏳ Running build...');
  try {
    await $`bun run build`.quiet();
    console.log('  ✅ Build passed');
    checks.push(true);
  } catch {
    console.error('  ❌ Build failed');
    checks.push(options.force ? true : false);
  }
  
  return checks.every(Boolean);
}

async function generateChangelogTemplate(version: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  
  // Get commits since last tag
  let commits = '';
  try {
    const lastTag = await $`git describe --tags --abbrev=0 HEAD~1 2>/dev/null || echo ""`.quiet().text();
    if (lastTag.trim()) {
      commits = await $`git log ${lastTag.trim()}..HEAD --pretty=format:"- %s" --no-merges`.quiet().text();
    } else {
      commits = await $`git log --pretty=format:"- %s" --no-merges -20`.quiet().text();
    }
  } catch {
    commits = '- Initial release';
  }
  
  return `
## [v${version}] - ${today}

### Overview
<!-- Provide a brief summary of this release -->

### Added
<!-- List new features -->

### Changed
<!-- List changes to existing functionality -->

### Deprecated
<!-- List soon-to-be removed features -->

### Removed
<!-- List removed features -->

### Fixed
<!-- List bug fixes -->

### Security
<!-- List security improvements -->

### Migration Guide
<!-- Provide detailed migration instructions if needed -->

### Commits in this release
${commits || '- See commit history'}

[Unreleased]: https://github.com/openRin/Rin/compare/v${version}...HEAD
[v${version}]: https://github.com/openRin/Rin/compare/v${await $`git describe --tags --abbrev=0 HEAD~1 2>/dev/null || echo "HEAD"`.quiet().text()}...v${version}
`;
}

async function updateChangelog(version: string, dryRun: boolean): Promise<void> {
  const changelogPath = 'CHANGELOG.md';
  
  if (!existsSync(changelogPath)) {
    console.log(`  ⚠️  CHANGELOG.md not found, skipping`);
    return;
  }
  
  const changelog = await readFile(changelogPath, 'utf-8');
  
  // Check if version already exists
  if (changelog.includes(`## [v${version}]`)) {
    console.log(`  ✅ CHANGELOG.md already contains v${version}`);
    return;
  }
  
  const template = await generateChangelogTemplate(version);
  
  // Insert after ## [Unreleased]
  const unreleasedSection = changelog.indexOf('## [Unreleased]');
  if (unreleasedSection === -1) {
    console.log(`  ⚠️  Could not find [Unreleased] section in CHANGELOG.md`);
    return;
  }
  
  // Find the end of Unreleased section (next ## or end of file)
  const nextSection = changelog.indexOf('## [', unreleasedSection + 1);
  const insertPosition = nextSection !== -1 ? nextSection : changelog.length;
  
  const newChangelog = changelog.slice(0, insertPosition) + template + '\n' + changelog.slice(insertPosition);
  
  if (dryRun) {
    console.log(`  📄 Would update CHANGELOG.md with v${version} entry (dry-run)`);
  } else {
    await writeFile(changelogPath, newChangelog);
    console.log(`  ✅ Updated CHANGELOG.md with v${version} entry`);
    console.log(`  📝 Please review and edit the CHANGELOG.md before committing`);
  }
}

async function createGitTag(version: string, options: ReleaseOptions): Promise<void> {
  if (options.skipGit) {
    console.log(`  ⏭️  Skipping git tag creation (--skip-git)`);
    return;
  }
  
  if (options.dryRun) {
    console.log(`  📦 Would create git tag: v${version}`);
    return;
  }
  
  // Create commit
  await $`git add -A`.quiet();
  await $`git commit -m "chore(release): v${version}"`.quiet();
  
  // Create tag
  await $`git tag -a v${version} -m "Release v${version}"`.quiet();
  
  console.log(`  ✅ Created git tag: v${version}`);
  console.log(`  📋 Next steps:`);
  console.log(`     git push origin ${await $`git branch --show-current`.quiet().text()}`);
  console.log(`     git push origin v${version}`);
}

async function main(): Promise<void> {
  const { version: versionArg, options } = parseArgs();
  
  console.log('🚀 Rin Release Script\n');
  
  if (options.dryRun) {
    console.log('🏃 DRY RUN MODE - No changes will be made\n');
  }
  
  // Get current version
  const currentVersion = await getCurrentVersion();
  console.log(`Current version: v${currentVersion}`);
  
  // Calculate new version
  const newVersion = getNewVersion(currentVersion, versionArg);
  console.log(`New version:     v${newVersion}\n`);
  
  // Run checks
  const checksPassed = await runPreReleaseChecks(newVersion, options);
  
  if (!checksPassed) {
    console.error('\n❌ Pre-release checks failed');
    console.error('   Use --force to override (not recommended)');
    process.exit(1);
  }
  
  console.log('\n✅ All checks passed\n');
  
  if (options.dryRun) {
    console.log('🏃 Dry run complete. No changes made.');
    process.exit(0);
  }
  
  // Update version in package.json files
  console.log('📝 Updating version in package files...');
  await updatePackageJson(newVersion, options.dryRun);
  
  // Update CHANGELOG.md
  console.log('\n📝 Updating CHANGELOG.md...');
  await updateChangelog(newVersion, options.dryRun);
  
  // Create git tag
  console.log('\n🏷️  Creating git tag...');
  await createGitTag(newVersion, options);
  
  console.log(`\n🎉 Release v${newVersion} prepared successfully!`);
  
  if (!options.skipGit) {
    console.log('\n📋 Next steps:');
    console.log('   1. Review the changes (especially CHANGELOG.md)');
    console.log('   2. Edit CHANGELOG.md to add detailed release notes');
    console.log('   3. Amend the commit if you modified CHANGELOG.md:');
    console.log('      git add CHANGELOG.md');
    console.log('      git commit --amend --no-edit');
    console.log('   4. Push the commit and tag:');
    console.log(`      git push origin ${await $`git branch --show-current`.quiet().text()}`);
    console.log(`      git push origin v${newVersion}`);
    console.log('   5. GitHub Release will be created automatically');
    console.log('   6. The deploy workflow will run automatically');
  }
}

main().catch((error) => {
  console.error('\n❌ Release failed:', error.message);
  process.exit(1);
});
