/**
 * StateManager.js - Global State Management System
 * 
 * Implements Observable pattern for reactive state management
 * as required by the Agent Neo whitepaper section 4.1
 */

class StateManager {
  constructor() {
    this.state = {
      // Node Status
      nodeStatus: 'offline', // offline, connecting, online
      isNodeRunning: false,
      
      // Network State
      connectedPeers: 0,
      networkHealth: 'unknown',
      p2pConnections: [],
      protocolRegistry: new Map(),
      
      // Session State
      currentSession: null,
      sessionGoal: '',
      sessionMessages: 0,
      activeView: 'dashboard',
      
      // Agent Modules State
      modules: new Map(),
      activeTasks: [],
      
      // Local Metrics
      metrics: {
        cpuUsage: 0,
        memoryUsage: 0,
        trustBalance: 1000,
        reputation: 100,
        metabolicLoad: 0
      },
      
      // Knowledge Graph State
      knowledgeStats: {
        totalFacts: 0,
        hotKnowledge: 0,
        corePrinciples: 12
      },
      
      // User Settings
      settings: {
        nodeName: 'Agent Neo Node',
        autoStart: false,
        voiceEnabled: true,
        maxCpuUsage: 70,
        maxMemoryUsage: 512,
        metabolicRate: 5,
        maxPeers: 20,
        relayMode: false,
        bootstrapNodes: '',
        ethicsLevel: 8,
        homeostasisMode: 'balanced'
      },
      
      // UI State
      ui: {
        sidebarOpen: true,
        settingsModalOpen: false,
        theme: 'dark',
        loadingScreen: true,
        toasts: []
      },
      
      // Resource Limits (from whitepaper requirements)
      resourceLimits: {
        maxCpuPercent: 70,
        maxMemoryMB: 512,
        maxNetworkBandwidth: 1024, // KB/s
        maxStorageMB: 100,
        maxConcurrentTasks: 5
      },
      
      // Current Resource Usage
      resourceUsage: {
        cpu: 0,
        memory: 0,
        network: 0,
        storage: 0,
        tasks: 0
      }
    };

    // Observable implementation
    this.observers = new Map();
    this.middleware = [];
    
    // Performance optimization: batch state updates
    this.updateQueue = [];
    this.updateScheduled = false;
    
    // Local storage persistence
    this.persistenceKey = 'agent-neo-state';
    this.loadPersistedState();
    
    // Initialize resource monitoring
    this.initResourceMonitoring();
    
    console.log('StateManager initialized');
  }

  /**
   * Subscribe to state changes with optional selector
   * @param {string|function} selector - State path or selector function
   * @param {function} callback - Callback function
   * @returns {function} Unsubscribe function
   */
  subscribe(selector, callback) {
    if (typeof selector === 'string') {
      if (!this.observers.has(selector)) {
        this.observers.set(selector, new Set());
      }
      this.observers.get(selector).add(callback);
      
      return () => {
        this.observers.get(selector)?.delete(callback);
      };
    } else if (typeof selector === 'function') {
      // Global observer with selector function
      const globalKey = '__global__';
      if (!this.observers.has(globalKey)) {
        this.observers.set(globalKey, new Set());
      }
      
      const wrappedCallback = (state, prevState) => {
        const current = selector(state);
        const previous = selector(prevState);
        if (current !== previous) {
          callback(current, previous, state);
        }
      };
      
      this.observers.get(globalKey).add(wrappedCallback);
      
      return () => {
        this.observers.get(globalKey)?.delete(wrappedCallback);
      };
    }
  }

  /**
   * Get current state or state slice
   * @param {string} path - Optional path to state slice
   * @returns {any} State value
   */
  getState(path = null) {
    if (!path) return { ...this.state };
    
    return this.getNestedValue(this.state, path);
  }

