export type OptionalOptions = {
    templateDir?: string;
    additionalProperties?: string;
    globalProperty?: string;
    generatorIgnoreFile?: string;
    isCleanOutputEnabled?: boolean;
}

export type RequiredOptions = {
    specPath: string,
    outputDir: string,
}
