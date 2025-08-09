# 🧪 Testing Integration in Real Project

This guide shows how to test `nestjs-better-auth` in a real project using `npm link` before publishing to npm.

## 📋 Prerequisites

- Node.js 18+ or Bun
- An existing or new NestJS project
- Better Auth configured

## 🔗 Local Link Configuration

### 1. Prepare Local Package

In the `nestjs-better-auth` directory:

```bash
# Build the package
bun run build

# Create global link
npm link
# or with yarn
yarn link
# or with pnpm
pnpm link --global
```

### 2. Create Test Project

```bash
# Create new NestJS project
npx @nestjs/cli new test-better-auth
cd test-better-auth

# Install necessary dependencies
npm install better-auth better-sqlite3
npm install --save-dev @types/better-sqlite3

# Link local package
npm link nestjs-better-auth
```

## 🚀 Integration Example - Express

### 1. Configure Better Auth

Create `src/auth.config.ts`:

```typescript
import { betterAuth } from 'better-auth';
import { database } from 'better-auth/adapters/sqlite';
import Database from 'better-sqlite3';

export const auth = betterAuth({
  database: database(new Database('./auth.db')),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: ['http://localhost:3000'],
  basePath: '/api/auth',
});
```

### 2. Configure Main Module

Edit `src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from 'nestjs-better-auth';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { auth } from './auth.config';

@Module({
  imports: [
    AuthModule.forRoot({
      auth,
      disableBodyParser: true, // Important for Express
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### 3. Create Test Controller

Edit `src/app.controller.ts`:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, Session } from 'nestjs-better-auth';
import type { UserSession } from 'nestjs-better-auth';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('public')
  getPublic(): { message: string } {
    return { message: 'Public endpoint - no authentication' };
  }

  @Get('protected')
  @UseGuards(AuthGuard)
  getProtected(@Session() session: UserSession): { message: string; user: any } {
    return {
      message: 'Protected endpoint - requires authentication',
      user: session.user,
    };
  }

  @Get('profile')
  @UseGuards(AuthGuard)
  getProfile(@Session() session: UserSession): any {
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      createdAt: session.user.createdAt,
    };
  }
}
```

### 4. Configure Main

Edit `src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Important: disable body parser
  });

  // Configure CORS
  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

  await app.listen(3001);
  console.log('🚀 Application running at http://localhost:3001');
  console.log('🔐 Auth endpoints at http://localhost:3001/api/auth/*');
}

bootstrap();
```

## 🏃‍♂️ Integration Example - Fastify

### 1. Install Fastify Dependencies

```bash
npm install @nestjs/platform-fastify fastify
```

### 2. Configure Main for Fastify

Edit `src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true,
    }),
    {
      bodyParser: false, // Important: disable body parser
    },
  );

  await app.listen({ port: 3001, host: '0.0.0.0' });
  console.log('🚀 Fastify app running at http://localhost:3001');
  console.log('🔐 Auth endpoints at http://localhost:3001/api/auth/*');
}

bootstrap();
```

## 🧪 Testing Integration

### 1. Start Application

```bash
npm run start:dev
```

### 2. Test Endpoints

**Public endpoint:**
```bash
curl http://localhost:3001/public
```

**Authentication endpoints:**
```bash
# Register user
curl -X POST http://localhost:3001/api/auth/sign-up \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Sign in
curl -X POST http://localhost:3001/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -c cookies.txt

# Access protected endpoint
curl http://localhost:3001/protected -b cookies.txt
```

### 3. Test with Frontend

