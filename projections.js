import { loadAllEvents } from "./eventStore.js";

// In-memory projection
const accounts = new Map();
console.log("in memory projection: ", accounts);
/**
 * Apply a single event to the in-memory projection
 */
function applyEventToProjection(ev) {
  const id = String(ev.aggregateId);
  console.log("accounts projection 1: ", accounts);
  let p = accounts.get(id) || {
    id,
    owner: null,
    balance: 0,
    version: 0,
    closed: false,
  };
  // protect against duplicate processing: only apply events with higher version than projection
  if (ev.version <= p.version) return;
  switch (ev.type) {
    case "AccountOpened":
      p.owner = ev.data.owner;
      p.balance = ev.data.initialBalance || 0;
      p.version = ev.version;
      p.closed = false;
      break;
    case "MoneyDeposited":
      p.balance += ev.data.amount;
      p.version = ev.version;
      break;
    case "MoneyWithdrawn":
      p.balance -= ev.data.amount;
      p.version = ev.version;
      break;
    case "AccountClosed":
      p.closed = true;
      p.version = ev.version;
      break;
    default:
      p.version = ev.version;
  }
  accounts.set(id, p);
}

/**
 * rebuildProjection: rebuilds read model from scratch
 */
export async function rebuildProjection() {
  accounts.clear();
  const events = await loadAllEvents();
  console.log("events in rebuildProjection: ", events);
  // events are in file order (assumes append order == time order)
  for (const ev of events) applyEventToProjection(ev);
}

/**
 * apply new events (useful when you persist and then want to update projection)
 */
export function applyEvents(events) {
  for (const ev of events) applyEventToProjection(ev);
}

export function getAccountProjection(accountId) {
  console.log("inside getAccountProjection: ", accounts);
  return accounts.get(String(accountId)) || null;
}

export function getAllAccountProjections() {
  return Array.from(accounts.values());
}
