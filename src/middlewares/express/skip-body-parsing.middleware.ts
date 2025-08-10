import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * Express-specific middleware that skips body parsing
 * for Better Auth routes
 */
@Injectable()
export class SkipBodyParsingMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // skip body parsing for better-auth routes
    if (req.baseUrl.startsWith('/api/auth')) {
      next();
      return;
    }

    try {
      // Dynamically import express only when needed
      const express = await import('express');

      // Parse the body as usual
      express.default.json()(req, res, (err) => {
        if (err) {
          next(err);
          return;
        }
        express.default.urlencoded({ extended: true })(req, res, next);
      });
    } catch (error) {
      // If express is not available, just continue
      next();
    }
  }
}
