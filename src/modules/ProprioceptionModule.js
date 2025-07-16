/**
 * Proprioception Module - Internal Awareness System
 * 
 * Implements the proprioception and exteroception capabilities described in the whitepaper.
 * This module monitors the agent's internal state, resource usage, performance metrics,
 * and provides the foundational data for the Proof-of-Performance economy.
 * 
 * Key Features:
 * - Real-time resource monitoring (CPU, memory, network)
 * - Performance metrics tracking
 * - Internal state awareness
 * - Browser API integration (Battery, Network, Memory)
 * - Metabolic load verification
 * - System health monitoring
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';

class ProprioceptionModule {
    constructor() {
        this.name = 'ProprioceptionModule';
        this.version = '1.0.0';
        this.initialized = false;
        this.active = false;
        
        // Monitoring configuration
        this.config = {
            monitoringInterval: 2000, // 2 seconds
            performanceWindow: 30, // Keep 30 data points
            alertThresholds: {
                cpu: 80,
                memory: 85,
                responseTime: 5000,
                errorRate: 0.1
            },
            batteryThresholds: {
                low: 0.2,
                critical: 0.1
            }
        };
        
        // Monitoring state
        this.metrics = {
            cpu: { current: 0, history: [] },
            memory: { current: 0, history: [] },
            network: { current: 0, history: [] },
            responseTime: { current: 0, history: [] },
            errorRate: { current: 0, history: [] }
        };
        
        // Performance tracking
        this.performance = {
            tasksCompleted: 0,
            tasksErrored: 0,
            totalResponseTime: 0,
            averageResponseTime: 0,
            uptime: 0,
            startTime: Date.now()
        };
        
        // Resource tracking
        this.resources = {
            jsHeapSize: 0,
            totalJSHeapSize: 0,
            jsHeapSizeLimit: 0,
            batteryLevel: 1,
            batteryCharging: false,
            networkType: 'unknown',
            networkDownlink: 0,
            isOnline: navigator.onLine
        };
        
        // Internal state tracking
        this.internalState = {
            modules: new Map(),
            connections: new Map(),
            tasks: new Map(),
            errors: []
        };
        
        // Monitoring intervals
        this.intervals = new Map();
        
        this.init();
    }

    async init() {
        try {
            console.log('📊 Initializing Proprioception Module...');
            
            this.setupEventListeners();
            await this.initializeBrowserAPIs();
            this.startMonitoring();
            
            this.initialized = true;
            console.log('✅ Proprioception Module initialized');
            
            eventBus.emit('module:initialized', {
                name: this.name,
                version: this.version
            });
            
        } catch (error) {
            console.error('❌ Proprioception Module initialization failed:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Resource monitoring requests
        eventBus.on('proprioception:get-metrics', this.getMetrics.bind(this));
        eventBus.on('proprioception:get-resources', this.getResources.bind(this));
        eventBus.on('proprioception:get-performance', this.getPerformanceMetrics.bind(this));
        
        // Task tracking
        eventBus.on('task:started', this.trackTaskStart.bind(this));
        eventBus.on('task:completed', this.trackTaskCompletion.bind(this));
        eventBus.on('task:error', this.trackTaskError.bind(this));
        
        // Module tracking
        eventBus.on('module:started', this.trackModuleStart.bind(this));
        eventBus.on('module:stopped', this.trackModuleStop.bind(this));
        
        // Connection tracking
        eventBus.on('connection:established', this.trackConnection.bind(this));
        eventBus.on('connection:lost', this.untrackConnection.bind(this));
        
        // Configuration updates
        eventBus.on('proprioception:config:update', this.updateConfiguration.bind(this));
        
        // Metabolic load verification
        eventBus.on('metabolic:verify-load', this.verifyMetabolicLoad.bind(this));
    }

    async initializeBrowserAPIs() {
        // Initialize Battery API
        try {
            if ('getBattery' in navigator) {
                const battery = await navigator.getBattery();
                this.battery = battery;
                this.updateBatteryInfo();
                
                // Listen for battery changes
                battery.addEventListener('chargingchange', () => this.updateBatteryInfo());
                battery.addEventListener('levelchange', () => this.updateBatteryInfo());
            }
        } catch (error) {
            console.warn('Battery API not available:', error);
        }
        
        // Initialize Network Information API
        try {
            if ('connection' in navigator) {
                this.connection = navigator.connection;
                this.updateNetworkInfo();
                
                // Listen for network changes
                this.connection.addEventListener('change', () => this.updateNetworkInfo());
            }
        } catch (error) {
            console.warn('Network Information API not available:', error);
        }
        
        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.resources.isOnline = true;
            this.notifyResourceChange('network', { online: true });
        });
        
        window.addEventListener('offline', () => {
            this.resources.isOnline = false;
            this.notifyResourceChange('network', { online: false });
        });
        
        // Initialize performance monitoring
        this.initializePerformanceMonitoring();
    }

    startMonitoring() {
        // Resource monitoring interval
        const resourceInterval = setInterval(() => {
            this.updateResourceMetrics();
        }, this.config.monitoringInterval);
        
        this.intervals.set('resources', resourceInterval);
        
        // Performance monitoring interval
        const performanceInterval = setInterval(() => {
            this.updatePerformanceMetrics();
        }, this.config.monitoringInterval * 2); // Less frequent
        
        this.intervals.set('performance', performanceInterval);
        
        // Health check interval
        const healthInterval = setInterval(() => {
            this.performHealthCheck();
        }, this.config.monitoringInterval * 10); // Every 20 seconds
        
        this.intervals.set('health', healthInterval);
        
        console.log('📊 Monitoring started');
    }

    updateResourceMetrics() {
        // Update memory usage
        if (performance.memory) {
            const memInfo = performance.memory;
            this.resources.jsHeapSize = memInfo.usedJSHeapSize;
            this.resources.totalJSHeapSize = memInfo.totalJSHeapSize;
            this.resources.jsHeapSizeLimit = memInfo.jsHeapSizeLimit;
            
            const memoryPercent = (memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100;
            this.updateMetric('memory', memoryPercent);
        }
        
        // Estimate CPU usage (simplified)
        const cpuUsage = this.estimateCPUUsage();
        this.updateMetric('cpu', cpuUsage);
        
        // Update network usage
        const networkUsage = this.estimateNetworkUsage();
        this.updateMetric('network', networkUsage);
        
        // Emit resource updates
        eventBus.emit('resources:usage-update', {
            cpu: this.metrics.cpu.current,
            memory: this.metrics.memory.current,
            network: this.metrics.network.current,
            timestamp: Date.now()
        });
        
        // Update state
        stateManager.setState('resources', {
            cpu: Math.round(this.metrics.cpu.current),
            memory: Math.round(this.metrics.memory.current),
            network: Math.round(this.metrics.network.current),
            battery: Math.round(this.resources.batteryLevel * 100),
            online: this.resources.isOnline
        });
    }

    updatePerformanceMetrics() {
        // Calculate uptime
        this.performance.uptime = Date.now() - this.performance.startTime;
        
        // Calculate average response time
        if (this.performance.tasksCompleted > 0) {
            this.performance.averageResponseTime = 
                this.performance.totalResponseTime / this.performance.tasksCompleted;
        }
        
        // Calculate error rate
        const totalTasks = this.performance.tasksCompleted + this.performance.tasksErrored;
        if (totalTasks > 0) {
            this.performance.errorRate = this.performance.tasksErrored / totalTasks;
        }
        
        // Update response time metric
        this.updateMetric('responseTime', this.performance.averageResponseTime);
        this.updateMetric('errorRate', this.performance.errorRate * 100);
        
        // Update state
        stateManager.setState('performance', {
            tasksCompleted: this.performance.tasksCompleted,
            averageResponseTime: Math.round(this.performance.averageResponseTime),
            errorRate: (this.performance.errorRate * 100).toFixed(2),
            uptime: Math.round(this.performance.uptime / 1000) // in seconds
        });
    }

    performHealthCheck() {
        const issues = [];
        const warnings = [];
        
        // Check resource thresholds
        if (this.metrics.cpu.current > this.config.alertThresholds.cpu) {
            issues.push(`High CPU usage: ${this.metrics.cpu.current.toFixed(1)}%`);
        }
        
        if (this.metrics.memory.current > this.config.alertThresholds.memory) {
            issues.push(`High memory usage: ${this.metrics.memory.current.toFixed(1)}%`);
        }
        
        if (this.performance.averageResponseTime > this.config.alertThresholds.responseTime) {
            warnings.push(`Slow response time: ${this.performance.averageResponseTime.toFixed(0)}ms`);
        }
        
        if (this.performance.errorRate > this.config.alertThresholds.errorRate) {
            issues.push(`High error rate: ${(this.performance.errorRate * 100).toFixed(1)}%`);
        }
        
        // Check battery level
        if (this.resources.batteryLevel < this.config.batteryThresholds.critical) {
            issues.push(`Critical battery level: ${(this.resources.batteryLevel * 100).toFixed(0)}%`);
        } else if (this.resources.batteryLevel < this.config.batteryThresholds.low) {
            warnings.push(`Low battery level: ${(this.resources.batteryLevel * 100).toFixed(0)}%`);
        }
        
        // Emit health status
        const healthStatus = {
            status: issues.length > 0 ? 'critical' : warnings.length > 0 ? 'warning' : 'healthy',
            issues,
            warnings,
            timestamp: Date.now()
        };
        
        eventBus.emit('system:health-check', healthStatus);
        stateManager.setState('system.health', healthStatus);
        
        // Trigger throttling if needed
        if (issues.length > 0) {
            eventBus.emit('system:performance-issues', {
                type: 'resource-limits',
                issues,
                recommendations: this.generateRecommendations(issues)
            });
        }
    }

    updateMetric(type, value) {
        if (!this.metrics[type]) {
            this.metrics[type] = { current: 0, history: [] };
        }
        
        this.metrics[type].current = value;
        this.metrics[type].history.push({
            value,
            timestamp: Date.now()
        });
        
        // Maintain history window
        if (this.metrics[type].history.length > this.config.performanceWindow) {
            this.metrics[type].history.shift();
        }
    }

    estimateCPUUsage() {
        // Simplified CPU usage estimation based on various factors
        let cpuUsage = 0;
        
        // Factor in number of active tasks
        const activeTasks = this.internalState.tasks.size;
        cpuUsage += activeTasks * 5;
        
        // Factor in response time degradation
        if (this.performance.averageResponseTime > 1000) {
            cpuUsage += 20;
        }
        
        // Factor in error rate
        cpuUsage += this.performance.errorRate * 30;
        
        // Add some baseline usage
        cpuUsage += Math.random() * 10 + 5;
        
        return Math.min(cpuUsage, 100);
    }

    estimateNetworkUsage() {
        // Simplified network usage estimation
        let networkUsage = 0;
        
        // Factor in active connections
        const activeConnections = this.internalState.connections.size;
        networkUsage += activeConnections * 10;
        
        // Factor in online status
        if (!this.resources.isOnline) {
            networkUsage = 0;
        }
        
        // Add baseline for P2P activity
        if (activeConnections > 0) {
            networkUsage += Math.random() * 20 + 10;
        }
        
        return Math.min(networkUsage, 100);
    }

    updateBatteryInfo() {
        if (this.battery) {
            this.resources.batteryLevel = this.battery.level;
            this.resources.batteryCharging = this.battery.charging;
            
            this.notifyResourceChange('battery', {
                level: this.resources.batteryLevel,
                charging: this.resources.batteryCharging
            });
        }
    }

    updateNetworkInfo() {
        if (this.connection) {
            this.resources.networkType = this.connection.effectiveType || 'unknown';
            this.resources.networkDownlink = this.connection.downlink || 0;
            
            this.notifyResourceChange('network', {
                type: this.resources.networkType,
                downlink: this.resources.networkDownlink
            });
        }
    }

    initializePerformanceMonitoring() {
        // Set up performance observers
        try {
            // Monitor navigation timing
            const navigationObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.processPerformanceEntry(entry);
                }
            });
            navigationObserver.observe({ entryTypes: ['navigation'] });
            
            // Monitor resource timing
            const resourceObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.processResourceEntry(entry);
                }
            });
            resourceObserver.observe({ entryTypes: ['resource'] });
            
        } catch (error) {
            console.warn('Performance observers not available:', error);
        }
    }

    processPerformanceEntry(entry) {
        // Process navigation performance entries
        if (entry.entryType === 'navigation') {
            const loadTime = entry.loadEventEnd - entry.loadEventStart;
            this.updateMetric('responseTime', loadTime);
        }
    }

    processResourceEntry(entry) {
        // Process resource loading performance
        const loadTime = entry.responseEnd - entry.requestStart;
        if (loadTime > 0) {
            // Track resource loading times
            this.performance.totalResponseTime += loadTime;
        }
    }

    trackTaskStart(taskData) {
        this.internalState.tasks.set(taskData.id, {
            ...taskData,
            startTime: Date.now(),
            status: 'running'
        });
    }

    trackTaskCompletion(taskData) {
        const task = this.internalState.tasks.get(taskData.id);
        if (task) {
            const duration = Date.now() - task.startTime;
            this.performance.tasksCompleted++;
            this.performance.totalResponseTime += duration;
            
            // Remove from active tasks
            this.internalState.tasks.delete(taskData.id);
            
            // Emit task metrics
            eventBus.emit('proprioception:task-metrics', {
                taskId: taskData.id,
                duration,
                success: true
            });
        }
    }

    trackTaskError(taskData) {
        const task = this.internalState.tasks.get(taskData.id);
        if (task) {
            this.performance.tasksErrored++;
            
            // Log error
            this.internalState.errors.push({
                taskId: taskData.id,
                error: taskData.error,
                timestamp: Date.now()
            });
            
            // Remove from active tasks
            this.internalState.tasks.delete(taskData.id);
            
            // Emit task metrics
            eventBus.emit('proprioception:task-metrics', {
                taskId: taskData.id,
                success: false,
                error: taskData.error
            });
        }
    }

    trackModuleStart(moduleData) {
        this.internalState.modules.set(moduleData.name, {
            ...moduleData,
            startTime: Date.now(),
            status: 'active'
        });
    }

    trackModuleStop(moduleData) {
        const module = this.internalState.modules.get(moduleData.name);
        if (module) {
            module.status = 'stopped';
            module.stopTime = Date.now();
        }
    }

    trackConnection(connectionData) {
        this.internalState.connections.set(connectionData.id, {
            ...connectionData,
            connectedAt: Date.now(),
            status: 'active'
        });
    }

    untrackConnection(connectionData) {
        this.internalState.connections.delete(connectionData.id);
    }

    verifyMetabolicLoad(loadData) {
        // Verify actual vs predicted metabolic load
        const actualUsage = {
            cpu: this.metrics.cpu.current,
            memory: this.metrics.memory.current,
            network: this.metrics.network.current
        };
        
        const verification = {
            predicted: loadData.predicted,
            actual: actualUsage,
            variance: {
                cpu: Math.abs(actualUsage.cpu - (loadData.predicted.cpu || 0)),
                memory: Math.abs(actualUsage.memory - (loadData.predicted.memory || 0)),
                network: Math.abs(actualUsage.network - (loadData.predicted.network || 0))
            },
            accuracy: this.calculateLoadAccuracy(loadData.predicted, actualUsage),
            timestamp: Date.now()
        };
        
        eventBus.emit('metabolic:verification-complete', verification);
        return verification;
    }

    calculateLoadAccuracy(predicted, actual) {
        const cpuAccuracy = 1 - Math.abs(predicted.cpu - actual.cpu) / 100;
        const memoryAccuracy = 1 - Math.abs(predicted.memory - actual.memory) / 100;
        const networkAccuracy = 1 - Math.abs(predicted.network - actual.network) / 100;
        
        return (cpuAccuracy + memoryAccuracy + networkAccuracy) / 3;
    }

    generateRecommendations(issues) {
        const recommendations = [];
        
        issues.forEach(issue => {
            if (issue.includes('CPU')) {
                recommendations.push('Consider reducing active tasks or increasing task intervals');
            }
            if (issue.includes('memory')) {
                recommendations.push('Clear cache or reduce memory-intensive operations');
            }
            if (issue.includes('battery')) {
                recommendations.push('Enable power saving mode or reduce background activity');
            }
            if (issue.includes('error rate')) {
                recommendations.push('Review recent tasks for error patterns');
            }
        });
        
        return recommendations;
    }

    notifyResourceChange(type, data) {
        eventBus.emit('resources:change', {
            type,
            data,
            timestamp: Date.now()
        });
    }

    getMetrics() {
        return {
            current: {
                cpu: this.metrics.cpu.current,
                memory: this.metrics.memory.current,
                network: this.metrics.network.current,
                responseTime: this.metrics.responseTime.current,
                errorRate: this.metrics.errorRate.current
            },
            history: this.metrics,
            timestamp: Date.now()
        };
    }

    getResources() {
        return {
            ...this.resources,
            timestamp: Date.now()
        };
    }

    getPerformanceMetrics() {
        return {
            ...this.performance,
            timestamp: Date.now()
        };
    }

    updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('📊 Proprioception configuration updated:', this.config);
        eventBus.emit('proprioception:config-updated', this.config);
    }

    getStatus() {
        return {
            name: this.name,
            version: this.version,
            initialized: this.initialized,
            active: this.active,
            config: this.config,
            metrics: this.getMetrics(),
            resources: this.getResources(),
            performance: this.getPerformanceMetrics(),
            internalState: {
                activeTasks: this.internalState.tasks.size,
                activeModules: Array.from(this.internalState.modules.keys()),
                activeConnections: this.internalState.connections.size,
                recentErrors: this.internalState.errors.slice(-5)
            }
        };
    }

    async start() {
        this.active = true;
        stateManager.setState('proprioception.active', true);
        console.log('📊 Proprioception Module started');
        eventBus.emit('module:started', { name: this.name });
    }

    async stop() {
        this.active = false;
        
        // Clear intervals
        this.intervals.forEach((interval, name) => {
            clearInterval(interval);
        });
        this.intervals.clear();
        
        stateManager.setState('proprioception.active', false);
        console.log('📊 Proprioception Module stopped');
        eventBus.emit('module:stopped', { name: this.name });
    }
}

// Create and export singleton instance
const proprioceptionModule = new ProprioceptionModule();
export default proprioceptionModule;