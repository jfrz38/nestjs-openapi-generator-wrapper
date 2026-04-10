import { existsSync, rmSync } from 'fs';
import { generate } from '../src/index';

jest.mock('child_process', () => ({
    execFileSync: jest.fn()
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
    existsSync: jest.fn(),
    rmSync: jest.fn()
}));

import { execFileSync } from 'child_process';
import { DefaultConfig } from '../src/config/default-config';
import { OptionalOptions, RequiredOptions } from '../src/types/types';

describe('generate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('when all flags used should call DefaultConfig, rmSync and execFileSync with expected command', () => {
        const requiredOptions: RequiredOptions = {
            specPath: 'spec.yaml',
            outputDir: 'dist/output'
        };

        const optionalOptions: OptionalOptions = {
            templateDir: 'tpl',
            additionalProperties: 'ap',
            globalProperty: 'gp',
            generatorIgnoreFile: 'ignore-file',
            isCleanOutputEnabled: true
        };
        (existsSync as jest.Mock).mockReturnValue(true);

        generate(requiredOptions, optionalOptions);

        expect(existsSync).toHaveBeenNthCalledWith(1, 'dist/output');
        expect(rmSync).toHaveBeenCalledWith('dist/output', { recursive: true, force: true });
        expect(execFileSync).toHaveBeenCalledWith(
            expect.stringMatching(/^npx(\.cmd)?$/),
            expect.any(Array),
            expect.objectContaining({ stdio: 'inherit' })
        );
        expect(DefaultConfig).toHaveBeenCalledWith({
            templateDir: 'tpl',
            additionalProperties: 'ap',
            globalProperty: 'gp',
            generatorIgnoreFile: 'ignore-file',
            isCleanOutputEnabled: true
        });

        const [file, args] = (execFileSync as jest.Mock).mock.calls[0];

        expect(file).toMatch(/^npx(\.cmd)?$/);
        expect(args).toContain('@openapitools/openapi-generator-cli');
        expect(args).toContain('generate');
        expect(args).toContain('spec.yaml');
        expect(args).toContain('dist/output');
        expect(args).toContain('mock-templates');
        expect(args).toContain('--additional-properties=mock-additional');
        expect(args).toContain('--global-property=mock-global');
        expect(args).toContain('--ignore-file-override=mock-ignore-file');
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
        expect(rmSync).not.toHaveBeenCalled();
        expect(execFileSync).toHaveBeenCalledTimes(1);

        const args = (execFileSync as jest.Mock).mock.calls[0][1];
        expect(args).toContain('spec.yaml');
        expect(args).toContain('dist/output');
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
        expect(rmSync).not.toHaveBeenCalled();
        expect(execFileSync).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenNthCalledWith(1, expect.stringContaining(`Output directory 'dist/output' already exists`));

        const args = (execFileSync as jest.Mock).mock.calls[0][1];
        expect(args).toContain('spec.yaml');
        expect(args).toContain('dist/output');

        consoleSpy.mockRestore();
    });
});
