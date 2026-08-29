import http from 'http';
import type { HttpRequest, HttpResponse } from './types/api.types.ts';
import { SyncCursorStore } from './cursor/sync_cursor.ts';
import { MutationGateway } from './gateway/mutation_gateway.ts';
import { AuthRoute } from './routes/auth.route.ts';
import { SyncRoute } from './routes/sync.route.ts';
import { ApprovalsRoute } from './routes/approvals.route.ts';

export class AppServer {
  public cursorStore: SyncCursorStore;
  public mutationGateway: MutationGateway;

  constructor() {
    this.cursorStore = new SyncCursorStore();
    this.mutationGateway = new MutationGateway();
  }

  /**
   * Primary Request Dispatcher & Gateway Router
   */
  public async handleRequest(req: HttpRequest): Promise<HttpResponse> {
    const rawUrl = req.url || '/';
    const [pathname, queryString] = rawUrl.split('?');

    // Parse query params if not pre-populated
    if (!req.query && queryString) {
      req.query = Object.fromEntries(new URLSearchParams(queryString).entries());
    } else if (!req.query) {
      req.query = {};
    }

    const method = (req.method || 'GET').toUpperCase();

    // Router Table Matcher
    if (method === 'POST' && pathname === '/api/v1/auth/login') {
      return AuthRoute.handleLogin(req);
    }

    if (method === 'GET' && pathname === '/api/v1/sync/pull') {
      return SyncRoute.handlePull(req, this.cursorStore);
    }

    if (method === 'POST' && pathname === '/api/v1/sync/push') {
      return SyncRoute.handlePush(req, this.cursorStore, this.mutationGateway);
    }

    if (method === 'POST' && pathname === '/api/v1/approvals/request') {
      return ApprovalsRoute.handleRequest(req, this.cursorStore);
    }

    // 404 Route Not Found
    return {
      status: 404,
      body: { success: false, error: `Route not found: ${method} ${pathname}` },
    };
  }

  /**
   * Node.js HTTP Server wrapper for local execution or automated testing listener
   */
  public createHttpServer(): http.Server {
    return http.createServer(async (req, res) => {
      let bodyData = '';
      req.on('data', (chunk) => {
        bodyData += chunk;
      });
      req.on('end', async () => {
        let parsedBody: any;
        if (bodyData) {
          try {
            parsedBody = JSON.parse(bodyData);
          } catch {
            parsedBody = null;
          }
        }

        const headersMap: Record<string, string> = {};
        for (const [key, val] of Object.entries(req.headers)) {
          if (val) headersMap[key] = Array.isArray(val) ? val.join(',') : val;
        }

        const httpReq: HttpRequest = {
          method: req.method || 'GET',
          url: req.url || '/',
          headers: headersMap,
          body: parsedBody,
        };

        const response = await this.handleRequest(httpReq);

        res.writeHead(response.status, {
          'Content-Type': 'application/json',
          ...(response.headers || {}),
        });
        res.end(JSON.stringify(response.body));
      });
    });
  }
}
