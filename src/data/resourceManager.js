/**
 * Resource Manager Module
 * 
 * Tracks and manages the agent's local computational resources including
 * CPU utilization, memory, storage, and network bandwidth as specified
 * in the implementation plan.
 * 
 * Features:
 * - Real-time resource usage monitoring
 * - Resource limit enforcement
 * - Performance metrics collection
 * - Hardware API integration
 * - Resource constraint notifications
 */

import eventBus from '../core/EventBus.js';
import { config } from '../core/config.js';
import logger from '../core/logger.js';

class ResourceManager {
    constructor() {
        this.name = 'ResourceManager';
        this.version = '1.0.0';
        this.initialized = false;
        
        // Current resource usage
        this.currentUsage = {
            cpu: 0,
            memory: 0,
            storage: 0,
            network: 0,
            peers: 0
        };
        
        // Performance observers
        this.performanceObserver = null;
        this.memoryObserver = null;
        
        // Resource limits from config
        this.limits = config.resourceLimits;
        
        // Monitoring intervals
        this.monitoringInterval = null;
        this.monitoringFrequency = 5000; // 5 seconds
        
        // Resource history for averaging
        this.resourceHistory = {
            cpu: [],
            memory: [],
            network: []
        };
        this.historySize = 20; // Keep last 20 measurements
        
        this.init();
    }

    async init() {
        try {
            console.log('📊 Resource Manager initializing...');
            
            this.setupPerformanceObservers();
            this.setupEventListeners();
            this.startMonitoring();
            
            this.initialized = true;
            logger.info('Resource Manager initialized successfully');
            
            eventBus.emit('module:initialized', {
                name: this.name,
                version: this.version,
                capabilities: ['resource_monitoring', 'performance_tracking', 'limit_enforcement']
            });
            
        } catch (error) {
            logger.error('Resource Manager initialization failed:', error);
            throw error;
        }
    }

    setupEventListeners() {
        eventBus.on('resource:check_limits', this.checkResourceLimits.bind(this));
        eventBus.on('resource:get_usage', this.getResourceUsage.bind(this));
        eventBus.on('resource:update_limits', this.updateLimits.bind(this));
        eventBus.on('app:shutdown', this.shutdown.bind(this));
    }

    setupPerformanceObservers() {
        // Performance Observer for CPU usage estimation
        if ('PerformanceObserver' in window) {
            try {
                this.performanceObserver = new PerformanceObserver((list) => {
                    this.processCPUMetrics(list.getEntries());
                });
                
                this.performanceObserver.observe({ entryTypes: ['measure', 'navigation'] });
            } catch (error) {
                logger.warn('Performance Observer not supported:', error);
            }
        }
    }

    startMonitoring() {
        this.monitoringInterval = setInterval(() => {
            this.updateResourceUsage();
        }, this.monitoringFrequency);
        
        logger.info('Resource monitoring started');
    }

    async updateResourceUsage() {
        try {
            // Update memory usage
            this.updateMemoryUsage();
            
            // Update storage usage
            await this.updateStorageUsage();
            
            // Update network usage (if available)
            this.updateNetworkUsage();
            
            // Estimate CPU usage
            this.updateCPUUsage();
            
            // Check for resource constraint violations
            this.checkResourceConstraints();
            
            // Emit updated metrics
            eventBus.emit('resource:usage_updated', this.currentUsage);
            
        } catch (error) {
            logger.error('Error updating resource usage:', error);
        }
    }

    updateMemoryUsage() {
        if ('memory' in performance) {
            const memInfo = performance.memory;
            const usedMemory = memInfo.usedJSHeapSize;
            const totalMemory = memInfo.totalJSHeapSize;
            
            this.currentUsage.memory = Math.round((usedMemory / totalMemory) * 100);
            
            // Add to history for averaging
            this.resourceHistory.memory.push(this.currentUsage.memory);
            if (this.resourceHistory.memory.length > this.historySize) {
                this.resourceHistory.memory.shift();
            }
        } else if ('deviceMemory' in navigator) {
            // Fallback estimation based on device memory
            const deviceMemoryGB = navigator.deviceMemory;
            const estimatedUsage = Math.min(50, deviceMemoryGB * 10); // Conservative estimate
            this.currentUsage.memory = estimatedUsage;
        }
    }

