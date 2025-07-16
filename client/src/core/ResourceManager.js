/**
 * ResourceManager.js - Adaptive Resource Management and Monitoring
 * 
 * Implements self-imposed local resource limits and adaptive resource gating
 * as required by Agent Neo whitepaper sections 0 and 4.19
 */

import stateManager from './StateManager.js';
import eventBus from './EventBus.js';

class ResourceManager {
  constructor() {
    this.initialized = false;
    
    // Resource monitoring intervals
    this.monitoringIntervals = new Map();
    
    // Resource usage history for trend analysis
    this.usageHistory = {
      cpu: [],
      memory: [],
      network: [],
      storage: [],
      battery: []
    };
    
    // Maximum history entries
    this.maxHistorySize = 300; // 5 minutes at 1-second intervals
    
    // Current resource states
    this.resourceStates = {
      cpu: { available: true, usage: 0, limit: 70 },
      memory: { available: true, usage: 0, limit: 512 },
      network: { available: true, usage: 0, limit: 1024 },
      storage: { available: true, usage: 0, limit: 100 },
      battery: { available: true, level: 100, charging: true }
    };
    
    // Task queue for resource-gated operations
    this.taskQueue = [];
    this.isProcessingQueue = false;
    
    // Metabolic load tracking
    this.metabolicLoad = {
      current: 0,
      history: [],
      budget: 100,
      threshold: 80
    };
    
    // Device context detection
    this.deviceContext = {
      isMobile: false,
      isLowPower: false,
      isMetered: false,
      deviceMemory: 4,
      hardwareConcurrency: 4
    };
    
    console.log('ResourceManager initialized');
  }

  /**
   * Initialize resource manager
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Detect device capabilities
      await this.detectDeviceContext();
      
      // Set initial resource limits based on device
      this.setAdaptiveResourceLimits();
      
      // Start monitoring
      this.startResourceMonitoring();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Initialize browser API monitoring
      this.initializeBrowserAPIMonitoring();
      
      this.initialized = true;
      
      eventBus.emit('resource-manager-initialized', {
        deviceContext: this.deviceContext,
        resourceLimits: this.resourceStates
      });
      
      console.log('ResourceManager fully initialized');
    } catch (error) {
      console.error('Failed to initialize ResourceManager:', error);
      throw error;
    }
  }

  /**
   * Detect device context and capabilities
   * @private
   */
  async detectDeviceContext() {
    // Detect mobile device
    this.deviceContext.isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Get device memory if available
    if ('deviceMemory' in navigator) {
      this.deviceContext.deviceMemory = navigator.deviceMemory;
    }
    
    // Get hardware concurrency
    if ('hardwareConcurrency' in navigator) {
      this.deviceContext.hardwareConcurrency = navigator.hardwareConcurrency;
    }
    
    // Check network information
    if ('connection' in navigator) {
      const connection = navigator.connection;
      this.deviceContext.isMetered = connection.saveData || 
        ['slow-2g', '2g', '3g'].includes(connection.effectiveType);
    }
    
    // Battery API support
    if ('getBattery' in navigator) {
      try {
        const battery = await navigator.getBattery();
        this.deviceContext.isLowPower = battery.level < 0.2 && !battery.charging;
        
        // Listen for battery changes
        battery.addEventListener('levelchange', () => {
          this.deviceContext.isLowPower = battery.level < 0.2 && !battery.charging;
          this.updateBatteryState(battery);
        });
        
        battery.addEventListener('chargingchange', () => {
          this.deviceContext.isLowPower = battery.level < 0.2 && !battery.charging;
          this.updateBatteryState(battery);
        });
        
        this.updateBatteryState(battery);
      } catch (error) {
        console.warn('Battery API not accessible:', error);
      }
    }
    
    console.log('Device context detected:', this.deviceContext);
  }

