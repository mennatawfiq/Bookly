import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry';

export const generateOpenApiDocument = () => {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Bookly API',
      version: '1.0.0',
      description: 'API for the Bookly event and ticket booking system.',
    },
  });
};
