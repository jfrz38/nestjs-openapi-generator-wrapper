import { DefaultConfig } from '../../src/config/default-config';
import { OptionalOptions } from '../../src/types/types';

describe('DefaultConfig', () => {

    it('should use default values when no options are provided', () => {
        const config = new DefaultConfig();

        expect(config.templateDir).toBe(config['DEFAULTS'].templateDir);
        expect(config.additionalProperties).toBe(config['DEFAULTS'].additionalProperties);
        expect(config.globalProperty).toBe(config['DEFAULTS'].globalProperty);
        expect(config.generatorIgnoreFile).toBe(config['DEFAULTS'].generatorIgnoreFile);
        expect(config.isCleanOutputEnabled).toBe(config['DEFAULTS'].isCleanOutputEnabled);
    });

    it('should override templatesDir', () => {
        const value = './my-templates';

        const config = new DefaultConfig({ templateDir: value });

        expect(config.templateDir).toBe(value);
    });

    it('should override additionalProperties', () => {
        const value = 'customProps';

        const config = new DefaultConfig({ additionalProperties: value });

        expect(config.additionalProperties).toBe(value);
    });

    it('should override globalProperty', () => {
        const value = 'customGlobal';

        const config = new DefaultConfig({ globalProperty: value });

        expect(config.globalProperty).toBe(value);
    });

    it('should override generatorIgnoreFile', () => {
        const value = './.custom-ignore';

        const config = new DefaultConfig({ generatorIgnoreFile: value });

        expect(config.generatorIgnoreFile).toBe(value);
    });

    it('should override cleanOutput', () => {
        const value = true;

        const config = new DefaultConfig({ isCleanOutputEnabled: value });

        expect(config.isCleanOutputEnabled).toBe(value);
    });

    it('should override when all values are used', () => {
        const options: Required<OptionalOptions> = {
            templateDir: './tpl',
            additionalProperties: 'ap',
            globalProperty: 'gp',
            generatorIgnoreFile: './ignore',
            isCleanOutputEnabled: true,
        }
        const config = new DefaultConfig(options);

        expect(config.templateDir).toBe('./tpl');
        expect(config.additionalProperties).toBe('ap');
        expect(config.globalProperty).toBe('gp');
        expect(config.generatorIgnoreFile).toBe('./ignore');
        expect(config.isCleanOutputEnabled).toBe(true);
    });

});
