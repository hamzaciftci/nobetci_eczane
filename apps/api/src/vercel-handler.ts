import "reflect-metadata";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createNestApp } from "./bootstrap";

type ExpressLikeHandler = (req: VercelRequest, res: VercelResponse) => void;
let cachedHandler: ExpressLikeHandler | undefined;

async function getHandler(): Promise<ExpressLikeHandler> {
  if (!cachedHandler) {
    const app = await createNestApp();
    await app.init();
    cachedHandler = app.getHttpAdapter().getInstance() as ExpressLikeHandler;
  }
  if (!cachedHandler) {
    throw new Error("Vercel handler init failed");
  }
  return cachedHandler;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const expressHandler = await getHandler();
  return expressHandler(req, res);
}
