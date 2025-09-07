import { DefaultConfig } from '../../src/config/default-config';

describe('DefaultConfig', () => {

    it('should use default values when no options are provided', () => {
        const cfg = new DefaultConfig({});

        expect(cfg.templates).toBe(cfg['DEFAULT_TEMPLATES']);
        expect(cfg.additionalProps).toBe(cfg['DEFAULT_ADDITIONAL_PROPERTIES']);
        expect(cfg.globalProp).toBe(cfg['DEFAULT_GLOBAL_PROPERTY']);
        expect(cfg.ignoreFile).toBe(cfg['DEFAULT_GENERATOR_IGNORE_FILE']);
    });

    it('should override templatesDir', () => {
        const cfg = new DefaultConfig({ templateDir: './my-templates' });
        expect(cfg.templates).toBe('./my-templates');
        expect(cfg.additionalProps).toBe(cfg['DEFAULT_ADDITIONAL_PROPERTIES']);
    });

    it('should override additionalProperties', () => {
        const cfg = new DefaultConfig({ additionalProperties: 'customProps' });
        expect(cfg.additionalProps).toBe('customProps');
    });

    it('should override globalProperty', () => {
        const cfg = new DefaultConfig({ globalProperty: 'customGlobal' });
        expect(cfg.globalProp).toBe('customGlobal');
    });

    it('should override generatorIgnoreFile', () => {
        const cfg = new DefaultConfig({ generatorIgnoreFile: './.custom-ignore' });
        expect(cfg.ignoreFile).toBe('./.custom-ignore');
    });

    it('should override multiple values at once', () => {
        const cfg = new DefaultConfig({
            templateDir: './tpl',
            additionalProperties: 'ap',
            globalProperty: 'gp',
            generatorIgnoreFile: './ignore'
        });

        expect(cfg.templates).toBe('./tpl');
        expect(cfg.additionalProps).toBe('ap');
        expect(cfg.globalProp).toBe('gp');
        expect(cfg.ignoreFile).toBe('./ignore');
    });

});
