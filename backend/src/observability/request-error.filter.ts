import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

@Catch()
export class RequestErrorFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    response.locals.errorType = exception instanceof Error ? exception.name : 'UnknownError';
    if (!(exception instanceof HttpException)) {
      response.locals.errorFrames = exception instanceof Error ? exception.stack?.split('\n').slice(1, 6).filter(line => /^\s+at /.test(line)) : [];
      // Do not forward SQL, tokens or personal records from internal exception messages.
      response.status(500).json({ statusCode: 500, message: 'Internal server error' });
      return;
    }
    // Preserve Nest responses, with the request reference available to support.
    super.catch(exception, host);
  }
}
