import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sync machine state from Fly.io every 60 seconds
crons.interval("sync-fly-machines", { seconds: 60 }, internal.machineSync.syncMachines);

// Process dead-letter queue retries every 30 seconds
crons.interval("process-dlq-retries", { seconds: 30 }, internal.deadLetter.processRetries);

// Trigger periodic sync for connected accounts every 5 minutes
crons.interval("trigger-periodic-sync", { minutes: 5 }, internal.sync.triggerPeriodicSync);

// Detect and fail stale sync jobs (running > 5 min) every 5 minutes
crons.interval("fail-stale-sync-jobs", { minutes: 5 }, internal.sync.failStaleJobs);

// Nightly reconciliation — validate cursor consistency, rebuild if needed (daily at 2:00 AM UTC)
crons.cron("nightly-sync-reconciliation", "0 2 * * *", internal.sync.nightlyReconciliation);

export default crons;
