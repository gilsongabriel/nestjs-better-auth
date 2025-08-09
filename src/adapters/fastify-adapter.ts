import { Injectable, Logger } from '@nestjs/common';
import type { MiddlewareConsumer } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { betterAuth } from 'better-auth';

type Auth = ReturnType<typeof betterAuth>;
import { toNodeHandler } from 'better-auth/node';
import { BaseAdapter } from '../types/adapter-types.ts';
import type { AuthModuleOptions } from '../types/adapter-types.ts';
import {
  FastifyAuthRequest,
  FastifyAuthReply,
  FastifyNodeConverter,
} from '../types/fastify-types.ts';

/**
 * Adapter for Better Auth integration with Fastify in NestJS
 */
@Injectable()
export class FastifyAdapter extends BaseAdapter {
  private readonly logger = new Logger(FastifyAdapter.name);

  constructor(
    protected readonly auth: Auth,
    protected readonly options: AuthModuleOptions
  ) {
    super(auth, options);
  }

  getAdapterType(): 'fastify' {
    return 'fastify';
  }

  configure(consumer: MiddlewareConsumer, adapter: HttpAdapterHost): void {
    const trustedOrigins = this.auth.options.trustedOrigins;
    const isNotFunctionBased = trustedOrigins && Array.isArray(trustedOrigins);

    // Configure CORS if necessary
    if (!this.options.disableTrustedOriginsCors && isNotFunctionBased) {
      this.setupCors(trustedOrigins as string[]);
    } else if (
      trustedOrigins &&
      !this.options.disableTrustedOriginsCors &&
      !isNotFunctionBased
    ) {
      throw new Error(
        'Function-based trustedOrigins not supported in NestJS. Use string array or disable CORS with disableTrustedOriginsCors: true.',
      );
    }

    // Configure authentication handler
    this.setupAuthHandler(this.getBasePath(), adapter);
  }

  setupCors(trustedOrigins: string[]): void {
    // CORS will be configured in setupAuthHandler for Fastify
  }

  setupBodyParser(): void {
    // Body parser will be configured in setupAuthHandler for Fastify
  }

  setupAuthHandler(basePath: string, adapter: HttpAdapterHost): void {
    const fastifyInstance = adapter.httpAdapter.getInstance() as any;

    this.configureCors(fastifyInstance);
    this.configureBodyParser(fastifyInstance);
    this.configureAuthRoutes(basePath, fastifyInstance);
  }

  private configureCors(fastify: any): void {
    if (this.options.disableTrustedOriginsCors) {
      return;
    }

    const trustedOrigins = this.auth.options.trustedOrigins;
    if (!trustedOrigins || !Array.isArray(trustedOrigins) || trustedOrigins.length === 0) {
      return;
    }

    // Register Fastify CORS plugin
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

    // Configure custom body parser for Fastify
    fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req: any, body: any, done: any) => {
      const url = req.url || '';
      
      // Skip parsing for Better Auth routes
      if (url.startsWith(this.auth.options.basePath || '/api/auth')) {
        done(null, body);
        return;
      }

      // Parse JSON for other routes
      try {
        const parsed = JSON.parse(body as string);
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    });

    // Parser for form data
    fastify.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (req: any, body: any, done: any) => {
      const url = req.url || '';
      
      // Skip parsing for Better Auth routes
      if (url.startsWith(this.auth.options.basePath || '/api/auth')) {
        done(null, body);
        return;
      }

      // Parse form data for other routes
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
    
    // Register all Better Auth routes
    fastify.register(async (fastify: any) => {
      fastify.all(`${basePath}/*`, async (request: FastifyAuthRequest, reply: FastifyAuthReply) => {
        try {
          // Use the raw Node.js request/response objects directly
          const nodeRequest = request.raw;
          const nodeResponse = reply.raw;
          
          // Call Better Auth handler
          await authHandler(nodeRequest, nodeResponse);
        } catch (error) {
          this.logger.error('Auth handler error:', error);
          reply.code(500).send({ error: 'Internal server error' });
        }
      });
    });

    this.logger.log(`Fastify adapter initialized BetterAuth on '${basePath}/*'`);
  }
}