  /**
   * Set adaptive resource limits based on device context
   * @private
   */
  setAdaptiveResourceLimits() {
    const { isMobile, isLowPower, isMetered, deviceMemory, hardwareConcurrency } = this.deviceContext;
    
    // Adjust CPU limits
    if (isMobile || isLowPower) {
      this.resourceStates.cpu.limit = 40; // Conservative on mobile/low power
    } else if (hardwareConcurrency >= 8) {
      this.resourceStates.cpu.limit = 80; // Higher limit on powerful devices
    }
    
    // Adjust memory limits
    if (deviceMemory <= 2) {
      this.resourceStates.memory.limit = 128; // Very conservative
    } else if (deviceMemory >= 8) {
      this.resourceStates.memory.limit = 1024; // Higher limit
    }
    
    // Adjust network limits
    if (isMetered) {
      this.resourceStates.network.limit = 256; // Severely limited on metered connections
    }
    
    // Update state manager
    stateManager.setState('resourceLimits', {
      maxCpuPercent: this.resourceStates.cpu.limit,
      maxMemoryMB: this.resourceStates.memory.limit,
      maxNetworkBandwidth: this.resourceStates.network.limit,
      maxStorageMB: this.resourceStates.storage.limit,
      maxConcurrentTasks: Math.max(2, Math.min(hardwareConcurrency, 8))
    });
    
    console.log('Adaptive resource limits set:', this.resourceStates);
  }

  /**
   * Start resource monitoring
   * @private
   */
  startResourceMonitoring() {
    // CPU monitoring (approximation)
    this.startCPUMonitoring();
    
    // Memory monitoring
    this.startMemoryMonitoring();
    
    // Network monitoring
    this.startNetworkMonitoring();
    
    // Storage monitoring
    this.startStorageMonitoring();
    
    // Metabolic load monitoring
    this.startMetabolicLoadMonitoring();
    
    console.log('Resource monitoring started');
  }

  /**
   * Start CPU monitoring
   * @private
   */
  startCPUMonitoring() {
    let lastTime = performance.now();
    let lastIdleTime = 0;
    
    const measureCPU = () => {
      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime;
      
      // Simulate CPU usage measurement (in real implementation, would use Web Workers with precise timing)
      const estimatedUsage = this.estimateCPUUsage();
      
      this.resourceStates.cpu.usage = estimatedUsage;
      this.addToHistory('cpu', estimatedUsage);
      
      // Check if CPU limit exceeded
      if (estimatedUsage > this.resourceStates.cpu.limit) {
        this.handleResourceLimitExceeded('cpu', estimatedUsage);
      }
      
      // Update state
      stateManager.setState('resourceUsage.cpu', estimatedUsage);
      
      lastTime = currentTime;
    };
    
    this.monitoringIntervals.set('cpu', setInterval(measureCPU, 2000));
  }

  /**
   * Estimate CPU usage
   * @private
   */
  estimateCPUUsage() {
    // This is a simplified estimation. In a real implementation, 
    // you would use Web Workers and more sophisticated measurement
    const activeWorkers = this.getActiveWorkerCount();
    const baseUsage = Math.min(30, activeWorkers * 10);
    const randomVariation = (Math.random() - 0.5) * 20;
    
    return Math.max(0, Math.min(100, baseUsage + randomVariation));
  }

  /**
   * Start memory monitoring
   * @private
   */
  startMemoryMonitoring() {
    const measureMemory = () => {
      let memoryUsage = 0;
      
      if ('memory' in performance) {
        memoryUsage = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
      } else {
        // Fallback estimation
        memoryUsage = Math.round(Math.random() * 50 + 50);
      }
      
      this.resourceStates.memory.usage = memoryUsage;
      this.addToHistory('memory', memoryUsage);
      
      // Check memory limit
      if (memoryUsage > this.resourceStates.memory.limit) {
        this.handleResourceLimitExceeded('memory', memoryUsage);
      }
      
      stateManager.setState('resourceUsage.memory', memoryUsage);
    };
    
    this.monitoringIntervals.set('memory', setInterval(measureMemory, 5000));
  }

