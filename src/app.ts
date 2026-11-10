import { generateOpenApiDocument } from './docs/index';
import express from 'express';
import router from './routes/index';
import { errorHandler } from './middlewares/errorHandler';
import { jsend } from './middlewares/jsend';
import swaggerUi from 'swagger-ui-express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';

export const app = express();

// set HSTS in production
app.use(
  helmet({
    strictTransportSecurity:
      process.env.NODE_ENV === 'production'
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
          }
        : false,
  }),
);

const clientOrigin =
  process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_ORIGIN_PROD
    : process.env.CLIENT_ORIGIN_DEV;

// if CLIENT_ORIGIN is undefined, the CORS package can fall back to allowing all origins
if (!clientOrigin) {
  throw new Error('CLIENT_ORIGIN environment variable is required');
}

app.use(
  cors({
    origin: clientOrigin,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(morgan('dev'));
app.use(express.json());
app.use(jsend);

// api documentation isn't available in production env so it doesn't conflict with CSP
if (process.env.NODE_ENV !== 'production') {
  const openapiDocument = generateOpenApiDocument();

  app.get('/openapi.json', (req, res) => res.json(openapiDocument)); // for postman
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));
}

app.use('/', router);

app.use(errorHandler);
