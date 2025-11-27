import { v4 as uuidv4 } from "uuid";
import { loadEventsForAggregate, appendEvents } from "./eventStore.js";

// Rebuild current state of an account from its events
export async function loadAccountState(accountId) {
  const id = String(accountId); // normalize to string
  const events = await loadEventsForAggregate(id);
  console.log("events:", events); // [{id, aggregateId, type, data, timestamp, version}, ...]
  const state = {
    id,
    balance: 0,
    version: 0,
    closed: false,
    owner: null,
  };

  for (const ev of events) {
    switch (ev.type) {
      case "AccountOpened":
        state.owner = ev.data.owner;
        state.balance = ev.data.initialBalance || 0;
        state.version = ev.version;
        state.closed = false;
        break;

      case "MoneyDeposited":
        state.balance += ev.data.amount;
        state.version = ev.version;
        break;

      case "MoneyWithdrawn":
        state.balance -= ev.data.amount;
        state.version = ev.version;
        break;

      case "AccountClosed":
        state.closed = true;
        state.version = ev.version;
        break;

      default:
        // unknown event type – just move version forward
        state.version = ev.version;
    }
  }

  return state;
}

/**
 * Command handlers
 * Each returns the events it appended.
 */

export async function handleOpenAccount({
  accountId = uuidv4(),
  owner,
  initialBalance = 0,
}) {
  const id = String(accountId); // normalize

  const existing = await loadEventsForAggregate(id); // Get existing events for this account
  if (existing.length) {
    const err = new Error("AccountAlreadyExists");
    err.code = "ALREADY_EXISTS";
    throw err;
  }

  // Add AccountOpened event to event store
  const event = {
    id: uuidv4(),
    aggregateId: id,
    type: "AccountOpened",
    data: { owner, initialBalance },
    timestamp: new Date().toISOString(),
    version: 1,
  };

  await appendEvents(id, 0, [event]); // 
  return [event];
}

export async function handleDeposit({ accountId, amount }) {
  const id = String(accountId); // normalize
  const state = await loadAccountState(id);

  if (!state || state.version === 0) {
    const err = new Error("AccountNotFound");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (state.closed) {
    const err = new Error("AccountClosed");
    err.code = "CLOSED";
    throw err;
  }

  const newEvent = {
    id: uuidv4(),
    aggregateId: id,
    type: "MoneyDeposited",
    data: { amount },
    timestamp: new Date().toISOString(),
    version: state.version + 1,
  };

  await appendEvents(id, state.version, [newEvent]);
  return [newEvent];
}

export async function handleWithdraw({ accountId, amount }) {
  const id = String(accountId); // normalize
  const state = await loadAccountState(id);

  if (!state || state.version === 0) {
    const err = new Error("AccountNotFound");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (state.closed) {
    const err = new Error("AccountClosed");
    err.code = "CLOSED";
    throw err;
  }
  if (state.balance < amount) {
    const err = new Error("InsufficientFunds");
    err.code = "INSUFFICIENT";
    throw err;
  }

  const newEvent = {
    id: uuidv4(),
    aggregateId: id,
    type: "MoneyWithdrawn",
    data: { amount },
    timestamp: new Date().toISOString(),
    version: state.version + 1,
  };

  await appendEvents(id, state.version, [newEvent]);
  return [newEvent];
}

export async function handleCloseAccount({ accountId }) {
  const id = String(accountId); // normalize
  const state = await loadAccountState(id);

  if (!state || state.version === 0) {
    const err = new Error("AccountNotFound");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (state.balance !== 0) {
    const err = new Error("BalanceNotZero");
    err.code = "NON_ZERO";
    throw err;
  }

  const newEvent = {
    id: uuidv4(),
    aggregateId: id,
    type: "AccountClosed",
    data: {},
    timestamp: new Date().toISOString(),
    version: state.version + 1,
  };

  await appendEvents(id, state.version, [newEvent]);
  return [newEvent];
}