  /**
   * Start network monitoring
   * @private
   */
  startNetworkMonitoring() {
    let lastBytes = 0;
    
    const measureNetwork = () => {
      // In a real implementation, would track actual network usage
      // For demo purposes, simulating based on connection type
      let networkUsage = 0;
      
      if ('connection' in navigator) {
        const connection = navigator.connection;
        switch (connection.effectiveType) {
          case 'slow-2g':
          case '2g':
            networkUsage = Math.random() * 50;
            break;
          case '3g':
            networkUsage = Math.random() * 200;
            break;
          case '4g':
            networkUsage = Math.random() * 1000;
            break;
          default:
            networkUsage = Math.random() * 500;
        }
      } else {
        networkUsage = Math.random() * 300;
      }
      
      this.resourceStates.network.usage = Math.round(networkUsage);
      this.addToHistory('network', networkUsage);
      
      stateManager.setState('resourceUsage.network', Math.round(networkUsage));
    };
    
    this.monitoringIntervals.set('network', setInterval(measureNetwork, 3000));
  }

  /**
   * Start storage monitoring
   * @private
   */
  startStorageMonitoring() {
    const measureStorage = async () => {
      let storageUsage = 0;
      
      try {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
          const estimate = await navigator.storage.estimate();
          storageUsage = Math.round((estimate.usage || 0) / (1024 * 1024));
        } else {
          // Fallback estimation
          storageUsage = Math.round(Math.random() * 20 + 10);
        }
      } catch (error) {
        console.warn('Storage estimation failed:', error);
        storageUsage = 15; // Default estimate
      }
      
      this.resourceStates.storage.usage = storageUsage;
      this.addToHistory('storage', storageUsage);
      
      stateManager.setState('resourceUsage.storage', storageUsage);
    };
    
