/**
 * Testes de integração simplificados para validar
 * a criação e configuração dos adaptadores
 */

import { describe, it, expect } from 'bun:test';
import { ExpressAdapter } from '../src/adapters/express-adapter.ts';
import { FastifyAdapter } from '../src/adapters/fastify-adapter.ts';
import { AdapterFactory } from '../src/adapters/adapter-factory.ts';
import type { AuthModuleOptions } from '../src/types/adapter-types.ts';

// Mock do Better Auth para testes
const mockAuth = {
  options: {
    basePath: '/api/auth',
    trustedOrigins: ['http://localhost:3000'],
  },
} as any;

const mockOptions: AuthModuleOptions = {
  disableExceptionFilter: false,
  disableTrustedOriginsCors: false,
  disableBodyParser: false,
};

describe('Adapter Integration Tests', () => {
  describe('Express Adapter', () => {
    it('should create and configure ExpressAdapter correctly', () => {
      const adapter = new ExpressAdapter(mockAuth, mockOptions);
      
      expect(adapter).toBeDefined();
      expect(adapter.getAdapterType()).toBe('express');
    });

    it('should handle configuration options', () => {
      const customOptions: AuthModuleOptions = {
        disableBodyParser: true,
        disableTrustedOriginsCors: true,
        disableExceptionFilter: true,
      };
      
      const adapter = new ExpressAdapter(mockAuth, customOptions);
      expect(adapter).toBeDefined();
    });
  });

  describe('Fastify Adapter', () => {
    it('should create and configure FastifyAdapter correctly', () => {
      const adapter = new FastifyAdapter(mockAuth, mockOptions);
      
      expect(adapter).toBeDefined();
      expect(adapter.getAdapterType()).toBe('fastify');
    });

    it('should handle configuration options', () => {
      const customOptions: AuthModuleOptions = {
        disableBodyParser: true,
        disableTrustedOriginsCors: true,
        disableExceptionFilter: true,
      };
      
      const adapter = new FastifyAdapter(mockAuth, customOptions);
      expect(adapter).toBeDefined();
    });
  });

  describe('Adapter Factory Integration', () => {
    it('should create correct adapter instances', () => {
      const expressAdapter = AdapterFactory.create('express', mockAuth, mockOptions);
      const fastifyAdapter = AdapterFactory.create('fastify', mockAuth, mockOptions);
      
      expect(expressAdapter).toBeInstanceOf(ExpressAdapter);
      expect(fastifyAdapter).toBeInstanceOf(FastifyAdapter);
      expect(expressAdapter.getAdapterType()).toBe('express');
      expect(fastifyAdapter.getAdapterType()).toBe('fastify');
    });

    it('should handle different configuration combinations', () => {
      const configs = [
        { disableBodyParser: true },
        { disableTrustedOriginsCors: true },
        { disableExceptionFilter: true },
        { disableBodyParser: true, disableTrustedOriginsCors: true },
      ];
      
      configs.forEach(config => {
        const expressAdapter = AdapterFactory.create('express', mockAuth, config);
        const fastifyAdapter = AdapterFactory.create('fastify', mockAuth, config);
        
        expect(expressAdapter).toBeDefined();
        expect(fastifyAdapter).toBeDefined();
      });
    });
  });
});