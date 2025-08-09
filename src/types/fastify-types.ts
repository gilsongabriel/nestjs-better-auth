/**
 * Tipos específicos para integração com Fastify
 */
export interface FastifyAuthRequest {
  url: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
  raw?: any;
}

export interface FastifyAuthReply {
  code(statusCode: number): FastifyAuthReply;
  send(payload?: any): FastifyAuthReply;
  header(name: string, value: string | string[]): FastifyAuthReply;
  sent: boolean;
  raw?: any;
}

/**
 * Interfaces para conversão entre Fastify e Node.js
 */
export interface NodeRequestLike {
  url?: string;
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
  raw?: any;
}

export interface NodeResponseLike {
  statusCode?: number;
  setHeader(name: string, value: string | string[]): void;
  writeHead(statusCode: number, headers?: Record<string, string>): void;
  write(chunk: any): void;
  end(data?: any): void;
  json?(data: any): void;
  send?(data: any): void;
  status?(code: number): NodeResponseLike;
}

/**
 * Utilitário para conversão entre objetos Fastify e Node.js
 */
export class FastifyNodeConverter {
  /**
   * Converte FastifyRequest para formato Node.js
   */
  static requestToNode(request: FastifyAuthRequest): NodeRequestLike {
    return {
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: request.body,
      raw: request.raw,
    };
  }

  /**
   * Converte FastifyReply para formato Node.js
   */
  static replyToNode(reply: FastifyAuthReply): NodeResponseLike {
    return {
      statusCode: (reply as any).statusCode,
      setHeader: (name: string, value: string | string[]) => {
        reply.header(name, value);
      },
      writeHead: (statusCode: number, headers?: Record<string, string>) => {
        reply.code(statusCode);
        if (headers) {
          Object.entries(headers).forEach(([key, value]) => {
            reply.header(key, value);
          });
        }
      },
      write: (chunk: any) => {
        if (reply.raw && reply.raw.write) {
          reply.raw.write(chunk);
        }
      },
      end: (data?: any) => {
        if (data !== undefined) {
          reply.send(data);
        } else {
          reply.send();
        }
      },
      json: (data: any) => {
        reply.send(data);
      },
      send: (data: any) => {
        reply.send(data);
      },
      status: (code: number) => {
        reply.code(code);
        return FastifyNodeConverter.replyToNode(reply);
      },
    };
  }
}