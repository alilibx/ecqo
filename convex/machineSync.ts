/**
 * Convex action that syncs machine state from Fly.io Machines API
 * and each supervisor's /health endpoint.
 *
 * Runs as a cron every 60 seconds to keep waMachines in sync.
 */

import { internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const FLY_APP = "ecqqo-connector";

interface FlyMachine {
  id: string;
  name: string;
  state: string; // "started" | "stopped" | "destroyed" | "replacing" | ...
  region: string;
  config: {
    guest: {
      cpu_kind: string;
      cpus: number;
      memory_mb: number;
    };
  };
  created_at: string;
  updated_at: string;
}

interface SupervisorHealth {
  status: string;
  machineId: string;
  region: string;
  workers: number;
  maxWorkers: number;
  memoryUsagePercent: number;
  memoryTotalMB: number;
  memoryFreeMB: number;
  uptime: number;
}

interface SupervisorSessions {
  sessions: Array<{
    sessionId: string;
    status: string;
    startedAt: number;
    memoryMB: number;
    restartCount: number;
    uptimeMs: number;
  }>;
}

export const syncMachines = internalAction({
  handler: async (ctx) => {
    const flyToken = process.env.FLY_API_TOKEN;
    if (!flyToken) {
      console.error("[machineSync] FLY_API_TOKEN not set");
      return;
    }

    // 1. List all machines from Fly API
    const res = await fetch(
      `https://api.machines.dev/v1/apps/${FLY_APP}/machines`,
      { headers: { Authorization: `Bearer ${flyToken}` } },
    );

    if (!res.ok) {
      console.error(`[machineSync] Fly API error: ${res.status}`);
      return;
    }

    const machines: FlyMachine[] = await res.json();

    // 2. For each started machine, fetch supervisor health + sessions
    for (const machine of machines) {
      if (machine.state === "started") {
        try {
          // Fetch health from supervisor via Fly proxy (internal .flycast address)
          const healthRes = await fetch(
            `https://${FLY_APP}.fly.dev/health`,
            {
              headers: {
                "Fly-Force-Instance-Id": machine.id,
              },
              signal: AbortSignal.timeout(5000),
            },
          );

          if (!healthRes.ok) throw new Error(`Health ${healthRes.status}`);
          const health: SupervisorHealth = await healthRes.json();

          // Fetch sessions
          const sessionsRes = await fetch(
            `https://${FLY_APP}.fly.dev/sessions`,
            {
              headers: {
                "Fly-Force-Instance-Id": machine.id,
              },
              signal: AbortSignal.timeout(5000),
            },
          );

          const sessionsData: SupervisorSessions = sessionsRes.ok
            ? await sessionsRes.json()
            : { sessions: [] };

          // Calculate total worker memory
          const totalWorkerMemory = sessionsData.sessions.reduce(
            (sum, s) => sum + s.memoryMB,
            0,
          );

          await ctx.runMutation(internal.machineSync.upsertMachine, {
            machineId: machine.id,
            region: machine.region,
            status: "active",
            workerCount: health.workers,
            maxWorkers: health.maxWorkers,
            memoryUsageMB: totalWorkerMemory,
            flyState: machine.state,
            cpuKind: machine.config.guest.cpu_kind,
            cpus: machine.config.guest.cpus,
            memoryTotalMB: health.memoryTotalMB,
            memoryFreeMB: health.memoryFreeMB,
            memoryUsagePercent: health.memoryUsagePercent,
            uptime: Math.round(health.uptime),
          });
        } catch (err) {
          console.error(
            `[machineSync] Failed to reach ${machine.id}:`,
            err instanceof Error ? err.message : err,
          );
          // Machine is started but supervisor not responding — mark as active with stale data
          await ctx.runMutation(internal.machineSync.upsertMachine, {
            machineId: machine.id,
            region: machine.region,
            status: "active",
            workerCount: 0,
            maxWorkers: 20,
            memoryUsageMB: 0,
            flyState: machine.state,
          });
        }
      } else {
        // Machine is stopped/destroyed — mark offline
        await ctx.runMutation(internal.machineSync.upsertMachine, {
          machineId: machine.id,
          region: machine.region,
          status: "offline",
          workerCount: 0,
          maxWorkers: 20,
          memoryUsageMB: 0,
          flyState: machine.state,
        });
      }
    }

    // 3. Mark machines in Convex that aren't in Fly anymore as offline
    const flyMachineIds = new Set(machines.map((m) => m.id));
    await ctx.runMutation(internal.machineSync.pruneStale, {
      activeMachineIds: [...flyMachineIds],
    });
  },
});

// ── Internal mutations ──

import { internal } from "./_generated/api";

export const upsertMachine = internalMutation({
  args: {
    machineId: v.string(),
    region: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("draining"),
      v.literal("offline"),
    ),
    workerCount: v.number(),
    maxWorkers: v.number(),
    memoryUsageMB: v.number(),
    flyState: v.optional(v.string()),
    cpuKind: v.optional(v.string()),
    cpus: v.optional(v.number()),
    memoryTotalMB: v.optional(v.number()),
    memoryFreeMB: v.optional(v.number()),
    memoryUsagePercent: v.optional(v.number()),
    uptime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("waMachines")
      .withIndex("by_machineId", (q) => q.eq("machineId", args.machineId))
      .unique();

    const data = {
      machineId: args.machineId,
      region: args.region,
      status: args.status,
      workerCount: args.workerCount,
      maxWorkers: args.maxWorkers,
      memoryUsageMB: args.memoryUsageMB,
      lastHealthAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("waMachines", data);
    }
  },
});

export const pruneStale = internalMutation({
  args: {
    activeMachineIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const activeSet = new Set(args.activeMachineIds);
    const machines = await ctx.db.query("waMachines").collect();

    for (const machine of machines) {
      if (!activeSet.has(machine.machineId)) {
        // Machine no longer exists in Fly — delete it
        await ctx.db.delete(machine._id);
      }
    }
  },
});
