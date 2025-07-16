/**
 * Session Context Module - Stateful Project-Based Interaction
 * 
 * Implements persistent session context as described in the whitepaper.
 * Features:
 * - Project-based interaction sessions
 * - Conversational context maintenance
 * - CRDT-based context synchronization
 * - Goal-oriented task management
 * - Context-aware planning
 * - Session history and artifacts
 * - Multi-session project tracking
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';

class SessionContextModule {
    constructor() {
        this.name = 'SessionContextModule';
        this.version = '1.0.0';
        this.initialized = false;
        this.active = false;
        
        // Session management
        this.activeSessions = new Map();
        this.sessionHistory = new Map();
        this.currentSessionId = null;
        
        // Context state
        this.contextGraphs = new Map(); // sessionId -> context graph
        this.artifacts = new Map(); // sessionId -> artifacts map
        this.conversationHistory = new Map(); // sessionId -> messages
        
        // Project management
        this.projects = new Map();
        this.projectGoals = new Map();
        this.projectMilestones = new Map();
        
        // Context synchronization (CRDT)
        this.contextCRDT = new Map();
        this.pendingUpdates = new Map();
        this.lastSyncTimestamp = new Map();
        
        // Configuration
        this.config = {
            maxSessionDuration: 24 * 60 * 60 * 1000, // 24 hours
            maxConversationHistory: 1000,
            contextRetentionDays: 30,
            autoSaveInterval: 60000, // 1 minute
            maxArtifactsPerSession: 100,
            contextCompressionThreshold: 500
        };
        
        // Context types
        this.contextTypes = new Set([
            'goal', 'constraint', 'preference', 'artifact', 'milestone',
            'conversation', 'decision', 'learning', 'dependency'
        ]);
        
        // Session states
        this.sessionStates = new Set([
            'initializing', 'active', 'paused', 'completed', 'archived'
        ]);
        
        this.init();
    }
    
    async init() {
        try {
            console.log('🎯 Initializing Session Context Module...');
            
            this.setupEventListeners();
            this.loadPersistedSessions();
            this.startContextMaintenance();
            
            this.initialized = true;
            console.log('✅ Session Context Module initialized');
            
            eventBus.emit('module:initialized', {
                name: this.name,
                version: this.version,
                capabilities: this.getCapabilities()
            });
            
        } catch (error) {
            console.error('❌ Session Context Module initialization failed:', error);
            throw error;
        }
    }
    
    setupEventListeners() {
        // Session lifecycle events
        eventBus.on('session:create', this.createSession.bind(this));
        eventBus.on('session:activate', this.activateSession.bind(this));
        eventBus.on('session:pause', this.pauseSession.bind(this));
        eventBus.on('session:resume', this.resumeSession.bind(this));
        eventBus.on('session:complete', this.completeSession.bind(this));
        eventBus.on('session:archive', this.archiveSession.bind(this));
        
        // Context management events
        eventBus.on('context:add', this.addContext.bind(this));
        eventBus.on('context:update', this.updateContext.bind(this));
        eventBus.on('context:remove', this.removeContext.bind(this));
        eventBus.on('context:query', this.queryContext.bind(this));
        
        // Conversation events
        eventBus.on('conversation:add-message', this.addMessage.bind(this));
        eventBus.on('conversation:get-history', this.getConversationHistory.bind(this));
        
        // Project management events
        eventBus.on('project:set-goal', this.setProjectGoal.bind(this));
        eventBus.on('project:add-milestone', this.addMilestone.bind(this));
        eventBus.on('project:update-progress', this.updateProgress.bind(this));
        
        // Artifact management events
        eventBus.on('artifact:create', this.createArtifact.bind(this));
        eventBus.on('artifact:update', this.updateArtifact.bind(this));
        eventBus.on('artifact:link', this.linkArtifact.bind(this));
        
        // Task planning integration
        eventBus.on('task:plan-request', this.enhanceTaskWithContext.bind(this));
        eventBus.on('task:completed', this.integrateTaskResult.bind(this));
        
        // Context synchronization
        eventBus.on('network:context-update', this.handleContextUpdate.bind(this));
        eventBus.on('session:sync', this.syncSession.bind(this));
    }
    
    /**
     * Create a new session with optional project goal
     */
    async createSession(sessionData) {
        try {
            const sessionId = this.generateSessionId();
            const session = {
                id: sessionId,
                title: sessionData.title || 'New Session',
                description: sessionData.description || '',
                projectGoal: sessionData.projectGoal || null,
                userId: sessionData.userId,
                createdAt: Date.now(),
                lastActiveAt: Date.now(),
                state: 'initializing',
                tags: sessionData.tags || [],
                priority: sessionData.priority || 'normal',
                estimatedDuration: sessionData.estimatedDuration || null,
                actualDuration: 0,
                messageCount: 0,
                artifactCount: 0,
                contextSize: 0
            };
            
            // Initialize session data structures
            this.activeSessions.set(sessionId, session);
            this.contextGraphs.set(sessionId, new Map());
            this.artifacts.set(sessionId, new Map());
            this.conversationHistory.set(sessionId, []);
            this.contextCRDT.set(sessionId, this.createContextCRDT());
            
            // Set project goal if provided
            if (session.projectGoal) {
                await this.setProjectGoal({
                    sessionId,
                    goal: session.projectGoal,
                    priority: 'high'
                });
            }
            
            // Add initial context
            await this.addContext({
                sessionId,
                type: 'goal',
                content: session.projectGoal || 'General assistance',
                metadata: { source: 'user', timestamp: Date.now() }
            });
            
            // Update UI
            stateManager.setState(`sessions.${sessionId}`, session);
            stateManager.setState('session.current', sessionId);
            
            console.log(`🎯 Session created: ${sessionId} - "${session.title}"`);
            return sessionId;
            
        } catch (error) {
            console.error('Error creating session:', error);
            throw error;
        }
    }
    
    /**
     * Activate a session (set as current)
     */
    async activateSession(data) {
        try {
            const { sessionId } = data;
            const session = this.activeSessions.get(sessionId);
            
            if (!session) {
                throw new Error('Session not found');
            }
            
            // Pause current session if any
            if (this.currentSessionId && this.currentSessionId !== sessionId) {
                await this.pauseSession({ sessionId: this.currentSessionId });
            }
            
            // Activate new session
            this.currentSessionId = sessionId;
            session.state = 'active';
            session.lastActiveAt = Date.now();
            
            // Load context into working memory
            await this.loadSessionContext(sessionId);
            
            // Update UI
            stateManager.setState('session.current', sessionId);
            stateManager.setState(`sessions.${sessionId}.state`, 'active');
            
            // Emit activation event
            eventBus.emit('session:activated', {
                sessionId,
                context: this.getSessionSummary(sessionId)
            });
            
            console.log(`🎯 Session activated: ${sessionId}`);
            
        } catch (error) {
            console.error('Error activating session:', error);
        }
    }
    
    /**
     * Add context to the current session
     */
    async addContext(contextData) {
        try {
            const { sessionId, type, content, metadata = {} } = contextData;
            const sessionToUse = sessionId || this.currentSessionId;
            
            if (!sessionToUse) {
                throw new Error('No active session');
            }
            
            const contextId = this.generateContextId();
            const context = {
                id: contextId,
                type,
                content,
                metadata: {
                    ...metadata,
                    createdAt: Date.now(),
                    source: metadata.source || 'system'
                },
                weight: metadata.weight || 1.0,
                expiry: metadata.expiry || null,
                relationships: new Set()
            };
            
            // Add to context graph
            const contextGraph = this.contextGraphs.get(sessionToUse);
            contextGraph.set(contextId, context);
            
            // Update CRDT
            this.updateContextCRDT(sessionToUse, 'add', context);
            
            // Update session metadata
            const session = this.activeSessions.get(sessionToUse);
            session.contextSize = contextGraph.size;
            session.lastActiveAt = Date.now();
            
            // Check for compression if needed
            if (contextGraph.size > this.config.contextCompressionThreshold) {
                await this.compressContext(sessionToUse);
            }
            
            console.log(`📝 Context added to session ${sessionToUse}: ${type} - ${content.substring(0, 50)}...`);
            
            return contextId;
            
        } catch (error) {
            console.error('Error adding context:', error);
            throw error;
        }
    }
    
    /**
     * Add a message to conversation history
     */
    async addMessage(messageData) {
        try {
            const { sessionId, role, content, metadata = {} } = messageData;
            const sessionToUse = sessionId || this.currentSessionId;
            
            if (!sessionToUse) {
                throw new Error('No active session');
            }
            
            const message = {
                id: this.generateMessageId(),
                role, // 'user', 'assistant', 'system'
                content,
                timestamp: Date.now(),
                metadata
            };
            
            // Add to conversation history
            const history = this.conversationHistory.get(sessionToUse);
            history.push(message);
            
            // Maintain history size limit
            if (history.length > this.config.maxConversationHistory) {
                history.splice(0, history.length - this.config.maxConversationHistory);
            }
            
            // Add as context if significant
            if (this.isSignificantMessage(message)) {
                await this.addContext({
                    sessionId: sessionToUse,
                    type: 'conversation',
                    content: `${role}: ${content}`,
                    metadata: { messageId: message.id, timestamp: message.timestamp }
                });
            }
            
            // Update session
            const session = this.activeSessions.get(sessionToUse);
            session.messageCount = history.length;
            session.lastActiveAt = Date.now();
            
            console.log(`💬 Message added to session ${sessionToUse}: ${role}`);
            
            return message.id;
            
        } catch (error) {
            console.error('Error adding message:', error);
            throw error;
        }
    }
    
    /**
     * Set or update project goal
     */
    async setProjectGoal(goalData) {
        try {
            const { sessionId, goal, priority = 'normal', deadline = null } = goalData;
            const sessionToUse = sessionId || this.currentSessionId;
            
            if (!sessionToUse) {
                throw new Error('No active session');
            }
            
            const projectGoal = {
                goal,
                priority,
                deadline,
                createdAt: Date.now(),
                progress: 0,
                milestones: [],
                subgoals: []
            };
            
            this.projectGoals.set(sessionToUse, projectGoal);
            
            // Add as high-priority context
            await this.addContext({
                sessionId: sessionToUse,
                type: 'goal',
                content: goal,
                metadata: { 
                    priority, 
                    deadline, 
                    weight: 10.0,
                    source: 'user'
                }
            });
            
            // Update session
            const session = this.activeSessions.get(sessionToUse);
            session.projectGoal = goal;
            
            // Update UI
            stateManager.setState(`sessions.${sessionToUse}.projectGoal`, goal);
            stateManager.setState('session.currentGoal', goal);
            
            console.log(`🎯 Project goal set for session ${sessionToUse}: ${goal}`);
            
        } catch (error) {
            console.error('Error setting project goal:', error);
        }
    }
    
    /**
     * Create an artifact (file, data, result)
     */
    async createArtifact(artifactData) {
        try {
            const { sessionId, name, type, content, metadata = {} } = artifactData;
            const sessionToUse = sessionId || this.currentSessionId;
            
            if (!sessionToUse) {
                throw new Error('No active session');
            }
            
            const artifactId = this.generateArtifactId();
            const artifact = {
                id: artifactId,
                name,
                type, // 'file', 'data', 'result', 'code', 'document'
                content,
                metadata: {
                    ...metadata,
                    createdAt: Date.now(),
                    size: this.calculateContentSize(content)
                },
                version: 1,
                linkedTasks: new Set(),
                linkedContexts: new Set()
            };
            
            // Add to artifacts
            const artifacts = this.artifacts.get(sessionToUse);
            artifacts.set(artifactId, artifact);
            
            // Add as context
            await this.addContext({
                sessionId: sessionToUse,
                type: 'artifact',
                content: `Created artifact: ${name} (${type})`,
                metadata: { 
                    artifactId, 
                    artifactType: type,
                    source: 'system'
                }
            });
            
            // Update session
            const session = this.activeSessions.get(sessionToUse);
            session.artifactCount = artifacts.size;
            
            console.log(`📎 Artifact created in session ${sessionToUse}: ${name}`);
            
            return artifactId;
            
        } catch (error) {
            console.error('Error creating artifact:', error);
            throw error;
        }
    }
    
    /**
     * Enhance task planning with session context
     */
    async enhanceTaskWithContext(taskData) {
        try {
            const { taskId, plan, sessionId } = taskData;
            const sessionToUse = sessionId || this.currentSessionId;
            
            if (!sessionToUse) {
                return taskData; // No context enhancement
            }
            
            // Get relevant context
            const relevantContext = await this.getRelevantContext(sessionToUse, plan);
            
            // Get conversation history
            const recentHistory = this.getRecentHistory(sessionToUse, 10);
            
            // Get project goal
            const projectGoal = this.projectGoals.get(sessionToUse);
            
            // Get related artifacts
            const relatedArtifacts = this.getRelatedArtifacts(sessionToUse, plan);
            
            // Enhanced task data
            const enhancedTask = {
                ...taskData,
                context: {
                    sessionId: sessionToUse,
                    projectGoal: projectGoal?.goal || null,
                    relevantContext: Array.from(relevantContext.values()),
                    recentHistory,
                    relatedArtifacts: Array.from(relatedArtifacts.values()),
                    sessionSummary: this.getSessionSummary(sessionToUse)
                }
            };
            
            console.log(`🔗 Task enhanced with context from session ${sessionToUse}`);
            
            // Emit enhanced task
            eventBus.emit('task:context-enhanced', enhancedTask);
            
            return enhancedTask;
            
        } catch (error) {
            console.error('Error enhancing task with context:', error);
            return taskData;
        }
    }
    
    /**
     * Integrate completed task results into session context
     */
    async integrateTaskResult(resultData) {
        try {
            const { taskId, result, success, sessionId } = resultData;
            const sessionToUse = sessionId || this.currentSessionId;
            
            if (!sessionToUse) {
                return; // No session to integrate with
            }
            
            // Add result as context
            await this.addContext({
                sessionId: sessionToUse,
                type: 'decision',
                content: `Task ${taskId} ${success ? 'completed' : 'failed'}: ${result}`,
                metadata: { 
                    taskId, 
                    success, 
                    timestamp: Date.now(),
                    source: 'task-result'
                }
            });
            
            // Create artifact if result contains valuable data
            if (success && this.isValueableResult(result)) {
                await this.createArtifact({
                    sessionId: sessionToUse,
                    name: `Task ${taskId} Result`,
                    type: 'result',
                    content: result,
                    metadata: { taskId, timestamp: Date.now() }
                });
            }
            
            // Update project progress if applicable
            await this.updateProjectProgress(sessionToUse, taskId, success);
            
            console.log(`🔄 Task result integrated into session ${sessionToUse}`);
            
        } catch (error) {
            console.error('Error integrating task result:', error);
        }
    }
    
    /**
     * Get relevant context for a query or plan
     */
    async getRelevantContext(sessionId, query) {
        try {
            const contextGraph = this.contextGraphs.get(sessionId);
            if (!contextGraph) {
                return new Map();
            }
            
            const relevantContext = new Map();
            const queryLower = query.toLowerCase();
            
            // Simple relevance scoring (can be enhanced with embeddings)
            contextGraph.forEach((context, id) => {
                const contentLower = context.content.toLowerCase();
                let score = 0;
                
                // Keyword matching
                const queryWords = queryLower.split(' ');
                queryWords.forEach(word => {
                    if (contentLower.includes(word)) {
                        score += context.weight;
                    }
                });
                
                // Type-based scoring
                if (context.type === 'goal') score += 5;
                if (context.type === 'constraint') score += 3;
                if (context.type === 'artifact') score += 2;
                
                // Recency scoring
                const age = Date.now() - context.metadata.createdAt;
                const recencyBonus = Math.max(0, 5 - (age / (1000 * 60 * 60))); // Decay over hours
                score += recencyBonus;
                
                if (score > 1) {
                    relevantContext.set(id, { ...context, relevanceScore: score });
                }
            });
            
            // Sort by relevance and return top 10
            const sorted = Array.from(relevantContext.entries())
                .sort(([,a], [,b]) => b.relevanceScore - a.relevanceScore)
                .slice(0, 10);
            
            return new Map(sorted);
            
        } catch (error) {
            console.error('Error getting relevant context:', error);
            return new Map();
        }
    }
    
    /**
     * Compress context when threshold exceeded
     */
    async compressContext(sessionId) {
        try {
            const contextGraph = this.contextGraphs.get(sessionId);
            const now = Date.now();
            
            // Remove expired context
            contextGraph.forEach((context, id) => {
                if (context.expiry && now > context.expiry) {
                    contextGraph.delete(id);
                }
            });
            
            // Archive low-weight, old context
            const cutoffTime = now - (7 * 24 * 60 * 60 * 1000); // 7 days
            contextGraph.forEach((context, id) => {
                if (context.weight < 0.5 && context.metadata.createdAt < cutoffTime) {
                    contextGraph.delete(id);
                }
            });
            
            console.log(`🗜️ Context compressed for session ${sessionId}`);
            
        } catch (error) {
            console.error('Error compressing context:', error);
        }
    }
    
    /**
     * Get session summary for context
     */
    getSessionSummary(sessionId) {
        const session = this.activeSessions.get(sessionId);
        const projectGoal = this.projectGoals.get(sessionId);
        const contextGraph = this.contextGraphs.get(sessionId);
        const artifacts = this.artifacts.get(sessionId);
        
        return {
            sessionId,
            title: session?.title,
            projectGoal: projectGoal?.goal,
            messageCount: session?.messageCount || 0,
            artifactCount: session?.artifactCount || 0,
            contextSize: contextGraph?.size || 0,
            duration: session ? Date.now() - session.createdAt : 0,
            state: session?.state
        };
    }
    
    /**
     * Utility methods
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    generateContextId() {
        return 'ctx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    generateMessageId() {
        return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    generateArtifactId() {
        return 'art_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    isSignificantMessage(message) {
        return message.content.length > 20 && 
               !message.content.startsWith('/') && // Not a command
               message.role !== 'system';
    }
    
    isValueableResult(result) {
        return typeof result === 'object' || 
               (typeof result === 'string' && result.length > 100);
    }
    
    calculateContentSize(content) {
        return JSON.stringify(content).length;
    }
    
    createContextCRDT() {
        return {
            updates: new Map(),
            lastUpdate: Date.now(),
            version: 1
        };
    }
    
    updateContextCRDT(sessionId, operation, data) {
        const crdt = this.contextCRDT.get(sessionId);
        const updateId = Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        
        crdt.updates.set(updateId, {
            operation,
            data,
            timestamp: Date.now()
        });
        
        crdt.lastUpdate = Date.now();
        crdt.version++;
    }
    
    getCapabilities() {
        return [
            'session-management',
            'context-tracking',
            'conversation-history',
            'project-goals',
            'artifact-management',
            'context-enhancement',
            'stateful-interaction'
        ];
    }
    
    async start() {
        this.active = true;
        console.log('🎯 Session Context Module started');
    }
    
    async stop() {
        this.active = false;
        console.log('🎯 Session Context Module stopped');
    }
    
    getStatus() {
        return {
            name: this.name,
            active: this.active,
            activeSessions: this.activeSessions.size,
            currentSession: this.currentSessionId,
            totalContexts: Array.from(this.contextGraphs.values())
                .reduce((sum, graph) => sum + graph.size, 0),
            totalArtifacts: Array.from(this.artifacts.values())
                .reduce((sum, artifacts) => sum + artifacts.size, 0)
        };
    }
}

export default SessionContextModule;