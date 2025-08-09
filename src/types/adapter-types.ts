import type { MiddlewareConsumer } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import type { betterAuth } from 'better-auth';

type Auth = ReturnType<typeof betterAuth>;

/**
 * Configuration options for the AuthModule
 */
export type AuthModuleOptions = {
  adapter?: 'express' | 'fastify'; // Allows manual override
  auth?: any;
  disableExceptionFilter?: boolean;
  disableTrustedOriginsCors?: boolean;
  disableBodyParser?: boolean;
};

/**
 * Common interface for HTTP adapter strategies
 */
export interface HttpAdapterStrategy {
  configure(consumer: MiddlewareConsumer, adapter: HttpAdapterHost): void;
  setupCors(trustedOrigins: string[]): void;
  setupBodyParser(): void;
  setupAuthHandler(basePath: string, adapter: HttpAdapterHost): void;
  getAdapterType(): 'express' | 'fastify';
}

/**
 * Abstract base class for HTTP adapters
 */
export abstract class BaseAdapter implements HttpAdapterStrategy {
  constructor(
    protected readonly auth: Auth,
    protected readonly options: AuthModuleOptions
  ) {}

  abstract configure(
    consumer: MiddlewareConsumer,
    adapter: HttpAdapterHost
  ): void;
  abstract setupAuthHandler(basePath: string, adapter: HttpAdapterHost): void;
  abstract getAdapterType(): 'express' | 'fastify';

  /**
   * Gets the basePath from auth configuration
   */
  protected getBasePath(): string {
    let basePath = this.auth.options.basePath ?? '/api/auth';

    // Ensure basePath starts with /
    if (!basePath.startsWith('/')) {
      basePath = `/${basePath}`;
    }

    // Ensure basePath doesn't end with /
    if (basePath.endsWith('/')) {
      basePath = basePath.slice(0, -1);
    }

    return basePath;
  }

  /**
   * Common CORS configuration
   */
  setupCors(trustedOrigins: string[]): void {
    // Common implementation will be done in specific adapters
    // as each one has its own way of configuring CORS
  }

  /**
   * Body parser configuration - adapter-specific implementation
   */
  abstract setupBodyParser(): void;
}
