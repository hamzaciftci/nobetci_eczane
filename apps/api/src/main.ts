import "reflect-metadata";
import { createNestApp } from "./bootstrap";

async function bootstrap() {
  const app = await createNestApp();

  const host = process.env.API_HOST ?? "0.0.0.0";
  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, host);
}

bootstrap();
