import express from 'express';
import helmetImport from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { isProduction } from './config/env.js';
import { swaggerSpec } from './config/swagger.js';
import routes from './routes/index.js';
import { notFoundHandler } from './middlewares/notFoundHandler.js';
import { errorHandler } from './middlewares/errorHandler.js';

const helmet = helmetImport as unknown as typeof import('helmet').default;

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
// TEMPORARY: accept every origin so the frontend is never blocked while it's
// still being wired up. `origin: true` reflects whatever Origin the request
// sends (works with credentials too), unlike the previous config, which
// blocked ALL cross-origin requests whenever CORS_ORIGINS was unset.
// Before going to production, replace this with `env.CORS_ORIGINS` (a
// comma-separated allowlist, see .env.example) so only known frontend
// origins are trusted.
app.use(
    cors({
        origin: true,
    }),
);
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Swagger UI serves an inline <script>/<style> page, which the default helmet
// CSP blocks. Scope a relaxed CSP to just this path rather than weakening it
// API-wide; this later helmet() call overwrites the header the earlier one set.
app.use(
  '/api/docs',
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
      },
    },
  }),
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec),
);
app.get('/api/docs.json', (req, res) => {
  res.json(swaggerSpec);
});

app.use('/api/v1', routes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
