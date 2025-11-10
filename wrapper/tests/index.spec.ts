import { jest } from '@jest/globals';
import { generate } from '../src/index';
import { existsSync } from 'fs';

jest.mock('child_process', () => ({
    execSync: jest.fn()
}));

jest.mock('../src/config/default-config', () => {
    const config: OptionalOptions = {
        templateDir: 'mock-templates',
        additionalProperties: 'mock-additional',
        globalProperty: 'mock-global',
        generatorIgnoreFile: 'mock-ignore-file',
        isCleanOutputEnabled: true
    }
    return {
        DefaultConfig: jest.fn().mockImplementation(() => (config))
    };
});

jest.mock('fs', () => ({
    existsSync: jest.fn()
}));

import { execSync } from 'child_process';
import { DefaultConfig } from '../src/config/default-config';
import { OptionalOptions, RequiredOptions } from '../src/types/types';

describe('generate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('when all options enabled should call DefaultConfig with correct options', () => {
        const requiredOptions: RequiredOptions = {
            specPath: 'spec.yaml',
            outputDir: 'dist/output',
        };
        const optionalOptions: OptionalOptions = {
            templateDir: 'tpl',
            additionalProperties: 'ap',
            globalProperty: 'gp',
            generatorIgnoreFile: 'ignore-file',
            isCleanOutputEnabled: false
        };

        generate(requiredOptions, optionalOptions);

        expect(DefaultConfig).toHaveBeenCalledWith({
            templateDir: 'tpl',
            additionalProperties: 'ap',
            globalProperty: 'gp',
            generatorIgnoreFile: 'ignore-file',
            isCleanOutputEnabled: false
        });
    });

    it('when all flags used should call execSync with expected command', () => {
        const requiredOptions: RequiredOptions = {
            specPath: 'spec.yaml',
            outputDir: 'dist/output'
        };

        generate(requiredOptions);

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

        const requiredOptions: RequiredOptions = {
            specPath: 'spec.yaml',
            outputDir: 'dist/output'
        };

        generate(requiredOptions);

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
