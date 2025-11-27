import fs from "fs/promises";
const SNAPSHOT_FILE = "./snapshots.json";

export async function loadSnapshot(aggregateId) {
  try {
    const raw = await fs.readFile(SNAPSHOT_FILE, "utf8");
    const obj = JSON.parse(raw || "{}");
    return obj[aggregateId] || null;
  } catch (e) {
    return null;
  }
}

export async function saveSnapshot(aggregateId, snapshot) {
  let obj = {};
  try {
    const raw = await fs.readFile(SNAPSHOT_FILE, "utf8");
    obj = JSON.parse(raw || "{}");
  } catch (e) {
    obj = {};
  }
  obj[aggregateId] = snapshot;
  await fs.writeFile(SNAPSHOT_FILE, JSON.stringify(obj, null, 2), "utf8");
}
