import { readFileSync } from 'fs';
import { parse } from 'yaml';

type OpenApiObject = Record<string, unknown>;

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;
const UNSUPPORTED_FORM_CONTENT_TYPES = ['multipart/form-data', 'application/x-www-form-urlencoded'];

export function assertSupportedControllerContract(specPath: string, outputDir: string) {
    let document: OpenApiObject;
    try {
        const parsedDocument: unknown = parse(readFileSync(specPath, 'utf8'));
        if (!isObject(parsedDocument)) throw new Error('the document root must be an object');
        document = parsedDocument;
    } catch (error) {
        throw new Error(`Cannot generate into '${outputDir}': OpenAPI input '${specPath}' could not be parsed: ${errorMessage(error)}.`);
    }

    const paths = document.paths;
    if (!isObject(paths)) return;

    for (const [path, rawPathItem] of Object.entries(paths)) {
        assertSafeGeneratedString(outputDir, `path '${path}'`, path);
        const pathItem = resolveObject(document, rawPathItem);
        if (!pathItem) continue;

        const pathParameters = resolveArray(document, pathItem.parameters);
        for (const method of HTTP_METHODS) {
            const operation = resolveObject(document, pathItem[method]);
            if (!operation) continue;

            const operationLabel = `${method.toUpperCase()} ${path}`;
            if (method === 'trace') {
                throw unsupportedContract(outputDir, operationLabel, 'TRACE operations are not supported by NestJS decorators');
            }

            const responses = resolveObject(document, operation.responses);
            const successResponses = responses ? Object.keys(responses).filter(code => /^2\d{2}$/u.test(code)) : [];
            const hasWildcardSuccessResponse = responses && Object.keys(responses).some(code => /^2[xX]{2}$/u.test(code));
            if (hasWildcardSuccessResponse) {
                throw unsupportedContract(outputDir, operationLabel, 'wildcard 2XX responses cannot be represented by a static NestJS HTTP status');
            }
            if (successResponses.length > 1) {
                throw unsupportedContract(outputDir, operationLabel, `multiple successful responses (${successResponses.join(', ')}) cannot be represented by one static NestJS HTTP status`);
            }

            const parameters = [...pathParameters, ...resolveArray(document, operation.parameters)];
            const resolvedParameters = parameters.flatMap(parameter => {
                const resolvedParameter = resolveObject(document, parameter);
                return resolvedParameter ? [resolvedParameter] : [];
            });
            for (const parameter of resolvedParameters) {
                if (typeof parameter.name === 'string') {
                    assertSafeGeneratedString(outputDir, `${operationLabel} parameter '${parameter.name}'`, parameter.name);
                }
            }
            if (resolvedParameters.some(parameter => parameter.in === 'cookie')) {
                throw unsupportedContract(outputDir, operationLabel, 'cookie parameters require application-specific cookie middleware');
            }
            if (resolvedParameters.some(parameter => parameter.in === 'formData')) {
                throw unsupportedContract(outputDir, operationLabel, 'OpenAPI 2 formData parameters are not supported');
            }

            const requestBody = resolveObject(document, operation.requestBody);
            const content = requestBody && resolveObject(document, requestBody.content);
            const unsupportedContentType = content && UNSUPPORTED_FORM_CONTENT_TYPES.find(type => type in content);
            if (unsupportedContentType) {
                throw unsupportedContract(outputDir, operationLabel, `'${unsupportedContentType}' request bodies require application-specific middleware`);
            }

            const consumes = Array.isArray(operation.consumes) ? operation.consumes : document.consumes;
            if (Array.isArray(consumes)) {
                const unsupportedConsume = UNSUPPORTED_FORM_CONTENT_TYPES.find(type => consumes.includes(type));
                if (unsupportedConsume) {
                    throw unsupportedContract(outputDir, operationLabel, `'${unsupportedConsume}' request bodies require application-specific middleware`);
                }
            }
        }
    }
}

function resolveArray(document: OpenApiObject, value: unknown): unknown[] {
    const resolved = resolveValue(document, value);
    return Array.isArray(resolved) ? resolved : [];
}

function resolveObject(document: OpenApiObject, value: unknown): OpenApiObject | undefined {
    const resolved = resolveValue(document, value);
    return isObject(resolved) ? resolved : undefined;
}

function resolveValue(document: OpenApiObject, value: unknown): unknown {
    if (!isObject(value) || typeof value.$ref !== 'string' || !value.$ref.startsWith('#/')) return value;

    return value.$ref
        .slice(2)
        .split('/')
        .map(segment => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
        .reduce<unknown>((current, segment) => isObject(current) ? current[segment] : undefined, document);
}

function isObject(value: unknown): value is OpenApiObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unsupportedContract(outputDir: string, operation: string, reason: string): Error {
    return new Error(`Cannot generate into '${outputDir}': ${operation} cannot be generated: ${reason}.`);
}

function assertSafeGeneratedString(outputDir: string, label: string, value: string) {
    if (!/["\\\r\n\u2028\u2029]/u.test(value)) return;

    throw new Error(`Cannot generate into '${outputDir}': ${label} contains characters that cannot be represented safely in generated TypeScript.`);
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
