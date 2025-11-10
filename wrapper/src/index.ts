import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { DefaultConfig } from './config/default-config';

export function generate({ specPath, outputDir, templateDir, additionalProperties, globalProperty, generatorIgnoreFile, cleanOutput }: {
    specPath: string;
    outputDir: string;
    templateDir?: string;
    additionalProperties?: string
    globalProperty?: string,
    generatorIgnoreFile?: string,
    cleanOutput?: boolean
}) {
    const {
        templates,
        additionalProps,
        globalProp,
        ignoreFile,
        isCleanOutputEnabled
    } = new DefaultConfig({
        templateDir,
        additionalProperties,
        globalProperty,
        generatorIgnoreFile,
        cleanOutput
    })

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

