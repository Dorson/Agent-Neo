import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const agentNodes = pgTable("agent_nodes", {
  id: serial("id").primaryKey(),
  nodeId: text("node_id").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("inactive"),
  reputation: integer("reputation").notNull().default(100),
  resourceLimits: jsonb("resource_limits").notNull(),
  configuration: jsonb("configuration").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  taskId: text("task_id").notNull().unique(),
  description: text("description").notNull(),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("pending"),
  resourceStake: integer("resource_stake").notNull(),
  createdBy: text("created_by").notNull(),
  assignedTo: text("assigned_to"),
  result: jsonb("result"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const networkPeers = pgTable("network_peers", {
  id: serial("id").primaryKey(),
  peerId: text("peer_id").notNull().unique(),
  nodeId: text("node_id").notNull(),
  reputation: integer("reputation").notNull().default(50),
  status: text("status").notNull().default("connected"),
  lastSeen: timestamp("last_seen").defaultNow(),
  metadata: jsonb("metadata").notNull(),
});

export const ethicsLogs = pgTable("ethics_logs", {
  id: serial("id").primaryKey(),
  taskId: text("task_id").notNull(),
  evaluation: text("evaluation").notNull(),
  passed: boolean("passed").notNull(),
  details: jsonb("details").notNull(),
  evaluatedAt: timestamp("evaluated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertAgentNodeSchema = createInsertSchema(agentNodes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNetworkPeerSchema = createInsertSchema(networkPeers).omit({
  id: true,
  lastSeen: true,
});

export const insertEthicsLogSchema = createInsertSchema(ethicsLogs).omit({
  id: true,
  evaluatedAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type AgentNode = typeof agentNodes.$inferSelect;
export type InsertAgentNode = z.infer<typeof insertAgentNodeSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type NetworkPeer = typeof networkPeers.$inferSelect;
export type InsertNetworkPeer = z.infer<typeof insertNetworkPeerSchema>;
export type EthicsLog = typeof ethicsLogs.$inferSelect;
export type InsertEthicsLog = z.infer<typeof insertEthicsLogSchema>;
