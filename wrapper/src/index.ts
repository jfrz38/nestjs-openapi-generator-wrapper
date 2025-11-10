import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { DefaultConfig } from './config/default-config';
import { OptionalOptions, RequiredOptions } from './types/types';

export function generate(mandatoryOptions: RequiredOptions, optionalOptions?: OptionalOptions) {
    const { specPath, outputDir } = mandatoryOptions;
    const {
        templateDir: templates,
        additionalProperties: additionalProps,
        globalProperty: globalProp,
        generatorIgnoreFile: ignoreFile,
        isCleanOutputEnabled
    } = new DefaultConfig(optionalOptions);


    evaluateConfigs(outputDir, isCleanOutputEnabled);

    const cmdArguments = [
        `npx @openapitools/openapi-generator-cli generate`,
        `-i ${specPath}`,
        `-g typescript-nestjs`,
        `-o ${outputDir}`,
        `-t ${templates}`,
        `--additional-properties=${additionalProps}`,
        `--global-property=${globalProp}`,
        `--ignore-file-override=${ignoreFile}`
    ];

    execSync(cmdArguments.join(' '), { stdio: 'inherit' });
}
function evaluateConfigs(outputDir: string, isCleanOutputEnabled: boolean) {
    if (!isCleanOutputEnabled) {
        if (existsSync(outputDir)) {
            console.warn(`Output directory '${outputDir}' already exists. To overwrite, enable '--clean-output' option.`);
        }
        return;
    }
    execSync(`rm -r ${outputDir}`);
}

