import { countryForIp } from './country';
import { randomUUID } from 'node:crypto';
import { context, trace } from '@opentelemetry/api';
import type { Request, Response, NextFunction } from 'express';

const allowed = /^(id|.*Id|amount|quantity|date|startDate|endDate|year|level|capacity|coefficient|role|enabled|status|type|format|model|page|limit|restDays|startTime|timeZone|label|description|name)$/;
const privateKey = /password|passphrase|token|secret|cookie|authorization|totp|otp|code|qr|email|phone|address|birth|medical|firstName|lastName|username|content|document|file/i;
export function safeInputs(value: unknown, depth = 0): unknown {
  if (depth > 3) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 10).map(v => safeInputs(v, depth + 1));
  if (!value || typeof value !== 'object') return typeof value === 'string' ? safeText(value) : value;
  return Object.fromEntries(Object.entries(value).slice(0, 40).map(([key, item]) => [
    key.slice(0, 64), privateKey.test(key) || !allowed.test(key) ? '[redacted]' : safeInputs(item, depth + 1),
  ]));
}
export function safeText(value: unknown): string {
  return String(value).slice(0, 500).replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email]')
    .replace(/Bearer\s+\S+|eyJ[\w.-]+|[A-Za-z0-9_+\/-]{40,}/g, '[secret]');
}
export function requestLog(req: Request, res: Response, next: NextFunction) {
  const correlationId = randomUUID();
  const span = trace.getSpan(context.active());
  span?.setAttribute('app.correlation_id', correlationId);
  const spanContext = span?.spanContext();
  const started = performance.now();
  res.setHeader('X-Correlation-ID', correlationId);
  res.locals.correlationId = correlationId;
  const json = res.json.bind(res);
  res.json = ((body: any) => {
    if (res.statusCode >= 400) res.locals.requestError = body?.message || body?.error || 'Request failed';
    return json(body);
  }) as Response['json'];
  let written = false;
  const write = (aborted = false) => {
    if (written) return;
    written = true;
    const user = (req as Request & { user?: any }).user;
    const ua = safeText(req.headers['user-agent'] || 'unknown');
    const status = aborted ? 499 : res.statusCode;
    const country = countryForIp(req.ip || '');
    const event: Record<string, unknown> = {
      event: 'http.request', severity: status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO',
      correlation_id: correlationId, trace_id: spanContext?.traceId, span_id: spanContext?.spanId,
      trace_sampled: Boolean(spanContext && (spanContext.traceFlags & 1)),
      method: req.method, route: req.route?.path || req.path, status_code: status,
      outcome: status >= 400 ? 'error' : 'success', duration_ms: Math.round((performance.now() - started) * 100) / 100,
      account: user ? { id: user.userId || user.keycloakId || user.id, username: safeText(user.username || ''), roles: user.roles || (user.role ? [user.role] : []) } : { authenticated: false },
      device: { user_agent: ua, type: /tablet|ipad/i.test(ua) ? 'tablet' : /mobile|android|iphone/i.test(ua) ? 'mobile' : 'desktop',
        browser: /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'unknown',
        os: /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'unknown' },
      client_ip: req.ip, location: { source: 'ip-country', approximate: true, available: Boolean(country), country },
    };
    event.account_id = user?.userId || user?.keycloakId || user?.id;
    event.account_username = user?.username ? safeText(user.username) : undefined;
    event.account_roles = user?.roles || (user?.role ? [user.role] : []);
    event.device_type = (event.device as any).type;
    event.location_country = country;
    if (status >= 400) {
      event.error = { type: res.locals.errorType || 'HttpError', message: Array.isArray(res.locals.requestError) ? res.locals.requestError.map(safeText) : safeText(res.locals.requestError || (aborted ? 'Connection closed' : 'Request failed')) };
      event.error_message = (event.error as any).message;
      if (res.locals.errorFrames) (event.error as any).frames = res.locals.errorFrames;
      // Capture useful business values only on failures; never log auth bodies or uploaded files.
      event.input = req.path.startsWith('/api/auth') || req.path.includes('/password') || req.path.includes('/two-factor') || req.path.includes('/scan') ? '[redacted]' : { body: safeInputs(req.body), query: safeInputs(req.query), params: safeInputs(req.params) };
    }
    if (event.input && JSON.stringify(event.input).length > 4096) event.input = { truncated: true, reason: 'Input exceeds log limit' };
    if (span?.isRecording()) span.setAttributes({ 'app.correlation_id': correlationId, 'app.account_id': user?.userId || user?.id || '', 'app.outcome': status >= 400 ? 'error' : 'success' });
    console.log(JSON.stringify(event));
  };
  res.once('finish', () => write());
  res.once('close', () => { if (!res.writableFinished) write(true); });
  next();
}
