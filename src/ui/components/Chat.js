/**
 * Agent Neo Chat Component
 * 
 * Handles chat-specific functionality and message processing
 */

import eventBus from '../../core/EventBus.js';
import stateManager from '../../core/StateManager.js';

class Chat {
    constructor() {
        this.name = 'Chat';
        this.version = '1.0.0';
        this.initialized = false;
        
        // Chat state
        this.messages = [];
        this.isTyping = false;
        this.currentSessionId = null;
        this.voiceMode = false;
        
        // Voice state
        this.isListening = false;
        this.interimTranscript = '';
        
        // Task state
        this.currentTask = null;
        this.taskProgress = 0;
        
        this.init();
    }

    init() {
        console.log('💬 Chat component loaded');
        this.initialized = true;
        
        // Subscribe to chat state changes
        stateManager.subscribe('chat.messages', this.onMessagesUpdate.bind(this));
        stateManager.subscribe('chat.isTyping', this.onTypingUpdate.bind(this));
        stateManager.subscribe('currentTask', this.onCurrentTaskUpdate.bind(this));
        stateManager.subscribe('currentSession', this.onSessionUpdate.bind(this));
        
        // Listen for chat-specific events
        eventBus.on('chat:clear', this.clearMessages.bind(this));
        eventBus.on('chat:export', this.exportMessages.bind(this));
        
        // Voice integration events
        eventBus.on('voice:listening-started', this.handleVoiceListening.bind(this));
        eventBus.on('voice:listening-stopped', this.handleVoiceListening.bind(this));
        eventBus.on('voice:interim-result', this.handleVoiceInterim.bind(this));
        eventBus.on('voice:recognition-ended', this.handleVoiceEnded.bind(this));
        eventBus.on('voice:error', this.handleVoiceError.bind(this));
        
        // Task integration events
        eventBus.on('task:progress', this.handleTaskProgress.bind(this));
        eventBus.on('task:completed', this.handleTaskCompleted.bind(this));
        eventBus.on('task:error', this.handleTaskError.bind(this));
        
        // UI events
        eventBus.on('ui:send-message', this.sendMessage.bind(this));
        eventBus.on('ui:toggle-voice', this.toggleVoice.bind(this));
        eventBus.on('ui:pause-task', this.pauseCurrentTask.bind(this));
        eventBus.on('ui:resume-task', this.resumeCurrentTask.bind(this));
    }

    onMessagesUpdate(messages) {
        this.messages = messages;
        this.updateChatUI();
    }

    onTypingUpdate(isTyping) {
        this.isTyping = isTyping;
        this.updateTypingIndicator();
    }

    onCurrentTaskUpdate(currentTask) {
        this.currentTask = currentTask;
        this.updateTaskControls();
    }

    onSessionUpdate(currentSession) {
        this.currentSessionId = currentSession?.id;
    }

    // Chat functionality
    sendMessage(data) {
        let message = data?.message;
        
        if (!message) {
            const chatInput = document.getElementById('chatInput');
            if (chatInput) {
                message = chatInput.value.trim();
                chatInput.value = '';
            }
        }
        
        if (!message) return;
        
        console.log('💬 Sending message:', message);
        
        // Add user message to UI
        this.addMessage({
            type: 'user',
            content: message,
            timestamp: Date.now()
        });
        
        // Send to task manager
        eventBus.emit('chat:message', {
            message: message,
            sessionId: this.currentSessionId,
            inputMethod: this.voiceMode ? 'voice' : 'text'
        });
        
        // Show typing indicator
        this.setTyping(true);
    }

    toggleVoice() {
        this.voiceMode = !this.voiceMode;
        console.log('🎤 Voice mode:', this.voiceMode);
        
        if (this.voiceMode) {
            eventBus.emit('ui:voice-button-clicked');
        } else {
            eventBus.emit('ui:voice-stop-clicked');
        }
        
        this.updateVoiceButton();
    }

    pauseCurrentTask() {
        if (this.currentTask) {
            eventBus.emit('task:pause', { taskId: this.currentTask.id });
        }
    }

    resumeCurrentTask() {
        if (this.currentTask) {
            eventBus.emit('task:resume', { taskId: this.currentTask.id });
        }
    }

    // Voice event handlers
    handleVoiceListening(data) {
        this.isListening = data !== null;
        this.updateVoiceButton();
    }

    handleVoiceInterim(data) {
        this.interimTranscript = data.transcript;
        this.updateVoiceInput();
    }

