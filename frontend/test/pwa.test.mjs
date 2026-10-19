import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const workerSource = readFileSync(new URL('../pwa/service-worker.js', import.meta.url), 'utf8');
function worker() {
  const events = {}, stores = new Map(), requests = [];
  let networkError = false, skipped = 0, claimed = 0;
  const cache = name => {
    if (!stores.has(name)) stores.set(name, new Map());
    return { add: async request => { requests.push(request); stores.get(name).set('/offline.html', new Response('Public offline notice')); }, match: async key => stores.get(name).get(key) };
  };
  vm.runInNewContext(workerSource.replace('__BUILD_VERSION__', 'test-version'), {
    self: { location: { origin: 'https://school.test' }, addEventListener: (name, fn) => events[name] = fn, skipWaiting: () => skipped++, clients: { claim: async () => claimed++ } },
    caches: { open: async name => cache(name), keys: async () => [...stores.keys()], delete: async name => stores.delete(name) },
    Request: class { constructor(url, options) { this.url = url; Object.assign(this, options); } },
    URL, Response, fetch: async () => { if (networkError) throw Error('Offline'); return new Response('Network-only page'); },
  });
  return { events, stores, requests, fail: () => networkError = true, counts: () => ({ skipped, claimed }) };
}
const navigate = url => ({ url, mode: 'navigate', method: 'GET' });
const wait = (w, name) => { let promise; w.events[name]({ waitUntil: value => promise = value }); return promise; };
test('only public offline page is precached, without credentials', async () => {
  const w = worker(); await wait(w, 'install');
  assert.equal(w.requests.length, 1); assert.equal(w.requests[0].url, '/offline.html'); assert.equal(w.requests[0].credentials, 'omit');
  assert.deepEqual([...w.stores.values()].flatMap(x => [...x.keys()]), ['/offline.html']);
  assert.equal(w.counts().skipped, 0, 'No forced activation during a payment form');
});
test('online pages remain network-only; failed navigation displays a public notice', async () => {
  const w = worker(); await wait(w, 'install');
  let response; w.events.fetch({ request: navigate('https://school.test/students?private=1'), respondWith: value => response = value });
  assert.equal(await (await response).text(), 'Network-only page');
  w.fail(); w.events.fetch({ request: navigate('https://school.test/students'), respondWith: value => response = value });
  assert.equal(await (await response).text(), 'Public offline notice');
  assert.deepEqual([...w.stores.values()].flatMap(x => [...x.keys()]), ['/offline.html']);
});
test('API, downloads, authentication, external requests and writes are never intercepted', () => {
  const w = worker();
  for (const request of [navigate('https://school.test/api'), navigate('https://school.test/api/students'), navigate('https://school.test/api/documents/file'), navigate('https://school.test/auth/login'), navigate('https://auth.school.test/realms/school'), { ...navigate('https://school.test/api/finances/payments'), method: 'POST' }, { ...navigate('https://school.test/assets/app.js'), mode: 'cors' }]) {
    w.events.fetch({ request, respondWith: () => assert.fail('Must stay on the network') });
  }
  assert.equal(w.stores.size, 0);
});
test('updates clean only app-owned caches and activate only when explicitly requested', async () => {
  const w = worker(); w.stores.set('assakina-offline-old', new Map()); w.stores.set('other-app', new Map()); await wait(w, 'install'); await wait(w, 'activate');
  assert.equal(w.stores.has('assakina-offline-old'), false); assert.equal(w.stores.has('other-app'), true);
  w.events.message({ data: { type: 'UNRELATED' } }); assert.equal(w.counts().skipped, 0);
  w.events.message({ data: { type: 'SKIP_WAITING' } }); assert.equal(w.counts().skipped, 1); assert.equal(w.counts().claimed, 1);
});
test('manifest contains a stable identity and real correctly-sized icons', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url)));
  assert.equal(manifest.id, '/'); assert.equal(manifest.scope, '/'); assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const data = readFileSync(new URL('../public' + icon.src, import.meta.url));
    assert.equal(data.subarray(1, 4).toString(), 'PNG'); assert.equal(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`, icon.sizes);
  }
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
});
