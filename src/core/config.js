/**
 * Agent Neo Configuration
 * 
 * Centralized, read-only application configuration as specified in the
 * implementation plan. Contains database settings, resource limits,
 * P2P bootstrap peers, and other core configuration values.
 */

export const config = {
    // Application metadata
    name: 'Agent Neo',
    version: '1.0.0',
    description: 'A self-evolving, decentralized AI agent DApp',
    
    // Database configuration
    database: {
        name: 'AgentNeoDatabase',
        version: 1,
        stores: {
            identity: 'identity',
            operationalKeys: 'operational_keys',
            recovery: 'recovery',
            ledger: 'ledger',
            trustLists: 'trust_lists',
            knowledgeChunks: 'knowledge_chunks',
            sessionContext: 'session_context',
            guilds: 'guilds',
            tasks: 'tasks',
            metrics: 'metrics'
        }
    },
    
    // Resource limits (percentages)
    resourceLimits: {
        maxCpu: 50,           // Maximum CPU usage percentage
        maxMemory: 40,        // Maximum memory usage percentage
        maxNetwork: 30,       // Maximum network usage percentage
        maxStorage: 1000,     // Maximum storage in MB
        maxPeers: 50,         // Maximum number of peer connections
        maxTaskDuration: 300000, // Maximum task duration in ms (5 minutes)
        metabolicLimitRatio: 0.7 // Maximum metabolic load ratio
    },
    
    // P2P Network configuration
    p2p: {
        // Bootstrap peer addresses (placeholder - would be real bootstrap nodes in production)
        bootstrapPeers: [
            '/dns4/bootstrap.libp2p.io/tcp/443/wss/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
            '/dns4/bootstrap.libp2p.io/tcp/443/wss/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa'
        ],
        
        // Connection settings
        maxConnections: 50,
        minConnections: 5,
        heartbeatInterval: 30000,
        connectionTimeout: 10000,
        retryAttempts: 3,
        
        // Service tiers configuration
        serviceTiers: {
            HIGH: { priority: 1, bandwidth: 1000000, latency: 100 },
            MEDIUM: { priority: 2, bandwidth: 500000, latency: 500 },
            LOW: { priority: 3, bandwidth: 100000, latency: 2000 }
        }
    },
    
    // Logging configuration
    logging: {
        level: 'info', // debug, info, warn, error
        maxLogSize: 10 * 1024 * 1024, // 10MB
        retentionDays: 30,
        enableConsole: true,
        enablePersistent: true
    },
    
    // Guild configuration
    guild: {
        minMembers: 3,
        maxMembers: 300,
        voteThreshold: 0.6, // 60% majority required
        trustScoreThreshold: 20,
        lowTrustLimit: 30,
        bannedListLimit: 100,
        banDuration: 14 * 24 * 60 * 60 * 1000, // 14 days
        floodBanDuration: 60 * 60 * 1000, // 1 hour
        serviceRequestDelays: {
            lowTrust: {
                computational: 20000, // 20 seconds
                dataTransfer: 5000    // 5 seconds
            },
            nonGuild: {
                computational: 60000, // 60 seconds
                dataTransfer: 15000   // 15 seconds
            }
        }
    },
    
    // Cryptographic parameters
    crypto: {
        keyRotationInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
        operationalKeyValidityPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
        passwordMinLength: 8,
        passwordIterations: 100000,
        recoveryPhraseLength: 12,
        signatureValidityPeriod: 24 * 60 * 60 * 1000 // 24 hours
    },
    
    // Economics configuration
    economics: {
        initialTrustBalance: 100,
        metabolicCostPerSecond: 0.01,
        rewardMultiplier: 1.5,
        slashingPenalty: 0.1,
        symbioticTitheRate: 0.02, // 2%
        commonGoodFundAllocation: {
            networkHealth: 0.4,
            knowledgeMyceliation: 0.3,
            ecologicalNicheBounties: 0.2,
            exploratoryGrants: 0.1
        }
    },
    
    // UI configuration
    ui: {
        theme: 'dark',
        animations: true,
        updateInterval: 1000,
        maxNotifications: 10,
        notificationTimeout: 5000,
        autoSave: true,
        autoSaveInterval: 30000
    },
    
    // Ethics configuration
    ethics: {
        sensitivityLevel: 8, // 1-10 scale
        homeostasisMode: 'balanced', // strict, balanced, permissive
        ethicalTimeoutMs: 5000,
        maxViolations: 3,
        violationCooldown: 60000,
        frontierLogMaxEntries: 1000
    },
    
    // Knowledge management
    knowledge: {
        maxChunkSize: 1024 * 1024, // 1MB
        pruningInterval: 24 * 60 * 60 * 1000, // 24 hours
        relevanceThreshold: 0.1,
        synthesisInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
        maxGraphSize: 100000 // Maximum number of knowledge triples
    },
    
    // Task management
    tasks: {
        maxConcurrentTasks: 10,
        taskTimeout: 300000, // 5 minutes
        retryAttempts: 3,
        retryDelay: 5000,
        auctionTimeout: 30000, // 30 seconds
        bidTimeout: 10000, // 10 seconds
        consensusTimeout: 60000 // 1 minute
    },
    
    // Development settings
    development: {
        enableDevTools: true,
        mockData: true,
        skipCrypto: false,
        debugMode: false,
        testMode: false
    },
    
    // Feature flags
    features: {
        webAuthn: true,
        voiceInterface: true,
        federatedLearning: true,
        knowledgeGraph: true,
        guilds: true,
        economics: true,
        selfEvolution: true,
        zeroKnowledgeProofs: true
    },
    
    // External API limits
    externalApis: {
        maxSearchApiCallsPerHour: 100,
        maxAiApiCallsPerHour: 50,
        maxStorageApiCallsPerHour: 200,
        rateLimitWindow: 60 * 60 * 1000 // 1 hour
    },
    
    // JavaScript library seed URLs for initial knowledge bootstrapping
    jsLibrarySeedUrls: [
        'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js',
        'https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js',
        'https://cdn.jsdelivr.net/npm/date-fns@2.29.3/index.min.js',
        'https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/crypto-js.js'
    ],

    // Web Workers configuration
    webWorkers: {
        maxConcurrentWorkers: 8,
        defaultTimeout: 30000, // 30 seconds
        resourceLimits: {
            maxMemory: 100 * 1024 * 1024, // 100MB
            maxCpuTime: 60000, // 60 seconds
            maxExecutionTime: 30000, // 30 seconds
            maxMessages: 1000
        },
        types: {
            tool: {
                maxWorkers: 4,
                timeout: 10000,
                resourceLimits: {
                    maxMemory: 50 * 1024 * 1024, // 50MB
                    maxCpuTime: 10000 // 10 seconds
                }
            },
            skill: {
                maxWorkers: 3,
                timeout: 20000,
                resourceLimits: {
                    maxMemory: 75 * 1024 * 1024, // 75MB
                    maxCpuTime: 20000 // 20 seconds
                }
            },
            crypto: {
                maxWorkers: 2,
                timeout: 60000,
                resourceLimits: {
                    maxMemory: 200 * 1024 * 1024, // 200MB
                    maxCpuTime: 60000 // 60 seconds
                }
            },
            ai: {
                maxWorkers: 2,
                timeout: 120000,
                resourceLimits: {
                    maxMemory: 500 * 1024 * 1024, // 500MB
                    maxCpuTime: 120000 // 120 seconds
                }
            }
        }
    },

    // Federated Learning configuration
    federatedLearning: {
        privacyBudget: 10.0,
        noiseMultiplier: 1.0,
        maxParticipants: 50,
        minParticipants: 5,
        roundTimeout: 300000, // 5 minutes
        byzantineTolerance: 0.33, // Up to 33% Byzantine participants
        differentialPrivacy: {
            epsilon: 1.0,
            delta: 1e-5,
            sensitivity: 1.0
        },
        modelDefaults: {
            learningRate: 0.01,
            batchSize: 32,
            epochs: 1,
            hiddenSize: 64
        }
    }
};

// Global resource access tokens (would be configured per deployment)
export const globalResourceAccessTokens = {
    searchApi: null,
    aiApi: null,
    storageApi: null,
    analyticsApi: null
};

// Environment-specific overrides
export const getEnvironmentConfig = () => {
    const env = typeof window !== 'undefined' ? 
        (window.location.hostname === 'localhost' ? 'development' : 'production') : 
        'development';
    
    const overrides = {
        development: {
            logging: {
                level: 'debug',
                enableConsole: true
            },
            development: {
                enableDevTools: true,
                mockData: true,
                debugMode: true
            },
            resourceLimits: {
                maxCpu: 80,
                maxMemory: 60
            }
        },
        production: {
            logging: {
                level: 'warn',
                enableConsole: false
            },
            development: {
                enableDevTools: false,
                mockData: false,
                debugMode: false
            }
        }
    };
    
    return { ...config, ...overrides[env] };
};

export default config;