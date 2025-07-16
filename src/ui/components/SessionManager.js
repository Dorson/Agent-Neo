/**
 * Session Manager UI Component
 * 
 * Provides UI for managing sessions, project goals, and context
 * as described in the whitepaper's session context requirements.
 * Features:
 * - Create and manage sessions
 * - Set and update project goals
 * - View session context and artifacts
 * - Session history and switching
 * - Goal tracking and progress
 */

import eventBus from '../../core/EventBus.js';
import stateManager from '../../core/StateManager.js';

class SessionManager {
    constructor() {
        this.name = 'SessionManager';
        this.version = '1.0.0';
        this.initialized = false;
        
        // UI elements
        this.container = null;
        this.currentSessionDisplay = null;
        this.goalDisplay = null;
        this.sessionList = null;
        this.contextDisplay = null;
        
        // State
        this.currentSessionId = null;
        this.sessions = new Map();
        this.currentGoal = null;
        
        this.init();
    }
    
    async init() {
        try {
            console.log('🎯 Initializing Session Manager UI...');
            
            this.setupEventListeners();
            this.createUI();
            this.loadPersistedSessions();
            
            this.initialized = true;
            console.log('✅ Session Manager UI initialized');
            
        } catch (error) {
            console.error('❌ Session Manager UI initialization failed:', error);
        }
    }
    
    setupEventListeners() {
        // Session events
        eventBus.on('session:activated', this.updateCurrentSession.bind(this));
        eventBus.on('session:created', this.addSessionToList.bind(this));
        eventBus.on('session:updated', this.updateSessionDisplay.bind(this));
        
        // Context events
        eventBus.on('context:added', this.updateContextDisplay.bind(this));
        eventBus.on('project:goal-set', this.updateGoalDisplay.bind(this));
        
        // State changes
        stateManager.subscribe('session.current', this.handleSessionChange.bind(this));
        stateManager.subscribe('session.currentGoal', this.handleGoalChange.bind(this));
    }
    
    createUI() {
        // Create main container
        this.container = document.createElement('div');
        this.container.className = 'session-manager';
        this.container.innerHTML = this.getHTML();
        
        // Get references to UI elements
        this.currentSessionDisplay = this.container.querySelector('.current-session');
        this.goalDisplay = this.container.querySelector('.current-goal');
        this.sessionList = this.container.querySelector('.session-list');
        this.contextDisplay = this.container.querySelector('.context-display');
        
        // Set up event handlers
        this.setupUIEventHandlers();
        
        // Add to page
        const sessionContainer = document.getElementById('sessionManager');
        if (sessionContainer) {
            sessionContainer.appendChild(this.container);
        }
    }
    
    setupUIEventHandlers() {
        // New session button
        const newSessionBtn = this.container.querySelector('.new-session-btn');
        newSessionBtn?.addEventListener('click', this.showNewSessionDialog.bind(this));
        
        // Set goal button
        const setGoalBtn = this.container.querySelector('.set-goal-btn');
        setGoalBtn?.addEventListener('click', this.showSetGoalDialog.bind(this));
        
        // Reset goal button
        const resetGoalBtn = this.container.querySelector('.reset-goal-btn');
        resetGoalBtn?.addEventListener('click', this.resetGoal.bind(this));
        
        // Session list clicks
        this.sessionList?.addEventListener('click', this.handleSessionListClick.bind(this));
    }
    
