/**
 * Example usage of nestjs-better-auth with Express
 * 
 * This example demonstrates how to configure a NestJS application
 * using Express as HTTP adapter with Better Auth
 */

import { NestFactory } from '@nestjs/core';
import { Module, Controller, Get, UseGuards } from '@nestjs/common';
import { AuthModule, AuthGuard, Session, UserSession } from '@thallesp/nestjs-better-auth';
import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';
import type { INestApplication } from '@nestjs/common';

// Better Auth configuration
const auth = betterAuth({
  database: {
    provider: 'sqlite',
    url: './db.sqlite',
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        console.log(`Sending ${type} OTP to ${email}: ${otp}`);
      },
    }),
  ],
  trustedOrigins: ['http://localhost:3000'],
});

// Example controller
@Controller('api')
export class AppController {
  @Get('public')
  getPublic(): { message: string } {
    return { message: 'This is a public endpoint' };
  }

  @Get('protected')
  @UseGuards(AuthGuard)
  getProtected(@Session() session: UserSession): { message: string; user: any } {
    return {
      message: 'This is a protected endpoint',
      user: session.user,
    };
  }

  @Get('profile')
  @UseGuards(AuthGuard)
  getProfile(@Session() session: UserSession): { id: string; email: string; name: string; createdAt: Date } {
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      createdAt: session.user.createdAt,
    };
  }
}

// Main module
@Module({
  imports: [
    AuthModule.forRoot(auth, {
      // adapter: 'express', // Optional: automatic detection works
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}

// Application bootstrap
async function bootstrap(): Promise<void> {
  const app: INestApplication = await NestFactory.create(AppModule, {
    bodyParser: false, // Important: disable NestJS body parser
    logger: ['error', 'warn', 'log'], // NestJS logs
  });

  // Additional Express configurations (optional)
  app.enableCors({
    origin: ['http://localhost:3000'],
    credentials: true,
  });

  // Start server
  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 Application running on: http://localhost:${port}`);
  console.log(`🔐 Auth endpoints available at: http://localhost:${port}/api/auth/*`);
}

// Error handling
bootstrap().catch((error) => {
  console.error('❌ Error starting application:', error);
  process.exit(1);
});

/**
 * To test this example:
 * 
 * 1. Install dependencies:
 *    bun install @nestjs/platform-express express
 * 
 * 2. Run the example:
 *    bun run express-example.ts
 * 
 * 3. Test the endpoints:
 *    - GET http://localhost:3000/api/public (public)
 *    - GET http://localhost:3000/api/protected (requires authentication)
 *    - POST http://localhost:3000/api/auth/sign-up/email (create account)
 *    - POST http://localhost:3000/api/auth/sign-in/email (login)
 * 
 * 4. Express characteristics:
 *    - Widely adopted and tested
 *    - Large middleware ecosystem
 *    - Compatibility with most libraries
 *    - Extensive documentation
 *    - De facto standard for Node.js applications
 */