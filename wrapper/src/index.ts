import { execFileSync } from 'child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    realpathSync,
    renameSync,
    rmSync,
    statSync
} from 'fs';
import { homedir } from 'os';
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'path';
import { DefaultConfig } from './config/default-config';
import { OptionalOptions, RequiredOptions } from './types/types';

type ResolvedOptions = Required<OptionalOptions> & RequiredOptions & {
    generatorConfigPath: string;
    generatorPath: string;
};

export function generate(mandatoryOptions: RequiredOptions, optionalOptions?: OptionalOptions) {
    const options = resolveAndValidateOptions(mandatoryOptions, new DefaultConfig(optionalOptions));

    if (!options.isCleanOutputEnabled) {
        if (existsSync(options.outputDir)) {
            console.warn(`Output directory '${options.outputDir}' already exists. Existing files may be overwritten and obsolete files will remain. Enable '--clean-output' for a clean replacement.`);
        }

        runGenerator(options, options.outputDir);
        return;
    }

    generateAndReplace(options);
}

function resolveAndValidateOptions(
    mandatoryOptions: RequiredOptions,
    optionalOptions: Required<OptionalOptions>
): ResolvedOptions {
    if (!mandatoryOptions.outputDir?.trim()) {
        throw new Error('Output directory must not be empty.');
    }

    const outputDir = resolve(mandatoryOptions.outputDir);
    const specPath = resolveRequiredPath(mandatoryOptions.specPath, 'OpenAPI input', outputDir);
    const templateDir = resolveRequiredPath(optionalOptions.templateDir, 'Template directory', outputDir);
    const generatorIgnoreFile = resolveRequiredPath(optionalOptions.generatorIgnoreFile, 'Generator ignore file', outputDir);
    const generatorConfigPath = resolve(__dirname, '..', 'openapitools.json');
    const runtimePath = resolve(process.execPath);

    assertFile(specPath, 'OpenAPI input', outputDir);
    assertDirectory(templateDir, 'Template directory', outputDir);
    assertFile(generatorIgnoreFile, 'Generator ignore file', outputDir);
    assertFile(generatorConfigPath, 'OpenAPI Generator configuration', outputDir);
    assertFile(runtimePath, 'Node.js runtime', outputDir);

    let generatorPath: string;
    try {
        generatorPath = require.resolve('@openapitools/openapi-generator-cli/main.js');
    } catch {
        throw new Error(`Cannot generate into '${outputDir}': OpenAPI Generator entrypoint could not be resolved.`);
    }
    assertFile(generatorPath, 'OpenAPI Generator entrypoint', outputDir);

    if (optionalOptions.isCleanOutputEnabled) {
        assertSafeOutput(outputDir, specPath);
    }

    return {
        ...optionalOptions,
        specPath,
        outputDir,
        templateDir,
        generatorIgnoreFile,
        generatorConfigPath,
        generatorPath
    };
}

function resolveRequiredPath(value: string, label: string, outputDir: string): string {
    if (!value?.trim()) {
        throw new Error(`Cannot generate into '${outputDir}': ${label} path must not be empty.`);
    }

    return resolve(value);
}

function assertFile(filePath: string, label: string, outputDir: string) {
    try {
        if (statSync(filePath).isFile()) return;
    } catch {
        // Report a consistent preflight error below.
    }

    throw new Error(`Cannot generate into '${outputDir}': ${label} '${filePath}' must be an accessible file.`);
}

function assertDirectory(directoryPath: string, label: string, outputDir: string) {
    try {
        if (statSync(directoryPath).isDirectory()) return;
    } catch {
        // Report a consistent preflight error below.
    }

    throw new Error(`Cannot generate into '${outputDir}': ${label} '${directoryPath}' must be an accessible directory.`);
}

