import { Injectable } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Auth } from 'better-auth';
import { toNodeHandler } from 'better-auth/node';
import { BaseAdapter } from '../types/adapter-types.ts';
import type { AuthModuleOptions } from '../types/adapter-types.ts';
import {
  FastifyAuthRequest,
  FastifyAuthReply,
  FastifyNodeConverter,
} from '../types/fastify-types.ts';

/**
 * Adaptador para integração do Better Auth com Fastify no NestJS
 */
@Injectable()
export class FastifyAdapter extends BaseAdapter {
  constructor(
    protected readonly auth: Auth,
    protected readonly options: AuthModuleOptions
  ) {
    super(auth, options);
  }

  getAdapterType(): 'fastify' {
    return 'fastify';
  }

  setupCors(trustedOrigins: string[]): void {
    // CORS será configurado no setupAuthHandler para Fastify
  }

  setupBodyParser(): void {
    // Body parser será configurado no setupAuthHandler para Fastify
  }

  setupAuthHandler(basePath: string, adapter: HttpAdapterHost): void {
    const fastifyInstance = adapter.getHttpAdapter().getInstance() as any;
    
    this.configureCors(fastifyInstance);
    this.configureBodyParser(fastifyInstance);
    this.configureAuthRoutes(basePath, fastifyInstance);
  }

  private configureCors(fastify: any): void {
    if (this.options.disableTrustedOriginsCors) {
      return;
    }

    const trustedOrigins = this.auth.options.trustedOrigins || [];
    if (trustedOrigins.length === 0) {
      return;
    }

    // Registrar plugin de CORS do Fastify
    fastify.register(async (fastify: any) => {
      fastify.addHook('onRequest', async (request: any, reply: any) => {
        const origin = request.headers.origin;
        if (origin && trustedOrigins.includes(origin)) {
          reply.header('Access-Control-Allow-Origin', origin);
          reply.header('Access-Control-Allow-Credentials', 'true');
          reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        }
      });
    });
  }

  private configureBodyParser(fastify: any): void {
    if (this.options.disableBodyParser) {
      return;
    }

    // Configurar body parser personalizado para Fastify
    fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req: any, body: any, done: any) => {
      const url = req.url || '';
      
      // Ignorar parsing para rotas do Better Auth
      if (url.startsWith(this.auth.options.basePath || '/api/auth')) {
        done(null, body);
        return;
      }

      // Fazer parsing JSON para outras rotas
      try {
        const parsed = JSON.parse(body as string);
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    });

    // Parser para form data
    fastify.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (req: any, body: any, done: any) => {
      const url = req.url || '';
      
      // Ignorar parsing para rotas do Better Auth
      if (url.startsWith(this.auth.options.basePath || '/api/auth')) {
        done(null, body);
        return;
      }

      // Fazer parsing de form data para outras rotas
      try {
        const params = new URLSearchParams(body as string);
        const parsed = Object.fromEntries(params.entries());
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    });
  }

  private configureAuthRoutes(basePath: string, fastify: any): void {
    const authHandler = toNodeHandler(this.auth);
    
    // Registrar todas as rotas do Better Auth
    fastify.register(async (fastify: any) => {
      fastify.all(`${basePath}/*`, async (request: FastifyAuthRequest, reply: FastifyAuthReply) => {
        // Converter requisição e resposta do Fastify para Node.js
        const nodeReq = FastifyNodeConverter.requestToNode(request);
        const nodeRes = FastifyNodeConverter.replyToNode(reply);
        
        // Chamar o handler do Better Auth
        await authHandler(nodeReq, nodeRes);
        
        // Se a resposta não foi enviada, enviar resposta vazia
        if (!reply.sent) {
          reply.code(404).send({ error: 'Not Found' });
        }
      });
    });
  }
}