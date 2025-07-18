/**
 * Application Manager
 * 
 * Centralized application lifecycle management for Agent Neo DApp.
 * Orchestrates initialization, configuration, and shutdown of all components
 * according to the whitepaper specifications.
 * 
 * Features:
 * - Dependency-aware module initialization
 * - Error recovery and graceful degradation
 * - Performance monitoring and optimization
 * - Configuration management
 * - Health monitoring and diagnostics
 */

import eventBus from './EventBus.js';
import stateManager from './StateManager.js';
import config from './config.js';

class ApplicationManager {
    constructor() {
        this.initialized = false;
        this.modules = new Map();
        this.dependencyGraph = new Map();
        this.initializationOrder = [];
        this.healthChecks = new Map();
        this.performanceMetrics = {
            startTime: Date.now(),
            initializationTime: 0,
            modulesLoaded: 0,
            modulesActive: 0,
            errors: 0,
            warnings: 0
        };
        
        // Application state
        this.state = 'initializing';
        this.lastHeartbeat = Date.now();
        this.heartbeatInterval = null;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Module lifecycle events
        eventBus.on('module:registered', this.handleModuleRegistered.bind(this));
        eventBus.on('module:initialized', this.handleModuleInitialized.bind(this));
        eventBus.on('module:error', this.handleModuleError.bind(this));
        eventBus.on('module:health-check', this.handleModuleHealthCheck.bind(this));
        
        // Application lifecycle events
        eventBus.on('app:shutdown', this.shutdown.bind(this));
        eventBus.on('app:restart', this.restart.bind(this));
        eventBus.on('app:health-check', this.performHealthCheck.bind(this));
        
        // Error handling
        eventBus.on('error:unhandled', this.handleUnhandledError.bind(this));
        
        // Resource monitoring
        eventBus.on('resource:limit-exceeded', this.handleResourceLimit.bind(this));
        eventBus.on('resource:available', this.handleResourceAvailable.bind(this));
    }
    
    /**
     * Register a module with the application manager
     */
    registerModule(name, instance, dependencies = [], healthCheckFn = null) {
        if (this.modules.has(name)) {
            console.warn(`Module ${name} already registered, updating...`);
        }
        
        this.modules.set(name, {
            name,
            instance,
            dependencies,
            status: 'registered',
            initialized: false,
            healthy: true,
            lastHealthCheck: Date.now(),
            errors: 0,
            performance: {
                initTime: 0,
                avgResponseTime: 0,
                totalRequests: 0
            }
        });
        
        if (healthCheckFn) {
            this.healthChecks.set(name, healthCheckFn);
        }
        
        // Update dependency graph
        this.dependencyGraph.set(name, dependencies);
        this.updateInitializationOrder();
        
        eventBus.emit('module:registered', { name, dependencies });
        
        console.log(`📦 Module ${name} registered with dependencies: ${dependencies.join(', ') || 'none'}`);
    }
    
    /**
     * Update the module initialization order based on dependencies
     */
    updateInitializationOrder() {
        const visited = new Set();
        const visiting = new Set();
        const order = [];
        
        const visit = (moduleName) => {
            if (visiting.has(moduleName)) {
                throw new Error(`Circular dependency detected involving ${moduleName}`);
            }
            
            if (visited.has(moduleName)) {
                return;
            }
            
            visiting.add(moduleName);
            
            const dependencies = this.dependencyGraph.get(moduleName) || [];
            for (const dep of dependencies) {
                if (this.dependencyGraph.has(dep)) {
                    visit(dep);
                }
            }
            
            visiting.delete(moduleName);
            visited.add(moduleName);
            order.push(moduleName);
        };
        
        // Visit all modules
        for (const moduleName of this.dependencyGraph.keys()) {
            visit(moduleName);
        }
        
        this.initializationOrder = order;
        console.log(`📋 Module initialization order: ${order.join(' → ')}`);
    }
    
    /**
     * Initialize all registered modules in dependency order
     */
    async initialize() {
        if (this.initialized) {
            console.warn('Application already initialized');
            return;
        }
        
        console.log('🚀 Starting Agent Neo Application Manager...');
        const startTime = Date.now();
        
        try {
            // Set initial state
            this.state = 'initializing';
            stateManager.setState('app.status', 'initializing');
            
            // Initialize modules in dependency order
            for (const moduleName of this.initializationOrder) {
                await this.initializeModule(moduleName);
            }
            
            // Start health monitoring
            this.startHealthMonitoring();
            
            // Mark as initialized
            this.initialized = true;
            this.state = 'running';
            this.performanceMetrics.initializationTime = Date.now() - startTime;
            this.performanceMetrics.modulesLoaded = this.modules.size;
            this.performanceMetrics.modulesActive = Array.from(this.modules.values()).filter(m => m.initialized).length;
            
            stateManager.setState('app.status', 'running');
            stateManager.setState('app.metrics', this.performanceMetrics);
            
            eventBus.emit('app:initialized', {
                initializationTime: this.performanceMetrics.initializationTime,
                modulesLoaded: this.performanceMetrics.modulesLoaded,
                modulesActive: this.performanceMetrics.modulesActive
            });
            
            console.log(`✅ Agent Neo Application initialized successfully in ${this.performanceMetrics.initializationTime}ms`);
            console.log(`📊 Modules: ${this.performanceMetrics.modulesActive}/${this.performanceMetrics.modulesLoaded} active`);
            
        } catch (error) {
            this.state = 'error';
            stateManager.setState('app.status', 'error');
            this.performanceMetrics.errors++;
            
            console.error('❌ Application initialization failed:', error);
            eventBus.emit('app:error', { error, phase: 'initialization' });
            
            throw error;
        }
    }
    
