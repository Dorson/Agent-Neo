// Agent Neo Task Management Module
// Handles task processing, auctions, and proof-of-performance economy

export class TaskManager {
  constructor(core) {
    this.core = core;
    this.tasks = new Map();
    this.processingQueue = [];
    this.completedTasks = [];
    this.activeBids = new Map();
    this.processedCount = 0;
    this.isProcessing = false;
    this.throttled = false;
    this.processingInterval = null;
  }

  async init() {
    try {
      // Load existing tasks
      await this.loadTasks();
      
      console.log('Task Manager initialized');
    } catch (error) {
      console.error('Error initializing Task Manager:', error);
      throw error;
    }
  }

  async loadTasks() {
    try {
      const response = await fetch('/api/tasks');
      if (response.ok) {
        const tasks = await response.json();
        tasks.forEach(task => {
          this.tasks.set(task.taskId, task);
        });
      }
    } catch (error) {
      console.warn('Could not load tasks:', error);
    }
  }

  async start() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.startProcessingLoop();
    
    console.log('Task Manager started');
  }

  async stop() {
    if (!this.isProcessing) return;
    
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    console.log('Task Manager stopped');
  }

  startProcessingLoop() {
    this.processingInterval = setInterval(() => {
      this.processTaskQueue();
    }, this.throttled ? 10000 : 5000); // 10s when throttled, 5s normally
  }

  async submitTask(taskData) {
    try {
      // Generate unique task ID
      const taskId = this.generateTaskId();
      
      const task = {
        taskId,
        description: taskData.description,
        priority: taskData.priority || 'medium',
        resourceStake: taskData.resourceStake || 50,
        status: 'pending',
        createdBy: this.core.nodeId,
        assignedTo: null,
        result: null
      };

      // Validate task with ethics module
      const ethicsResult = await this.core.ethics.evaluateTask(task);
      
      if (!ethicsResult.passed) {
        throw new Error(`Task failed ethics check: ${ethicsResult.violations.map(v => v.reason).join(', ')}`);
      }

      // Store task locally
      this.tasks.set(taskId, task);
      
      // Submit to backend
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(task)
      });

      if (!response.ok) {
        throw new Error(`Failed to submit task: ${response.statusText}`);
      }

      const savedTask = await response.json();
      this.tasks.set(taskId, savedTask);
      
      // Add to processing queue
      this.processingQueue.push(savedTask);
      
      // Broadcast task to network for bidding
      this.broadcastTaskAuction(savedTask);
      
      console.log('Task submitted successfully:', taskId);
      return savedTask;
      
    } catch (error) {
      console.error('Error submitting task:', error);
      throw error;
    }
  }

  broadcastTaskAuction(task) {
    const auctionMessage = {
      type: 'task_auction',
      task: task,
      nodeId: this.core.nodeId,
      timestamp: Date.now()
    };

    // Broadcast to P2P network
    this.core.p2p.broadcast(auctionMessage);
    
    // Also send via WebSocket for nodes not directly connected
    if (this.core.p2p.webSocket && this.core.p2p.webSocket.readyState === WebSocket.OPEN) {
      this.core.p2p.webSocket.send(JSON.stringify({
        type: 'task_auction',
        ...auctionMessage
      }));
    }
  }

  async processTaskQueue() {
    if (this.processingQueue.length === 0) return;
    
    const task = this.processingQueue.shift();
    
    try {
      await this.processTask(task);
    } catch (error) {
      console.error('Error processing task:', error);
      await this.handleTaskError(task, error);
    }
  }

  async processTask(task) {
    console.log('Processing task:', task.taskId);
    
    // Update task status
    task.status = 'processing';
    await this.updateTask(task);
    
    // Send to worker for processing
    return new Promise((resolve, reject) => {
      const processingId = Date.now().toString();
      
      // Set up timeout
      const timeout = setTimeout(() => {
        reject(new Error('Task processing timeout'));
      }, 30000); // 30 second timeout
      
      const handleWorkerMessage = (event) => {
        if (event.data.processingId === processingId) {
          clearTimeout(timeout);
          this.core.taskWorker.removeEventListener('message', handleWorkerMessage);
          
          if (event.data.success) {
            resolve(event.data.result);
          } else {
            reject(new Error(event.data.error));
          }
        }
      };
      
      this.core.taskWorker.addEventListener('message', handleWorkerMessage);
      
      // Send task to worker
      this.core.taskWorker.postMessage({
        type: 'process_task',
        processingId,
        task,
        nodeId: this.core.nodeId
      });
    }).then(async (result) => {
      // Task completed successfully
      task.status = 'completed';
      task.result = result;
      await this.updateTask(task);
      
      this.completedTasks.push(task);
      this.processedCount++;
      
      console.log('Task completed:', task.taskId);
      
      // Report completion to network
      this.broadcastTaskCompletion(task);
      
    }).catch(async (error) => {
      // Task failed
      task.status = 'failed';
      task.result = { error: error.message };
      await this.updateTask(task);
      
      console.error('Task failed:', task.taskId, error.message);
    });
  }

  async updateTask(task) {
    try {
      const response = await fetch(`/api/tasks/${task.taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(task)
      });

      if (response.ok) {
        const updatedTask = await response.json();
        this.tasks.set(task.taskId, updatedTask);
        return updatedTask;
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  }

  broadcastTaskCompletion(task) {
    const completionMessage = {
      type: 'task_completed',
      task: task,
      nodeId: this.core.nodeId,
      timestamp: Date.now()
    };

    this.core.p2p.broadcast(completionMessage);
  }

  async handleTaskError(task, error) {
    task.status = 'failed';
    task.result = { error: error.message };
    await this.updateTask(task);
  }

  handleWorkerMessage(data) {
    // Handle messages from task processing worker
    switch (data.type) {
      case 'task_progress':
        this.handleTaskProgress(data);
        break;
      case 'task_completed':
        this.handleTaskCompleted(data);
        break;
      case 'task_failed':
        this.handleTaskFailed(data);
        break;
    }
  }

  handleTaskProgress(data) {
    const task = this.tasks.get(data.taskId);
    if (task) {
      task.progress = data.progress;
      // Update UI or broadcast progress
    }
  }

  handleTaskCompleted(data) {
    const task = this.tasks.get(data.taskId);
    if (task) {
      task.status = 'completed';
      task.result = data.result;
      this.completedTasks.push(task);
      this.processedCount++;
    }
  }

  handleTaskFailed(data) {
    const task = this.tasks.get(data.taskId);
    if (task) {
      task.status = 'failed';
      task.result = { error: data.error };
    }
  }

  // Proof-of-Performance Economy Methods
  
  handleNetworkTaskBid(bidData) {
    // Handle task bids from network
    const taskId = bidData.taskId;
    const bid = {
      nodeId: bidData.nodeId,
      bid: bidData.bid,
      confidence: bidData.confidence,
      resourceCommitment: bidData.resourceCommitment,
      timestamp: Date.now()
    };

    if (!this.activeBids.has(taskId)) {
      this.activeBids.set(taskId, []);
    }
    
    this.activeBids.get(taskId).push(bid);
    
    // Evaluate bid after collecting period
    setTimeout(() => {
      this.evaluateBids(taskId);
    }, 10000); // 10 second bidding period
  }

  handlePeerTaskBid(peerId, message) {
    // Handle task bids from direct peer connections
    this.handleNetworkTaskBid({
      ...message,
      nodeId: peerId
    });
  }

  evaluateBids(taskId) {
    const bids = this.activeBids.get(taskId) || [];
    if (bids.length === 0) return;
    
    // Simple bid evaluation: highest confidence + resource commitment
    const bestBid = bids.reduce((best, current) => {
      const bestScore = best.confidence * 0.7 + (best.resourceCommitment / 100) * 0.3;
      const currentScore = current.confidence * 0.7 + (current.resourceCommitment / 100) * 0.3;
      return currentScore > bestScore ? current : best;
    });
    
    console.log('Best bid for task', taskId, ':', bestBid);
    
    // Assign task to winning bidder
    const task = this.tasks.get(taskId);
    if (task && task.status === 'pending') {
      task.assignedTo = bestBid.nodeId;
      task.status = 'assigned';
      this.updateTask(task);
    }
  }

  generateTaskId() {
    return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  getProcessedCount() {
    return this.processedCount;
  }

  getTasks() {
    return Array.from(this.tasks.values());
  }

  getCompletedTasks() {
    return this.completedTasks;
  }

  getQueueLength() {
    return this.processingQueue.length;
  }

  throttle() {
    this.throttled = true;
    // Restart processing loop with longer interval
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.startProcessingLoop();
    }
  }

  onNodeStatusChange(status) {
    if (status === 'stopped') {
      this.stop();
    } else if (status === 'started') {
      this.start();
    }
  }
}
