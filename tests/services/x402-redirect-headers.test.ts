import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createPlainClient } from "../../src/services/x402.service.js";

// Origin A answers /cross with a 307 to origin B and /same with a 307 to its
// own /landing; both landings record the headers they receive.
let serverA: http.Server;
let serverB: http.Server;
let urlA: string;
let urlB: string;
const received: Record<string, http.IncomingHttpHeaders> = {};

function listen(handler: http.RequestListener): Promise<[http.Server, string]> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve([server, `http://127.0.0.1:${port}`]);
    });
  });
}

beforeAll(async () => {
  [serverB, urlB] = await listen((req, res) => {
    received.b = req.headers;
    res.end("{}");
  });
  [serverA, urlA] = await listen((req, res) => {
    if (req.url === "/cross") {
      res.writeHead(307, { location: `${urlB}/landing` }).end();
    } else if (req.url === "/same") {
      res.writeHead(307, { location: "/landing" }).end();
    } else {
      received.a = req.headers;
      res.end("{}");
    }
  });
});

afterAll(() => {
  serverA.close();
  serverB.close();
});

const PAYMENT_HEADERS = { "payment-signature": "signed-v2", "X-PAYMENT": "signed-v1" };

describe("x402 client redirects", () => {
  it("drops payment headers on a redirect to another origin", async () => {
    await createPlainClient().get(`${urlA}/cross`, { headers: PAYMENT_HEADERS });
    expect(received.b["payment-signature"]).toBeUndefined();
    expect(received.b["x-payment"]).toBeUndefined();
  });

  it("keeps payment headers on a same-origin redirect", async () => {
    await createPlainClient().get(`${urlA}/same`, { headers: PAYMENT_HEADERS });
    expect(received.a["payment-signature"]).toBe("signed-v2");
    expect(received.a["x-payment"]).toBe("signed-v1");
  });
});
