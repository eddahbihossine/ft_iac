import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import * as session from 'express-session';
import { randomBytes } from 'crypto';
import { AppSessionBaseType } from './libs/data-structures/app-session.type';

declare module 'express-session' {
  export interface SessionData extends AppSessionBaseType {}
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Express session middleware setup
  app.use(session({
    secret: randomBytes(42).toString('hex'),
    resave: false,
    saveUninitialized: false,
  }));

  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(join(__dirname, 'views'));
  app.setViewEngine('hbs');

  await app.listen(3000);
}
bootstrap();
