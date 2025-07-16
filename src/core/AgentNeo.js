/**
 * Agent Neo Core Class
 * 
 * Main coordinator class that implements the modular "hive mind" architecture
 * described in the whitepaper. This class orchestrates all modules, manages
 * the ethics framework, and coordinates P2P networking.
 */

import eventBus from './EventBus.js';
import stateManager from './StateManager.js';

class AgentNeo {
    constructor() {
        this.version = '1.0.0';
        this.initialized = false;
        this.modules = new Map();
        this.config = {
            ethicsLevel: 'balanced',
            maxCpu: 50,
            maxMemory: 40,
            maxPeers: 10,
            autoStart: false,
            debugMode: false
        };
        
        // Core status tracking
        this.status = 'offline';
        this.startTime = null;
        this.uptime = 0;
        this.uptimeInterval = null;
        
        // Performance monitoring
        this.metrics = {
            tasksProcessed: 0,
            errorsHandled: 0,
            averageResponseTime: 0,
            resourceUsage: {
                cpu: 0,
                memory: 0,
                network: 0
            }
        };
        
        // Ethics and safety
        this.ethicsViolations = [];
        this.safetyLimits = {
            maxTaskDuration: 300000, // 5 minutes
            maxMemoryUsage: 512 * 1024 * 1024, // 512MB
            maxCpuTime: 10000 // 10 seconds
        };
        
        this.init();
    }

    async init() {
        try {
            console.log('🤖 Agent Neo initializing...');
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize core modules
            await this.initializeCoreModules();
            
            // Apply configuration
            this.applyConfiguration();
            
            // Start monitoring systems
            this.startMonitoring();
            
            this.initialized = true;
            stateManager.setState('node.status', 'initialized');
            
            eventBus.emit('agent:initialized', {
                version: this.version,
                timestamp: Date.now()
            });
            
            console.log('✅ Agent Neo initialized successfully');
            
        } catch (error) {
            console.error('❌ Agent Neo initialization failed:', error);
            eventBus.emit('agent:error', { error, phase: 'initialization' });
            throw error;
        }
    }

    setupEventListeners() {
        // Core system events
        eventBus.on('agent:start', this.start.bind(this));
        eventBus.on('agent:stop', this.stop.bind(this));
        eventBus.on('agent:restart', this.restart.bind(this));
        eventBus.on('agent:config:update', this.updateConfig.bind(this));
        
        // Module management events
        eventBus.on('module:register', this.registerModule.bind(this));
        eventBus.on('module:unregister', this.unregisterModule.bind(this));
        eventBus.on('module:start', this.startModule.bind(this));
        eventBus.on('module:stop', this.stopModule.bind(this));
        
        // Task processing events
        eventBus.on('task:submit', this.processTask.bind(this));
        eventBus.on('task:cancel', this.cancelTask.bind(this));
        eventBus.on('task:pause', this.pauseTask.bind(this));
        eventBus.on('task:resume', this.resumeTask.bind(this));
        
        // Ethics and safety events
        eventBus.on('ethics:check', this.checkEthics.bind(this));
        eventBus.on('safety:violation', this.handleSafetyViolation.bind(this));
        
        // Resource monitoring events
        eventBus.on('resources:check', this.checkResources.bind(this));
        eventBus.on('resources:limit', this.enforceResourceLimits.bind(this));
        
        // Error handling
        eventBus.on('error', this.handleError.bind(this));
        
        console.log('📡 Event listeners configured');
    }

    async initializeCoreModules() {
        console.log('🔧 Initializing core modules...');
        
        // Load module definitions (these would be loaded dynamically in a full implementation)
        const coreModules = [
            'EthicsModule',
            'TaskManager', 
            'NetworkManager',
            'ResourceMonitor',
            'IndexedDBManager',
            'UIManager'
        ];
        
        for (const moduleName of coreModules) {
            try {
                // In a full implementation, these would be dynamically imported
                // For now, we register placeholder modules
                this.registerModule({
                    name: moduleName,
                    version: '1.0.0',
                    status: 'registered',
                    capabilities: [],
                    dependencies: []
                });
                
                console.log(`✅ Module registered: ${moduleName}`);
                
            } catch (error) {
                console.error(`❌ Failed to register module ${moduleName}:`, error);
                stateManager.setState(`modules.failed`, [
                    ...stateManager.getState('modules.failed', []),
                    { name: moduleName, error: error.message, timestamp: Date.now() }
                ]);
            }
        }
        
        // Update state with loaded modules
        stateManager.setState('modules.loaded', Array.from(this.modules.keys()));
    }

