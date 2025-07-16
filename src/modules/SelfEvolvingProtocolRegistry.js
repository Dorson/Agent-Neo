/**
 * Self-Evolving Protocol Registry
 * 
 * Implements the self-governing protocol system described in the whitepaper.
 * Manages protocol evolution, version control, and network consensus for 
 * protocol updates without requiring hard forks.
 * 
 * Key Features:
 * - Dynamic protocol binding
 * - Version control and migration
 * - Consensus-based protocol evolution
 * - Cross-network protocol adapters
 * - Discovery meta-protocol
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';

class SelfEvolvingProtocolRegistry {
    constructor() {
        this.name = 'SelfEvolvingProtocolRegistry';
        this.version = '1.0.0';
        this.initialized = false;
        this.active = false;
        
        // Protocol registry (CRDT-replicated)
        this.protocols = new Map();
        this.protocolHistory = new Map();
        this.pendingProposals = new Map();
        this.votingRecords = new Map();
        
        // Protocol adapters for cross-network compatibility
        this.adapters = new Map();
        this.activeAdapters = new Set();
        
        // Network fragmentation tracking
        this.networkFragments = new Map();
        this.bridgeConnections = new Map();
        
        // Configuration
        this.config = {
            consensusThreshold: 0.67, // 67% agreement needed
            proposalTimeoutMs: 300000, // 5 minutes
            minReputationForProposal: 500,
            minReputationForVoting: 100,
            versionRetentionDays: 30,
            maxConcurrentProposals: 5,
            fragmentationThreshold: 0.3 // 30% network split tolerance
        };
        
        // Core immutable protocols (never change)
        this.coreProtocols = new Map([
            ['discovery', {
                version: 1,
                topic: '/agent-neo/discovery/v1',
                schema: 'AgentNeoDiscovery_v1',
                immutable: true,
                description: 'Meta-protocol for network discovery'
            }],
            ['ethics', {
                version: 1,
                topic: '/agent-neo/ethics/v1',
                schema: 'AgentNeoEthics_v1',
                immutable: true,
                description: 'Ethics validation and reporting'
            }]
        ]);
        
        // Discovery meta-protocol (hyperStable)
        this.metaProtocol = {
            topic: '/agent-neo/meta/discovery',
            version: 1,
            purpose: 'Cross-network species discovery and bridging'
        };
        
        this.init();
    }
    
    async init() {
        try {
            console.log('🔄 Initializing Self-Evolving Protocol Registry...');
            
            this.setupEventListeners();
            await this.loadProtocolRegistry();
            this.initializeCoreProtocols();
            this.startMetaProtocolDiscovery();
            
            this.initialized = true;
            console.log('✅ Self-Evolving Protocol Registry initialized');
            
            eventBus.emit('module:initialized', {
                name: this.name,
                version: this.version,
                protocolCount: this.protocols.size
            });
            
        } catch (error) {
            console.error('❌ Protocol Registry initialization failed:', error);
            throw error;
        }
    }
    
    setupEventListeners() {
        // Protocol management
        eventBus.on('protocol:propose', this.proposeProtocolUpdate.bind(this));
        eventBus.on('protocol:vote', this.voteOnProposal.bind(this));
        eventBus.on('protocol:query', this.queryProtocol.bind(this));
        eventBus.on('protocol:bind', this.bindToProtocol.bind(this));
        
        // Network fragmentation
        eventBus.on('network:fragment-detected', this.handleFragmentation.bind(this));
        eventBus.on('network:bridge-request', this.createProtocolBridge.bind(this));
        
        // Registry synchronization
        eventBus.on('registry:sync-request', this.syncRegistry.bind(this));
        eventBus.on('registry:update-received', this.processRegistryUpdate.bind(this));
    }
    
    async loadProtocolRegistry() {
        try {
            const stored = localStorage.getItem('agent-neo-protocol-registry');
            if (stored) {
                const data = JSON.parse(stored);
                this.protocols = new Map(data.protocols);
                this.protocolHistory = new Map(data.history);
                console.log('📋 Loaded', this.protocols.size, 'protocols from storage');
            }
        } catch (error) {
            console.warn('Failed to load protocol registry:', error);
        }
    }
    
    initializeCoreProtocols() {
        // Register immutable core protocols
        for (const [name, protocol] of this.coreProtocols) {
            this.protocols.set(name, {
                ...protocol,
                registeredAt: Date.now(),
                lastUsed: Date.now(),
                usage: 0
            });
        }
        
        // Register dynamic protocols
        const dynamicProtocols = [
            {
                name: 'task_auction',
                version: 2,
                topic: '/agent-neo/task-auction/v2',
                schema: 'TaskAuction_v2',
                description: 'Task bidding and auction system'
            },
            {
                name: 'knowledge_sync',
                version: 1,
                topic: '/agent-neo/knowledge-sync/v1',
                schema: 'KnowledgeSync_v1',
                description: 'Knowledge graph synchronization'
            },
            {
                name: 'consensus',
                version: 1,
                topic: '/agent-neo/consensus/v1',
                schema: 'Consensus_v1',
                description: 'Distributed consensus mechanism'
            }
        ];
        
        for (const protocol of dynamicProtocols) {
            this.registerProtocol(protocol);
        }
    }
    
    registerProtocol(protocolSpec) {
        const protocol = {
            ...protocolSpec,
            registeredAt: Date.now(),
            lastUsed: Date.now(),
            usage: 0,
            reputation: 1000 // Initial reputation
        };
        
        this.protocols.set(protocolSpec.name, protocol);
        this.saveRegistry();
        
        eventBus.emit('protocol:registered', {
            name: protocolSpec.name,
            version: protocolSpec.version,
            topic: protocolSpec.topic
        });
    }
    
    async proposeProtocolUpdate(proposalData) {
        const { protocolName, newVersion, changes, proposerId, reputation } = proposalData;
        
        // Validate proposer reputation
        if (reputation < this.config.minReputationForProposal) {
            throw new Error('Insufficient reputation to propose protocol update');
        }
        
        // Check if protocol exists
        const currentProtocol = this.protocols.get(protocolName);
        if (!currentProtocol) {
            throw new Error(`Protocol ${protocolName} not found`);
        }
        
        // Check if immutable
        if (currentProtocol.immutable) {
            throw new Error(`Cannot modify immutable protocol ${protocolName}`);
        }
        
        // Create proposal
        const proposalId = `${protocolName}_v${newVersion}_${Date.now()}`;
        const proposal = {
            id: proposalId,
            protocolName,
            currentVersion: currentProtocol.version,
            newVersion,
            changes,
            proposerId,
            proposerReputation: reputation,
            createdAt: Date.now(),
            expiresAt: Date.now() + this.config.proposalTimeoutMs,
            votes: new Map(),
            status: 'active'
        };
        
        this.pendingProposals.set(proposalId, proposal);
        
        // Broadcast proposal to network
        eventBus.emit('network:broadcast', {
            topic: this.metaProtocol.topic,
            message: {
                type: 'protocol_proposal',
                proposal: proposal
            }
        });
        
        // Start voting timer
        setTimeout(() => this.finalizeProposal(proposalId), this.config.proposalTimeoutMs);
        
        console.log(`📋 Protocol update proposed: ${protocolName} v${newVersion}`);
        return proposalId;
    }
    
    async voteOnProposal(voteData) {
        const { proposalId, vote, voterId, reputation } = voteData;
        
        // Validate voter reputation
        if (reputation < this.config.minReputationForVoting) {
            throw new Error('Insufficient reputation to vote');
        }
        
        const proposal = this.pendingProposals.get(proposalId);
        if (!proposal) {
            throw new Error('Proposal not found');
        }
        
        if (proposal.status !== 'active') {
            throw new Error('Proposal is not active');
        }
        
        if (Date.now() > proposal.expiresAt) {
            throw new Error('Proposal has expired');
        }
        
        // Record vote (reputation-weighted)
        proposal.votes.set(voterId, {
            vote: vote, // 'approve' or 'reject'
            reputation: reputation,
            timestamp: Date.now()
        });
        
        // Broadcast vote
        eventBus.emit('network:broadcast', {
            topic: this.metaProtocol.topic,
            message: {
                type: 'protocol_vote',
                proposalId,
                vote,
                voterId,
                reputation
            }
        });
        
        console.log(`🗳️ Vote recorded: ${vote} for proposal ${proposalId}`);
    }
    
    async finalizeProposal(proposalId) {
        const proposal = this.pendingProposals.get(proposalId);
        if (!proposal || proposal.status !== 'active') {
            return;
        }
        
        // Calculate reputation-weighted consensus
        let totalReputationFor = 0;
        let totalReputationAgainst = 0;
        let totalReputation = 0;
        
        for (const [voterId, voteData] of proposal.votes) {
            totalReputation += voteData.reputation;
            if (voteData.vote === 'approve') {
                totalReputationFor += voteData.reputation;
            } else {
                totalReputationAgainst += voteData.reputation;
            }
        }
        
        const consensusRatio = totalReputationFor / totalReputation;
        const approved = consensusRatio >= this.config.consensusThreshold;
        
        proposal.status = approved ? 'approved' : 'rejected';
        proposal.finalizedAt = Date.now();
        proposal.consensusRatio = consensusRatio;
        
        if (approved) {
            // Apply protocol update
            await this.applyProtocolUpdate(proposal);
            console.log(`✅ Protocol update approved: ${proposal.protocolName} v${proposal.newVersion}`);
        } else {
            console.log(`❌ Protocol update rejected: ${proposal.protocolName} v${proposal.newVersion}`);
        }
        
        // Archive proposal
        this.votingRecords.set(proposalId, proposal);
        this.pendingProposals.delete(proposalId);
        
        // Broadcast result
        eventBus.emit('network:broadcast', {
            topic: this.metaProtocol.topic,
            message: {
                type: 'proposal_finalized',
                proposalId,
                approved,
                consensusRatio
            }
        });
        
        this.saveRegistry();
    }
    
    async applyProtocolUpdate(proposal) {
        const { protocolName, newVersion, changes } = proposal;
        const currentProtocol = this.protocols.get(protocolName);
        
        // Store old version in history
        this.protocolHistory.set(
            `${protocolName}_v${currentProtocol.version}`,
            { ...currentProtocol, archivedAt: Date.now() }
        );
        
        // Apply changes
        const updatedProtocol = {
            ...currentProtocol,
            version: newVersion,
            topic: `/agent-neo/${protocolName}/v${newVersion}`,
            ...changes,
            updatedAt: Date.now(),
            previousVersion: currentProtocol.version
        };
        
        this.protocols.set(protocolName, updatedProtocol);
        
        // Notify modules to rebind
        eventBus.emit('protocol:updated', {
            name: protocolName,
            oldVersion: currentProtocol.version,
            newVersion: newVersion,
            topic: updatedProtocol.topic
        });
    }
    
    queryProtocol(protocolName) {
        const protocol = this.protocols.get(protocolName);
        if (!protocol) {
            throw new Error(`Protocol ${protocolName} not found`);
        }
        
        // Update usage statistics
        protocol.lastUsed = Date.now();
        protocol.usage++;
        
        return {
            name: protocolName,
            version: protocol.version,
            topic: protocol.topic,
            schema: protocol.schema
        };
    }
    
    bindToProtocol(bindingData) {
        const { protocolName, moduleId } = bindingData;
        const protocol = this.queryProtocol(protocolName);
        
        console.log(`🔗 Module ${moduleId} bound to protocol ${protocolName} v${protocol.version}`);
        
        return protocol;
    }
    
    async createProtocolBridge(bridgeData) {
        const { fromNetwork, toNetwork, protocolName } = bridgeData;
        
        // Create adapter for cross-network communication
        const adapterId = `${fromNetwork}_to_${toNetwork}_${protocolName}`;
        const adapter = {
            id: adapterId,
            fromNetwork,
            toNetwork,
            protocolName,
            createdAt: Date.now(),
            active: true,
            messageCount: 0
        };
        
        this.adapters.set(adapterId, adapter);
        this.activeAdapters.add(adapterId);
        
        console.log(`🌉 Protocol bridge created: ${adapterId}`);
        
        // Register bridge in network
        eventBus.emit('network:bridge-created', {
            adapterId,
            fromNetwork,
            toNetwork,
            protocolName
        });
        
        return adapterId;
    }
    
    startMetaProtocolDiscovery() {
        // Listen for other Agent Neo networks
        eventBus.on('network:message', (data) => {
            if (data.topic === this.metaProtocol.topic) {
                this.handleMetaProtocolMessage(data.message);
            }
        });
        
        // Periodically announce our existence
        setInterval(() => {
            eventBus.emit('network:broadcast', {
                topic: this.metaProtocol.topic,
                message: {
                    type: 'network_announcement',
                    networkId: stateManager.getState('network.nodeId'),
                    protocolRegistry: this.getRegistrySnapshot(),
                    capabilities: this.getNetworkCapabilities(),
                    timestamp: Date.now()
                }
            });
        }, 60000); // Every minute
    }
    
    handleMetaProtocolMessage(message) {
        switch (message.type) {
            case 'network_announcement':
                this.processNetworkDiscovery(message);
                break;
            case 'protocol_proposal':
                this.processExternalProposal(message.proposal);
                break;
            case 'protocol_vote':
                this.processExternalVote(message);
                break;
            case 'proposal_finalized':
                this.processProposalResult(message);
                break;
        }
    }
    
    processNetworkDiscovery(announcement) {
        const { networkId, protocolRegistry, capabilities } = announcement;
        
        // Check for protocol compatibility
        const compatibility = this.assessCompatibility(protocolRegistry);
        
        if (compatibility.canBridge) {
            // Create bridges for compatible protocols
            for (const protocol of compatibility.bridgeableProtocols) {
                this.createProtocolBridge({
                    fromNetwork: stateManager.getState('network.nodeId'),
                    toNetwork: networkId,
                    protocolName: protocol
                });
            }
        }
        
        // Store network information
        this.networkFragments.set(networkId, {
            protocolRegistry,
            capabilities,
            lastSeen: Date.now(),
            compatibility
        });
    }
    
    assessCompatibility(externalRegistry) {
        const bridgeableProtocols = [];
        let compatibilityScore = 0;
        
        for (const [name, protocol] of this.protocols) {
            if (externalRegistry[name]) {
                const external = externalRegistry[name];
                if (external.schema === protocol.schema) {
                    // Perfect compatibility
                    compatibilityScore += 1;
                } else if (this.canCreateAdapter(protocol, external)) {
                    // Requires adapter but possible
                    bridgeableProtocols.push(name);
                    compatibilityScore += 0.5;
                }
            }
        }
        
        return {
            score: compatibilityScore / this.protocols.size,
            canBridge: bridgeableProtocols.length > 0,
            bridgeableProtocols
        };
    }
    
    canCreateAdapter(protocol1, protocol2) {
        // Simple heuristic: same protocol name with different versions
        // In reality, this would involve more sophisticated schema analysis
        return protocol1.name === protocol2.name && 
               Math.abs(protocol1.version - protocol2.version) <= 2;
    }
    
    getRegistrySnapshot() {
        const snapshot = {};
        for (const [name, protocol] of this.protocols) {
            snapshot[name] = {
                version: protocol.version,
                schema: protocol.schema,
                reputation: protocol.reputation || 1000
            };
        }
        return snapshot;
    }
    
    getNetworkCapabilities() {
        return {
            supportedProtocols: Array.from(this.protocols.keys()),
            adapterCount: this.adapters.size,
            reputation: stateManager.getState('node.reputation', 1000),
            specializations: this.getSpecializations()
        };
    }
    
    getSpecializations() {
        // Determine what this node specializes in based on protocol usage
        const specializations = [];
        for (const [name, protocol] of this.protocols) {
            if (protocol.usage > 100) {
                specializations.push(name);
            }
        }
        return specializations;
    }
    
    saveRegistry() {
        try {
            const data = {
                protocols: Array.from(this.protocols.entries()),
                history: Array.from(this.protocolHistory.entries()),
                timestamp: Date.now()
            };
            localStorage.setItem('agent-neo-protocol-registry', JSON.stringify(data));
        } catch (error) {
            console.warn('Failed to save protocol registry:', error);
        }
    }
    
    // Public API methods
    getProtocol(name) {
        return this.queryProtocol(name);
    }
    
    getAllProtocols() {
        const protocols = {};
        for (const [name, protocol] of this.protocols) {
            protocols[name] = {
                version: protocol.version,
                topic: protocol.topic,
                schema: protocol.schema,
                usage: protocol.usage,
                lastUsed: protocol.lastUsed
            };
        }
        return protocols;
    }
    
    getProtocolHistory(name) {
        const history = [];
        for (const [key, protocol] of this.protocolHistory) {
            if (key.startsWith(`${name}_v`)) {
                history.push(protocol);
            }
        }
        return history.sort((a, b) => b.archivedAt - a.archivedAt);
    }
    
    getNetworkFragments() {
        return Array.from(this.networkFragments.entries()).map(([id, fragment]) => ({
            networkId: id,
            compatibility: fragment.compatibility,
            lastSeen: fragment.lastSeen,
            capabilities: fragment.capabilities
        }));
    }
    
    getStatus() {
        return {
            name: this.name,
            version: this.version,
            initialized: this.initialized,
            active: this.active,
            protocolCount: this.protocols.size,
            pendingProposals: this.pendingProposals.size,
            activeAdapters: this.activeAdapters.size,
            networkFragments: this.networkFragments.size
        };
    }
}

export default SelfEvolvingProtocolRegistry;