    async updateStorageUsage() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            try {
                const estimate = await navigator.storage.estimate();
                const usedStorage = estimate.usage || 0;
                const totalStorage = estimate.quota || 1;
                
                this.currentUsage.storage = Math.round((usedStorage / totalStorage) * 100);
            } catch (error) {
                logger.warn('Storage estimation failed:', error);
            }
        }
    }

    updateNetworkUsage() {
        if ('connection' in navigator) {
            const connection = navigator.connection;
            
            // Estimate network usage based on connection type
            let networkUsagePercent = 0;
            
            switch (connection.effectiveType) {
                case 'slow-2g':
                    networkUsagePercent = 80;
                    break;
                case '2g':
                    networkUsagePercent = 60;
                    break;
                case '3g':
                    networkUsagePercent = 40;
                    break;
                case '4g':
                    networkUsagePercent = 20;
                    break;
                default:
                    networkUsagePercent = 30;
            }
            
            this.currentUsage.network = networkUsagePercent;
            
            // Add to history
            this.resourceHistory.network.push(networkUsagePercent);
            if (this.resourceHistory.network.length > this.historySize) {
                this.resourceHistory.network.shift();
            }
        }
    }

    updateCPUUsage() {
        // CPU usage estimation based on performance timing
        const now = performance.now();
        
        if (this.lastCPUCheck) {
            const timeDiff = now - this.lastCPUCheck;
            const cpuEstimate = Math.min(100, Math.max(0, (timeDiff / 100) * 10));
            
            this.currentUsage.cpu = Math.round(cpuEstimate);
            
            // Add to history for smoothing
            this.resourceHistory.cpu.push(this.currentUsage.cpu);
            if (this.resourceHistory.cpu.length > this.historySize) {
                this.resourceHistory.cpu.shift();
            }
            
            // Use average for smoother readings
            if (this.resourceHistory.cpu.length > 5) {
                const average = this.resourceHistory.cpu.reduce((a, b) => a + b, 0) / this.resourceHistory.cpu.length;
                this.currentUsage.cpu = Math.round(average);
            }
        }
        
        this.lastCPUCheck = now;
    }

    processCPUMetrics(entries) {
        entries.forEach(entry => {
            if (entry.entryType === 'measure') {
                // Use performance measurements to estimate CPU load
                const duration = entry.duration;
                if (duration > 100) { // Long running operations
                    this.currentUsage.cpu = Math.min(100, this.currentUsage.cpu + 10);
                }
            }
        });
    }

    checkResourceConstraints() {
        const violations = [];
        
        // Check CPU limit
        if (this.currentUsage.cpu > this.limits.maxCpu) {
            violations.push({
                type: 'cpu',
                current: this.currentUsage.cpu,
                limit: this.limits.maxCpu,
                severity: 'high'
            });
        }
        
        // Check memory limit
        if (this.currentUsage.memory > this.limits.maxMemory) {
            violations.push({
                type: 'memory',
                current: this.currentUsage.memory,
                limit: this.limits.maxMemory,
                severity: 'high'
            });
        }
        
        // Check storage limit
        if (this.currentUsage.storage > this.limits.maxStorage) {
            violations.push({
                type: 'storage',
                current: this.currentUsage.storage,
                limit: this.limits.maxStorage,
                severity: 'medium'
            });
        }
        
        // Check network limit
        if (this.currentUsage.network > this.limits.maxNetwork) {
            violations.push({
                type: 'network',
                current: this.currentUsage.network,
                limit: this.limits.maxNetwork,
                severity: 'low'
            });
        }
        
        if (violations.length > 0) {
            eventBus.emit('resource:constraint_violated', { violations });
            logger.warn('Resource constraints violated:', violations);
        }
    }

    checkResourceLimits(event) {
        const { type, amount } = event.detail;
        
        const available = this.getAvailableResources();
        
        if (available[type] < amount) {
            eventBus.emit('resource:insufficient', {
                type,
                requested: amount,
                available: available[type]
            });
            return false;
        }
        
        return true;
    }

    getAvailableResources() {
        return {
            cpu: Math.max(0, this.limits.maxCpu - this.currentUsage.cpu),
            memory: Math.max(0, this.limits.maxMemory - this.currentUsage.memory),
            storage: Math.max(0, this.limits.maxStorage - this.currentUsage.storage),
            network: Math.max(0, this.limits.maxNetwork - this.currentUsage.network)
        };
    }

    getResourceUsage(event) {
        const usage = {
            ...this.currentUsage,
            limits: this.limits,
            available: this.getAvailableResources(),
            history: this.resourceHistory
        };
        
        eventBus.emit('resource:usage_response', usage);
        return usage;
    }

    updateLimits(event) {
        const { limits } = event.detail;
        
        // Validate limits
        Object.keys(limits).forEach(key => {
            if (key in this.limits && typeof limits[key] === 'number' && limits[key] > 0) {
                this.limits[key] = limits[key];
            }
        });
        
        logger.info('Resource limits updated:', this.limits);
        eventBus.emit('resource:limits_updated', this.limits);
    }

    // Battery status monitoring (if available)
    async getBatteryStatus() {
        if ('getBattery' in navigator) {
            try {
                const battery = await navigator.getBattery();
                return {
                    charging: battery.charging,
                    level: battery.level,
                    chargingTime: battery.chargingTime,
                    dischargingTime: battery.dischargingTime
                };
            } catch (error) {
                logger.warn('Battery API not available:', error);
                return null;
            }
        }
        return null;
    }

    // Network information (if available)
    getNetworkInfo() {
        if ('connection' in navigator) {
            const connection = navigator.connection;
            return {
                effectiveType: connection.effectiveType,
                downlink: connection.downlink,
                rtt: connection.rtt,
                saveData: connection.saveData
            };
        }
        return null;
    }

    shutdown() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        if (this.performanceObserver) {
            this.performanceObserver.disconnect();
            this.performanceObserver = null;
        }
        
        logger.info('Resource Manager shutdown complete');
    }
}

export default ResourceManager;