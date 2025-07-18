/**
 * Web Workers Manager
 * 
 * Manages Web Worker creation, execution, and resource management for
 * sandboxed task processing as specified in the Agent Neo implementation plan.
 * 
 * Features:
 * - Dynamic worker pool management
 * - Task execution sandboxing
 * - Resource monitoring and limits
 * - Worker lifecycle management
 * - Communication protocols
 */

import eventBus from './EventBus.js';
import { config } from './config.js';
import logger from './logger.js';

class WebWorkersManager {
    constructor() {
        this.name = 'WebWorkersManager';
        this.version = '1.0.0';
        this.initialized = false;
        
        // Worker pool management
        this.workerPool = new Map(); // workerId -> worker instance
        this.activeWorkers = new Map(); // taskId -> workerId
        this.workerQueue = [];
        this.workerCounter = 0;
        
        // Configuration
        this.maxWorkers = config.resourceLimits?.maxWorkers || 4;
        this.maxTaskDuration = config.resourceLimits?.maxTaskDuration || 300000; // 5 minutes
        this.workerTimeouts = new Map(); // taskId -> timeoutId
        
        // Worker script templates
        this.workerScripts = new Map();
        
        // Task management
        this.pendingTasks = new Map(); // taskId -> task details
        this.taskResults = new Map(); // taskId -> result
        
        this.init();
    }

    async init() {
        try {
            console.log('⚙️ Web Workers Manager initializing...');
            
            this.setupEventListeners();
            this.createWorkerScripts();
            await this.initializeWorkerPool();
            
            this.initialized = true;
            logger.info('Web Workers Manager initialized successfully');
            
            eventBus.emit('module:initialized', {
                name: this.name,
                version: this.version,
                capabilities: ['task_execution', 'sandboxing', 'resource_isolation']
            });
            
        } catch (error) {
            logger.error('Web Workers Manager initialization failed:', error);
            throw error;
        }
    }

    setupEventListeners() {
        eventBus.on('worker:execute_task', this.executeTask.bind(this));
        eventBus.on('worker:cancel_task', this.cancelTask.bind(this));
        eventBus.on('worker:get_status', this.getWorkerStatus.bind(this));
        eventBus.on('worker:cleanup', this.cleanup.bind(this));
        eventBus.on('app:shutdown', this.shutdown.bind(this));
    }