    applyConfiguration() {
        // Apply resource limits
        stateManager.setState('resources.maxCpu', this.config.maxCpu);
        stateManager.setState('resources.maxMemory', this.config.maxMemory);
        stateManager.setState('settings.maxPeers', this.config.maxPeers);
        stateManager.setState('settings.ethicsLevel', this.config.ethicsLevel);
        
        // Configure debug mode
        if (this.config.debugMode) {
            eventBus.setDebugMode(true);
            stateManager.setDebugMode(true);
        }
        
        console.log('⚙️ Configuration applied');
    }

    startMonitoring() {
        // Start uptime tracking
        this.uptimeInterval = setInterval(() => {
            if (this.status === 'online' && this.startTime) {
                this.uptime = Date.now() - this.startTime;
                stateManager.setState('node.uptime', this.uptime);
            }
        }, 1000);
        
        // Start resource monitoring
        this.resourceMonitorInterval = setInterval(() => {
            this.updateResourceMetrics();
        }, 5000);
        
        console.log('📊 Monitoring systems started');
    }

    async start() {
        if (this.status === 'online') {
            console.log('⚠️ Agent Neo is already running');
            return;
        }
        
        try {
            console.log('🚀 Starting Agent Neo...');
            
            // Perform ethics check before starting
            const ethicsCheck = await this.checkEthics({
                action: 'start_agent',
                context: 'system_startup'
            });
            
            if (!ethicsCheck.approved) {
                throw new Error('Ethics check failed: ' + ethicsCheck.reason);
            }
            
            // Start core modules
            await this.startCoreModules();
            
            // Update status
            this.status = 'online';
            this.startTime = Date.now();
            
            // Update state
            stateManager.batchUpdate({
                'node.status': 'online',
                'node.uptime': 0,
                'ui.loading': false
            });
            
            eventBus.emit('agent:started', {
                timestamp: this.startTime,
                version: this.version
            });
            
            console.log('✅ Agent Neo is now online');
            
        } catch (error) {
            console.error('❌ Failed to start Agent Neo:', error);
            this.status = 'error';
            stateManager.setState('node.status', 'error');
            eventBus.emit('agent:error', { error, phase: 'startup' });
            throw error;
        }
    }

    async stop() {
        if (this.status === 'offline') {
            console.log('⚠️ Agent Neo is already offline');
            return;
        }
        
        try {
            console.log('🛑 Stopping Agent Neo...');
            
            // Stop all active tasks
            await this.cancelAllTasks();
            
            // Stop modules
            await this.stopAllModules();
            
            // Clear intervals
            if (this.uptimeInterval) {
                clearInterval(this.uptimeInterval);
                this.uptimeInterval = null;
            }
            
            if (this.resourceMonitorInterval) {
                clearInterval(this.resourceMonitorInterval);
                this.resourceMonitorInterval = null;
            }
            
            // Update status
            this.status = 'offline';
            this.startTime = null;
            this.uptime = 0;
            
            // Update state
            stateManager.batchUpdate({
                'node.status': 'offline',
                'node.uptime': 0,
                'node.connections': 0
            });
            
            eventBus.emit('agent:stopped', {
                timestamp: Date.now()
            });
            
            console.log('✅ Agent Neo is now offline');
            
        } catch (error) {
            console.error('❌ Error stopping Agent Neo:', error);
            eventBus.emit('agent:error', { error, phase: 'shutdown' });
        }
    }

    async restart() {
        console.log('🔄 Restarting Agent Neo...');
        await this.stop();
        setTimeout(() => this.start(), 1000);
    }

    registerModule({ name, module, config = {} }) {
        if (this.modules.has(name)) {
            console.warn(`⚠️ Module ${name} is already registered`);
            return false;
        }
        
        const moduleInfo = {
            name,
            module,
            config,
            status: 'registered',
            registeredAt: Date.now(),
            version: module?.version || '1.0.0',
            capabilities: module?.capabilities || [],
            dependencies: module?.dependencies || []
        };
        
        this.modules.set(name, moduleInfo);
        
        // Update state
        stateManager.setState('modules.loaded', Array.from(this.modules.keys()));
        
        eventBus.emit('module:registered', { name, moduleInfo });
        
        console.log(`📦 Module registered: ${name}`);
        return true;
    }

    unregisterModule({ name }) {
        if (!this.modules.has(name)) {
            console.warn(`⚠️ Module ${name} is not registered`);
            return false;
        }
        
        // Stop module if running
        const moduleInfo = this.modules.get(name);
        if (moduleInfo.status === 'running') {
            this.stopModule({ name });
        }
        
        this.modules.delete(name);
        
        // Update state
        stateManager.setState('modules.loaded', Array.from(this.modules.keys()));
        
        eventBus.emit('module:unregistered', { name });
        
        console.log(`📦 Module unregistered: ${name}`);
        return true;
    }

