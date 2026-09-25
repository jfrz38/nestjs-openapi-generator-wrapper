import { execFileSync } from 'child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync
} from 'fs';
import { homedir, tmpdir } from 'os';
import { dirname, join, parse, resolve } from 'path';
import { generate } from '../src/index';
import { OptionalOptions, RequiredOptions } from '../src/types/types';

jest.mock('child_process', () => ({
    execFileSync: jest.fn()
}));

const mockedExecFileSync = execFileSync as jest.Mock;

describe('generate', () => {
    let tempDir: string;
    let specPath: string;
    let outputDir: string;

    beforeEach(() => {
        jest.clearAllMocks();
        tempDir = mkdtempSync(join(tmpdir(), 'nestjs-openapi-wrapper-unit-'));
        specPath = join(tempDir, 'spec.yaml');
        outputDir = join(tempDir, 'generated');
        writeFileSync(specPath, 'openapi: 3.0.0');

        mockedExecFileSync.mockImplementation((_runtime: string, args: string[]) => {
            const generatedOutput = args[args.indexOf('-o') + 1];
            mkdirSync(generatedOutput, { recursive: true });
            writeFileSync(join(generatedOutput, 'generated.ts'), 'new output');
        });
    });

    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
        jest.restoreAllMocks();
    });

    it('resolves all paths and executes OpenAPI Generator with the current Node.js runtime', () => {
        const templateDir = join(tempDir, 'templates');
        const generatorIgnoreFile = join(tempDir, '.openapi-generator-ignore');
        mkdirSync(templateDir);
        writeFileSync(generatorIgnoreFile, '');

        const requiredOptions: RequiredOptions = {
            specPath,
            outputDir
        };
        const optionalOptions: OptionalOptions = {
            templateDir,
            additionalProperties: 'ap',
            globalProperty: 'gp',
            generatorIgnoreFile
        };

        generate(requiredOptions, optionalOptions);

        expect(mockedExecFileSync).toHaveBeenCalledTimes(1);
        const [runtime, args, spawnOptions] = mockedExecFileSync.mock.calls[0] as [string, string[], object];
        expect(runtime).toBe(process.execPath);
        expect(args[0]).toMatch(/[\\/]@openapitools[\\/]openapi-generator-cli[\\/]main\.js$/);
        expect(args.slice(1, 4)).toEqual([
            '--openapitools',
            resolve(__dirname, '..', 'openapitools.json'),
            'generate'
        ]);
        expect(args).toEqual(expect.arrayContaining([
            '-i', resolve(specPath),
            '-o', resolve(outputDir),
            '-t', resolve(templateDir),
            '--additional-properties=ap',
            '--global-property=gp',
            `--ignore-file-override=${resolve(generatorIgnoreFile)}`
        ]));
        expect(spawnOptions).toEqual(expect.objectContaining({ stdio: 'inherit' }));
    });

    it('warns with the resolved path and preserves obsolete files without clean output', () => {
        mkdirSync(outputDir);
        const obsoleteFile = join(outputDir, 'obsolete.ts');
        writeFileSync(obsoleteFile, 'old output');
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        generate({ specPath, outputDir });

        expect(readFileSync(obsoleteFile, 'utf8')).toBe('old output');
        expect(readFileSync(join(outputDir, 'generated.ts'), 'utf8')).toBe('new output');
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(resolve(outputDir)));
    });

    it('replaces an existing output only after successful clean generation', () => {
        mkdirSync(outputDir);
        const obsoleteFile = join(outputDir, 'obsolete.ts');
        writeFileSync(obsoleteFile, 'old output');

        generate({ specPath, outputDir }, { isCleanOutputEnabled: true });

        expect(existsSync(obsoleteFile)).toBe(false);
        expect(readFileSync(join(outputDir, 'generated.ts'), 'utf8')).toBe('new output');
        const generatedOutput = mockedExecFileSync.mock.calls[0][1][mockedExecFileSync.mock.calls[0][1].indexOf('-o') + 1];
        expect(generatedOutput).not.toBe(resolve(outputDir));
        expect(dirname(generatedOutput)).toBe(dirname(resolve(outputDir)));
    });

    it('keeps the existing output untouched when generation fails', () => {
        mkdirSync(outputDir);
        const existingFile = join(outputDir, 'existing.ts');
        writeFileSync(existingFile, 'valid output');
        mockedExecFileSync.mockImplementationOnce(() => {
            throw new Error('generator failed');
        });

        expect(() => generate({ specPath, outputDir }, { isCleanOutputEnabled: true })).toThrow('generator failed');

        expect(readFileSync(existingFile, 'utf8')).toBe('valid output');
        expect(existsSync(join(outputDir, 'generated.ts'))).toBe(false);
    });

    it('restores the existing output when promotion of staged output fails', () => {
        mkdirSync(outputDir);
        const existingFile = join(outputDir, 'existing.ts');
        writeFileSync(existingFile, 'valid output');
        const fsModule = require('fs') as typeof import('fs');
        const realRenameSync = fsModule.renameSync;
        let renameCount = 0;
        const renameSpy = jest.spyOn(fsModule, 'renameSync').mockImplementation((oldPath, newPath) => {
            renameCount += 1;
            if (renameCount === 2) throw new Error('promotion failed');
            realRenameSync(oldPath, newPath);
        });

        expect(() => generate({ specPath, outputDir }, { isCleanOutputEnabled: true })).toThrow('promotion failed');
        renameSpy.mockRestore();

        expect(readFileSync(existingFile, 'utf8')).toBe('valid output');
        expect(existsSync(join(outputDir, 'generated.ts'))).toBe(false);
    });

    it('warns without failing when an obsolete backup cannot be removed', () => {
        mkdirSync(outputDir);
        writeFileSync(join(outputDir, 'existing.ts'), 'valid output');
        const fsModule = require('fs') as typeof import('fs');
        const rmSpy = jest.spyOn(fsModule, 'rmSync').mockImplementationOnce(() => {
            throw new Error('backup cleanup failed');
        });
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        expect(() => generate({ specPath, outputDir }, { isCleanOutputEnabled: true })).not.toThrow();
        rmSpy.mockRestore();

        expect(readFileSync(join(outputDir, 'generated.ts'), 'utf8')).toBe('new output');
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Could not remove temporary directory'));
    });

    it('does not invoke the generator or touch existing output when preflight validation fails', () => {
        mkdirSync(outputDir);
        const existingFile = join(outputDir, 'existing.ts');
        writeFileSync(existingFile, 'valid output');
        const missingSpec = join(tempDir, 'missing.yaml');

        expect(() => generate(
            { specPath: missingSpec, outputDir },
            { isCleanOutputEnabled: true }
        )).toThrow(`OpenAPI input '${resolve(missingSpec)}'`);

        expect(mockedExecFileSync).not.toHaveBeenCalled();
        expect(readFileSync(existingFile, 'utf8')).toBe('valid output');
    });

    it.each([
        ['an empty path', '', 'Output directory must not be empty'],
        ['the current working directory', '.', 'current working directory'],
        ['a normalized current working directory', join('nested', '..'), 'current working directory'],
        ['the filesystem root', parse(process.cwd()).root, 'filesystem roots'],
        ['the user home', homedir(), 'user home directory']
    ])('rejects %s as a clean output', (_description, unsafeOutput, expectedMessage) => {
        expect(() => generate(
            { specPath, outputDir: unsafeOutput },
            { isCleanOutputEnabled: true }
        )).toThrow(expectedMessage);

        expect(mockedExecFileSync).not.toHaveBeenCalled();
    });

    it('rejects a clean output that contains the OpenAPI input', () => {
        const nestedSpec = join(outputDir, 'api', 'openapi.yaml');
        mkdirSync(dirname(nestedSpec), { recursive: true });
        writeFileSync(nestedSpec, 'openapi: 3.0.0');

        expect(() => generate(
            { specPath: nestedSpec, outputDir },
            { isCleanOutputEnabled: true }
        )).toThrow(`it contains the OpenAPI input '${resolve(nestedSpec)}'`);

        expect(mockedExecFileSync).not.toHaveBeenCalled();
        expect(readFileSync(nestedSpec, 'utf8')).toBe('openapi: 3.0.0');
    });

    it.each([
        ['template directory', { templateDir: join(tmpdir(), 'missing-wrapper-templates') }, 'Template directory'],
        ['generator ignore file', { generatorIgnoreFile: join(tmpdir(), 'missing-wrapper-ignore') }, 'Generator ignore file']
    ])('validates the %s before generation', (_description, options, expectedMessage) => {
        expect(() => generate(
            { specPath, outputDir },
            { ...options, isCleanOutputEnabled: true }
        )).toThrow(expectedMessage);

        expect(mockedExecFileSync).not.toHaveBeenCalled();
    });
});
