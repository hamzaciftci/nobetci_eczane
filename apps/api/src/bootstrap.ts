import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module";

export async function createNestApp() {
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((item) => item.trim())
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
