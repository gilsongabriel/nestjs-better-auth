/**
 * Exemplo de uso do nestjs-better-auth com Fastify
 * 
 * Este exemplo demonstra como configurar uma aplicação NestJS
 * usando Fastify como adaptador HTTP com Better Auth
 */

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Module, Controller, Get, UseGuards } from '@nestjs/common';
import { AuthModule, AuthGuard, Session, UserSession } from '@thallesp/nestjs-better-auth';
import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';

// Configuração do Better Auth
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

// Controller de exemplo
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

// Módulo principal
@Module({
  imports: [
    AuthModule.forRoot(auth, {
      // adapter: 'fastify', // Opcional: detecção automática funciona
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}

// Bootstrap da aplicação
async function bootstrap(): Promise<void> {
  const app: NestFastifyApplication = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true, // Habilitar logs do Fastify
    }),
    {
      bodyParser: false, // Importante: desabilitar body parser do NestJS
      logger: ['error', 'warn', 'log'], // Logs do NestJS
    }
  );

  // Configurações adicionais do Fastify (opcional)
  await app.register(require('@fastify/helmet'), {
    contentSecurityPolicy: false,
  });

  // Iniciar servidor
  const port: string | number = process.env.PORT || 3333;
  await app.listen(port, '0.0.0.0');
  
  console.log(`🚀 Application running on: http://localhost:${port}`);
  console.log(`🔐 Auth endpoints available at: http://localhost:${port}/api/auth/*`);
}

// Tratamento de erros
bootstrap().catch((error: Error) => {
  console.error('❌ Error starting application:', error);
  process.exit(1);
});

/**
 * Para testar este exemplo:
 * 
 * 1. Instale as dependências:
 *    bun install @nestjs/platform-fastify fastify
 * 
 * 2. Execute o exemplo:
 *    bun run fastify-example.ts
 * 
 * 3. Teste os endpoints:
 *    - GET http://localhost:3333/api/public (público)
 *    - GET http://localhost:3333/api/protected (requer autenticação)
 *    - POST http://localhost:3333/api/auth/sign-up/email (criar conta)
 *    - POST http://localhost:3333/api/auth/sign-in/email (fazer login)
 * 
 * 4. Vantagens do Fastify:
 *    - Melhor performance (até 2x mais rápido que Express)
 *    - Validação de schema integrada
 *    - Sistema de plugins robusto
 *    - Suporte nativo a TypeScript
 *    - Logs estruturados
 */