    createWorkerScripts() {
        // General purpose task execution worker
        const taskWorkerScript = `
            // Task execution worker
            let currentTask = null;
            
            self.onmessage = function(e) {
                const { type, taskId, data, timeout } = e.data;
                
                try {
                    switch (type) {
                        case 'EXECUTE_TASK':
                            currentTask = taskId;
                            executeTask(data);
                            break;
                            
                        case 'CANCEL_TASK':
                            if (currentTask === taskId) {
                                self.postMessage({
                                    type: 'TASK_CANCELLED',
                                    taskId: taskId
                                });
                                currentTask = null;
                            }
                            break;
                            
                        case 'PING':
                            self.postMessage({
                                type: 'PONG',
                                taskId: taskId,
                                timestamp: Date.now()
                            });
                            break;
                    }
                } catch (error) {
                    self.postMessage({
                        type: 'TASK_ERROR',
                        taskId: taskId,
                        error: {
                            message: error.message,
                            stack: error.stack,
                            name: error.name
                        }
                    });
                    currentTask = null;
                }
            };
            
            function executeTask(taskData) {
                const startTime = Date.now();
                
                try {
                    // Validate task data
                    if (!taskData || !taskData.type) {
                        throw new Error('Invalid task data');
                    }
                    
                    let result;
                    
                    switch (taskData.type) {
                        case 'COMPUTE':
                            result = executeComputation(taskData);
                            break;
                            
                        case 'DATA_PROCESS':
                            result = processData(taskData);
                            break;
                            
                        case 'AI_INFERENCE':
                            result = runAIInference(taskData);
                            break;
                            
                        case 'VALIDATION':
                            result = validateData(taskData);
                            break;
                            
                        default:
                            throw new Error('Unknown task type: ' + taskData.type);
                    }
                    
                    const executionTime = Date.now() - startTime;
                    
                    self.postMessage({
                        type: 'TASK_COMPLETED',
                        taskId: currentTask,
                        result: result,
                        executionTime: executionTime,
                        memoryUsed: performance.memory ? performance.memory.usedJSHeapSize : 0
                    });
                    
                } catch (error) {
                    self.postMessage({
                        type: 'TASK_ERROR',
                        taskId: currentTask,
                        error: {
                            message: error.message,
                            stack: error.stack,
                            name: error.name
                        },
                        executionTime: Date.now() - startTime
                    });
                } finally {
                    currentTask = null;
                }
            }
            
            function executeComputation(taskData) {
                const { operation, data } = taskData;
                
                switch (operation) {
                    case 'SUM':
                        return data.reduce((sum, val) => sum + val, 0);
                        
                    case 'AVERAGE':
                        return data.reduce((sum, val) => sum + val, 0) / data.length;
                        
                    case 'SORT':
                        return [...data].sort((a, b) => a - b);
                        
                    case 'FILTER':
                        return data.filter(val => val > (taskData.threshold || 0));
                        
                    case 'MAP':
                        const fn = new Function('x', taskData.mapFunction);
                        return data.map(fn);
                        
                    default:
                        throw new Error('Unknown computation operation: ' + operation);
                }
            }
            
            function processData(taskData) {
                const { operation, data } = taskData;
                
                switch (operation) {
                    case 'PARSE_JSON':
                        return JSON.parse(data);
                        
                    case 'STRINGIFY_JSON':
                        return JSON.stringify(data);
                        
                    case 'ENCODE_BASE64':
                        return btoa(data);
                        
                    case 'DECODE_BASE64':
                        return atob(data);
                        
                    case 'HASH':
                        // Simple hash function for demonstration
                        let hash = 0;
                        for (let i = 0; i < data.length; i++) {
                            const char = data.charCodeAt(i);
                            hash = ((hash << 5) - hash) + char;
                            hash = hash & hash; // Convert to 32-bit integer
                        }
                        return hash.toString(16);
                        
                    default:
                        throw new Error('Unknown data processing operation: ' + operation);
                }
            }
            
            function runAIInference(taskData) {
                // Placeholder for AI inference
                // In a real implementation, this would use TensorFlow.js or similar
                const { model, input } = taskData;
                
                // Simulate AI processing
                const processingTime = Math.random() * 1000 + 500; // 500-1500ms
                
                // Simple mock inference based on input size
                let result;
                if (Array.isArray(input)) {
                    result = {
                        prediction: input.length % 2 === 0 ? 'positive' : 'negative',
                        confidence: Math.random() * 0.5 + 0.5,
                        processingTime: processingTime
                    };
                } else {
                    result = {
                        prediction: 'neutral',
                        confidence: 0.5,
                        processingTime: processingTime
                    };
                }
                
                return result;
            }
            
            function validateData(taskData) {
                const { data, schema } = taskData;
                
                const errors = [];
                
                if (schema.required) {
                    schema.required.forEach(field => {
                        if (!(field in data)) {
                            errors.push('Missing required field: ' + field);
                        }
                    });
                }
                
                if (schema.types) {
                    Object.keys(schema.types).forEach(field => {
                        if (field in data) {
                            const expectedType = schema.types[field];
                            const actualType = typeof data[field];
                            
                            if (actualType !== expectedType) {
                                errors.push('Field ' + field + ' should be ' + expectedType + ' but got ' + actualType);
                            }
                        }
                    });
                }
                
                return {
                    valid: errors.length === 0,
                    errors: errors,
                    data: data
                };
            }
        `;
        
        this.workerScripts.set('task_worker', taskWorkerScript);
        
        // Specialized worker for cryptographic operations
        const cryptoWorkerScript = `
            // Cryptographic operations worker
            self.onmessage = function(e) {
                const { type, taskId, data } = e.data;
                
                try {
                    switch (type) {
                        case 'HASH':
                            performHash(taskId, data);
                            break;
                            
                        case 'ENCRYPT':
                            performEncryption(taskId, data);
                            break;
                            
                        case 'VERIFY_SIGNATURE':
                            verifySignature(taskId, data);
                            break;
                            
                        default:
                            throw new Error('Unknown crypto operation: ' + type);
                    }
                } catch (error) {
                    self.postMessage({
                        type: 'TASK_ERROR',
                        taskId: taskId,
                        error: {
                            message: error.message,
                            name: error.name
                        }
                    });
                }
            };
            
            async function performHash(taskId, data) {
                try {
                    const encoder = new TextEncoder();
                    const dataBuffer = encoder.encode(data.input);
                    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                    
                    self.postMessage({
                        type: 'TASK_COMPLETED',
                        taskId: taskId,
                        result: hashHex
                    });
                } catch (error) {
                    self.postMessage({
                        type: 'TASK_ERROR',
                        taskId: taskId,
                        error: { message: error.message }
                    });
                }
            }
            
            async function performEncryption(taskId, data) {
                // Placeholder for encryption - would implement actual crypto operations
                self.postMessage({
                    type: 'TASK_COMPLETED',
                    taskId: taskId,
                    result: 'encrypted_' + btoa(data.input)
                });
            }
            
            async function verifySignature(taskId, data) {
                // Placeholder for signature verification
                self.postMessage({
                    type: 'TASK_COMPLETED',
                    taskId: taskId,
                    result: { valid: true, verified: Date.now() }
                });
            }
        `;
        
        this.workerScripts.set('crypto_worker', cryptoWorkerScript);
    }

