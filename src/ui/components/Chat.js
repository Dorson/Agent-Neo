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
        
        this.init();
    }

    init() {
        console.log('💬 Chat component loaded');
        this.initialized = true;
        
        // Subscribe to chat state changes
        stateManager.subscribe('chat.messages', this.onMessagesUpdate.bind(this));
        stateManager.subscribe('chat.isTyping', this.onTypingUpdate.bind(this));
        
        // Listen for chat-specific events
        eventBus.on('chat:clear', this.clearMessages.bind(this));
        eventBus.on('chat:export', this.exportMessages.bind(this));
    }

    onMessagesUpdate(messages) {
        // Message updates are handled by UIManager
        // This could be extended for message processing logic
    }

    onTypingUpdate(isTyping) {
        // Typing indicator logic could be added here
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