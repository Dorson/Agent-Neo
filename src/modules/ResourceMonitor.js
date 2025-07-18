/**
 * Resource Monitor Module
 * 
 * Monitors system resources and calculates metabolic load as specified
 * in the implementation plan and whitepaper. Implements the homeostasis
 * principle by tracking resource usage and enforcing limits.
 * 
 * Features:
 * - CPU, memory, network, and storage monitoring
 * - Metabolic load calculation
 * - Resource limit enforcement
 * - Performance metrics collection
 * - Hardware API integration
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';
import { config } from '../core/config.js';

class ResourceMonitor {
    constructor() {
        this.name = 'ResourceMonitor';
        this.version = '1.0.0';
        this.initialized = false;
        this.monitoring = false;
        
        // Resource usage tracking
        this.currentUsage = {
            cpu: 0,
            memory: 0,
            network: 0,
            storage: 0,
            battery: 100
        };
        
        // Metabolic load tracking
        this.metabolicLoad = {
            current: 0,
            average: 0,
            peak: 0,
            history: []
        };
        
        // Resource limits from config
        this.limits = {
            maxCpu: config.resourceLimits.maxCpu,
            maxMemory: config.resourceLimits.maxMemory,
            maxNetwork: config.resourceLimits.maxNetwork,
            maxStorage: config.resourceLimits.maxStorage,
            metabolicLimitRatio: config.resourceLimits.metabolicLimitRatio
        };
        
        // Performance metrics
        this.metrics = {
            samples: [],
            maxSamples: 100,
            averageInterval: 5000, // 5 seconds
            lastSample: Date.now()
        };
        
        // Hardware API support
        this.hardwareAPIs = {
            battery: !!navigator.getBattery,
            memory: !!performance.memory,
            network: !!navigator.connection,
            storage: !!navigator.storage
        };
        
        // Monitoring intervals
        this.monitoringInterval = null;
        this.metricsInterval = null;
        
        this.init();
    }

    async init() {
        try {
            console.log('📊 Initializing Resource Monitor...');
            
            this.setupEventListeners();
            await this.detectHardwareCapabilities();
            await this.startMonitoring();
            
            this.initialized = true;
            console.log('✅ Resource Monitor initialized');
            
            eventBus.emit('module:initialized', {
                name: this.name,
                version: this.version,
                capabilities: ['resource_monitoring', 'metabolic_load', 'performance_metrics']
            });
            
        } catch (error) {
            console.error('❌ Resource Monitor initialization failed:', error);
            throw error;
        }
    }

    setupEventListeners() {
        eventBus.on('resource:start-monitoring', this.startMonitoring.bind(this));
        eventBus.on('resource:stop-monitoring', this.stopMonitoring.bind(this));
        eventBus.on('resource:update-limits', this.updateLimits.bind(this));
        eventBus.on('resource:get-status', this.getResourceStatus.bind(this));
        eventBus.on('task:start', this.onTaskStart.bind(this));
        eventBus.on('task:complete', this.onTaskComplete.bind(this));
    }

    async detectHardwareCapabilities() {
        console.log('🔍 Detecting hardware capabilities...');
        
        // Check Battery API
        if (this.hardwareAPIs.battery) {
            try {
                const battery = await navigator.getBattery();
                this.battery = battery;
                console.log('🔋 Battery API available');
            } catch (error) {
                console.warn('⚠️ Battery API not accessible:', error);
                this.hardwareAPIs.battery = false;
            }
        }
        
        // Check Memory API
        if (this.hardwareAPIs.memory) {
            console.log('💾 Memory API available');
        }
        
        // Check Network API
        if (this.hardwareAPIs.network) {
            console.log('📡 Network API available');
        }
        
        // Check Storage API
        if (this.hardwareAPIs.storage) {
            try {
                const estimate = await navigator.storage.estimate();
                console.log('💿 Storage API available:', estimate);
            } catch (error) {
                console.warn('⚠️ Storage API not accessible:', error);
                this.hardwareAPIs.storage = false;
            }
        }
    }

    async startMonitoring() {
        if (this.monitoring) {
            console.log('📊 Resource monitoring already active');
            return;
        }
        
        console.log('🎯 Starting resource monitoring...');
        this.monitoring = true;
        
        // Start main monitoring loop
        this.monitoringInterval = setInterval(async () => {
            await this.collectResourceMetrics();
            this.calculateMetabolicLoad();
            this.checkResourceLimits();
            this.updateState();
        }, 2000); // Every 2 seconds
        
        // Start metrics aggregation
        this.metricsInterval = setInterval(() => {
            this.aggregateMetrics();
        }, this.metrics.averageInterval);
        
        eventBus.emit('resource:monitoring-started');
    }

    async stopMonitoring() {
        if (!this.monitoring) {
            return;
        }
        
        console.log('🛑 Stopping resource monitoring...');
        this.monitoring = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
            this.metricsInterval = null;
        }
        
        eventBus.emit('resource:monitoring-stopped');
    }

    async collectResourceMetrics() {
        try {
            // Collect CPU usage (estimated from task execution time)
            this.currentUsage.cpu = await this.estimateCPUUsage();
            
            // Collect memory usage
            this.currentUsage.memory = await this.getMemoryUsage();
            
            // Collect network usage
            this.currentUsage.network = await this.getNetworkUsage();
            
            // Collect storage usage
            this.currentUsage.storage = await this.getStorageUsage();
            
            // Collect battery status
            this.currentUsage.battery = await this.getBatteryLevel();
            
            // Store sample
            this.metrics.samples.push({
                timestamp: Date.now(),
                usage: { ...this.currentUsage }
            });
            
            // Limit sample history
            if (this.metrics.samples.length > this.metrics.maxSamples) {
                this.metrics.samples.shift();
            }
            
        } catch (error) {
            console.error('❌ Failed to collect resource metrics:', error);
        }
    }

    async estimateCPUUsage() {
        // Estimate CPU usage based on task execution frequency and complexity
        const now = Date.now();
        const timeSinceLastSample = now - this.metrics.lastSample;
        this.metrics.lastSample = now;
        
        // Simple estimation based on recent activity
        const recentTasks = stateManager.getState('tasks.recent') || [];
        const activeTasks = recentTasks.filter(task => task.status === 'running').length;
        
        // Estimate: 10% per active task, capped at configured limit
        const estimated = Math.min(activeTasks * 10, this.limits.maxCpu);
        
        return estimated;
    }

    async getMemoryUsage() {
        if (this.hardwareAPIs.memory && performance.memory) {
            const memory = performance.memory;
            const usedPercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
            return Math.min(usedPercent, this.limits.maxMemory);
        }
        
        // Fallback estimation
        return Math.min(this.currentUsage.memory + Math.random() * 5, this.limits.maxMemory);
    }

    async getNetworkUsage() {
        if (this.hardwareAPIs.network && navigator.connection) {
            const connection = navigator.connection;
            
            // Estimate based on connection type and recent network activity
            const connectionMultiplier = {
                'slow-2g': 0.1,
                '2g': 0.3,
                '3g': 0.5,
                '4g': 0.7,
                '5g': 0.9,
                'wifi': 0.8
            };
            
            const baseUsage = connectionMultiplier[connection.effectiveType] || 0.5;
            const recentNetworkActivity = stateManager.getState('network.recentActivity') || 0;
            
            return Math.min(baseUsage * 100 + recentNetworkActivity, this.limits.maxNetwork);
        }
        
        // Fallback estimation
        return Math.min(this.currentUsage.network + Math.random() * 3, this.limits.maxNetwork);
    }

    async getStorageUsage() {
        if (this.hardwareAPIs.storage) {
            try {
                const estimate = await navigator.storage.estimate();
                const usedPercent = (estimate.usage / estimate.quota) * 100;
                return Math.min(usedPercent, this.limits.maxStorage);
            } catch (error) {
                console.warn('Could not get storage estimate:', error);
            }
        }
        
        // Fallback estimation
        return Math.min(this.currentUsage.storage + Math.random() * 2, this.limits.maxStorage);
    }

    async getBatteryLevel() {
        if (this.battery) {
            return this.battery.level * 100;
        }
        
        // Fallback: assume good battery
        return 100;
    }

    calculateMetabolicLoad() {
        // Calculate metabolic load based on resource usage
        const weights = {
            cpu: 0.4,
            memory: 0.3,
            network: 0.2,
            storage: 0.1
        };
        
        const weightedUsage = 
            (this.currentUsage.cpu * weights.cpu) +
            (this.currentUsage.memory * weights.memory) +
            (this.currentUsage.network * weights.network) +
            (this.currentUsage.storage * weights.storage);
        
        this.metabolicLoad.current = weightedUsage;
        
        // Update history
        this.metabolicLoad.history.push({
            timestamp: Date.now(),
            load: weightedUsage
        });
        
        // Limit history
        if (this.metabolicLoad.history.length > 100) {
            this.metabolicLoad.history.shift();
        }
        
        // Calculate average
        const recentHistory = this.metabolicLoad.history.slice(-20);
        this.metabolicLoad.average = recentHistory.reduce((sum, entry) => sum + entry.load, 0) / recentHistory.length;
        
        // Update peak
        this.metabolicLoad.peak = Math.max(this.metabolicLoad.peak, weightedUsage);
    }

    checkResourceLimits() {
        const violations = [];
        
        // Check individual resource limits
        if (this.currentUsage.cpu > this.limits.maxCpu) {
            violations.push({
                type: 'cpu',
                current: this.currentUsage.cpu,
                limit: this.limits.maxCpu
            });
        }
        
        if (this.currentUsage.memory > this.limits.maxMemory) {
            violations.push({
                type: 'memory',
                current: this.currentUsage.memory,
                limit: this.limits.maxMemory
            });
        }
        
        if (this.currentUsage.network > this.limits.maxNetwork) {
            violations.push({
                type: 'network',
                current: this.currentUsage.network,
                limit: this.limits.maxNetwork
            });
        }
        
        // Check metabolic load limit
        const metabolicLimit = 100 * this.limits.metabolicLimitRatio;
        if (this.metabolicLoad.current > metabolicLimit) {
            violations.push({
                type: 'metabolic_load',
                current: this.metabolicLoad.current,
                limit: metabolicLimit
            });
        }
        
        // Emit violations
        if (violations.length > 0) {
            eventBus.emit('resource:limit-violation', { violations });
            console.warn('⚠️ Resource limit violations detected:', violations);
        }
    }

    updateState() {
        stateManager.setState('resources.current', this.currentUsage);
        stateManager.setState('resources.metabolicLoad', this.metabolicLoad);
        stateManager.setState('resources.limits', this.limits);
        stateManager.setState('resources.monitoring', this.monitoring);
    }

    aggregateMetrics() {
        if (this.metrics.samples.length === 0) {
            return;
        }
        
        // Calculate averages over the interval
        const recentSamples = this.metrics.samples.slice(-10);
        const avgUsage = {
            cpu: recentSamples.reduce((sum, s) => sum + s.usage.cpu, 0) / recentSamples.length,
            memory: recentSamples.reduce((sum, s) => sum + s.usage.memory, 0) / recentSamples.length,
            network: recentSamples.reduce((sum, s) => sum + s.usage.network, 0) / recentSamples.length,
            storage: recentSamples.reduce((sum, s) => sum + s.usage.storage, 0) / recentSamples.length,
            battery: recentSamples.reduce((sum, s) => sum + s.usage.battery, 0) / recentSamples.length
        };
        
        eventBus.emit('resource:metrics-updated', {
            timestamp: Date.now(),
            current: this.currentUsage,
            average: avgUsage,
            metabolicLoad: this.metabolicLoad
        });
    }

    // Event handlers
    onTaskStart(event) {
        const { task } = event.detail;
        console.log(`📈 Task started - monitoring resource usage: ${task.id}`);
    }

    onTaskComplete(event) {
        const { task, metrics } = event.detail;
        console.log(`📉 Task completed - resource usage: ${task.id}`, metrics);
    }

    updateLimits(event) {
        const { limits } = event.detail;
        this.limits = { ...this.limits, ...limits };
        console.log('🔧 Resource limits updated:', this.limits);
        eventBus.emit('resource:limits-updated', { limits: this.limits });
    }

    // Public API
    getResourceStatus() {
        return {
            monitoring: this.monitoring,
            current: this.currentUsage,
            limits: this.limits,
            metabolicLoad: this.metabolicLoad,
            hardwareAPIs: this.hardwareAPIs
        };
    }

    getCurrentUsage() {
        return { ...this.currentUsage };
    }

    getMetabolicLoad() {
        return { ...this.metabolicLoad };
    }

    isWithinLimits() {
        return (
            this.currentUsage.cpu <= this.limits.maxCpu &&
            this.currentUsage.memory <= this.limits.maxMemory &&
            this.currentUsage.network <= this.limits.maxNetwork &&
            this.metabolicLoad.current <= (100 * this.limits.metabolicLimitRatio)
        );
    }

    canExecuteTask(estimatedLoad) {
        const projectedLoad = this.metabolicLoad.current + estimatedLoad;
        const metabolicLimit = 100 * this.limits.metabolicLimitRatio;
        
        return projectedLoad <= metabolicLimit;
    }

    // Health check
    async healthCheck() {
        return {
            initialized: this.initialized,
            monitoring: this.monitoring,
            withinLimits: this.isWithinLimits(),
            hardwareAPIs: this.hardwareAPIs,
            currentUsage: this.currentUsage,
            metabolicLoad: this.metabolicLoad.current
        };
    }

    // Cleanup
    async shutdown() {
        await this.stopMonitoring();
        this.metrics.samples = [];
        this.metabolicLoad.history = [];
        console.log('✅ Resource Monitor shutdown complete');
    }
}

// Create singleton instance
const resourceMonitor = new ResourceMonitor();

export default resourceMonitor;