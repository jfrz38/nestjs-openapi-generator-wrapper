# Generation example

This code has been generated using the following command from the project root folder (where `package.json` exists):

```bash
npx @jfrz38/nestjs-open-api-generator-wrapper \
-i ../example/openapi.yml \
-o ../example/generated
```

The command generates two folders:

- `api`: contains one class per tag. Each class is meant to be extended and implemented by your domain controllers
- `model`: contains all DTOs defined in `openapi.yml`.

The main idea is to separate **external concerns** (i.e. things that belong to (or exists for) an external requirement such as HTTP communication) from your **application code**.

To use this code in a NestJS application, just extend the generated controller in your own class:

```ts
import { Injectable } from '@nestjs/common';
import { UserApi } from './some/path/to/generated/api/users.api';
import { UserDto } from './some/path/to/generated/model/user.dto';

@Injectable()
export class MyUserController extends UsersApi {

    constructor() { super(); }

    protected getUsers(): Array<UserDto> {
        return ...
    }
}
```

And into your module:

```ts
@Module({ controllers: [MyUserController] })
export class UsersModule { }
```

Notes about [**generated controllers**](./generated/api/products.api.ts):

- Controllers exposes **abstract classes** that you must implement, ensuring signatures always match the OpenAPI spec.
- Controllers **automatically generate the routes**, so you don’t need to decorate each method with the corresponding path. Your entire application entry-point is defined by open-api and can't be implemented using a wrong path.
- Controllers enforce **required fields** so they can never be `null` neither `undefined`.
- Controller use NestJS `ValidationPipe` so models are validated when they are created.
- `Request` and `Response` are always optionals so there is no need to implement them if they are not going to be used.

Notes about [**generated DTOs**](./generated/model/user.dto.ts):

- DTOs use `class-validator` according to restrictions defined in OpenApi file.
- DTOs are always generated with `readonly` values to enforce to map into domain objects.

## Users Controller – Production-Like Implementation

As with the rest of this project, this section is entirely opinionated. So for me a controller to be used in production-implementations could be something like this:

```ts
import { Injectable } from '@nestjs/common';
import { UserApi } from './some/path/to/generated/api/users.api';
import { UserDto } from './some/path/to/generated/model/user.dto';

@Injectable()
// you can use your own guards
@UseGuards(AuthorityGuard)
export class MyUserController extends UsersApi {

    constructor(
        private readonly mapper: UserDtoMapper,
        private readonly useCase: ObtainUserUseCase
    ) { 
        super();
    }
    
    // and also you can use your own annotations but with a boilerplate *
    @HasPermission([Permission.CREATE_AUTHOR])
    protected getUsers(): Array<UserDto> {
        const users = useCase.dispatch();
        return mapper.toDto(users);
    }
}
```

Notice that this controller doesn't care about the HTTP path it needs to implement neither which verb is used. Those responsibilities are fully handled by the generated class.

At this point, your only task is to map from the "external structure" (DTO) to the "domain structure" (domain model).  

> \*Because NestJS relies on class metadata for some decorators, you might occasionally need to create your own metadata, since `@Controller` metadata does not exist on this class.

This is an example to add a customer decorator for your controller:

<details>

```ts
import 'reflect-metadata';

export const YOUR_DECORATOR_KEY = 'key';
const PARENT_METHOD_PREFIX = 'do';

/**
 * Custom decorator to set custom value on a controller method, even if the method
 * is abstract in a parent class.
 * 
 * This decorator also show how to get handler method name automatically
 * generated with the pattern: "do + MethodNameInUpperCamelCase".
 */
export function YourDecoratorName(customValue: any): MethodDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    Reflect.defineMetadata(YOUR_DECORATOR_KEY, customValue, target[propertyKey]);

    // Controller handler which is auto-generated
    const handlerName = `${PARENT_METHOD_PREFIX}${(propertyKey as string).charAt(0).toUpperCase()}${(propertyKey as string).slice(1)}`;

    // do whatever you want with this if necessary
  };
}

```
