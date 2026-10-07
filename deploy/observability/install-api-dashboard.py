#!/usr/bin/env python3
"""Run on VPS: sudo python3 install-api-dashboard.py dashboard-api.json.
Uses the private existing SigNoz account; never prints credentials or tokens.
"""
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

config = json.loads(Path('/opt/assakina-observability/signoz-access.json').read_text())
def call(path, data=None, method=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request('http://127.0.0.1:3301' + path,
        data=json.dumps(data).encode() if data is not None else None, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            return json.load(response)['data']
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'SigNoz {path}: HTTP {error.code}: {error.read().decode()[:1200]}') from None

token = call('/api/v2/sessions/email_password', {key: config[key] for key in ['email','password','orgId']})['accessToken']
dashboard = json.loads(Path(sys.argv[1]).read_text())
# Execute each panel first: reject invalid queries before publishing a dashboard.
end = int(time.time() * 1000)
for panel in dashboard['spec']['panels'].values():
    query = panel['spec']['queries'][0]['spec']['plugin']['spec']
    result = call('/api/v5/query_range', {'start': end-3600000, 'end':end,
        'requestType':'time_series', 'compositeQuery':query}, token=token)
    if isinstance(result, dict) and result.get('errors'):
        raise RuntimeError('Panel query returned errors: ' + panel['spec']['display']['name'])
    print('Validated:', panel['spec']['display']['name'])
existing = next((d for d in call('/api/v2/dashboards', token=token)['dashboards'] if d['name']==dashboard['name']), None)
if existing:
    result = call('/api/v2/dashboards/'+existing['id'], dashboard, method='PUT', token=token)
else:
    result = call('/api/v2/dashboards', dashboard, token=token)
print(json.dumps({'dashboard_id':result.get('id'), 'name':dashboard['spec']['display']['name']}))
