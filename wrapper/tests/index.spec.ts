import { jest } from '@jest/globals';
import { generate } from '../src/index';

jest.mock('child_process', () => ({
    execSync: jest.fn()
}));

jest.mock('../src/config/default-config', () => {
    return {
        DefaultConfig: jest.fn().mockImplementation(() => ({
            templates: 'mock-templates',
            additionalProps: 'mock-additional',
            globalProp: 'mock-global',
            ignoreFile: 'mock-ignore-file'
        }))
    };
});

import { execSync } from 'child_process';
import { DefaultConfig } from '../src/config/default-config';

describe('generate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should call DefaultConfig with correct options', () => {
        const options = {
            specPath: 'spec.yaml',
            outputDir: 'dist/output',
            templateDir: 'tpl',
            additionalProperties: 'ap',
            globalProperty: 'gp',
            generatorIgnoreFile: 'ignore-file'
        };

        generate(options);

        expect(DefaultConfig).toHaveBeenCalledWith({
            templateDir: 'tpl',
            additionalProperties: 'ap',
            globalProperty: 'gp',
            generatorIgnoreFile: 'ignore-file'
        });
    });

    it('should call execSync with correct command', () => {
        const options = {
            specPath: 'spec.yaml',
            outputDir: 'dist/output'
        };

        generate(options);

        expect(execSync).toHaveBeenCalledTimes(1);
        const cmd = (execSync as jest.Mock).mock.calls[0][0];

        expect(cmd).toContain('rm -r dist/output && npx @openapitools/openapi-generator-cli generate');
        expect(cmd).toContain('-i spec.yaml');
        expect(cmd).toContain('-o dist/output');
        expect(cmd).toContain('-t mock-templates');
        expect(cmd).toContain('--additional-properties=mock-additional');
        expect(cmd).toContain('--global-property=mock-global');
        expect(cmd).toContain('--ignore-file-override=mock-ignore-file');
    });
});
