/**
 * 🔧 Advanced Configuration Example for nestjs-better-auth
 * 
 * This file demonstrates all available configuration options
 * for Better Auth integration with NestJS, including specific
 * configurations for Express and Fastify.
 */

import { Body, Controller, Get, Module, Post, UseGuards } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { betterAuth } from 'better-auth';
import { emailOTP, twoFactor } from 'better-auth/plugins';
import { AuthGuard, AuthModule, Session } from '../src/index.ts';

// Custom type for user session
type UserSession = typeof Session & {
  user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
    role?: string;
    twoFactorEnabled?: boolean;
    createdAt: Date;
  };
} & {
  id: any;
  createdAt: any;
  expiresAt: any;
  ipAddress: any;
  userAgent: any;
};

// 🔐 Advanced Better Auth Configuration
const auth = betterAuth({
  // Database configuration (using in-memory for example)
  database: {
    provider: 'sqlite',
    url: ':memory:',
  },

  // Custom base path configuration
  basePath: '/api/v1/auth',

  // Trusted origins configuration
  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://myapp.com',
    'https://admin.myapp.com',
  ],

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 dias
    updateAge: 60 * 60 * 24, // 1 dia
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutos
    },
  },

  // Cookies configuration
  cookies: {
    sessionToken: {
      name: 'better-auth.session-token',
      attributes: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 dias
      },
    },
  },

  // Email and password configuration
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  // Email verification configuration
  emailVerification: {
    sendOnSignUp: true,
    expiresIn: 60 * 60 * 24, // 24 horas
    sendVerificationEmail: async (data: any, request: any) => {
      // Implement custom email sending
      console.log('📧 Sending verification email to:', data.user.email);
      console.log('🔗 Verification link:', data.url);
      // Here you would integrate with your email provider (SendGrid, AWS SES, etc.)
    },
  },

  // Password reset configuration
  forgetPassword: {
    expiresIn: 60 * 60 * 2, // 2 horas
    sendResetPassword: async (data: any, request: any) => {
      // Implement custom reset email sending
      console.log('🔄 Sending reset email to:', data.user.email);
      console.log('🔗 Reset link:', data.url);
    },
  },

  // Advanced plugins
  plugins: [
    // Email OTP plugin
    emailOTP({
      expiresIn: 60 * 10, // 10 minutos
      sendVerificationOTP: async (data: any, request: any) => {
        console.log('📱 Sending OTP to:', data.user.email);
        console.log('🔢 OTP code:', data.otp);
      },
    }),

    // Two-factor authentication plugin
    twoFactor({
      issuer: 'MyApp',
      otpOptions: {
        period: 30,
        digits: 6,
      },
    }),
  ],

  // Rate limiting configuration
  rateLimit: {
    window: 60, // 1 minuto
    max: 100, // 100 requests por minuto
    storage: 'memory', // ou 'redis' para produção
  },

  // Logging configuration
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    disabled: false,
  },

  // Advanced security configuration
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
      domain: '.myapp.com',
    },
    useSecureCookies: process.env.NODE_ENV === 'production',
    generateId: () => {
      // Custom ID generator
      return crypto.randomUUID();
    },
  },
});

