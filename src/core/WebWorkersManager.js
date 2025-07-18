/**
 * Web Workers Manager - Micro-Execution Environments
 * 
 * This module implements the micro-execution environments for tools and skill modules
 * as specified in the Agent Neo implementation plan. It provides secure, isolated
 * execution contexts with resource monitoring and message passing interfaces.
 * 
 * Key Features:
 * - Dynamic Web Worker creation and management
 * - Secure message passing with validation
 * - Resource monitoring and limits enforcement
 * - Tool isolation and sandboxing
 * - Performance metrics collection
 * - Graceful worker lifecycle management
 * 
 * Architecture:
 * - Each tool/skill module runs in its own dedicated Web Worker
 * - Workers are created dynamically and terminated after execution
 * - All communication uses structured message passing
 * - Resource usage is monitored and enforced
 * - Security boundaries prevent cross-worker contamination
 */

import eventBus from './EventBus.js';
import config from './config.js';

class WebWorkersManager {
    constructor() {
        this.workers = new Map(); // workerId -> worker instance
        this.workerMetrics = new Map(); // workerId -> metrics
        this.messageHandlers = new Map(); // workerId -> message handlers
        this.resourceLimits = config.webWorkers.resourceLimits;
        this.maxWorkers = config.webWorkers.maxConcurrentWorkers || 8;
        this.workerTimeout = config.webWorkers.defaultTimeout || 30000;
        this.nextWorkerId = 1;
        
        // Performance monitoring
        this.metrics = {
            workersCreated: 0,
            workersTerminated: 0,
            totalExecutionTime: 0,
            averageExecutionTime: 0,
            resourceViolations: 0,
            timeoutViolations: 0
        };
        
        // Bind methods
        this.handleWorkerMessage = this.handleWorkerMessage.bind(this);
        this.handleWorkerError = this.handleWorkerError.bind(this);
        
        // Initialize
        this.init();
    }
    
    async init() {
        try {
            // Check Web Worker support
            if (typeof Worker === 'undefined') {
                throw new Error('Web Workers not supported in this environment');
            }
            
            // Set up periodic cleanup
            this.setupPeriodicCleanup();
            
            // Set up resource monitoring
            this.setupResourceMonitoring();
            
            eventBus.emit('webWorkers:initialized', {
                maxWorkers: this.maxWorkers,
                resourceLimits: this.resourceLimits
            });
            
            console.log('Web Workers Manager initialized');
            
        } catch (error) {
            console.error('Failed to initialize Web Workers Manager:', error);
            throw error;
        }
    }
    
    /**
     * Create a new micro-execution environment for a tool or skill module
     * 
     * @param {Object} options - Worker configuration
     * @param {string} options.code - JavaScript code to execute
     * @param {string} options.type - Worker type ('tool', 'skill', 'crypto', 'ai')
     * @param {Object} options.resourceLimits - Custom resource limits
     * @param {number} options.timeout - Execution timeout in milliseconds
     * @param {Object} options.permissions - Security permissions
     * @returns {Promise<string>} Worker ID
     */
    async createWorker(options) {
        try {
            // Validate options
            if (!options || !options.code) {
                throw new Error('Worker code is required');
            }
            
            // Check worker limits
            if (this.workers.size >= this.maxWorkers) {
                throw new Error(`Maximum number of workers (${this.maxWorkers}) reached`);
            }
            
            const workerId = `worker_${this.nextWorkerId++}`;
            const workerConfig = {
                id: workerId,
                type: options.type || 'generic',
                code: options.code,
                resourceLimits: { ...this.resourceLimits, ...options.resourceLimits },
                timeout: options.timeout || this.workerTimeout,
                permissions: options.permissions || {},
                createdAt: Date.now()
            };
            
            // Create worker with sandboxed environment
            const worker = await this.createSandboxedWorker(workerConfig);
            
            // Store worker and configuration
            this.workers.set(workerId, worker);
            this.workerMetrics.set(workerId, {
                ...workerConfig,
                startTime: Date.now(),
                messagesReceived: 0,
                messagesSent: 0,
                memoryUsage: 0,
                cpuTime: 0,
                status: 'running'
            });
            
            // Set up message handling
            worker.onmessage = (event) => this.handleWorkerMessage(workerId, event);
            worker.onerror = (error) => this.handleWorkerError(workerId, error);
            
            // Set up timeout
            setTimeout(() => {
                if (this.workers.has(workerId)) {
                    this.terminateWorker(workerId, 'timeout');
                }
            }, workerConfig.timeout);
            
            this.metrics.workersCreated++;
            
            eventBus.emit('webWorkers:created', {
                workerId,
                type: workerConfig.type,
                resourceLimits: workerConfig.resourceLimits
            });
            
            return workerId;
            
        } catch (error) {
            console.error('Failed to create worker:', error);
            throw error;
        }
    }
    
