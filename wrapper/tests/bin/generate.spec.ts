import { jest } from '@jest/globals';

jest.mock('../../src/index', () => ({
    generate: jest.fn(),
}));

const originalArgv = process.argv;
const ERROR_MESSAGE = 'Input spec (-i) and output dir (-o) are required';

describe('CLI', () => {
    beforeEach(() => {
        jest.resetModules();
        process.argv = [...originalArgv.slice(0, 2)];
    });

    afterAll(() => {
        process.argv = originalArgv;
    });

    it('calls generate with correct options', () => {
        const { generate } = require('../../src/index');

        const specPath = 'spec.yaml';
        const outputDir = 'dist/generated';
        const templateDir = 'my-templates';
        const additionalProperties = 'ap';
        const globalProperty = 'gp';
        const generatorIgnoreFile = 'gif';

        process.argv.push(
            '-i', specPath,
            '-o', outputDir,
            '-t', templateDir,
            '--additional-properties', additionalProperties,
            '--global-property', globalProperty,
            '--ignore-file-override', generatorIgnoreFile
        );

        require('../../src/bin/generate');

        expect(generate).toHaveBeenCalledWith({
            specPath,
            outputDir,
            templateDir,
            additionalProperties,
            globalProperty,
            generatorIgnoreFile
        });
    });

    it('exits if required options are missing', () => {
        const spyExit = jest.spyOn(process, 'exit').mockImplementation(() => {
            throw new Error('process.exit called');
        });
        const spyConsole = jest.spyOn(console, 'error').mockImplementation(() => { });

        expect(() => require('../../src/bin/generate')).toThrow('process.exit called');
        expect(spyConsole).toHaveBeenCalledWith(ERROR_MESSAGE);

        spyExit.mockRestore();
        spyConsole.mockRestore();
    });
});
