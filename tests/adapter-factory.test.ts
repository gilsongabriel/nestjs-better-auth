/**
 * Testes para o AdapterFactory
 * Valida a detecção automática e criação de adaptadores
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { Test } from '@nestjs/testing';
import { HttpAdapterHost } from '@nestjs/core';
import { AdapterFactory } from '../src/adapters/adapter-factory.ts';
import { ExpressAdapter } from '../src/adapters/express-adapter.ts';
import { FastifyAdapter } from '../src/adapters/fastify-adapter.ts';
import { betterAuth } from 'better-auth';
import type { AuthModuleOptions } from '../src/types/adapter-types.ts';

describe('AdapterFactory', () => {
  let factory: AdapterFactory;
  let mockAuth: ReturnType<typeof betterAuth>;
  let mockOptions: AuthModuleOptions;
  let mockHttpAdapterHost: HttpAdapterHost;

  beforeEach(() => {
    // Mock do Better Auth
    mockAuth = {
      options: {
        basePath: '/api/auth',
        trustedOrigins: ['http://localhost:3000'],
      },
    } as any;

    // Mock das opções do módulo
    mockOptions = {
      auth: mockAuth,
      disableBodyParser: false,
      disableTrustedOriginsCors: false,
      disableExceptionFilter: false,
    };

    // Mock do HttpAdapterHost
    mockHttpAdapterHost = {
      httpAdapter: {
        getType: () => 'express',
        getInstance: () => ({}),
      },
    } as any;

    factory = new AdapterFactory();
  });

  describe('createAdapter', () => {
    it('should create ExpressAdapter when type is express', () => {
      const adapter = factory.createAdapter('express', mockAuth, mockOptions);
      expect(adapter).toBeInstanceOf(ExpressAdapter);
      expect(adapter.getAdapterType()).toBe('express');
    });

    it('should create FastifyAdapter when type is fastify', () => {
      const adapter = factory.createAdapter('fastify', mockAuth, mockOptions);
      expect(adapter).toBeInstanceOf(FastifyAdapter);
      expect(adapter.getAdapterType()).toBe('fastify');
    });

    it('should be case insensitive', () => {
      const expressAdapter = factory.createAdapter('EXPRESS', mockAuth, mockOptions);
      const fastifyAdapter = factory.createAdapter('FASTIFY', mockAuth, mockOptions);
      
      expect(expressAdapter).toBeInstanceOf(ExpressAdapter);
      expect(fastifyAdapter).toBeInstanceOf(FastifyAdapter);
    });

    it('should throw error for unsupported adapter type', () => {
      expect(() => {
        factory.createAdapter('unsupported' as any, mockAuth, mockOptions);
      }).toThrow('Unsupported adapter type: unsupported');
    });
  });

  describe('detectAdapterType', () => {
    it('should detect express adapter from HttpAdapterHost', () => {
      const type = factory.detectAdapterType(mockHttpAdapterHost);
      expect(type).toBe('express');
    });

    it('should detect fastify adapter from HttpAdapterHost', () => {
      const fastifyHost = {
        httpAdapter: {
          getType: () => 'fastify',
          getInstance: () => ({}),
        },
      } as any;

      const type = factory.detectAdapterType(fastifyHost);
      expect(type).toBe('fastify');
    });

    it('should fallback to express when getType is not available', () => {
      const hostWithoutGetType = {
        httpAdapter: {
          getInstance: () => ({
            use: () => {},
          }),
        },
      } as any;

      const type = factory.detectAdapterType(hostWithoutGetType);
      expect(type).toBe('express');
    });

    it('should detect fastify from instance methods', () => {
      const fastifyHostWithoutGetType = {
        httpAdapter: {
          getInstance: () => ({
            register: () => {},
            addHook: () => {},
          }),
        },
      } as any;

      const type = factory.detectAdapterType(fastifyHostWithoutGetType);
      expect(type).toBe('fastify');
    });
  });

  describe('isAdapterSupported', () => {
    it('should return true for supported adapters', () => {
      expect(factory.isAdapterSupported('express')).toBe(true);
      expect(factory.isAdapterSupported('fastify')).toBe(true);
    });

    it('should return false for unsupported adapters', () => {
      expect(factory.isAdapterSupported('koa' as any)).toBe(false);
      expect(factory.isAdapterSupported('hapi' as any)).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(factory.isAdapterSupported('EXPRESS' as any)).toBe(true);
      expect(factory.isAdapterSupported('FASTIFY' as any)).toBe(true);
    });
  });

  describe('getSupportedAdapters', () => {
    it('should return list of supported adapters', () => {
      const supported = factory.getSupportedAdapters();
      expect(supported).toEqual(['express', 'fastify']);
    });
  });
});