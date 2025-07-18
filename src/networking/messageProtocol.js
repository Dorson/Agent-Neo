/**
 * Message Protocol Module
 * 
 * Defines standardized, versioned message formats and protocols for inter-agent
 * communication as specified in the Agent Neo implementation plan Step 11.
 * 
 * Features:
 * - JSON-LD semantic interoperability
 * - BLS ring signature meta flags
 * - DID-signed message verification
 * - Versioned protocol support
 * - Structured serialization/deserialization
 */

import eventBus from '../core/EventBus.js';
import identityManager from '../core/IdentityManager.js';
import cryptoManager from '../core/CryptoManager.js';

class MessageProtocol {
    constructor() {
        this.version = '1.0.0';
        this.initialized = false;
        
        // Message type definitions
        this.messageTypes = {
            // Basic protocol messages
            PING: 'ping',
            PONG: 'pong',
            HEARTBEAT: 'heartbeat',
            
            // Task-related messages
            TASK_REQUEST: 'task_request',
            TASK_RESPONSE: 'task_response',
            TASK_BID: 'task_bid',
            TASK_AWARD: 'task_award',
            TASK_EXECUTION: 'task_execution',
            TASK_RESULT: 'task_result',
            
            // Guild-related messages
            GUILD_INVITE: 'guild_invite',
            GUILD_JOIN: 'guild_join',
            GUILD_LEAVE: 'guild_leave',
            GUILD_VOTE: 'guild_vote',
            GUILD_PROPOSAL: 'guild_proposal',
            GUILD_CONSENSUS: 'guild_consensus',
            
            // Knowledge-related messages
            KNOWLEDGE_QUERY: 'knowledge_query',
            KNOWLEDGE_CHUNK: 'knowledge_chunk',
            KNOWLEDGE_UPDATE: 'knowledge_update',
            KNOWLEDGE_SYNC: 'knowledge_sync',
            
            // Trust and reputation messages
            TRUST_REPORT: 'trust_report',
            REPUTATION_UPDATE: 'reputation_update',
            PEER_SCORE: 'peer_score',
            
            // Cryptographic messages
            ZKP_PROOF: 'zkp_proof',
            ZKP_CHALLENGE: 'zkp_challenge',
            ZKP_RESPONSE: 'zkp_response',
            
            // Data transfer messages
            DATA_REQUEST: 'data_request',
            DATA_CHUNK: 'data_chunk',
            DATA_COMPLETE: 'data_complete',
            
            // Protocol evolution messages
            PROTOCOL_UPGRADE: 'protocol_upgrade',
            PROTOCOL_VOTE: 'protocol_vote'
        };
        
        // JSON-LD context for semantic interoperability
        this.jsonLdContext = {
            '@context': {
                '@version': 1.1,
                'neo': 'https://agent-neo.org/vocab#',
                'did': 'https://www.w3.org/ns/did/v1',
                'xsd': 'http://www.w3.org/2001/XMLSchema#',
                
                // Core entities
                'Agent': 'neo:Agent',
                'Guild': 'neo:Guild',
                'Task': 'neo:Task',
                'Message': 'neo:Message',
                
                // Properties
                'sender': { '@id': 'neo:sender', '@type': '@id' },
                'recipient': { '@id': 'neo:recipient', '@type': '@id' },
                'timestamp': { '@id': 'neo:timestamp', '@type': 'xsd:dateTime' },
                'signature': 'neo:signature',
                'messageType': 'neo:messageType',
                'payload': 'neo:payload',
                'version': 'neo:version',
                'nonce': 'neo:nonce',
                'trustScore': { '@id': 'neo:trustScore', '@type': 'xsd:decimal' },
                'metabolicLoad': { '@id': 'neo:metabolicLoad', '@type': 'xsd:decimal' }
            }
        };
        
        // Meta flags structure for BLS ring signatures
        this.metaFlagsSchema = {
            favorite_count: { type: 'integer', min: 0 },
            safe_count: { type: 'integer', min: 0 },
            spam_count: { type: 'integer', min: 0 },
            verified_count: { type: 'integer', min: 0 },
            quality_score: { type: 'float', min: 0.0, max: 1.0 },
            ring_signatures: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        flag_type: { type: 'string' },
                        signature: { type: 'string' },
                        ring_members: { type: 'array', items: { type: 'string' } },
                        timestamp: { type: 'string', format: 'date-time' }
                    }
                }
            }
        };
        
        this.init();
    }

    async init() {
        try {
            console.log('📨 Message Protocol initializing...');
            
            // Set up event listeners
            this.setupEventListeners();
            
            this.initialized = true;
            console.log('✅ Message Protocol initialized successfully');
            
        } catch (error) {
            console.error('❌ Message Protocol initialization failed:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Listen for outgoing message requests
        eventBus.on('protocol:send_message', this.handleOutgoingMessage.bind(this));
        
        // Listen for incoming messages that need processing
        eventBus.on('protocol:process_message', this.handleIncomingMessage.bind(this));
        
        // Listen for meta flag updates
        eventBus.on('protocol:update_meta_flags', this.handleMetaFlagUpdate.bind(this));
    }

    /**
     * Create a standardized message structure
     */
    async createMessage(type, payload, recipient = null, options = {}) {
        try {
            if (!this.messageTypes[type]) {
                throw new Error(`Unknown message type: ${type}`);
            }

            const senderDID = await identityManager.getDID();
            if (!senderDID) {
                throw new Error('No DID available for message signing');
            }

            // Base message structure with JSON-LD context
            const message = {
                '@context': this.jsonLdContext['@context'],
                '@type': 'Message',
                '@id': `urn:uuid:${crypto.randomUUID()}`,
                
                // Core message fields
                messageType: type,
                version: this.version,
                sender: senderDID,
                recipient: recipient,
                timestamp: new Date().toISOString(),
                nonce: await this.generateNonce(),
                
                // Payload
                payload: payload,
                
                // Optional metadata
                ...options
            };

            // Add meta flags if provided
            if (options.metaFlags) {
                message.metaFlags = await this.validateMetaFlags(options.metaFlags);
            }

            // Sign the message
            const messageHash = await cryptoManager.sha256(JSON.stringify(message));
            const signature = await cryptoManager.sign(messageHash);
            
            message.signature = signature;
            message.messageHash = messageHash;

            return message;

        } catch (error) {
            console.error('❌ Failed to create message:', error);
            throw error;
        }
    }

    /**
     * Serialize message for transmission
     */
    serializeMessage(message) {
        try {
            // Ensure consistent serialization
            const serialized = JSON.stringify(message, Object.keys(message).sort());
            return serialized;
        } catch (error) {
            console.error('❌ Failed to serialize message:', error);
            throw error;
        }
    }

    /**
     * Deserialize and validate incoming message
     */
    async deserializeMessage(messageData) {
        try {
            let message;
            
            if (typeof messageData === 'string') {
                message = JSON.parse(messageData);
            } else {
                message = messageData;
            }

            // Validate message structure
            await this.validateMessage(message);
            
            return message;

        } catch (error) {
            console.error('❌ Failed to deserialize message:', error);
            throw error;
        }
    }

    /**
     * Validate message structure and signature
     */
    async validateMessage(message) {
        try {
            // Check required fields
            const requiredFields = ['@context', '@type', 'messageType', 'sender', 'timestamp', 'signature'];
            for (const field of requiredFields) {
                if (!message[field]) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }

            // Validate message type
            if (!Object.values(this.messageTypes).includes(message.messageType)) {
                throw new Error(`Invalid message type: ${message.messageType}`);
            }

            // Validate timestamp (not too old or in future)
            const timestamp = new Date(message.timestamp);
            const now = new Date();
            const maxAge = 10 * 60 * 1000; // 10 minutes
            const maxFuture = 1 * 60 * 1000; // 1 minute

            if (now - timestamp > maxAge) {
                throw new Error('Message too old');
            }
            if (timestamp - now > maxFuture) {
                throw new Error('Message timestamp in future');
            }

            // Verify signature
            const messageForVerification = { ...message };
            delete messageForVerification.signature;
            delete messageForVerification.messageHash;
            
            const messageHash = await cryptoManager.sha256(JSON.stringify(messageForVerification));
            const signatureValid = await cryptoManager.verify(messageHash, message.signature, message.sender);
            
            if (!signatureValid) {
                throw new Error('Invalid message signature');
            }

            // Validate meta flags if present
            if (message.metaFlags) {
                await this.validateMetaFlags(message.metaFlags);
            }

            return true;

        } catch (error) {
            console.error('❌ Message validation failed:', error);
            throw error;
        }
    }

    /**
     * Validate meta flags structure and ring signatures
     */
    async validateMetaFlags(metaFlags) {
        try {
            // Validate structure against schema
            for (const [key, value] of Object.entries(metaFlags)) {
                if (this.metaFlagsSchema[key]) {
                    const schema = this.metaFlagsSchema[key];
                    
                    if (schema.type === 'integer' && !Number.isInteger(value)) {
                        throw new Error(`Invalid ${key}: must be integer`);
                    }
                    if (schema.type === 'float' && typeof value !== 'number') {
                        throw new Error(`Invalid ${key}: must be number`);
                    }
                    if (schema.min !== undefined && value < schema.min) {
                        throw new Error(`Invalid ${key}: below minimum ${schema.min}`);
                    }
                    if (schema.max !== undefined && value > schema.max) {
                        throw new Error(`Invalid ${key}: above maximum ${schema.max}`);
                    }
                }
            }

            // Validate ring signatures if present
            if (metaFlags.ring_signatures) {
                for (const ringSig of metaFlags.ring_signatures) {
                    await this.validateRingSignature(ringSig);
                }
            }

            return metaFlags;

        } catch (error) {
            console.error('❌ Meta flags validation failed:', error);
            throw error;
        }
    }

    /**
     * Validate BLS ring signature
     */
    async validateRingSignature(ringSignature) {
        try {
            // Verify ring signature structure
            if (!ringSignature.signature || !ringSignature.ring_members || !ringSignature.flag_type) {
                throw new Error('Invalid ring signature structure');
            }

            // Verify the BLS ring signature
            const isValid = await cryptoManager.verifyRingSignature(
                ringSignature.flag_type,
                ringSignature.signature,
                ringSignature.ring_members
            );

            if (!isValid) {
                throw new Error('Invalid BLS ring signature');
            }

            return true;

        } catch (error) {
            console.error('❌ Ring signature validation failed:', error);
            throw error;
        }
    }

    /**
     * Handle outgoing message
     */
    async handleOutgoingMessage(event) {
        try {
            const { type, payload, recipient, options } = event.detail;
            
            // Create standardized message
            const message = await this.createMessage(type, payload, recipient, options);
            
            // Serialize for transmission
            const serializedMessage = this.serializeMessage(message);
            
            // Dispatch for network transmission
            eventBus.emit('network:send_message', {
                message: serializedMessage,
                recipient: recipient
            });

        } catch (error) {
            console.error('❌ Failed to handle outgoing message:', error);
            eventBus.emit('protocol:message_error', { error: error.message });
        }
    }

    /**
     * Handle incoming message
     */
    async handleIncomingMessage(event) {
        try {
            const { messageData, sender } = event.detail;
            
            // Deserialize and validate
            const message = await this.deserializeMessage(messageData);
            
            // Route to appropriate handler based on message type
            eventBus.emit(`protocol:${message.messageType}`, {
                message: message,
                sender: sender
            });

        } catch (error) {
            console.error('❌ Failed to handle incoming message:', error);
            eventBus.emit('protocol:message_error', { 
                error: error.message,
                sender: event.detail.sender 
            });
        }
    }

    /**
     * Handle meta flag updates with ring signatures
     */
    async handleMetaFlagUpdate(event) {
        try {
            const { targetId, flagType, ringMembers } = event.detail;
            
            // Create ring signature for the flag
            const ringSignature = await cryptoManager.createRingSignature(flagType, ringMembers);
            
            // Update meta flags
            eventBus.emit('protocol:meta_flag_updated', {
                targetId: targetId,
                flagType: flagType,
                ringSignature: ringSignature
            });

        } catch (error) {
            console.error('❌ Failed to handle meta flag update:', error);
            throw error;
        }
    }

    /**
     * Generate cryptographic nonce
     */
    async generateNonce() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Get message type constants
     */
    getMessageTypes() {
        return { ...this.messageTypes };
    }

    /**
     * Get JSON-LD context
     */
    getJsonLdContext() {
        return { ...this.jsonLdContext };
    }

    /**
     * Get meta flags schema
     */
    getMetaFlagsSchema() {
        return { ...this.metaFlagsSchema };
    }

    /**
     * Create specific message types with predefined structures
     */
    async createTaskBid(taskId, bidAmount, confidence, plan) {
        return await this.createMessage('TASK_BID', {
            taskId: taskId,
            bidAmount: bidAmount,
            confidence: confidence,
            plan: plan,
            estimatedDuration: plan.estimatedDuration,
            requiredResources: plan.requiredResources
        });
    }

    async createGuildVote(proposalId, vote, reasoning) {
        return await this.createMessage('GUILD_VOTE', {
            proposalId: proposalId,
            vote: vote, // 'yes', 'no', 'abstain'
            reasoning: reasoning,
            voterReputation: await this.getOwnReputation()
        });
    }

    async createKnowledgeQuery(query, context, maxResults = 10) {
        return await this.createMessage('KNOWLEDGE_QUERY', {
            query: query,
            context: context,
            maxResults: maxResults,
            queryType: 'semantic'
        });
    }

    async createZkpProof(claimType, proof, publicInputs) {
        return await this.createMessage('ZKP_PROOF', {
            claimType: claimType,
            proof: proof,
            publicInputs: publicInputs,
            proofSystem: 'zk-stark'
        });
    }

    /**
     * Get own reputation for message context
     */
    async getOwnReputation() {
        try {
            // This would integrate with the reputation system
            return 0; // Placeholder
        } catch (error) {
            console.error('❌ Failed to get own reputation:', error);
            return 0;
        }
    }
}

// Create and export singleton instance
const messageProtocol = new MessageProtocol();
export default messageProtocol;