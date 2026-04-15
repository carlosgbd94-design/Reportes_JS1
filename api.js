/**
 * JS1 Reportes - API Client
 * Implementación de Batching Inteligente.
 */

import { store } from './store.js';

const GAS_API_URL = "https://script.google.com/macros/s/AKfycby3en_qswj1PmE6o80nypsDM6Gw4kueRUimNSgMKJxzDojRFCsXBjFZngR9UpnkYL0n/exec";

const IMMEDIATE_ACTIONS = [
  "login", "whoami", "searchLote", "searchFolio", "validateStock"
];

let batchQueue = [];
let batchTimer = null;

export async function apiCall(actionOrPayload, payload = {}, options = {}) {
  let body = {};
  const currentToken = store.state.token || window.TOKEN; 

  if (typeof actionOrPayload === "string") {
    body = { ...payload, action: actionOrPayload, token: payload.token || currentToken };
  } else {
    body = { ...actionOrPayload, token: actionOrPayload.token || currentToken };
  }

  if (options.forceImmediate || IMMEDIATE_ACTIONS.includes(body.action)) {
    return execFetch(body);
  }

  return new Promise((resolve, reject) => {
    batchQueue.push({ body, resolve, reject });
    if (!batchTimer) batchTimer = setTimeout(processBatch, 50);
  });
}

async function execFetch(body) {
  try {
    const res = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify(body)
    });
    return await res.json();
  } catch (err) {
    console.error(`API Error [${body.action}]:`, err);
    return { ok: false, error: err.message };
  }
}

async function processBatch() {
  const currentQueue = [...batchQueue];
  batchQueue = [];
  batchTimer = null;

  if (currentQueue.length === 0) return;
  if (currentQueue.length === 1) {
    const { body, resolve } = currentQueue[0];
    resolve(await execFetch(body));
    return;
  }

  const batchBody = {
    action: "batch",
    token: store.state.token || window.TOKEN,
    actions: currentQueue.map(q => q.body)
  };

  const response = await execFetch(batchBody);

  if (response.ok && Array.isArray(response.data)) {
    response.data.forEach((res, index) => currentQueue[index].resolve(res));
  } else {
    const errorMsg = response.error || "Error en Batch";
    currentQueue.forEach(q => q.resolve({ ok: false, error: errorMsg }));
  }
}
