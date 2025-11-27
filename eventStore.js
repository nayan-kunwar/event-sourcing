import fs from "fs";
import { promisify } from "util";
const appendFile = promisify(fs.appendFile);
const readFile = promisify(fs.readFile);
const EVENTS_FILE = "./events.log"; // newline-delimited JSON events

// Ensure file exists
if (!fs.existsSync(EVENTS_FILE)) fs.writeFileSync(EVENTS_FILE, "");

// Load all events for a specific aggregate (account) ID
export async function loadEventsForAggregate(aggregateId) {
  const raw = await readFile(EVENTS_FILE, "utf8");
  if (!raw) return [];
  const lines = raw.trim().split("\n").filter(Boolean);
  const events = lines.map((line) => JSON.parse(line));
  return events.filter((e) => String(e.aggregateId) === String(aggregateId));
}

// Load all events from the event store 
export async function loadAllEvents() {
  const raw = await readFile(EVENTS_FILE, "utf8");
  console.log("raw: ", raw)
  if (!raw) return [];
  return raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/**
 * Append events for an aggregate with optimistic concurrency.
 * expectedVersion = last known version of the aggregate (0 if none)
 * events = array of event objects (each must include version)
 */
export async function appendEvents(aggregateId, expectedVersion, events) {
  // read last event version for aggregate
  const existing = await loadEventsForAggregate(aggregateId);
  const lastVersion = existing.length
    ? existing[existing.length - 1].version
    : 0;
  if (lastVersion !== expectedVersion) {
    const err = new Error("ConcurrencyException: expectedVersion mismatch");
    err.code = "CONCURRENCY";
    throw err;
  }

  // write events to file (one JSON per line)
  const lines = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await appendFile(EVENTS_FILE, lines, "utf8");
}
