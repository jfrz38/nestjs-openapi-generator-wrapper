import { execFileSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { DefaultConfig } from './config/default-config';
import { OptionalOptions, RequiredOptions } from './types/types';

export function generate(mandatoryOptions: RequiredOptions, optionalOptions?: OptionalOptions) {
    const { specPath, outputDir } = mandatoryOptions;
    const {
        templateDir,
        additionalProperties,
        globalProperty,
        generatorIgnoreFile,
        isCleanOutputEnabled
    }: Required<OptionalOptions> = new DefaultConfig(optionalOptions);


    evaluateConfigs(outputDir, isCleanOutputEnabled);

    const cmdArguments = [
        '@openapitools/openapi-generator-cli',
        'generate',
        '-i', specPath,
        '-g', 'typescript-nestjs',
        '-o', outputDir,
        '-t', templateDir,
        `--additional-properties=${additionalProperties}`,
        `--global-property=${globalProperty}`,
        `--ignore-file-override=${generatorIgnoreFile}`
    ];

    execFileSync('npx', cmdArguments, { stdio: 'inherit', shell: true });
}

function evaluateConfigs(outputDir: string, isCleanOutputEnabled: boolean) {
    if (!existsSync(outputDir)) return;

    if (!isCleanOutputEnabled) {
        console.warn(`Output directory '${outputDir}' already exists. To overwrite, enable '--clean-output' option.`);
        return;
    }

    rmSync(outputDir, { recursive: true, force: true });

}
