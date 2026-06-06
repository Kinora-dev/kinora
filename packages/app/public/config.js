// Runtime config. Edit this file on your static host - no rebuild needed.
// Leave baseUrl empty in dev to use built-in mock data.
window.__KINORA__ = {
  baseUrl: '', // static: host serving manifest.json + reports/. rest: API root.
  mode: 'static', // 'static' (files) or 'rest' (/api/* endpoints)
  title: 'Kinora',
  // viewerBaseUrl: '/trace/', // where the trace viewer is served (default: /trace/ in prod)
}