function assertSafeOutput(outputDir: string, specPath: string) {
    const canonicalOutput = canonicalizePath(outputDir);
    const canonicalRoot = canonicalizePath(parse(canonicalOutput).root);
    const canonicalCwd = canonicalizePath(process.cwd());
    const canonicalHome = canonicalizePath(homedir());
    const canonicalSpec = canonicalizePath(specPath);

    if (samePath(canonicalOutput, canonicalRoot)) {
        throw unsafeOutputError(outputDir, 'filesystem roots cannot be cleaned');
    }
    if (samePath(canonicalOutput, canonicalHome)) {
        throw unsafeOutputError(outputDir, 'the user home directory cannot be cleaned');
    }
    if (containsPath(canonicalOutput, canonicalCwd)) {
        throw unsafeOutputError(outputDir, 'the current working directory or one of its ancestors cannot be cleaned');
    }
    if (containsPath(canonicalOutput, canonicalSpec)) {
        throw unsafeOutputError(outputDir, `it contains the OpenAPI input '${specPath}'`);
    }
}

function canonicalizePath(targetPath: string): string {
    if (existsSync(targetPath)) return realpathSync(targetPath);

    const parent = dirname(targetPath);
    if (parent === targetPath) return targetPath;

    return join(canonicalizePath(parent), basename(targetPath));
}

function samePath(first: string, second: string): boolean {
    return comparablePath(first) === comparablePath(second);
}

function containsPath(parent: string, candidate: string): boolean {
    const pathFromParent = relative(comparablePath(parent), comparablePath(candidate));
    return pathFromParent === '' || (pathFromParent !== '..' && !pathFromParent.startsWith(`..${sep}`) && !isAbsolute(pathFromParent));
}

function comparablePath(targetPath: string): string {
    const normalizedPath = resolve(targetPath);
    return process.platform === 'win32' ? normalizedPath.toLowerCase() : normalizedPath;
}

function unsafeOutputError(outputDir: string, reason: string): Error {
    return new Error(`Unsafe output directory '${outputDir}': ${reason}.`);
}

function generateAndReplace(options: ResolvedOptions) {
    const outputParent = dirname(options.outputDir);
    const outputName = basename(options.outputDir);
    mkdirSync(outputParent, { recursive: true });

    const stagedOutput = mkdtempSync(join(outputParent, `.${outputName}-staged-`));
    try {
        runGenerator(options, stagedOutput);
        replaceOutput(options.outputDir, stagedOutput);
    } catch (error) {
        removeTemporaryDirectory(stagedOutput);
        throw error;
    }
}

function replaceOutput(outputDir: string, stagedOutput: string) {
    if (!existsSync(outputDir)) {
        renameSync(stagedOutput, outputDir);
        return;
    }

    const backupRoot = mkdtempSync(join(dirname(outputDir), `.${basename(outputDir)}-backup-`));
    const backupOutput = join(backupRoot, basename(outputDir));
    renameSync(outputDir, backupOutput);

    try {
        renameSync(stagedOutput, outputDir);
    } catch (replacementError) {
        try {
            renameSync(backupOutput, outputDir);
        } catch (rollbackError) {
            throw new Error(
                `Failed to replace '${outputDir}' and restore it. The previous output remains at '${backupOutput}'. Replacement error: ${String(replacementError)}. Rollback error: ${String(rollbackError)}.`
            );
        }

        removeTemporaryDirectory(backupRoot);
        throw replacementError;
    }

    removeTemporaryDirectory(backupRoot);
}

function removeTemporaryDirectory(directoryPath: string) {
    if (!existsSync(directoryPath)) return;

    try {
        rmSync(directoryPath, { recursive: true, force: true });
    } catch {
        console.warn(`Could not remove temporary directory '${directoryPath}'.`);
    }
}

function runGenerator(options: ResolvedOptions, outputDir: string) {
    const cmdArguments = [
        options.generatorPath,
        '--openapitools', options.generatorConfigPath,
        'generate',
        '-i', options.specPath,
        '-g', 'typescript-nestjs',
        '-o', outputDir,
        '-t', options.templateDir,
        `--additional-properties=${options.additionalProperties}`,
        `--global-property=${options.globalProperty}`,
        `--ignore-file-override=${options.generatorIgnoreFile}`
    ];

    execFileSync(process.execPath, cmdArguments, { stdio: 'inherit' });
}
