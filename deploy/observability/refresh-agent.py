#!/usr/bin/env python3
"""Refresh only application log paths after container replacement; never read log contents."""
import json, pathlib, subprocess
root = pathlib.Path('/opt/assakina-observability')
receivers = {'hostmetrics': {'root_path': '/hostfs', 'collection_interval': '30s', 'scrapers': {'cpu': {}, 'memory': {}, 'disk': {}, 'filesystem': {}, 'network': {}, 'load': {}}}}
for name in ['backend', 'frontend', 'keycloak', 'caddy', 'postgres', 'keycloak_postgres']:
    path = subprocess.check_output(['docker', 'inspect', 'oumou_salamat_' + name, '--format', '{{.LogPath}}'], text=True).strip()
    if not path.startswith('/var/lib/docker/containers/'):
        raise SystemExit('Unexpected Docker log path')
    receivers['filelog/' + name] = {'include': [path], 'start_at': 'beginning', 'storage': 'file_storage', 'operators': [{'type': 'json_parser', 'timestamp': {'parse_from': 'attributes.time', 'layout_type': 'gotime', 'layout': '2006-01-02T15:04:05.999999999Z07:00'}}, {'type': 'move', 'from': 'attributes.log', 'to': 'body'}], 'resource': {'service.name': 'as-sakina-' + name, 'deployment.environment': 'production'}}
config = {'receivers': receivers, 'extensions': {'file_storage': {'directory': '/var/lib/otelcol'}}, 'processors': {'memory_limiter': {'check_interval': '1s', 'limit_mib': 150, 'spike_limit_mib': 30}, 'batch': {'send_batch_size': 256, 'timeout': '5s'}, 'resource': {'attributes': [{'key': 'host.name', 'value': 'as-sakina-vps', 'action': 'upsert'}]}}, 'exporters': {'otlphttp': {'endpoint': 'http://assakina-monitoring-ingester:4318'}}, 'service': {'extensions': ['file_storage'], 'pipelines': {'metrics': {'receivers': ['hostmetrics'], 'processors': ['memory_limiter', 'resource', 'batch'], 'exporters': ['otlphttp']}, 'logs': {'receivers': [key for key in receivers if key.startswith('filelog/')], 'processors': ['memory_limiter', 'resource', 'batch'], 'exporters': ['otlphttp']}}}}
root.mkdir(parents=True, exist_ok=True)
(root / 'agent.yaml').write_text(json.dumps(config, indent=2))
subprocess.run(['docker', 'compose', '-f', str(root / 'agent.compose.yaml'), 'up', '-d', '--force-recreate'], check=True)