    async startModule({ name }) {
        const moduleInfo = this.modules.get(name);
        if (!moduleInfo) {
            throw new Error(`Module ${name} is not registered`);
        }
        
        if (moduleInfo.status === 'running') {
            console.warn(`⚠️ Module ${name} is already running`);
            return;
        }
        
        try {
            if (moduleInfo.module && typeof moduleInfo.module.start === 'function') {
                await moduleInfo.module.start();
            }
            
            moduleInfo.status = 'running';
            moduleInfo.startedAt = Date.now();
            
            // Update active modules list
            const activeModules = stateManager.getState('modules.active', []);
            if (!activeModules.includes(name)) {
                stateManager.setState('modules.active', [...activeModules, name]);
            }
            
            eventBus.emit('module:started', { name });
            console.log(`▶️ Module started: ${name}`);
            
        } catch (error) {
            moduleInfo.status = 'error';
            moduleInfo.error = error.message;
            
            console.error(`❌ Failed to start module ${name}:`, error);
            eventBus.emit('module:error', { name, error });
        }
    }

    async stopModule({ name }) {
        const moduleInfo = this.modules.get(name);
        if (!moduleInfo) {
            throw new Error(`Module ${name} is not registered`);
        }
        
        if (moduleInfo.status !== 'running') {
            console.warn(`⚠️ Module ${name} is not running`);
            return;
        }
        
        try {
            if (moduleInfo.module && typeof moduleInfo.module.stop === 'function') {
                await moduleInfo.module.stop();
            }
            
            moduleInfo.status = 'stopped';
            moduleInfo.stoppedAt = Date.now();
            
            // Update active modules list
            const activeModules = stateManager.getState('modules.active', []);
            stateManager.setState('modules.active', activeModules.filter(m => m !== name));
            
            eventBus.emit('module:stopped', { name });
            console.log(`⏹️ Module stopped: ${name}`);
            
        } catch (error) {
            console.error(`❌ Error stopping module ${name}:`, error);
            eventBus.emit('module:error', { name, error });
        }
    }

    async processTask({ task, priority = 'normal' }) {
        const taskId = this.generateTaskId();
        const startTime = Date.now();
        
        try {
            console.log(`📋 Processing task: ${taskId}`);
            
            // Ethics check
            const ethicsCheck = await this.checkEthics({
                action: 'process_task',
                task,
                context: 'task_execution'
            });
            
            if (!ethicsCheck.approved) {
                throw new Error('Ethics violation: ' + ethicsCheck.reason);
            }
            
            // Resource check
            if (!this.checkResourceAvailability()) {
                throw new Error('Insufficient resources available');
            }
            
            // Update metrics
            this.metrics.tasksProcessed++;
            
            // Emit task started event
            eventBus.emit('task:started', {
                taskId,
                task,
                priority,
                startTime
            });
            
            // Simulate task processing (in real implementation, this would route to appropriate modules)
            const result = await this.simulateTaskProcessing(task);
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Update response time metrics
            this.updateResponseTimeMetrics(duration);
            
            // Update state
            stateManager.setState('performance.tasksCompleted', this.metrics.tasksProcessed);
            
            eventBus.emit('task:completed', {
                taskId,
                result,
                duration,
                timestamp: endTime
            });
            
            console.log(`✅ Task completed: ${taskId} (${duration}ms)`);
            return { taskId, result, duration };
            
        } catch (error) {
            this.metrics.errorsHandled++;
            
            eventBus.emit('task:failed', {
                taskId,
                error: error.message,
                timestamp: Date.now()
            });
            
            console.error(`❌ Task failed: ${taskId}`, error);
            throw error;
        }
    }

    async checkEthics({ action, task, context }) {
        // Simplified ethics check - in real implementation, this would be more sophisticated
        const ethicsLevel = stateManager.getState('settings.ethicsLevel', 'balanced');
        
        // Basic checks
        const checks = {
            harmful_content: this.detectHarmfulContent(task),
            resource_abuse: this.checkResourceAbuse(task),
            privacy_violation: this.checkPrivacyViolation(task)
        };
        
        const violations = Object.entries(checks)
            .filter(([key, value]) => value)
            .map(([key]) => key);
        
        if (violations.length > 0) {
            this.ethicsViolations.push({
                action,
                task,
                context,
                violations,
                timestamp: Date.now()
            });
            
            stateManager.setState('ethics.violations', this.ethicsViolations);
            
            return {
                approved: false,
                reason: `Ethics violations detected: ${violations.join(', ')}`
            };
        }
        
        return { approved: true };
    }

