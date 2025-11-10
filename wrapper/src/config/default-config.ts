import path from "path";
import { OptionalOptions } from "../types/types";

export class DefaultConfig {

    private readonly DEFAULTS: Required<OptionalOptions> = {
        templateDir: path.resolve(__dirname, '..', 'templates'),
        additionalProperties: "modelFileSuffix=.dto,modelSuffix=Dto,serviceFileSuffix=.api,serviceSuffix=Api",
        globalProperty: "apis,models",
        generatorIgnoreFile: path.resolve(__dirname, '.openapi-generator-ignore'),
        isCleanOutputEnabled: false
    }

    readonly templateDir: string;
    readonly additionalProperties: string;
    readonly globalProperty: string;
    readonly generatorIgnoreFile: string;
    readonly isCleanOutputEnabled: boolean;

    constructor(options: OptionalOptions = {}) {
        const configOptions: Required<OptionalOptions> = {
            templateDir: options.templateDir ?? this.DEFAULTS.templateDir,
            additionalProperties: options.additionalProperties ?? this.DEFAULTS.additionalProperties,
            globalProperty: options.globalProperty ?? this.DEFAULTS.globalProperty,
            generatorIgnoreFile: options.generatorIgnoreFile ?? this.DEFAULTS.generatorIgnoreFile,
            isCleanOutputEnabled: options.isCleanOutputEnabled ?? this.DEFAULTS.isCleanOutputEnabled
        };

        this.templateDir = configOptions.templateDir;
        this.additionalProperties = configOptions.additionalProperties;
        this.globalProperty = configOptions.globalProperty;
        this.generatorIgnoreFile = configOptions.generatorIgnoreFile;
        this.isCleanOutputEnabled = configOptions.isCleanOutputEnabled;
    }
}
