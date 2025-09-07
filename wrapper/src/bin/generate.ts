#!/usr/bin/env node

import { program } from 'commander';
import { generate } from '../index';

program
  .option('-i, --input <spec>', 'Path to OpenAPI spec')
  .option('-o, --output <dir>', 'Output directory')
  .option('-t, --templates <dir>', 'Template directory')
  .option('-c, --config <file>', 'Config file')
  .option('--additional-properties <properties>', 'Additional properties')
  .option('--global-property=<property>', 'Global property')
  .option('--ignore-file-override=<ruta>', 'OpenApi ignore file path')

program.parse(process.argv);

const options = program.opts();

if (!options.input || !options.output) {
  console.error('Input spec (-i) and output dir (-o) are required');
  process.exit(1);
}

generate({
  specPath: options.input,
  outputDir: options.output,
  templateDir: options.templates,
  additionalProperties: options.additionalProperties,
  globalProperty: options.globalProperty
});
