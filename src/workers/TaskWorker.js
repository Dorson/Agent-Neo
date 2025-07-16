/**
 * Task Worker - Sandboxed Task Execution Environment
 * 
 * This Web Worker provides a sandboxed environment for executing tasks
 * as described in the Agent Neo whitepaper. Features:
 * - Isolated task execution
 * - Tool integration
 * - Resource monitoring
 * - Pause/resume functionality
 * - Error handling and recovery
 * - Simulated AI responses
 */

// Worker state
let currentTask = null;
let isPaused = false;
let availableTools = new Map();
let config = {};
let executionContext = {};

// Resource monitoring
let resourceUsage = {
    startTime: 0,
    cpuTime: 0,
    memoryUsage: 0,
    networkCalls: 0
};

// Initialize worker
self.onmessage = async function(e) {
    const { type, taskId, plan, tools, config: taskConfig } = e.data;
    
    switch (type) {
        case 'execute_task':
            await executeTask(taskId, plan, tools, taskConfig);
            break;
        case 'pause_task':
            pauseTask(taskId);
            break;
        case 'resume_task':
            resumeTask(taskId);
            break;
        case 'cancel_task':
            cancelTask(taskId);
            break;
        default:
            console.warn('Unknown task type:', type);
    }
};

async function executeTask(taskId, plan, tools, taskConfig) {
    try {
        console.log(`🔧 Worker executing task: ${taskId}`);
        
        // Initialize task context
        currentTask = {
            id: taskId,
            plan: plan,
            status: 'executing',
            startTime: Date.now(),
            currentStep: 0,
            progress: 0,
            results: new Map(),
            cancelled: false
        };
        
        // Set up configuration
        config = taskConfig || {};
        availableTools = new Map(tools);
        
        // Initialize resource monitoring
        resourceUsage.startTime = Date.now();
        resourceUsage.cpuTime = 0;
        resourceUsage.memoryUsage = 0;
        resourceUsage.networkCalls = 0;
        
        // Execute plan steps
        const result = await executePlan(plan);
        
        // Send completion result
        if (!currentTask.cancelled) {
            postMessage({
                type: 'task_complete',
                taskId: taskId,
                result: result,
                executionTime: Date.now() - currentTask.startTime,
                resourceUsage: resourceUsage
            });
        }
        
    } catch (error) {
        console.error('Task execution error:', error);
        
        postMessage({
            type: 'task_error',
            taskId: taskId,
            error: error.message,
            stack: error.stack
        });
    }
}

async function executePlan(plan) {
    const { steps } = plan;
    let finalResult = null;
    
    for (let i = 0; i < steps.length; i++) {
        if (currentTask.cancelled) {
            throw new Error('Task cancelled');
        }
        
        // Wait if paused
        while (isPaused && !currentTask.cancelled) {
            await sleep(100);
        }
        
        const step = steps[i];
        currentTask.currentStep = i;
        currentTask.progress = (i / steps.length) * 100;
        
        // Report progress
        postMessage({
            type: 'task_progress',
            taskId: currentTask.id,
            progress: currentTask.progress,
            currentStep: i,
            message: `Executing step ${i + 1}/${steps.length}: ${step.action}`
        });
        
        // Execute step
        const stepResult = await executeStep(step);
        currentTask.results.set(step.expectedOutput, stepResult);
        
        // Update final result
        if (i === steps.length - 1) {
            finalResult = stepResult;
        }
        
        // Report resource usage
        updateResourceUsage();
        
        // Small delay to prevent blocking
        await sleep(50);
    }
    
    currentTask.progress = 100;
    return finalResult;
}

async function executeStep(step) {
    const { tool, action, input, expectedOutput, condition } = step;
    
    // Check condition if specified
    if (condition && !evaluateCondition(condition, input)) {
        console.log(`⏭️ Skipping step due to condition: ${condition}`);
        return null;
    }
    
    // Get tool handler
    const toolHandler = getToolHandler(tool);
    if (!toolHandler) {
        throw new Error(`Tool not found: ${tool}`);
    }
    
    // Prepare input
    const processedInput = processInput(input);
    
    // Execute tool
    const result = await toolHandler(action, processedInput);
    
    console.log(`✅ Step completed: ${tool}.${action} -> ${expectedOutput}`);
    
    return result;
}

function processInput(input) {
    if (typeof input === 'string') {
        // Check if it's a reference to previous result
        if (currentTask.results.has(input)) {
            return currentTask.results.get(input);
        }
        return input;
    }
    
    if (Array.isArray(input)) {
        return input.map(item => processInput(item));
    }
    
    return input;
}

function evaluateCondition(condition, input) {
    switch (condition) {
        case 'if_requires_external_info':
            return requiresExternalInfo(input);
        case 'if_has_code':
            return hasCodeContent(input);
        case 'if_is_question':
            return isQuestion(input);
        default:
            return true;
    }
}

