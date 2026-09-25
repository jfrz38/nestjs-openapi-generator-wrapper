import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
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

    it('generates enum query params using the enum-aware TypeScript type', () => {
        const outputDir = generateFixtureOutput('query-enum.openapi.yml');
        const generatedApi = readFileSync(join(outputDir, 'api', 'reports.api.ts'), 'utf8');

        expect(generatedApi).toContain(`import type { Request, Response } from 'express';`);
        expect(generatedApi).toContain(`protected abstract listReports(visibility: 'private' | 'shared' | undefined, request: Request, response: Response): void | Promise<void>;`);
        expect(generatedApi).toContain(`private doListReports(@Query("visibility") visibility: 'private' | 'shared' | undefined, @Req() request: Request, @Res({ passthrough: true }) response: Response): void | Promise<void> {`);
        expect(generatedApi).not.toContain(`VisibilityEnum`);
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
