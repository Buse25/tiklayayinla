import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, PayloadTooLargeException, UnprocessableEntityException } from '@nestjs/common';
import { MulterError } from 'multer';
import type { Response } from 'express';

@Catch(MulterError, PayloadTooLargeException)
export class MulterValidationFilter implements ExceptionFilter {
  catch(exception: MulterError | PayloadTooLargeException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const multerCode = exception instanceof MulterError ? exception.code : undefined;
    const message = multerCode === 'LIMIT_FILE_COUNT' ? 'Bir istekte en fazla 30 görsel yüklenebilir.' : 'Her görsel en fazla 10 MB olabilir.';
    response.status(HttpStatus.UNPROCESSABLE_ENTITY).json(new UnprocessableEntityException(message).getResponse());
  }
}