    getHTML() {
        return `
            <div class="session-manager__header">
                <h3>Session Manager</h3>
                <button class="btn btn--small new-session-btn">New Session</button>
            </div>
            
            <div class="session-manager__current">
                <div class="current-session">
                    <div class="current-session__info">
                        <strong>Current Session:</strong>
                        <span class="session-title">No active session</span>
                    </div>
                    <div class="current-session__meta">
                        <span class="session-duration">0m</span>
                        <span class="session-messages">0 messages</span>
                        <span class="session-artifacts">0 artifacts</span>
                    </div>
                </div>
                
                <div class="current-goal">
                    <div class="goal-header">
                        <strong>Project Goal:</strong>
                        <button class="btn btn--small set-goal-btn">Set Goal</button>
                        <button class="btn btn--small btn--secondary reset-goal-btn" style="display: none;">Reset</button>
                    </div>
                    <div class="goal-content">
                        <p class="goal-text">No goal set</p>
                        <div class="goal-progress" style="display: none;">
                            <div class="progress-bar">
                                <div class="progress-fill"></div>
                            </div>
                            <span class="progress-text">0%</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="session-manager__sessions">
                <h4>Recent Sessions</h4>
                <div class="session-list">
                    <!-- Sessions will be populated here -->
                </div>
            </div>
            
            <div class="session-manager__context">
                <h4>Session Context</h4>
                <div class="context-display">
                    <p class="context-empty">No active session context</p>
                </div>
            </div>
            
            <!-- New Session Dialog -->
            <div class="modal new-session-modal" style="display: none;">
                <div class="modal__content">
                    <div class="modal__header">
                        <h3>Create New Session</h3>
                        <button class="modal__close">&times;</button>
                    </div>
                    <div class="modal__body">
                        <form class="new-session-form">
                            <div class="form-group">
                                <label for="session-title">Session Title:</label>
                                <input type="text" id="session-title" name="title" required>
                            </div>
                            <div class="form-group">
                                <label for="session-description">Description:</label>
                                <textarea id="session-description" name="description" rows="3"></textarea>
                            </div>
                            <div class="form-group">
                                <label for="project-goal">Project Goal (optional):</label>
                                <textarea id="project-goal" name="projectGoal" rows="2" 
                                    placeholder="What would you like to accomplish in this session?"></textarea>
                            </div>
                            <div class="form-group">
                                <label for="session-priority">Priority:</label>
                                <select id="session-priority" name="priority">
                                    <option value="low">Low</option>
                                    <option value="normal" selected>Normal</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="modal__footer">
                        <button class="btn btn--secondary cancel-session-btn">Cancel</button>
                        <button class="btn create-session-btn">Create Session</button>
                    </div>
                </div>
            </div>
            
            <!-- Set Goal Dialog -->
            <div class="modal set-goal-modal" style="display: none;">
                <div class="modal__content">
                    <div class="modal__header">
                        <h3>Set Project Goal</h3>
                        <button class="modal__close">&times;</button>
                    </div>
                    <div class="modal__body">
                        <form class="set-goal-form">
                            <div class="form-group">
                                <label for="goal-text">Goal Description:</label>
                                <textarea id="goal-text" name="goal" rows="3" required
                                    placeholder="Describe what you want to accomplish..."></textarea>
                            </div>
                            <div class="form-group">
                                <label for="goal-priority">Priority:</label>
                                <select id="goal-priority" name="priority">
                                    <option value="low">Low</option>
                                    <option value="normal">Normal</option>
                                    <option value="high" selected>High</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="goal-deadline">Deadline (optional):</label>
                                <input type="datetime-local" id="goal-deadline" name="deadline">
                            </div>
                        </form>
                    </div>
                    <div class="modal__footer">
                        <button class="btn btn--secondary cancel-goal-btn">Cancel</button>
                        <button class="btn set-goal-confirm-btn">Set Goal</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Show new session creation dialog
     */
    showNewSessionDialog() {
        const modal = this.container.querySelector('.new-session-modal');
        modal.style.display = 'flex';
        
        // Focus title input
        const titleInput = modal.querySelector('#session-title');
        setTimeout(() => titleInput?.focus(), 100);
        
        // Set up form handlers
        const form = modal.querySelector('.new-session-form');
        const createBtn = modal.querySelector('.create-session-btn');
        const cancelBtn = modal.querySelector('.cancel-session-btn');
        const closeBtn = modal.querySelector('.modal__close');
        
        const createSession = () => {
            const formData = new FormData(form);
            const sessionData = {
                title: formData.get('title'),
                description: formData.get('description'),
                projectGoal: formData.get('projectGoal'),
                priority: formData.get('priority'),
                userId: 'local-user' // In real implementation, would get from auth
            };
            
            eventBus.emit('session:create', sessionData);
            this.hideNewSessionDialog();
        };
        
        const hideDialog = () => this.hideNewSessionDialog();
        
        createBtn.addEventListener('click', createSession);
        cancelBtn.addEventListener('click', hideDialog);
        closeBtn.addEventListener('click', hideDialog);
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            createSession();
        });
    }
    
    hideNewSessionDialog() {
        const modal = this.container.querySelector('.new-session-modal');
        modal.style.display = 'none';
        
        // Reset form
        const form = modal.querySelector('.new-session-form');
        form.reset();
    }
    
    /**
     * Show set goal dialog
     */
    showSetGoalDialog() {
        const modal = this.container.querySelector('.set-goal-modal');
        modal.style.display = 'flex';
        
        // Focus goal input
        const goalInput = modal.querySelector('#goal-text');
        setTimeout(() => goalInput?.focus(), 100);
        
        // Pre-fill if there's an existing goal
        if (this.currentGoal) {
            goalInput.value = this.currentGoal;
        }
        
        // Set up form handlers
        const form = modal.querySelector('.set-goal-form');
        const setBtn = modal.querySelector('.set-goal-confirm-btn');
        const cancelBtn = modal.querySelector('.cancel-goal-btn');
        const closeBtn = modal.querySelector('.modal__close');
        
        const setGoal = () => {
            const formData = new FormData(form);
            const goalData = {
                goal: formData.get('goal'),
                priority: formData.get('priority'),
                deadline: formData.get('deadline') || null,
                sessionId: this.currentSessionId
            };
            
            eventBus.emit('project:set-goal', goalData);
            this.hideSetGoalDialog();
        };
        
        const hideDialog = () => this.hideSetGoalDialog();
        
        setBtn.addEventListener('click', setGoal);
        cancelBtn.addEventListener('click', hideDialog);
        closeBtn.addEventListener('click', hideDialog);
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            setGoal();
        });
    }
    
    hideSetGoalDialog() {
        const modal = this.container.querySelector('.set-goal-modal');
        modal.style.display = 'none';
        
        // Reset form
        const form = modal.querySelector('.set-goal-form');
        form.reset();
    }
    
    /**
     * Reset project goal
     */
    resetGoal() {
        if (confirm('Are you sure you want to reset the project goal?')) {
            eventBus.emit('project:set-goal', {
                goal: null,
                sessionId: this.currentSessionId
            });
        }
    }
    
    /**
     * Handle session list clicks
     */
    handleSessionListClick(event) {
        const sessionItem = event.target.closest('.session-item');
        if (!sessionItem) return;
        
        const sessionId = sessionItem.dataset.sessionId;
        const action = event.target.dataset.action;
        
        if (action === 'activate') {
            eventBus.emit('session:activate', { sessionId });
        } else if (action === 'archive') {
            if (confirm('Archive this session?')) {
                eventBus.emit('session:archive', { sessionId });
            }
        }
    }
    
    /**
     * Update current session display
     */
    updateCurrentSession(sessionData) {
        const { sessionId, context } = sessionData;
        this.currentSessionId = sessionId;
        
        const titleElement = this.currentSessionDisplay.querySelector('.session-title');
        const durationElement = this.currentSessionDisplay.querySelector('.session-duration');
        const messagesElement = this.currentSessionDisplay.querySelector('.session-messages');
        const artifactsElement = this.currentSessionDisplay.querySelector('.session-artifacts');
        
        titleElement.textContent = context.title || sessionId;
        durationElement.textContent = this.formatDuration(context.duration);
        messagesElement.textContent = `${context.messageCount} messages`;
        artifactsElement.textContent = `${context.artifactCount} artifacts`;
        
        // Update context display
        this.updateContextDisplay(context);
    }
    
    /**
     * Update goal display
     */
    updateGoalDisplay(goalData) {
        const { goal } = goalData;
        this.currentGoal = goal;
        
        const goalText = this.goalDisplay.querySelector('.goal-text');
        const resetBtn = this.goalDisplay.querySelector('.reset-goal-btn');
        const progressDiv = this.goalDisplay.querySelector('.goal-progress');
        
        if (goal) {
            goalText.textContent = goal;
            resetBtn.style.display = 'inline-block';
            progressDiv.style.display = 'block';
        } else {
            goalText.textContent = 'No goal set';
            resetBtn.style.display = 'none';
            progressDiv.style.display = 'none';
        }
    }
    
    /**
     * Update context display
     */
    updateContextDisplay(context) {
        if (!context) {
            this.contextDisplay.innerHTML = '<p class="context-empty">No active session context</p>';
            return;
        }
        
        this.contextDisplay.innerHTML = `
            <div class="context-summary">
                <div class="context-stat">
                    <strong>Context Size:</strong> ${context.contextSize || 0} items
                </div>
                <div class="context-stat">
                    <strong>Session State:</strong> ${context.state || 'unknown'}
                </div>
                <div class="context-stat">
                    <strong>Duration:</strong> ${this.formatDuration(context.duration || 0)}
                </div>
            </div>
            <div class="context-actions">
                <button class="btn btn--small" onclick="eventBus.emit('session:export-context')">
                    Export Context
                </button>
                <button class="btn btn--small btn--secondary" onclick="eventBus.emit('session:clear-context')">
                    Clear Context
                </button>
            </div>
        `;
    }
    
    /**
     * Add session to list
     */
    addSessionToList(sessionData) {
        const sessionItem = document.createElement('div');
        sessionItem.className = 'session-item';
        sessionItem.dataset.sessionId = sessionData.id;
        
        sessionItem.innerHTML = `
            <div class="session-item__info">
                <div class="session-item__title">${sessionData.title}</div>
                <div class="session-item__meta">
                    <span class="session-date">${this.formatDate(sessionData.createdAt)}</span>
                    <span class="session-messages">${sessionData.messageCount || 0} msgs</span>
                </div>
            </div>
            <div class="session-item__actions">
                <button class="btn btn--small" data-action="activate">Activate</button>
                <button class="btn btn--small btn--secondary" data-action="archive">Archive</button>
            </div>
        `;
        
        this.sessionList.appendChild(sessionItem);
        this.sessions.set(sessionData.id, sessionData);
    }
    
    /**
     * Handle session state changes
     */
    handleSessionChange(sessionId) {
        this.currentSessionId = sessionId;
        
        // Update active session highlighting
        this.sessionList.querySelectorAll('.session-item').forEach(item => {
            item.classList.toggle('session-item--active', item.dataset.sessionId === sessionId);
        });
    }
    
    /**
     * Handle goal state changes
     */
    handleGoalChange(goal) {
        this.updateGoalDisplay({ goal });
    }
    
    /**
     * Utility methods
     */
    formatDuration(ms) {
        const minutes = Math.floor(ms / 60000);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else {
            return `${minutes}m`;
        }
    }
    
    formatDate(timestamp) {
        return new Date(timestamp).toLocaleDateString();
    }
    
    loadPersistedSessions() {
        // Load sessions from state manager or local storage
        const sessions = stateManager.getState('sessions', {});
        Object.values(sessions).forEach(session => {
            this.addSessionToList(session);
        });
        
        // Load current session if any
        const currentSessionId = stateManager.getState('session.current');
        if (currentSessionId) {
            this.handleSessionChange(currentSessionId);
        }
        
        // Load current goal if any
        const currentGoal = stateManager.getState('session.currentGoal');
        if (currentGoal) {
            this.handleGoalChange(currentGoal);
        }
    }
    
    getStatus() {
        return {
            name: this.name,
            initialized: this.initialized,
            currentSession: this.currentSessionId,
            sessionsCount: this.sessions.size,
            hasGoal: !!this.currentGoal
        };
    }
}

export default SessionManager;