Create a `test-frontend.html` file:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Better Auth Test</title>
</head>
<body>
    <div id="app">
        <h1>Better Auth Integration Test</h1>
        
        <div id="auth-section">
            <h2>Authentication</h2>
            <input type="email" id="email" placeholder="Email">
            <input type="password" id="password" placeholder="Password">
            <button onclick="signUp()">Register</button>
            <button onclick="signIn()">Sign In</button>
            <button onclick="signOut()">Sign Out</button>
        </div>
        
        <div id="test-section">
            <h2>Endpoint Tests</h2>
            <button onclick="testPublic()">Test Public</button>
            <button onclick="testProtected()">Test Protected</button>
            <button onclick="getProfile()">View Profile</button>
        </div>
        
        <div id="results"></div>
    </div>

    <script>
        const API_BASE = 'http://localhost:3001';
        
        async function signUp() {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            try {
                const response = await fetch(`${API_BASE}/api/auth/sign-up`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ email, password, name: 'Test User' })
                });
                
                const result = await response.json();
                document.getElementById('results').innerHTML = `<pre>${JSON.stringify(result, null, 2)}</pre>`;
            } catch (error) {
                console.error('Error:', error);
            }
        }
        
        async function signIn() {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            try {
                const response = await fetch(`${API_BASE}/api/auth/sign-in`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ email, password })
                });
                
                const result = await response.json();
                document.getElementById('results').innerHTML = `<pre>${JSON.stringify(result, null, 2)}</pre>`;
            } catch (error) {
                console.error('Error:', error);
            }
        }
        
        async function signOut() {
            try {
                const response = await fetch(`${API_BASE}/api/auth/sign-out`, {
                    method: 'POST',
                    credentials: 'include'
                });
                
                const result = await response.json();
                document.getElementById('results').innerHTML = `<pre>${JSON.stringify(result, null, 2)}</pre>`;
            } catch (error) {
                console.error('Error:', error);
            }
        }
        
        async function testPublic() {
            try {
                const response = await fetch(`${API_BASE}/public`, {
                    credentials: 'include'
                });
                
                const result = await response.json();
                document.getElementById('results').innerHTML = `<pre>${JSON.stringify(result, null, 2)}</pre>`;
            } catch (error) {
                console.error('Error:', error);
            }
        }
        
        async function testProtected() {
            try {
                const response = await fetch(`${API_BASE}/protected`, {
                    credentials: 'include'
                });
                
                const result = await response.json();
                document.getElementById('results').innerHTML = `<pre>${JSON.stringify(result, null, 2)}</pre>`;
            } catch (error) {
                console.error('Error:', error);
            }
        }
        
        async function getProfile() {
            try {
                const response = await fetch(`${API_BASE}/profile`, {
                    credentials: 'include'
                });
                
                const result = await response.json();
                document.getElementById('results').innerHTML = `<pre>${JSON.stringify(result, null, 2)}</pre>`;
            } catch (error) {
                console.error('Error:', error);
            }
        }
    </script>
</body>
</html>
```

Open the file in browser and test the integration.

## 🔧 Troubleshooting

### Common Issues

1. **Module not found error:**
   ```bash
   # Re-create the link
   npm unlink nestjs-better-auth
   cd /path/to/nestjs-better-auth
   npm link
   cd /path/to/test-project
   npm link nestjs-better-auth
   ```

2. **Body parser error:**
   - Make sure `bodyParser: false` is configured in `main.ts`
   - Check that `disableBodyParser: true` is in `AuthModule.forRoot()`

3. **CORS error:**
   - Configure CORS correctly in `main.ts`
   - Check that `trustedOrigins` is configured in Better Auth

4. **Types error:**
   ```bash
   # Install necessary types
   npm install --save-dev @types/better-sqlite3
   ```

### Debug Logs

For detailed debugging, configure logs in `main.ts`:

```typescript
const app = await NestFactory.create(AppModule, {
  bodyParser: false,
  logger: ['error', 'warn', 'log', 'debug', 'verbose'],
});
```

## 🚀 Next Steps

After successful testing:

1. **Remove the link:**
   ```bash
   npm unlink nestjs-better-auth
   ```

2. **Install published version:**
   ```bash
   npm install nestjs-better-auth
   ```

3. **Document specific use cases**

4. **Create automated tests**

This guide ensures the integration works correctly before npm publication! 🎉