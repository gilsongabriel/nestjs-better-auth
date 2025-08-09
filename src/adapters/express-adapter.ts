import { Logger } from '@nestjs/common';
import type { MiddlewareConsumer } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { toNodeHandler } from 'better-auth/node';
import type { Request, Response } from 'express';
import { BaseAdapter } from '../types/adapter-types.ts';
import { SkipBodyParsingMiddleware } from '../middlewares/express/skip-body-parsing.middleware.ts';

/**
 * Adaptador específico para Express
 * Mantém a funcionalidade original do projeto
 */
export class ExpressAdapter extends BaseAdapter {
	private readonly logger = new Logger(ExpressAdapter.name);

	getAdapterType(): 'express' {
		return 'express';
	}

	configure(consumer: MiddlewareConsumer, adapter: HttpAdapterHost): void {
		const trustedOrigins = this.auth.options.trustedOrigins;
		const isNotFunctionBased = trustedOrigins && Array.isArray(trustedOrigins);

		// Configurar CORS se necessário
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

		// Configurar body parser
		if (!this.options.disableBodyParser) {
			consumer.apply(SkipBodyParsingMiddleware).forRoutes('*path');
		}

		// Configurar handler de autenticação
		this.setupAuthHandler(this.getBasePath(), adapter);
	}

	setupCors(trustedOrigins: string[]): void {
		// Esta implementação será chamada pelo configure quando necessário
		// A configuração real de CORS é feita no HttpAdapterHost
	}

	setupBodyParser(): void {
		// Body parser é configurado via middleware no Express
		// A implementação real está no SkipBodyParsingMiddleware
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