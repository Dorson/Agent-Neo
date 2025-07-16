// Agent Neo Core Module
// Main orchestration and initialization logic

class AgentNeoCore {
  constructor() {
    this.isInitialized = false;
    this.nodeId = this.generateNodeId();
    this.status = 'inactive';
    this.startTime = null;
    this.metrics = {
      nodeUptime: '0h 0m',
      tasksProcessed: 0,
      networkPeers: 0,
      resourceUsage: 0
    };
    this.resourceLimits = {
      cpu: 50,
      memory: 512,
      bandwidth: 10
    };
    this.configuration = {
      nodeName: 'neo-node-local',
      region: 'auto',
      voiceEnabled: true,
      autoStart: true,
      maxPeers: 50,
      connectionTimeout: 30000,
      debugLogging: true
    };
    
    // Initialize modules
    this.initializeModules();
  }

  generateNodeId() {
    return 'neo-node-' + Math.random().toString(36).substr(2, 9);
  }

  async initializeModules() {
    try {
      // Dynamically import modules
      const [P2PModule, EthicsModule, TasksModule, MetricsModule, StorageModule, VoiceModule] = await Promise.all([
        import('./p2p.js'),
        import('./ethics.js'),
        import('./tasks.js'),
        import('./metrics.js'),
        import('./storage.js'),
        import('./voice.js')
      ]);

      this.p2p = new P2PModule.P2PManager(this);
      this.ethics = new EthicsModule.EthicsEngine(this);
      this.tasks = new TasksModule.TaskManager(this);
      this.metrics = new MetricsModule.MetricsCollector(this);
      this.storage = new StorageModule.LocalStorage(this);
      this.voice = new VoiceModule.VoiceInterface(this);

      // Initialize Web Workers
      this.initializeWorkers();

      console.log('Agent Neo modules initialized successfully');
    } catch (error) {
      console.error('Error initializing Agent Neo modules:', error);
    }
  }

  initializeWorkers() {
    try {
      // Task processor worker
      this.taskWorker = new Worker(new URL('./workers/task-processor.js', import.meta.url));
      this.taskWorker.onmessage = (event) => {
        this.handleWorkerMessage('task', event.data);
      };

      // Resource monitor worker
      this.resourceWorker = new Worker(new URL('./workers/resource-monitor.js', import.meta.url));
      this.resourceWorker.onmessage = (event) => {
        this.handleWorkerMessage('resource', event.data);
      };

      // Start resource monitoring
      this.resourceWorker.postMessage({ 
        type: 'start', 
        limits: this.resourceLimits 
      });
      
      console.log('Workers initialized successfully');
    } catch (error) {
      console.warn('Worker initialization failed, falling back to inline processing:', error);
      // Fallback to inline processing if workers fail
      this.taskWorker = null;
      this.resourceWorker = null;
    }
  }

  handleWorkerMessage(workerType, data) {
    switch (workerType) {
      case 'task':
        if (this.tasks) {
          this.tasks.handleWorkerMessage(data);
        }
        break;
      case 'resource':
        this.handleResourceUpdate(data);
        break;
    }
  }

  handleResourceUpdate(data) {
    if (data.type === 'metrics') {
      this.metrics.updateResourceMetrics(data.metrics);
    } else if (data.type === 'alert') {
      this.handleResourceAlert(data.alert);
    }
  }

  handleResourceAlert(alert) {
    console.warn('Resource alert:', alert);
    if (alert.severity === 'critical') {
      this.throttleOperations();
    }
  }

  throttleOperations() {
    // Implement resource throttling
    this.tasks.throttle();
    this.p2p.throttle();
  }

