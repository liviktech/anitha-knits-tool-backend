import express from 'express';
import helmetImport from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { env, isProduction } from './config/env.js';
import { swaggerSpec } from './config/swagger.js';
import routes from './routes/index.js';
import { notFoundHandler } from './middlewares/notFoundHandler.js';
import { errorHandler } from './middlewares/errorHandler.js';

const helmet = helmetImport as unknown as typeof import('helmet').default;

// Render sets this automatically on every web service. The Swagger docs page is served from
// this same origin (/api/docs), and its "Try it out" requests carry it as their Origin header —
// without allowing it explicitly, testing the API from its own docs page gets CORS-rejected.
const SELF_ORIGIN = process.env.RENDER_EXTERNAL_URL;

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
// In development, reflect whatever Origin the request sends (`origin: true`)
// so the frontend is never blocked regardless of which local port it runs on.
// In production, only trust origins in CORS_ORIGINS (comma-separated, see
// .env.example) plus the API's own origin (Swagger UI) — `credentials: true`
// is what allows the auth cookie to be sent/read cross-origin, so the
// allowlist is what stands between "any site" and "only our frontend" for
// credentialed requests.
app.use(
    cors({
        origin: isProduction
            ? (origin, callback) => {
                  if (!origin || origin === SELF_ORIGIN || env.CORS_ORIGINS.includes(origin)) {
                      callback(null, true);
                  } else {
                      callback(new Error(`Origin not allowed by CORS: ${origin}`));
                  }
              }
            : true,
        credentials: true,
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
