import { execSync } from 'child_process';
import { DefaultConfig } from './config/default-config';

export function generate({ specPath, outputDir, templateDir, additionalProperties, globalProperty, generatorIgnoreFile }: {
    specPath: string;
    outputDir: string;
    templateDir?: string;
    additionalProperties?: string
    globalProperty?: string,
    generatorIgnoreFile?: string
}) {
    const {
        templates,
        additionalProps,
        globalProp,
        ignoreFile
    } = new DefaultConfig({ templateDir, additionalProperties, globalProperty, generatorIgnoreFile })

    const cmdArguments = [
        `rm -r ${outputDir} && npx @openapitools/openapi-generator-cli generate`,
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

