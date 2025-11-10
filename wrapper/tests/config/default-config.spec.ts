import { DefaultConfig } from '../../src/config/default-config';

describe('DefaultConfig', () => {

    it('should use default values when no options are provided', () => {
        const cfg = new DefaultConfig({});

        expect(cfg.templates).toBe(cfg['DEFAULT_TEMPLATES']);
        expect(cfg.additionalProps).toBe(cfg['DEFAULT_ADDITIONAL_PROPERTIES']);
        expect(cfg.globalProp).toBe(cfg['DEFAULT_GLOBAL_PROPERTY']);
        expect(cfg.ignoreFile).toBe(cfg['DEFAULT_GENERATOR_IGNORE_FILE']);
        expect(cfg.isCleanOutputEnabled).toBe(cfg['DEFAULT_CLEAN_OUTPUT']);
    });

    it('should override templatesDir', () => {
        const value = './my-templates';

        const cfg = new DefaultConfig({ templateDir: value });

        expect(cfg.templates).toBe(value);
    });

    it('should override additionalProperties', () => {
        const value = 'customProps';

        const cfg = new DefaultConfig({ additionalProperties: value });

        expect(cfg.additionalProps).toBe(value);
    });

    it('should override globalProperty', () => {
        const value = 'customGlobal';

        const cfg = new DefaultConfig({ globalProperty: value });

        expect(cfg.globalProp).toBe(value);
    });

    it('should override generatorIgnoreFile', () => {
        const value = './.custom-ignore';

        const cfg = new DefaultConfig({ generatorIgnoreFile: value });

        expect(cfg.ignoreFile).toBe(value);
    });

    it('should override cleanOutput', () => {
        const value = true;

        const cfg = new DefaultConfig({ cleanOutput: value });
        expect(cfg.isCleanOutputEnabled).toBe(value);
    });

    it('should override multiple values at once', () => {
        const cfg = new DefaultConfig({
            templateDir: './tpl',
            additionalProperties: 'ap',
            globalProperty: 'gp',
            generatorIgnoreFile: './ignore',
            cleanOutput: true
        });

        expect(cfg.templates).toBe('./tpl');
        expect(cfg.additionalProps).toBe('ap');
        expect(cfg.globalProp).toBe('gp');
        expect(cfg.ignoreFile).toBe('./ignore');
        expect(cfg.isCleanOutputEnabled).toBe(true);
    });

});
