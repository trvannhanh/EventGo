// app.config.js - dynamic Expo config to inject .env into Constants.expoConfig.extra
const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  const envPath = path.resolve(__dirname, file);
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

module.exports = ({ config }) => {
  const env = {
    ...loadEnv('.env'),
    ...loadEnv('.env.local'),
  };

  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android.config,
        googleMaps: {
          apiKey: env.GOOGLE_MAPS_API_KEY || config.android.config.googleMaps.apiKey,
        },
      },
    },
    extra: {
      ...(config.extra || {}),
      ...env,
    },
  };
};
