const { copyFileSync, cpSync, mkdirSync } = require('fs');
const { join } = require('path');

const packageRoot = join(__dirname, '..');
const sourceRoot = join(packageRoot, 'src');
const distRoot = join(packageRoot, 'dist');

cpSync(join(sourceRoot, 'templates'), join(distRoot, 'templates'), { recursive: true });
mkdirSync(join(distRoot, 'config'), { recursive: true });
copyFileSync(
    join(sourceRoot, 'config', '.openapi-generator-ignore'),
    join(distRoot, 'config', '.openapi-generator-ignore')
);