    /**
     * Create a sandboxed Web Worker with security restrictions
     * 
     * @param {Object} config - Worker configuration
     * @returns {Promise<Worker>} Worker instance
     */
    async createSandboxedWorker(config) {
        // Create worker code with sandbox wrapper
        const sandboxedCode = this.createSandboxWrapper(config);
        
        // Create blob URL for worker code
        const blob = new Blob([sandboxedCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        
        try {
            // Create worker
            const worker = new Worker(workerUrl);
            
            // Store URL for cleanup
            worker._blobUrl = workerUrl;
            
            return worker;
            
        } catch (error) {
            // Clean up blob URL on error
            URL.revokeObjectURL(workerUrl);
            throw error;
        }
    }
    
    /**
     * Create sandbox wrapper code for secure execution
     * 
     * @param {Object} config - Worker configuration
     * @returns {string} Sandboxed worker code
     */
    createSandboxWrapper(config) {
        return `
            // Sandbox environment for Worker ${config.id}
            const WORKER_ID = '${config.id}';
            const WORKER_TYPE = '${config.type}';
            const RESOURCE_LIMITS = ${JSON.stringify(config.resourceLimits)};
            const PERMISSIONS = ${JSON.stringify(config.permissions)};
            
            // Resource monitoring
            let resourceUsage = {
                memoryUsage: 0,
                cpuTime: 0,
                messagesProcessed: 0,
                startTime: Date.now()
            };
            
            // Security restrictions
            const restrictedGlobals = ['eval', 'Function', 'XMLHttpRequest', 'fetch'];
            restrictedGlobals.forEach(global => {
                if (typeof self[global] !== 'undefined') {
                    delete self[global];
                }
            });
            
            // Message passing interface
            function sendMessage(type, data, transferable = []) {
                const message = {
                    workerId: WORKER_ID,
                    type: type,
                    data: data,
                    timestamp: Date.now(),
                    resourceUsage: resourceUsage
                };
                
                try {
                    self.postMessage(message, transferable);
                    resourceUsage.messagesProcessed++;
                } catch (error) {
                    console.error('Failed to send message:', error);
                }
            }
            
            // Resource monitoring
            function updateResourceUsage() {
                if (performance && performance.memory) {
                    resourceUsage.memoryUsage = performance.memory.usedJSHeapSize;
                }
                resourceUsage.cpuTime = Date.now() - resourceUsage.startTime;
                
                // Check resource limits
                if (resourceUsage.memoryUsage > RESOURCE_LIMITS.maxMemory) {
                    sendMessage('error', {
                        type: 'resource_limit_exceeded',
                        resource: 'memory',
                        usage: resourceUsage.memoryUsage,
                        limit: RESOURCE_LIMITS.maxMemory
                    });
                    self.close();
                }
                
                if (resourceUsage.cpuTime > RESOURCE_LIMITS.maxCpuTime) {
                    sendMessage('error', {
                        type: 'resource_limit_exceeded',
                        resource: 'cpu',
                        usage: resourceUsage.cpuTime,
                        limit: RESOURCE_LIMITS.maxCpuTime
                    });
                    self.close();
                }
            }
            
            // Set up resource monitoring interval
            setInterval(updateResourceUsage, 1000);
            
            // Error handling
            self.onerror = function(error) {
                sendMessage('error', {
                    type: 'runtime_error',
                    message: error.message,
                    filename: error.filename,
                    lineno: error.lineno,
                    colno: error.colno
                });
            };
            
            // Unhandled promise rejection handling
            self.onunhandledrejection = function(event) {
                sendMessage('error', {
                    type: 'unhandled_rejection',
                    reason: event.reason,
                    promise: event.promise
                });
            };
            
            // Message handler
            self.onmessage = function(event) {
                try {
                    const { type, data, messageId } = event.data;
                    
                    switch (type) {
                        case 'execute':
                            executeUserCode(data, messageId);
                            break;
                        case 'terminate':
                            self.close();
                            break;
                        default:
                            sendMessage('error', {
                                type: 'unknown_message_type',
                                messageType: type
                            });
                    }
                } catch (error) {
                    sendMessage('error', {
                        type: 'message_handling_error',
                        message: error.message,
                        stack: error.stack
                    });
                }
            };
            
            // User code execution
            async function executeUserCode(data, messageId) {
                try {
                    updateResourceUsage();
                    
                    // Execute user code in isolated context
                    const result = await (function() {
                        ${config.code}
                    })();
                    
                    // Send result back
                    sendMessage('result', {
                        messageId: messageId,
                        result: result,
                        executionTime: Date.now() - resourceUsage.startTime
                    });
                    
                } catch (error) {
                    sendMessage('error', {
                        messageId: messageId,
                        type: 'execution_error',
                        message: error.message,
                        stack: error.stack
                    });
                }
            }
            
            // Initialize worker
            sendMessage('ready', {
                workerId: WORKER_ID,
                type: WORKER_TYPE,
                capabilities: PERMISSIONS
            });
        `;
    }
    
    /**
     * Send a message to a worker
     * 
     * @param {string} workerId - Worker ID
     * @param {string} type - Message type
     * @param {*} data - Message data
     * @param {Array} transferable - Transferable objects
     * @returns {Promise<*>} Response from worker
     */
    async sendMessage(workerId, type, data, transferable = []) {
        return new Promise((resolve, reject) => {
            const worker = this.workers.get(workerId);
            if (!worker) {
                reject(new Error(`Worker ${workerId} not found`));
                return;
            }
            
            const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const message = {
                type: type,
                data: data,
                messageId: messageId,
                timestamp: Date.now()
            };
            
            // Set up response handler
            const responseHandler = (event) => {
                const response = event.data;
                if (response.messageId === messageId) {
                    worker.removeEventListener('message', responseHandler);
                    
                    if (response.type === 'result') {
                        resolve(response.data.result);
                    } else if (response.type === 'error') {
                        reject(new Error(response.data.message));
                    }
                }
            };
            
            worker.addEventListener('message', responseHandler);
            
            // Send message
            try {
                worker.postMessage(message, transferable);
                
                // Update metrics
                const metrics = this.workerMetrics.get(workerId);
                if (metrics) {
                    metrics.messagesSent++;
                }
                
            } catch (error) {
                worker.removeEventListener('message', responseHandler);
                reject(error);
            }
        });
    }
    
    /**
     * Execute code in a worker
     * 
     * @param {string} workerId - Worker ID
     * @param {*} data - Execution data
     * @returns {Promise<*>} Execution result
     */
    async executeInWorker(workerId, data) {
        return this.sendMessage(workerId, 'execute', data);
    }
    
    /**
     * Terminate a worker
     * 
     * @param {string} workerId - Worker ID
     * @param {string} reason - Termination reason
     */
    terminateWorker(workerId, reason = 'manual') {
        const worker = this.workers.get(workerId);
        if (!worker) {
            return;
        }
        
        try {
            // Send termination message
            worker.postMessage({ type: 'terminate' });
            
            // Force terminate after short delay
            setTimeout(() => {
                worker.terminate();
                
                // Clean up blob URL
                if (worker._blobUrl) {
                    URL.revokeObjectURL(worker._blobUrl);
                }
            }, 100);
            
        } catch (error) {
            console.error('Error terminating worker:', error);
            worker.terminate();
        }
        
        // Update metrics
        const metrics = this.workerMetrics.get(workerId);
        if (metrics) {
            metrics.status = 'terminated';
            metrics.terminatedAt = Date.now();
            metrics.terminationReason = reason;
            
            const executionTime = metrics.terminatedAt - metrics.startTime;
            this.metrics.totalExecutionTime += executionTime;
            this.metrics.averageExecutionTime = this.metrics.totalExecutionTime / this.metrics.workersTerminated;
            
            if (reason === 'timeout') {
                this.metrics.timeoutViolations++;
            }
        }
        
        // Clean up
        this.workers.delete(workerId);
        this.messageHandlers.delete(workerId);
        this.metrics.workersTerminated++;
        
        eventBus.emit('webWorkers:terminated', {
            workerId,
            reason,
            metrics: metrics
        });
    }
    
    /**
     * Handle worker messages
     * 
     * @param {string} workerId - Worker ID
     * @param {MessageEvent} event - Message event
     */
    handleWorkerMessage(workerId, event) {
        try {
            const message = event.data;
            const metrics = this.workerMetrics.get(workerId);
            
            if (metrics) {
                metrics.messagesReceived++;
                if (message.resourceUsage) {
                    metrics.memoryUsage = message.resourceUsage.memoryUsage;
                    metrics.cpuTime = message.resourceUsage.cpuTime;
                }
            }
            
            // Handle different message types
            switch (message.type) {
                case 'ready':
                    eventBus.emit('webWorkers:ready', {
                        workerId,
                        capabilities: message.data.capabilities
                    });
                    break;
                    
                case 'error':
                    this.handleWorkerError(workerId, message.data);
                    break;
                    
                case 'result':
                    // Results are handled by sendMessage promise resolution
                    break;
                    
                default:
                    // Forward other messages to event bus
                    eventBus.emit('webWorkers:message', {
                        workerId,
                        message: message
                    });
            }
            
        } catch (error) {
            console.error('Error handling worker message:', error);
        }
    }
    
    /**
     * Handle worker errors
     * 
     * @param {string} workerId - Worker ID
     * @param {Error|Object} error - Error object
     */
    handleWorkerError(workerId, error) {
        console.error(`Worker ${workerId} error:`, error);
        
        const metrics = this.workerMetrics.get(workerId);
        if (metrics) {
            metrics.status = 'error';
            metrics.lastError = error;
        }
        
        // Handle resource limit violations
        if (error.type === 'resource_limit_exceeded') {
            this.metrics.resourceViolations++;
            this.terminateWorker(workerId, 'resource_limit');
        }
        
        eventBus.emit('webWorkers:error', {
            workerId,
            error: error
        });
    }
    
    /**
     * Get worker metrics
     * 
     * @param {string} workerId - Worker ID (optional)
     * @returns {Object} Metrics
     */
    getMetrics(workerId = null) {
        if (workerId) {
            return this.workerMetrics.get(workerId);
        }
        
        return {
            global: this.metrics,
            workers: Array.from(this.workerMetrics.entries()).map(([id, metrics]) => ({
                id,
                ...metrics
            }))
        };
    }
    
    /**
     * Get active workers
     * 
     * @returns {Array} Active worker IDs
     */
    getActiveWorkers() {
        return Array.from(this.workers.keys());
    }
    
    /**
     * Set up periodic cleanup of terminated workers
     */
    setupPeriodicCleanup() {
        setInterval(() => {
            const now = Date.now();
            const maxAge = 5 * 60 * 1000; // 5 minutes
            
            for (const [workerId, metrics] of this.workerMetrics.entries()) {
                if (metrics.status === 'terminated' && 
                    (now - metrics.terminatedAt) > maxAge) {
                    this.workerMetrics.delete(workerId);
                }
            }
        }, 60000); // Run every minute
    }
    
    /**
     * Set up resource monitoring
     */
    setupResourceMonitoring() {
        setInterval(() => {
            const activeWorkers = this.getActiveWorkers();
            
            eventBus.emit('webWorkers:resourceUpdate', {
                activeWorkers: activeWorkers.length,
                totalWorkers: this.workers.size,
                metrics: this.metrics
            });
        }, 5000); // Update every 5 seconds
    }
    
    /**
     * Cleanup all workers
     */
    cleanup() {
        // Terminate all active workers
        for (const workerId of this.workers.keys()) {
            this.terminateWorker(workerId, 'cleanup');
        }
        
        // Clear all data
        this.workers.clear();
        this.workerMetrics.clear();
        this.messageHandlers.clear();
        
        eventBus.emit('webWorkers:cleanup');
    }
}

// Create singleton instance
const webWorkersManager = new WebWorkersManager();

export default webWorkersManager;