  async init() {
    if (this.isInitialized) return;

    try {
      // Wait for modules to be initialized
      await this.waitForModules();
      
      // Initialize storage
      await this.storage.init();
      
      // Load configuration
      await this.loadConfiguration();
      
      // Initialize P2P networking
      await this.p2p.init();
      
      // Initialize ethics module
      await this.ethics.init();
      
      // Initialize task processing
      await this.tasks.init();
      
      // Start voice interface if enabled
      if (this.configuration.voiceEnabled) {
        await this.voice.init();
      }
      
      this.isInitialized = true;
      
      // Auto-start if configured
      if (this.configuration.autoStart) {
        await this.start();
      }
      
      console.log('Agent Neo initialized successfully');
    } catch (error) {
      console.error('Error initializing Agent Neo:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  async waitForModules() {
    const maxWait = 10000; // 10 seconds
    const startTime = Date.now();
    
    while (!this.p2p || !this.ethics || !this.tasks || !this.metrics || !this.storage || !this.voice) {
      if (Date.now() - startTime > maxWait) {
        throw new Error('Timeout waiting for modules to initialize');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async loadConfiguration() {
    try {
      const saved = await this.storage.getConfiguration();
      if (saved) {
        this.configuration = { ...this.configuration, ...saved };
      }
    } catch (error) {
      console.warn('Could not load configuration, using defaults:', error);
    }
  }

  async start() {
    if (this.status === 'active') return;

    try {
      this.status = 'active';
      this.startTime = Date.now();
      
      // Start all modules
      await this.p2p.start();
      await this.tasks.start();
      await this.metrics.start();
      
      // Register node with network
      await this.registerNode();
      
      console.log('Agent Neo node started');
      this.notifyStatusChange('started');
    } catch (error) {
      console.error('Error starting Agent Neo:', error);
      this.status = 'error';
      throw error;
    }
  }

  async stop() {
    if (this.status === 'inactive') return;

    try {
      this.status = 'inactive';
      
      // Stop all modules
      await this.p2p.stop();
      await this.tasks.stop();
      await this.metrics.stop();
      
      // Unregister node
      await this.unregisterNode();
      
      console.log('Agent Neo node stopped');
      this.notifyStatusChange('stopped');
    } catch (error) {
      console.error('Error stopping Agent Neo:', error);
      throw error;
    }
  }

  async registerNode() {
    try {
      const nodeData = {
        nodeId: this.nodeId,
        name: this.configuration.nodeName,
        status: this.status,
        reputation: 100,
        resourceLimits: this.resourceLimits,
        configuration: this.configuration
      };

      const response = await fetch('/api/nodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(nodeData)
      });

      if (!response.ok) {
        throw new Error(`Failed to register node: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Node registered successfully:', result);
    } catch (error) {
      console.error('Error registering node:', error);
    }
  }

  async unregisterNode() {
    try {
      await fetch(`/api/nodes/${this.nodeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'inactive' })
      });
    } catch (error) {
      console.error('Error unregistering node:', error);
    }
  }

  notifyStatusChange(status) {
    // Notify all modules of status change
    this.p2p.onNodeStatusChange(status);
    this.tasks.onNodeStatusChange(status);
    this.metrics.onNodeStatusChange(status);
    
    // Emit event for UI updates
    window.dispatchEvent(new CustomEvent('agentNeoStatusChange', {
      detail: { status, nodeId: this.nodeId }
    }));
  }

  getMetrics() {
    const now = Date.now();
    const uptime = this.startTime ? now - this.startTime : 0;
    
    return {
      nodeId: this.nodeId,
      status: this.status,
      nodeUptime: this.formatUptime(uptime),
      tasksProcessed: this.tasks.getProcessedCount(),
      networkPeers: this.p2p.getPeerCount(),
      resourceUsage: this.metrics.getResourceUsage()
    };
  }

  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else {
      return `${minutes}m ${seconds % 60}s`;
    }
  }

  toggleNode(active) {
    if (active) {
      this.start();
    } else {
      this.stop();
    }
  }

  submitTask(taskData) {
    return this.tasks.submitTask(taskData);
  }

  updateResourceLimits(limits) {
    this.resourceLimits = { ...this.resourceLimits, ...limits };
    if (this.resourceWorker) {
      this.resourceWorker.postMessage({ 
        type: 'updateLimits', 
        limits: this.resourceLimits 
      });
    }
  }

  updateConfiguration(config) {
    this.configuration = { ...this.configuration, ...config };
    this.storage.saveConfiguration(this.configuration);
  }
}

// Global instance
const agentNeo = new AgentNeoCore();

// Expose to window for React component access
window.AgentNeo = {
  init: () => agentNeo.init(),
  start: () => agentNeo.start(),
  stop: () => agentNeo.stop(),
  getMetrics: () => agentNeo.getMetrics(),
  toggleNode: (active) => agentNeo.toggleNode(active),
  submitTask: (task) => agentNeo.submitTask(task),
  updateResourceLimits: (limits) => agentNeo.updateResourceLimits(limits),
  updateConfiguration: (config) => agentNeo.updateConfiguration(config),
  getInstance: () => agentNeo
};

// Auto-initialize
agentNeo.init().catch(console.error);

export default agentNeo;
