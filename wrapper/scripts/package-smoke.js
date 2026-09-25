const { execFileSync, spawnSync } = require('child_process');
const { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');

const packageRoot = join(__dirname, '..');
const packageJson = require(join(packageRoot, 'package.json'));
const generatorConfig = require(join(packageRoot, 'openapitools.json'));
const shouldGenerate = process.argv.includes('--generate');
const temporaryRoot = mkdtempSync(join(tmpdir(), 'nestjs-openapi-wrapper-package-'));
const packDirectory = join(temporaryRoot, 'pack');
const consumerDirectory = join(temporaryRoot, 'consumer');

function runNpm(args, options = {}) {
    const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
        cwd: options.cwd,
        encoding: 'utf8',
        shell: process.platform === 'win32',
        stdio: options.capture ? 'pipe' : 'inherit'
    });

    if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || `npm exited with status ${result.status}`);
    }

    return result.stdout;
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function runGenerationSmoke(installedPackageRoot) {
    const specPath = join(consumerDirectory, 'openapi.yaml');
    const outputDirectory = join(consumerDirectory, 'generated');
    const ignoreFile = join(consumerDirectory, '.openapi-generator-ignore');
    writeFileSync(specPath, [
        'openapi: 3.0.3',
        'info:',
        '  title: Compatibility smoke',
        '  version: 1.0.0',
        'paths:',
        '  /health:',
        '    get:',
        '      operationId: getHealth',
        '      tags: [Health]',
        '      responses:',
        "        '204':",
        '          description: Healthy',
        ''
    ].join('\n'));
    writeFileSync(ignoreFile, '');

    execFileSync(process.execPath, [
        join(installedPackageRoot, 'dist', 'bin', 'generate.js'),
        '--input', specPath,
        '--output', outputDirectory,
        '--ignore-file-override', ignoreFile,
        '--global-property', 'apis,models,supportingFiles'
    ], {
        cwd: consumerDirectory,
        env: { ...process.env, PWD: consumerDirectory, INIT_CWD: consumerDirectory },
        stdio: 'inherit'
    });

    assert(existsSync(join(outputDirectory, 'api', 'health.api.ts')), 'Compatibility smoke did not generate the expected API file.');
    const generatedVersion = readFileSync(join(outputDirectory, '.openapi-generator', 'VERSION'), 'utf8').trim();
    assert(
        generatedVersion === generatorConfig['generator-cli'].version,
        `Compatibility smoke used OpenAPI Generator '${generatedVersion}' instead of '${generatorConfig['generator-cli'].version}'.`
    );
    assert(!existsSync(join(consumerDirectory, 'openapitools.json')), 'Compatibility smoke created a consumer openapitools.json.');
}

try {
    mkdirSync(packDirectory);
    mkdirSync(consumerDirectory);
    runNpm(['run', 'build'], { cwd: packageRoot });
    execFileSync(process.execPath, [join(__dirname, 'stage-package-docs.js')]);

    const packResult = JSON.parse(runNpm([
        'pack',
        '--json',
        '--silent',
        '--ignore-scripts',
        '--pack-destination',
        packDirectory
    ], { cwd: packageRoot, capture: true }));
    const archive = packResult[0];
    const packedFiles = archive.files.map(({ path }) => path.replaceAll('\\', '/'));

    console.log('Packed files:');
    for (const packedFile of packedFiles) console.log(`- ${packedFile}`);

    const requiredFiles = [
        'package.json',
        'README.md',
        'LICENSE',
        'openapitools.json',
        'dist/index.js',
        'dist/index.d.ts',
        'dist/bin/generate.js',
        'dist/config/.openapi-generator-ignore',
        'dist/templates/api.service.mustache',
        'dist/templates/model.mustache',
        'dist/templates/modelGeneric.mustache',
        'dist/templates/modelGenericEnums.mustache'
    ];
    for (const requiredFile of requiredFiles) {
        assert(packedFiles.includes(requiredFile), `Packed package is missing '${requiredFile}'.`);
    }

    const unexpectedFile = packedFiles.find((file) =>
        !['package.json', 'README.md', 'LICENSE', 'openapitools.json'].includes(file) && !file.startsWith('dist/')
    );
    assert(!unexpectedFile, `Packed package contains unexpected file '${unexpectedFile}'.`);
    assert(
        !packedFiles.some((file) => /(^|\/)(src|tests|fixtures|scripts)(\/|$)/.test(file)),
        'Packed package contains source files, tests, fixtures, or package scripts.'
    );

    const archivePath = join(packDirectory, archive.filename);
    assert(existsSync(archivePath), `Package archive '${archivePath}' was not created.`);
    writeFileSync(join(consumerDirectory, 'package.json'), JSON.stringify({
        private: true,
        scripts: {
            'smoke:cli': 'nestjs-openapi-wrapper --help'
        }
    }));
    runNpm([
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--package-lock=false',
        archivePath
    ], { cwd: consumerDirectory });

    const installedPackageRoot = join(consumerDirectory, 'node_modules', ...packageJson.name.split('/'));
    const installedManifest = JSON.parse(readFileSync(join(installedPackageRoot, 'package.json'), 'utf8'));
    assert(
        installedManifest.bin?.['nestjs-openapi-wrapper'] === './dist/bin/generate.js',
        'Installed package has an invalid CLI entrypoint.'
    );
    execFileSync(process.execPath, [
        '-e',
        `if (typeof require(${JSON.stringify(packageJson.name)}).generate !== 'function') process.exit(1)`
    ], { cwd: consumerDirectory, stdio: 'pipe' });
    assert(
        existsSync(join(installedPackageRoot, 'dist', 'config', '.openapi-generator-ignore')),
        'Installed package is missing the runtime ignore file.'
    );
    assert(
        existsSync(join(installedPackageRoot, 'dist', 'templates', 'api.service.mustache')),
        'Installed package is missing runtime templates.'
    );
    const installedGeneratorConfig = JSON.parse(readFileSync(join(installedPackageRoot, 'openapitools.json'), 'utf8'));
    assert(
        installedGeneratorConfig['generator-cli']?.version === generatorConfig['generator-cli']?.version,
        `Installed package is missing the pinned OpenAPI Generator version '${generatorConfig['generator-cli']?.version}'.`
    );

    runNpm(['run', 'smoke:cli', '--silent'], { cwd: consumerDirectory });
    if (shouldGenerate) runGenerationSmoke(installedPackageRoot);
    console.log('Package smoke test passed.');
} finally {
    execFileSync(process.execPath, [join(__dirname, 'stage-package-docs.js'), '--clean']);
    rmSync(temporaryRoot, { recursive: true, force: true });
}
