import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'src/prisma/schema.prisma',
  migrations: {
    path: 'src/prisma/migrations',
    seed: 'tsx --env-file=.env src/prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
