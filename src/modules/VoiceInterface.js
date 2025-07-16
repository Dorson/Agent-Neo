/**
 * Voice Interface Module - Web Speech API Integration
 * 
 * Implements voice input and output capabilities using the Web Speech API
 * as described in the whitepaper. Features:
 * - Speech recognition for voice input
 * - Text-to-speech for voice output
 * - Voice command processing
 * - Audio level monitoring
 * - Language detection and support
 * - Noise cancellation
 * - Context-aware voice responses
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';

class VoiceInterface {
    constructor() {
        this.name = 'VoiceInterface';
        this.version = '1.0.0';
        this.initialized = false;
        this.active = false;
        
        // Speech recognition
        this.recognition = null;
        this.isListening = false;
        this.isProcessing = false;
        this.interimResults = '';
        this.finalResults = '';
        
        // Text-to-speech
        this.synthesis = null;
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.voiceQueue = [];
        
        // Audio context for level monitoring
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.audioLevel = 0;
        
        // Configuration
        this.config = {
            language: 'en-US',
            continuous: false,
            interimResults: true,
            maxAlternatives: 1,
            voiceVolume: 1.0,
            voiceRate: 1.0,
            voicePitch: 1.0,
            preferredVoice: null,
            noiseThreshold: 0.01,
            silenceTimeout: 3000,
            autoStart: false
        };
        
        // Voice commands
        this.commands = new Map();
        this.setupBuiltinCommands();
        
        // Session context
        this.currentSessionId = null;
        this.conversationHistory = [];
        
        // State tracking
        this.lastActivity = Date.now();
        this.sessionStats = {
            totalUtterances: 0,
            successfulRecognitions: 0,
            failedRecognitions: 0,
            averageConfidence: 0,
            totalSpeechTime: 0
        };
        
        this.init();
    }
    
    async init() {
        try {
            console.log('🎤 Initializing Voice Interface...');
            
            // Check for Web Speech API support
            if (!this.checkWebSpeechSupport()) {
                console.warn('⚠️ Web Speech API not fully supported');
                return;
            }
            
            this.setupEventListeners();
            this.initializeSpeechRecognition();
            this.initializeSpeechSynthesis();
            this.loadConfiguration();
            
            // Initialize audio context for level monitoring
            await this.initializeAudioContext();
            
            this.initialized = true;
            console.log('✅ Voice Interface initialized');
            
            eventBus.emit('module:initialized', {
                name: this.name,
                version: this.version,
                capabilities: ['speech_recognition', 'text_to_speech', 'voice_commands']
            });
            
        } catch (error) {
            console.error('❌ Voice Interface initialization failed:', error);
            throw error;
        }
    }
    
    checkWebSpeechSupport() {
        const hasRecognition = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
        const hasSynthesis = 'speechSynthesis' in window;
        
        if (!hasRecognition) {
            console.warn('Speech Recognition not supported');
        }
        
        if (!hasSynthesis) {
            console.warn('Speech Synthesis not supported');
        }
        
        return hasRecognition && hasSynthesis;
    }
    
    setupEventListeners() {
        // Chat integration
        eventBus.on('chat:voice-input', this.handleVoiceInput.bind(this));
        eventBus.on('chat:voice-output', this.handleVoiceOutput.bind(this));
        
        // Task integration
        eventBus.on('task:voice-response', this.handleTaskVoiceResponse.bind(this));
        
        // Session integration
        eventBus.on('session:changed', this.handleSessionChange.bind(this));
        
        // Settings updates
        eventBus.on('settings:voice-config', this.updateConfiguration.bind(this));
        
        // UI events
        eventBus.on('ui:voice-button-clicked', this.toggleListening.bind(this));
        eventBus.on('ui:voice-stop-clicked', this.stopSpeaking.bind(this));
        
        // Module lifecycle
        eventBus.on('module:start', this.handleModuleStart.bind(this));
        eventBus.on('module:stop', this.handleModuleStop.bind(this));
    }
    
    initializeSpeechRecognition() {
        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            
            if (!SpeechRecognition) {
                console.warn('Speech Recognition not available');
                return;
            }
            
            this.recognition = new SpeechRecognition();
            
            // Configure recognition
            this.recognition.continuous = this.config.continuous;
            this.recognition.interimResults = this.config.interimResults;
            this.recognition.maxAlternatives = this.config.maxAlternatives;
            this.recognition.lang = this.config.language;
            
            // Event handlers
            this.recognition.onstart = this.handleRecognitionStart.bind(this);
            this.recognition.onresult = this.handleRecognitionResult.bind(this);
            this.recognition.onerror = this.handleRecognitionError.bind(this);
            this.recognition.onend = this.handleRecognitionEnd.bind(this);
            
            console.log('✅ Speech Recognition initialized');
            
        } catch (error) {
            console.error('❌ Speech Recognition initialization failed:', error);
        }
    }
    
    initializeSpeechSynthesis() {
        try {
            if (!window.speechSynthesis) {
                console.warn('Speech Synthesis not available');
                return;
            }
            
            this.synthesis = window.speechSynthesis;
            
            // Wait for voices to load
            this.synthesis.onvoiceschanged = () => {
                this.updateAvailableVoices();
            };
            
            // Load voices immediately if available
            this.updateAvailableVoices();
            
            console.log('✅ Speech Synthesis initialized');
            
        } catch (error) {
            console.error('❌ Speech Synthesis initialization failed:', error);
        }
    }
    
    async initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            // Create analyser for audio level monitoring
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;
            
            // Connect microphone to analyser
            this.microphone.connect(this.analyser);
            
            // Start audio level monitoring
            this.startAudioLevelMonitoring();
            
            console.log('✅ Audio Context initialized');
            
        } catch (error) {
            console.warn('⚠️ Audio Context initialization failed:', error);
        }
    }
    
    updateAvailableVoices() {
        if (!this.synthesis) return;
        
        const voices = this.synthesis.getVoices();
        console.log(`📢 Found ${voices.length} voices`);
        
        // Find preferred voice or default
        if (this.config.preferredVoice) {
            const preferredVoice = voices.find(voice => 
                voice.name === this.config.preferredVoice
            );
            if (preferredVoice) {
                this.selectedVoice = preferredVoice;
                return;
            }
        }
        
        // Find default voice for language
        const defaultVoice = voices.find(voice => 
            voice.lang === this.config.language && voice.default
        );
        
        if (defaultVoice) {
            this.selectedVoice = defaultVoice;
        } else {
            // Fallback to first voice
            this.selectedVoice = voices[0];
        }
        
        console.log(`🎙️ Selected voice: ${this.selectedVoice?.name}`);
    }
    
    setupBuiltinCommands() {
        // Basic voice commands
        this.commands.set('start listening', () => {
            this.startListening();
        });
        
        this.commands.set('stop listening', () => {
            this.stopListening();
        });
        
        this.commands.set('pause agent', () => {
            eventBus.emit('agent:pause');
        });
        
        this.commands.set('resume agent', () => {
            eventBus.emit('agent:resume');
        });
        
        this.commands.set('show dashboard', () => {
            eventBus.emit('ui:navigate', { view: 'dashboard' });
        });
        
        this.commands.set('show tasks', () => {
            eventBus.emit('ui:navigate', { view: 'tasks' });
        });
        
        this.commands.set('show settings', () => {
            eventBus.emit('ui:navigate', { view: 'settings' });
        });
        
        this.commands.set('cancel current task', () => {
            eventBus.emit('task:cancel-current');
        });
        
        this.commands.set('repeat that', () => {
            this.repeatLastResponse();
        });
        
        this.commands.set('speak slower', () => {
            this.adjustSpeechRate(-0.2);
        });
        
        this.commands.set('speak faster', () => {
            this.adjustSpeechRate(0.2);
        });
        
        this.commands.set('volume up', () => {
            this.adjustVolume(0.1);
        });
        
        this.commands.set('volume down', () => {
            this.adjustVolume(-0.1);
        });
    }
    
    loadConfiguration() {
        const voiceConfig = stateManager.getState('voice.config', {});
        this.config = { ...this.config, ...voiceConfig };
        
        // Apply configuration
        if (this.recognition) {
            this.recognition.lang = this.config.language;
            this.recognition.continuous = this.config.continuous;
            this.recognition.interimResults = this.config.interimResults;
        }
    }
    
    startAudioLevelMonitoring() {
        if (!this.analyser) return;
        
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        
        const updateLevel = () => {
            this.analyser.getByteFrequencyData(dataArray);
            
            // Calculate average level
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            
            this.audioLevel = sum / dataArray.length / 255;
            
            // Emit level update
            eventBus.emit('voice:audio-level', {
                level: this.audioLevel,
                timestamp: Date.now()
            });
            
            // Continue monitoring
            requestAnimationFrame(updateLevel);
        };
        
        updateLevel();
    }
    
    // Public API
    async startListening() {
        if (!this.recognition || this.isListening) return;
        
        console.log('🎤 Starting voice recognition...');
        
        try {
            // Reset state
            this.interimResults = '';
            this.finalResults = '';
            this.isListening = true;
            
            // Start recognition
            this.recognition.start();
            
            // Update UI
            eventBus.emit('voice:listening-started');
            
            // Set timeout for auto-stop
            if (this.config.silenceTimeout > 0) {
                setTimeout(() => {
                    if (this.isListening && !this.isProcessing) {
                        this.stopListening();
                    }
                }, this.config.silenceTimeout);
            }
            
        } catch (error) {
            console.error('❌ Failed to start listening:', error);
            this.isListening = false;
            eventBus.emit('voice:error', { error: error.message });
        }
    }
    
    stopListening() {
        if (!this.recognition || !this.isListening) return;
        
        console.log('🔇 Stopping voice recognition...');
        
        try {
            this.recognition.stop();
            this.isListening = false;
            
            // Update UI
            eventBus.emit('voice:listening-stopped');
            
        } catch (error) {
            console.error('❌ Failed to stop listening:', error);
        }
    }
    
    async speak(text, options = {}) {
        if (!this.synthesis || !text) return;
        
        console.log('📢 Speaking:', text.substring(0, 50) + '...');
        
        try {
            // Create utterance
            const utterance = new SpeechSynthesisUtterance(text);
            
            // Configure utterance
            utterance.voice = this.selectedVoice;
            utterance.volume = options.volume ?? this.config.voiceVolume;
            utterance.rate = options.rate ?? this.config.voiceRate;
            utterance.pitch = options.pitch ?? this.config.voicePitch;
            utterance.lang = options.lang ?? this.config.language;
            
            // Event handlers
            utterance.onstart = () => {
                this.isSpeaking = true;
                this.currentUtterance = utterance;
                eventBus.emit('voice:speaking-started', { text });
            };
            
            utterance.onend = () => {
                this.isSpeaking = false;
                this.currentUtterance = null;
                eventBus.emit('voice:speaking-ended', { text });
                
                // Process queue
                this.processVoiceQueue();
            };
            
            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event);
                this.isSpeaking = false;
                this.currentUtterance = null;
                eventBus.emit('voice:speaking-error', { error: event.error });
            };
            
            // Queue or speak immediately
            if (this.isSpeaking) {
                this.voiceQueue.push(utterance);
            } else {
                this.synthesis.speak(utterance);
            }
            
        } catch (error) {
            console.error('❌ Failed to speak:', error);
            eventBus.emit('voice:error', { error: error.message });
        }
    }
    
    stopSpeaking() {
        if (!this.synthesis) return;
        
        console.log('🔇 Stopping speech...');
        
        try {
            this.synthesis.cancel();
            this.isSpeaking = false;
            this.currentUtterance = null;
            this.voiceQueue = [];
            
            eventBus.emit('voice:speaking-stopped');
            
        } catch (error) {
            console.error('❌ Failed to stop speaking:', error);
        }
    }
    
    processVoiceQueue() {
        if (this.voiceQueue.length === 0 || this.isSpeaking) return;
        
        const nextUtterance = this.voiceQueue.shift();
        this.synthesis.speak(nextUtterance);
    }
    
    toggleListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }
    
    // Event handlers
    handleRecognitionStart() {
        console.log('🎤 Recognition started');
        this.isListening = true;
        this.lastActivity = Date.now();
        
        eventBus.emit('voice:recognition-started');
    }
    
    handleRecognitionResult(event) {
        console.log('🎯 Recognition result received');
        
        let interimTranscript = '';
        let finalTranscript = '';
        
        // Process results
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0].transcript;
            
            if (result.isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
        
        // Update state
        this.interimResults = interimTranscript;
        this.finalResults = finalTranscript;
        
        // Emit interim results
        if (interimTranscript) {
            eventBus.emit('voice:interim-result', {
                transcript: interimTranscript,
                confidence: event.results[0]?.[0]?.confidence || 0
            });
        }
        
        // Process final results
        if (finalTranscript) {
            this.processFinalResult(finalTranscript, event.results[0]);
        }
    }
    
    processFinalResult(transcript, result) {
        console.log('📝 Final transcript:', transcript);
        
        const confidence = result[0]?.confidence || 0;
        const alternatives = Array.from(result).map(alt => ({
            transcript: alt.transcript,
            confidence: alt.confidence
        }));
        
        // Update statistics
        this.sessionStats.totalUtterances++;
        this.sessionStats.successfulRecognitions++;
        this.sessionStats.averageConfidence = 
            (this.sessionStats.averageConfidence * (this.sessionStats.successfulRecognitions - 1) + confidence) / 
            this.sessionStats.successfulRecognitions;
        
        // Check for voice commands
        if (this.processVoiceCommand(transcript)) {
            return;
        }
        
        // Process as regular input
        this.processVoiceInput(transcript, confidence, alternatives);
    }
    
    processVoiceCommand(transcript) {
        const lowerTranscript = transcript.toLowerCase().trim();
        
        // Check for exact command matches
        if (this.commands.has(lowerTranscript)) {
            console.log('🎛️ Executing voice command:', lowerTranscript);
            this.commands.get(lowerTranscript)();
            return true;
        }
        
        // Check for partial matches
        for (const [command, handler] of this.commands) {
            if (lowerTranscript.includes(command.toLowerCase())) {
                console.log('🎛️ Executing voice command:', command);
                handler();
                return true;
            }
        }
        
        return false;
    }
    
    processVoiceInput(transcript, confidence, alternatives) {
        console.log('💬 Processing voice input:', transcript);
        
        // Add to conversation history
        this.conversationHistory.push({
            type: 'voice_input',
            transcript: transcript,
            confidence: confidence,
            alternatives: alternatives,
            timestamp: Date.now(),
            sessionId: this.currentSessionId
        });
        
        // Create task for voice processing
        eventBus.emit('chat:message', {
            message: transcript,
            sessionId: this.currentSessionId,
            inputMethod: 'voice',
            confidence: confidence,
            alternatives: alternatives
        });
        
        // Emit voice input event
        eventBus.emit('voice:input', {
            transcript: transcript,
            confidence: confidence,
            alternatives: alternatives,
            sessionId: this.currentSessionId
        });
    }
    
    handleRecognitionError(event) {
        console.error('❌ Recognition error:', event.error);
        
        this.isListening = false;
        this.sessionStats.failedRecognitions++;
        
        // Handle specific errors
        let errorMessage = 'Speech recognition error';
        
        switch (event.error) {
            case 'no-speech':
                errorMessage = 'No speech detected. Please try again.';
                break;
            case 'audio-capture':
                errorMessage = 'Microphone access denied or unavailable.';
                break;
            case 'not-allowed':
                errorMessage = 'Microphone permission denied.';
                break;
            case 'network':
                errorMessage = 'Network error during recognition.';
                break;
            case 'aborted':
                errorMessage = 'Recognition was aborted.';
                break;
            case 'language-not-supported':
                errorMessage = 'Language not supported.';
                break;
        }
        
        eventBus.emit('voice:error', {
            error: event.error,
            message: errorMessage
        });
    }
    
    handleRecognitionEnd() {
        console.log('🔚 Recognition ended');
        
        this.isListening = false;
        this.interimResults = '';
        
        eventBus.emit('voice:recognition-ended');
    }
    
    handleVoiceInput(data) {
        // Handle voice input from other components
        this.processVoiceInput(data.transcript, data.confidence, data.alternatives);
    }
    
    handleVoiceOutput(data) {
        // Handle voice output requests
        this.speak(data.text, data.options);
    }
    
    handleTaskVoiceResponse(data) {
        // Handle voice responses from completed tasks
        if (data.response && data.inputMethod === 'voice') {
            this.speak(data.response, {
                volume: this.config.voiceVolume * 1.1 // Slightly louder for responses
            });
        }
    }
    
    handleSessionChange(data) {
        this.currentSessionId = data.sessionId;
        
        // Clear conversation history if new session
        if (data.isNewSession) {
            this.conversationHistory = [];
        }
    }
    
    updateConfiguration(config) {
        this.config = { ...this.config, ...config };
        
        // Apply configuration changes
        if (this.recognition) {
            this.recognition.lang = this.config.language;
            this.recognition.continuous = this.config.continuous;
            this.recognition.interimResults = this.config.interimResults;
        }
        
        // Update selected voice
        this.updateAvailableVoices();
        
        // Save configuration
        stateManager.setState('voice.config', this.config);
    }
    
    // Utility methods
    repeatLastResponse() {
        const lastResponse = this.conversationHistory
            .filter(item => item.type === 'voice_output')
            .pop();
        
        if (lastResponse) {
            this.speak(lastResponse.text);
        }
    }
    
    adjustSpeechRate(delta) {
        this.config.voiceRate = Math.max(0.1, Math.min(2.0, this.config.voiceRate + delta));
        console.log(`🎚️ Speech rate adjusted to ${this.config.voiceRate}`);
        
        eventBus.emit('voice:rate-changed', { rate: this.config.voiceRate });
    }
    
    adjustVolume(delta) {
        this.config.voiceVolume = Math.max(0.0, Math.min(1.0, this.config.voiceVolume + delta));
        console.log(`🔊 Volume adjusted to ${this.config.voiceVolume}`);
        
        eventBus.emit('voice:volume-changed', { volume: this.config.voiceVolume });
    }
    
    getAvailableVoices() {
        return this.synthesis ? this.synthesis.getVoices() : [];
    }
    
    getAudioLevel() {
        return this.audioLevel;
    }
    
    getSessionStats() {
        return { ...this.sessionStats };
    }
    
    isCurrentlyListening() {
        return this.isListening;
    }
    
    isCurrentlySpeaking() {
        return this.isSpeaking;
    }
    
    // Module lifecycle
    async start() {
        if (this.active) return;
        
        console.log('▶️ Starting Voice Interface...');
        this.active = true;
        
        // Auto-start listening if configured
        if (this.config.autoStart) {
            await this.startListening();
        }
        
        eventBus.emit('module:started', {
            name: this.name,
            timestamp: Date.now()
        });
    }
    
    async stop() {
        if (!this.active) return;
        
        console.log('⏹️ Stopping Voice Interface...');
        this.active = false;
        
        // Stop listening and speaking
        this.stopListening();
        this.stopSpeaking();
        
        // Close audio context
        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }
        
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
            isListening: this.isListening,
            isSpeaking: this.isSpeaking,
            hasAudioContext: !!this.audioContext,
            hasRecognition: !!this.recognition,
            hasSynthesis: !!this.synthesis,
            selectedVoice: this.selectedVoice?.name,
            audioLevel: this.audioLevel,
            sessionStats: this.sessionStats,
            config: this.config
        };
    }
}

export default VoiceInterface;