const { copyFileSync, rmSync } = require('fs');
const { join } = require('path');

const packageRoot = join(__dirname, '..');
const repositoryRoot = join(packageRoot, '..');
const documents = ['README.md', 'LICENSE'];

for (const document of documents) {
    const destination = join(packageRoot, document);
    if (process.argv.includes('--clean')) {
        rmSync(destination, { force: true });
    } else {
        copyFileSync(join(repositoryRoot, document), destination);
    }
}