  /**
   * Set state with batched updates and middleware
   * @param {string|object} pathOrUpdates - State path or updates object
   * @param {any} value - Value to set (if path provided)
   */
  setState(pathOrUpdates, value = undefined) {
    const updates = typeof pathOrUpdates === 'string' 
      ? { [pathOrUpdates]: value }
      : pathOrUpdates;

    // Queue update for batching
    this.updateQueue.push(updates);
    
    if (!this.updateScheduled) {
      this.updateScheduled = true;
      requestAnimationFrame(() => this.flushUpdates());
    }
  }

  /**
   * Add middleware for state updates
   * @param {function} middleware - Middleware function
   */
  addMiddleware(middleware) {
    this.middleware.push(middleware);
  }

  /**
   * Flush batched updates
   * @private
   */
  flushUpdates() {
    if (this.updateQueue.length === 0) {
      this.updateScheduled = false;
      return;
    }

    const prevState = { ...this.state };
    const updates = this.updateQueue.splice(0);
    
    // Apply middleware
    let processedUpdates = updates.reduce((acc, update) => ({ ...acc, ...update }), {});
    
    for (const middleware of this.middleware) {
      processedUpdates = middleware(processedUpdates, prevState) || processedUpdates;
    }
    
    // Apply updates
    for (const [path, value] of Object.entries(processedUpdates)) {
      this.setNestedValue(this.state, path, value);
    }
    
    // Notify observers
    this.notifyObservers(this.state, prevState, processedUpdates);
    
    // Persist critical state
    this.persistState();
    
    this.updateScheduled = false;
    
    // Process any new updates that came in during this flush
    if (this.updateQueue.length > 0) {
      requestAnimationFrame(() => this.flushUpdates());
    }
  }

  /**
   * Notify observers of state changes
   * @private
   */
  notifyObservers(newState, prevState, updates) {
    // Notify specific path observers
    for (const path of Object.keys(updates)) {
      const observers = this.observers.get(path);
      if (observers) {
        const value = this.getNestedValue(newState, path);
        const prevValue = this.getNestedValue(prevState, path);
        
        for (const callback of observers) {
          try {
            callback(value, prevValue, newState);
          } catch (error) {
            console.error('Observer error:', error);
          }
        }
      }
    }
    
    // Notify global observers
    const globalObservers = this.observers.get('__global__');
    if (globalObservers) {
      for (const callback of globalObservers) {
        try {
          callback(newState, prevState);
        } catch (error) {
          console.error('Global observer error:', error);
        }
      }
    }
  }

  /**
   * Get nested value from object using dot notation
   * @private
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Set nested value in object using dot notation
   * @private
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    
    target[lastKey] = value;
  }

  /**
   * Load persisted state from localStorage
   * @private
   */
  loadPersistedState() {
    try {
      const persisted = localStorage.getItem(this.persistenceKey);
      if (persisted) {
        const parsed = JSON.parse(persisted);
        
        // Only restore specific persistent fields
        const persistentFields = ['settings', 'metrics.trustBalance', 'metrics.reputation'];
        
        for (const field of persistentFields) {
          const value = this.getNestedValue(parsed, field);
          if (value !== undefined) {
            this.setNestedValue(this.state, field, value);
          }
        }
        
        console.log('State restored from localStorage');
      }
    } catch (error) {
      console.warn('Failed to load persisted state:', error);
    }
  }

  /**
   * Persist critical state to localStorage
   * @private
   */
  persistState() {
    try {
      const toPersist = {
        settings: this.state.settings,
        metrics: {
          trustBalance: this.state.metrics.trustBalance,
          reputation: this.state.metrics.reputation
        },
        timestamp: Date.now()
      };
      
      localStorage.setItem(this.persistenceKey, JSON.stringify(toPersist));
    } catch (error) {
      console.warn('Failed to persist state:', error);
    }
  }

  /**
   * Initialize resource monitoring as required by whitepaper
   * @private
   */
  initResourceMonitoring() {
    // Monitor CPU usage (approximation using performance API)
    this.monitorCPU();
    
    // Monitor memory usage
    this.monitorMemory();
    
    // Monitor network usage (basic implementation)
    this.monitorNetwork();
    
    // Check resource limits
    this.checkResourceLimits();
  }

