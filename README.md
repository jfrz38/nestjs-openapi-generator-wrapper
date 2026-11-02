# OpenAPI Custom Wrapper

[![npm](https://img.shields.io/npm/v/@jfrz38/nestjs-open-api-generator-wrapper)](https://www.npmjs.com/package/@jfrz38/nestjs-open-api-generator-wrapper)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/jfrz38/nestjs-openapi-generator-wrapper/protect-branch.yml)](https://github.com/jfrz38/nestjs-openapi-generator-wrapper/actions)
[![license](https://img.shields.io/npm/l/@jfrz38/nestjs-open-api-generator-wrapper)](https://github.com/jfrz38/nestjs-openapi-generator-wrapper/blob/main/LICENSE)
[![NPM Downloads](https://img.shields.io/npm/dm/@jfrz38/nestjs-open-api-generator-wrapper)](https://www.npmjs.com/package/@jfrz38/nestjs-open-api-generator-wrapper)

An **opinionated wrapper** around [`openapi-generator`](https://www.npmjs.com/package/@openapitools/openapi-generator-cli) for generating TypeScript code to be implemented in NestJS applications using a class and folder structure closer to what I use to use, inspired by Java and Spring Boot-style patterns.

> ⚠️ This project reflects my personal opinion on how `Dto` classes and controllers could  be generated. It is not meant to be a universal solution or to replace the standard behavior of openapi-generator.

## Core idea

This wrapper generates **abstract NestJS controllers** from your OpenAPI spec.

Generated classes contain all HTTP wiring (like `@Controller` or HTTP-related tags, `@Get`, `@Post`, `@Req`, `@Body`... and also params and DTOs).

Once the code is generated based on your OpenAPI you only need to **extend those classes and implement the abstract methods**. Nothing else because all HTTP concerns are already handled by the generated code.

```ts
import { Injectable } from '@nestjs/common';
import { UsersApi } from './path/to/generated/api/users.api';
import { UserDto } from './path/to/generated/model/user.dto';

@Injectable()
export class MyUserController extends UsersApi {
    constructor() { super(); }

    protected getUsers(): UserDto[] {
        return [];
    }
}
```

### What this means

- No HTTP decorators in your code.
- No manual DTO wiring.
- No risk of missing endpoints.
- OpenAPI is the single source of truth.
- If the spec changes and you don't implement it, TypeScript fails the build.
- Controllers are already fully wired to HTTP via generated decorators.

This is intentionally closer to **Spring Boot-style contract enforcement** than idiomatic NestJS.

## Main Features

- Generates **abstract NestJS controllers**, enforcing all methods defined in the OpenAPI spec.
- Generates **models, DTOs, and routes** following a more modular and organized structure, avoiding the clutter typical of the default `openapi-generator` output among with validation.
- Simple configuration: it is just necessary to specify the OpenAPI yaml definition folder and the destination folder.
- Under the hood, it **still uses** `openapi-generator`, so the output is equivalent to running the generator (among custom templates) directly with the correct parameters—but much easier to use.

And also please note the following restrictions when using this wrapper:

- All paths in openapi.yml **must use tags** to define API implementations.
- [`class-validator`](https://www.npmjs.com/package/class-validator) **is automatically referenced** in the generated code, so you must include it as a dependency in your project.
- Generated controllers use `NestJS` annotations.
- Generated controllers use `Express` under the hood, so Express-related decorators and behaviors apply.
- Validation exists for all DTOs.
- Generated controllers expose one abstract method for each path that must be implemented, otherwise the code will not compile.
- Integer, number, and boolean path, query, and header parameters are converted from their HTTP string representation. Missing or invalid required parameters return HTTP 400.
- A single concrete `2xx` response status is applied to the route. Operations with multiple successful statuses or a wildcard `2XX` response are rejected because one static NestJS handler cannot select between them.
- `HEAD` and `OPTIONS` operations are supported. `TRACE`, cookie parameters, multipart bodies, and URL-encoded form bodies are rejected before generation because they require application-specific NestJS or Express wiring.
- The generated protected methods always receive `Request` and `Response` as the final required parameters. An override may omit unused trailing parameters, but implementations that declare them must use the generated order and types.
- Generated DTOs distinguish integers from other numbers, enforce enum membership, validate array elements, and preserve `uniqueItems` as an array with uniqueness validation.
- Optional non-nullable DTO properties may be omitted but reject an explicit `null`. Nullable properties accept `null`, and required properties are emitted with strict-property-initialization-safe declarations.
- Nested DTO validation applies when nested values are DTO instances, as expected by `class-validator`; applications constructing DTOs from plain objects must configure their transformation strategy accordingly.

**⚠️ At this moment the wrapper output is equivalent to use:**

```bash
openapi-generator-cli generate \
-g typescript-nestjs \
-i ../api/openapi.yaml \
-o api/generated/src \
-t api/generated/templates \
--additional-properties=modelFileSuffix=.dto,modelSuffix=Dto,serviceFileSuffix=.api,serviceSuffix=Api \
--global-property=apis,models
```

Note that generator (i.e. `-g`) will be always `typescript-nestjs`.

## Installation

Requirements:

- Node.js 24 or newer.
- Java 11 or newer. CI verifies generation with JDK 17.

Using `npm`:

```bash
npm install -D @jfrz38/nestjs-open-api-generator-wrapper
```

This wrapper is a development-time code generation tool, so it should be installed as a dev dependency.

The package pins both parts of the generator toolchain: npm launcher `@openapitools/openapi-generator-cli` 2.42.0 and Java OpenAPI Generator 7.14.0. The wrapper always passes its packaged generator configuration explicitly, so an `openapitools.json` in the consuming project cannot change the Java generator version or be created as a generation side effect.

## Usage

Using `npx`:

```bash
npx @jfrz38/nestjs-open-api-generator-wrapper \
-i ../api/openapi.yaml \
-o ./api/generated/src
```

> It is recommended to add the generated output folder to `.gitignore`, since generated code usually should not be committed.
>
> It is also recommended to include the generated output folder in the `include` section of your `tsconfig.json` so TypeScript picks up the generated files during compilation.
>
>```json
>{
>  "include": ["src/**/*.ts", "api/generated/src/**/*.ts"]
>}
>
>```
>
> Without `--clean-output`, generation writes into the existing output directory: matching files may be overwritten and obsolete files remain. With `--clean-output`, all input paths are validated first, generation is staged in a temporary sibling directory, and the existing output is replaced only after generation succeeds. Filesystem roots, the user home, the current working directory or its ancestors, and directories containing the OpenAPI input are rejected as clean-output targets.

Allowed parameters are:

| Parameter                              | Usage                                       | Mandatory | Default            |
| -------------------------------------- | ------------------------------------------- | --------- | ------------------ |
| `-i, --input <spec>`                   | Path to OpenAPI spec file or folder         | **Yes**       | —                  |
| `-o, --output <dir>`                   | Output directory for generated code         | **Yes**       | —                  |
| `-t, --templates <dir>`                | Path to custom template directory           | No        | Templates bundled with the package |
| `--additional-properties <properties>` | Pass additional properties to the generator | No        | `modelFileSuffix=.dto,modelSuffix=Dto,serviceFileSuffix=.api,serviceSuffix=Api`               |
| `--global-property <property>`         | Set global properties for code generation   | No        | `apis,models`               |
| `--ignore-file-override <path>`        | Path to an OpenAPI ignore file              | No        | Ignore file bundled with the package      |
| `--clean-output`                         | Safely replace the output after successful generation | No       | `false` |

Also, default `.openapi-generator-ignore` ignore all except `api` and `model`:

```md
# Ignore all first-level files
/*

# Except the folders api/ and model/
!api/
!model/
```

## Supported OpenAPI contract

The integration suite covers OpenAPI 3.0.3 and OpenAPI 3.1.0 documents. Swagger
2.0 is not part of the supported wrapper contract, even when the underlying
generator can parse it.

- HTTP operations: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and
  `OPTIONS`. `TRACE` is rejected before generation.
- Parameters: path, query, and header parameters are supported. Cookie
  parameters are rejected because they require application-specific middleware.
- Request bodies: JSON bodies are supported. `multipart/form-data` and
  `application/x-www-form-urlencoded` are rejected before generation.
- Responses: an operation may declare one concrete `2xx` response for the
  generated static NestJS status. Multiple successful responses and wildcard
  `2XX` responses are rejected.
- Schemas: generated DTOs support typed `additionalProperties` maps and `allOf`
  inheritance. Validation metadata is generated for inherited properties as
  exposed by OpenAPI Generator.
- Nested validation: `class-validator` validates nested DTO instances. Turning
  plain JSON objects into those instances remains the consuming application's
  responsibility.

These are the tested wrapper guarantees, not the complete feature set of the
underlying OpenAPI Generator. Generation fails early for the unsupported
controller constructs listed above; other OpenAPI features may retain the
behavior of the pinned `typescript-nestjs` generator.

## Upgrading OpenAPI Generator

Generator upgrades are intentional because a new Java generator version can change emitted source code:

1. Change the version in `wrapper/openapitools.json`.
2. If the npm launcher also needs an upgrade, update `wrapper/package.json` and `wrapper/pnpm-lock.yaml` with pnpm.
3. Run `make build`, `make test`, and `make test-integration`.
4. Review all generated-output and integration-expectation changes before accepting them.
5. Run `make generate-example` only after accepting the new output, then commit the configuration, tests, and intentional generated changes together.

## Maintainer release process

A push to `main` runs the package smoke test and the integration suite before a
GitHub Release is created. The release workflow builds one npm tarball, verifies
it from a clean consumer project, records its SHA-256 checksum, and attaches both
files to the release. If the version tag already points to another commit, release
creation fails instead of moving or reusing that tag.

Publishing to npm is a separate manual workflow:

1. Open the **Publish Release** workflow from `main`.
2. Enter the explicit GitHub Release tag, such as `v1.2.3`.
3. Approve the protected `npm` environment when prompted.

The publication workflow downloads and verifies the release asset; it does not
rebuild the package. npm therefore receives the exact tarball that passed the
release checks. Publication uses npm trusted publishing with provenance, so the
GitHub `npm` environment and the npm trusted publisher must both authorize
`.github/workflows/npm_publish.yml` from `main`.

## Why I use it

I created this wrapper with custom templates and classes because I was not satisfied with the default output of `openapi-generator`.

Coming from a `Spring Boot–style mindset`, I missed having a strict contract enforcement: generated controllers should make it mandatory to implement every OpenAPI-defined endpoint, while DTOs should always reflect the external contract.

The main goal of this project is to increase development safety by relying on generated code as much as possible.  
More importantly, it enforces a clear **separation of concerns**: application logic stays in your codebase, while all external-facing contracts (controllers, DTOs, validation rules) are generated from OpenAPI.

The generated structure (explained in detail with code in [examples](https://github.com/jfrz38/nestjs-openapi-generator-wrapper/tree/develop/example)) allow to apply a **Clean Architecture** approach: place DTOs and Controllers in the `infrastructure` layer, and simply map them to your application models where needed.

## Generated Folder Structure

Generated folder structure is not as clean as could be but as it is auto-generated can be enough.

```bash
└── path/
    └── generated/
        ├── api/
        │   ├── tag_1.api.ts
        │   ├── tag_2.api.ts
        │   └── ...
        └── model/
            ├── model_1_dto.dto.ts
            ├── model_2_dto.dto.ts
            └── ...
```

## Generation example

Complete code generation and a bigger explanation is into [example folder](https://github.com/jfrz38/nestjs-openapi-generator-wrapper/tree/develop/example)

## Using in production

To deploy an application using this wrapper, you must ensure that the generated code is available during the build process. There are three ways to achieve this, with the **Integrated Multi-stage Build** being the recommended approach for automated pipelines.

### Integrated Multi-stage Build (Recommended)

This is the most robust workflow. It automates code generation within the Docker build process, ensuring API implementation always stays in sync with OpenAPI spec.

Since the wrapper requires both Java (for OpenAPI Generator) and NodeJS (to run the wrapper and in the end node is mandatory to run NestJS), we use a multi-stage Dockerfile. This allows us to "inject" a modern NodeJS environment into the official OpenAPI image and then discard the heavy Java dependencies, resulting in a slim, production-ready image.

You can use a Dockerfile like this when generating during image build:

```Dockerfile
# STAGE 1: API Generation
FROM openapitools/openapi-generator-cli:v7.14.0 AS generator

# Inject the pinned Node.js toolchain used to run the wrapper
COPY --from=node:24.11.0-bookworm-slim /usr/local/bin/node /usr/local/bin/
COPY --from=node:24.11.0-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

WORKDIR /usr/src/app

# Install dev-dependencies to access the wrapper
COPY code/package*.json ./
RUN npm ci --include=dev --no-scripts

# Copy API spec. This folder must contains openapi.yaml
COPY api/ ./api

# Execute the generation
RUN npx @jfrz38/nestjs-open-api-generator-wrapper -i ./api/openapi.yaml -o ./generated/src


# STAGE 2: Application Build
FROM node:24.11.0-bookworm-slim AS builder

WORKDIR /usr/src/app

COPY code/package*.json ./
RUN npm ci
COPY code/ ./

# Sync the generated sources into the NestJS project
COPY --from=generator /usr/src/app/generated/src ./api/generated/src

# Compile
RUN npm run build


# STAGE 3: Final production image
FROM node:24.11.0-alpine3.22

WORKDIR /usr/src/app

# Since generator is already executed, only production dependencies are installed
COPY code/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Bring back files from builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Do whatever else you want
# ...


CMD ["node", "dist/main.js"] 
```

### Alternative workflows

If the integrated build does not fit your requirements, you may consider these alternatives:

- **Local generation**: The easiest production workflow is to generate the `api` and `model` files locally and commit the generated output to version control. This avoids the need for Java in your CI/CD pipeline but requires manual updates whenever the OpenAPI spec changes.
- **Direct official CLI usage**: If you want to use the official generator, this repo still provides the templates and configuration needed for the same output. Just copy custom templates [available in this location](https://github.com/jfrz38/nestjs-openapi-generator-wrapper/tree/main/wrapper/src/templates) and run the equivalent command explained above:

```bash
openapi-generator-cli generate \
-g typescript-nestjs \
-i ../api/openapi.yaml \
-o api/generated/src \
-t api/generated/templates \
--additional-properties=modelFileSuffix=.dto,modelSuffix=Dto,serviceFileSuffix=.api,serviceSuffix=Api \
--global-property=apis,models
```

Default templates currently overrides these ones:

- `api.service.mustache`
- `model.mustache`
- `modelGeneric.mustache`
- `modelGenericEnums.mustache`
