/**
 * Knowledge Graph Module - Distributed Knowledge Storage
 * 
 * Implements the distributed knowledge graph system described in the whitepaper
 * using CRDT (Conflict-free Replicated Data Types) for peer-to-peer synchronization.
 * Features semantic conflict resolution, knowledge myceliation (pruning/synthesis),
 * and tiered epistemic framework (hot/warm/cold/core knowledge).
 * 
 * Key Features:
 * - RDF-like triple store (subject, predicate, object)
 * - CRDT-based conflict-free replication
 * - Knowledge myceliation (pruning and synthesis)
 * - Tiered knowledge system (hot/warm/cold/core)
 * - Semantic conflict resolution
 * - Query engine with relationship traversal
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';

class KnowledgeGraph {
    constructor() {
        this.name = 'KnowledgeGraph';
        this.version = '1.0.0';
        this.initialized = false;
        this.active = false;
        
        // Knowledge storage configuration
        this.config = {
            maxTriples: 10000,
            myeliationInterval: 300000, // 5 minutes
            temperatureDecayRate: 0.95, // Daily decay
            temperatureThresholds: {
                hot: 0.8,      // Ephemeral, high-access data
                warm: 0.5,     // Stable, verified facts
                cold: 0.2,     // Long-term abstractions
                core: 0        // Constitutional bedrock (immutable)
            },
            conflictResolutionMode: 'reputation-weighted', // consensus, reputation-weighted, latest
            queryTimeout: 5000
        };
        
        // Knowledge store (CRDT-like structure)
        this.triples = new Map(); // subject -> predicate -> object -> metadata
        this.indices = {
            bySubject: new Map(),
            byPredicate: new Map(),
            byObject: new Map(),
            byTemperature: {
                hot: new Set(),
                warm: new Set(),
                cold: new Set(),
                core: new Set()
            }
        };
        
        // Knowledge statistics
        this.stats = {
            totalTriples: 0,
            hotKnowledge: 0,
            warmKnowledge: 0,
            coldKnowledge: 0,
            coreKnowledge: 0,
            lastMyeliation: 0,
            queriesExecuted: 0,
            conflictsResolved: 0
        };
        
        // Query cache
        this.queryCache = new Map();
        this.maxCacheSize = 100;
        
        // Conflict tracking
        this.conflicts = [];
        this.maxConflictHistory = 50;
        
        this.init();
    }

    async init() {
        try {
            console.log('🧠 Initializing Knowledge Graph...');
            
            this.setupEventListeners();
            await this.loadKnowledgeFromStorage();
            this.initializeCoreKnowledge();
            this.startMyeliationProcess();
            
            this.initialized = true;
            console.log('✅ Knowledge Graph initialized');
            
            eventBus.emit('module:initialized', {
                name: this.name,
                version: this.version
            });
            
        } catch (error) {
            console.error('❌ Knowledge Graph initialization failed:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Knowledge operations
        eventBus.on('knowledge:add-triple', this.addTriple.bind(this));
        eventBus.on('knowledge:remove-triple', this.removeTriple.bind(this));
        eventBus.on('knowledge:query', this.query.bind(this));
        eventBus.on('knowledge:get-related', this.getRelated.bind(this));
        
        // Knowledge management
        eventBus.on('knowledge:merge-conflicts', this.mergeConflicts.bind(this));
        eventBus.on('knowledge:synthesize', this.synthesizeKnowledge.bind(this));
        eventBus.on('knowledge:prune', this.pruneKnowledge.bind(this));
        
        // CRDT synchronization
        eventBus.on('knowledge:sync-received', this.handleSyncData.bind(this));
        eventBus.on('knowledge:request-sync', this.sendSyncData.bind(this));
        
        // Configuration
        eventBus.on('knowledge:config:update', this.updateConfiguration.bind(this));
        
        // Task-based learning
        eventBus.on('task:learning-opportunity', this.recordLearning.bind(this));
    }

    async loadKnowledgeFromStorage() {
        try {
            const savedKnowledge = localStorage.getItem('agentneo_knowledge_graph');
            if (savedKnowledge) {
                const data = JSON.parse(savedKnowledge);
                this.deserializeKnowledge(data);
                console.log('📚 Loaded knowledge from storage:', this.stats.totalTriples, 'triples');
            }
        } catch (error) {
            console.warn('Failed to load knowledge from storage:', error);
        }
    }

    initializeCoreKnowledge() {
        // Initialize constitutional principles as core knowledge
        const coreTriples = [
            ['Agent_Neo', 'primary_directive', 'love_compassion_civility'],
            ['Agent_Neo', 'principle', 'homeostasis'],
            ['Agent_Neo', 'principle', 'do_no_harm'],
            ['Agent_Neo', 'principle', 'respect_autonomy'],
            ['Agent_Neo', 'principle', 'transparency'],
            ['Agent_Neo', 'principle', 'resource_efficiency'],
            ['Agent_Neo', 'architecture', 'modular_hive_mind'],
            ['Agent_Neo', 'economy', 'proof_of_performance'],
            ['Agent_Neo', 'network', 'peer_to_peer'],
            ['Knowledge_Graph', 'type', 'CRDT_based'],
            ['Ethics_Module', 'function', 'constitutional_ai'],
            ['Proprioception_Module', 'function', 'self_monitoring']
        ];
        
        for (const [subject, predicate, object] of coreTriples) {
            this.addTriple({
                subject,
                predicate,
                object,
                temperature: 'core',
                confidence: 1.0,
                source: 'constitution',
                timestamp: Date.now()
            });
        }
    }

    startMyeliationProcess() {
        // Start background knowledge myceliation
        this.myeliationInterval = setInterval(() => {
            this.performMyceliation();
        }, this.config.myeliationInterval);
        
        console.log('🍄 Knowledge myceliation process started');
    }

    addTriple(tripleData) {
        const { subject, predicate, object, temperature = 'warm', confidence = 0.5, source = 'unknown', timestamp = Date.now() } = tripleData;
        
        // Generate unique ID for this triple
        const tripleId = this.generateTripleId(subject, predicate, object);
        
        // Check for existing triple
        const existing = this.getTriple(subject, predicate, object);
        if (existing) {
            return this.updateTriple(tripleId, tripleData);
        }
        
        // Create triple metadata
        const metadata = {
            id: tripleId,
            subject,
            predicate,
            object,
            temperature: this.normalizeTemperature(temperature),
            confidence,
            source,
            timestamp,
            accessCount: 0,
            lastAccessed: timestamp,
            conflicts: [],
            version: 1
        };
        
        // Store in main structure
        if (!this.triples.has(subject)) {
            this.triples.set(subject, new Map());
        }
        if (!this.triples.get(subject).has(predicate)) {
            this.triples.get(subject).set(predicate, new Map());
        }
        this.triples.get(subject).get(predicate).set(object, metadata);
        
        // Update indices
        this.updateIndices('add', metadata);
        this.updateStats();
        
        // Emit event
        eventBus.emit('knowledge:triple-added', {
            tripleId,
            subject,
            predicate,
            object,
            metadata
        });
        
        // Auto-save periodically
        this.scheduleAutoSave();
        
        return tripleId;
    }

    updateTriple(tripleId, updates) {
        const triple = this.findTripleById(tripleId);
        if (!triple) return false;
        
        // Check for conflicts
        if (updates.object !== triple.object && triple.object !== updates.object) {
            this.handleConflict(triple, updates);
            return false;
        }
        
        // Update metadata
        const oldTemperature = triple.temperature;
        Object.assign(triple, {
            ...updates,
            version: triple.version + 1,
            lastAccessed: Date.now()
        });
        
        // Update indices if temperature changed
        if (oldTemperature !== triple.temperature) {
            this.indices.byTemperature[oldTemperature].delete(tripleId);
            this.indices.byTemperature[triple.temperature].add(tripleId);
        }
        
        this.updateStats();
        
        eventBus.emit('knowledge:triple-updated', {
            tripleId,
            updates,
            triple
        });
        
        return true;
    }

    removeTriple(tripleData) {
        const { subject, predicate, object } = tripleData;
        const triple = this.getTriple(subject, predicate, object);
        
        if (!triple) return false;
        
        // Remove from main structure
        this.triples.get(subject).get(predicate).delete(object);
        
        // Clean up empty maps
        if (this.triples.get(subject).get(predicate).size === 0) {
            this.triples.get(subject).delete(predicate);
        }
        if (this.triples.get(subject).size === 0) {
            this.triples.delete(subject);
        }
        
        // Update indices
        this.updateIndices('remove', triple);
        this.updateStats();
        
        eventBus.emit('knowledge:triple-removed', {
            subject,
            predicate,
            object,
            triple
        });
        
        return true;
    }

    query(queryData) {
        const { pattern, type = 'basic', limit = 50, timeout = this.config.queryTimeout } = queryData;
        
        console.log('🔍 Executing knowledge query:', pattern);
        
        // Check cache first
        const cacheKey = JSON.stringify({ pattern, type, limit });
        if (this.queryCache.has(cacheKey)) {
            const cached = this.queryCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
                return this.emitQueryResult(queryData.id, cached.results);
            }
        }
        
        const startTime = Date.now();
        let results = [];
        
        try {
            switch (type) {
                case 'basic':
                    results = this.executeBasicQuery(pattern);
                    break;
                case 'traversal':
                    results = this.executeTraversalQuery(pattern);
                    break;
                case 'semantic':
                    results = this.executeSemanticQuery(pattern);
                    break;
                case 'aggregation':
                    results = this.executeAggregationQuery(pattern);
                    break;
                default:
                    results = this.executeBasicQuery(pattern);
            }
            
            // Apply limit
            if (results.length > limit) {
                results = results.slice(0, limit);
            }
            
            // Cache results
            this.cacheQuery(cacheKey, results);
            
            // Update statistics
            this.stats.queriesExecuted++;
            
            // Mark accessed triples as hot
            results.forEach(triple => {
                this.markTripleAccessed(triple.id);
            });
            
        } catch (error) {
            console.error('Query execution failed:', error);
            results = [];
        }
        
        const queryTime = Date.now() - startTime;
        console.log(`🔍 Query completed in ${queryTime}ms, found ${results.length} results`);
        
        return this.emitQueryResult(queryData.id, results, queryTime);
    }

    executeBasicQuery(pattern) {
        const { subject, predicate, object } = pattern;
        const results = [];
        
        // Handle wildcard patterns
        if (subject === '*' && predicate === '*' && object === '*') {
            // Return all triples (limited)
            for (const [s, predicates] of this.triples) {
                for (const [p, objects] of predicates) {
                    for (const [o, metadata] of objects) {
                        results.push(metadata);
                    }
                }
            }
        } else if (subject !== '*' && predicate === '*' && object === '*') {
            // All predicates and objects for a subject
            if (this.triples.has(subject)) {
                for (const [p, objects] of this.triples.get(subject)) {
                    for (const [o, metadata] of objects) {
                        results.push(metadata);
                    }
                }
            }
        } else if (subject !== '*' && predicate !== '*' && object === '*') {
            // All objects for a subject-predicate pair
            if (this.triples.has(subject) && this.triples.get(subject).has(predicate)) {
                for (const [o, metadata] of this.triples.get(subject).get(predicate)) {
                    results.push(metadata);
                }
            }
        } else if (subject !== '*' && predicate !== '*' && object !== '*') {
            // Exact match
            const triple = this.getTriple(subject, predicate, object);
            if (triple) {
                results.push(triple);
            }
        }
        
        return results;
    }

    executeTraversalQuery(pattern) {
        // Graph traversal queries for relationship discovery
        const { start, relationship, depth = 2 } = pattern;
        const results = [];
        const visited = new Set();
        
        const traverse = (current, currentDepth) => {
            if (currentDepth > depth || visited.has(current)) return;
            visited.add(current);
            
            // Find all triples where current is the subject
            if (this.triples.has(current)) {
                for (const [predicate, objects] of this.triples.get(current)) {
                    if (!relationship || predicate === relationship) {
                        for (const [object, metadata] of objects) {
                            results.push(metadata);
                            traverse(object, currentDepth + 1);
                        }
                    }
                }
            }
        };
        
        traverse(start, 0);
        return results;
    }

    executeSemanticQuery(pattern) {
        // Semantic search with fuzzy matching
        const { concept, similarity = 0.7 } = pattern;
        const results = [];
        
        // Simple semantic matching (in production, would use embeddings)
        for (const [subject, predicates] of this.triples) {
            for (const [predicate, objects] of predicates) {
                for (const [object, metadata] of objects) {
                    const semanticScore = this.calculateSemanticSimilarity(concept, { subject, predicate, object });
                    if (semanticScore >= similarity) {
                        results.push({
                            ...metadata,
                            semanticScore
                        });
                    }
                }
            }
        }
        
        // Sort by semantic score
        results.sort((a, b) => (b.semanticScore || 0) - (a.semanticScore || 0));
        return results;
    }

    executeAggregationQuery(pattern) {
        // Aggregation queries (count, group by, etc.)
        const { operation, groupBy } = pattern;
        const results = [];
        
        if (operation === 'count' && groupBy) {
            const counts = new Map();
            
            for (const [subject, predicates] of this.triples) {
                for (const [predicate, objects] of predicates) {
                    for (const [object, metadata] of objects) {
                        const key = metadata[groupBy] || 'unknown';
                        counts.set(key, (counts.get(key) || 0) + 1);
                    }
                }
            }
            
            for (const [key, count] of counts) {
                results.push({
                    id: `count_${key}`,
                    subject: groupBy,
                    predicate: 'count',
                    object: count.toString(),
                    key
                });
            }
        }
        
        return results;
    }

    getRelated(entityData) {
        const { entity, relationshipType, maxDepth = 2 } = entityData;
        
        // Find related entities through graph traversal
        const related = this.executeTraversalQuery({
            start: entity,
            relationship: relationshipType,
            depth: maxDepth
        });
        
        eventBus.emit('knowledge:related-found', {
            entity,
            relationshipType,
            related
        });
        
        return related;
    }

    handleConflict(existingTriple, newData) {
        console.warn('🔄 Knowledge conflict detected:', existingTriple.id);
        
        const conflict = {
            id: `conflict_${Date.now()}`,
            tripleId: existingTriple.id,
            existing: { ...existingTriple },
            proposed: newData,
            timestamp: Date.now(),
            resolved: false,
            resolution: null
        };
        
        this.conflicts.push(conflict);
        
        // Maintain conflict history limit
        if (this.conflicts.length > this.maxConflictHistory) {
            this.conflicts.shift();
        }
        
        // Attempt automatic resolution
        const resolution = this.resolveConflict(conflict);
        if (resolution.automatic) {
            this.applyConflictResolution(conflict, resolution);
        } else {
            // Emit for manual resolution
            eventBus.emit('knowledge:conflict-detected', conflict);
        }
        
        this.stats.conflictsResolved++;
    }

    resolveConflict(conflict) {
        const { existing, proposed } = conflict;
        
        switch (this.config.conflictResolutionMode) {
            case 'latest':
                return {
                    automatic: true,
                    winner: 'proposed',
                    reason: 'Latest timestamp wins'
                };
                
            case 'reputation-weighted':
                // In production, would check source reputation
                const existingRep = this.getSourceReputation(existing.source);
                const proposedRep = this.getSourceReputation(proposed.source);
                
                if (proposedRep > existingRep) {
                    return {
                        automatic: true,
                        winner: 'proposed',
                        reason: 'Higher source reputation'
                    };
                } else {
                    return {
                        automatic: true,
                        winner: 'existing',
                        reason: 'Existing has higher reputation'
                    };
                }
                
            case 'consensus':
                return {
                    automatic: false,
                    reason: 'Requires network consensus'
                };
                
            default:
                return {
                    automatic: false,
                    reason: 'Manual resolution required'
                };
        }
    }

    applyConflictResolution(conflict, resolution) {
        conflict.resolved = true;
        conflict.resolution = resolution;
        
        if (resolution.winner === 'proposed') {
            this.updateTriple(conflict.tripleId, conflict.proposed);
        }
        // If winner is 'existing', no action needed
        
        eventBus.emit('knowledge:conflict-resolved', {
            conflict,
            resolution
        });
    }

    performMyceliation() {
        console.log('🍄 Performing knowledge myceliation...');
        
        const startTime = Date.now();
        let prunedCount = 0;
        let synthesizedCount = 0;
        
        // Phase 1: Pruning (remove low-value knowledge)
        prunedCount = this.pruneKnowledge();
        
        // Phase 2: Synthesis (create higher-level abstractions)
        synthesizedCount = this.synthesizeKnowledge();
        
        // Phase 3: Temperature decay
        this.decayTemperatures();
        
        this.stats.lastMyeliation = Date.now();
        
        const duration = Date.now() - startTime;
        console.log(`🍄 Myceliation completed in ${duration}ms: pruned ${prunedCount}, synthesized ${synthesizedCount}`);
        
        eventBus.emit('knowledge:myceliation-complete', {
            duration,
            prunedCount,
            synthesizedCount,
            timestamp: Date.now()
        });
    }

    pruneKnowledge() {
        let prunedCount = 0;
        const triplesToRemove = [];
        
        // Identify triples for pruning based on:
        // 1. Low access count and old timestamp
        // 2. Very low confidence
        // 3. Superseded by newer information
        
        for (const [subject, predicates] of this.triples) {
            for (const [predicate, objects] of predicates) {
                for (const [object, metadata] of objects) {
                    if (this.shouldPrune(metadata)) {
                        triplesToRemove.push({ subject, predicate, object });
                    }
                }
            }
        }
        
        // Remove identified triples
        for (const triple of triplesToRemove) {
            this.removeTriple(triple);
            prunedCount++;
        }
        
        return prunedCount;
    }

    shouldPrune(metadata) {
        // Don't prune core knowledge
        if (metadata.temperature === 'core') return false;
        
        const age = Date.now() - metadata.timestamp;
        const daysSinceAccess = (Date.now() - metadata.lastAccessed) / (1000 * 60 * 60 * 24);
        
        // Prune if:
        // - Very low confidence and old
        // - Not accessed in 30 days and low access count
        // - Hot knowledge that's cooled down significantly
        
        return (
            (metadata.confidence < 0.2 && age > 7 * 24 * 60 * 60 * 1000) || // 7 days
            (metadata.accessCount < 3 && daysSinceAccess > 30) ||
            (metadata.temperature === 'hot' && daysSinceAccess > 7)
        );
    }

    synthesizeKnowledge() {
        let synthesizedCount = 0;
        
        // Find patterns and create higher-level abstractions
        const patterns = this.findPatterns();
        
        for (const pattern of patterns) {
            const synthesis = this.createSynthesis(pattern);
            if (synthesis) {
                this.addTriple({
                    ...synthesis,
                    temperature: 'cold',
                    source: 'synthesis',
                    confidence: 0.8
                });
                synthesizedCount++;
            }
        }
        
        return synthesizedCount;
    }

    findPatterns() {
        const patterns = [];
        
        // Find common relationship patterns
        const relationshipCounts = new Map();
        
        for (const [subject, predicates] of this.triples) {
            for (const [predicate, objects] of predicates) {
                const key = `${predicate}`;
                relationshipCounts.set(key, (relationshipCounts.get(key) || 0) + 1);
            }
        }
        
        // Identify frequently used relationships
        for (const [predicate, count] of relationshipCounts) {
            if (count > 5) { // Threshold for pattern recognition
                patterns.push({
                    type: 'common_relationship',
                    predicate,
                    count
                });
            }
        }
        
        return patterns;
    }

    createSynthesis(pattern) {
        switch (pattern.type) {
            case 'common_relationship':
                return {
                    subject: `Pattern_${pattern.predicate}`,
                    predicate: 'frequency',
                    object: pattern.count.toString()
                };
            default:
                return null;
        }
    }

    decayTemperatures() {
        // Apply temperature decay to age knowledge appropriately
        for (const [subject, predicates] of this.triples) {
            for (const [predicate, objects] of predicates) {
                for (const [object, metadata] of objects) {
                    if (metadata.temperature !== 'core') {
                        this.applyTemperatureDecay(metadata);
                    }
                }
            }
        }
    }

    applyTemperatureDecay(metadata) {
        const daysSinceAccess = (Date.now() - metadata.lastAccessed) / (1000 * 60 * 60 * 24);
        const decayFactor = Math.pow(this.config.temperatureDecayRate, daysSinceAccess);
        
        // Calculate new temperature based on access patterns and age
        let newTemp = metadata.confidence * decayFactor;
        
        // Boost temperature based on recent access
        if (daysSinceAccess < 1) {
            newTemp = Math.min(1.0, newTemp * 1.2);
        }
        
        // Update temperature tier
        const oldTemperature = metadata.temperature;
        metadata.temperature = this.calculateTemperatureTier(newTemp);
        
        // Update indices if tier changed
        if (oldTemperature !== metadata.temperature) {
            this.indices.byTemperature[oldTemperature].delete(metadata.id);
            this.indices.byTemperature[metadata.temperature].add(metadata.id);
        }
    }

    calculateTemperatureTier(value) {
        const thresholds = this.config.temperatureThresholds;
        
        if (value >= thresholds.hot) return 'hot';
        if (value >= thresholds.warm) return 'warm';
        if (value >= thresholds.cold) return 'cold';
        return 'core';
    }

    calculateSemanticSimilarity(concept, triple) {
        // Simple semantic similarity (in production, would use embeddings)
        const text = `${triple.subject} ${triple.predicate} ${triple.object}`.toLowerCase();
        const conceptLower = concept.toLowerCase();
        
        // Basic keyword matching with fuzzy logic
        const words = conceptLower.split(' ');
        let matches = 0;
        
        for (const word of words) {
            if (text.includes(word)) {
                matches++;
            }
        }
        
        return words.length > 0 ? matches / words.length : 0;
    }

    markTripleAccessed(tripleId) {
        const triple = this.findTripleById(tripleId);
        if (triple) {
            triple.accessCount++;
            triple.lastAccessed = Date.now();
            
            // Potentially promote to hotter temperature
            if (triple.accessCount > 10 && triple.temperature !== 'hot') {
                const oldTemp = triple.temperature;
                triple.temperature = 'hot';
                this.indices.byTemperature[oldTemp].delete(tripleId);
                this.indices.byTemperature.hot.add(tripleId);
            }
        }
    }

    // Helper methods
    generateTripleId(subject, predicate, object) {
        return `${subject}:${predicate}:${object}`;
    }

    normalizeTemperature(temp) {
        const validTemps = ['hot', 'warm', 'cold', 'core'];
        return validTemps.includes(temp) ? temp : 'warm';
    }

    getTriple(subject, predicate, object) {
        return this.triples.get(subject)?.get(predicate)?.get(object);
    }

    findTripleById(tripleId) {
        const [subject, predicate, object] = tripleId.split(':');
        return this.getTriple(subject, predicate, object);
    }

    updateIndices(operation, metadata) {
        const { id, subject, predicate, object, temperature } = metadata;
        
        if (operation === 'add') {
            // Update subject index
            if (!this.indices.bySubject.has(subject)) {
                this.indices.bySubject.set(subject, new Set());
            }
            this.indices.bySubject.get(subject).add(id);
            
            // Update predicate index
            if (!this.indices.byPredicate.has(predicate)) {
                this.indices.byPredicate.set(predicate, new Set());
            }
            this.indices.byPredicate.get(predicate).add(id);
            
            // Update object index
            if (!this.indices.byObject.has(object)) {
                this.indices.byObject.set(object, new Set());
            }
            this.indices.byObject.get(object).add(id);
            
            // Update temperature index
            this.indices.byTemperature[temperature].add(id);
            
        } else if (operation === 'remove') {
            this.indices.bySubject.get(subject)?.delete(id);
            this.indices.byPredicate.get(predicate)?.delete(id);
            this.indices.byObject.get(object)?.delete(id);
            this.indices.byTemperature[temperature]?.delete(id);
        }
    }

    updateStats() {
        this.stats.totalTriples = 0;
        this.stats.hotKnowledge = this.indices.byTemperature.hot.size;
        this.stats.warmKnowledge = this.indices.byTemperature.warm.size;
        this.stats.coldKnowledge = this.indices.byTemperature.cold.size;
        this.stats.coreKnowledge = this.indices.byTemperature.core.size;
        
        this.stats.totalTriples = 
            this.stats.hotKnowledge + 
            this.stats.warmKnowledge + 
            this.stats.coldKnowledge + 
            this.stats.coreKnowledge;
        
        // Update state manager
        stateManager.setState('knowledge.stats', this.stats);
    }

    cacheQuery(key, results) {
        this.queryCache.set(key, {
            results,
            timestamp: Date.now()
        });
        
        // Maintain cache size
        if (this.queryCache.size > this.maxCacheSize) {
            const oldestKey = this.queryCache.keys().next().value;
            this.queryCache.delete(oldestKey);
        }
    }

    emitQueryResult(queryId, results, queryTime = 0) {
        eventBus.emit('knowledge:query-result', {
            queryId,
            results,
            queryTime,
            timestamp: Date.now()
        });
        
        return results;
    }

    getSourceReputation(source) {
        // In production, would query reputation system
        const reputations = {
            'constitution': 1.0,
            'ethics_module': 0.9,
            'user_input': 0.7,
            'synthesis': 0.8,
            'external_api': 0.6,
            'unknown': 0.3
        };
        
        return reputations[source] || reputations.unknown;
    }

    scheduleAutoSave() {
        // Debounced auto-save
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }
        
        this.autoSaveTimeout = setTimeout(() => {
            this.saveToStorage();
        }, 5000); // Save after 5 seconds of inactivity
    }

    saveToStorage() {
        try {
            const serialized = this.serializeKnowledge();
            localStorage.setItem('agentneo_knowledge_graph', JSON.stringify(serialized));
            console.log('💾 Knowledge graph saved to storage');
        } catch (error) {
            console.warn('Failed to save knowledge to storage:', error);
        }
    }

    serializeKnowledge() {
        const serialized = {
            triples: [],
            stats: this.stats,
            timestamp: Date.now()
        };
        
        for (const [subject, predicates] of this.triples) {
            for (const [predicate, objects] of predicates) {
                for (const [object, metadata] of objects) {
                    serialized.triples.push(metadata);
                }
            }
        }
        
        return serialized;
    }

    deserializeKnowledge(data) {
        this.stats = data.stats || this.stats;
        
        if (data.triples) {
            for (const triple of data.triples) {
                // Reconstruct the triple structure
                const { subject, predicate, object } = triple;
                
                if (!this.triples.has(subject)) {
                    this.triples.set(subject, new Map());
                }
                if (!this.triples.get(subject).has(predicate)) {
                    this.triples.get(subject).set(predicate, new Map());
                }
                this.triples.get(subject).get(predicate).set(object, triple);
                
                // Update indices
                this.updateIndices('add', triple);
            }
        }
        
        this.updateStats();
    }

    updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('🧠 Knowledge Graph configuration updated:', this.config);
        eventBus.emit('knowledge:config-updated', this.config);
    }

    getStatus() {
        return {
            name: this.name,
            version: this.version,
            initialized: this.initialized,
            active: this.active,
            config: this.config,
            stats: this.stats,
            indices: {
                subjects: this.indices.bySubject.size,
                predicates: this.indices.byPredicate.size,
                objects: this.indices.byObject.size,
                temperatures: {
                    hot: this.indices.byTemperature.hot.size,
                    warm: this.indices.byTemperature.warm.size,
                    cold: this.indices.byTemperature.cold.size,
                    core: this.indices.byTemperature.core.size
                }
            },
            conflicts: {
                pending: this.conflicts.filter(c => !c.resolved).length,
                resolved: this.conflicts.filter(c => c.resolved).length
            }
        };
    }

    async start() {
        this.active = true;
        stateManager.setState('knowledge.active', true);
        console.log('🧠 Knowledge Graph started');
        eventBus.emit('module:started', { name: this.name });
    }

    async stop() {
        this.active = false;
        
        // Clear intervals
        if (this.myeliationInterval) {
            clearInterval(this.myeliationInterval);
        }
        
        // Save current state
        this.saveToStorage();
        
        stateManager.setState('knowledge.active', false);
        console.log('🧠 Knowledge Graph stopped');
        eventBus.emit('module:stopped', { name: this.name });
    }
}

// Create and export singleton instance
const knowledgeGraph = new KnowledgeGraph();
export default knowledgeGraph;