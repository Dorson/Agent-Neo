/**
 * Natural Language Processing Module
 * 
 * Provides comprehensive NLP capabilities including:
 * - Sentiment analysis and emotion detection
 * - Intent recognition and classification
 * - Named entity recognition (NER)
 * - Context-aware response generation
 * - Language detection and translation
 * - Conversation flow management
 * - Integration with AI module manager
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';

class NLPProcessor {
    constructor() {
        this.name = 'NLPProcessor';
        this.version = '1.0.0';
        this.isRunning = false;
        
        // NLP models and processors
        this.processors = {
            sentiment: null,
            intent: null,
            entities: null,
            language: null,
            context: null,
            summarization: null,
            translation: null
        };
        
        // Conversation context
        this.conversationContext = {
            currentSession: null,
            history: [],
            entities: new Map(),
            topics: new Set(),
            sentiment: { current: 0, trend: [] },
            intent: { current: null, confidence: 0 },
            language: 'en',
            userPreferences: new Map()
        };
        
        // Configuration
        this.config = {
            maxHistoryLength: 100,
            contextWindow: 10,
            sentimentThreshold: 0.7,
            intentConfidenceThreshold: 0.6,
            entityConfidenceThreshold: 0.8,
            enableContextualResponses: true,
            enableEmotionDetection: true,
            enableTranslation: true,
            enableSummarization: true,
            defaultLanguage: 'en',
            supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ru'],
            processingTimeout: 5000,
            batchSize: 10,
            cacheResults: true
        };
        
        // Built-in processors
        this.builtInProcessors = {
            sentiment: this.processSentiment.bind(this),
            intent: this.processIntent.bind(this),
            entities: this.processEntities.bind(this),
            language: this.processLanguage.bind(this),
            context: this.processContext.bind(this),
            summarization: this.processSummarization.bind(this),
            translation: this.processTranslation.bind(this)
        };
        
        // Intent patterns
        this.intentPatterns = {
            question: /\b(what|how|when|where|why|who|which|can|could|would|should)\b/i,
            request: /\b(please|can you|would you|could you|help me|i need|i want)\b/i,
            command: /\b(start|stop|pause|resume|create|delete|update|show|hide|open|close)\b/i,
            greeting: /\b(hi|hello|hey|good morning|good afternoon|good evening)\b/i,
            farewell: /\b(bye|goodbye|see you|farewell|talk to you later)\b/i,
            affirmation: /\b(yes|yeah|yep|sure|ok|okay|absolutely|definitely)\b/i,
            negation: /\b(no|nope|not really|never|none|nothing)\b/i,
            emotion: /\b(happy|sad|angry|excited|frustrated|confused|amazed|surprised)\b/i
        };
        
        // Entity patterns
        this.entityPatterns = {
            person: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,
            email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
            url: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
            phone: /\b\d{3}-\d{3}-\d{4}\b|\b\(\d{3}\)\s*\d{3}-\d{4}\b/g,
            date: /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\b/gi,
            time: /\b\d{1,2}:\d{2}(\s?(am|pm))?\b/gi,
            money: /\$\d+(\.\d{2})?|\b\d+\s?(dollars?|cents?|usd|eur|gbp)\b/gi,
            number: /\b\d+(\.\d+)?\b/g
        };
        
        // Sentiment lexicon (simplified)
        this.sentimentLexicon = {
            positive: ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'awesome', 'perfect', 'love', 'like', 'happy', 'pleased', 'satisfied', 'delighted'],
            negative: ['bad', 'terrible', 'awful', 'horrible', 'disgusting', 'hate', 'dislike', 'angry', 'frustrated', 'disappointed', 'sad', 'upset', 'annoyed', 'furious'],
            neutral: ['okay', 'fine', 'average', 'normal', 'standard', 'regular', 'typical', 'usual', 'common', 'ordinary']
        };
        
        // Processing cache
        this.cache = new Map();
        this.cacheStats = {
            hits: 0,
            misses: 0,
            size: 0
        };
        
        // Metrics
        this.metrics = {
            processedMessages: 0,
            sentimentAnalyses: 0,
            intentRecognitions: 0,
            entityExtractions: 0,
            translations: 0,
            averageProcessingTime: 0,
            errors: 0
        };
        
        this.init();
    }
    
    async init() {
        console.log(`🧠 Initializing ${this.name} v${this.version}`);
        
        // Load configuration
        await this.loadConfiguration();
        
        // Initialize AI module manager integration
        await this.initializeAIIntegration();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load pre-trained models
        await this.loadModels();
        
        // Start background services
        this.startBackgroundServices();
        
        this.isRunning = true;
        
        eventBus.emit('nlp-processor:initialized', {
            version: this.version,
            config: this.config,
            processors: Object.keys(this.processors).filter(p => this.processors[p] !== null)
        });
    }
    
    async loadConfiguration() {
        try {
            const savedConfig = await stateManager.getState('nlpProcessor.config');
            if (savedConfig) {
                this.config = { ...this.config, ...savedConfig };
            }
            
            // Load conversation context
            const savedContext = await stateManager.getState('nlpProcessor.context');
            if (savedContext) {
                this.conversationContext = { ...this.conversationContext, ...savedContext };
            }
            
        } catch (error) {
            console.warn('Failed to load NLP processor configuration:', error);
        }
    }
    
    async initializeAIIntegration() {
        // Get AI module manager instance
        eventBus.emit('ai-module-manager:get-status', (status) => {
            this.aiModuleManager = status;
        });
        
        // Register NLP-specific AI modules
        await this.registerNLPModules();
    }
    
    async registerNLPModules() {
        // Register sentiment analysis module
        eventBus.emit('ai-module-manager:register-module-type', {
            name: 'sentiment-analyzer',
            loader: this.loadSentimentModel.bind(this),
            executor: this.executeSentimentAnalysis.bind(this),
            unloader: this.unloadSentimentModel.bind(this),
            resourceEstimator: () => ({ memory: 10 * 1024 * 1024, cpu: 0.3 })
        });
        
        // Register intent classifier
        eventBus.emit('ai-module-manager:register-module-type', {
            name: 'intent-classifier',
            loader: this.loadIntentModel.bind(this),
            executor: this.executeIntentClassification.bind(this),
            unloader: this.unloadIntentModel.bind(this),
            resourceEstimator: () => ({ memory: 15 * 1024 * 1024, cpu: 0.4 })
        });
        
        // Register entity extractor
        eventBus.emit('ai-module-manager:register-module-type', {
            name: 'entity-extractor',
            loader: this.loadEntityModel.bind(this),
            executor: this.executeEntityExtraction.bind(this),
            unloader: this.unloadEntityModel.bind(this),
            resourceEstimator: () => ({ memory: 20 * 1024 * 1024, cpu: 0.5 })
        });
    }
    
    setupEventListeners() {
        // Core processing events
        eventBus.on('nlp-processor:process', (data) => this.processText(data));
        eventBus.on('nlp-processor:analyze-sentiment', (data) => this.analyzeSentiment(data));
        eventBus.on('nlp-processor:classify-intent', (data) => this.classifyIntent(data));
        eventBus.on('nlp-processor:extract-entities', (data) => this.extractEntities(data));
        eventBus.on('nlp-processor:detect-language', (data) => this.detectLanguage(data));
        eventBus.on('nlp-processor:translate', (data) => this.translateText(data));
        eventBus.on('nlp-processor:summarize', (data) => this.summarizeText(data));
        
        // Context management events
        eventBus.on('nlp-processor:update-context', (data) => this.updateContext(data));
        eventBus.on('nlp-processor:clear-context', () => this.clearContext());
        eventBus.on('nlp-processor:get-context', () => this.getContext());
        
        // Configuration events
        eventBus.on('nlp-processor:configure', (config) => this.configure(config));
        eventBus.on('nlp-processor:get-status', () => this.getStatus());
        
        // Voice and chat integration
        eventBus.on('voice:transcription-complete', (data) => this.handleVoiceInput(data));
        eventBus.on('chat:message-sent', (data) => this.handleChatMessage(data));
    }
    
    async loadModels() {
        console.log('📚 Loading NLP models');
        
        // Load sentiment analysis model
        try {
            eventBus.emit('ai-module-manager:load-module', {
                id: 'sentiment-analyzer',
                type: 'sentiment-analyzer',
                url: '/models/sentiment/model.json',
                config: { vocabSize: 10000 }
            });
        } catch (error) {
            console.warn('Failed to load sentiment model:', error);
        }
        
        // Load intent classifier
        try {
            eventBus.emit('ai-module-manager:load-module', {
                id: 'intent-classifier',
                type: 'intent-classifier',
                url: '/models/intent/model.json',
                config: { numClasses: 20 }
            });
        } catch (error) {
            console.warn('Failed to load intent model:', error);
        }
        
        // Load entity extractor
        try {
            eventBus.emit('ai-module-manager:load-module', {
                id: 'entity-extractor',
                type: 'entity-extractor',
                url: '/models/entities/model.json',
                config: { entityTypes: ['person', 'organization', 'location', 'date', 'time'] }
            });
        } catch (error) {
            console.warn('Failed to load entity model:', error);
        }
    }
    
    async processText(request) {
        const { text, type = 'general', sessionId = null, options = {} } = request;
        
        try {
            const processStart = performance.now();
            
            // Check cache first
            const cacheKey = this.generateCacheKey(text, type, options);
            if (this.config.cacheResults && this.cache.has(cacheKey)) {
                this.cacheStats.hits++;
                return this.cache.get(cacheKey);
            }
            
            this.cacheStats.misses++;
            
            // Update session context
            if (sessionId) {
                this.conversationContext.currentSession = sessionId;
            }
            
            // Pre-process text
            const preprocessedText = this.preprocessText(text);
            
            // Run parallel processing
            const results = await Promise.allSettled([
                this.analyzeSentiment({ text: preprocessedText }),
                this.classifyIntent({ text: preprocessedText }),
                this.extractEntities({ text: preprocessedText }),
                this.detectLanguage({ text: preprocessedText }),
                this.processContext({ text: preprocessedText, type })
            ]);
            
            // Combine results
            const processedResult = {
                text: preprocessedText,
                originalText: text,
                type,
                sessionId,
                timestamp: Date.now(),
                sentiment: results[0].status === 'fulfilled' ? results[0].value : null,
                intent: results[1].status === 'fulfilled' ? results[1].value : null,
                entities: results[2].status === 'fulfilled' ? results[2].value : null,
                language: results[3].status === 'fulfilled' ? results[3].value : null,
                context: results[4].status === 'fulfilled' ? results[4].value : null,
                processingTime: performance.now() - processStart
            };
            
            // Update conversation context
            this.updateConversationContext(processedResult);
            
            // Cache result
            if (this.config.cacheResults) {
                this.cache.set(cacheKey, processedResult);
                this.cacheStats.size = this.cache.size;
            }
            
            // Update metrics
            this.metrics.processedMessages++;
            this.metrics.averageProcessingTime = 
                (this.metrics.averageProcessingTime + processedResult.processingTime) / 2;
            
            eventBus.emit('nlp-processor:processing-complete', processedResult);
            
            return processedResult;
            
        } catch (error) {
            console.error('NLP processing failed:', error);
            this.metrics.errors++;
            
            eventBus.emit('nlp-processor:processing-failed', {
                text,
                error: error.message
            });
            
            throw error;
        }
    }
    
    async analyzeSentiment(request) {
        const { text } = request;
        
        try {
            // Try AI module first
            const aiResult = await this.executeAIModule('sentiment-analyzer', text);
            if (aiResult) {
                this.metrics.sentimentAnalyses++;
                return aiResult;
            }
            
            // Fallback to built-in sentiment analysis
            const result = await this.builtInProcessors.sentiment(text);
            this.metrics.sentimentAnalyses++;
            return result;
            
        } catch (error) {
            console.error('Sentiment analysis failed:', error);
            return { sentiment: 'neutral', confidence: 0, error: error.message };
        }
    }
    
    async classifyIntent(request) {
        const { text } = request;
        
        try {
            // Try AI module first
            const aiResult = await this.executeAIModule('intent-classifier', text);
            if (aiResult) {
                this.metrics.intentRecognitions++;
                return aiResult;
            }
            
            // Fallback to pattern-based intent classification
            const result = await this.builtInProcessors.intent(text);
            this.metrics.intentRecognitions++;
            return result;
            
        } catch (error) {
            console.error('Intent classification failed:', error);
            return { intent: 'unknown', confidence: 0, error: error.message };
        }
    }
    
    async extractEntities(request) {
        const { text } = request;
        
        try {
            // Try AI module first
            const aiResult = await this.executeAIModule('entity-extractor', text);
            if (aiResult) {
                this.metrics.entityExtractions++;
                return aiResult;
            }
            
            // Fallback to pattern-based entity extraction
            const result = await this.builtInProcessors.entities(text);
            this.metrics.entityExtractions++;
            return result;
            
        } catch (error) {
            console.error('Entity extraction failed:', error);
            return { entities: [], error: error.message };
        }
    }
    
    // Built-in processors
    async processSentiment(text) {
        const words = text.toLowerCase().split(/\s+/);
        let sentimentScore = 0;
        let wordCount = 0;
        
        for (const word of words) {
            if (this.sentimentLexicon.positive.includes(word)) {
                sentimentScore += 1;
                wordCount++;
            } else if (this.sentimentLexicon.negative.includes(word)) {
                sentimentScore -= 1;
                wordCount++;
            }
        }
        
        if (wordCount === 0) {
            return { sentiment: 'neutral', confidence: 0.5, score: 0 };
        }
        
        const normalizedScore = sentimentScore / wordCount;
        let sentiment = 'neutral';
        let confidence = Math.abs(normalizedScore);
        
        if (normalizedScore > 0.2) {
            sentiment = 'positive';
        } else if (normalizedScore < -0.2) {
            sentiment = 'negative';
        }
        
        return {
            sentiment,
            confidence: Math.min(confidence, 1.0),
            score: normalizedScore,
            details: {
                positiveWords: words.filter(w => this.sentimentLexicon.positive.includes(w)),
                negativeWords: words.filter(w => this.sentimentLexicon.negative.includes(w)),
                neutralWords: words.filter(w => this.sentimentLexicon.neutral.includes(w))
            }
        };
    }
    
    async processIntent(text) {
        const intents = [];
        
        for (const [intent, pattern] of Object.entries(this.intentPatterns)) {
            const matches = text.match(pattern);
            if (matches) {
                intents.push({
                    intent,
                    confidence: matches.length / text.split(' ').length,
                    matches: matches
                });
            }
        }
        
        // Sort by confidence
        intents.sort((a, b) => b.confidence - a.confidence);
        
        if (intents.length === 0) {
            return { intent: 'unknown', confidence: 0, alternatives: [] };
        }
        
        return {
            intent: intents[0].intent,
            confidence: intents[0].confidence,
            alternatives: intents.slice(1),
            matches: intents[0].matches
        };
    }
    
    async processEntities(text) {
        const entities = [];
        
        for (const [entityType, pattern] of Object.entries(this.entityPatterns)) {
            const matches = text.match(pattern);
            if (matches) {
                for (const match of matches) {
                    entities.push({
                        type: entityType,
                        value: match,
                        confidence: 0.8, // Fixed confidence for pattern matching
                        start: text.indexOf(match),
                        end: text.indexOf(match) + match.length
                    });
                }
            }
        }
        
        return {
            entities,
            count: entities.length,
            types: [...new Set(entities.map(e => e.type))]
        };
    }
    
    async processLanguage(text) {
        // Simple language detection based on character patterns
        const languagePatterns = {
            en: /^[a-zA-Z0-9\s.,!?;:'"()-]+$/,
            es: /[ñáéíóúü]/i,
            fr: /[àâäéèêëïîôöùûüÿç]/i,
            de: /[äöüß]/i,
            it: /[àèéìíîòóù]/i,
            pt: /[ãõçáàâéêíóôú]/i,
            ru: /[а-яё]/i,
            zh: /[\u4e00-\u9fff]/,
            ja: /[ひらがなカタカナ]/,
            ko: /[ㄱ-ㅎ가-힣]/
        };
        
        const scores = {};
        
        for (const [lang, pattern] of Object.entries(languagePatterns)) {
            const matches = text.match(pattern);
            scores[lang] = matches ? matches.length / text.length : 0;
        }
        
        // Find language with highest score
        const detectedLanguage = Object.keys(scores).reduce((a, b) => 
            scores[a] > scores[b] ? a : b
        );
        
        return {
            language: detectedLanguage,
            confidence: scores[detectedLanguage],
            alternatives: Object.entries(scores)
                .filter(([lang]) => lang !== detectedLanguage)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([lang, score]) => ({ language: lang, confidence: score }))
        };
    }
    
    async processContext(request) {
        const { text, type } = request;
        
        // Extract topics from text
        const topics = this.extractTopics(text);
        
        // Analyze context continuity
        const contextScore = this.calculateContextScore(text, topics);
        
        // Generate contextual insights
        const insights = this.generateContextualInsights(text, topics, contextScore);
        
        return {
            topics,
            contextScore,
            insights,
            continuity: contextScore > 0.5,
            sessionRelevance: this.calculateSessionRelevance(text)
        };
    }
    
    // Helper methods
    preprocessText(text) {
        return text
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s.,!?;:'"()-]/g, '')
            .toLowerCase();
    }
    
    extractTopics(text) {
        const words = text.toLowerCase().split(/\s+/);
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'shall', 'should']);
        
        const topics = words
            .filter(word => word.length > 3)
            .filter(word => !stopWords.has(word))
            .reduce((acc, word) => {
                acc[word] = (acc[word] || 0) + 1;
                return acc;
            }, {});
        
        return Object.entries(topics)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([word, count]) => ({ word, count, weight: count / words.length }));
    }
    
    calculateContextScore(text, topics) {
        const historyTopics = this.conversationContext.topics;
        let commonTopics = 0;
        
        for (const topic of topics) {
            if (historyTopics.has(topic.word)) {
                commonTopics++;
            }
        }
        
        return topics.length > 0 ? commonTopics / topics.length : 0;
    }
    
    generateContextualInsights(text, topics, contextScore) {
        const insights = [];
        
        // Context continuity insight
        if (contextScore > 0.7) {
            insights.push({
                type: 'continuity',
                message: 'High context continuity detected',
                confidence: contextScore
            });
        }
        
        // Topic shift insight
        if (contextScore < 0.3 && topics.length > 0) {
            insights.push({
                type: 'topic_shift',
                message: 'Potential topic shift detected',
                confidence: 1 - contextScore
            });
        }
        
        // Sentiment insight
        const sentiment = this.conversationContext.sentiment.current;
        if (Math.abs(sentiment) > 0.5) {
            insights.push({
                type: 'sentiment',
                message: `${sentiment > 0 ? 'Positive' : 'Negative'} sentiment detected`,
                confidence: Math.abs(sentiment)
            });
        }
        
        return insights;
    }
    
    calculateSessionRelevance(text) {
        const history = this.conversationContext.history;
        if (history.length === 0) return 0;
        
        const recentMessages = history.slice(-5);
        let relevanceScore = 0;
        
        for (const message of recentMessages) {
            const commonWords = this.calculateCommonWords(text, message.text);
            relevanceScore += commonWords;
        }
        
        return relevanceScore / recentMessages.length;
    }
    
    calculateCommonWords(text1, text2) {
        const words1 = new Set(text1.toLowerCase().split(/\s+/));
        const words2 = new Set(text2.toLowerCase().split(/\s+/));
        
        let commonCount = 0;
        for (const word of words1) {
            if (words2.has(word)) {
                commonCount++;
            }
        }
        
        return commonCount / Math.max(words1.size, words2.size);
    }
    
    updateConversationContext(result) {
        // Update history
        this.conversationContext.history.push({
            text: result.text,
            timestamp: result.timestamp,
            sentiment: result.sentiment,
            intent: result.intent,
            entities: result.entities,
            language: result.language
        });
        
        // Maintain history limit
        if (this.conversationContext.history.length > this.config.maxHistoryLength) {
            this.conversationContext.history.shift();
        }
        
        // Update entities
        if (result.entities && result.entities.entities) {
            for (const entity of result.entities.entities) {
                this.conversationContext.entities.set(entity.value, entity);
            }
        }
        
        // Update topics
        if (result.context && result.context.topics) {
            for (const topic of result.context.topics) {
                this.conversationContext.topics.add(topic.word);
            }
        }
        
        // Update sentiment
        if (result.sentiment) {
            this.conversationContext.sentiment.current = result.sentiment.score || 0;
            this.conversationContext.sentiment.trend.push({
                score: result.sentiment.score,
                timestamp: result.timestamp
            });
            
            // Maintain trend limit
            if (this.conversationContext.sentiment.trend.length > 20) {
                this.conversationContext.sentiment.trend.shift();
            }
        }
        
        // Update intent
        if (result.intent) {
            this.conversationContext.intent.current = result.intent.intent;
            this.conversationContext.intent.confidence = result.intent.confidence;
        }
        
        // Update language
        if (result.language) {
            this.conversationContext.language = result.language.language;
        }
        
        // Save context
        this.saveConversationContext();
    }
    
    async saveConversationContext() {
        const contextData = {
            ...this.conversationContext,
            entities: Array.from(this.conversationContext.entities.entries()),
            topics: Array.from(this.conversationContext.topics),
            userPreferences: Array.from(this.conversationContext.userPreferences.entries())
        };
        
        await stateManager.setState('nlpProcessor.context', contextData);
    }
    
    // AI Module integration
    async executeAIModule(moduleId, input) {
        try {
            const result = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('AI module execution timeout'));
                }, this.config.processingTimeout);
                
                eventBus.emit('ai-module-manager:execute-inference', {
                    moduleId,
                    input,
                    config: {}
                });
                
                const handleResult = (data) => {
                    if (data.moduleId === moduleId) {
                        clearTimeout(timeout);
                        eventBus.off('ai-module-manager:inference-complete', handleResult);
                        eventBus.off('ai-module-manager:inference-failed', handleError);
                        resolve(data);
                    }
                };
                
                const handleError = (data) => {
                    if (data.moduleId === moduleId) {
                        clearTimeout(timeout);
                        eventBus.off('ai-module-manager:inference-complete', handleResult);
                        eventBus.off('ai-module-manager:inference-failed', handleError);
                        reject(new Error(data.error));
                    }
                };
                
                eventBus.on('ai-module-manager:inference-complete', handleResult);
                eventBus.on('ai-module-manager:inference-failed', handleError);
            });
            
            return result;
            
        } catch (error) {
            console.warn(`AI module ${moduleId} execution failed:`, error);
            return null;
        }
    }
    
    // Cache management
    generateCacheKey(text, type, options) {
        const hash = this.simpleHash(text + type + JSON.stringify(options));
        return `nlp_${hash}`;
    }
    
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }
    
    clearCache() {
        this.cache.clear();
        this.cacheStats = { hits: 0, misses: 0, size: 0 };
    }
    
    // Event handlers
    async handleVoiceInput(data) {
        const { transcription, sessionId } = data;
        
        const result = await this.processText({
            text: transcription,
            type: 'voice',
            sessionId
        });
        
        eventBus.emit('nlp-processor:voice-processed', {
            transcription,
            result,
            sessionId
        });
    }
    
    async handleChatMessage(data) {
        const { message, sessionId } = data;
        
        const result = await this.processText({
            text: message,
            type: 'chat',
            sessionId
        });
        
        eventBus.emit('nlp-processor:chat-processed', {
            message,
            result,
            sessionId
        });
    }
    
    startBackgroundServices() {
        // Cache cleanup
        setInterval(() => {
            this.cleanupCache();
        }, 300000); // 5 minutes
        
        // Context cleanup
        setInterval(() => {
            this.cleanupContext();
        }, 600000); // 10 minutes
    }
    
    cleanupCache() {
        if (this.cache.size > 1000) {
            // Remove oldest 25% of cache entries
            const entries = Array.from(this.cache.entries());
            const toRemove = entries.slice(0, Math.floor(entries.length * 0.25));
            
            for (const [key] of toRemove) {
                this.cache.delete(key);
            }
            
            this.cacheStats.size = this.cache.size;
        }
    }
    
    cleanupContext() {
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);
        
        // Clean up old sentiment trend data
        this.conversationContext.sentiment.trend = 
            this.conversationContext.sentiment.trend.filter(item => item.timestamp > oneHourAgo);
        
        // Clean up old topics
        if (this.conversationContext.topics.size > 100) {
            const topicsArray = Array.from(this.conversationContext.topics);
            const toKeep = topicsArray.slice(-50);
            this.conversationContext.topics = new Set(toKeep);
        }
    }
    
    // Configuration and status
    async configure(newConfig) {
        this.config = { ...this.config, ...newConfig };
        await stateManager.setState('nlpProcessor.config', this.config);
        
        eventBus.emit('nlp-processor:configured', { config: this.config });
    }
    
    getStatus() {
        return {
            name: this.name,
            version: this.version,
            isRunning: this.isRunning,
            config: this.config,
            context: {
                sessionId: this.conversationContext.currentSession,
                historyLength: this.conversationContext.history.length,
                entityCount: this.conversationContext.entities.size,
                topicCount: this.conversationContext.topics.size,
                currentSentiment: this.conversationContext.sentiment.current,
                currentIntent: this.conversationContext.intent.current,
                language: this.conversationContext.language
            },
            cache: this.cacheStats,
            metrics: this.metrics,
            processors: Object.keys(this.processors).map(name => ({
                name,
                loaded: this.processors[name] !== null
            }))
        };
    }
    
    clearContext() {
        this.conversationContext = {
            currentSession: null,
            history: [],
            entities: new Map(),
            topics: new Set(),
            sentiment: { current: 0, trend: [] },
            intent: { current: null, confidence: 0 },
            language: 'en',
            userPreferences: new Map()
        };
        
        this.saveConversationContext();
        
        eventBus.emit('nlp-processor:context-cleared');
    }
    
    getContext() {
        return {
            ...this.conversationContext,
            entities: Array.from(this.conversationContext.entities.entries()),
            topics: Array.from(this.conversationContext.topics),
            userPreferences: Array.from(this.conversationContext.userPreferences.entries())
        };
    }
    
    async stop() {
        console.log('🛑 Stopping NLP Processor');
        
        // Save context
        await this.saveConversationContext();
        
        // Clear cache
        this.clearCache();
        
        this.isRunning = false;
        
        eventBus.emit('nlp-processor:stopped');
    }
}

export default NLPProcessor;