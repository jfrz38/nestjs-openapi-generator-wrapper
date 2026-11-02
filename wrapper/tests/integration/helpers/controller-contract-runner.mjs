import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import * as Nest from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

const generatedModule = await import(pathToFileURL(process.argv[2]).href);
const WidgetsApi = generatedModule.WidgetsApi ?? generatedModule.default?.WidgetsApi;
assert.equal(typeof WidgetsApi, 'function');

let receivedParameters = [];
let headCalled = false;
let optionsCalled = false;

class WidgetsController extends WidgetsApi {
    deleteJob() {}

    getWidget(...parameters) {
        receivedParameters = parameters;
        return { accepted: true };
    }

    headHealth() {
        headCalled = true;
    }

    optionsHealth() {
        optionsCalled = true;
    }
}
Nest.Controller()(WidgetsController);

class TestModule {}
Nest.Module({ controllers: [WidgetsController] })(TestModule);
const app = await NestFactory.create(TestModule, { logger: false });

try {
    await app.listen(0, '127.0.0.1');
    const baseUrl = await app.getUrl();
    const accepted = await fetch(`${baseUrl}/widgets/42?enabled=true&mode=strict&ratio=1.5`, {
        headers: { 'X-Retry-Count': '3' }
    });

    assert.equal(accepted.status, 202);
    assert.deepEqual(await accepted.json(), { accepted: true });
    assert.deepEqual(receivedParameters.slice(0, 5), [42, true, 'strict', 1.5, 3]);

    assert.equal((await fetch(`${baseUrl}/widgets/42?mode=strict`)).status, 400);
    assert.equal((await fetch(`${baseUrl}/widgets/42?enabled=not-a-boolean&mode=strict`)).status, 400);
    assert.equal((await fetch(`${baseUrl}/jobs/job-1`, { method: 'DELETE' })).status, 204);
    assert.equal((await fetch(`${baseUrl}/health`, { method: 'HEAD' })).status, 204);
    assert.equal((await fetch(`${baseUrl}/health`, { method: 'OPTIONS' })).status, 204);
    assert.equal(headCalled, true);
    assert.equal(optionsCalled, true);
} finally {
    await app.close();
}
