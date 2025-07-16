/**
 * Task Manager - Core Task Processing System
 * 
 * Implements the task execution system described in the whitepaper.
 * Features:
 * - Task planning and decomposition
 * - Web Worker sandboxing for task execution
 * - Integration with TaskAuctionSystem
 * - Task pause/resume functionality
 * - Ethics verification integration
 * - Performance monitoring
 * - Context-aware task processing
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';

class TaskManager {
    constructor() {
        this.name = 'TaskManager';
        this.version = '1.0.0';
        this.initialized = false;
        this.active = false;
        
        // Task state management
        this.activeTasks = new Map();
        this.taskQueue = [];
        this.completedTasks = new Map();
        this.pausedTasks = new Map();
        
        // Web Worker management
        this.workerPool = [];
        this.maxWorkers = 4;
        this.availableWorkers = [];
        
        // Task execution state
        this.currentTask = null;
        this.taskHistory = [];
        this.taskMetrics = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            avgExecutionTime: 0
        };
        
        // Tool registry
        this.availableTools = new Map();
        this.toolMetadata = new Map();
        
        // Configuration
        this.config = {
            maxConcurrentTasks: 3,
            taskTimeout: 300000, // 5 minutes
            maxMemoryPerTask: 512 * 1024 * 1024, // 512MB
            enableSandboxing: true,
            autoRetryFailedTasks: true,
            maxRetries: 3
        };
        
        this.init();
    }
    
    async init() {
        try {
            console.log('⚙️ Initializing Task Manager...');
            
            this.setupEventListeners();
            this.initializeWorkerPool();
            this.loadAvailableTools();
            this.startTaskProcessor();
            
            this.initialized = true;
            console.log('✅ Task Manager initialized');
            
            eventBus.emit('module:initialized', {
                name: this.name,
                version: this.version,
                capabilities: ['task_execution', 'worker_management', 'tool_integration']
            });
            
        } catch (error) {
            console.error('❌ Task Manager initialization failed:', error);
            throw error;
        }
    }
    
    setupEventListeners() {
        // Task execution events
        eventBus.on('task:submit', this.handleTaskSubmission.bind(this));
        eventBus.on('task:pause', this.pauseTask.bind(this));
        eventBus.on('task:resume', this.resumeTask.bind(this));
        eventBus.on('task:cancel', this.cancelTask.bind(this));
        
        // Chat interface integration
        eventBus.on('chat:message', this.handleChatMessage.bind(this));
        eventBus.on('chat:voice', this.handleVoiceInput.bind(this));
        
        // Ethics integration
        eventBus.on('ethics:evaluation-complete', this.handleEthicsEvaluation.bind(this));
        
        // Session context integration
        eventBus.on('session:context-changed', this.handleContextChange.bind(this));
        
        // Worker management
        eventBus.on('worker:message', this.handleWorkerMessage.bind(this));
        eventBus.on('worker:error', this.handleWorkerError.bind(this));
        
        // Auction system integration
        eventBus.on('auction:task-awarded', this.handleTaskAward.bind(this));
        eventBus.on('auction:task-rejected', this.handleTaskRejection.bind(this));
        
        // State updates
        eventBus.on('state:update', this.handleStateUpdate.bind(this));
    }
    
    initializeWorkerPool() {
        console.log('🧵 Initializing worker pool...');
        
        for (let i = 0; i < this.maxWorkers; i++) {
            try {
                const worker = new Worker('src/workers/TaskWorker.js', { type: 'module' });
                worker.id = `worker-${i}`;
                worker.busy = false;
                worker.currentTask = null;
                
                worker.onmessage = (event) => {
                    eventBus.emit('worker:message', {
                        workerId: worker.id,
                        data: event.data
                    });
                };
                
                worker.onerror = (error) => {
                    eventBus.emit('worker:error', {
                        workerId: worker.id,
                        error: error
                    });
                };
                
                this.workerPool.push(worker);
                this.availableWorkers.push(worker);
                
            } catch (error) {
                console.warn('⚠️ Could not create worker:', error);
            }
        }
        
        console.log(`✅ Worker pool initialized with ${this.workerPool.length} workers`);
    }
    
    loadAvailableTools() {
        // Define available tools for task execution
        this.availableTools.set('web_search', {
            name: 'Web Search',
            description: 'Search the web for information',
            category: 'information',
            resourceCost: 10
        });
        
        this.availableTools.set('file_analysis', {
            name: 'File Analysis',
            description: 'Analyze files and documents',
            category: 'analysis',
            resourceCost: 15
        });
        
        this.availableTools.set('code_generation', {
            name: 'Code Generation',
            description: 'Generate code based on specifications',
            category: 'creation',
            resourceCost: 20
        });
        
        this.availableTools.set('data_processing', {
            name: 'Data Processing',
            description: 'Process and transform data',
            category: 'processing',
            resourceCost: 12
        });
        
        this.availableTools.set('text_analysis', {
            name: 'Text Analysis',
            description: 'Analyze and understand text content',
            category: 'analysis',
            resourceCost: 8
        });
        
        console.log(`🛠️ Loaded ${this.availableTools.size} available tools`);
    }
    
    startTaskProcessor() {
        // Process task queue every 1 second
        setInterval(() => {
            this.processTaskQueue();
        }, 1000);
    }
    
    async handleChatMessage(data) {
        const { message, sessionId } = data;
        
        // Create task from chat message
        const task = {
            id: this.generateTaskId(),
            type: 'chat_response',
            message: message,
            sessionId: sessionId,
            priority: 'normal',
            createdAt: Date.now(),
            status: 'pending'
        };
        
        // Add context enhancement
        eventBus.emit('session:enhance-task', {
            taskId: task.id,
            sessionId: sessionId,
            taskData: task
        });
        
        // Submit for ethics evaluation
        eventBus.emit('ethics:evaluate', {
            taskId: task.id,
            plan: this.createChatResponsePlan(message),
            context: { sessionId }
        });
    }
    
    async handleVoiceInput(data) {
        const { audioData, sessionId } = data;
        
        // Create voice processing task
        const task = {
            id: this.generateTaskId(),
            type: 'voice_processing',
            audioData: audioData,
            sessionId: sessionId,
            priority: 'high',
            createdAt: Date.now(),
            status: 'pending'
        };
        
        this.submitTask(task);
    }
    
    async handleTaskSubmission(data) {
        const { task } = data;
        
        console.log(`📋 Task submitted: ${task.id}`);
        
        // Add to active tasks
        this.activeTasks.set(task.id, {
            ...task,
            status: 'queued',
            submittedAt: Date.now()
        });
        
        // Add to queue
        this.taskQueue.push(task);
        
        // Update UI
        this.updateTaskList();
        
        // Update metrics
        this.taskMetrics.totalTasks++;
        this.updateMetrics();
    }
    
    async handleEthicsEvaluation(data) {
        const { taskId, approved, reasoning, metabolicLoad } = data;
        
        const task = this.activeTasks.get(taskId);
        if (!task) return;
        
        if (approved) {
            console.log(`✅ Task ${taskId} approved by ethics module`);
            task.status = 'approved';
            task.metabolicLoad = metabolicLoad;
            task.ethicsReasoning = reasoning;
            
            // Submit to auction system if needed
            if (task.requiresAuction) {
                eventBus.emit('auction:submit-task', {
                    taskId: taskId,
                    task: task
                });
            } else {
                // Execute directly
                this.executeTask(task);
            }
        } else {
            console.log(`❌ Task ${taskId} rejected by ethics module: ${reasoning}`);
            task.status = 'rejected';
            task.rejectionReason = reasoning;
            
            // Notify user
            eventBus.emit('task:rejected', {
                taskId: taskId,
                reason: reasoning
            });
        }
        
        this.updateTaskList();
    }
    
    async handleTaskAward(data) {
        const { taskId, awardedModule } = data;
        
        const task = this.activeTasks.get(taskId);
        if (!task) return;
        
        console.log(`🏆 Task ${taskId} awarded to ${awardedModule}`);
        task.status = 'awarded';
        task.awardedModule = awardedModule;
        
        // Execute the task
        this.executeTask(task);
    }
    
    async executeTask(task) {
        console.log(`🚀 Executing task: ${task.id}`);
        
        // Update task status
        task.status = 'executing';
        task.startedAt = Date.now();
        this.currentTask = task;
        
        // Get available worker
        const worker = this.getAvailableWorker();
        if (!worker) {
            console.log('⏸️ No available workers, queuing task');
            return;
        }
        
        // Assign worker
        worker.busy = true;
        worker.currentTask = task;
        task.workerId = worker.id;
        
        // Create execution plan
        const plan = this.createExecutionPlan(task);
        
        // Send task to worker
        worker.postMessage({
            type: 'execute_task',
            taskId: task.id,
            plan: plan,
            tools: Array.from(this.availableTools.entries()),
            config: this.config
        });
        
        // Set timeout
        task.timeoutId = setTimeout(() => {
            this.handleTaskTimeout(task);
        }, this.config.taskTimeout);
        
        // Update UI
        this.updateTaskList();
        this.updateCurrentTask();
        
        // Emit event
        eventBus.emit('task:started', {
            taskId: task.id,
            workerId: worker.id
        });
    }
    
    createExecutionPlan(task) {
        switch (task.type) {
            case 'chat_response':
                return this.createChatResponsePlan(task.message);
            case 'voice_processing':
                return this.createVoiceProcessingPlan(task.audioData);
            case 'file_analysis':
                return this.createFileAnalysisPlan(task.fileData);
            default:
                return this.createGenericPlan(task);
        }
    }
    
    createChatResponsePlan(message) {
        return {
            steps: [
                {
                    tool: 'text_analysis',
                    action: 'analyze_intent',
                    input: message,
                    expectedOutput: 'intent_analysis'
                },
                {
                    tool: 'web_search',
                    action: 'search_information',
                    input: 'intent_analysis',
                    expectedOutput: 'search_results',
                    condition: 'if_requires_external_info'
                },
                {
                    tool: 'code_generation',
                    action: 'generate_response',
                    input: ['intent_analysis', 'search_results'],
                    expectedOutput: 'response_text'
                }
            ],
            estimatedTime: 5000,
            resourceRequirements: {
                memory: 128 * 1024 * 1024, // 128MB
                cpu: 'medium',
                network: 'light'
            }
        };
    }
    
    createVoiceProcessingPlan(audioData) {
        return {
            steps: [
                {
                    tool: 'speech_to_text',
                    action: 'transcribe',
                    input: audioData,
                    expectedOutput: 'transcription'
                },
                {
                    tool: 'text_analysis',
                    action: 'analyze_intent',
                    input: 'transcription',
                    expectedOutput: 'intent_analysis'
                },
                {
                    tool: 'code_generation',
                    action: 'generate_response',
                    input: 'intent_analysis',
                    expectedOutput: 'response_text'
                }
            ],
            estimatedTime: 8000,
            resourceRequirements: {
                memory: 256 * 1024 * 1024, // 256MB
                cpu: 'high',
                network: 'moderate'
            }
        };
    }
    
    createGenericPlan(task) {
        return {
            steps: [
                {
                    tool: 'data_processing',
                    action: 'process_input',
                    input: task.data || task.message,
                    expectedOutput: 'processed_data'
                }
            ],
            estimatedTime: 3000,
            resourceRequirements: {
                memory: 64 * 1024 * 1024, // 64MB
                cpu: 'low',
                network: 'minimal'
            }
        };
    }
    
    async handleWorkerMessage(data) {
        const { workerId, data: workerData } = data;
        const worker = this.workerPool.find(w => w.id === workerId);
        
        if (!worker || !worker.currentTask) return;
        
        const task = worker.currentTask;
        
        switch (workerData.type) {
            case 'task_progress':
                this.handleTaskProgress(task, workerData);
                break;
            case 'task_complete':
                this.handleTaskComplete(task, workerData);
                break;
            case 'task_error':
                this.handleTaskError(task, workerData);
                break;
            case 'resource_usage':
                this.handleResourceUsage(task, workerData);
                break;
        }
    }
    
    handleTaskProgress(task, data) {
        task.progress = data.progress;
        task.currentStep = data.currentStep;
        task.progressMessage = data.message;
        
        // Update UI
        this.updateCurrentTask();
        
        // Emit progress event
        eventBus.emit('task:progress', {
            taskId: task.id,
            progress: data.progress,
            message: data.message
        });
    }
    
    handleTaskComplete(task, data) {
        console.log(`✅ Task completed: ${task.id}`);
        
        // Clean up
        this.cleanupTask(task);
        
        // Update status
        task.status = 'completed';
        task.completedAt = Date.now();
        task.result = data.result;
        task.executionTime = task.completedAt - task.startedAt;
        
        // Move to completed tasks
        this.completedTasks.set(task.id, task);
        this.activeTasks.delete(task.id);
        
        // Update metrics
        this.taskMetrics.completedTasks++;
        this.updateAverageExecutionTime(task.executionTime);
        this.updateMetrics();
        
        // Handle response based on task type
        if (task.type === 'chat_response') {
            eventBus.emit('chat:response', {
                sessionId: task.sessionId,
                response: data.result,
                taskId: task.id
            });
        }
        
        // Update UI
        this.updateTaskList();
        this.updateCurrentTask();
        
        // Emit completion event
        eventBus.emit('task:completed', {
            taskId: task.id,
            result: data.result,
            executionTime: task.executionTime
        });
    }
    
    handleTaskError(task, data) {
        console.error(`❌ Task error: ${task.id}`, data.error);
        
        // Clean up
        this.cleanupTask(task);
        
        // Update status
        task.status = 'failed';
        task.error = data.error;
        task.failedAt = Date.now();
        
        // Retry logic
        if (this.config.autoRetryFailedTasks && (task.retryCount || 0) < this.config.maxRetries) {
            task.retryCount = (task.retryCount || 0) + 1;
            console.log(`🔄 Retrying task ${task.id} (attempt ${task.retryCount})`);
            
            // Retry after delay
            setTimeout(() => {
                this.executeTask(task);
            }, 5000);
            
            return;
        }
        
        // Move to completed tasks (failed)
        this.completedTasks.set(task.id, task);
        this.activeTasks.delete(task.id);
        
        // Update metrics
        this.taskMetrics.failedTasks++;
        this.updateMetrics();
        
        // Update UI
        this.updateTaskList();
        this.updateCurrentTask();
        
        // Emit error event
        eventBus.emit('task:error', {
            taskId: task.id,
            error: data.error
        });
    }
    
    cleanupTask(task) {
        // Clear timeout
        if (task.timeoutId) {
            clearTimeout(task.timeoutId);
            delete task.timeoutId;
        }
        
        // Release worker
        const worker = this.workerPool.find(w => w.id === task.workerId);
        if (worker) {
            worker.busy = false;
            worker.currentTask = null;
            this.availableWorkers.push(worker);
        }
        
        // Clear current task if this is it
        if (this.currentTask && this.currentTask.id === task.id) {
            this.currentTask = null;
        }
    }
    
    handleTaskTimeout(task) {
        console.warn(`⏰ Task timeout: ${task.id}`);
        
        // Terminate worker if needed
        const worker = this.workerPool.find(w => w.id === task.workerId);
        if (worker) {
            worker.terminate();
            this.replaceWorker(worker);
        }
        
        // Handle as error
        this.handleTaskError(task, {
            error: 'Task execution timeout'
        });
    }
    
    replaceWorker(oldWorker) {
        // Remove old worker
        const index = this.workerPool.indexOf(oldWorker);
        if (index > -1) {
            this.workerPool.splice(index, 1);
        }
        
        // Create new worker
        try {
            const newWorker = new Worker('src/workers/TaskWorker.js', { type: 'module' });
            newWorker.id = oldWorker.id;
            newWorker.busy = false;
            newWorker.currentTask = null;
            
            newWorker.onmessage = (event) => {
                eventBus.emit('worker:message', {
                    workerId: newWorker.id,
                    data: event.data
                });
            };
            
            newWorker.onerror = (error) => {
                eventBus.emit('worker:error', {
                    workerId: newWorker.id,
                    error: error
                });
            };
            
            this.workerPool.push(newWorker);
            this.availableWorkers.push(newWorker);
            
        } catch (error) {
            console.error('Failed to replace worker:', error);
        }
    }
    
    getAvailableWorker() {
        return this.availableWorkers.pop() || null;
    }
    
    pauseTask(data) {
        const { taskId } = data;
        const task = this.activeTasks.get(taskId);
        
        if (!task || task.status !== 'executing') return;
        
        console.log(`⏸️ Pausing task: ${taskId}`);
        
        // Send pause signal to worker
        const worker = this.workerPool.find(w => w.id === task.workerId);
        if (worker) {
            worker.postMessage({
                type: 'pause_task',
                taskId: taskId
            });
        }
        
        // Update status
        task.status = 'paused';
        task.pausedAt = Date.now();
        
        // Move to paused tasks
        this.pausedTasks.set(taskId, task);
        
        // Update UI
        this.updateTaskList();
        this.updateCurrentTask();
        
        eventBus.emit('task:paused', { taskId });
    }
    
    resumeTask(data) {
        const { taskId } = data;
        const task = this.pausedTasks.get(taskId);
        
        if (!task) return;
        
        console.log(`▶️ Resuming task: ${taskId}`);
        
        // Send resume signal to worker
        const worker = this.workerPool.find(w => w.id === task.workerId);
        if (worker) {
            worker.postMessage({
                type: 'resume_task',
                taskId: taskId
            });
        }
        
        // Update status
        task.status = 'executing';
        task.resumedAt = Date.now();
        
        // Move back to active tasks
        this.activeTasks.set(taskId, task);
        this.pausedTasks.delete(taskId);
        
        // Update UI
        this.updateTaskList();
        this.updateCurrentTask();
        
        eventBus.emit('task:resumed', { taskId });
    }
    
    cancelTask(data) {
        const { taskId } = data;
        const task = this.activeTasks.get(taskId) || this.pausedTasks.get(taskId);
        
        if (!task) return;
        
        console.log(`🚫 Canceling task: ${taskId}`);
        
        // Send cancel signal to worker
        const worker = this.workerPool.find(w => w.id === task.workerId);
        if (worker) {
            worker.postMessage({
                type: 'cancel_task',
                taskId: taskId
            });
        }
        
        // Clean up
        this.cleanupTask(task);
        
        // Update status
        task.status = 'cancelled';
        task.cancelledAt = Date.now();
        
        // Move to completed tasks
        this.completedTasks.set(taskId, task);
        this.activeTasks.delete(taskId);
        this.pausedTasks.delete(taskId);
        
        // Update UI
        this.updateTaskList();
        this.updateCurrentTask();
        
        eventBus.emit('task:cancelled', { taskId });
    }
    
    processTaskQueue() {
        if (this.taskQueue.length === 0) return;
        
        const availableWorkers = this.availableWorkers.length;
        const tasksToProcess = Math.min(this.taskQueue.length, availableWorkers, this.config.maxConcurrentTasks);
        
        for (let i = 0; i < tasksToProcess; i++) {
            const task = this.taskQueue.shift();
            if (task.status === 'approved') {
                this.executeTask(task);
            }
        }
    }
    
    updateTaskList() {
        const taskList = {
            active: Array.from(this.activeTasks.values()),
            paused: Array.from(this.pausedTasks.values()),
            completed: Array.from(this.completedTasks.values()).slice(-10) // Last 10
        };
        
        stateManager.setState('tasks', taskList);
        eventBus.emit('ui:update-tasks', taskList);
    }
    
    updateCurrentTask() {
        stateManager.setState('currentTask', this.currentTask);
        eventBus.emit('ui:update-current-task', this.currentTask);
    }
    
    updateMetrics() {
        stateManager.setState('taskMetrics', this.taskMetrics);
        eventBus.emit('ui:update-metrics', this.taskMetrics);
    }
    
    updateAverageExecutionTime(executionTime) {
        const total = this.taskMetrics.avgExecutionTime * (this.taskMetrics.completedTasks - 1);
        this.taskMetrics.avgExecutionTime = (total + executionTime) / this.taskMetrics.completedTasks;
    }
    
    generateTaskId() {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Public API
    async submitTask(task) {
        eventBus.emit('task:submit', { task });
    }
    
    getTaskStatus(taskId) {
        return this.activeTasks.get(taskId) || 
               this.pausedTasks.get(taskId) || 
               this.completedTasks.get(taskId);
    }
    
    getTaskHistory() {
        return Array.from(this.completedTasks.values());
    }
    
    getActiveTasksCount() {
        return this.activeTasks.size;
    }
    
    getMetrics() {
        return { ...this.taskMetrics };
    }
    
    async start() {
        if (this.active) return;
        
        console.log('▶️ Starting Task Manager...');
        this.active = true;
        
        eventBus.emit('module:started', {
            name: this.name,
            timestamp: Date.now()
        });
    }
    
    async stop() {
        if (!this.active) return;
        
        console.log('⏹️ Stopping Task Manager...');
        this.active = false;
        
        // Cancel all active tasks
        for (const task of this.activeTasks.values()) {
            this.cancelTask({ taskId: task.id });
        }
        
        // Terminate all workers
        this.workerPool.forEach(worker => worker.terminate());
        this.workerPool = [];
        this.availableWorkers = [];
        
        eventBus.emit('module:stopped', {
            name: this.name,
            timestamp: Date.now()
        });
    }
    
    getStatus() {
        return {
            name: this.name,
            version: this.version,
            initialized: this.initialized,
            active: this.active,
            activeTasks: this.activeTasks.size,
            pausedTasks: this.pausedTasks.size,
            completedTasks: this.completedTasks.size,
            availableWorkers: this.availableWorkers.length,
            metrics: this.taskMetrics
        };
    }
}

export default TaskManager;