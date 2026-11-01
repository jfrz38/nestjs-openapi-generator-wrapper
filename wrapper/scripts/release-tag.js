const { execFileSync, spawnSync } = require('child_process');
const { appendFileSync, readFileSync } = require('fs');
const { resolve } = require('path');

function expectedTag(packageManifestPath) {
    const manifest = JSON.parse(readFileSync(packageManifestPath, 'utf8'));
    if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
        throw new Error(`Package manifest '${packageManifestPath}' does not contain a version.`);
    }
    return { tag: `v${manifest.version}`, version: manifest.version };
}

function resolveTagCommit(tag, cwd) {
    const result = spawnSync('git', ['rev-parse', '--verify', `refs/tags/${tag}^{commit}`], {
        cwd,
        encoding: 'utf8'
    });
    if (result.status !== 0) return undefined;
    return result.stdout.trim();
}

function verifyReleaseTag({ packageManifestPath, requestedTag, expectedCommit, requireTag = false, cwd = process.cwd() }) {
    const release = expectedTag(packageManifestPath);
    if (requestedTag && requestedTag !== release.tag) {
        throw new Error(`Requested release tag '${requestedTag}' does not match package version tag '${release.tag}'.`);
    }

    const tag = requestedTag || release.tag;
    const tagCommit = resolveTagCommit(tag, cwd);
    if (!tagCommit && requireTag) throw new Error(`Release tag '${tag}' does not exist.`);
    if (tagCommit && expectedCommit) {
        const resolvedExpectedCommit = execFileSync('git', ['rev-parse', `${expectedCommit}^{commit}`], {
            cwd,
            encoding: 'utf8'
        }).trim();
        if (tagCommit !== resolvedExpectedCommit) {
            throw new Error(`Release tag '${tag}' points to '${tagCommit}', not release commit '${resolvedExpectedCommit}'.`);
        }
    }

    return { ...release, tag, tagCommit, tagExists: Boolean(tagCommit) };
}

function parseArguments(args) {
    const values = {};
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === '--require-tag') {
            values.requireTag = true;
            continue;
        }
        if (!argument.startsWith('--') || index + 1 >= args.length) {
            throw new Error(`Invalid argument '${argument}'.`);
        }
        values[argument.slice(2)] = args[index + 1];
        index += 1;
    }
    return values;
}

function writeOutput(name, value) {
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
    console.log(`${name}=${value}`);
}

if (require.main === module) {
    try {
        const args = parseArguments(process.argv.slice(2));
        const result = verifyReleaseTag({
            packageManifestPath: resolve(args.package || 'package.json'),
            requestedTag: args.tag,
            expectedCommit: args.commit,
            requireTag: Boolean(args.requireTag),
            cwd: resolve(args.repository || process.cwd())
        });
        writeOutput('version', result.version);
        writeOutput('tag', result.tag);
        writeOutput('tag_exists', String(result.tagExists));
        if (result.tagCommit) writeOutput('tag_commit', result.tagCommit);
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
}

module.exports = { expectedTag, resolveTagCommit, verifyReleaseTag };
