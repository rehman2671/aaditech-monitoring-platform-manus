import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

let server: Server | undefined;

function fingerprint(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

describe("configured SentinelPulse signing secrets", () => {
  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => server?.close(error => error ? reject(error) : resolve()));
    server = undefined;
  });

  it("uses a non-secret fingerprint on a lightweight probe endpoint", async () => {
    const privateKey = process.env.JWT_PRIVATE_KEY_RS256 ?? "";
    const publicKey = process.env.JWT_PUBLIC_KEY_RS256 ?? "";
    const pfxPath = process.env.SIGNING_CERT_PFX_PATH ?? "";
    const pfxPassword = process.env.SIGNING_CERT_PASSWORD ?? "";

    expect(privateKey.length).toBeGreaterThan(0);
    expect(publicKey.length).toBeGreaterThan(0);
    expect(pfxPath).toBe("/run/secrets/signing_cert.pfx");
    expect(pfxPassword.length).toBeGreaterThan(0);

    const secretFingerprint = fingerprint(`${privateKey}:${publicKey}:${pfxPassword}`);
    let receivedFingerprint = "";
    server = createServer((request, response) => {
      if (request.url !== "/health/secret-probe") {
        response.writeHead(404).end();
        return;
      }
      receivedFingerprint = request.headers["x-sentinelpulse-secret-fingerprint"]?.toString() ?? "";
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ status: "ok" }));
    });

    await new Promise<void>((resolve, reject) => {
      server?.listen(0, "127.0.0.1", () => resolve());
      server?.once("error", reject);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Secret probe did not bind to a TCP port");

    const response = await fetch(`http://127.0.0.1:${address.port}/health/secret-probe`, {
      headers: { "X-SentinelPulse-Secret-Fingerprint": secretFingerprint },
    });
    expect(response.status).toBe(200);
    expect(receivedFingerprint).toBe(secretFingerprint);
  });
});
