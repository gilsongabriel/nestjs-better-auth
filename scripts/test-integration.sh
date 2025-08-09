#!/bin/bash

# 🧪 Script for Testing nestjs-better-auth Integration
# This script automates the testing process in a real project using npm link

set -e  # Stop on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function for colored logging
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we are in the correct directory
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    log_error "Run this script in the nestjs-better-auth root directory"
    exit 1
fi

# Function to show help
show_help() {
    echo "🧪 Integration Test Script - nestjs-better-auth"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  setup     - Build and create global link"
    echo "  create    - Create test project"
    echo "  link      - Link package in test project"
    echo "  unlink    - Remove package link"
    echo "  clean     - Clean test project"
    echo "  all       - Execute complete setup (setup + create + link)"
    echo "  help      - Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 all                    # Complete setup"
    echo "  $0 setup                  # Build and link only"
    echo "  $0 create express-test    # Create specific project"
}

# Function to build and setup link
setup_link() {
    log_info "Building package..."
    bun run build
    
    log_info "Creating global link..."
    npm link
    
    log_success "Global link created successfully!"
}

# Function to create test project
create_test_project() {
    local project_name=${1:-"test-better-auth"}
    local adapter_type=${2:-"express"}
    
    if [ -d "../$project_name" ]; then
        log_warning "Project $project_name already exists. Removing..."
        rm -rf "../$project_name"
    fi
    
    log_info "Creating test project: $project_name"
    cd ..
    npx @nestjs/cli new $project_name --skip-git --package-manager npm
    cd $project_name
    
    log_info "Installing dependencies..."
    npm install better-auth better-sqlite3
    npm install --save-dev @types/better-sqlite3
    
    if [ "$adapter_type" = "fastify" ]; then
        log_info "Installing Fastify dependencies..."
        npm install @nestjs/platform-fastify fastify
    fi
    
    # Create Better Auth configuration
    log_info "Creating Better Auth configuration..."
    cat > src/auth.config.ts << 'EOF'
import { betterAuth } from 'better-auth';
import Database from 'better-sqlite3';

const db = new Database('./auth.db');

export const auth = betterAuth({
  database: db,
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: ['http://localhost:3000'],
  basePath: '/api/auth',
});
EOF
    
    # Update app.module.ts
    log_info "Configuring main module..."
    cat > src/app.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { AuthModule } from 'nestjs-better-auth';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { auth } from './auth.config';

@Module({
  imports: [
    AuthModule.forRoot({
      auth,
      disableBodyParser: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
EOF
    
    # Update app.controller.ts
    log_info "Configuring test controller..."
    cat > src/app.controller.ts << 'EOF'
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
    return { message: 'Public endpoint - no authentication required' };
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
EOF
    
    # Configure main.ts based on adapter
    if [ "$adapter_type" = "fastify" ]; then
        log_info "Configuring main.ts for Fastify..."
        cat > src/main.ts << 'EOF'
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
      bodyParser: false,
    },
  );

  await app.listen({ port: 3001, host: '0.0.0.0' });
  console.log('🚀 Fastify app running on http://localhost:3001');
  console.log('🔐 Auth endpoints at http://localhost:3001/api/auth/*');
}

bootstrap();
EOF
    else
        log_info "Configuring main.ts for Express..."
        cat > src/main.ts << 'EOF'
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

  await app.listen(3001);
  console.log('🚀 Express app running on http://localhost:3001');
  console.log('🔐 Auth endpoints at http://localhost:3001/api/auth/*');
}

bootstrap();
EOF
    fi
    
    # Create HTML test file
    log_info "Creating HTML test file..."
    cat > test-frontend.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Better Auth Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        input, button { margin: 5px; padding: 8px; }
        button { background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer; }
        button:hover { background: #0056b3; }
        #results { background: #f8f9fa; padding: 10px; border-radius: 3px; margin-top: 10px; }
        pre { white-space: pre-wrap; word-wrap: break-word; }
    </style>
</head>
<body>
    <h1>🧪 Better Auth Integration Test</h1>
    
    <div class="section">
        <h2>🔐 Authentication</h2>
        <input type="email" id="email" placeholder="Email" value="test@example.com">
        <input type="password" id="password" placeholder="Password" value="password123">
        <br>
        <button onclick="signUp()">Sign Up</button>
        <button onclick="signIn()">Sign In</button>
        <button onclick="signOut()">Sign Out</button>
    </div>
    
    <div class="section">
        <h2>🧪 Endpoint Tests</h2>
        <button onclick="testPublic()">Test Public</button>
        <button onclick="testProtected()">Test Protected</button>
        <button onclick="getProfile()">View Profile</button>
    </div>
    
    <div class="section">
        <h2>📊 Results</h2>
        <div id="results">Click a button to test...</div>
    </div>

    <script>
        const API_BASE = 'http://localhost:3001';
        
        function showResult(data, success = true) {
            const results = document.getElementById('results');
            const color = success ? '#d4edda' : '#f8d7da';
            results.style.backgroundColor = color;
            results.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        }
        
        async function makeRequest(url, options = {}) {
            try {
                const response = await fetch(url, {
                    credentials: 'include',
                    ...options
                });
                
                const data = await response.json();
                showResult({ status: response.status, data }, response.ok);
            } catch (error) {
                showResult({ error: error.message }, false);
            }
        }
        
        async function signUp() {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            await makeRequest(`${API_BASE}/api/auth/sign-up`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name: 'Test User' })
            });
        }
        
        async function signIn() {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            await makeRequest(`${API_BASE}/api/auth/sign-in`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
        }
        
        async function signOut() {
            await makeRequest(`${API_BASE}/api/auth/sign-out`, {
                method: 'POST'
            });
        }
        
        async function testPublic() {
            await makeRequest(`${API_BASE}/public`);
        }
        
        async function testProtected() {
            await makeRequest(`${API_BASE}/protected`);
        }
        
        async function getProfile() {
            await makeRequest(`${API_BASE}/profile`);
        }
    </script>
</body>
</html>
EOF
    
    cd ../nestjs-better-auth
    log_success "Test project '$project_name' created successfully!"
    log_info "To test:"
    log_info "  1. cd ../$project_name"
    log_info "  2. npm run start:dev"
    log_info "  3. Open test-frontend.html in browser"
}

