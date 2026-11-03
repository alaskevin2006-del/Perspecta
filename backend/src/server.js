import { createServer as nodeServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createApp } from './app.js';
import { errorResponse } from './errors.js';
import { loadConfig } from './config.js';

export function createServer(options) {
  const app = createApp(options);
  const server = nodeServer({maxHeaderSize: 8192}, async (req, res) => {
    const abort = new AbortController();
    res.on('close', () => { if (!res.writableEnded) abort.abort(); });
    req.on('error', () => abort.abort());
    let response;
    try {
      const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : new ReadableStream({
        start(controller) {
          this.data = chunk => {controller.enqueue(chunk); if (controller.desiredSize <= 0) req.pause();};
          this.end = () => controller.close();
          this.error = error => controller.error(error);
          req.on('data', this.data).once('end', this.end).once('error', this.error);
        },
        pull() { req.resume(); },
        cancel() { req.off('data', this.data).off('end', this.end).off('error', this.error); req.resume(); },
      });
      const request = new Request(new URL(req.url, 'http://localhost'), {
        method: req.method, headers: req.headers, signal: abort.signal,
        ...(body ? {body, duplex: 'half'} : {}),
      });
      response = await app.handle(request, {clientId: req.socket.remoteAddress ?? 'unknown'});
    } catch (error) { response = errorResponse(error); }
    if (!res.destroyed) {
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    }
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 15000;
  server.keepAliveTimeout = 5000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = loadConfig();
  const server = createServer({config});
  const {host, port, mode} = config;
  server.listen(port, host, () => console.log(JSON.stringify({event: 'listening', host, port, mode})));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
