// The Neon serverless driver speaks the PostgreSQL wire protocol over a
// WebSocket. This adapter forwards each WebSocket to the dedicated local test
// database used by *.postgres.test.ts. Test tooling only: it refuses anything
// other than the local modules_185_test database, like the tests themselves.
import net from "node:net";
import { WebSocketServer } from "ws";

const rawUrl = process.env.MODULE_TEST_DATABASE_URL;
if (!rawUrl) {
  console.error("MODULE_TEST_DATABASE_URL ausente; nenhum adaptador foi iniciado.");
  process.exit(2);
}

let database;
try {
  database = new URL(rawUrl);
} catch {
  console.error("MODULE_TEST_DATABASE_URL inválida; nenhum adaptador foi iniciado.");
  process.exit(2);
}
if (database.hostname !== "127.0.0.1" || database.pathname !== "/modules_185_test") {
  console.error("O adaptador aceita somente o banco local 127.0.0.1/modules_185_test.");
  process.exit(2);
}

const databasePort = Number(database.port || 5432);
const proxyPort = Number(process.env.MODULE_TEST_WS_PORT ?? 55479);
const server = new WebSocketServer({ host: "127.0.0.1", port: proxyPort });

server.on("connection", (socket) => {
  const upstream = net.connect(databasePort, "127.0.0.1");
  socket.on("message", (data) => upstream.write(data));
  upstream.on("data", (data) => socket.send(data));
  upstream.on("error", () => socket.close());
  upstream.on("close", () => socket.close());
  socket.on("error", () => upstream.destroy());
  socket.on("close", () => upstream.destroy());
});

server.on("listening", () => {
  console.info(`Adaptador do banco de testes pronto em 127.0.0.1:${proxyPort} → 127.0.0.1:${databasePort}.`);
});