    /**
     * Initialize a specific module
     */
    async initializeModule(moduleName) {
        const moduleInfo = this.modules.get(moduleName);
        if (!moduleInfo) {
            throw new Error(`Module ${moduleName} not registered`);
        }
        
        if (moduleInfo.initialized) {
            console.log(`⏭️ Module ${moduleName} already initialized`);
            return;
        }
        
        console.log(`📦 Initializing module: ${moduleName}...`);
        const startTime = Date.now();
        
        try {
            // Check dependencies
            for (const dep of moduleInfo.dependencies) {
                const depModule = this.modules.get(dep);
                if (!depModule || !depModule.initialized) {
                    throw new Error(`Dependency ${dep} not initialized for ${moduleName}`);
                }
            }
            
            // Initialize the module
            if (moduleInfo.instance && typeof moduleInfo.instance.initialize === 'function') {
                await moduleInfo.instance.initialize();
            }
            
            // Update module status
            moduleInfo.initialized = true;
            moduleInfo.status = 'active';
            moduleInfo.performance.initTime = Date.now() - startTime;
            
            eventBus.emit('module:initialized', { name: moduleName, initTime: moduleInfo.performance.initTime });
            
            console.log(`✅ Module ${moduleName} initialized in ${moduleInfo.performance.initTime}ms`);
            
        } catch (error) {
            moduleInfo.status = 'error';
            moduleInfo.errors++;
            this.performanceMetrics.errors++;
            
            console.error(`❌ Failed to initialize module ${moduleName}:`, error);
            eventBus.emit('module:error', { name: moduleName, error, phase: 'initialization' });
            
            // Determine if this is a critical module
            if (this.isCriticalModule(moduleName)) {
                throw error;
            } else {
                console.warn(`⚠️ Non-critical module ${moduleName} failed, continuing...`);
                this.performanceMetrics.warnings++;
            }
        }
    }
    
    /**
     * Check if a module is critical for application operation
     */
    isCriticalModule(moduleName) {
        const criticalModules = [
            'EventBus',
            'StateManager',
            'CryptoManager',
            'IdentityManager',
            'LocalLedger',
            'EthicsModule'
        ];
        
        return criticalModules.includes(moduleName);
    }
    
    /**
     * Start health monitoring for all modules
     */
    startHealthMonitoring() {
        this.heartbeatInterval = setInterval(() => {
            this.performHealthCheck();
        }, config.application.healthCheckInterval || 30000);
        
        console.log('💓 Health monitoring started');
    }
    
    /**
     * Perform health check on all modules
     */
    async performHealthCheck() {
        const healthReport = {
            timestamp: Date.now(),
            overall: 'healthy',
            modules: {},
            metrics: this.performanceMetrics
        };
        
        let unhealthyCount = 0;
        
        for (const [name, moduleInfo] of this.modules) {
            try {
                let healthy = true;
                let details = {};
                
                // Run custom health check if available
                if (this.healthChecks.has(name)) {
                    const healthCheckResult = await this.healthChecks.get(name)();
                    healthy = healthCheckResult.healthy;
                    details = healthCheckResult.details || {};
                }
                
                // Basic health indicators
                const isResponsive = moduleInfo.status === 'active';
                const hasErrors = moduleInfo.errors > 0;
                const recentErrors = moduleInfo.errors > 0 && (Date.now() - moduleInfo.lastHealthCheck) < 60000;
                
                if (!isResponsive || recentErrors) {
                    healthy = false;
                    unhealthyCount++;
                }
                
                moduleInfo.healthy = healthy;
                moduleInfo.lastHealthCheck = Date.now();
                
                healthReport.modules[name] = {
                    healthy,
                    status: moduleInfo.status,
                    errors: moduleInfo.errors,
                    initialized: moduleInfo.initialized,
                    details
                };
                
            } catch (error) {
                console.error(`Health check failed for ${name}:`, error);
                moduleInfo.healthy = false;
                unhealthyCount++;
                
                healthReport.modules[name] = {
                    healthy: false,
                    status: 'error',
                    error: error.message
                };
            }
        }
        
        // Determine overall health
        if (unhealthyCount === 0) {
            healthReport.overall = 'healthy';
        } else if (unhealthyCount < this.modules.size * 0.3) {
            healthReport.overall = 'degraded';
        } else {
            healthReport.overall = 'unhealthy';
        }
        
        this.lastHeartbeat = Date.now();
        stateManager.setState('app.health', healthReport);
        
        eventBus.emit('app:health-report', healthReport);
        
        if (healthReport.overall !== 'healthy') {
            console.warn(`⚠️ Application health: ${healthReport.overall} (${unhealthyCount}/${this.modules.size} modules unhealthy)`);
        }
        
        return healthReport;
    }
    
