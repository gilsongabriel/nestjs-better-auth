import type { betterAuth } from 'better-auth';

type Auth = ReturnType<typeof betterAuth>;
import type { AuthModuleOptions, HttpAdapterStrategy } from '../types/adapter-types.ts';
import { ExpressAdapter } from './express-adapter.ts';
import { FastifyAdapter } from './fastify-adapter.ts';

/**
 * Factory to create HTTP adapters based on detected or configured type
 */
export class AdapterFactory {
	/**
	 * Creates the appropriate adapter based on the specified type
	 * @param adapterType - Adapter type ('express' | 'fastify')
	 * @param auth - Better Auth instance
	 * @param options - Module configuration options
	 * @returns Appropriate adapter instance
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
	 * Automatically detects the adapter type based on HttpAdapterHost
	 * @param httpAdapter - NestJS HTTP adapter instance
	 * @returns Detected adapter type
	 */
	static detectAdapterType(httpAdapter: any): 'express' | 'fastify' {
		// Try to detect based on adapter type
		if (httpAdapter && typeof httpAdapter.getType === 'function') {
			const type = httpAdapter.getType();
			if (type === 'express' || type === 'fastify') {
				return type;
			}
		}

		// Fallback: detect based on instance
		const instance = httpAdapter?.getInstance?.();
		if (instance) {
			// Check if it's a Fastify instance
			if (instance.register && instance.route && instance.addHook) {
				return 'fastify';
			}
			// Check if it's an Express instance
			if (instance.use && instance.get && instance.post) {
				return 'express';
			}
		}

		// Default to Express if unable to detect
		return 'express';
	}

	/**
	 * Validates if the specified adapter is supported
	 * @param adapterType - Adapter type to be validated
	 * @returns true if supported, false otherwise
	 */
	static isSupported(adapterType: string): boolean {
		return ['express', 'fastify'].includes(adapterType.toLowerCase());
	}

	/**
	 * Returns list of supported adapters
	 * @returns Array with supported adapter types
	 */
	static getSupportedAdapters(): string[] {
		return ['express', 'fastify'];
	}
}