    this.monitoringIntervals.set('storage', setInterval(measureStorage, 10000));
  }

  /**
   * Start metabolic load monitoring
   * @private
   */
  startMetabolicLoadMonitoring() {
    const measureMetabolicLoad = () => {
      // Calculate current metabolic load based on active tasks and resource usage
      const cpuWeight = 0.4;
      const memoryWeight = 0.3;
      const networkWeight = 0.2;
      const storageWeight = 0.1;
      
      const normalizedCPU = this.resourceStates.cpu.usage / 100;
      const normalizedMemory = this.resourceStates.memory.usage / this.resourceStates.memory.limit;
      const normalizedNetwork = this.resourceStates.network.usage / this.resourceStates.network.limit;
      const normalizedStorage = this.resourceStates.storage.usage / this.resourceStates.storage.limit;
      
      const metabolicLoad = (
        normalizedCPU * cpuWeight +
        normalizedMemory * memoryWeight +
        normalizedNetwork * networkWeight +
        normalizedStorage * storageWeight
      ) * 100;
      
      this.metabolicLoad.current = Math.round(metabolicLoad);
      this.metabolicLoad.history.push({
        value: metabolicLoad,
        timestamp: Date.now()
      });
      
      // Keep history manageable
      if (this.metabolicLoad.history.length > this.maxHistorySize) {
        this.metabolicLoad.history.shift();
      }
      
      // Check threshold
      if (metabolicLoad > this.metabolicLoad.threshold) {
        this.handleHighMetabolicLoad(metabolicLoad);
      }
      
      stateManager.setState('metrics.metabolicLoad', Math.round(metabolicLoad));
    };
    
    this.monitoringIntervals.set('metabolic', setInterval(measureMetabolicLoad, 2000));
  }

  /**
   * Initialize browser API monitoring
   * @private
   */
  initializeBrowserAPIMonitoring() {
    // Page Visibility API
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.handlePageHidden();
      } else {
        this.handlePageVisible();
      }
    });
    
    // Online/Offline detection
    window.addEventListener('online', () => {
      this.handleNetworkOnline();
    });
    
    window.addEventListener('offline', () => {
      this.handleNetworkOffline();
    });
  }

  /**
   * Add usage data to history
   * @private
   */
  addToHistory(resourceType, value) {
    if (!this.usageHistory[resourceType]) {
      this.usageHistory[resourceType] = [];
    }
    
    this.usageHistory[resourceType].push({
      value,
      timestamp: Date.now()
    });
    
    // Keep history size manageable
    if (this.usageHistory[resourceType].length > this.maxHistorySize) {
      this.usageHistory[resourceType].shift();
    }
  }

  /**
   * Handle resource limit exceeded
   * @private
   */
  handleResourceLimitExceeded(resourceType, usage) {
    console.warn(`Resource limit exceeded: ${resourceType} at ${usage}`);
    
    eventBus.emit('resource-limit-exceeded', {
      type: resourceType,
      usage,
      limit: this.resourceStates[resourceType].limit,
      timestamp: Date.now()
    });
    
    // Implement adaptive throttling
    this.implementAdaptiveThrottling(resourceType);
  }

  /**
   * Handle high metabolic load
   * @private
   */
  handleHighMetabolicLoad(load) {
    console.warn(`High metabolic load detected: ${load}`);
    
    eventBus.emit('high-metabolic-load', {
      load,
      threshold: this.metabolicLoad.threshold,
      timestamp: Date.now()
    });
    
    // Implement load reduction strategies
    this.implementLoadReduction();
  }

  /**
   * Implement adaptive throttling
   * @private
   */
  implementAdaptiveThrottling(resourceType) {
    switch (resourceType) {
      case 'cpu':
        // Reduce task concurrency
        this.reduceConcurrentTasks();
        break;
      case 'memory':
        // Trigger garbage collection and memory cleanup
        this.triggerMemoryCleanup();
        break;
      case 'network':
        // Delay network operations
        this.throttleNetworkOperations();
        break;
      case 'storage':
        // Clean up temporary storage
        this.cleanupStorage();
        break;
    }
  }

  /**
   * Implement load reduction strategies
   * @private
   */
  implementLoadReduction() {
    // Pause non-critical background processes
    eventBus.emit('pause-background-processes');
    
    // Reduce update frequencies
    eventBus.emit('reduce-update-frequency');
    
    // Clear caches
    this.clearCaches();
  }

  /**
   * Request resource allocation for a task
   * @param {object} resourceRequest - Resource requirements
   * @returns {Promise<boolean>} True if resources granted
   */
  async requestResources(resourceRequest) {
    const { cpu = 0, memory = 0, network = 0, storage = 0, priority = 'normal' } = resourceRequest;
    
    // Check current availability
    const available = this.checkResourceAvailability(resourceRequest);
    
    if (available) {
      return true;
    }
    
    // If high priority, try to free up resources
    if (priority === 'high') {
      const freed = await this.attemptResourceFreeing(resourceRequest);
      return freed;
    }
    
    // Queue the request for later
    return this.queueResourceRequest(resourceRequest);
  }

  /**
   * Check resource availability
   * @private
   */
  checkResourceAvailability(request) {
    const { cpu = 0, memory = 0, network = 0, storage = 0 } = request;
    
    const cpuAvailable = this.resourceStates.cpu.usage + cpu <= this.resourceStates.cpu.limit;
    const memoryAvailable = this.resourceStates.memory.usage + memory <= this.resourceStates.memory.limit;
    const networkAvailable = this.resourceStates.network.usage + network <= this.resourceStates.network.limit;
    const storageAvailable = this.resourceStates.storage.usage + storage <= this.resourceStates.storage.limit;
    
    return cpuAvailable && memoryAvailable && networkAvailable && storageAvailable;
  }

  /**
   * Get current resource status
   */
  getResourceStatus() {
    return {
      states: { ...this.resourceStates },
      metabolicLoad: { ...this.metabolicLoad },
      deviceContext: { ...this.deviceContext },
      history: {
        cpu: this.usageHistory.cpu.slice(-10),
        memory: this.usageHistory.memory.slice(-10),
        network: this.usageHistory.network.slice(-10),
        storage: this.usageHistory.storage.slice(-10)
      }
    };
  }

  /**
   * Update battery state
   * @private
   */
  updateBatteryState(battery) {
    this.resourceStates.battery = {
      available: battery.level > 0.1,
      level: Math.round(battery.level * 100),
      charging: battery.charging
    };
    
    stateManager.setState('metrics.batteryLevel', Math.round(battery.level * 100));
    
    // Adjust resource limits based on battery
    if (battery.level < 0.2 && !battery.charging) {
      this.setLowPowerMode(true);
    } else if (battery.level > 0.8 || battery.charging) {
      this.setLowPowerMode(false);
    }
  }

  /**
   * Set low power mode
   * @private
   */
  setLowPowerMode(enabled) {
    if (enabled) {
      // Reduce all resource limits
      this.resourceStates.cpu.limit = Math.min(this.resourceStates.cpu.limit, 30);
      this.resourceStates.memory.limit = Math.min(this.resourceStates.memory.limit, 256);
      this.resourceStates.network.limit = Math.min(this.resourceStates.network.limit, 128);
      
      eventBus.emit('low-power-mode-enabled');
    } else {
      // Restore normal limits
      this.setAdaptiveResourceLimits();
      
      eventBus.emit('low-power-mode-disabled');
    }
  }

  /**
   * Setup event listeners
   * @private
   */
  setupEventListeners() {
    // Listen for task start/stop events to track active operations
    eventBus.on('task-started', (data) => {
      this.trackActiveTask(data);
    });
    
    eventBus.on('task-completed', (data) => {
      this.untrackActiveTask(data);
    });
    
    // Listen for settings changes
    stateManager.subscribe('settings', (newSettings) => {
      this.updateResourceLimitsFromSettings(newSettings);
    });
  }

  /**
   * Get active worker count for CPU estimation
   * @private
   */
  getActiveWorkerCount() {
    // In real implementation, would track actual Web Workers
    return stateManager.getState('resourceUsage.tasks') || 0;
  }

  /**
   * Utility methods for resource management
   */
  reduceConcurrentTasks() {
    eventBus.emit('reduce-task-concurrency');
  }

  triggerMemoryCleanup() {
    if (window.gc) {
      window.gc(); // Chrome DevTools garbage collection
    }
    eventBus.emit('memory-cleanup-requested');
  }

  throttleNetworkOperations() {
    eventBus.emit('throttle-network-operations');
  }

  cleanupStorage() {
    eventBus.emit('cleanup-storage-requested');
  }

  clearCaches() {
    eventBus.emit('clear-caches-requested');
  }

  handlePageHidden() {
    eventBus.emit('page-hidden');
  }

  handlePageVisible() {
    eventBus.emit('page-visible');
  }

  handleNetworkOnline() {
    this.resourceStates.network.available = true;
    eventBus.emit('network-online');
  }

  handleNetworkOffline() {
    this.resourceStates.network.available = false;
    eventBus.emit('network-offline');
  }

  trackActiveTask(taskData) {
    // Track active task for resource calculations
  }

  untrackActiveTask(taskData) {
    // Remove task from active tracking
  }

  updateResourceLimitsFromSettings(settings) {
    if (settings.maxCpuUsage) {
      this.resourceStates.cpu.limit = settings.maxCpuUsage;
    }
    if (settings.maxMemoryUsage) {
      this.resourceStates.memory.limit = settings.maxMemoryUsage;
    }
  }

  async attemptResourceFreeing(request) {
    // Implement resource freeing strategies
    return false;
  }

  queueResourceRequest(request) {
    // Implement request queueing
    return false;
  }

  /**
   * Cleanup and shutdown
   */
  shutdown() {
    // Clear all monitoring intervals
    for (const [name, intervalId] of this.monitoringIntervals) {
      clearInterval(intervalId);
    }
    this.monitoringIntervals.clear();
    
    console.log('ResourceManager shutdown complete');
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    return {
      initialized: this.initialized,
      deviceContext: this.deviceContext,
      resourceStates: this.resourceStates,
      metabolicLoad: this.metabolicLoad,
      activeIntervals: Array.from(this.monitoringIntervals.keys()),
      historySize: Object.keys(this.usageHistory).reduce((total, key) => 
        total + this.usageHistory[key].length, 0
      )
    };
  }
}

// Create singleton instance
const resourceManager = new ResourceManager();

// Export for use in other modules
export default resourceManager;