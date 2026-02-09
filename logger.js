function ts() {
  return new Date().toISOString();
}

function info(msg, meta = {}) {
  console.log(`[INFO  ${ts()}] ${msg}`, Object.keys(meta).length ? meta : '');
}

function warn(msg, meta = {}) {
  console.warn(`[WARN  ${ts()}] ${msg}`, Object.keys(meta).length ? meta : '');
}

function error(msg, meta = {}) {
  console.error(`[ERROR ${ts()}] ${msg}`, Object.keys(meta).length ? meta : '');
}

module.exports = { info, warn, error };
