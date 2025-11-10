import { jest } from '@jest/globals';
import { generate } from '../src/index';
import { existsSync } from 'fs';

jest.mock('child_process', () => ({
    execSync: jest.fn()
}));

jest.mock('../src/config/default-config', () => {
    return {
        DefaultConfig: jest.fn().mockImplementation(() => ({
            templates: 'mock-templates',
            additionalProps: 'mock-additional',
            globalProp: 'mock-global',
            ignoreFile: 'mock-ignore-file',
            isCleanOutputEnabled: true
        }))
    };
});

jest.mock('fs', () => ({
    existsSync: jest.fn()
}));

import { execSync } from 'child_process';
import { DefaultConfig } from '../src/config/default-config';

describe('generate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('when all options enabled should call DefaultConfig with correct options', () => {
        const options = {
            specPath: 'spec.yaml',
            outputDir: 'dist/output',
            templateDir: 'tpl',
            additionalProperties: 'ap',
            globalProperty: 'gp',
            generatorIgnoreFile: 'ignore-file',
            cleanOutput: false
        };

        generate(options);

        expect(DefaultConfig).toHaveBeenCalledWith({
            templateDir: 'tpl',
            additionalProperties: 'ap',
            globalProperty: 'gp',
            generatorIgnoreFile: 'ignore-file',
            cleanOutput: false
        });
    });

    it('when all flags used should call execSync with expected command', () => {
        const options = {
            specPath: 'spec.yaml',
            outputDir: 'dist/output'
        };

        generate(options);

        expect(existsSync).not.toHaveBeenCalled();
        expect(execSync).toHaveBeenCalledTimes(2);
        expect(execSync).toHaveBeenCalledWith(
            expect.stringContaining('rm -r dist/output')
        );

        const cmd = (execSync as jest.Mock).mock.calls[1][0];

        expect(cmd).toContain('npx @openapitools/openapi-generator-cli generate');
        expect(cmd).toContain('-i spec.yaml');
        expect(cmd).toContain('-o dist/output');
        expect(cmd).toContain('-t mock-templates');
        expect(cmd).toContain('--additional-properties=mock-additional');
        expect(cmd).toContain('--global-property=mock-global');
        expect(cmd).toContain('--ignore-file-override=mock-ignore-file');
    });

    it('when cleanOutput is not enabled and output directory not exists should not call rm command before generation', () => {
        (DefaultConfig as jest.Mock).mockImplementationOnce(() => ({
            isCleanOutputEnabled: false
        }));
        (existsSync as jest.Mock).mockReturnValue(false);

        const options = {
            specPath: 'spec.yaml',
            outputDir: 'dist/output'
        };

        generate(options);

        expect(existsSync).toHaveBeenNthCalledWith(1, 'dist/output');
        expect(execSync).toHaveBeenCalledTimes(1);

        const cmd = (execSync as jest.Mock).mock.calls[0][0];

        expect(cmd).toContain('npx @openapitools/openapi-generator-cli generate');
        expect(cmd).toContain('-i spec.yaml');
        expect(cmd).toContain('-o dist/output');
    });

    it('when cleanOutput is not enabled and output directory exists should not call rm command before generation', () => {
        (DefaultConfig as jest.Mock).mockImplementationOnce(() => ({
            isCleanOutputEnabled: false
        }));
        (existsSync as jest.Mock).mockReturnValue(true);
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation((() => { }));

        const options = {
            specPath: 'spec.yaml',
            outputDir: 'dist/output'
        };

        generate(options);

        expect(existsSync).toHaveBeenNthCalledWith(1, 'dist/output');
        expect(execSync).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenNthCalledWith(1, expect.stringContaining(`Output directory 'dist/output' already exists`));

        const cmd = (execSync as jest.Mock).mock.calls[0][0];

        expect(cmd).toContain('npx @openapitools/openapi-generator-cli generate');
        expect(cmd).toContain('-i spec.yaml');
        expect(cmd).toContain('-o dist/output');

        consoleSpy.mockRestore();
    });
});
