import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const { verifyReleaseTag } = require('../../scripts/release-tag') as {
    verifyReleaseTag(options: {
        packageManifestPath: string;
        requestedTag?: string;
        expectedCommit?: string;
        requireTag?: boolean;
        cwd: string;
    }): { tag: string; tagExists: boolean; tagCommit?: string };
};

describe('release tag verification', () => {
    let repository: string;
    let packageManifestPath: string;
    let firstCommit: string;

    beforeEach(() => {
        repository = mkdtempSync(join(tmpdir(), 'nestjs-openapi-wrapper-release-tag-'));
        packageManifestPath = join(repository, 'package.json');
        writeFileSync(packageManifestPath, JSON.stringify({ version: '1.2.3' }));
        execFileSync('git', ['init'], { cwd: repository });
        execFileSync('git', ['config', 'user.name', 'Release Test'], { cwd: repository });
        execFileSync('git', ['config', 'user.email', 'release-test@example.com'], { cwd: repository });
        execFileSync('git', ['add', 'package.json'], { cwd: repository });
        execFileSync('git', ['commit', '-m', 'initial'], { cwd: repository });
        firstCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim();
    });

    afterEach(() => rmSync(repository, { recursive: true, force: true }));

    it('accepts an existing tag that targets the release commit', () => {
        execFileSync('git', ['tag', 'v1.2.3'], { cwd: repository });

        expect(verifyReleaseTag({ packageManifestPath, expectedCommit: firstCommit, cwd: repository }))
            .toEqual(expect.objectContaining({ tag: 'v1.2.3', tagExists: true, tagCommit: firstCommit }));
    });

    it('rejects an existing tag that targets another commit', () => {
        execFileSync('git', ['tag', 'v1.2.3'], { cwd: repository });
        writeFileSync(join(repository, 'change.txt'), 'later');
        execFileSync('git', ['add', 'change.txt'], { cwd: repository });
        execFileSync('git', ['commit', '-m', 'later'], { cwd: repository });
        const laterCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim();

        expect(() => verifyReleaseTag({ packageManifestPath, expectedCommit: laterCommit, cwd: repository }))
            .toThrow("not release commit");
    });

    it('allows a missing tag while creating a release but rejects it for publication', () => {
        expect(verifyReleaseTag({ packageManifestPath, expectedCommit: firstCommit, cwd: repository }).tagExists)
            .toBe(false);
        expect(() => verifyReleaseTag({ packageManifestPath, requireTag: true, cwd: repository }))
            .toThrow("does not exist");
    });

    it('does not accept a branch with the expected tag name', () => {
        execFileSync('git', ['branch', 'v1.2.3'], { cwd: repository });

        expect(() => verifyReleaseTag({ packageManifestPath, requireTag: true, cwd: repository }))
            .toThrow("does not exist");
    });

    it('rejects a requested tag that does not match the package version', () => {
        expect(() => verifyReleaseTag({
            packageManifestPath,
            requestedTag: 'v2.0.0',
            cwd: repository
        })).toThrow("does not match package version tag 'v1.2.3'");
    });
});
