import 'reflect-metadata';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import * as Nest from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { generate } from '../../src/index';

const describeIntegration = process.env.RUN_OPENAPI_INTEGRATION === 'true' ? describe : describe.skip;
const keepGeneratedOutput = process.env.KEEP_OPENAPI_INTEGRATION_OUTPUT === 'true';
const generatorConfig = JSON.parse(readFileSync(resolve(__dirname, '../../openapitools.json'), 'utf8'));
const pinnedGeneratorVersion = generatorConfig['generator-cli'].version as string;

describeIntegration('template integration', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'nestjs-openapi-wrapper-'));
    });

    afterEach(() => {
        if (keepGeneratedOutput) {
            // Keep generated files available for local inspection when debugging integration output.
            console.log(`Integration output preserved at: ${tempDir}`);
            return;
        }

        rmSync(tempDir, { recursive: true, force: true });
    });

    function generateFixtureOutput(specName: string) {
        const outputDir = join(tempDir, 'generated');

        generate({
            specPath: resolve(__dirname, `fixtures/${specName}`),
            outputDir
        });

        return outputDir;
    }

    function generateFromCaller(callerDir: string) {
        const outputDir = join(callerDir, 'generated');
        const emptyIgnoreFile = join(callerDir, '.openapi-generator-ignore');
        const originalCwd = process.cwd();
        const originalPwd = process.env.PWD;
        const originalInitCwd = process.env.INIT_CWD;
        writeFileSync(emptyIgnoreFile, '');

        try {
            process.chdir(callerDir);
            process.env.PWD = callerDir;
            process.env.INIT_CWD = callerDir;
            generate({
                specPath: resolve(__dirname, 'fixtures/query-enum.openapi.yml'),
                outputDir
            }, {
                generatorIgnoreFile: emptyIgnoreFile,
                globalProperty: 'apis,models,supportingFiles'
            });
        } finally {
            process.chdir(originalCwd);
            restoreEnvironmentVariable('PWD', originalPwd);
            restoreEnvironmentVariable('INIT_CWD', originalInitCwd);
        }

        return readFileSync(join(outputDir, '.openapi-generator', 'VERSION'), 'utf8').trim();
    }

    function restoreEnvironmentVariable(name: 'PWD' | 'INIT_CWD', value: string | undefined) {
        if (value === undefined) {
            delete process.env[name];
            return;
        }

        process.env[name] = value;
    }

    function compileGeneratedOutput(outputDir: string) {
        const compiledDir = join(outputDir, 'compiled');
        const tsconfigPath = join(outputDir, 'tsconfig.json');
        symlinkSync(resolve(__dirname, '../../node_modules'), join(outputDir, 'node_modules'), 'junction');
        writeFileSync(tsconfigPath, JSON.stringify({
            compilerOptions: {
                target: 'ES2022',
                module: 'Node16',
                moduleResolution: 'Node16',
                outDir: compiledDir,
                rootDir: '.',
                strict: true,
                noUnusedLocals: true,
                experimentalDecorators: true,
                emitDecoratorMetadata: true,
                esModuleInterop: true,
                skipLibCheck: true
            },
            include: ['api/**/*.ts', 'model/**/*.ts']
        }, null, 2));

        execFileSync(process.execPath, [require.resolve('typescript/bin/tsc6'), '--project', tsconfigPath], {
            cwd: outputDir,
            stdio: 'inherit'
        });
        return compiledDir;
    }

    it('generates enum query params using the enum-aware TypeScript type', () => {
        const outputDir = generateFixtureOutput('query-enum.openapi.yml');
        const generatedApi = readFileSync(join(outputDir, 'api', 'reports.api.ts'), 'utf8');

        expect(generatedApi).toContain(`import * as Nest from '@nestjs/common';`);
        expect(generatedApi).toContain(`import type { Request, Response } from 'express';`);
        expect(generatedApi).toContain(`protected abstract listReports(visibility: 'private' | 'shared' | undefined, request: Request, response: Response): void | Promise<void>;`);
        expect(generatedApi).toContain(`@Nest.Query("visibility"`);
        expect(generatedApi).toContain(`visibility: 'private' | 'shared' | undefined`);
        expect(generatedApi).not.toContain(`VisibilityEnum`);
    });

    it('compiles controllers strictly and preserves their runtime HTTP contract', async () => {
        const outputDir = generateFixtureOutput('controller-contract.openapi.yml');
        const generatedApi = readFileSync(join(outputDir, 'api', 'widgets.api.ts'), 'utf8');

        expect(generatedApi).toContain('new Nest.ParseIntPipe({ optional: false })');
        expect(generatedApi).toContain('new Nest.ParseFloatPipe({ optional: true })');
        expect(generatedApi).toContain('new Nest.ParseBoolPipe({ optional: false })');
        expect(generatedApi).toContain('@Nest.HttpCode(202)');
        expect(generatedApi).toContain('@Nest.HttpCode(204)');
        expect(generatedApi).toContain('return Nest.Head(path);');
        expect(generatedApi).toContain('return Nest.Options(path);');
        expect(generatedApi).not.toContain('let mode =');
        expect(generatedApi).not.toContain('*/ unexpectedly');

        const compiledDir = compileGeneratedOutput(outputDir);
        const { WidgetsApi } = require(join(compiledDir, 'api', 'widgets.api.js')) as { WidgetsApi: new () => object };
        let receivedParameters: unknown[] = [];
        let headCalled = false;
        let optionsCalled = false;

        class WidgetsController extends WidgetsApi {
            deleteJob() {}

            getWidget(...parameters: unknown[]) {
                receivedParameters = parameters;
                return { accepted: true };
            }

            headHealth() {
                headCalled = true;
            }

            optionsHealth() {
                optionsCalled = true;
            }
        }
        Nest.Controller()(WidgetsController);

        class TestModule {}
        Nest.Module({ controllers: [WidgetsController] })(TestModule);
        const app = await NestFactory.create(TestModule, { logger: false });

        try {
            await app.listen(0, '127.0.0.1');
            const baseUrl = await app.getUrl();
            const accepted = await fetch(`${baseUrl}/widgets/42?enabled=true&mode=strict&ratio=1.5`, {
                headers: { 'X-Retry-Count': '3' }
            });

            expect(accepted.status).toBe(202);
            expect(await accepted.json()).toEqual({ accepted: true });
            expect(receivedParameters.slice(0, 5)).toEqual([42, true, 'strict', 1.5, 3]);

            expect((await fetch(`${baseUrl}/widgets/42?mode=strict`)).status).toBe(400);
            expect((await fetch(`${baseUrl}/widgets/42?enabled=not-a-boolean&mode=strict`)).status).toBe(400);
            expect((await fetch(`${baseUrl}/jobs/job-1`, { method: 'DELETE' })).status).toBe(204);
            expect((await fetch(`${baseUrl}/health`, { method: 'HEAD' })).status).toBe(204);
            expect((await fetch(`${baseUrl}/health`, { method: 'OPTIONS' })).status).toBe(204);
            expect(headCalled).toBe(true);
            expect(optionsCalled).toBe(true);
        } finally {
            await app.close();
        }
    }, 30_000);

    it.each([
        ['cookie-parameter.openapi.yml', 'cookie parameters require application-specific cookie middleware'],
        ['form-body.openapi.yml', "'application/x-www-form-urlencoded' request bodies require application-specific middleware"],
        ['multipart-body.openapi.yml', "'multipart/form-data' request bodies require application-specific middleware"],
        ['trace-method.openapi.yml', 'TRACE operations are not supported']
    ])('rejects unsupported controller contract in %s', (specName, expectedMessage) => {
        expect(() => generateFixtureOutput(specName)).toThrow(expectedMessage);
    });

    it('generates array validation decorators for list properties', () => {
        const outputDir = generateFixtureOutput('list-model.openapi.yml');
        const generatedModel = readFileSync(join(outputDir, 'model', 'labelCollection.dto.ts'), 'utf8');

        expect(generatedModel).toContain(`ArrayMinSize`);
        expect(generatedModel).toContain(`ArrayMaxSize`);
        expect(generatedModel).toContain(`@IsArray() @ArrayMinSize(1) @ArrayMaxSize(5)`);
        expect(generatedModel).toContain(`readonly labels: Array<string>;`);
    });

    it('generates UUID properties using the current UUID typing strategy', () => {
        const outputDir = generateFixtureOutput('uuid-model.openapi.yml');
        const generatedModel = readFileSync(join(outputDir, 'model', 'createSession.dto.ts'), 'utf8');

        expect(generatedModel).toContain(`import type { UUID } from 'node:crypto';`);
        expect(generatedModel).toContain(`@IsUUID()`);
        expect(generatedModel).toContain(`readonly sessionId: UUID;`);
    });

    it('generates inline model enums without wrapping them in a namespace', () => {
        const outputDir = generateFixtureOutput('inline-enum-model.openapi.yml');
        const generatedModel = readFileSync(join(outputDir, 'model', 'userPreferences.dto.ts'), 'utf8');

        expect(generatedModel).toContain(`readonly visibility: UserPreferencesDtoVisibilityEnum;`);
        expect(generatedModel).toContain(`export const UserPreferencesDtoVisibilityEnum = {`);
        expect(generatedModel).toContain(`export type UserPreferencesDtoVisibilityEnum = typeof UserPreferencesDtoVisibilityEnum[keyof typeof UserPreferencesDtoVisibilityEnum];`);
        expect(generatedModel).not.toContain(`export namespace`);
        expect(generatedModel).not.toContain(`UserPreferencesDto.Visibility`);
        expect(generatedModel).not.toContain(`UserPreferencesDtoVisibilityEnum.Visibility`);
    });

    it('imports alias-only models using import type', () => {
        const outputDir = generateFixtureOutput('alias-import-model.openapi.yml');
        const generatedModel = readFileSync(join(outputDir, 'model', 'createBookingRequest.dto.ts'), 'utf8');
        const generatedAliasModel = readFileSync(join(outputDir, 'model', 'createBookingRequestOptions.dto.ts'), 'utf8');

        expect(generatedModel).toContain(`import type { CreateBookingRequestOptionsDto } from './createBookingRequestOptions.dto';`);
        expect(generatedModel).not.toContain(`import { CreateBookingRequestOptionsDto } from './createBookingRequestOptions.dto';`);
        expect(generatedAliasModel).toContain(`import type { BookingOptionsDto } from './bookingOptions.dto';`);
        expect(generatedAliasModel).not.toContain(`import { BookingOptionsDto } from './bookingOptions.dto';`);
    });

    it('replaces existing output after a successful clean generation', () => {
        const outputDir = join(tempDir, 'generated');
        const obsoleteFile = join(outputDir, 'obsolete.ts');
        mkdirSync(outputDir);
        writeFileSync(obsoleteFile, 'obsolete output');

        generate({
            specPath: resolve(__dirname, 'fixtures/query-enum.openapi.yml'),
            outputDir
        }, {
            isCleanOutputEnabled: true
        });

        expect(existsSync(obsoleteFile)).toBe(false);
        expect(existsSync(join(outputDir, 'api', 'reports.api.ts'))).toBe(true);
    });

    it('uses the pinned generator without creating caller configuration', () => {
        const callerDir = join(tempDir, 'caller-without-config');
        mkdirSync(callerDir);

        expect(generateFromCaller(callerDir)).toBe(pinnedGeneratorVersion);
        expect(existsSync(join(callerDir, 'openapitools.json'))).toBe(false);
    });

    it('ignores a conflicting caller generator configuration', () => {
        const callerDir = join(tempDir, 'caller-with-conflicting-config');
        const callerConfigPath = join(callerDir, 'openapitools.json');
        const callerConfig = `${JSON.stringify({
            'generator-cli': { version: '7.13.0' }
        }, null, 2)}\n`;
        mkdirSync(callerDir);
        writeFileSync(callerConfigPath, callerConfig);

        expect(generateFromCaller(callerDir)).toBe(pinnedGeneratorVersion);
        expect(readFileSync(callerConfigPath, 'utf8')).toBe(callerConfig);
    });
});