    async initializeWorkerPool() {
        const minWorkers = Math.min(2, this.maxWorkers);
        
        for (let i = 0; i < minWorkers; i++) {
            await this.createWorker('task_worker');
        }
        
        logger.info(`Initialized worker pool with ${minWorkers} workers`);
    }

    async createWorker(workerType = 'task_worker') {
        if (this.workerPool.size >= this.maxWorkers) {
            throw new Error('Maximum number of workers reached');
        }
        
        const workerId = `worker_${++this.workerCounter}`;
        const script = this.workerScripts.get(workerType);
        
        if (!script) {
            throw new Error(`Unknown worker type: ${workerType}`);
        }
        
        try {
            // Create worker from script string
            const blob = new Blob([script], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            const worker = new Worker(workerUrl);
            
            // Setup worker event handlers
            worker.onmessage = (e) => {
                this.handleWorkerMessage(workerId, e.data);
            };
            
            worker.onerror = (error) => {
                this.handleWorkerError(workerId, error);
            };
            
            worker.onmessageerror = (error) => {
                this.handleWorkerError(workerId, error);
            };
            
            // Store worker information
            this.workerPool.set(workerId, {
                worker: worker,
                type: workerType,
                created: Date.now(),
                busy: false,
                currentTask: null,
                tasksCompleted: 0,
                url: workerUrl
            });
            
            logger.info(`Created worker ${workerId} of type ${workerType}`);
            return workerId;
            
        } catch (error) {
            logger.error(`Failed to create worker ${workerId}:`, error);
            throw error;
        }
    }

    async executeTask(event) {
        const { taskId, taskData, workerType = 'task_worker', timeout } = event.detail;
        
        try {
            // Get available worker
            const workerId = await this.getAvailableWorker(workerType);
            const workerInfo = this.workerPool.get(workerId);
            
            if (!workerInfo) {
                throw new Error(`Worker ${workerId} not found`);
            }
            
            // Mark worker as busy
            workerInfo.busy = true;
            workerInfo.currentTask = taskId;
            this.activeWorkers.set(taskId, workerId);
            
            // Store task details
            this.pendingTasks.set(taskId, {
                taskData,
                workerId,
                startTime: Date.now(),
                timeout: timeout || this.maxTaskDuration
            });
            
            // Set timeout for task execution
            const timeoutId = setTimeout(() => {
                this.cancelTask({ detail: { taskId, reason: 'timeout' } });
            }, timeout || this.maxTaskDuration);
            
            this.workerTimeouts.set(taskId, timeoutId);
            
            // Send task to worker
            workerInfo.worker.postMessage({
                type: 'EXECUTE_TASK',
                taskId: taskId,
                data: taskData,
                timeout: timeout || this.maxTaskDuration
            });
            
            logger.info(`Task ${taskId} assigned to worker ${workerId}`);
            
        } catch (error) {
            logger.error(`Failed to execute task ${taskId}:`, error);
            eventBus.emit('worker:task_failed', {
                taskId,
                error: error.message
            });
        }
    }

    async getAvailableWorker(workerType = 'task_worker') {
        // Find available worker of the requested type
        for (const [workerId, workerInfo] of this.workerPool.entries()) {
            if (!workerInfo.busy && workerInfo.type === workerType) {
                return workerId;
            }
        }
        
        // Create new worker if under limit
        if (this.workerPool.size < this.maxWorkers) {
            return await this.createWorker(workerType);
        }
        
        // Wait for worker to become available
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                for (const [workerId, workerInfo] of this.workerPool.entries()) {
                    if (!workerInfo.busy && workerInfo.type === workerType) {
                        clearInterval(checkInterval);
                        resolve(workerId);
                        return;
                    }
                }
            }, 100);
            
