import type { VercelRequest, VercelResponse } from "@vercel/node";
import handler from "../src/vercel-handler";

export default function route(req: VercelRequest, res: VercelResponse) {
  return handler(req, res);
}
