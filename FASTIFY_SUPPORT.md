# Implementation Plan: Fastify Support

## Current Project Analysis

The **nestjs-better-auth** project is a Better Auth integration library with NestJS that currently:

- **Supports only Express** (as documented in the README)
- Uses Express-specific middlewares (`SkipBodyParsingMiddleware`)
- Implements handlers using `toNodeHandler` from Better Auth
- Uses Bun as runtime according to Cursor rules
- Has modular architecture with guards, decorators and hooks

## Objective

Implement Fastify support while maintaining full compatibility with Express, allowing automatic or manual switching between the two HTTP adapters.

## Implementation Strategy

### 1. Automatic Adapter Detection

```typescript
// Automatically detect the HTTP adapter used
const adapterType = this.adapter.httpAdapter.getType(); // 'express' | 'fastify'
```

Detection will be done through NestJS's `HttpAdapterHost`, which already provides information about the adapter type in use.

### 2. Proposed File Structure

```
src/
├── adapters/
│   ├── express-adapter.ts     # Implementação específica Express
│   ├── fastify-adapter.ts     # Implementação específica Fastify
│   ├── adapter-factory.ts     # Factory para criar adaptador correto
│   └── base-adapter.ts        # Interface e lógica comum
├── middlewares/
│   ├── express/
│   │   └── skip-body-parsing.middleware.ts
│   ├── fastify/
│   │   └── fastify-body-parsing.middleware.ts
│   └── middleware-factory.ts
├── types/
│   ├── adapter-types.ts       # Tipos compartilhados
│   └── fastify-types.ts       # Tipos específicos Fastify
└── utils/
    └── adapter-utils.ts       # Utilitários compartilhados
```

### 3. Interface Comum para Adaptadores

```typescript
interface HttpAdapterStrategy {
  configure(consumer: MiddlewareConsumer, adapter: HttpAdapterHost): void;
  setupCors(trustedOrigins: string[]): void;
  setupBodyParser(): void;
  setupAuthHandler(basePath: string): void;
  getAdapterType(): 'express' | 'fastify';
}

abstract class BaseAdapter implements HttpAdapterStrategy {
  constructor(
    protected readonly auth: Auth,
    protected readonly options: AuthModuleOptions
  ) {}

  abstract configure(consumer: MiddlewareConsumer, adapter: HttpAdapterHost): void;
  abstract setupAuthHandler(basePath: string): void;
  
  // Common implementations
  setupCors(trustedOrigins: string[]): void {
    // Common CORS logic
  }
}
```

### 4. Implementação do Express Adapter

