import 'reflect-metadata';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { validate } from 'class-validator';
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

    function compileGeneratedOutput(outputDir: string, asEsm = false) {
        const compiledDir = join(outputDir, 'compiled');
        const tsconfigPath = join(outputDir, 'tsconfig.json');
        symlinkSync(resolve(__dirname, '../../node_modules'), join(outputDir, 'node_modules'), 'junction');
        if (asEsm) writeFileSync(join(outputDir, 'package.json'), JSON.stringify({ type: 'module' }));
        writeFileSync(tsconfigPath, JSON.stringify({
            compilerOptions: {
                target: 'ES2022',
                module: asEsm ? 'ESNext' : 'Node16',
                moduleResolution: asEsm ? 'Bundler' : 'Node16',
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

    it('compiles controllers strictly and preserves their runtime HTTP contract', () => {
        const outputDir = generateFixtureOutput('controller-contract.openapi.yml');
        const generatedApi = readFileSync(join(outputDir, 'api', 'widgets.api.ts'), 'utf8');

        expect(generatedApi).toContain('new Nest.ParseIntPipe({ optional: false })');
        expect(generatedApi).toContain('new Nest.ParseFloatPipe({ optional: true })');
        expect(generatedApi).toContain('new Nest.ParseBoolPipe({ optional: false })');
        expect(generatedApi).toContain("xRetryCount as unknown as string, { type: 'custom' }) ?? undefined");
        expect(generatedApi).toContain('@Nest.HttpCode(202)');
        expect(generatedApi).toContain('@Nest.HttpCode(204)');
        expect(generatedApi).toContain('return Nest.Head(path);');
        expect(generatedApi).toContain('return Nest.Options(path);');
        expect(generatedApi).not.toContain('let mode =');
        expect(generatedApi).not.toContain('*/ unexpectedly');

        const compiledDir = compileGeneratedOutput(outputDir, true);
        execFileSync(process.execPath, [
            resolve(__dirname, 'helpers/controller-contract-runner.mjs'),
            join(compiledDir, 'api', 'widgets.api.js')
        ], { stdio: 'inherit' });
    }, 30_000);

    it('compiles DTOs strictly and enforces OpenAPI validation constraints', async () => {
        const outputDir = generateFixtureOutput('dto-validation.openapi.yml');
        const generatedModel = readFileSync(join(outputDir, 'model', 'validationSample.dto.ts'), 'utf8');
        const generatedDictionary = readFileSync(join(outputDir, 'model', 'dictionaryContainer.dto.ts'), 'utf8');

        expect(generatedModel).toContain('@Validator.IsInt()');
        expect(generatedModel).toContain('@Validator.IsNumber()');
        expect(generatedModel).toContain(`@Validator.IsIn(['draft', 'published'])`);
        expect(generatedModel).toContain('@Validator.IsArray() @Validator.ArrayUnique() @Validator.IsString({ each: true })');
        expect(generatedModel).toContain(`@Validator.IsIn(['automatic', 'manual'], { each: true })`);
        expect(generatedModel).toContain('@Validator.IsInt({ each: true })');
        expect(generatedModel).toContain('@Validator.ValidateNested()');
        expect(generatedModel).toContain('@Validator.ValidateNested({ each: true })');
        expect(generatedModel).toContain(`readonly labels!: Array<string>;`);
        expect(generatedModel).toContain(`readonly count!: number;`);
        expect(generatedModel).toContain(`@Validator.Matches(/^[A-Z]+\\/[0-9]+$/)`);
        expect(generatedDictionary.match(/values!?: \{ \[key: string\]: number; \};/gu)).toHaveLength(2);

        const compiledDir = compileGeneratedOutput(outputDir);
        const {
            ValidationSampleDto
        } = require(join(compiledDir, 'model', 'validationSample.dto.js')) as {
            ValidationSampleDto: new () => Record<string, unknown>;
        };
        const { ChildDto } = require(join(compiledDir, 'model', 'child.dto.js')) as {
            ChildDto: new () => Record<string, unknown>;
        };
        const { DerivedRecordDto } = require(join(compiledDir, 'model', 'derivedRecord.dto.js')) as {
            DerivedRecordDto: new () => Record<string, unknown>;
        };

        const child = (overrides: Record<string, unknown> = {}) => Object.assign(
            new ChildDto(),
            { name: 'valid child', age: 4 },
            overrides
        );
        const sample = (overrides: Record<string, unknown> = {}) => Object.assign(
            new ValidationSampleDto(),
            {
                count: 2,
                ratio: 1.5,
                status: 'draft',
                externalStatus: 'published',
                labels: ['one', 'two'],
                modes: ['automatic'],
                scores: [1, 2],
                child: child(),
                children: [child()],
                patternValue: 'ABC/123',
                nullableRequired: null
            },
            overrides
        );

        expect(await validate(sample())).toHaveLength(0);
        expect(await validate(sample({ count: 1.5 }))).toEqual(expect.arrayContaining([
            expect.objectContaining({ property: 'count' })
        ]));
        expect(await validate(sample({ status: 'archived' }))).toEqual(expect.arrayContaining([
            expect.objectContaining({ property: 'status' })
        ]));
        expect(await validate(sample({ externalStatus: 'archived' }))).toEqual(expect.arrayContaining([
            expect.objectContaining({ property: 'externalStatus' })
        ]));
        expect(await validate(sample({ labels: ['duplicate', 'duplicate'] }))).toEqual(expect.arrayContaining([
            expect.objectContaining({ property: 'labels' })
        ]));
        expect(await validate(sample({ modes: ['unsupported'] }))).toEqual(expect.arrayContaining([
            expect.objectContaining({ property: 'modes' })
        ]));
        expect(await validate(sample({ scores: [1, 1.5] }))).toEqual(expect.arrayContaining([
            expect.objectContaining({ property: 'scores' })
        ]));
        expect(await validate(sample({ child: child({ age: 1.5 }) }))).toEqual(expect.arrayContaining([
            expect.objectContaining({ property: 'child' })
        ]));
        expect(await validate(sample({ children: [child({ name: 42 })] }))).toEqual(expect.arrayContaining([
            expect.objectContaining({ property: 'children' })
        ]));
        expect(await validate(sample({ patternValue: 'invalid' }))).toEqual(expect.arrayContaining([
            expect.objectContaining({ property: 'patternValue' })
        ]));
        expect(await validate(sample({ optionalName: null }))).toEqual(expect.arrayContaining([
            expect.objectContaining({ property: 'optionalName' })
        ]));
        expect(await validate(sample({ optionalNullable: null }))).toHaveLength(0);

        const missingRequired = sample();
        Reflect.deleteProperty(missingRequired, 'count');
        expect(await validate(missingRequired)).toEqual(expect.arrayContaining([
            expect.objectContaining({ property: 'count' })
        ]));

        const derived = Object.assign(new DerivedRecordDto(), { id: 'record-1', revision: 1 });
        expect(await validate(derived)).toHaveLength(0);
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
        expect(generatedModel).toContain(`@Validator.IsArray()`);
        expect(generatedModel).toContain(`@Validator.ArrayMinSize(1) @Validator.ArrayMaxSize(5)`);
        expect(generatedModel).toContain(`readonly labels!: Array<string>;`);
    });

    it('generates UUID properties using the current UUID typing strategy', () => {
        const outputDir = generateFixtureOutput('uuid-model.openapi.yml');
        const generatedModel = readFileSync(join(outputDir, 'model', 'createSession.dto.ts'), 'utf8');

        expect(generatedModel).toContain(`import type { UUID as UuidForSessionId } from 'node:crypto';`);
        expect(generatedModel).toContain(`import type { UUID as UuidForCorrelationId } from 'node:crypto';`);
        expect(generatedModel).toContain(`import type { UUID as UuidForOptionalSessionId } from 'node:crypto';`);
        expect(generatedModel).toContain(`import type { UUID as UuidForRelatedIdsItem } from 'node:crypto';`);
        expect(generatedModel).not.toContain(`import('node:crypto').UUID`);
        expect(generatedModel).toContain(`@Validator.IsUUID()`);
        expect(generatedModel).toContain(`@Validator.IsUUID(undefined, { each: true })`);
        expect(generatedModel).toContain(`readonly sessionId!: UuidForSessionId;`);
        expect(generatedModel).toContain(`readonly optionalSessionId?: UuidForOptionalSessionId;`);
        expect(generatedModel).toContain(`readonly relatedIds!: Array<UuidForRelatedIdsItem>;`);

        compileGeneratedOutput(outputDir, true);
    });

    it('generates OpenAPI 3.1 specs with local file references from absolute paths', () => {
        const outputDir = generateFixtureOutput('referenced-model.openapi.yml');
        const generatedModel = readFileSync(join(outputDir, 'model', 'referencedPayload.dto.ts'), 'utf8');

        expect(generatedModel).toContain(`readonly id!: string;`);
    });

    it('generates inline model enums without wrapping them in a namespace', () => {
        const outputDir = generateFixtureOutput('inline-enum-model.openapi.yml');
        const generatedModel = readFileSync(join(outputDir, 'model', 'userPreferences.dto.ts'), 'utf8');

        expect(generatedModel).toContain(`readonly visibility!: UserPreferencesDtoVisibilityEnum;`);
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
