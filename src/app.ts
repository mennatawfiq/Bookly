import { generateOpenApiDocument } from './docs/index';
import express from 'express';
import router from './routes/index';
import { errorHandler } from './middlewares/errorHandler';
import { jsend } from './middlewares/jsend';
import swaggerUi from 'swagger-ui-express';
import morgan from 'morgan';
import helmet from 'helmet';

export const app = express();

app.use(helmet());
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
