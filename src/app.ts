import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { env, isProduction } from './config/env.js';
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

app.use('/api/v1', routes);
app.use(notFoundHandler);
app.use(errorHandler);
