import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sync machine state from Fly.io every 60 seconds
crons.interval("sync-fly-machines", { seconds: 60 }, internal.machineSync.syncMachines);

// Process dead-letter queue retries every 30 seconds
crons.interval("process-dlq-retries", { seconds: 30 }, internal.deadLetter.processRetries);

export default crons;