    checkResourceAvailability() {
        const cpu = stateManager.getState('resources.cpu', 0);
        const memory = stateManager.getState('resources.memory', 0);
        const maxCpu = stateManager.getState('resources.maxCpu', 50);
        const maxMemory = stateManager.getState('resources.maxMemory', 40);
        
        return cpu < maxCpu && memory < maxMemory;
    }

    updateResourceMetrics() {
        // Simulate resource usage (in real implementation, this would use actual system metrics)
        const cpu = Math.random() * stateManager.getState('resources.maxCpu', 50);
        const memory = Math.random() * stateManager.getState('resources.maxMemory', 40);
        
        stateManager.batchUpdate({
            'resources.cpu': Math.round(cpu),
            'resources.memory': Math.round(memory)
        });
        
        this.metrics.resourceUsage = { cpu, memory, network: 0 };
    }

    updateResponseTimeMetrics(duration) {
        const currentAvg = this.metrics.averageResponseTime;
        const count = this.metrics.tasksProcessed;
        
        this.metrics.averageResponseTime = 
            ((currentAvg * (count - 1)) + duration) / count;
        
        stateManager.setState('performance.avgResponseTime', Math.round(this.metrics.averageResponseTime));
        
        // Update success rate (simplified)
        const successRate = ((count - this.metrics.errorsHandled) / count) * 100;
        stateManager.setState('performance.successRate', Math.round(successRate));
    }

    async simulateTaskProcessing(task) {
        // Simulate processing time
        const processingTime = Math.random() * 2000 + 500; // 0.5-2.5 seconds
        await new Promise(resolve => setTimeout(resolve, processingTime));
        
        return {
            status: 'completed',
            message: `Task processed successfully: ${task?.description || 'Unknown task'}`,
            timestamp: Date.now()
        };
    }

    // Simplified ethics checks
    detectHarmfulContent(task) {
        if (!task || !task.description) return false;
        const harmful = ['hack', 'attack', 'destroy', 'damage', 'illegal'];
        return harmful.some(word => task.description.toLowerCase().includes(word));
    }

    checkResourceAbuse(task) {
        // Check if task would exceed resource limits
        return false; // Simplified
    }

    checkPrivacyViolation(task) {
        // Check for privacy-related violations
        return false; // Simplified
    }

    generateTaskId() {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async startCoreModules() {
        const modules = Array.from(this.modules.keys());
        for (const moduleName of modules) {
            try {
                await this.startModule({ name: moduleName });
            } catch (error) {
                console.error(`Failed to start module ${moduleName}:`, error);
            }
        }
    }

    async stopAllModules() {
        const activeModules = stateManager.getState('modules.active', []);
        for (const moduleName of activeModules) {
            try {
                await this.stopModule({ name: moduleName });
            } catch (error) {
                console.error(`Error stopping module ${moduleName}:`, error);
            }
        }
    }

    async cancelAllTasks() {
        // Implementation would cancel all active tasks
        eventBus.emit('tasks:cancel_all', { timestamp: Date.now() });
    }

    updateConfig({ config }) {
        this.config = { ...this.config, ...config };
        this.applyConfiguration();
        
        eventBus.emit('agent:config:updated', { config: this.config });
        console.log('⚙️ Configuration updated');
    }

    handleError({ error, context }) {
        this.metrics.errorsHandled++;
        console.error(`🚨 Agent Neo error [${context}]:`, error);
        
        // Log error for debugging
        stateManager.setState('system.lastError', {
            error: error.message,
            context,
            timestamp: Date.now()
        });
    }

    getStatus() {
        return {
            status: this.status,
            version: this.version,
            uptime: this.uptime,
            metrics: this.metrics,
            modules: Object.fromEntries(
                Array.from(this.modules.entries()).map(([name, info]) => [
                    name, 
                    { status: info.status, version: info.version }
                ])
            )
        };
    }

    destroy() {
        this.stop();
        this.modules.clear();
        if (this.uptimeInterval) clearInterval(this.uptimeInterval);
        if (this.resourceMonitorInterval) clearInterval(this.resourceMonitorInterval);
        
        console.log('🔥 Agent Neo destroyed');
    }
}

// Create and export singleton instance
const agentNeo = new AgentNeo();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
    window.AgentNeo = agentNeo;
}

export default agentNeo;