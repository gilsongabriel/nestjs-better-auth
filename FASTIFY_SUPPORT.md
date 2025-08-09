# Plano de Implementação: Suporte ao Fastify

## Análise do Projeto Atual

O projeto **nestjs-better-auth** é uma biblioteca de integração do Better Auth com NestJS que atualmente:

- **Suporta apenas Express** (conforme documentado no README)
- Usa middlewares específicos do Express (`SkipBodyParsingMiddleware`)
- Implementa handlers usando `toNodeHandler` do Better Auth
- Utiliza Bun como runtime conforme as regras do Cursor
- Possui arquitetura modular com guards, decorators e hooks

## Objetivo

Implementar suporte ao Fastify mantendo total compatibilidade com Express, permitindo alternância automática ou manual entre os dois adaptadores HTTP.

## Estratégia de Implementação

### 1. Detecção Automática do Adaptador

```typescript
// Detectar automaticamente o adaptador HTTP usado
const adapterType = this.adapter.httpAdapter.getType(); // 'express' | 'fastify'
```

A detecção será feita através do `HttpAdapterHost` do NestJS, que já fornece informações sobre o tipo de adaptador em uso.

### 2. Estrutura de Arquivos Proposta

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
  
  // Implementações comuns
  setupCors(trustedOrigins: string[]): void {
    // Lógica comum de CORS
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
    // Mantém a implementação atual
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
    
    // Registrar plugin de body parser personalizado
    fastifyInstance.register(async (fastify) => {
      fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, 
        (req, body, done) => {
          if (req.url?.startsWith('/api/auth')) {
            // Pular parsing para rotas do Better Auth
            done(null, body);
          } else {
            // Parse normal para outras rotas
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
    
    // Registrar rota wildcard para Better Auth
    fastifyInstance.register(async (fastify) => {
      fastify.all(`${basePath}/*`, async (request, reply) => {
        // Converter request/reply do Fastify para Node.js
        const nodeReq = this.convertFastifyRequestToNode(request);
        const nodeRes = this.convertFastifyReplyToNode(reply);
        
        return handler(nodeReq, nodeRes);
      });
    });
  }

  private convertFastifyRequestToNode(request: FastifyRequest): any {
    // Implementar conversão de FastifyRequest para Node.js Request
    return {
      ...request.raw,
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: request.body
    };
  }

  private convertFastifyReplyToNode(reply: FastifyReply): any {
    // Implementar conversão de FastifyReply para Node.js Response
    return {
      ...reply.raw,
      status: (code: number) => reply.status(code),
      json: (data: any) => reply.send(data),
      send: (data: any) => reply.send(data)
    };
  }
}
```

### 6. Factory para Criação de Adaptadores

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

### 7. Modificações no AuthModule

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
    // Detecção automática ou manual do adaptador
    const adapterType = this.options.adapter || this.adapter.httpAdapter.getType();
    this.adapterStrategy = AdapterFactory.create(adapterType, this.auth, this.options);
    
    this.logger.log(`Using ${adapterType} adapter for Better Auth integration`);
  }

  configure(consumer: MiddlewareConsumer): void {
    this.adapterStrategy.configure(consumer, this.adapter);
  }

  // ... resto da implementação permanece igual
}
```

### 8. Atualização dos Tipos de Configuração

```typescript
type AuthModuleOptions = {
  adapter?: 'express' | 'fastify'; // Permite override manual
  disableExceptionFilter?: boolean;
  disableTrustedOriginsCors?: boolean;
  disableBodyParser?: boolean;
};
```

### 9. Atualização do package.json

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

## Configuração e Uso

### Detecção Automática (Recomendado)

```typescript
// app.module.ts
@Module({
  imports: [
    AuthModule.forRoot(auth), // Detecta automaticamente Express ou Fastify
  ],
})
export class AppModule {}
```

### Configuração Manual

```typescript
// app.module.ts
@Module({
  imports: [
    AuthModule.forRoot(auth, {
      adapter: 'fastify', // ou 'express'
      // ... outras opções
    }),
  ],
})
export class AppModule {}
```

### Exemplo com Fastify

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bodyParser: false } // Importante: desabilitar body parser
  );
  
  await app.listen(process.env.PORT ?? 3333);
}
bootstrap();
```

## Testes e Validação

### Estrutura de Testes

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

### Comandos de Teste (usando Bun)

```bash
# Testar todos os adaptadores
bun test

# Testar apenas Express
bun test tests/express/

# Testar apenas Fastify
bun test tests/fastify/
```

## Documentação

### Atualizações no README.md

1. **Remover limitação**: Remover a nota "only supports Express"
2. **Adicionar seção Fastify**: Documentar configuração e uso com Fastify
3. **Exemplos**: Incluir exemplos de configuração para ambos os adaptadores
4. **Migração**: Guia de migração para projetos existentes

### Nova Seção: Suporte Multi-Adaptador

```markdown
## Suporte Multi-Adaptador

A biblioteca suporta tanto Express quanto Fastify através de detecção automática:

### Express (Padrão)
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

## Vantagens da Implementação

### 1. **Compatibilidade Total**
- Projetos Express existentes continuam funcionando sem modificações
- Todos os decorators, guards e hooks funcionam em ambos os adaptadores

### 2. **Detecção Automática**
- Não requer configuração adicional na maioria dos casos
- Reduz complexidade para o desenvolvedor

### 3. **Performance Otimizada**
- Cada adaptador otimizado para sua plataforma específica
- Fastify: melhor performance em throughput
- Express: maior ecossistema e compatibilidade

### 4. **Flexibilidade**
- Permite override manual quando necessário
- Suporte a configurações específicas por adaptador

### 5. **Manutenibilidade**
- Código separado por adaptador facilita manutenção
- Interface comum garante consistência
- Testes isolados por adaptador

## Cronograma de Implementação

### Fase 1: Estrutura Base (1-2 semanas)
- [ ] Criar interfaces e tipos base
- [ ] Implementar factory de adaptadores
- [ ] Refatorar código Express existente

### Fase 2: Implementação Fastify (2-3 semanas)
- [ ] Desenvolver FastifyAdapter
- [ ] Implementar middlewares específicos
- [ ] Converter handlers Node.js ↔ Fastify

### Fase 3: Integração e Testes (1-2 semanas)
- [ ] Modificar AuthModule para suporte multi-adaptador
- [ ] Implementar detecção automática
- [ ] Criar suite de testes completa

### Fase 4: Documentação e Release (1 semana)
- [ ] Atualizar documentação
- [ ] Criar exemplos de uso
- [ ] Preparar release notes
- [ ] Publicar versão beta

## Considerações Técnicas

### Limitações Conhecidas

1. **Conversão de Tipos**: Diferenças entre Request/Response do Express e Fastify
2. **Middlewares**: Alguns middlewares podem precisar de adaptação específica
3. **Plugins**: Plugins do Fastify podem conflitar com Better Auth

### Soluções Propostas

1. **Adaptadores de Tipo**: Converter objetos entre formatos automaticamente
2. **Middleware Factory**: Criar middlewares específicos por adaptador
3. **Isolamento**: Registrar Better Auth em contexto isolado

## Conclusão

Esta implementação permitirá que o nestjs-better-auth suporte tanto Express quanto Fastify mantendo total compatibilidade com código existente. A detecção automática simplifica o uso, enquanto a arquitetura modular facilita manutenção e extensibilidade futura.

O projeto continuará seguindo as diretrizes do Cursor usando Bun como runtime e manterá a filosofia de simplicidade e performance que caracteriza o Better Auth.