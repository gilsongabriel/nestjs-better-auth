/**
 * Tests for AdapterFactory
 * Validates automatic detection and adapter creation
 */

import { HttpAdapterHost } from '@nestjs/core';
import { betterAuth } from 'better-auth';
import { beforeEach, describe, expect, it } from 'bun:test';
import { AdapterFactory } from '../src/adapters/adapter-factory.ts';
import { ExpressAdapter } from '../src/adapters/express-adapter.ts';
import { FastifyAdapter } from '../src/adapters/fastify-adapter.ts';
import type { AuthModuleOptions } from '../src/types/adapter-types.ts';

describe('AdapterFactory', () => {
  let mockAuth: ReturnType<typeof betterAuth>;
  let mockOptions: AuthModuleOptions;
  let mockHttpAdapterHost: HttpAdapterHost;

  beforeEach(() => {
    // Better Auth mock
    mockAuth = {
      options: {
        basePath: '/api/auth',
        trustedOrigins: ['http://localhost:3000'],
      },
      api: {},
    } as any;

    // Module options mock
    mockOptions = {
      auth: mockAuth,
      disableBodyParser: false,
      disableTrustedOriginsCors: false,
      disableExceptionFilter: false,
    };

    // HttpAdapterHost mock
    mockHttpAdapterHost = {
      httpAdapter: {
        getType: () => 'express',
        getInstance: () => ({}),
      },
    } as any;
  });

  describe('create', () => {
    it('should create ExpressAdapter when type is express', () => {
      const adapter = AdapterFactory.create('express', mockAuth, mockOptions);
      expect(adapter).toBeInstanceOf(ExpressAdapter);
      expect(adapter.getAdapterType()).toBe('express');
    });

    it('should create FastifyAdapter when type is fastify', () => {
      const adapter = AdapterFactory.create('fastify', mockAuth, mockOptions);
      expect(adapter).toBeInstanceOf(FastifyAdapter);
      expect(adapter.getAdapterType()).toBe('fastify');
    });

    it('should be case insensitive', () => {
      const expressAdapter = AdapterFactory.create(
        'EXPRESS',
        mockAuth,
        mockOptions
      );
      const fastifyAdapter = AdapterFactory.create(
        'FASTIFY',
        mockAuth,
        mockOptions
      );

      expect(expressAdapter).toBeInstanceOf(ExpressAdapter);
      expect(fastifyAdapter).toBeInstanceOf(FastifyAdapter);
    });

    it('should throw error for unsupported adapter type', () => {
      expect(() => {
        AdapterFactory.create('unsupported' as any, mockAuth, mockOptions);
      }).toThrow('Unsupported HTTP adapter type: unsupported');
    });
  });

  describe('detectAdapterType', () => {
    it('should detect express adapter from HttpAdapterHost', () => {
      const type = AdapterFactory.detectAdapterType(
        mockHttpAdapterHost.httpAdapter
      );
      expect(type).toBe('express');
    });

    it('should detect fastify adapter from HttpAdapterHost', () => {
      const fastifyAdapter = {
        getType: () => 'fastify',
        getInstance: () => ({}),
      } as any;

      const type = AdapterFactory.detectAdapterType(fastifyAdapter);
      expect(type).toBe('fastify');
    });

    it('should fallback to express when getType is not available', () => {
      const adapterWithoutGetType = {
        getInstance: () => ({
          use: () => {},
          get: () => {},
          post: () => {},
        }),
      } as any;

      const type = AdapterFactory.detectAdapterType(adapterWithoutGetType);
      expect(type).toBe('express');
    });

    it('should detect fastify from instance methods', () => {
      const fastifyAdapterWithoutGetType = {
        getInstance: () => ({
          register: () => {},
          route: () => {},
          addHook: () => {},
        }),
      } as any;

      const type = AdapterFactory.detectAdapterType(
        fastifyAdapterWithoutGetType
      );
      expect(type).toBe('fastify');
    });
  });

  describe('isSupported', () => {
    it('should return true for supported adapters', () => {
      expect(AdapterFactory.isSupported('express')).toBe(true);
      expect(AdapterFactory.isSupported('fastify')).toBe(true);
    });

    it('should return false for unsupported adapters', () => {
      expect(AdapterFactory.isSupported('koa' as any)).toBe(false);
      expect(AdapterFactory.isSupported('hapi' as any)).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(AdapterFactory.isSupported('EXPRESS' as any)).toBe(true);
      expect(AdapterFactory.isSupported('FASTIFY' as any)).toBe(true);
    });
  });

  describe('getSupportedAdapters', () => {
    it('should return list of supported adapters', () => {
      const supported = AdapterFactory.getSupportedAdapters();
      expect(supported).toEqual(['express', 'fastify']);
    });
  });
});
