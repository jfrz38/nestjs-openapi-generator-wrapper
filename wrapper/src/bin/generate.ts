#!/usr/bin/env node

import { Command } from 'commander';
import { generate } from '../index';

const ERROR_MESSAGE = 'Input spec (-i) and output dir (-o) are required'
const program = new Command();

program
  .option('-i, --input <spec>', 'Path to OpenAPI spec')
  .option('-o, --output <dir>', 'Output directory')
  .option('-t, --templates <dir>', 'Template directory')
  .option('--additional-properties <properties>', 'Additional properties')
  .option('--global-property <property>', 'Global property')
  .option('--ignore-file-override <path>', 'OpenApi ignore file path')
  .option('--clean-output', 'Remove the output directory if it exists');

program.parse(process.argv);

const options = program.opts();

if (!options.input || !options.output) {
  console.error(ERROR_MESSAGE);
  process.exit(1);
}

generate({
  specPath: options.input,
  outputDir: options.output,
  templateDir: options.templates,
  additionalProperties: options.additionalProperties,
  globalProperty: options.globalProperty,
  generatorIgnoreFile: options.ignoreFileOverride,
  cleanOutput: options.cleanOutput
});
