import "reflect-metadata";
import { createNestApp } from "./bootstrap";
import { envValue } from "./infra/env.util";

if (!process.env.TZ || !process.env.TZ.trim()) {
  process.env.TZ = "Europe/Istanbul";
}

async function bootstrap() {
  const app = await createNestApp();

  const host = envValue(process.env.API_HOST) ?? "0.0.0.0";
  const port = Number(envValue(process.env.API_PORT) ?? 4000);
  await app.listen(port, host);
}

bootstrap();
