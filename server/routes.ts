import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertAgentNodeSchema, insertTaskSchema, insertNetworkPeerSchema, insertEthicsLogSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket server for P2P communication
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  const connectedClients = new Map<string, WebSocket>();
  
  wss.on('connection', (ws, req) => {
    const clientId = `client_${Date.now()}_${Math.random()}`;
    connectedClients.set(clientId, ws);
    
    console.log(`Client connected: ${clientId}`);
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle different message types
        switch (data.type) {
          case 'node_status':
            // Broadcast node status to all connected clients
            broadcast({ type: 'node_status_update', ...data }, clientId);
            break;
            
          case 'task_bid':
            // Handle task bidding
            broadcast({ type: 'task_bid_received', ...data }, clientId);
            break;
            
          case 'peer_discovery':
            // Handle peer discovery
            broadcast({ type: 'peer_discovered', ...data }, clientId);
            break;
            
          case 'ethics_check':
            // Handle ethics validation
            const ethicsResult = await validateEthics(data.payload);
            ws.send(JSON.stringify({ type: 'ethics_result', ...ethicsResult }));
            break;
            
          default:
            // Forward unknown message types to all peers
            broadcast(data, clientId);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });
    
    ws.on('close', () => {
      connectedClients.delete(clientId);
      console.log(`Client disconnected: ${clientId}`);
    });
    
    // Send initial connection confirmation
    ws.send(JSON.stringify({ type: 'connected', clientId }));
  });
  
  function broadcast(message: any, excludeClient?: string) {
    const messageStr = JSON.stringify(message);
    connectedClients.forEach((client, clientId) => {
      if (clientId !== excludeClient && client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }
  
  async function validateEthics(payload: any) {
    // Simple ethics validation logic
    const passed = !payload.description?.toLowerCase().includes('harm');
    
    const ethicsLog = await storage.createEthicsLog({
      taskId: payload.taskId || 'unknown',
      evaluation: 'constitutional_check',
      passed,
      details: { payload, reason: passed ? 'No harmful content detected' : 'Potential harm detected' }
    });
    
    return { passed, logId: ethicsLog.id };
  }
  
  // Agent Node routes
  app.post('/api/nodes', async (req, res) => {
    try {
      const validatedData = insertAgentNodeSchema.parse(req.body);
      const node = await storage.createAgentNode(validatedData);
      res.json(node);
    } catch (error) {
      res.status(400).json({ error: 'Invalid node data' });
    }
  });
  
  app.get('/api/nodes/:nodeId', async (req, res) => {
    try {
      const node = await storage.getAgentNode(req.params.nodeId);
      if (!node) {
        return res.status(404).json({ error: 'Node not found' });
      }
      res.json(node);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  app.patch('/api/nodes/:nodeId', async (req, res) => {
    try {
      const updates = req.body;
      const node = await storage.updateAgentNode(req.params.nodeId, updates);
      if (!node) {
        return res.status(404).json({ error: 'Node not found' });
      }
      res.json(node);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  // Task routes
  app.post('/api/tasks', async (req, res) => {
    try {
      const validatedData = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(validatedData);
      
      // Broadcast new task to all connected clients
      broadcast({ type: 'new_task', task });
      
      res.json(task);
    } catch (error) {
      res.status(400).json({ error: 'Invalid task data' });
    }
  });
  
  app.get('/api/tasks', async (req, res) => {
    try {
      const tasks = await storage.getAllTasks();
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  app.get('/api/tasks/:taskId', async (req, res) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  app.patch('/api/tasks/:taskId', async (req, res) => {
    try {
      const updates = req.body;
      const task = await storage.updateTask(req.params.taskId, updates);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Broadcast task update to all connected clients
      broadcast({ type: 'task_updated', task });
      
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  // Network Peer routes
  app.post('/api/peers', async (req, res) => {
    try {
      const validatedData = insertNetworkPeerSchema.parse(req.body);
      const peer = await storage.createNetworkPeer(validatedData);
      
      // Broadcast new peer to all connected clients
      broadcast({ type: 'peer_joined', peer });
      
      res.json(peer);
    } catch (error) {
      res.status(400).json({ error: 'Invalid peer data' });
    }
  });
  
  app.get('/api/peers', async (req, res) => {
    try {
      const peers = await storage.getAllNetworkPeers();
      res.json(peers);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  // Ethics routes
  app.post('/api/ethics', async (req, res) => {
    try {
      const validatedData = insertEthicsLogSchema.parse(req.body);
      const log = await storage.createEthicsLog(validatedData);
      res.json(log);
    } catch (error) {
      res.status(400).json({ error: 'Invalid ethics log data' });
    }
  });
  
  app.get('/api/ethics', async (req, res) => {
    try {
      const { taskId } = req.query;
      const logs = await storage.getEthicsLogs(taskId as string);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  return httpServer;
}