            // Timeout after 30 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error('No worker available within timeout'));
            }, 30000);
        });
    }

    handleWorkerMessage(workerId, message) {
        const { type, taskId, result, error, executionTime, memoryUsed } = message;
        
        switch (type) {
            case 'TASK_COMPLETED':
                this.handleTaskCompleted(workerId, taskId, result, executionTime, memoryUsed);
                break;
                
            case 'TASK_ERROR':
                this.handleTaskError(workerId, taskId, error, executionTime);
                break;
                
            case 'TASK_CANCELLED':
                this.handleTaskCancelled(workerId, taskId);
                break;
                
            case 'PONG':
                logger.debug(`Worker ${workerId} responded to ping`);
                break;
                
            default:
                logger.warn(`Unknown message type from worker ${workerId}: ${type}`);
        }
    }

    handleTaskCompleted(workerId, taskId, result, executionTime, memoryUsed) {
        const workerInfo = this.workerPool.get(workerId);
        const taskInfo = this.pendingTasks.get(taskId);
        
        if (workerInfo) {
            workerInfo.busy = false;
            workerInfo.currentTask = null;
            workerInfo.tasksCompleted++;
        }
        
        // Clear timeout
        const timeoutId = this.workerTimeouts.get(taskId);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.workerTimeouts.delete(taskId);
        }
        
        // Store result
        this.taskResults.set(taskId, {
            result,
            executionTime,
            memoryUsed,
            completedAt: Date.now()
        });
        
        // Clean up
        this.activeWorkers.delete(taskId);
        this.pendingTasks.delete(taskId);
        
        logger.info(`Task ${taskId} completed by worker ${workerId} in ${executionTime}ms`);
        
        eventBus.emit('worker:task_completed', {
            taskId,
            workerId,
            result,
            executionTime,
            memoryUsed
        });
    }

    handleTaskError(workerId, taskId, error, executionTime) {
        const workerInfo = this.workerPool.get(workerId);
        
        if (workerInfo) {
            workerInfo.busy = false;
            workerInfo.currentTask = null;
        }
        
        // Clear timeout
        const timeoutId = this.workerTimeouts.get(taskId);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.workerTimeouts.delete(taskId);
        }
        
        // Clean up
        this.activeWorkers.delete(taskId);
        this.pendingTasks.delete(taskId);
        
        logger.error(`Task ${taskId} failed in worker ${workerId}:`, error);
        
        eventBus.emit('worker:task_failed', {
            taskId,
            workerId,
            error,
            executionTime
        });
    }

    handleTaskCancelled(workerId, taskId) {
        const workerInfo = this.workerPool.get(workerId);
        
        if (workerInfo) {
            workerInfo.busy = false;
            workerInfo.currentTask = null;
        }
        
        // Clear timeout
        const timeoutId = this.workerTimeouts.get(taskId);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.workerTimeouts.delete(taskId);
        }
        
        // Clean up
        this.activeWorkers.delete(taskId);
        this.pendingTasks.delete(taskId);
        
        logger.info(`Task ${taskId} cancelled in worker ${workerId}`);
        
        eventBus.emit('worker:task_cancelled', {
            taskId,
            workerId
        });
    }

    handleWorkerError(workerId, error) {
        logger.error(`Worker ${workerId} error:`, error);
        
        const workerInfo = this.workerPool.get(workerId);
        if (workerInfo && workerInfo.currentTask) {
            this.handleTaskError(workerId, workerInfo.currentTask, error);
        }
        
        // Restart worker if needed
        this.restartWorker(workerId);
    }

    cancelTask(event) {
        const { taskId, reason = 'user_requested' } = event.detail;
        
        const workerId = this.activeWorkers.get(taskId);
        if (!workerId) {
            logger.warn(`Cannot cancel task ${taskId}: not found`);
            return;
        }
        
        const workerInfo = this.workerPool.get(workerId);
        if (workerInfo) {
            workerInfo.worker.postMessage({
                type: 'CANCEL_TASK',
                taskId: taskId
            });
        }
        
        logger.info(`Cancelling task ${taskId} in worker ${workerId} (reason: ${reason})`);
    }

    async restartWorker(workerId) {
        const workerInfo = this.workerPool.get(workerId);
        if (!workerInfo) return;
        
        try {
            // Terminate old worker
            workerInfo.worker.terminate();
            URL.revokeObjectURL(workerInfo.url);
            
            // Create new worker of the same type
            const newWorkerId = await this.createWorker(workerInfo.type);
            
            // Remove old worker from pool
            this.workerPool.delete(workerId);
            
            logger.info(`Restarted worker ${workerId} as ${newWorkerId}`);
            
        } catch (error) {
            logger.error(`Failed to restart worker ${workerId}:`, error);
        }
    }

    getWorkerStatus(event) {
        const status = {
            totalWorkers: this.workerPool.size,
            activeWorkers: this.activeWorkers.size,
            pendingTasks: this.pendingTasks.size,
            workers: []
        };
        
        for (const [workerId, workerInfo] of this.workerPool.entries()) {
            status.workers.push({
                id: workerId,
                type: workerInfo.type,
                busy: workerInfo.busy,
                currentTask: workerInfo.currentTask,
                tasksCompleted: workerInfo.tasksCompleted,
                uptime: Date.now() - workerInfo.created
            });
        }
        
        eventBus.emit('worker:status_response', status);
        return status;
    }

    cleanup() {
        // Cancel all pending tasks
        for (const taskId of this.pendingTasks.keys()) {
            this.cancelTask({ detail: { taskId, reason: 'cleanup' } });
        }
        
        logger.info('Web Workers cleanup completed');
    }

    shutdown() {
        // Terminate all workers
        for (const [workerId, workerInfo] of this.workerPool.entries()) {
            workerInfo.worker.terminate();
            URL.revokeObjectURL(workerInfo.url);
            logger.info(`Terminated worker ${workerId}`);
        }
        
        // Clear all data structures
        this.workerPool.clear();
        this.activeWorkers.clear();
        this.pendingTasks.clear();
        this.taskResults.clear();
        this.workerTimeouts.clear();
        
        logger.info('Web Workers Manager shutdown complete');
    }
}

// Export as singleton
const webWorkersManager = new WebWorkersManager();
export default webWorkersManager;