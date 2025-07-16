// Agent Neo Metrics Collection Module
// Real-time performance monitoring and resource usage tracking

export class MetricsCollector {
  constructor(core) {
    this.core = core;
    this.metrics = {
      nodeUptime: 0,
      tasksProcessed: 0,
      networkPeers: 0,
      resourceUsage: {
        cpu: 0,
        memory: 0,
        network: 0,
        storage: 0
      },
      taskMetrics: {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        averageProcessingTime: 0,
        successRate: 0
      },
      networkMetrics: {
        activeConnections: 0,
        totalConnections: 0,
        dataTransferred: 0,
        connectionLatency: 0
      },
      ethicsMetrics: {
        totalEvaluations: 0,
        passedEvaluations: 0,
        failedEvaluations: 0,
        passRate: 100
      }
    };
    
    this.history = {
      resourceUsage: [],
      taskCompletion: [],
      networkActivity: [],
      ethicsEvaluations: []
    };
    
    this.isCollecting = false;
    this.collectionInterval = null;
    this.startTime = null;
    this.maxHistorySize = 1000;
  }

  async init() {
    try {
      // Initialize performance monitoring
      this.initializePerformanceMonitoring();
      
      // Load historical data
      await this.loadHistoricalData();
      
      console.log('Metrics Collector initialized');
    } catch (error) {
      console.error('Error initializing Metrics Collector:', error);
      throw error;
    }
  }

  initializePerformanceMonitoring() {
    // Set up performance observers if available
    if ('PerformanceObserver' in window) {
      try {
        // Monitor task processing performance
        const taskObserver = new PerformanceObserver((list) => {
          this.handlePerformanceEntries(list.getEntries());
        });
        
        taskObserver.observe({ entryTypes: ['measure', 'mark'] });
        
        // Monitor resource timing
        const resourceObserver = new PerformanceObserver((list) => {
          this.handleResourceTiming(list.getEntries());
        });
        
        resourceObserver.observe({ entryTypes: ['resource'] });
      } catch (error) {
        console.warn('Performance monitoring not fully supported:', error);
      }
    }
  }

  handlePerformanceEntries(entries) {
    entries.forEach(entry => {
      if (entry.name.startsWith('task-')) {
        this.updateTaskMetrics(entry);
      } else if (entry.name.startsWith('network-')) {
        this.updateNetworkMetrics(entry);
      }
    });
  }

  handleResourceTiming(entries) {
    entries.forEach(entry => {
      if (entry.name.includes('/api/') || entry.name.includes('/ws')) {
        this.metrics.networkMetrics.dataTransferred += entry.transferSize || 0;
        this.metrics.networkMetrics.connectionLatency = entry.duration;
      }
    });
  }

  async start() {
    if (this.isCollecting) return;
    
    this.isCollecting = true;
    this.startTime = Date.now();
    
    // Start metrics collection interval
    this.collectionInterval = setInterval(() => {
      this.collectMetrics();
    }, 5000); // Collect every 5 seconds
    
    // Start resource monitoring
    this.startResourceMonitoring();
    
    console.log('Metrics collection started');
  }

  async stop() {
    if (!this.isCollecting) return;
    
    this.isCollecting = false;
    
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    
    // Save current metrics
    await this.saveMetrics();
    
    console.log('Metrics collection stopped');
  }

