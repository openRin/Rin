import * as net from "node:net";

export function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (error: NodeJS.ErrnoException) => resolve(error.code !== "EADDRINUSE"));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}
