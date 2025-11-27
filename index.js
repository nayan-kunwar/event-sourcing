// index.js
import express from "express";
import {
  handleOpenAccount,
  handleDeposit,
  handleWithdraw,
  loadAccountState,
} from "./accountAggregate.js";
import {
  rebuildProjection,
  applyEvents,
  getAccountProjection,
  getAllAccountProjections,
} from "./projections.js";
import { loadAllEvents } from "./eventStore.js";

const app = express();
app.use(express.json());

// Open account
app.post("/accounts", async (req, res) => {
  try {
    const { accountId, owner, initialBalance } = req.body;
    const events = await handleOpenAccount({
      accountId,
      owner,
      initialBalance,
    });
    // update projection
    applyEvents(events);
    res.status(201).json({ success: true, events });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Deposit
app.post("/accounts/:id/commands/deposit", async (req, res) => {
  try {
    const accountId = req.params.id;
    const { amount } = req.body;
    const events = await handleDeposit({ accountId, amount });
    applyEvents(events);
    res.status(200).json({ success: true, events });
  } catch (err) {
    if (err.code === "CONCURRENCY")
      return res.status(409).json({ error: err.message });
    res.status(400).json({ error: err.message });
  }
});

// Withdraw
app.post("/accounts/:id/commands/withdraw", async (req, res) => {
  try {
    const accountId = req.params.id;
    const { amount } = req.body;
    const events = await handleWithdraw({ accountId, amount });
    applyEvents(events);
    res.status(200).json({ success: true, events });
  } catch (err) {
    if (err.code === "CONCURRENCY")
      return res.status(409).json({ error: err.message });
    res.status(400).json({ error: err.message });
  }
});

// Read projection
app.get("/accounts/:id", async (req, res) => {
  const accountId = req.params.id;
  const p = getAccountProjection(accountId);
  if (!p)
    return res.status(404).json({ error: "Account projection not found" });
  res.json(p); 
});

// Rebuild projection (admin)
app.post("/rebuild-projection", async (req, res) => {
  await rebuildProjection();
  res.json({ success: true, count: (await loadAllEvents()).length });
});

// get all projections
app.get("/accounts", (req, res) => {
  res.json(getAllAccountProjections());
});

const PORT = 3000;
(async () => {
  // on start, build the read model from events file
  await rebuildProjection();
  app.listen(PORT, () =>
    console.log(`Event Sourcing demo running on http://localhost:${PORT}`)
  );
})();
