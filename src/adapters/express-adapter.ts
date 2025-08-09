import { Logger } from '@nestjs/common';
import type { MiddlewareConsumer } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { toNodeHandler } from 'better-auth/node';
import type { Request, Response } from 'express';
import { BaseAdapter } from '../types/adapter-types.ts';
import { SkipBodyParsingMiddleware } from '../middlewares/express/skip-body-parsing.middleware.ts';

/**
 * Express-specific adapter
 * Maintains the original project functionality
 */
export class ExpressAdapter extends BaseAdapter {
	private readonly logger = new Logger(ExpressAdapter.name);

	getAdapterType(): 'express' {
		return 'express';
	}

	configure(consumer: MiddlewareConsumer, adapter: HttpAdapterHost): void {
		const trustedOrigins = this.auth.options.trustedOrigins;
		const isNotFunctionBased = trustedOrigins && Array.isArray(trustedOrigins);

		// Configure CORS if necessary
		if (!this.options.disableTrustedOriginsCors && isNotFunctionBased) {
			this.setupCors(trustedOrigins);
		} else if (
			trustedOrigins &&
			!this.options.disableTrustedOriginsCors &&
			!isNotFunctionBased
		) {
			throw new Error(
				'Function-based trustedOrigins not supported in NestJS. Use string array or disable CORS with disableTrustedOriginsCors: true.',
			);
		}

		// Configure body parser
		if (!this.options.disableBodyParser) {
			consumer.apply(SkipBodyParsingMiddleware).forRoutes('*path');
		}

		// Configure authentication handler
		this.setupAuthHandler(this.getBasePath(), adapter);
	}

	setupCors(trustedOrigins: string[]): void {
		// This implementation will be called by configure when needed
		// The actual CORS configuration is done in HttpAdapterHost
	}

	setupBodyParser(): void {
		// Body parser is configured via middleware in Express
		// The actual implementation is in SkipBodyParsingMiddleware
	}

	setupAuthHandler(basePath: string, adapter: HttpAdapterHost): void {
		const authHandler = toNodeHandler(this.auth);
		
		adapter.httpAdapter
			.getInstance()
			// little hack to ignore any global prefix
			// for now i'll just not support a global prefix
			.use(`${basePath}/*path`, (req: Request, res: Response) => {
				req.url = req.originalUrl;
				return authHandler(req, res);
			});

		this.logger.log(`Express adapter initialized BetterAuth on '${basePath}/*'`);
	}
}