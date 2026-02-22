import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { envValue } from "./infra/env.util";

export async function createNestApp() {
  const rawCorsOrigin = envValue(process.env.CORS_ORIGIN);
  const corsOrigin = rawCorsOrigin
    ? rawCorsOrigin.split(",").map((item) => item.trim())
    : true;

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: corsOrigin
    }
  });

  app.enableShutdownHooks();
  app.setGlobalPrefix("");
  app.use(
    helmet({
      crossOriginResourcePolicy: false
    })
  );

  const express = app.getHttpAdapter().getInstance();
  express.disable("x-powered-by");
  express.use((req: { path?: string }, res: { setHeader: (name: string, value: string) => void }, next: () => void) => {
    const path = req.path ?? "";
    if (path === "/api" || path.startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Surrogate-Control", "no-store");
    }
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    })
  );

  return app;
}
