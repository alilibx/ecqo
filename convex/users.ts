import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ── Helpers ──

/** Get or create user from Clerk identity. Call from any authenticated mutation. */
export async function getOrCreateUser(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const clerkId = identity.subject;
  const existing = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
    .unique();

  if (existing) return existing;

  const id = await ctx.db.insert("users", {
    clerkId,
    email: identity.email ?? "",
    name: identity.name,
    imageUrl: identity.pictureUrl,
    createdAt: Date.now(),
  });

  return (await ctx.db.get(id))!;
}

/** Get user from Clerk identity (read-only). Throws if not found. */
export async function getUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (!user) throw new Error("User not found");
  return user;
}

/** Get a user's membership in a workspace. Returns null if not a member. */
export async function getMembership(
  ctx: QueryCtx,
  userId: Id<"users">,
  workspaceId: Id<"workspaces">,
) {
  return ctx.db
    .query("memberships")
    .withIndex("by_user_workspace", (q) =>
      q.eq("userId", userId).eq("workspaceId", workspaceId),
    )
    .unique();
}

/** Require a specific role (or any of the given roles). Throws 403-style error if denied. */
export async function requireRole(
  ctx: QueryCtx,
  userId: Id<"users">,
  workspaceId: Id<"workspaces">,
  roles: Array<"owner" | "principal" | "operator">,
) {
  const membership = await getMembership(ctx, userId, workspaceId);
  if (!membership || !roles.includes(membership.role)) {
    throw new Error("Forbidden: insufficient role");
  }
  return membership;
}

// ── Queries ──

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    return user;
  },
});

// ── Mutations ──

/** Called on first login — creates user + personal workspace + owner membership. */
export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getOrCreateUser(ctx);

    // Check if user already has a workspace
    const existingMembership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existingMembership) {
      return { userId: user._id, workspaceId: existingMembership.workspaceId };
    }

    // Create personal workspace
    const workspaceId = await ctx.db.insert("workspaces", {
      name: user.name ? `${user.name}'s workspace` : "My workspace",
      ownerId: user._id,
      createdAt: Date.now(),
    });

    // Add owner membership
    await ctx.db.insert("memberships", {
      workspaceId,
      userId: user._id,
      role: "owner",
      joinedAt: Date.now(),
    });

    return { userId: user._id, workspaceId };
  },
});