function requiresExternalInfo(input) {
    const needsInfoKeywords = ['what is', 'how to', 'latest', 'current', 'news', 'weather', 'price'];
    const text = typeof input === 'string' ? input.toLowerCase() : '';
    return needsInfoKeywords.some(keyword => text.includes(keyword));
}

function hasCodeContent(input) {
    const codeKeywords = ['function', 'class', 'import', 'export', 'const', 'let', 'var'];
    const text = typeof input === 'string' ? input : '';
    return codeKeywords.some(keyword => text.includes(keyword));
}

function isQuestion(input) {
    const text = typeof input === 'string' ? input : '';
    return text.includes('?') || text.toLowerCase().startsWith('what') || 
           text.toLowerCase().startsWith('how') || text.toLowerCase().startsWith('why');
}

function getToolHandler(toolName) {
    const handlers = {
        'text_analysis': handleTextAnalysis,
        'web_search': handleWebSearch,
        'code_generation': handleCodeGeneration,
        'data_processing': handleDataProcessing,
        'file_analysis': handleFileAnalysis,
        'speech_to_text': handleSpeechToText
    };
    
    return handlers[toolName];
}

async function handleTextAnalysis(action, input) {
    switch (action) {
        case 'analyze_intent':
            return analyzeIntent(input);
        case 'extract_entities':
            return extractEntities(input);
        case 'sentiment_analysis':
            return analyzeSentiment(input);
        default:
            throw new Error(`Unknown text analysis action: ${action}`);
    }
}

async function analyzeIntent(text) {
    // Simulate intent analysis
    await sleep(500);
    
    const intents = {
        question: ['what', 'how', 'why', 'when', 'where', 'who'],
        request: ['please', 'can you', 'could you', 'would you'],
        command: ['create', 'make', 'build', 'generate', 'write'],
        greeting: ['hello', 'hi', 'hey', 'good morning', 'good afternoon'],
        information: ['tell me', 'explain', 'describe', 'about']
    };
    
    const lowerText = text.toLowerCase();
    let detectedIntent = 'general';
    let confidence = 0.5;
    
    for (const [intent, keywords] of Object.entries(intents)) {
        const matches = keywords.filter(keyword => lowerText.includes(keyword));
        if (matches.length > 0) {
            detectedIntent = intent;
            confidence = Math.min(0.9, 0.3 + (matches.length * 0.2));
            break;
        }
    }
    
    return {
        intent: detectedIntent,
        confidence: confidence,
        entities: extractBasicEntities(text),
        text: text
    };
}

function extractBasicEntities(text) {
    const entities = [];
    
    // Extract simple patterns
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const urlPattern = /https?:\/\/[^\s]+/g;
    const phonePattern = /\b\d{3}-\d{3}-\d{4}\b/g;
    
    const emails = text.match(emailPattern) || [];
    const urls = text.match(urlPattern) || [];
    const phones = text.match(phonePattern) || [];
    
    emails.forEach(email => entities.push({ type: 'email', value: email }));
    urls.forEach(url => entities.push({ type: 'url', value: url }));
    phones.forEach(phone => entities.push({ type: 'phone', value: phone }));
    
    return entities;
}

async function handleWebSearch(action, input) {
    switch (action) {
        case 'search_information':
            return searchInformation(input);
        case 'fetch_url':
            return fetchUrl(input);
        default:
            throw new Error(`Unknown web search action: ${action}`);
    }
}

async function searchInformation(query) {
    // Simulate web search
    await sleep(1000);
    resourceUsage.networkCalls++;
    
    const searchQuery = typeof query === 'object' ? query.text : query;
    
    // Simulate search results
    const mockResults = [
        {
            title: `Information about ${searchQuery}`,
            url: `https://example.com/search?q=${encodeURIComponent(searchQuery)}`,
            snippet: `This is relevant information about ${searchQuery}. It provides comprehensive details and explanations.`,
            relevance: 0.8
        },
        {
            title: `Guide to ${searchQuery}`,
            url: `https://guide.example.com/${searchQuery}`,
            snippet: `A complete guide explaining everything you need to know about ${searchQuery}.`,
            relevance: 0.7
        }
    ];
    
    return {
        query: searchQuery,
        results: mockResults,
        resultCount: mockResults.length,
        searchTime: Date.now()
    };
}

async function handleCodeGeneration(action, input) {
    switch (action) {
        case 'generate_response':
            return generateResponse(input);
        case 'generate_code':
            return generateCode(input);
        case 'fix_code':
            return fixCode(input);
        default:
            throw new Error(`Unknown code generation action: ${action}`);
    }
}

