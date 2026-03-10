import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUser, getMembership, requireRole } from "./users";

// ── Queries ──

/** List workspaces the current user is a member of. Returns [] if user record doesn't exist yet. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) return [];

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const workspaces = await Promise.all(
      memberships.map(async (m) => {
        const ws = await ctx.db.get(m.workspaceId);
        return ws ? { ...ws, role: m.role } : null;
      }),
    );

    return workspaces.filter(Boolean);
  },
});

/** List members of a workspace. Requires membership. */
export const listMembers = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const user = await getUser(ctx);
    await requireRole(ctx, user._id, workspaceId, ["owner", "principal", "operator"]);

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    const members = await Promise.all(
      memberships.map(async (m) => {
        const u = await ctx.db.get(m.userId);
        return u
          ? { userId: u._id, email: u.email, name: u.name, imageUrl: u.imageUrl, role: m.role, joinedAt: m.joinedAt }
          : null;
      }),
    );

    return members.filter(Boolean);
  },
});

/** Get the current user's role in a workspace. Returns null if not a member. */
export const getMyRole = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const user = await getUser(ctx);
    const membership = await getMembership(ctx, user._id, workspaceId);
    if (!membership) return null;
    return { role: membership.role, workspaceId };
  },
});

// ── Mutations ──

/** Invite a member to a workspace. Requires owner role. */
export const inviteMember = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.union(v.literal("principal"), v.literal("operator")),
  },
  handler: async (ctx, { workspaceId, email, role }) => {
    const user = await getUser(ctx);
    await requireRole(ctx, user._id, workspaceId, ["owner"]);

    // V1: Only one principal per workspace
    if (role === "principal") {
      const existingPrincipal = await ctx.db
        .query("memberships")
        .withIndex("by_workspace_role", (q) =>
          q.eq("workspaceId", workspaceId).eq("role", "principal"),
        )
        .first();
      if (existingPrincipal) {
        throw new Error("Workspace already has a principal");
      }
    }

    // Find the target user by email
    // Note: In V1, the invited user must already have a Clerk account
    const targetUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), email.trim().toLowerCase()))
      .first();

    if (!targetUser) {
      throw new Error("User not found. They must sign up first.");
    }

    // Check not already a member
    const existing = await getMembership(ctx, targetUser._id, workspaceId);
    if (existing) {
      throw new Error("User is already a member of this workspace");
    }

    await ctx.db.insert("memberships", {
      workspaceId,
      userId: targetUser._id,
      role,
      joinedAt: Date.now(),
    });

    return { userId: targetUser._id, role };
  },
});

/** Change a member's role. Requires owner role. Cannot change own role. */
export const changeRole = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    targetUserId: v.id("users"),
    newRole: v.union(v.literal("principal"), v.literal("operator")),
  },
  handler: async (ctx, { workspaceId, targetUserId, newRole }) => {
    const user = await getUser(ctx);
    await requireRole(ctx, user._id, workspaceId, ["owner"]);

    if (user._id === targetUserId) {
      throw new Error("Cannot change your own role");
    }

    const membership = await getMembership(ctx, targetUserId, workspaceId);
    if (!membership) throw new Error("User is not a member");
    if (membership.role === "owner") throw new Error("Cannot change owner role");

    // V1: Only one principal
    if (newRole === "principal") {
      const existingPrincipal = await ctx.db
        .query("memberships")
        .withIndex("by_workspace_role", (q) =>
          q.eq("workspaceId", workspaceId).eq("role", "principal"),
        )
        .first();
      if (existingPrincipal && existingPrincipal.userId !== targetUserId) {
        throw new Error("Workspace already has a principal");
      }
    }

    await ctx.db.patch(membership._id, { role: newRole });
  },
});

/** Remove a member from a workspace. Requires owner role. Cannot remove self. */
export const removeMember = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, { workspaceId, targetUserId }) => {
    const user = await getUser(ctx);
    await requireRole(ctx, user._id, workspaceId, ["owner"]);

    if (user._id === targetUserId) {
      throw new Error("Cannot remove yourself. Transfer ownership first.");
    }

    const membership = await getMembership(ctx, targetUserId, workspaceId);
    if (!membership) throw new Error("User is not a member");
    if (membership.role === "owner") throw new Error("Cannot remove the owner");

    await ctx.db.delete(membership._id);
  },
});
