import { Inject, Logger, Module } from "@nestjs/common";
import type {
	DynamicModule,
	MiddlewareConsumer,
	NestModule,
	OnModuleInit,
	Provider,
} from "@nestjs/common";
import {
	APP_FILTER,
	DiscoveryModule,
	DiscoveryService,
	HttpAdapterHost,
	MetadataScanner,
} from "@nestjs/core";
import type { betterAuth } from "better-auth";

type Auth = ReturnType<typeof betterAuth>;
import { createAuthMiddleware } from "better-auth/plugins";
import { APIErrorExceptionFilter } from "./api-error-exception-filter.ts";
import { AuthService } from "./auth-service.ts";
import { AdapterFactory } from "./adapters/adapter-factory.ts";
import type { AuthModuleOptions, HttpAdapterStrategy } from "./types/adapter-types.ts";
import {
	AFTER_HOOK_KEY,
	AUTH_INSTANCE_KEY,
	AUTH_MODULE_OPTIONS_KEY,
	BEFORE_HOOK_KEY,
	HOOK_KEY,
} from "./symbols.ts";

// AuthModuleOptions agora é importado de types/adapter-types.ts

const HOOKS = [
	{ metadataKey: BEFORE_HOOK_KEY, hookType: "before" as const },
	{ metadataKey: AFTER_HOOK_KEY, hookType: "after" as const },
];

/**
 * NestJS module that integrates the Auth library with NestJS applications.
 * Provides authentication middleware, hooks, and exception handling.
 */
@Module({
	imports: [DiscoveryModule],
})
export class AuthModule implements NestModule, OnModuleInit {
	private readonly logger = new Logger(AuthModule.name);
	private adapterStrategy: HttpAdapterStrategy;

	constructor(
		@Inject(AUTH_INSTANCE_KEY) private readonly auth: Auth,
		@Inject(DiscoveryService)
		private readonly discoveryService: DiscoveryService,
		@Inject(MetadataScanner)
		private readonly metadataScanner: MetadataScanner,
		@Inject(HttpAdapterHost)
		private readonly adapter: HttpAdapterHost,
		@Inject(AUTH_MODULE_OPTIONS_KEY)
		private readonly options: AuthModuleOptions,
	) {
		// Automatic or manual adapter detection
		const adapterType = this.options.adapter || AdapterFactory.detectAdapterType(this.adapter.httpAdapter);
		this.adapterStrategy = AdapterFactory.create(adapterType, this.auth, this.options);
		
		this.logger.log(`Using ${adapterType} adapter for Better Auth integration`);
	}

	onModuleInit(): void {
		// Setup hooks
		if (!this.auth.options.hooks) return;

		const providers = this.discoveryService
			.getProviders()
			.filter(
				({ metatype }) => metatype && Reflect.getMetadata(HOOK_KEY, metatype),
			);

		for (const provider of providers) {
			const providerPrototype = Object.getPrototypeOf(provider.instance);
			const methods = this.metadataScanner.getAllMethodNames(providerPrototype);

			for (const method of methods) {
				const providerMethod = providerPrototype[method];
				this.setupHooks(providerMethod, provider.instance);
			}
		}
	}

	configure(consumer: MiddlewareConsumer): void {
		// Configure CORS if necessary
		const trustedOrigins = this.auth.options.trustedOrigins;
		const isNotFunctionBased = trustedOrigins && Array.isArray(trustedOrigins);

		if (!this.options.disableTrustedOriginsCors && isNotFunctionBased) {
			this.adapter.httpAdapter.enableCors({
				origin: trustedOrigins,
				methods: ["GET", "POST", "PUT", "DELETE"],
				credentials: true,
			});
		}

		// Delegate configuration to specific adapter
		this.adapterStrategy.configure(consumer, this.adapter);
	}

	private setupHooks(
		providerMethod: (...args: unknown[]) => unknown,
		providerClass: { new (...args: unknown[]): unknown },
	) {
		if (!this.auth.options.hooks) return;

		for (const { metadataKey, hookType } of HOOKS) {
			const hookPath = Reflect.getMetadata(metadataKey, providerMethod);
			if (!hookPath) continue;

			const originalHook = this.auth.options.hooks[hookType];
			this.auth.options.hooks[hookType] = createAuthMiddleware(async (ctx) => {
				if (originalHook) {
					await originalHook(ctx);
				}

				if (hookPath === ctx.path) {
					await providerMethod.apply(providerClass, [ctx]);
				}
			});
		}
	}

	/**
	 * Static factory method to create and configure the AuthModule.
	 * @param auth - The Auth instance to use
	 * @param options - Configuration options for the module
	 */
	static forRoot(
		// biome-ignore lint/suspicious/noExplicitAny: i still need to find a type for the auth instance
		auth: any,
		options: AuthModuleOptions = {},
	): DynamicModule {
		// Initialize hooks with an empty object if undefined
		// Without this initialization, the setupHook method won't be able to properly override hooks
		// It won't throw an error, but any hook functions we try to add won't be called
		auth.options.hooks = {
			...auth.options.hooks,
		};

		const providers: Provider[] = [
			{
				provide: AUTH_INSTANCE_KEY,
				useValue: auth,
			},
			{
				provide: AUTH_MODULE_OPTIONS_KEY,
				useValue: options,
			},
			AuthService,
		];

		if (!options.disableExceptionFilter) {
			providers.push({
				provide: APP_FILTER,
				useClass: APIErrorExceptionFilter,
			});
		}

		return {
			global: true,
			module: AuthModule,
			providers: providers,
			exports: [
				{
					provide: AUTH_INSTANCE_KEY,
					useValue: auth,
				},
				{
					provide: AUTH_MODULE_OPTIONS_KEY,
					useValue: options,
				},
				AuthService,
			],
		};
	}
}
