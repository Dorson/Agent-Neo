/**
 * TasksView Component - Task Management Interface
 * 
 * Provides a comprehensive interface for managing tasks as described in the whitepaper.
 * Features:
 * - Real-time task status updates
 * - Task filtering and sorting
 * - Task pause/resume/cancel controls
 * - Progress tracking
 * - Task history
 * - Resource usage monitoring
 * - Ethics status indicators
 */

import eventBus from '../../core/EventBus.js';
import stateManager from '../../core/StateManager.js';

class TasksView {
    constructor() {
        this.name = 'TasksView';
        this.initialized = false;
        this.container = null;
        
        // State
        this.tasks = {
            active: [],
            paused: [],
            completed: []
        };
        this.currentTask = null;
        this.taskMetrics = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            avgExecutionTime: 0
        };
        
        // UI elements
        this.elements = {};
        
        // Filters
        this.filters = {
            status: 'all',
            type: 'all',
            priority: 'all',
            sortBy: 'createdAt',
            sortOrder: 'desc'
        };
        
        this.init();
    }
    
    async init() {
        try {
            console.log('📋 Initializing TasksView...');
            
            this.setupEventListeners();
            this.loadState();
            
            this.initialized = true;
            console.log('✅ TasksView initialized');
            
        } catch (error) {
            console.error('❌ TasksView initialization failed:', error);
            throw error;
        }
    }
    
    setupEventListeners() {
        // Task updates
        eventBus.on('ui:update-tasks', this.updateTasks.bind(this));
        eventBus.on('ui:update-current-task', this.updateCurrentTask.bind(this));
        eventBus.on('ui:update-metrics', this.updateMetrics.bind(this));
        
        // Task events
        eventBus.on('task:started', this.handleTaskStarted.bind(this));
        eventBus.on('task:progress', this.handleTaskProgress.bind(this));
        eventBus.on('task:completed', this.handleTaskCompleted.bind(this));
        eventBus.on('task:paused', this.handleTaskPaused.bind(this));
        eventBus.on('task:resumed', this.handleTaskResumed.bind(this));
        eventBus.on('task:cancelled', this.handleTaskCancelled.bind(this));
        eventBus.on('task:error', this.handleTaskError.bind(this));
        
        // UI events
        eventBus.on('view:activate', this.handleViewActivate.bind(this));
    }
    
    loadState() {
        this.tasks = stateManager.getState('tasks', this.tasks);
        this.currentTask = stateManager.getState('currentTask', this.currentTask);
        this.taskMetrics = stateManager.getState('taskMetrics', this.taskMetrics);
    }
    
    render(container) {
        if (!container) return;
        
        this.container = container;
        
        container.innerHTML = `
            <div class="tasks-view">
                <div class="view-header">
                    <h2>Task Management</h2>
                    <p>Monitor and manage active and completed tasks</p>
                </div>
                
                <!-- Task Metrics -->
                <div class="task-metrics">
                    <div class="metric-card">
                        <div class="metric-label">Total Tasks</div>
                        <div class="metric-value" id="totalTasks">${this.taskMetrics.totalTasks}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">Completed</div>
                        <div class="metric-value" id="completedTasks">${this.taskMetrics.completedTasks}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">Failed</div>
                        <div class="metric-value" id="failedTasks">${this.taskMetrics.failedTasks}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">Avg Time</div>
                        <div class="metric-value" id="avgExecutionTime">${this.formatTime(this.taskMetrics.avgExecutionTime)}</div>
                    </div>
                </div>
                
                <!-- Current Task -->
                <div class="current-task-section">
                    <h3>Current Task</h3>
                    <div class="current-task" id="currentTask">
                        ${this.renderCurrentTask()}
                    </div>
                </div>
                
                <!-- Task Filters -->
                <div class="task-filters">
                    <div class="filter-group">
                        <label>Status:</label>
                        <select id="statusFilter">
                            <option value="all">All</option>
                            <option value="active">Active</option>
                            <option value="paused">Paused</option>
                            <option value="completed">Completed</option>
                            <option value="failed">Failed</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Type:</label>
                        <select id="typeFilter">
                            <option value="all">All Types</option>
                            <option value="chat_response">Chat Response</option>
                            <option value="voice_processing">Voice Processing</option>
                            <option value="file_analysis">File Analysis</option>
                            <option value="data_processing">Data Processing</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Priority:</label>
                        <select id="priorityFilter">
                            <option value="all">All Priorities</option>
                            <option value="high">High</option>
                            <option value="normal">Normal</option>
                            <option value="low">Low</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Sort by:</label>
                        <select id="sortByFilter">
                            <option value="createdAt">Created</option>
                            <option value="priority">Priority</option>
                            <option value="type">Type</option>
                            <option value="status">Status</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <button class="btn btn-secondary" id="clearFilters">Clear Filters</button>
                    </div>
                </div>
                
                <!-- Task List -->
                <div class="task-list-section">
                    <div class="task-list-header">
                        <h3>Tasks</h3>
                        <div class="task-count" id="taskCount">0 tasks</div>
                    </div>
                    <div class="task-list" id="taskList">
                        ${this.renderTaskList()}
                    </div>
                </div>
            </div>
        `;
        
        this.bindEvents();
        this.updateTaskList();
    }
    
    bindEvents() {
        // Filter controls
        this.elements.statusFilter = this.container.querySelector('#statusFilter');
        this.elements.typeFilter = this.container.querySelector('#typeFilter');
        this.elements.priorityFilter = this.container.querySelector('#priorityFilter');
        this.elements.sortByFilter = this.container.querySelector('#sortByFilter');
        this.elements.clearFilters = this.container.querySelector('#clearFilters');
        
        // Task list
        this.elements.taskList = this.container.querySelector('#taskList');
        this.elements.taskCount = this.container.querySelector('#taskCount');
        this.elements.currentTask = this.container.querySelector('#currentTask');
        
        // Metrics
        this.elements.totalTasks = this.container.querySelector('#totalTasks');
        this.elements.completedTasks = this.container.querySelector('#completedTasks');
        this.elements.failedTasks = this.container.querySelector('#failedTasks');
        this.elements.avgExecutionTime = this.container.querySelector('#avgExecutionTime');
        
        // Event listeners
        this.elements.statusFilter.addEventListener('change', this.handleFilterChange.bind(this));
        this.elements.typeFilter.addEventListener('change', this.handleFilterChange.bind(this));
        this.elements.priorityFilter.addEventListener('change', this.handleFilterChange.bind(this));
        this.elements.sortByFilter.addEventListener('change', this.handleFilterChange.bind(this));
        this.elements.clearFilters.addEventListener('click', this.clearFilters.bind(this));
        
        // Task list events (delegated)
        this.elements.taskList.addEventListener('click', this.handleTaskListClick.bind(this));
    }
    
    renderCurrentTask() {
        if (!this.currentTask) {
            return `
                <div class="no-current-task">
                    <div class="icon">💤</div>
                    <div class="message">No task currently running</div>
                </div>
            `;
        }
        
        const task = this.currentTask;
        const progress = task.progress || 0;
        const statusClass = this.getStatusClass(task.status);
        
        return `
            <div class="current-task-card">
                <div class="task-header">
                    <div class="task-title">${this.truncateText(task.message || task.type, 50)}</div>
                    <div class="task-status ${statusClass}">
                        <span class="status-indicator"></span>
                        ${task.status}
                    </div>
                </div>
                
                <div class="task-details">
                    <div class="task-type">${this.formatTaskType(task.type)}</div>
                    <div class="task-id">ID: ${task.id}</div>
                    <div class="task-time">Started: ${this.formatTime(Date.now() - task.startedAt)}</div>
                </div>
                
                <div class="task-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="progress-text">${Math.round(progress)}% - ${task.progressMessage || 'Processing...'}</div>
                </div>
                
                <div class="task-controls">
                    ${this.renderTaskControls(task)}
                </div>
                
                ${task.metabolicLoad ? `
                    <div class="metabolic-load">
                        <span class="label">Metabolic Load:</span>
                        <span class="value ${this.getMetabolicLoadClass(task.metabolicLoad)}">${task.metabolicLoad}</span>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    renderTaskList() {
        const filteredTasks = this.getFilteredTasks();
        
        if (filteredTasks.length === 0) {
            return `
                <div class="no-tasks">
                    <div class="icon">📋</div>
                    <div class="message">No tasks match your filters</div>
                </div>
            `;
        }
        
        return filteredTasks.map(task => this.renderTaskCard(task)).join('');
    }
    
    renderTaskCard(task) {
        const statusClass = this.getStatusClass(task.status);
        const priorityClass = this.getPriorityClass(task.priority);
        const progress = task.progress || 0;
        
        return `
            <div class="task-card" data-task-id="${task.id}">
                <div class="task-card-header">
                    <div class="task-info">
                        <div class="task-title">${this.truncateText(task.message || task.type, 40)}</div>
                        <div class="task-meta">
                            <span class="task-type">${this.formatTaskType(task.type)}</span>
                            <span class="task-priority ${priorityClass}">${task.priority || 'normal'}</span>
                            <span class="task-id">ID: ${task.id.split('_')[2]}</span>
                        </div>
                    </div>
                    <div class="task-status ${statusClass}">
                        <span class="status-indicator"></span>
                        ${task.status}
                    </div>
                </div>
                
                <div class="task-card-body">
                    ${task.status === 'executing' ? `
                        <div class="task-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progress}%"></div>
                            </div>
                            <div class="progress-text">${Math.round(progress)}%</div>
                        </div>
                    ` : ''}
                    
                    <div class="task-timestamps">
                        <div class="timestamp">
                            <span class="label">Created:</span>
                            <span class="value">${this.formatDateTime(task.createdAt)}</span>
                        </div>
                        ${task.startedAt ? `
                            <div class="timestamp">
                                <span class="label">Started:</span>
                                <span class="value">${this.formatDateTime(task.startedAt)}</span>
                            </div>
                        ` : ''}
                        ${task.completedAt ? `
                            <div class="timestamp">
                                <span class="label">Completed:</span>
                                <span class="value">${this.formatDateTime(task.completedAt)}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    ${task.executionTime ? `
                        <div class="execution-time">
                            <span class="label">Execution Time:</span>
                            <span class="value">${this.formatTime(task.executionTime)}</span>
                        </div>
                    ` : ''}
                    
                    ${task.error ? `
                        <div class="task-error">
                            <span class="label">Error:</span>
                            <span class="value">${task.error}</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="task-card-footer">
                    <div class="task-actions">
                        ${this.renderTaskControls(task)}
                    </div>
                </div>
            </div>
        `;
    }
    
    renderTaskControls(task) {
        const controls = [];
        
        if (task.status === 'executing') {
            controls.push(`
                <button class="btn btn-small btn-warning" data-action="pause" data-task-id="${task.id}">
                    <span class="btn-icon">⏸️</span>
                    Pause
                </button>
            `);
            controls.push(`
                <button class="btn btn-small btn-danger" data-action="cancel" data-task-id="${task.id}">
                    <span class="btn-icon">🚫</span>
                    Cancel
                </button>
            `);
        } else if (task.status === 'paused') {
            controls.push(`
                <button class="btn btn-small btn-success" data-action="resume" data-task-id="${task.id}">
                    <span class="btn-icon">▶️</span>
                    Resume
                </button>
            `);
            controls.push(`
                <button class="btn btn-small btn-danger" data-action="cancel" data-task-id="${task.id}">
                    <span class="btn-icon">🚫</span>
                    Cancel
                </button>
            `);
        } else if (task.status === 'failed' && task.retryCount < 3) {
            controls.push(`
                <button class="btn btn-small btn-primary" data-action="retry" data-task-id="${task.id}">
                    <span class="btn-icon">🔄</span>
                    Retry
                </button>
            `);
        }
        
        controls.push(`
            <button class="btn btn-small btn-secondary" data-action="details" data-task-id="${task.id}">
                <span class="btn-icon">🔍</span>
                Details
            </button>
        `);
        
        return controls.join('');
    }
    
    getFilteredTasks() {
        let allTasks = [
            ...this.tasks.active,
            ...this.tasks.paused,
            ...this.tasks.completed
        ];
        
        // Apply filters
        if (this.filters.status !== 'all') {
            allTasks = allTasks.filter(task => task.status === this.filters.status);
        }
        
        if (this.filters.type !== 'all') {
            allTasks = allTasks.filter(task => task.type === this.filters.type);
        }
        
        if (this.filters.priority !== 'all') {
            allTasks = allTasks.filter(task => task.priority === this.filters.priority);
        }
        
        // Sort tasks
        allTasks.sort((a, b) => {
            const sortField = this.filters.sortBy;
            const sortOrder = this.filters.sortOrder;
            
            let aValue = a[sortField];
            let bValue = b[sortField];
            
            if (sortField === 'priority') {
                const priorityOrder = { high: 3, normal: 2, low: 1 };
                aValue = priorityOrder[aValue] || 2;
                bValue = priorityOrder[bValue] || 2;
            }
            
            if (sortOrder === 'desc') {
                return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
            } else {
                return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
            }
        });
        
        return allTasks;
    }
    
    handleFilterChange(event) {
        const filterType = event.target.id.replace('Filter', '');
        this.filters[filterType] = event.target.value;
        this.updateTaskList();
    }
    
    clearFilters() {
        this.filters = {
            status: 'all',
            type: 'all',
            priority: 'all',
            sortBy: 'createdAt',
            sortOrder: 'desc'
        };
        
        // Update filter controls
        this.elements.statusFilter.value = 'all';
        this.elements.typeFilter.value = 'all';
        this.elements.priorityFilter.value = 'all';
        this.elements.sortByFilter.value = 'createdAt';
        
        this.updateTaskList();
    }
    
    handleTaskListClick(event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        
        const action = button.dataset.action;
        const taskId = button.dataset.taskId;
        
        switch (action) {
            case 'pause':
                eventBus.emit('task:pause', { taskId });
                break;
            case 'resume':
                eventBus.emit('task:resume', { taskId });
                break;
            case 'cancel':
                eventBus.emit('task:cancel', { taskId });
                break;
            case 'retry':
                this.retryTask(taskId);
                break;
            case 'details':
                this.showTaskDetails(taskId);
                break;
        }
    }
    
    retryTask(taskId) {
        const task = this.findTaskById(taskId);
        if (!task) return;
        
        // Create new task with retry flag
        const retryTask = {
            ...task,
            id: `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            status: 'pending',
            createdAt: Date.now(),
            retryCount: (task.retryCount || 0) + 1,
            originalTaskId: taskId
        };
        
        eventBus.emit('task:submit', { task: retryTask });
    }
    
    showTaskDetails(taskId) {
        const task = this.findTaskById(taskId);
        if (!task) return;
        
        // Create modal with task details
        const modal = this.createTaskDetailsModal(task);
        document.body.appendChild(modal);
        
        // Show modal
        modal.style.display = 'block';
    }
    
    createTaskDetailsModal(task) {
        const modal = document.createElement('div');
        modal.className = 'modal task-details-modal';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Task Details</h3>
                    <button class="modal-close">×</button>
                </div>
                <div class="modal-body">
                    <div class="task-details-grid">
                        <div class="detail-item">
                            <label>Task ID:</label>
                            <span>${task.id}</span>
                        </div>
                        <div class="detail-item">
                            <label>Type:</label>
                            <span>${this.formatTaskType(task.type)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Status:</label>
                            <span class="status-badge ${this.getStatusClass(task.status)}">${task.status}</span>
                        </div>
                        <div class="detail-item">
                            <label>Priority:</label>
                            <span class="priority-badge ${this.getPriorityClass(task.priority)}">${task.priority || 'normal'}</span>
                        </div>
                        <div class="detail-item">
                            <label>Created:</label>
                            <span>${this.formatDateTime(task.createdAt)}</span>
                        </div>
                        ${task.startedAt ? `
                            <div class="detail-item">
                                <label>Started:</label>
                                <span>${this.formatDateTime(task.startedAt)}</span>
                            </div>
                        ` : ''}
                        ${task.completedAt ? `
                            <div class="detail-item">
                                <label>Completed:</label>
                                <span>${this.formatDateTime(task.completedAt)}</span>
                            </div>
                        ` : ''}
                        ${task.executionTime ? `
                            <div class="detail-item">
                                <label>Execution Time:</label>
                                <span>${this.formatTime(task.executionTime)}</span>
                            </div>
                        ` : ''}
                        ${task.metabolicLoad ? `
                            <div class="detail-item">
                                <label>Metabolic Load:</label>
                                <span class="metabolic-load-badge ${this.getMetabolicLoadClass(task.metabolicLoad)}">${task.metabolicLoad}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    ${task.message ? `
                        <div class="task-message">
                            <label>Message:</label>
                            <div class="message-content">${task.message}</div>
                        </div>
                    ` : ''}
                    
                    ${task.error ? `
                        <div class="task-error">
                            <label>Error:</label>
                            <div class="error-content">${task.error}</div>
                        </div>
                    ` : ''}
                    
                    ${task.result ? `
                        <div class="task-result">
                            <label>Result:</label>
                            <div class="result-content">${typeof task.result === 'string' ? task.result : JSON.stringify(task.result, null, 2)}</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        // Close modal events
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.querySelector('.modal-overlay').addEventListener('click', () => {
            modal.remove();
        });
        
        return modal;
    }
    
    findTaskById(taskId) {
        const allTasks = [
            ...this.tasks.active,
            ...this.tasks.paused,
            ...this.tasks.completed
        ];
        
        return allTasks.find(task => task.id === taskId);
    }
    
    // Event handlers
    updateTasks(tasks) {
        this.tasks = tasks;
        this.updateTaskList();
    }
    
    updateCurrentTask(currentTask) {
        this.currentTask = currentTask;
        if (this.elements.currentTask) {
            this.elements.currentTask.innerHTML = this.renderCurrentTask();
        }
    }
    
    updateMetrics(metrics) {
        this.taskMetrics = metrics;
        
        if (this.elements.totalTasks) {
            this.elements.totalTasks.textContent = metrics.totalTasks;
            this.elements.completedTasks.textContent = metrics.completedTasks;
            this.elements.failedTasks.textContent = metrics.failedTasks;
            this.elements.avgExecutionTime.textContent = this.formatTime(metrics.avgExecutionTime);
        }
    }
    
    updateTaskList() {
        if (!this.elements.taskList) return;
        
        this.elements.taskList.innerHTML = this.renderTaskList();
        
        const filteredTasks = this.getFilteredTasks();
        this.elements.taskCount.textContent = `${filteredTasks.length} task${filteredTasks.length !== 1 ? 's' : ''}`;
    }
    
    handleTaskStarted(data) {
        console.log('Task started:', data.taskId);
        this.loadState();
        this.updateTaskList();
    }
    
    handleTaskProgress(data) {
        console.log('Task progress:', data.taskId, data.progress);
        this.loadState();
        this.updateCurrentTask(this.currentTask);
    }
    
    handleTaskCompleted(data) {
        console.log('Task completed:', data.taskId);
        this.loadState();
        this.updateTaskList();
        this.updateCurrentTask(this.currentTask);
    }
    
    handleTaskPaused(data) {
        console.log('Task paused:', data.taskId);
        this.loadState();
        this.updateTaskList();
    }
    
    handleTaskResumed(data) {
        console.log('Task resumed:', data.taskId);
        this.loadState();
        this.updateTaskList();
    }
    
    handleTaskCancelled(data) {
        console.log('Task cancelled:', data.taskId);
        this.loadState();
        this.updateTaskList();
    }
    
    handleTaskError(data) {
        console.log('Task error:', data.taskId);
        this.loadState();
        this.updateTaskList();
    }
    
    handleViewActivate(data) {
        if (data.view === 'tasks') {
            this.loadState();
            this.updateTaskList();
        }
    }
    
    // Utility methods
    formatTaskType(type) {
        const types = {
            'chat_response': 'Chat Response',
            'voice_processing': 'Voice Processing',
            'file_analysis': 'File Analysis',
            'data_processing': 'Data Processing',
            'web_search': 'Web Search',
            'code_generation': 'Code Generation'
        };
        return types[type] || type;
    }
    
    formatDateTime(timestamp) {
        return new Date(timestamp).toLocaleString();
    }
    
    formatTime(milliseconds) {
        if (!milliseconds) return '0ms';
        
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
    
    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
    
    getStatusClass(status) {
        const classes = {
            'pending': 'status-pending',
            'queued': 'status-queued',
            'executing': 'status-executing',
            'paused': 'status-paused',
            'completed': 'status-completed',
            'failed': 'status-failed',
            'cancelled': 'status-cancelled'
        };
        return classes[status] || 'status-unknown';
    }
    
    getPriorityClass(priority) {
        const classes = {
            'high': 'priority-high',
            'normal': 'priority-normal',
            'low': 'priority-low'
        };
        return classes[priority] || 'priority-normal';
    }
    
    getMetabolicLoadClass(load) {
        if (typeof load === 'number') {
            if (load > 0.8) return 'metabolic-high';
            if (load > 0.5) return 'metabolic-medium';
            return 'metabolic-low';
        }
        
        const classes = {
            'low': 'metabolic-low',
            'medium': 'metabolic-medium',
            'high': 'metabolic-high'
        };
        return classes[load] || 'metabolic-low';
    }
    
    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        // Remove event listeners
        eventBus.off('ui:update-tasks', this.updateTasks.bind(this));
        eventBus.off('ui:update-current-task', this.updateCurrentTask.bind(this));
        eventBus.off('ui:update-metrics', this.updateMetrics.bind(this));
        
        this.initialized = false;
    }
}

export default TasksView;