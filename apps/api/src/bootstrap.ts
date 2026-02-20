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

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    })
  );

  return app;
}
