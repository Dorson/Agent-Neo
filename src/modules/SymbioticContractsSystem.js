/**
 * Symbiotic Contracts System
 * 
 * Implements persistent, mutually beneficial relationships between modules
 * as described in the whitepaper. Modeled on symbiotic exchange in mycelial
 * networks, this system enables continuous resource flows and collaborative
 * specialization.
 * 
 * Key Features:
 * - Information tithes and resource sharing
 * - Persistent symbiotic relationships
 * - Contract negotiation and enforcement
 * - Reputation-based contract formation
 * - Automatic tithe collection and distribution
 * - Mutual benefit tracking and optimization
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';

class SymbioticContractsSystem {
    constructor() {
        this.name = 'SymbioticContractsSystem';
        this.version = '1.0.0';
        this.initialized = false;
        this.active = false;
        
        // Contract management
        this.activeContracts = new Map();
        this.contractTemplates = new Map();
        this.contractHistory = new Map();
        this.pendingProposals = new Map();
        
        // Symbiotic relationships
        this.symbioticPairs = new Map();
        this.relationshipMetrics = new Map();
        this.mutualBenefitScores = new Map();
        
        // Tithe management
        this.titheCollection = new Map();
        this.titheDistribution = new Map();
        this.titheHistory = new Map();
        
        // Resource flows
        this.resourceFlows = new Map();
        this.flowMetrics = new Map();
        this.flowOptimization = new Map();
        
        // Configuration
        this.config = {
            maxContractsPerModule: 10,
            minContractDuration: 86400000, // 24 hours
            maxContractDuration: 2592000000, // 30 days
            defaultTitheRate: 0.02, // 2%
            minTitheRate: 0.01, // 1%
            maxTitheRate: 0.10, // 10%
            contractValidationPeriod: 3600000, // 1 hour
            benefitThreshold: 0.6, // 60% mutual benefit required
            reputationWeight: 0.3,
            performanceWeight: 0.7,
            autoRenewalThreshold: 0.8 // 80% satisfaction for auto-renewal
        };
        
        // Contract types
        this.contractTypes = new Map([
            ['information_tithe', {
                description: 'Automatic sharing of valuable information/facts',
                requiredCapabilities: ['knowledge_contribution', 'information_processing'],
                defaultTitheRate: 0.02,
                template: 'information_tithe_template'
            }],
            ['resource_sharing', {
                description: 'Mutual computational resource sharing',
                requiredCapabilities: ['resource_contribution', 'task_execution'],
                defaultTitheRate: 0.05,
                template: 'resource_sharing_template'
            }],
            ['skill_exchange', {
                description: 'Exchange of learned skills and capabilities',
                requiredCapabilities: ['skill_transfer', 'learning'],
                defaultTitheRate: 0.03,
                template: 'skill_exchange_template'
            }],
            ['data_synthesis', {
                description: 'Collaborative data analysis and synthesis',
                requiredCapabilities: ['data_analysis', 'synthesis'],
                defaultTitheRate: 0.04,
                template: 'data_synthesis_template'
            }],
            ['specialized_service', {
                description: 'Ongoing specialized service provision',
                requiredCapabilities: ['specialized_capability'],
                defaultTitheRate: 0.06,
                template: 'specialized_service_template'
            }]
        ]);
        
        // Benefit calculation weights
        this.benefitWeights = {
            resourceGain: 0.3,
            informationValue: 0.25,
            skillAcquisition: 0.2,
            reputationBoost: 0.15,
            networkEffects: 0.1
        };
        
        this.init();
    }
    
    async init() {
        try {
            console.log('🤝 Initializing Symbiotic Contracts System...');
            
            this.setupEventListeners();
            await this.loadContractData();
            this.initializeContractTemplates();
            this.startContractManagement();
            
            this.initialized = true;
            console.log('✅ Symbiotic Contracts System initialized');
            
            eventBus.emit('module:initialized', {
                name: this.name,
                version: this.version,
                contractTypes: this.contractTypes.size,
                activeContracts: this.activeContracts.size
            });
            
        } catch (error) {
            console.error('❌ Symbiotic Contracts System initialization failed:', error);
            throw error;
        }
    }
    
    setupEventListeners() {
        // Contract lifecycle events
        eventBus.on('contract:propose', this.proposeContract.bind(this));
        eventBus.on('contract:accept', this.acceptContract.bind(this));
        eventBus.on('contract:execute', this.executeContract.bind(this));
        eventBus.on('contract:terminate', this.terminateContract.bind(this));
        
        // Tithe management events
        eventBus.on('tithe:collect', this.collectTithe.bind(this));
        eventBus.on('tithe:distribute', this.distributeTithe.bind(this));
        eventBus.on('tithe:calculate', this.calculateTithe.bind(this));
        
        // Relationship events
        eventBus.on('relationship:evaluate', this.evaluateRelationship.bind(this));
        eventBus.on('relationship:optimize', this.optimizeRelationship.bind(this));
        
        // Resource flow events
        eventBus.on('resource:flow', this.trackResourceFlow.bind(this));
        eventBus.on('resource:optimize', this.optimizeResourceFlow.bind(this));
        
        // Task completion events for tithe collection
        eventBus.on('task:complete', this.processTitheCollection.bind(this));
        eventBus.on('knowledge:created', this.processInformationTithe.bind(this));
    }
    
    async loadContractData() {
        try {
            const stored = localStorage.getItem('agent-neo-symbiotic-contracts');
            if (stored) {
                const data = JSON.parse(stored);
                this.activeContracts = new Map(data.activeContracts || []);
                this.contractHistory = new Map(data.contractHistory || []);
                this.titheHistory = new Map(data.titheHistory || []);
                console.log('🤝 Loaded contract data:', {
                    activeContracts: this.activeContracts.size,
                    contractHistory: this.contractHistory.size,
                    titheHistory: this.titheHistory.size
                });
            }
        } catch (error) {
            console.warn('Failed to load contract data:', error);
        }
    }
    
    initializeContractTemplates() {
        // Information tithe template
        this.contractTemplates.set('information_tithe_template', {
            name: 'Information Tithe Contract',
            description: 'Provider automatically shares valuable information with consumer',
            terms: {
                informationTypes: ['facts', 'insights', 'analysis', 'patterns'],
                qualityThreshold: 0.7,
                titheRate: 0.02,
                exclusivityLevel: 'non-exclusive',
                updateFrequency: 'real-time'
            },
            obligations: {
                provider: [
                    'Share high-quality information as generated',
                    'Maintain minimum quality threshold',
                    'Provide metadata and context',
                    'Ensure information accuracy'
                ],
                consumer: [
                    'Provide agreed tithe percentage',
                    'Acknowledge information source',
                    'Use information ethically',
                    'Provide feedback on value'
                ]
            }
        });
        
        // Resource sharing template
        this.contractTemplates.set('resource_sharing_template', {
            name: 'Resource Sharing Contract',
            description: 'Mutual computational resource sharing arrangement',
            terms: {
                resourceTypes: ['cpu', 'memory', 'storage', 'network'],
                sharingRatio: 0.5,
                titheRate: 0.05,
                priorityLevel: 'medium',
                availabilityWindow: '24/7'
            },
            obligations: {
                provider: [
                    'Share agreed percentage of resources',
                    'Maintain resource availability',
                    'Provide resource quality metrics',
                    'Respect consumer priorities'
                ],
                consumer: [
                    'Reciprocate resource sharing',
                    'Pay agreed tithe rate',
                    'Use resources efficiently',
                    'Respect sharing limits'
                ]
            }
        });
        
        // Skill exchange template
        this.contractTemplates.set('skill_exchange_template', {
            name: 'Skill Exchange Contract',
            description: 'Exchange of learned skills and capabilities',
            terms: {
                skillTypes: ['analytical', 'creative', 'optimization', 'communication'],
                exchangeFrequency: 'on-demand',
                titheRate: 0.03,
                skillLevel: 'intermediate',
                exclusivity: 'shared'
            },
            obligations: {
                provider: [
                    'Share skill knowledge and implementation',
                    'Provide skill training and guidance',
                    'Maintain skill quality and updates',
                    'Support skill integration'
                ],
                consumer: [
                    'Provide reciprocal skill exchange',
                    'Pay agreed tithe rate',
                    'Attribute skill source',
                    'Contribute to skill improvement'
                ]
            }
        });
        
        console.log('🤝 Contract templates initialized:', this.contractTemplates.size);
    }
    
    async proposeContract(proposalData) {
        const { 
            proposerId, 
            targetModuleId, 
            contractType, 
            customTerms, 
            proposerReputation,
            targetReputation 
        } = proposalData;
        
        // Validate contract type
        const contractSpec = this.contractTypes.get(contractType);
        if (!contractSpec) {
            throw new Error(`Invalid contract type: ${contractType}`);
        }
        
        // Check if modules can form this contract
        const compatibility = await this.checkModuleCompatibility(
            proposerId, 
            targetModuleId, 
            contractSpec
        );
        
        if (!compatibility.compatible) {
            throw new Error(`Modules incompatible: ${compatibility.reason}`);
        }
        
        // Create contract proposal
        const proposalId = `contract_${Date.now()}_${proposerId}_${targetModuleId}`;
        const proposal = {
            id: proposalId,
            proposerId,
            targetModuleId,
            contractType,
            template: contractSpec.template,
            terms: {
                ...this.contractTemplates.get(contractSpec.template).terms,
                ...customTerms
            },
            proposerReputation,
            targetReputation,
            createdAt: Date.now(),
            expiresAt: Date.now() + 86400000, // 24 hours
            status: 'pending',
            mutualBenefitScore: compatibility.benefitScore
        };
        
        // Calculate suggested tithe rate based on value proposition
        proposal.terms.titheRate = this.calculateOptimalTitheRate(
            contractType,
            compatibility.benefitScore,
            proposerReputation,
            targetReputation
        );
        
        this.pendingProposals.set(proposalId, proposal);
        
        // Notify target module
        eventBus.emit('module:contract-proposal', {
            proposalId,
            proposal,
            targetModuleId
        });
        
        console.log(`🤝 Contract proposed: ${contractType} between ${proposerId} and ${targetModuleId}`);
        
        // Auto-expire proposal
        setTimeout(() => {
            if (this.pendingProposals.has(proposalId)) {
                this.pendingProposals.delete(proposalId);
                console.log(`⏰ Contract proposal expired: ${proposalId}`);
            }
        }, 86400000);
        
        return proposalId;
    }
    
    async checkModuleCompatibility(moduleId1, moduleId2, contractSpec) {
        // Check if modules have required capabilities
        const module1Capabilities = await this.getModuleCapabilities(moduleId1);
        const module2Capabilities = await this.getModuleCapabilities(moduleId2);
        
        const hasRequiredCapabilities = contractSpec.requiredCapabilities.every(cap => 
            module1Capabilities.includes(cap) || module2Capabilities.includes(cap)
        );
        
        if (!hasRequiredCapabilities) {
            return {
                compatible: false,
                reason: 'Missing required capabilities',
                benefitScore: 0
            };
        }
        
        // Calculate mutual benefit score
        const benefitScore = this.calculateMutualBenefitScore(
            moduleId1, 
            moduleId2, 
            contractSpec
        );
        
        return {
            compatible: benefitScore >= this.config.benefitThreshold,
            reason: benefitScore < this.config.benefitThreshold ? 'Insufficient mutual benefit' : 'Compatible',
            benefitScore
        };
    }
    
    async getModuleCapabilities(moduleId) {
        // This would query the module registry for capabilities
        // For now, return simulated capabilities
        return [
            'knowledge_contribution',
            'information_processing',
            'task_execution',
            'resource_contribution',
            'skill_transfer',
            'learning'
        ];
    }
    
    calculateMutualBenefitScore(moduleId1, moduleId2, contractSpec) {
        // Simplified mutual benefit calculation
        // In reality, this would be more sophisticated
        
        let score = 0;
        
        // Base compatibility score
        score += 0.5;
        
        // Reputation compatibility
        const rep1 = stateManager.getState(`modules.${moduleId1}.reputation`, 1000);
        const rep2 = stateManager.getState(`modules.${moduleId2}.reputation`, 1000);
        const repDiff = Math.abs(rep1 - rep2) / Math.max(rep1, rep2);
        score += (1 - repDiff) * 0.3;
        
        // Resource complementarity
        score += 0.2;
        
        return Math.min(1, score);
    }
    
    calculateOptimalTitheRate(contractType, benefitScore, proposerRep, targetRep) {
        const baseRate = this.contractTypes.get(contractType).defaultTitheRate;
        
        // Adjust based on benefit score
        let rate = baseRate * (1 + (benefitScore - 0.5));
        
        // Adjust based on reputation difference
        const repRatio = proposerRep / (proposerRep + targetRep);
        rate *= (0.5 + repRatio * 0.5);
        
        // Clamp to valid range
        return Math.max(
            this.config.minTitheRate,
            Math.min(this.config.maxTitheRate, rate)
        );
    }
    
    async acceptContract(acceptanceData) {
        const { proposalId, acceptorId, counterTerms } = acceptanceData;
        
        const proposal = this.pendingProposals.get(proposalId);
        if (!proposal) {
            throw new Error('Proposal not found');
        }
        
        if (proposal.targetModuleId !== acceptorId) {
            throw new Error('Only target module can accept proposal');
        }
        
        if (proposal.status !== 'pending') {
            throw new Error('Proposal is not pending');
        }
        
        // Create active contract
        const contractId = `active_${proposal.id}`;
        const contract = {
            id: contractId,
            providerModuleId: proposal.proposerId,
            consumerModuleId: proposal.targetModuleId,
            contractType: proposal.contractType,
            terms: counterTerms ? { ...proposal.terms, ...counterTerms } : proposal.terms,
            createdAt: Date.now(),
            expiresAt: Date.now() + this.config.maxContractDuration,
            status: 'active',
            performance: {
                totalTithes: 0,
                totalValue: 0,
                satisfactionScore: 0,
                violationCount: 0
            }
        };
        
        this.activeContracts.set(contractId, contract);
        
        // Create symbiotic relationship
        const relationshipId = `${proposal.proposerId}_${proposal.targetModuleId}`;
        this.symbioticPairs.set(relationshipId, {
            moduleId1: proposal.proposerId,
            moduleId2: proposal.targetModuleId,
            contractId,
            createdAt: Date.now(),
            totalInteractions: 0,
            mutualBenefitScore: proposal.mutualBenefitScore
        });
        
        // Remove from pending
        this.pendingProposals.delete(proposalId);
        
        // Notify both modules
        eventBus.emit('contract:activated', {
            contractId,
            contract,
            providerModuleId: proposal.proposerId,
            consumerModuleId: proposal.targetModuleId
        });
        
        console.log(`🤝 Contract activated: ${contractId}`);
        
        this.saveContractData();
        return contractId;
    }
    
    async processTitheCollection(taskData) {
        const { moduleId, taskValue, success } = taskData;
        
        if (!success) return;
        
        // Find contracts where this module is the provider
        for (const [contractId, contract] of this.activeContracts) {
            if (contract.providerModuleId === moduleId && contract.status === 'active') {
                const titheAmount = taskValue * contract.terms.titheRate;
                
                await this.collectTithe({
                    contractId,
                    providerId: moduleId,
                    consumerId: contract.consumerModuleId,
                    amount: titheAmount,
                    source: 'task_completion',
                    sourceValue: taskValue
                });
            }
        }
    }
    
    async collectTithe(titheData) {
        const { contractId, providerId, consumerId, amount, source, sourceValue } = titheData;
        
        const contract = this.activeContracts.get(contractId);
        if (!contract) {
            throw new Error('Contract not found');
        }
        
        // Create tithe record
        const titheId = `tithe_${Date.now()}_${contractId}`;
        const tithe = {
            id: titheId,
            contractId,
            providerId,
            consumerId,
            amount,
            source,
            sourceValue,
            collectedAt: Date.now(),
            status: 'collected'
        };
        
        // Store tithe
        this.titheCollection.set(titheId, tithe);
        
        // Update contract performance
        contract.performance.totalTithes += amount;
        contract.performance.totalValue += sourceValue;
        
        // Deduct from provider
        eventBus.emit('economy:deduct-trust', {
            moduleId: providerId,
            amount: amount,
            reason: 'symbiotic_tithe'
        });
        
        // Add to consumer
        eventBus.emit('economy:add-trust', {
            moduleId: consumerId,
            amount: amount,
            reason: 'symbiotic_tithe_received'
        });
        
        // Update relationship metrics
        const relationshipId = `${providerId}_${consumerId}`;
        const relationship = this.symbioticPairs.get(relationshipId);
        if (relationship) {
            relationship.totalInteractions++;
            relationship.lastInteraction = Date.now();
        }
        
        console.log(`💰 Tithe collected: ${amount} tokens from ${providerId} to ${consumerId}`);
        
        eventBus.emit('tithe:collected', {
            titheId,
            tithe,
            contractId
        });
        
        this.saveContractData();
    }
    
    async evaluateRelationship(relationshipId) {
        const relationship = this.symbioticPairs.get(relationshipId);
        if (!relationship) {
            throw new Error('Relationship not found');
        }
        
        const contract = this.activeContracts.get(relationship.contractId);
        if (!contract) {
            throw new Error('Associated contract not found');
        }
        
        // Calculate satisfaction scores
        const providerSatisfaction = this.calculateProviderSatisfaction(contract);
        const consumerSatisfaction = this.calculateConsumerSatisfaction(contract);
        
        // Update relationship metrics
        const metrics = {
            providerSatisfaction,
            consumerSatisfaction,
            mutualSatisfaction: (providerSatisfaction + consumerSatisfaction) / 2,
            valueExchanged: contract.performance.totalValue,
            tithesPaid: contract.performance.totalTithes,
            interactionFrequency: relationship.totalInteractions / 
                ((Date.now() - relationship.createdAt) / 86400000), // per day
            lastEvaluated: Date.now()
        };
        
        this.relationshipMetrics.set(relationshipId, metrics);
        
        // Check for auto-renewal
        if (metrics.mutualSatisfaction >= this.config.autoRenewalThreshold) {
            await this.proposeContractRenewal(relationship.contractId);
        }
        
        // Check for termination
        if (metrics.mutualSatisfaction < 0.3) {
            await this.flagContractForReview(relationship.contractId);
        }
        
        return metrics;
    }
    
    calculateProviderSatisfaction(contract) {
        // Simplified satisfaction calculation
        let satisfaction = 0;
        
        // Tithe collection rate
        const expectedTithes = contract.performance.totalValue * contract.terms.titheRate;
        const actualTithes = contract.performance.totalTithes;
        satisfaction += Math.min(1, actualTithes / expectedTithes) * 0.5;
        
        // Violation rate
        const violationRate = contract.performance.violationCount / 
            Math.max(1, contract.performance.totalInteractions || 1);
        satisfaction += (1 - violationRate) * 0.3;
        
        // Duration bonus
        const durationBonus = Math.min(0.2, 
            (Date.now() - contract.createdAt) / contract.terms.duration * 0.2);
        satisfaction += durationBonus;
        
        return Math.min(1, satisfaction);
    }
    
    calculateConsumerSatisfaction(contract) {
        // Simplified satisfaction calculation
        let satisfaction = 0;
        
        // Value received
        const valueRatio = contract.performance.totalValue / 
            Math.max(1, contract.performance.totalTithes);
        satisfaction += Math.min(1, valueRatio / 10) * 0.6; // Expecting 10:1 value ratio
        
        // Service quality
        satisfaction += 0.3; // Placeholder for service quality metrics
        
        // Reliability
        satisfaction += 0.1; // Placeholder for reliability metrics
        
        return Math.min(1, satisfaction);
    }
    
    async proposeContractRenewal(contractId) {
        const contract = this.activeContracts.get(contractId);
        if (!contract) return;
        
        console.log(`🔄 Auto-renewal proposed for contract: ${contractId}`);
        
        // Create renewal proposal
        await this.proposeContract({
            proposerId: contract.providerModuleId,
            targetModuleId: contract.consumerModuleId,
            contractType: contract.contractType,
            customTerms: contract.terms,
            proposerReputation: stateManager.getState(`modules.${contract.providerModuleId}.reputation`, 1000),
            targetReputation: stateManager.getState(`modules.${contract.consumerModuleId}.reputation`, 1000)
        });
    }
    
    async flagContractForReview(contractId) {
        const contract = this.activeContracts.get(contractId);
        if (!contract) return;
        
        console.log(`⚠️ Contract flagged for review: ${contractId}`);
        
        eventBus.emit('contract:review-required', {
            contractId,
            reason: 'low_satisfaction',
            timestamp: Date.now()
        });
    }
    
    startContractManagement() {
        // Periodic contract evaluation
        setInterval(() => {
            this.evaluateAllContracts();
        }, this.config.contractValidationPeriod);
        
        // Periodic relationship optimization
        setInterval(() => {
            this.optimizeRelationships();
        }, 3600000); // Every hour
    }
    
    async evaluateAllContracts() {
        console.log('🔍 Evaluating all symbiotic contracts...');
        
        for (const [relationshipId, relationship] of this.symbioticPairs) {
            try {
                await this.evaluateRelationship(relationshipId);
            } catch (error) {
                console.warn(`Failed to evaluate relationship ${relationshipId}:`, error);
            }
        }
    }
    
    async optimizeRelationships() {
        console.log('🔧 Optimizing symbiotic relationships...');
        
        // Find underperforming relationships
        for (const [relationshipId, metrics] of this.relationshipMetrics) {
            if (metrics.mutualSatisfaction < 0.5) {
                await this.suggestRelationshipImprovements(relationshipId);
            }
        }
    }
    
    async suggestRelationshipImprovements(relationshipId) {
        const relationship = this.symbioticPairs.get(relationshipId);
        const metrics = this.relationshipMetrics.get(relationshipId);
        
        if (!relationship || !metrics) return;
        
        const suggestions = [];
        
        // Suggest tithe rate adjustments
        if (metrics.providerSatisfaction < 0.5) {
            suggestions.push({
                type: 'tithe_rate_adjustment',
                recommendation: 'Increase tithe rate',
                impact: 'Improve provider satisfaction'
            });
        }
        
        // Suggest value improvements
        if (metrics.consumerSatisfaction < 0.5) {
            suggestions.push({
                type: 'value_improvement',
                recommendation: 'Enhance service quality',
                impact: 'Improve consumer satisfaction'
            });
        }
        
        // Suggest interaction frequency changes
        if (metrics.interactionFrequency < 0.1) {
            suggestions.push({
                type: 'interaction_frequency',
                recommendation: 'Increase interaction frequency',
                impact: 'Strengthen relationship'
            });
        }
        
        if (suggestions.length > 0) {
            eventBus.emit('relationship:improvement-suggestions', {
                relationshipId,
                suggestions,
                currentMetrics: metrics
            });
        }
    }
    
    saveContractData() {
        try {
            const data = {
                activeContracts: Array.from(this.activeContracts.entries()),
                contractHistory: Array.from(this.contractHistory.entries()),
                titheHistory: Array.from(this.titheCollection.entries()),
                timestamp: Date.now()
            };
            localStorage.setItem('agent-neo-symbiotic-contracts', JSON.stringify(data));
        } catch (error) {
            console.warn('Failed to save contract data:', error);
        }
    }
    
    // Public API methods
    getActiveContracts() {
        return Array.from(this.activeContracts.values());
    }
    
    getContractsByModule(moduleId) {
        return Array.from(this.activeContracts.values()).filter(
            contract => contract.providerModuleId === moduleId || 
                       contract.consumerModuleId === moduleId
        );
    }
    
    getSymbioticRelationships() {
        return Array.from(this.symbioticPairs.values());
    }
    
    getRelationshipMetrics(relationshipId) {
        return this.relationshipMetrics.get(relationshipId);
    }
    
    getTitheHistory(contractId) {
        return Array.from(this.titheCollection.values()).filter(
            tithe => tithe.contractId === contractId
        );
    }
    
    getContractTypes() {
        return Array.from(this.contractTypes.entries()).map(([type, spec]) => ({
            type,
            description: spec.description,
            defaultTitheRate: spec.defaultTitheRate,
            requiredCapabilities: spec.requiredCapabilities
        }));
    }
    
    getSystemStats() {
        return {
            activeContracts: this.activeContracts.size,
            symbioticPairs: this.symbioticPairs.size,
            totalTithesCollected: Array.from(this.titheCollection.values())
                .reduce((sum, tithe) => sum + tithe.amount, 0),
            averageSatisfaction: this.calculateAverageSatisfaction(),
            contractTypes: this.contractTypes.size
        };
    }
    
    calculateAverageSatisfaction() {
        const metrics = Array.from(this.relationshipMetrics.values());
        if (metrics.length === 0) return 0;
        
        return metrics.reduce((sum, metric) => sum + metric.mutualSatisfaction, 0) / metrics.length;
    }
    
    getStatus() {
        return {
            name: this.name,
            version: this.version,
            initialized: this.initialized,
            active: this.active,
            activeContracts: this.activeContracts.size,
            symbioticPairs: this.symbioticPairs.size,
            pendingProposals: this.pendingProposals.size,
            systemStats: this.getSystemStats()
        };
    }
}

export default SymbioticContractsSystem;