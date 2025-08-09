import type { Auth } from 'better-auth';
import type { AuthModuleOptions, HttpAdapterStrategy } from '../types/adapter-types.ts';
import { ExpressAdapter } from './express-adapter.ts';
import { FastifyAdapter } from './fastify-adapter.ts';

/**
 * Factory para criar adaptadores HTTP baseado no tipo detectado ou configurado
 */
export class AdapterFactory {
	/**
	 * Cria o adaptador apropriado baseado no tipo especificado
	 * @param adapterType - Tipo do adaptador ('express' | 'fastify')
	 * @param auth - Instância do Better Auth
	 * @param options - Opções de configuração do módulo
	 * @returns Instância do adaptador apropriado
	 */
	static create(
		adapterType: string,
		auth: Auth,
		options: AuthModuleOptions,
	): HttpAdapterStrategy {
		switch (adapterType.toLowerCase()) {
			case 'express':
				return new ExpressAdapter(auth, options);
			case 'fastify':
				return new FastifyAdapter(auth, options);
			default:
				throw new Error(
					`Unsupported HTTP adapter type: ${adapterType}. Supported types: 'express', 'fastify'`,
				);
		}
	}

	/**
	 * Detecta automaticamente o tipo de adaptador baseado no HttpAdapterHost
	 * @param httpAdapter - Instância do adaptador HTTP do NestJS
	 * @returns Tipo do adaptador detectado
	 */
	static detectAdapterType(httpAdapter: any): 'express' | 'fastify' {
		// Tentar detectar baseado no tipo do adaptador
		if (httpAdapter && typeof httpAdapter.getType === 'function') {
			const type = httpAdapter.getType();
			if (type === 'express' || type === 'fastify') {
				return type;
			}
		}

		// Fallback: detectar baseado na instância
		const instance = httpAdapter?.getInstance?.();
		if (instance) {
			// Verificar se é uma instância do Fastify
			if (instance.register && instance.route && instance.addHook) {
				return 'fastify';
			}
			// Verificar se é uma instância do Express
			if (instance.use && instance.get && instance.post) {
				return 'express';
			}
		}

		// Default para Express se não conseguir detectar
		return 'express';
	}

	/**
	 * Valida se o adaptador especificado é suportado
	 * @param adapterType - Tipo do adaptador a ser validado
	 * @returns true se suportado, false caso contrário
	 */
	static isSupported(adapterType: string): boolean {
		return ['express', 'fastify'].includes(adapterType.toLowerCase());
	}

	/**
	 * Retorna lista de adaptadores suportados
	 * @returns Array com os tipos de adaptadores suportados
	 */
	static getSupportedAdapters(): string[] {
		return ['express', 'fastify'];
	}
}