async function generateResponse(input) {
    // Simulate response generation
    await sleep(800);
    
    let context = '';
    let searchResults = '';
    
    if (Array.isArray(input)) {
        const intentAnalysis = input.find(i => i && i.intent);
        const searchData = input.find(i => i && i.results);
        
        if (intentAnalysis) {
            context = `Based on your ${intentAnalysis.intent} with ${intentAnalysis.confidence * 100}% confidence: `;
        }
        
        if (searchData && searchData.results) {
            searchResults = `\n\nI found some relevant information:\n${searchData.results.map(r => `• ${r.title}: ${r.snippet}`).join('\n')}`;
        }
    } else if (typeof input === 'object' && input.intent) {
        context = `I understand this is a ${input.intent}. `;
    }
    
    // Generate contextual response
    const responses = {
        question: "I'd be happy to help answer your question. ",
        request: "I'll do my best to fulfill your request. ",
        command: "I'll work on that for you. ",
        greeting: "Hello! I'm Agent Neo, ready to assist you. ",
        information: "Here's the information you requested: ",
        general: "I understand what you're asking. "
    };
    
    const intentType = (typeof input === 'object' && input.intent) ? input.intent : 'general';
    const baseResponse = responses[intentType] || responses.general;
    
    const fullResponse = context + baseResponse + 
        "I'm operating within my ethical guidelines and resource constraints to provide you with the best possible assistance." + 
        searchResults;
    
    return fullResponse;
}

async function handleDataProcessing(action, input) {
    switch (action) {
        case 'process_input':
            return processGenericInput(input);
        case 'transform_data':
            return transformData(input);
        case 'validate_data':
            return validateData(input);
        default:
            throw new Error(`Unknown data processing action: ${action}`);
    }
}

async function processGenericInput(input) {
    // Simulate data processing
    await sleep(300);
    
    const processed = {
        originalInput: input,
        processedAt: Date.now(),
        type: typeof input,
        length: input ? input.length : 0,
        processed: true
    };
    
    // Add basic processing based on input type
    if (typeof input === 'string') {
        processed.wordCount = input.split(/\s+/).filter(word => word.length > 0).length;
        processed.characterCount = input.length;
        processed.hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(input);
    }
    
    return processed;
}

async function handleFileAnalysis(action, input) {
    switch (action) {
        case 'analyze_file':
            return analyzeFile(input);
        case 'extract_text':
            return extractText(input);
        default:
            throw new Error(`Unknown file analysis action: ${action}`);
    }
}

async function analyzeFile(fileData) {
    // Simulate file analysis
    await sleep(1200);
    
    return {
        fileName: fileData.name || 'unknown',
        fileSize: fileData.size || 0,
        fileType: fileData.type || 'unknown',
        analyzed: true,
        analysisTime: Date.now(),
        summary: `File analysis complete. This appears to be a ${fileData.type || 'unknown'} file.`
    };
}

async function handleSpeechToText(action, input) {
    switch (action) {
        case 'transcribe':
            return transcribeAudio(input);
        default:
            throw new Error(`Unknown speech to text action: ${action}`);
    }
}

async function transcribeAudio(audioData) {
    // Simulate speech to text
    await sleep(2000);
    
    // Mock transcription
    const mockTranscriptions = [
        "Hello, can you help me with my project?",
        "I need assistance with coding.",
        "What's the weather like today?",
        "Please create a simple website for me.",
        "How does machine learning work?"
    ];
    
    const transcription = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];
    
    return {
        transcription: transcription,
        confidence: 0.85,
        duration: audioData.duration || 0,
        processedAt: Date.now()
    };
}

function pauseTask(taskId) {
    if (currentTask && currentTask.id === taskId) {
        isPaused = true;
        console.log(`⏸️ Task paused: ${taskId}`);
    }
}

function resumeTask(taskId) {
    if (currentTask && currentTask.id === taskId) {
        isPaused = false;
        console.log(`▶️ Task resumed: ${taskId}`);
    }
}

function cancelTask(taskId) {
    if (currentTask && currentTask.id === taskId) {
        currentTask.cancelled = true;
        isPaused = false;
        console.log(`🚫 Task cancelled: ${taskId}`);
    }
}

function updateResourceUsage() {
    resourceUsage.cpuTime = Date.now() - resourceUsage.startTime;
    
    // Simulate memory usage (in practice, this would be harder to measure in a worker)
    resourceUsage.memoryUsage = Math.floor(Math.random() * 1024 * 1024 * 50); // Up to 50MB
    
    // Send resource usage update
    postMessage({
        type: 'resource_usage',
        taskId: currentTask.id,
        usage: { ...resourceUsage }
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Error handling
self.onerror = function(error) {
    console.error('Worker error:', error);
    
    if (currentTask) {
        postMessage({
            type: 'task_error',
            taskId: currentTask.id,
            error: error.message,
            stack: error.stack
        });
    }
};

// Unhandled promise rejection
self.onunhandledrejection = function(event) {
    console.error('Unhandled promise rejection in worker:', event.reason);
    
    if (currentTask) {
        postMessage({
            type: 'task_error',
            taskId: currentTask.id,
            error: event.reason.message || 'Unhandled promise rejection',
            stack: event.reason.stack
        });
    }
};

console.log('🧵 Task Worker initialized and ready');