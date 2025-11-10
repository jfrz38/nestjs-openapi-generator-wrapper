import path from "path";

export class DefaultConfig {
    private readonly DEFAULT_TEMPLATES = path.resolve(__dirname, '..', 'templates');
    private readonly DEFAULT_ADDITIONAL_PROPERTIES = "modelFileSuffix=.dto,modelSuffix=Dto,serviceFileSuffix=.api,serviceSuffix=Api";
    private readonly DEFAULT_GLOBAL_PROPERTY = "apis,models";
    private readonly DEFAULT_GENERATOR_IGNORE_FILE = path.resolve(__dirname, '.openapi-generator-ignore');
    private readonly DEFAULT_CLEAN_OUTPUT = false;

    readonly templates: string
    readonly additionalProps: string;
    readonly globalProp: string;
    readonly ignoreFile: string
    readonly isCleanOutputEnabled: boolean;

    constructor(options: {
        templateDir?: string,
        additionalProperties?: string,
        globalProperty?: string,
        generatorIgnoreFile?: string,
        cleanOutput?: boolean
    }) {
        const {
            templateDir = this.DEFAULT_TEMPLATES,
            additionalProperties = this.DEFAULT_ADDITIONAL_PROPERTIES,
            globalProperty = this.DEFAULT_GLOBAL_PROPERTY,
            generatorIgnoreFile = this.DEFAULT_GENERATOR_IGNORE_FILE,
            cleanOutput = this.DEFAULT_CLEAN_OUTPUT
        } = options;

        this.templates = templateDir;
        this.additionalProps = additionalProperties;
        this.globalProp = globalProperty;
        this.ignoreFile = generatorIgnoreFile;
        this.isCleanOutputEnabled = cleanOutput;
    }
}
