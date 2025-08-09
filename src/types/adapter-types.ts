import type { MiddlewareConsumer } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import type { Auth } from 'better-auth';

/**
 * Configuration options for the AuthModule
 */
export type AuthModuleOptions = {
	adapter?: 'express' | 'fastify'; // Permite override manual
	disableExceptionFilter?: boolean;
	disableTrustedOriginsCors?: boolean;
	disableBodyParser?: boolean;
};

/**
 * Interface comum para estratégias de adaptadores HTTP
 */
export interface HttpAdapterStrategy {
	configure(consumer: MiddlewareConsumer, adapter: HttpAdapterHost): void;
	setupCors(trustedOrigins: string[]): void;
	setupBodyParser(): void;
	setupAuthHandler(basePath: string, adapter: HttpAdapterHost): void;
	getAdapterType(): 'express' | 'fastify';
}

/**
 * Classe base abstrata para adaptadores HTTP
 */
export abstract class BaseAdapter implements HttpAdapterStrategy {
	constructor(
		protected readonly auth: Auth,
		protected readonly options: AuthModuleOptions,
	) {}

	abstract configure(consumer: MiddlewareConsumer, adapter: HttpAdapterHost): void;
	abstract setupAuthHandler(basePath: string, adapter: HttpAdapterHost): void;
	abstract getAdapterType(): 'express' | 'fastify';

	/**
	 * Obtém o basePath da configuração do auth
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
	 * Configuração comum de CORS
	 */
	setupCors(trustedOrigins: string[]): void {
		// Implementação comum será feita nos adaptadores específicos
		// pois cada um tem sua própria forma de configurar CORS
	}

	/**
	 * Configuração de body parser - implementação específica por adaptador
	 */
	abstract setupBodyParser(): void;
}