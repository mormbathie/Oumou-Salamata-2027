import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { resourceFromAttributes } from '@opentelemetry/resources';

// Loaded before Nest and HTTP. No collector configuration means no instrumentation.
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': 'as-sakina-api',
      'deployment.environment': process.env.NODE_ENV || 'development',
    }),
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      new HttpInstrumentation({
        ignoreOutgoingRequestHook: () => true,
        responseHook(span) {
          // No authentication headers, payloads or URL query parameters in traces.
          for (const key of ['http.url', 'http.target', 'url.full', 'url.query']) {
            span.setAttribute(key, '[redacted]');
          }
        },
      }),
      new ExpressInstrumentation(),
    ],
  });
  sdk.start();
  process.on('SIGTERM', () => { void sdk.shutdown(); });
}
