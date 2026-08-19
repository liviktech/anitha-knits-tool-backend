import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { env, isProduction } from './config/env.js';
import { swaggerSpec } from './config/swagger.js';
import routes from './routes/index.js';
import { notFoundHandler } from './middlewares/notFoundHandler.js';
import { errorHandler } from './middlewares/errorHandler.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(
    cors({
        origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : false,
    }),
);
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