// 🎯 Controller with Advanced Features
@Controller()
export class AdvancedController {
  @Get('public')
  getPublic(): { message: string; timestamp: string } {
    return {
      message: 'Public endpoint - free access',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('protected')
  @UseGuards(AuthGuard)
  getProtected(@Session() session: UserSession): {
    message: string;
    user: any;
    sessionInfo: any;
  } {
    return {
      message: 'Protected endpoint - authenticated user',
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        emailVerified: session.user.emailVerified,
        twoFactorEnabled: session.user.twoFactorEnabled,
      },
      sessionInfo: {
        id: session.id,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      },
    };
  }

  @Get('admin')
  @UseGuards(AuthGuard)
  getAdmin(@Session() session: UserSession): any {
    // Check if user has admin permissions
    // (this would be implemented based on your business logic)
    const isAdmin = session.user.role === 'admin';
    
    if (!isAdmin) {
      throw new Error('Access denied: administrator permissions required');
    }
    
    return {
      message: 'Administrative area - restricted access',
      user: session.user,
      permissions: ['read', 'write', 'delete', 'admin'],
    };
  }

  @Post('update-profile')
  @UseGuards(AuthGuard)
  updateProfile(
    @Session() session: UserSession,
    @Body() updateData: { name?: string; bio?: string }
  ): { message: string; updatedFields: string[] } {
    // Here you would implement the profile update logic
    const updatedFields = Object.keys(updateData);
    
    console.log(`Updating user profile ${session.user.id}:`, updateData);
    
    return {
      message: 'Profile updated successfully',
      updatedFields,
    };
  }

  @Get('session-info')
  @UseGuards(AuthGuard)
  getSessionInfo(@Session() session: UserSession): {
    session: any;
    security: any;
  } {
    return {
      session: {
        id: session.id,
        userId: session.user.id,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      },
      security: {
        twoFactorEnabled: session.user.twoFactorEnabled,
        emailVerified: session.user.emailVerified,
        lastSignIn: session.user.createdAt,
      },
    };
  }
}

// 📦 Module with Advanced Configuration
@Module({
  imports: [
    AuthModule.forRoot({
      auth,
      // NestJS-specific configurations
      disableBodyParser: true, // Let Better Auth manage body parsing
      disableTrustedOriginsCors: false, // Enable CORS for trusted origins
      disableExceptionFilter: false, // Enable custom exception filter

      // Additional configurations (if implemented)
      // customErrorHandler: (error, request, response) => {
      //   // Custom error handler
      // },
      // customLogger: (level, message, meta) => {
      //   // Custom logger
      // },
    }),
  ],
  controllers: [AdvancedController],
})
export class AdvancedAppModule {}

// 🚀 Bootstrap with Advanced Configuration for Express
async function bootstrapExpress(): Promise<void> {
  const app = await NestFactory.create(AdvancedAppModule, {
    bodyParser: false, // Important: disable NestJS body parser
    logger: ['error', 'warn', 'log', 'debug'], // Detailed logs
    cors: false, // Disable NestJS CORS (Better Auth manages it)
  });

  // Advanced CORS configuration
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void
    ) => {
      // Custom origin validation logic
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://myapp.com',
        'https://admin.myapp.com',
      ];

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'],
  });

  // Additional security middleware
  app.use((req: any, res: any, next: any) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Request logging (in development)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`${req.method} ${req.url} - ${req.ip}`);
    }

    next();
  });

  await app.listen(3001);
  console.log(
    '🚀 Express app with advanced configuration running on http://localhost:3001'
  );
  console.log('🔐 Auth endpoints at http://localhost:3001/api/v1/auth/*');
  console.log('📊 Available endpoints:');
  console.log('  - GET /public (public)');
  console.log('  - GET /protected (authenticated)');
  console.log('  - GET /admin (admin)');
  console.log('  - POST /update-profile (authenticated)');
  console.log('  - GET /session-info (authenticated)');
}

// 🚀 Bootstrap with Advanced Configuration for Fastify
async function bootstrapFastify(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AdvancedAppModule,
    new FastifyAdapter({
      logger: {
        level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
      },
      disableRequestLogging: false,
      trustProxy: true, // For production with reverse proxy
      bodyLimit: 1048576, // 1MB limit
      keepAliveTimeout: 5000,
    }),
    {
      bodyParser: false, // Importante: desabilitar body parser do NestJS
      logger: ['error', 'warn', 'log', 'debug'],
    }
  );

  // Register Fastify security plugins
  await app.register(require('@fastify/helmet'), {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  // Rate limiting plugin
  await app.register(require('@fastify/rate-limit'), {
    max: 100, // 100 requests
    timeWindow: '1 minute',
    cache: 10000, // Cache de 10k entries
  });

  // Compression plugin
  await app.register(require('@fastify/compress'), {
    encodings: ['gzip', 'deflate'],
  });

  await app.listen({ port: 3002, host: '0.0.0.0' });
  console.log(
    '🚀 Fastify app with advanced configuration running on http://localhost:3002'
  );
  console.log('🔐 Auth endpoints at http://localhost:3002/api/v1/auth/*');
  console.log('📊 Available endpoints:');
  console.log('  - GET /public (public)');
  console.log('  - GET /protected (authenticated)');
  console.log('  - GET /admin (admin)');
  console.log('  - POST /update-profile (authenticated)');
  console.log('  - GET /session-info (authenticated)');
}

// 🎯 Execute based on environment variable
const adapter = process.env.ADAPTER || 'express';

if (adapter === 'fastify') {
  bootstrapFastify().catch((error: Error) => {
    console.error('❌ Error starting Fastify application:', error);
    process.exit(1);
  });
} else {
  bootstrapExpress().catch((error: Error) => {
    console.error('❌ Error starting Express application:', error);
    process.exit(1);
  });
}

// 💡 To run:
// ADAPTER=express bun run examples/advanced-config.ts
// ADAPTER=fastify bun run examples/advanced-config.ts
