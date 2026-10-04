import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
// Country database is built into the production image; never send client IPs externally.
process.env.ILA_AUTO_UPDATE = 'false';
process.env.ILA_SILENT = 'true';
process.env.ILA_IP_LOCATION_DB = 'iptoasn-country';
process.env.ILA_SKIP_INITIAL_RELOAD = 'true';
const geo: typeof import('ip-location-api') = require('ip-location-api');
const dataPath = join(dirname(require.resolve('ip-location-api')), '../data');
if (existsSync(dataPath)) void geo.reload(undefined, true);
export function countryForIp(ip: string): string | undefined {
  try {
    const result = geo.lookup(ip.replace(/^::ffff:/, ''));
    if (result && !('then' in result)) return result.country;
  } catch { /* Unavailable or private IP addresses have no estimated country. */ }
  return undefined;
}
