import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { shsAuth } from "../src/middleware";

function createApp() {
  const app = express();
  app.get("/protected", shsAuth, (_req, res) => res.json({ ok: true }));
  return app;
}

describe("shsAuth middleware", () => {
  it("allows valid bearer token", async () => {
    const res = await request(createApp())
      .get("/protected")
      .set("Authorization", "Bearer test-shs-secret");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("rejects missing auth header", async () => {
    const res = await request(createApp()).get("/protected");
    expect(res.status).toBe(401);
  });

  it("rejects non-Bearer auth scheme", async () => {
    const res = await request(createApp())
      .get("/protected")
      .set("Authorization", "Basic dXNlcjpwYXNz");
    expect(res.status).toBe(401);
  });

  it("rejects wrong token", async () => {
    const res = await request(createApp())
      .get("/protected")
      .set("Authorization", "Bearer wrong");
    expect(res.status).toBe(403);
  });
});
