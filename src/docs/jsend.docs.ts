import { registry } from './registry';
import { jsendFail, jsendError, failMessage, validationFail } from '../schemas/jsend.schema';

export const MessageFailResponse = registry.register('MessageFailResponse', jsendFail(failMessage));
export const ValidationFailResponse = registry.register(
  'ValidationFailResponse',
  jsendFail(validationFail),
);
export const ServerErrorResponse = registry.register('ServerErrorResponse', jsendError);
