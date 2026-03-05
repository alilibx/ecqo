import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  waitlist: defineTable({
    email: v.string(),
    joinedAt: v.number(),
    verified: v.boolean(),
    verificationCode: v.string(),
    position: v.number(), // 0 = pending verification
  })
    .index("by_email", ["email"])
    .index("by_position", ["position"]),
});