    /**
     * Restart the application
     */
    async restart() {
        console.log('🔄 Restarting Agent Neo Application...');
        
        await this.shutdown();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
        await this.initialize();
        
        console.log('✅ Agent Neo Application restarted successfully');
    }
    
    /**
     * Shutdown the application gracefully
     */
    async shutdown() {
        console.log('🛑 Shutting down Agent Neo Application...');
        
        this.state = 'shutting-down';
        stateManager.setState('app.status', 'shutting-down');
        
        // Stop health monitoring
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        
        // Shutdown modules in reverse order
        const shutdownOrder = [...this.initializationOrder].reverse();
        
        for (const moduleName of shutdownOrder) {
            await this.shutdownModule(moduleName);
        }
        
        this.initialized = false;
        this.state = 'offline';
        stateManager.setState('app.status', 'offline');
        
        eventBus.emit('app:shutdown-complete');
        
        console.log('✅ Agent Neo Application shut down complete');
    }
    
    /**
     * Shutdown a specific module
     */
    async shutdownModule(moduleName) {
        const moduleInfo = this.modules.get(moduleName);
        if (!moduleInfo || !moduleInfo.initialized) {
            return;
        }
        
        try {
            console.log(`🛑 Shutting down module: ${moduleName}...`);
            
            if (moduleInfo.instance && typeof moduleInfo.instance.shutdown === 'function') {
                await moduleInfo.instance.shutdown();
            }
            
            moduleInfo.initialized = false;
            moduleInfo.status = 'shutdown';
            
            console.log(`✅ Module ${moduleName} shut down successfully`);
            
        } catch (error) {
            console.error(`❌ Error shutting down module ${moduleName}:`, error);
            moduleInfo.status = 'error';
        }
    }
    
    // Event handlers
    handleModuleRegistered(event) {
        this.performanceMetrics.modulesLoaded++;
    }
    
    handleModuleInitialized(event) {
        this.performanceMetrics.modulesActive++;
    }
    
    handleModuleError(event) {
        this.performanceMetrics.errors++;
        const moduleInfo = this.modules.get(event.name);
        if (moduleInfo) {
            moduleInfo.errors++;
        }
    }
    
    handleModuleHealthCheck(event) {
        // Module-specific health check handling
        const moduleInfo = this.modules.get(event.name);
        if (moduleInfo) {
            moduleInfo.healthy = event.healthy;
            moduleInfo.lastHealthCheck = Date.now();
        }
    }
    
    handleUnhandledError(event) {
        this.performanceMetrics.errors++;
        console.error('Unhandled application error:', event.error);
        
        // Attempt recovery if possible
        this.attemptErrorRecovery(event.error);
    }
    
    handleResourceLimit(event) {
        console.warn('Resource limit exceeded:', event);
        // Implement resource management strategies
        this.manageResources(event);
    }
    
    handleResourceAvailable(event) {
        console.log('Resources available:', event);
        // Resume operations if needed
    }
    
    /**
     * Attempt to recover from an error
     */
    attemptErrorRecovery(error) {
        // Implementation would depend on error type
        console.log('Attempting error recovery for:', error.message);
        
        // Basic recovery strategies:
        // 1. Restart failed modules
        // 2. Clear corrupted data
        // 3. Reset to safe state
        // 4. Request user intervention if needed
    }
    
    /**
     * Manage resource usage
     */
    manageResources(event) {
        // Implementation would include:
        // 1. Throttle non-critical operations
        // 2. Free unused resources
        // 3. Notify user of resource constraints
        // 4. Implement backpressure mechanisms
    }
    
    /**
     * Get application diagnostics
     */
    getDiagnostics() {
        return {
            state: this.state,
            initialized: this.initialized,
            uptime: Date.now() - this.performanceMetrics.startTime,
            lastHeartbeat: this.lastHeartbeat,
            modules: Object.fromEntries(
                Array.from(this.modules.entries()).map(([name, info]) => [
                    name,
                    {
                        status: info.status,
                        initialized: info.initialized,
                        healthy: info.healthy,
                        errors: info.errors,
                        performance: info.performance
                    }
                ])
            ),
            metrics: this.performanceMetrics,
            dependencyGraph: Object.fromEntries(this.dependencyGraph),
            initializationOrder: this.initializationOrder
        };
    }
    
    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            uptime: Date.now() - this.performanceMetrics.startTime,
            modulesActivePercentage: (this.performanceMetrics.modulesActive / this.performanceMetrics.modulesLoaded) * 100,
            errorRate: this.performanceMetrics.errors / Math.max(1, this.performanceMetrics.modulesLoaded),
            memoryUsage: performance.memory ? {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            } : null
        };
    }
}

// Create and export singleton instance
const applicationManager = new ApplicationManager();

export default applicationManager;