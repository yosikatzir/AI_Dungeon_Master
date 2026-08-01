import { AsyncLocalStorage } from "node:async_hooks";

// Next's own CLI sets this global before loading app-render code; we
// replicate that since we use `next` as a library. @types/node already
// declares `AsyncLocalStorage` as an ambient global, so no redeclaration
// is needed here — just the assignment.
//
// Must happen before `next` (or anything importing it) is loaded — Next's
// app-render code reads this global at module-load time, not lazily. Static
// imports are hoisted ahead of this assignment, so everything below is a
// dynamic import to guarantee ordering.
globalThis.AsyncLocalStorage ??= AsyncLocalStorage;

async function main() {
  const { createServer } = await import("node:http");
  const { default: next } = await import("next");
  const { Server: SocketIOServer } = await import("socket.io");
  const { registerSocketHandlers } = await import("./lib/realtime/socketServer");

  const dev = process.env.NODE_ENV !== "production";
  const port = Number(process.env.PORT) || 3000;

  const app = next({ dev });
  const handle = app.getRequestHandler();
  await app.prepare();

  const httpServer = createServer((req, res) => handle(req, res));

  const io = new SocketIOServer(httpServer, {
    path: "/api/socket",
  });
  registerSocketHandlers(io);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
}

main();