```typescript
export class ExpressAdapter extends BaseAdapter {
  getAdapterType(): 'express' {
    return 'express';
  }

  configure(consumer: MiddlewareConsumer, adapter: HttpAdapterHost): void {
    // Maintains current implementation
    if (!this.options.disableBodyParser) {
      consumer.apply(SkipBodyParsingMiddleware).forRoutes('*path');
    }
    
    this.setupAuthHandler(this.getBasePath(), adapter);
  }

  setupAuthHandler(basePath: string, adapter: HttpAdapterHost): void {
    const handler = toNodeHandler(this.auth);
    adapter.httpAdapter
      .getInstance()
      .use(`${basePath}/*path`, (req: Request, res: Response) => {
        req.url = req.originalUrl;
        return handler(req, res);
      });
  }
}
```

### 5. Implementação do Fastify Adapter

```typescript
export class FastifyAdapter extends BaseAdapter {
  getAdapterType(): 'fastify' {
    return 'fastify';
  }

  configure(consumer: MiddlewareConsumer, adapter: HttpAdapterHost): void {
    if (!this.options.disableBodyParser) {
      this.setupFastifyBodyParser(adapter);
    }
    
    this.setupAuthHandler(this.getBasePath(), adapter);
  }

  private setupFastifyBodyParser(adapter: HttpAdapterHost): void {
    const fastifyInstance = adapter.httpAdapter.getInstance();
    
    // Register custom body parser plugin
    fastifyInstance.register(async (fastify) => {
      fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, 
        (req, body, done) => {
          if (req.url?.startsWith('/api/auth')) {
            // Skip parsing for Better Auth routes
            done(null, body);
          } else {
            // Normal parsing for other routes
            try {
              const json = JSON.parse(body.toString());
              done(null, json);
            } catch (err) {
              done(err);
            }
          }
        }
      );
    });
  }

  setupAuthHandler(basePath: string, adapter: HttpAdapterHost): void {
    const fastifyInstance = adapter.httpAdapter.getInstance();
    const handler = toNodeHandler(this.auth);
    
    // Register wildcard route for Better Auth
    fastifyInstance.register(async (fastify) => {
      fastify.all(`${basePath}/*`, async (request, reply) => {
        // Convert Fastify request/reply to Node.js
        const nodeReq = this.convertFastifyRequestToNode(request);
        const nodeRes = this.convertFastifyReplyToNode(reply);
        
        return handler(nodeReq, nodeRes);
      });
    });
  }

  private convertFastifyRequestToNode(request: FastifyRequest): any {
    // Implement conversion from FastifyRequest to Node.js Request
    return {
      ...request.raw,
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: request.body
    };
  }

  private convertFastifyReplyToNode(reply: FastifyReply): any {
    // Implement conversion from FastifyReply to Node.js Response
    return {
      ...reply.raw,
      status: (code: number) => reply.status(code),
      json: (data: any) => reply.send(data),
      send: (data: any) => reply.send(data)
    };
  }
}
```

### 6. Factory for Adapter Creation

```typescript
export class AdapterFactory {
  static create(
    adapterType: string,
    auth: Auth,
    options: AuthModuleOptions
  ): HttpAdapterStrategy {
    switch (adapterType) {
      case 'express':
        return new ExpressAdapter(auth, options);
      case 'fastify':
        return new FastifyAdapter(auth, options);
      default:
        throw new Error(`Unsupported adapter type: ${adapterType}`);
    }
  }
}
```

### 7. AuthModule Modifications

```typescript
@Module({
  imports: [DiscoveryModule],
})
export class AuthModule implements NestModule, OnModuleInit {
  private readonly logger = new Logger(AuthModule.name);
  private adapterStrategy: HttpAdapterStrategy;

  constructor(
    @Inject(AUTH_INSTANCE_KEY) private readonly auth: Auth,
    @Inject(DiscoveryService) private readonly discoveryService: DiscoveryService,
    @Inject(MetadataScanner) private readonly metadataScanner: MetadataScanner,
    @Inject(HttpAdapterHost) private readonly adapter: HttpAdapterHost,
    @Inject(AUTH_MODULE_OPTIONS_KEY) private readonly options: AuthModuleOptions,
  ) {
    // Automatic or manual adapter detection
    const adapterType = this.options.adapter || this.adapter.httpAdapter.getType();
    this.adapterStrategy = AdapterFactory.create(adapterType, this.auth, this.options);
    
    this.logger.log(`Using ${adapterType} adapter for Better Auth integration`);
  }

  configure(consumer: MiddlewareConsumer): void {
    this.adapterStrategy.configure(consumer, this.adapter);
  }

  // ... rest of implementation remains the same
}
```

### 8. Configuration Types Update

```typescript
type AuthModuleOptions = {
  adapter?: 'express' | 'fastify'; // Allows manual override
  disableExceptionFilter?: boolean;
  disableTrustedOriginsCors?: boolean;
  disableBodyParser?: boolean;
};
```

### 9. package.json Update

```json
{
  "peerDependencies": {
    "typescript": "^5",
    "@nestjs/common": "^11.0.10",
    "@nestjs/core": "^11.0.10",
    "@nestjs/platform-express": "^11.0.0",
    "@nestjs/platform-fastify": "^11.0.0",
    "better-auth": "^1.2.8",
    "express": "^5.0.0",
    "fastify": "^4.0.0"
  },
  "peerDependenciesMeta": {
    "@nestjs/platform-express": { "optional": true },
    "@nestjs/platform-fastify": { "optional": true },
    "express": { "optional": true },
    "fastify": { "optional": true }
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "@tsconfig/node22": "^22.0.2",
    "@types/bun": "latest",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "bunup": "^0.8.37",
    "fastify": "^4.0.0",
    "@types/fastify": "^4.0.0"
  }
}
```

## Configuration and Usage

### Automatic Detection (Recommended)

```typescript
// app.module.ts
@Module({
  imports: [
    AuthModule.forRoot(auth), // Automatically detects Express or Fastify
  ],
})
export class AppModule {}
```

### Manual Configuration

```typescript
// app.module.ts
@Module({
  imports: [
    AuthModule.forRoot(auth, {
      adapter: 'fastify', // or 'express'
      // ... other options
    }),
  ],
})
export class AppModule {}
```

### Example with Fastify

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bodyParser: false } // Important: disable body parser
  );
  
  await app.listen(process.env.PORT ?? 3333);
}
bootstrap();
```

## Testing and Validation

### Test Structure

```
tests/
├── express/
│   ├── auth-module.express.spec.ts
│   ├── guards.express.spec.ts
│   └── middlewares.express.spec.ts
├── fastify/
│   ├── auth-module.fastify.spec.ts
│   ├── guards.fastify.spec.ts
│   └── middlewares.fastify.spec.ts
└── shared/
    ├── decorators.spec.ts
    └── auth-service.spec.ts
```

### Test Commands (using Bun)

```bash
# Test all adapters
bun test

# Test only Express
bun test tests/express/

# Test only Fastify
bun test tests/fastify/
```

## Documentation

### README.md Updates

1. **Remove limitation**: Remove the "only supports Express" note
2. **Add Fastify section**: Document configuration and usage with Fastify
3. **Examples**: Include configuration examples for both adapters
4. **Migration**: Migration guide for existing projects

### New Section: Multi-Adapter Support

```markdown
## Multi-Adapter Support

The library supports both Express and Fastify through automatic detection:

### Express (Default)
```typescript
// main.ts - Express
import { NestFactory } from '@nestjs/core';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  await app.listen(3333);
}
```

### Fastify
```typescript
// main.ts - Fastify
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bodyParser: false }
  );
  await app.listen(3333);
}
```
```

## Implementation Advantages

### 1. **Full Compatibility**
- Existing Express projects continue working without modifications
- All decorators, guards and hooks work on both adapters

### 2. **Automatic Detection**
- No additional configuration required in most cases
- Reduces complexity for the developer

### 3. **Optimized Performance**
- Each adapter optimized for its specific platform
- Fastify: better throughput performance
- Express: larger ecosystem and compatibility

### 4. **Flexibility**
- Allows manual override when necessary
- Support for adapter-specific configurations

### 5. **Maintainability**
- Separate code per adapter facilitates maintenance
- Common interface ensures consistency
- Isolated tests per adapter

## Implementation Timeline

### Phase 1: Base Structure (1-2 weeks)
- [ ] Create base interfaces and types
- [ ] Implement adapter factory
- [ ] Refactor existing Express code

### Phase 2: Fastify Implementation (2-3 weeks)
- [ ] Develop FastifyAdapter
- [ ] Implement specific middlewares
- [ ] Convert Node.js ↔ Fastify handlers

### Phase 3: Integration and Testing (1-2 weeks)
- [ ] Modify AuthModule for multi-adapter support
- [ ] Implement automatic detection
- [ ] Create complete test suite

### Phase 4: Documentation and Release (1 week)
- [ ] Update documentation
- [ ] Create usage examples
- [ ] Prepare release notes
- [ ] Publish beta version

## Technical Considerations

### Known Limitations

1. **Type Conversion**: Differences between Express and Fastify Request/Response
2. **Middlewares**: Some middlewares may need specific adaptation
3. **Plugins**: Fastify plugins may conflict with Better Auth

### Proposed Solutions

1. **Type Adapters**: Convert objects between formats automatically
2. **Middleware Factory**: Create adapter-specific middlewares
3. **Isolation**: Register Better Auth in isolated context

## Conclusion

This implementation will allow nestjs-better-auth to support both Express and Fastify while maintaining full compatibility with existing code. Automatic detection simplifies usage, while modular architecture facilitates maintenance and future extensibility.

The project will continue following Cursor guidelines using Bun as runtime and maintain the simplicity and performance philosophy that characterizes Better Auth.