  async collectMetrics() {
    try {
      // Update uptime
      this.metrics.nodeUptime = this.startTime ? Date.now() - this.startTime : 0;
      
      // Update task metrics
      this.updateTaskMetricsFromCore();
      
      // Update network metrics
      this.updateNetworkMetricsFromCore();
      
      // Update ethics metrics
      this.updateEthicsMetricsFromCore();
      
      // Store historical data
      this.storeHistoricalData();
      
      // Calculate derived metrics
      this.calculateDerivedMetrics();
      
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  updateTaskMetricsFromCore() {
    if (this.core.tasks) {
      const tasks = this.core.tasks.getTasks();
      const completed = this.core.tasks.getCompletedTasks();
      
      this.metrics.tasksProcessed = this.core.tasks.getProcessedCount();
      this.metrics.taskMetrics.totalTasks = tasks.length;
      this.metrics.taskMetrics.completedTasks = completed.length;
      this.metrics.taskMetrics.failedTasks = tasks.filter(t => t.status === 'failed').length;
      
      // Calculate average processing time
      if (completed.length > 0) {
        const processingTimes = completed
          .filter(t => t.createdAt && t.updatedAt)
          .map(t => new Date(t.updatedAt) - new Date(t.createdAt));
        
        this.metrics.taskMetrics.averageProcessingTime = 
          processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
      }
      
      // Calculate success rate
      if (this.metrics.taskMetrics.totalTasks > 0) {
        this.metrics.taskMetrics.successRate = 
          (this.metrics.taskMetrics.completedTasks / this.metrics.taskMetrics.totalTasks) * 100;
      }
    }
  }

  updateNetworkMetricsFromCore() {
    if (this.core.p2p) {
      this.metrics.networkPeers = this.core.p2p.getPeerCount();
      this.metrics.networkMetrics.activeConnections = this.core.p2p.getPeerCount();
      this.metrics.networkMetrics.totalConnections = this.core.p2p.peers.size;
    }
  }

  updateEthicsMetricsFromCore() {
    if (this.core.ethics) {
      const stats = this.core.ethics.getEthicsStats();
      this.metrics.ethicsMetrics = {
        totalEvaluations: stats.totalEvaluations,
        passedEvaluations: stats.passedEvaluations,
        failedEvaluations: stats.totalEvaluations - stats.passedEvaluations,
        passRate: stats.passRate
      };
    }
  }

  updateResourceMetrics(resourceData) {
    if (resourceData) {
      this.metrics.resourceUsage = {
        cpu: resourceData.cpu || 0,
        memory: resourceData.memory || 0,
        network: resourceData.network || 0,
        storage: resourceData.storage || 0
      };
    }
  }

  storeHistoricalData() {
    const timestamp = Date.now();
    
    // Store resource usage history
    this.history.resourceUsage.push({
      timestamp,
      ...this.metrics.resourceUsage
    });
    
    // Store task completion history
    this.history.taskCompletion.push({
      timestamp,
      total: this.metrics.taskMetrics.totalTasks,
      completed: this.metrics.taskMetrics.completedTasks,
      failed: this.metrics.taskMetrics.failedTasks,
      successRate: this.metrics.taskMetrics.successRate
    });
    
    // Store network activity history
    this.history.networkActivity.push({
      timestamp,
      peers: this.metrics.networkPeers,
      connections: this.metrics.networkMetrics.activeConnections,
      dataTransferred: this.metrics.networkMetrics.dataTransferred
    });
    
    // Store ethics evaluation history
    this.history.ethicsEvaluations.push({
      timestamp,
      total: this.metrics.ethicsMetrics.totalEvaluations,
      passed: this.metrics.ethicsMetrics.passedEvaluations,
      passRate: this.metrics.ethicsMetrics.passRate
    });
    
    // Trim history to max size
    this.trimHistory();
  }

  trimHistory() {
    Object.keys(this.history).forEach(key => {
      if (this.history[key].length > this.maxHistorySize) {
        this.history[key] = this.history[key].slice(-this.maxHistorySize);
      }
    });
  }

  calculateDerivedMetrics() {
    // Calculate overall resource usage percentage
    const totalResourceUsage = (
      this.metrics.resourceUsage.cpu +
      this.metrics.resourceUsage.memory +
      this.metrics.resourceUsage.network +
      this.metrics.resourceUsage.storage
    ) / 4;
    
    this.metrics.resourceUsage.overall = Math.min(totalResourceUsage, 100);
  }

  startResourceMonitoring() {
    // Monitor memory usage
    this.monitorMemoryUsage();
    
    // Monitor network usage
    this.monitorNetworkUsage();
    
    // Monitor storage usage
    this.monitorStorageUsage();
  }

  monitorMemoryUsage() {
    if ('memory' in performance) {
      const memInfo = performance.memory;
      const usedJSHeapSize = memInfo.usedJSHeapSize;
      const totalJSHeapSize = memInfo.totalJSHeapSize;
      
      this.metrics.resourceUsage.memory = 
        totalJSHeapSize > 0 ? (usedJSHeapSize / totalJSHeapSize) * 100 : 0;
    }
  }

  monitorNetworkUsage() {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      const effectiveType = connection.effectiveType;
      
      // Estimate network usage based on connection type
      const networkUsage = {
        'slow-2g': 80,
        '2g': 60,
        '3g': 40,
        '4g': 20
      };
      
      this.metrics.resourceUsage.network = networkUsage[effectiveType] || 30;
    }
  }

  async monitorStorageUsage() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const quota = estimate.quota || 1;
        
        this.metrics.resourceUsage.storage = (used / quota) * 100;
      } catch (error) {
        console.warn('Could not estimate storage usage:', error);
      }
    }
  }

  async loadHistoricalData() {
    try {
      const stored = await this.core.storage.getMetricsHistory();
      if (stored) {
        this.history = { ...this.history, ...stored };
      }
    } catch (error) {
      console.warn('Could not load historical metrics:', error);
    }
  }

  async saveMetrics() {
    try {
      await this.core.storage.saveMetrics(this.metrics);
      await this.core.storage.saveMetricsHistory(this.history);
    } catch (error) {
      console.error('Error saving metrics:', error);
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      timestamp: Date.now()
    };
  }

  getHistoricalData(type, duration = 3600000) { // 1 hour default
    const cutoff = Date.now() - duration;
    
    if (this.history[type]) {
      return this.history[type].filter(entry => entry.timestamp > cutoff);
    }
    
    return [];
  }

  getResourceUsage() {
    return Math.round(this.metrics.resourceUsage.overall || 0);
  }

  getNetworkHealth() {
    const peers = this.metrics.networkPeers;
    const connections = this.metrics.networkMetrics.activeConnections;
    
    if (peers < 5) return 'poor';
    if (peers < 20) return 'fair';
    if (peers < 50) return 'good';
    return 'excellent';
  }

  getTaskPerformance() {
    const successRate = this.metrics.taskMetrics.successRate;
    const avgTime = this.metrics.taskMetrics.averageProcessingTime;
    
    return {
      successRate,
      avgTime,
      performance: successRate > 90 ? 'excellent' : successRate > 75 ? 'good' : 'needs improvement'
    };
  }

  onNodeStatusChange(status) {
    if (status === 'started') {
      this.start();
    } else if (status === 'stopped') {
      this.stop();
    }
  }

  // Performance marking utilities
  markTaskStart(taskId) {
    performance.mark(`task-${taskId}-start`);
  }

  markTaskEnd(taskId) {
    performance.mark(`task-${taskId}-end`);
    performance.measure(`task-${taskId}`, `task-${taskId}-start`, `task-${taskId}-end`);
  }

  markNetworkStart(operation) {
    performance.mark(`network-${operation}-start`);
  }

  markNetworkEnd(operation) {
    performance.mark(`network-${operation}-end`);
    performance.measure(`network-${operation}`, `network-${operation}-start`, `network-${operation}-end`);
  }
}
