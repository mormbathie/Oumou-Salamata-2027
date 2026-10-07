import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BaseExceptionFilter } from '@nestjs/core';

@Catch()
export class RequestErrorFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    response.locals.errorType = exception instanceof Error ? exception.name : 'UnknownError';
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      response.locals.errorCode = exception.code;
      const hints: Record<string, string> = {
        P2002: 'Une valeur unique existe déjà (doublon).',
        P2003: 'Un enregistrement lié est absent ou encore utilisé.',
        P2025: 'Enregistrement demandé introuvable.',
        P2024: 'Délai dépassé pour obtenir une connexion à la base.',
        P2034: 'Conflit entre transactions simultanées.',
      };
      response.locals.errorHint = hints[exception.code] || 'Erreur de base de données ; consulter le code Prisma.';
      // Only schema identifiers, never failed values or SQL from the exception.
      const target = exception.meta?.target;
      response.locals.errorFields = (Array.isArray(target) ? target : typeof target === 'string' ? [target] : [])
        .filter((field): field is string => typeof field === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(field));
    }
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
