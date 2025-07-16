// Agent Neo Resource Monitor Worker
// Continuous monitoring of system resources and performance

class ResourceMonitor {
  constructor() {
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.resourceLimits = {
      cpu: 50,
      memory: 512,
      bandwidth: 10
    };
    this.metrics = {
      cpu: 0,
      memory: 0,
      network: 0,
      storage: 0
    };
    this.history = [];
    this.maxHistorySize = 100;
    this.alertThresholds = {
      cpu: 80,
      memory: 80,
      network: 80,
      storage: 90
    };
  }

  start(limits) {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.resourceLimits = { ...this.resourceLimits, ...limits };
    
    // Start monitoring loop
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, 2000); // Collect every 2 seconds
    
    console.log('Resource monitoring started');
  }

  stop() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('Resource monitoring stopped');
  }

  updateLimits(newLimits) {
    this.resourceLimits = { ...this.resourceLimits, ...newLimits };
    console.log('Resource limits updated:', this.resourceLimits);
  }

  async collectMetrics() {
    try {
      const newMetrics = {
        cpu: await this.measureCPUUsage(),
        memory: await this.measureMemoryUsage(),
        network: await this.measureNetworkUsage(),
        storage: await this.measureStorageUsage(),
        timestamp: Date.now()
      };
      
      this.metrics = newMetrics;
      this.addToHistory(newMetrics);
      
      // Check for alerts
      this.checkAlerts(newMetrics);
      
      // Send metrics to main thread
      this.postMessage({
        type: 'metrics',
        metrics: newMetrics
      });
      
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  async measureCPUUsage() {
    // CPU usage estimation based on performance timing
    const startTime = performance.now();
    
    // Perform a CPU-intensive task to measure responsiveness
    let iterations = 0;
    const maxIterations = 100000;
    const targetTime = 10; // 10ms target
    
    while (iterations < maxIterations && (performance.now() - startTime) < targetTime) {
      iterations++;
      // Simple arithmetic to simulate CPU work
      Math.sqrt(iterations * 1.5);
    }
    
    const actualTime = performance.now() - startTime;
    
    // Calculate CPU usage as percentage
    // Lower iterations per ms indicates higher CPU usage
    const efficiency = iterations / actualTime;
    const baselineEfficiency = 10000; // Baseline iterations per ms
    const cpuUsage = Math.max(0, Math.min(100, (1 - efficiency / baselineEfficiency) * 100));
    
    return cpuUsage;
  }

  async measureMemoryUsage() {
    if ('memory' in performance) {
      const memInfo = performance.memory;
      const usedHeap = memInfo.usedJSHeapSize;
      const totalHeap = memInfo.totalJSHeapSize;
      const heapLimit = memInfo.jsHeapSizeLimit;
      
      // Calculate memory usage as percentage of limit
      const memoryUsage = (usedHeap / heapLimit) * 100;
      
      return Math.min(100, memoryUsage);
    }
    
    // Fallback estimation
    return this.estimateMemoryUsage();
  }

  estimateMemoryUsage() {
    // Simple estimation based on object counting
    let objectCount = 0;
    
    // Count some global objects as a rough estimate
    if (typeof window !== 'undefined') {
      objectCount += Object.keys(window).length;
    }
    
    if (typeof global !== 'undefined') {
      objectCount += Object.keys(global).length;
    }
    
    // Rough estimation: more objects = more memory usage
    return Math.min(100, objectCount / 100);
  }

  async measureNetworkUsage() {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      
      // Estimate network usage based on connection type and effective bandwidth
      const effectiveTypes = {
        'slow-2g': 10,
        '2g': 20,
        '3g': 40,
        '4g': 20
      };
      
      const baseUsage = effectiveTypes[connection.effectiveType] || 30;
      
      // Adjust based on reported bandwidth
      const rtt = connection.rtt || 100;
      const downlink = connection.downlink || 1;
      
      // Higher RTT and lower downlink indicate higher network stress
      const networkStress = Math.min(100, (rtt / 10) + (10 / downlink));
      
      return Math.min(100, baseUsage + networkStress);
    }
    
    return this.estimateNetworkUsage();
  }

  estimateNetworkUsage() {
    // Basic estimation based on recent network activity
    const now = Date.now();
    const recentActivity = this.history.filter(h => now - h.timestamp < 30000); // Last 30 seconds
    
    if (recentActivity.length === 0) return 10;
    
    // Estimate based on frequency of measurements (proxy for activity)
    const activityRate = recentActivity.length / 30;
    return Math.min(100, activityRate * 20);
  }

  async measureStorageUsage() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const quota = estimate.quota || 1;
        
        return Math.min(100, (used / quota) * 100);
      } catch (error) {
        console.warn('Storage estimation failed:', error);
      }
    }
    
    return this.estimateStorageUsage();
  }

  estimateStorageUsage() {
    // Rough estimation based on localStorage and indexedDB usage
    let storageUsage = 0;
    
    try {
      // Check localStorage usage
      const localStorageUsed = JSON.stringify(localStorage).length;
      storageUsage += localStorageUsed / 10240; // Rough conversion to percentage
      
      // Add some base usage for IndexedDB (can't easily measure without async)
      storageUsage += 10;
      
    } catch (error) {
      storageUsage = 15; // Default estimate
    }
    
    return Math.min(100, storageUsage);
  }

  addToHistory(metrics) {
    this.history.push({
      ...metrics,
      timestamp: Date.now()
    });
    
    // Trim history to max size
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  checkAlerts(metrics) {
    const alerts = [];
    
    // Check each metric against thresholds
    Object.entries(this.alertThresholds).forEach(([metric, threshold]) => {
      if (metrics[metric] > threshold) {
        const severity = this.calculateSeverity(metrics[metric], threshold);
        alerts.push({
          metric,
          value: metrics[metric],
          threshold,
          severity,
          message: `${metric.toUpperCase()} usage (${metrics[metric].toFixed(1)}%) exceeds threshold (${threshold}%)`
        });
      }
    });
    
    // Send alerts if any
    if (alerts.length > 0) {
      this.postMessage({
        type: 'alert',
        alert: {
          timestamp: Date.now(),
          alerts,
          severity: Math.max(...alerts.map(a => a.severity === 'critical' ? 3 : a.severity === 'warning' ? 2 : 1))
        }
      });
    }
  }

  calculateSeverity(value, threshold) {
    const exceeds = value - threshold;
    const exceedsPercent = (exceeds / threshold) * 100;
    
    if (exceedsPercent > 50) return 'critical';
    if (exceedsPercent > 20) return 'warning';
    return 'info';
  }

  getResourceEfficiency() {
    const efficiency = {
      cpu: Math.max(0, 100 - this.metrics.cpu),
      memory: Math.max(0, 100 - this.metrics.memory),
      network: Math.max(0, 100 - this.metrics.network),
      storage: Math.max(0, 100 - this.metrics.storage)
    };
    
    const overall = (efficiency.cpu + efficiency.memory + efficiency.network + efficiency.storage) / 4;
    
    return {
      ...efficiency,
      overall
    };
  }

  getResourceTrends() {
    if (this.history.length < 2) return {};
    
    const recent = this.history.slice(-10); // Last 10 measurements
    const trends = {};
    
    ['cpu', 'memory', 'network', 'storage'].forEach(metric => {
      const values = recent.map(h => h[metric]);
      const trend = this.calculateTrend(values);
      trends[metric] = trend;
    });
    
    return trends;
  }

  calculateTrend(values) {
    if (values.length < 2) return 'stable';
    
    const first = values[0];
    const last = values[values.length - 1];
    const change = last - first;
    const changePercent = (change / first) * 100;
    
    if (changePercent > 10) return 'increasing';
    if (changePercent < -10) return 'decreasing';
    return 'stable';
  }

  getPerformanceScore() {
    const efficiency = this.getResourceEfficiency();
    const trends = this.getResourceTrends();
    
    // Base score from efficiency
    let score = efficiency.overall;
    
    // Adjust based on trends
    Object.values(trends).forEach(trend => {
      if (trend === 'increasing') score -= 5;
      if (trend === 'decreasing') score += 2;
    });
    
    // Check for critical thresholds
    Object.entries(this.metrics).forEach(([metric, value]) => {
      if (value > 90) score -= 10;
      if (value > 95) score -= 20;
    });
    
    return Math.max(0, Math.min(100, score));
  }

  postMessage(data) {
    self.postMessage(data);
  }
}

// Worker message handling
const monitor = new ResourceMonitor();

self.onmessage = function(event) {
  const { type, limits } = event.data;
  
  switch (type) {
    case 'start':
      monitor.start(limits);
      break;
      
    case 'stop':
      monitor.stop();
      break;
      
    case 'updateLimits':
      monitor.updateLimits(limits);
      break;
      
    case 'getMetrics':
      monitor.postMessage({
        type: 'metrics',
        metrics: monitor.metrics
      });
      break;
      
    case 'getEfficiency':
      monitor.postMessage({
        type: 'efficiency',
        efficiency: monitor.getResourceEfficiency()
      });
      break;
      
    case 'getTrends':
      monitor.postMessage({
        type: 'trends',
        trends: monitor.getResourceTrends()
      });
      break;
      
    case 'getPerformanceScore':
      monitor.postMessage({
        type: 'performance',
        score: monitor.getPerformanceScore()
      });
      break;
  }
};

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ResourceMonitor;
}