    handleVoiceEnded() {
        this.isListening = false;
        this.interimTranscript = '';
        this.updateVoiceButton();
        this.updateVoiceInput();
    }

    handleVoiceError(data) {
        console.error('Voice error:', data.error);
        this.isListening = false;
        this.voiceMode = false;
        this.updateVoiceButton();
        
        // Show error message
        this.addMessage({
            type: 'system',
            content: `Voice error: ${data.message}`,
            timestamp: Date.now()
        });
    }

    // Task event handlers
    handleTaskProgress(data) {
        this.taskProgress = data.progress;
        this.updateTaskProgress();
    }

    handleTaskCompleted(data) {
        this.taskProgress = 100;
        this.setTyping(false);
        
        // Add response to chat
        if (data.result) {
            this.addMessage({
                type: 'agent',
                content: data.result,
                timestamp: Date.now(),
                taskId: data.taskId
            });
        }
    }

    handleTaskError(data) {
        this.setTyping(false);
        
        // Add error message
        this.addMessage({
            type: 'system',
            content: `Task error: ${data.error}`,
            timestamp: Date.now()
        });
    }

    // UI update methods
    addMessage(message) {
        const messageWithId = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...message
        };
        
        const currentMessages = stateManager.getState('chat.messages', []);
        stateManager.setState('chat.messages', [...currentMessages, messageWithId]);
    }

    setTyping(isTyping) {
        stateManager.setState('chat.isTyping', isTyping);
    }

    updateChatUI() {
        // This would typically update the chat message display
        // In this case, the UIManager handles the visual updates
    }

    updateTypingIndicator() {
        const indicator = document.querySelector('.typing-indicator');
        if (indicator) {
            indicator.style.display = this.isTyping ? 'block' : 'none';
        }
    }

    updateVoiceButton() {
        const voiceBtn = document.getElementById('voiceBtn');
        if (voiceBtn) {
            const icon = voiceBtn.querySelector('.btn-icon');
            if (this.isListening) {
                icon.textContent = '🔴';
                voiceBtn.classList.add('listening');
            } else if (this.voiceMode) {
                icon.textContent = '🎤';
                voiceBtn.classList.add('voice-active');
            } else {
                icon.textContent = '🎤';
                voiceBtn.classList.remove('listening', 'voice-active');
            }
        }
    }

    updateVoiceInput() {
        const chatInput = document.getElementById('chatInput');
        if (chatInput && this.interimTranscript) {
            chatInput.value = this.interimTranscript;
            chatInput.style.fontStyle = 'italic';
        } else if (chatInput) {
            chatInput.style.fontStyle = 'normal';
        }
    }

    updateTaskControls() {
        const pauseBtn = document.getElementById('pauseTaskBtn');
        const resumeBtn = document.getElementById('resumeTaskBtn');
        
        if (pauseBtn && resumeBtn) {
            if (this.currentTask) {
                if (this.currentTask.status === 'executing') {
                    pauseBtn.disabled = false;
                    resumeBtn.disabled = true;
                } else if (this.currentTask.status === 'paused') {
                    pauseBtn.disabled = true;
                    resumeBtn.disabled = false;
                } else {
                    pauseBtn.disabled = true;
                    resumeBtn.disabled = true;
                }
            } else {
                pauseBtn.disabled = true;
                resumeBtn.disabled = true;
            }
        }
    }

    updateTaskProgress() {
        const progressBar = document.querySelector('.task-progress .progress-fill');
        if (progressBar) {
            progressBar.style.width = `${this.taskProgress}%`;
        }
    }

    clearMessages() {
        console.log('💬 Clearing chat messages...');
        stateManager.setState('chat.messages', []);
        
        // Add a system message about clearing
        const systemMessage = {
            id: `msg_${Date.now()}`,
            type: 'system',
            content: 'Chat history cleared.',
            timestamp: Date.now()
        };
        stateManager.setState('chat.messages', [systemMessage]);
    }

    exportMessages() {
        console.log('💬 Exporting chat messages...');
        const messages = stateManager.getState('chat.messages', []);
        
        const exportData = {
            export_date: new Date().toISOString(),
            message_count: messages.length,
            messages: messages
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `agent-neo-chat-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    destroy() {
        console.log('💬 Chat component destroyed');
    }
}

// Create instance and make available globally for debugging
const chat = new Chat();

if (typeof window !== 'undefined') {
    window.AgentNeoChat = chat;
}

export default chat;