# Function to link package
link_package() {
    local project_name=${1:-"test-better-auth"}
    
    if [ ! -d "../$project_name" ]; then
        log_error "Project $project_name not found. Run 'create' first."
        exit 1
    fi
    
    log_info "Linking package in project $project_name..."
    cd "../$project_name"
    npm link nestjs-better-auth
    cd ../nestjs-better-auth
    
    log_success "Package linked successfully!"
}

# Function to remove link
unlink_package() {
    local project_name=${1:-"test-better-auth"}
    
    if [ -d "../$project_name" ]; then
        log_info "Removing link from project $project_name..."
        cd "../$project_name"
        npm unlink nestjs-better-auth 2>/dev/null || true
        cd ../nestjs-better-auth
    fi
    
    log_info "Removing global link..."
    npm unlink 2>/dev/null || true
    
    log_success "Links removed successfully!"
}

# Function to clean test project
clean_project() {
    local project_name=${1:-"test-better-auth"}
    
    if [ -d "../$project_name" ]; then
        log_info "Removing project $project_name..."
        rm -rf "../$project_name"
        log_success "Project removed successfully!"
    else
        log_warning "Project $project_name not found."
    fi
}

# Function for complete setup
setup_all() {
    local project_name=${1:-"test-better-auth"}
    local adapter_type=${2:-"express"}
    
    log_info "Starting complete setup..."
    
    setup_link
    create_test_project "$project_name" "$adapter_type"
    link_package "$project_name"
    
    log_success "Complete setup finished!"
    log_info ""
    log_info "🚀 To test:"
    log_info "  cd ../$project_name"
    log_info "  npm run start:dev"
    log_info ""
    log_info "🌐 Then open test-frontend.html in browser"
    log_info "📡 API will be at http://localhost:3001"
    log_info "🔐 Auth endpoints at http://localhost:3001/api/auth/*"
}

# Process arguments
case "${1:-help}" in
    "setup")
        setup_link
        ;;
    "create")
        create_test_project "${2:-test-better-auth}" "${3:-express}"
        ;;
    "link")
        link_package "${2:-test-better-auth}"
        ;;
    "unlink")
        unlink_package "${2:-test-better-auth}"
        ;;
    "clean")
        clean_project "${2:-test-better-auth}"
        ;;
    "all")
        setup_all "${2:-test-better-auth}" "${3:-express}"
        ;;
    "help")
        show_help
        ;;
    *)
        log_error "Invalid command: $1"
        show_help
        exit 1
        ;;
esac