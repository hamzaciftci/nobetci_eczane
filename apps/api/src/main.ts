import "reflect-metadata";
import { createNestApp } from "./bootstrap";
import { envValue } from "./infra/env.util";

async function bootstrap() {
  const app = await createNestApp();

  const host = envValue(process.env.API_HOST) ?? "0.0.0.0";
  const port = Number(envValue(process.env.API_PORT) ?? 4000);
  await app.listen(port, host);
}

bootstrap();
