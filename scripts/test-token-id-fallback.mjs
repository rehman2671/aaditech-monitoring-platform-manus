function createClientRowId(prefix) {
  const runtimeCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (runtimeCrypto && typeof runtimeCrypto.randomUUID === 'function') {
    return `${prefix}-${runtimeCrypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const originalCrypto = globalThis.crypto;
try {
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {} });
  const value = createClientRowId('token');
  if (!/^token-\d+-[a-z0-9]+$/.test(value)) {
    throw new Error(`Unexpected fallback ID: ${value}`);
  }
  console.log(`fallback-ok:${value}`);
} finally {
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: originalCrypto });
}