  /**
   * Monitor CPU usage
   * @private
   */
  monitorCPU() {
    let lastTime = performance.now();
    let lastUsage = 0;
    
    const measureCPU = () => {
      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime;
      
      // Simulate CPU measurement (in real implementation, would use Web Workers)
      const usage = Math.min(100, Math.max(0, lastUsage + (Math.random() - 0.5) * 10));
      
      this.setState('resourceUsage.cpu', Math.round(usage));
      this.setState('metrics.cpuUsage', Math.round(usage));
      
      lastTime = currentTime;
      lastUsage = usage;
      
      setTimeout(measureCPU, 2000); // Update every 2 seconds
    };
    
    measureCPU();
  }

  /**
   * Monitor memory usage
   * @private
   */
  monitorMemory() {
    const measureMemory = () => {
      if ('memory' in performance) {
        const memory = performance.memory;
        const usedMB = Math.round(memory.usedJSHeapSize / (1024 * 1024));
        
        this.setState('resourceUsage.memory', usedMB);
        this.setState('metrics.memoryUsage', usedMB);
      } else {
        // Fallback estimation
        const estimatedMB = Math.round(Math.random() * 100 + 50);
        this.setState('resourceUsage.memory', estimatedMB);
        this.setState('metrics.memoryUsage', estimatedMB);
      }
      
      setTimeout(measureMemory, 5000); // Update every 5 seconds
    };
    
    measureMemory();
  }

  /**
   * Monitor network usage
   * @private
   */
  monitorNetwork() {
    // Basic network monitoring - in real implementation would track actual usage
    const measureNetwork = () => {
      const usage = Math.round(Math.random() * 100);
      this.setState('resourceUsage.network', usage);
      
      setTimeout(measureNetwork, 3000);
    };
    
    measureNetwork();
  }

  /**
   * Check resource limits and enforce constraints
   * @private
   */
  checkResourceLimits() {
    const checkLimits = () => {
      const { resourceUsage, resourceLimits } = this.state;
      
      // Check CPU limit
      if (resourceUsage.cpu > resourceLimits.maxCpuPercent) {
        this.emit('resource-limit-exceeded', { type: 'cpu', usage: resourceUsage.cpu, limit: resourceLimits.maxCpuPercent });
      }
      
      // Check memory limit
      if (resourceUsage.memory > resourceLimits.maxMemoryMB) {
        this.emit('resource-limit-exceeded', { type: 'memory', usage: resourceUsage.memory, limit: resourceLimits.maxMemoryMB });
      }
      
      // Check task limit
      if (resourceUsage.tasks > resourceLimits.maxConcurrentTasks) {
        this.emit('resource-limit-exceeded', { type: 'tasks', usage: resourceUsage.tasks, limit: resourceLimits.maxConcurrentTasks });
      }
      
      setTimeout(checkLimits, 1000);
    };
    
    checkLimits();
  }

  /**
   * Emit events (integration with EventBus)
   * @private
   */
  emit(eventName, data) {
    if (window.eventBus) {
      window.eventBus.emit(eventName, data);
    }
  }

  /**
   * Reset state to defaults
   */
  resetState() {
    const defaultSettings = {
      nodeName: 'Agent Neo Node',
      autoStart: false,
      voiceEnabled: true,
      maxCpuUsage: 70,
      maxMemoryUsage: 512,
      metabolicRate: 5,
      maxPeers: 20,
      relayMode: false,
      bootstrapNodes: '',
      ethicsLevel: 8,
      homeostasisMode: 'balanced'
    };
    
    this.setState('settings', defaultSettings);
    this.setState('metrics.trustBalance', 1000);
    this.setState('metrics.reputation', 100);
    
    console.log('State reset to defaults');
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    return {
      observerCount: Array.from(this.observers.values()).reduce((total, set) => total + set.size, 0),
      middlewareCount: this.middleware.length,
      updateQueueLength: this.updateQueue.length,
      state: this.state
    };
  }
}

// Create singleton instance
const stateManager = new StateManager();

// Export for use in other modules
export default stateManager;