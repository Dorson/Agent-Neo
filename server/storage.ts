import { 
  users, 
  agentNodes,
  tasks,
  networkPeers,
  ethicsLogs,
  type User, 
  type InsertUser,
  type AgentNode,
  type InsertAgentNode,
  type Task,
  type InsertTask,
  type NetworkPeer,
  type InsertNetworkPeer,
  type EthicsLog,
  type InsertEthicsLog
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAgentNode(nodeId: string): Promise<AgentNode | undefined>;
  createAgentNode(node: InsertAgentNode): Promise<AgentNode>;
  updateAgentNode(nodeId: string, updates: Partial<AgentNode>): Promise<AgentNode | undefined>;
  
  getTask(taskId: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(taskId: string, updates: Partial<Task>): Promise<Task | undefined>;
  getAllTasks(): Promise<Task[]>;
  
  getNetworkPeer(peerId: string): Promise<NetworkPeer | undefined>;
  createNetworkPeer(peer: InsertNetworkPeer): Promise<NetworkPeer>;
  updateNetworkPeer(peerId: string, updates: Partial<NetworkPeer>): Promise<NetworkPeer | undefined>;
  getAllNetworkPeers(): Promise<NetworkPeer[]>;
  
  createEthicsLog(log: InsertEthicsLog): Promise<EthicsLog>;
  getEthicsLogs(taskId?: string): Promise<EthicsLog[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private agentNodes: Map<string, AgentNode>;
  private tasks: Map<string, Task>;
  private networkPeers: Map<string, NetworkPeer>;
  private ethicsLogs: Map<number, EthicsLog>;
  private currentUserId: number;
  private currentEthicsLogId: number;

  constructor() {
    this.users = new Map();
    this.agentNodes = new Map();
    this.tasks = new Map();
    this.networkPeers = new Map();
    this.ethicsLogs = new Map();
    this.currentUserId = 1;
    this.currentEthicsLogId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAgentNode(nodeId: string): Promise<AgentNode | undefined> {
    return this.agentNodes.get(nodeId);
  }

  async createAgentNode(insertNode: InsertAgentNode): Promise<AgentNode> {
    const id = Math.floor(Math.random() * 1000000);
    const now = new Date();
    const node: AgentNode = { 
      ...insertNode, 
      id, 
      createdAt: now,
      updatedAt: now
    };
    this.agentNodes.set(insertNode.nodeId, node);
    return node;
  }

  async updateAgentNode(nodeId: string, updates: Partial<AgentNode>): Promise<AgentNode | undefined> {
    const node = this.agentNodes.get(nodeId);
    if (!node) return undefined;
    
    const updatedNode = { ...node, ...updates, updatedAt: new Date() };
    this.agentNodes.set(nodeId, updatedNode);
    return updatedNode;
  }

  async getTask(taskId: string): Promise<Task | undefined> {
    return this.tasks.get(taskId);
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = Math.floor(Math.random() * 1000000);
    const now = new Date();
    const task: Task = { 
      ...insertTask, 
      id, 
      createdAt: now,
      updatedAt: now
    };
    this.tasks.set(insertTask.taskId, task);
    return task;
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task | undefined> {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;
    
    const updatedTask = { ...task, ...updates, updatedAt: new Date() };
    this.tasks.set(taskId, updatedTask);
    return updatedTask;
  }

  async getAllTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async getNetworkPeer(peerId: string): Promise<NetworkPeer | undefined> {
    return this.networkPeers.get(peerId);
  }

  async createNetworkPeer(insertPeer: InsertNetworkPeer): Promise<NetworkPeer> {
    const id = Math.floor(Math.random() * 1000000);
    const now = new Date();
    const peer: NetworkPeer = { 
      ...insertPeer, 
      id, 
      lastSeen: now
    };
    this.networkPeers.set(insertPeer.peerId, peer);
    return peer;
  }

  async updateNetworkPeer(peerId: string, updates: Partial<NetworkPeer>): Promise<NetworkPeer | undefined> {
    const peer = this.networkPeers.get(peerId);
    if (!peer) return undefined;
    
    const updatedPeer = { ...peer, ...updates, lastSeen: new Date() };
    this.networkPeers.set(peerId, updatedPeer);
    return updatedPeer;
  }

  async getAllNetworkPeers(): Promise<NetworkPeer[]> {
    return Array.from(this.networkPeers.values());
  }

  async createEthicsLog(insertLog: InsertEthicsLog): Promise<EthicsLog> {
    const id = this.currentEthicsLogId++;
    const now = new Date();
    const log: EthicsLog = { 
      ...insertLog, 
      id, 
      evaluatedAt: now
    };
    this.ethicsLogs.set(id, log);
    return log;
  }

  async getEthicsLogs(taskId?: string): Promise<EthicsLog[]> {
    const logs = Array.from(this.ethicsLogs.values());
    return taskId ? logs.filter(log => log.taskId === taskId) : logs;
  }
}

export const storage = new MemStorage();
