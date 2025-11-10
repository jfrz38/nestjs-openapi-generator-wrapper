# OpenAPI Custom Wrapper

![npm](https://img.shields.io/npm/v/@jfrz38/nestjs-open-api-generator-wrapper) ![license](https://img.shields.io/npm/l/@jfrz38/nestjs-open-api-generator-wrapper)

An **opinionated wrapper** around [`openapi-generator`](https://www.npmjs.com/package/@openapitools/openapi-generator-cli) for generating TypeScript code to be implemented in NestJS applications using a class and folder structure closer to what I use to use, inspired by Java and Spring Boot-style patterns.

> ⚠️ This project reflects my personal opinion on how `Dto` classes and controllers could  be generated. It is not meant to be a universal solution or to replace the standard behavior of openapi-generator.

## Main Features

- Generates **controllers that implement interfaces**, enforcing all methods defined in the OpenAPI spec.
- Generates **models, DTOs, and routes** following a more modular and organized structure, avoiding the clutter typical of the default `openapi-generator` output among with validation.
- Simple configuration: it is just necessary to specify the OpenAPI yaml definition folder and the destination folder.
- Under the hood, it **still uses** `openapi-generator`, so the output is equivalent to running the generator (among custom templates) directly with the correct parameters—but much easier to use.

And also please note the following restrictions when using this wrapper:

- All paths in openapi.yml **must use tags** to define API implementations.
- [`class-validator`](https://www.npmjs.com/package/class-validator) **is automatically referenced** in the generated code, so you must include it as a dependency in your project.
- Generated controllers use `NestJS` annotations.
- Generated controllers use `Express` under the hood, so Express-related decorators and behaviors apply.
- Exists validation for all DTOs.
- Generated controllers expose one abstract method for each path that must be implemented, otherwise the code will not compile.

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

Using `npm`:

```bash
npm install @jfrz38/nestjs-open-api-generator-wrapper
```

## Usage

Using `npx`:

```bash
npx @jfrz38/nestjs-open-api-generator-wrapper \
-i ../api/openapi.yaml \
-o ./dist/generated/src
```

> ⚠️ **Caution**. The program may remove the output (`-o`) folder to create a clean generation. Default behavior is to **no** overwrite (`--remove-output-dir` is `false`). Overwriting is recommended in production, but be careful not to delete important folders during development.

Allowed parameters are:

| Parameter                              | Usage                                       | Mandatory | Default            |
| -------------------------------------- | ------------------------------------------- | --------- | ------------------ |
| `-i, --input <spec>`                   | Path to OpenAPI spec file or folder         | **Yes**       | —                  |
| `-o, --output <dir>`                   | Output directory for generated code         | **Yes**       | —                  |
| `-t, --templates <dir>`                | Path to custom template directory           | No        | `api/generated/templates` |
| `--additional-properties <properties>` | Pass additional properties to the generator | No        | `modelFileSuffix=.dto,modelSuffix=Dto,serviceFileSuffix=.api,serviceSuffix=Api`               |
| `--global-property <property>`         | Set global properties for code generation   | No        | `apis,models`               |
| `--ignore-file-override <path>`        | Path to an OpenAPI ignore file              | No        | `.openapi-generator-ignore`               |
| `--clean-output`                         | Remove the output directory if it exists    | No       | `false` |

Also, default `.openapi-generator-ignore` ignore all except `api` and `model`:

```md
# Ignore all first-level files
/*

# Except the folders api/ and model/
!api/
!model/
```

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
        │   └── tag_2.api.ts
        └── model/
            └── all_dtos.dto.ts
```

## Generation example

Complete code generation and a bigger explanation is into [example folder](https://github.com/jfrz38/nestjs-openapi-generator-wrapper/tree/develop/example)

## Using in production

To avoid boilerplate the easiest way is to use predefined generator tool with your parameters. If any parameter is used to generate your development code, then you can use predefined command. Otherwise just replace desire flag with your custom parameter.

> ⚠️ Note that OpenApi generator uses Java so it can't be used directly.

You can simple use a Dockerfile similar to this:

```Dockerfile
FROM openapitools/openapi-generator-cli AS generator

WORKDIR /usr/src/app

# Copy all necessary files: openapi.yml, custom templates...
COPY api/ ./api
COPY code/api/generated/templates ./code/api/generated/templates
COPY code/api/generated/.openapi-generator-ignore ./code/api/generated/.openapi-generator-ignore

WORKDIR /usr/src/app/code

# Notice how wrapper is not used, just use the same parameters with official image
RUN openapi-generator-cli generate -g typescript-nestjs -i ../api/openapi.yaml -o api/generated/src -t api/generated/templates --additional-properties=modelFileSuffix=.dto,modelSuffix=Dto,serviceFileSuffix=.api,serviceSuffix=Api --global-property=apis,models

FROM node:24

# your application dockerfile

# Copy generated files
COPY --from=generator /usr/src/app/code/api ./code/api

# ...

RUN npm run build
EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "run", "start:prod"]
```

Custom templates used by default can be found [here](https://github.com/jfrz38/nestjs-openapi-generator-wrapper/tree/develop/wrapper/src/templates)
