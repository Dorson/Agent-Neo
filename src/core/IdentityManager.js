/**
 * Identity Manager Module
 * 
 * Manages the agent's full identity lifecycle, including persistent DID,
 * rotating operational keys, secure user authentication, and account recovery.
 * This module is the central authority for all cryptographic identity operations.
 * 
 * Features:
 * - DID generation and management
 * - WebAuthn integration for secure authentication
 * - Key rotation for operational security
 * - Account recovery mechanisms
 * - Secure password management
 */

import eventBus from './EventBus.js';
import CryptoManager from './CryptoManager.js';

class IdentityManager {
    constructor() {
        this.initialized = false;
        this.unlocked = false;
        this.agentDID = null;
        this.identityKey = null;
        this.operationalKey = null;
        this.operationalCertificate = null;
        this.webAuthnCredentialId = null;
        
        // Key rotation settings
        this.keyRotationInterval = 7 * 24 * 60 * 60 * 1000; // 7 days
        this.lastKeyRotation = null;
        
        // Recovery settings
        this.recoveryKit = null;
        
        this.init();
    }

    async init() {
        try {
            console.log('🔐 Identity Manager initializing...');
            
            // Check if identity already exists
            const existingIdentity = await this.loadExistingIdentity();
            
            if (existingIdentity) {
                this.agentDID = existingIdentity.did;
                this.webAuthnCredentialId = existingIdentity.credentialId;
                this.lastKeyRotation = existingIdentity.lastKeyRotation;
                console.log('✅ Existing identity loaded:', this.agentDID);
            } else {
                console.log('🆕 No existing identity found, ready for setup');
            }
            
            this.setupEventListeners();
            this.initialized = true;
            
            eventBus.emit('identity:initialized', {
                hasIdentity: !!this.agentDID,
                did: this.agentDID
            });
            
        } catch (error) {
            console.error('❌ Identity Manager initialization failed:', error);
            throw error;
        }
    }

    setupEventListeners() {
        eventBus.on('identity:create', this.createIdentity.bind(this));
        eventBus.on('identity:unlock', this.unlockSession.bind(this));
        eventBus.on('identity:lock', this.lockSession.bind(this));
        eventBus.on('identity:rotate_keys', this.rotateKeys.bind(this));
        eventBus.on('identity:change_password', this.changePassword.bind(this));
        eventBus.on('identity:create_recovery', this.createRecoveryKit.bind(this));
        eventBus.on('identity:recover', this.recoverAccount.bind(this));
        
        // Auto key rotation check
        setInterval(() => this.checkKeyRotation(), 60 * 60 * 1000); // Check hourly
    }

    /**
     * Create a new agent identity
     * @param {string} password - User password for key encryption
     * @param {boolean} enableWebAuthn - Whether to enable WebAuthn
     */
    async createIdentity(event) {
        try {
            const { password, enableWebAuthn = true } = event.detail;
            
            if (this.agentDID) {
                throw new Error('Identity already exists');
            }
            
            console.log('🆕 Creating new agent identity...');
            
            // Step 1: Generate Identity Key
            const identityKeyPair = await CryptoManager.generateBLSKeyPair();
            this.identityKey = identityKeyPair;
            
            // Step 2: Derive DID from public key
            this.agentDID = await this.deriveDID(identityKeyPair.publicKey);
            
            // Step 3: Encrypt Identity Key with password
            const encryptedIdentityKey = await CryptoManager.encryptWithPassword(
                identityKeyPair.privateKey,
                password
            );
            
            // Step 4: WebAuthn registration if enabled
            if (enableWebAuthn && this.isWebAuthnSupported()) {
                this.webAuthnCredentialId = await this.registerWebAuthn();
            }
            
            // Step 5: Generate initial operational key
            await this.generateOperationalKey(password);
            
            // Step 6: Store encrypted identity
            await this.storeIdentity({
                did: this.agentDID,
                encryptedIdentityKey,
                credentialId: this.webAuthnCredentialId,
                lastKeyRotation: Date.now()
            });
            
            // Step 7: Generate DID Document
            const didDocument = await this.generateDIDDocument();
            
            console.log('✅ Agent identity created successfully:', this.agentDID);
            
            eventBus.emit('identity:created', {
                did: this.agentDID,
                didDocument,
                timestamp: Date.now()
            });
            
            // Prompt for recovery kit creation
            eventBus.emit('identity:recovery_prompt', {
                message: 'Please create a recovery kit to secure your identity'
            });
            
        } catch (error) {
            console.error('❌ Identity creation failed:', error);
            eventBus.emit('identity:error', { error, operation: 'create' });
            throw error;
        }
    }

    /**
     * Derive DID from public key
     * @param {string} publicKey - Base64 encoded public key
     * @returns {string} - DID in format did:neo:<hash>
     */
    async deriveDID(publicKey) {
        try {
            // Create a hash of the public key
            const hash = await CryptoManager.hash(publicKey);
            
            // Take first 32 characters for DID
            const didSuffix = hash.substring(0, 32);
            
            return `did:neo:${didSuffix}`;
        } catch (error) {
            console.error('❌ DID derivation failed:', error);
            throw error;
        }
    }

    /**
     * Generate DID Document
     * @returns {Object} - DID Document
     */
    async generateDIDDocument() {
        try {
            if (!this.agentDID || !this.identityKey || !this.operationalKey) {
                throw new Error('Identity or operational keys not available');
            }

            const didDocument = {
                '@context': [
                    'https://www.w3.org/ns/did/v1',
                    'https://w3id.org/security/suites/ed25519-2020/v1'
                ],
                id: this.agentDID,
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
                verificationMethod: [
                    {
                        id: `${this.agentDID}#identity-key`,
                        type: 'BLS12381G2Key2020',
                        controller: this.agentDID,
                        publicKeyBase64: this.identityKey.publicKey
                    },
                    {
                        id: `${this.agentDID}#operational-key`,
                        type: 'BLS12381G2Key2020',
                        controller: this.agentDID,
                        publicKeyBase64: this.operationalKey.publicKey,
                        validFrom: new Date().toISOString(),
                        validUntil: new Date(Date.now() + this.keyRotationInterval).toISOString()
                    }
                ],
                authentication: [
                    `${this.agentDID}#identity-key`,
                    `${this.agentDID}#operational-key`
                ],
                assertionMethod: [
                    `${this.agentDID}#identity-key`,
                    `${this.agentDID}#operational-key`
                ],
                service: [
                    {
                        id: `${this.agentDID}#agent-neo-service`,
                        type: 'AgentNeoService',
                        serviceEndpoint: 'p2p://agent-neo-network'
                    }
                ]
            };

            return didDocument;
        } catch (error) {
            console.error('❌ DID Document generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate operational key and certificate
     * @param {string} password - Password for key encryption
     */
    async generateOperationalKey(password) {
        try {
            // Generate new operational key pair
            const operationalKeyPair = await CryptoManager.generateBLSKeyPair();
            this.operationalKey = operationalKeyPair;

            // Create operational certificate
            const certificate = {
                agentDID: this.agentDID,
                operationalPublicKey: operationalKeyPair.publicKey,
                validFrom: Date.now(),
                validUntil: Date.now() + this.keyRotationInterval,
                issuedAt: Date.now()
            };

            // Sign certificate with identity key
            const certificateData = JSON.stringify(certificate);
            const signature = await CryptoManager.signBLS(certificateData, this.identityKey.privateKey);
            
            this.operationalCertificate = {
                ...certificate,
                signature
            };

            // Encrypt and store operational key
            const encryptedOperationalKey = await CryptoManager.encryptWithPassword(
                operationalKeyPair.privateKey,
                password
            );

            await this.storeOperationalKey({
                encryptedKey: encryptedOperationalKey,
                certificate: this.operationalCertificate
            });

            this.lastKeyRotation = Date.now();

            console.log('✅ Operational key generated and stored');
            
        } catch (error) {
            console.error('❌ Operational key generation failed:', error);
            throw error;
        }
    }

    /**
     * Check if WebAuthn is supported
     * @returns {boolean}
     */
    isWebAuthnSupported() {
        return !!(navigator.credentials && navigator.credentials.create);
    }

    /**
     * Register WebAuthn credential
     * @returns {string} - Credential ID
     */
    async registerWebAuthn() {
        try {
            if (!this.isWebAuthnSupported()) {
                throw new Error('WebAuthn not supported');
            }

            const challenge = new Uint8Array(32);
            crypto.getRandomValues(challenge);

            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge,
                    rp: {
                        name: 'Agent Neo',
                        id: window.location.hostname
                    },
                    user: {
                        id: new TextEncoder().encode(this.agentDID),
                        name: this.agentDID,
                        displayName: `Agent Neo (${this.agentDID.slice(-8)})`
                    },
                    pubKeyCredParams: [
                        { alg: -7, type: 'public-key' }, // ES256
                        { alg: -257, type: 'public-key' } // RS256
                    ],
                    authenticatorSelection: {
                        authenticatorAttachment: 'platform',
                        userVerification: 'preferred'
                    },
                    timeout: 60000,
                    attestation: 'direct'
                }
            });

            const credentialId = Array.from(new Uint8Array(credential.rawId))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');

            console.log('✅ WebAuthn credential registered');
            return credentialId;

        } catch (error) {
            console.error('❌ WebAuthn registration failed:', error);
            throw error;
        }
    }

    /**
     * Store identity data in IndexedDB
     * @param {Object} identityData - Identity data to store
     */
    async storeIdentity(identityData) {
        try {
            const db = await this.openDatabase();
            const transaction = db.transaction(['identity'], 'readwrite');
            const store = transaction.objectStore('identity');
            
            await store.put({
                id: 'main',
                ...identityData,
                timestamp: Date.now()
            });

            console.log('✅ Identity stored successfully');
            
        } catch (error) {
            console.error('❌ Identity storage failed:', error);
            throw error;
        }
    }

    /**
     * Store operational key data
     * @param {Object} keyData - Operational key data
     */
    async storeOperationalKey(keyData) {
        try {
            const db = await this.openDatabase();
            const transaction = db.transaction(['operational_keys'], 'readwrite');
            const store = transaction.objectStore('operational_keys');
            
            await store.put({
                id: 'current',
                ...keyData,
                timestamp: Date.now()
            });

            console.log('✅ Operational key stored successfully');
            
        } catch (error) {
            console.error('❌ Operational key storage failed:', error);
            throw error;
        }
    }

    /**
     * Load existing identity from storage
     * @returns {Object|null} - Identity data or null if not found
     */
    async loadExistingIdentity() {
        try {
            const db = await this.openDatabase();
            const transaction = db.transaction(['identity'], 'readonly');
            const store = transaction.objectStore('identity');
            
            const result = await store.get('main');
            return result || null;
            
        } catch (error) {
            console.error('❌ Identity loading failed:', error);
            return null;
        }
    }

    /**
     * Open IndexedDB database
     * @returns {Promise<IDBDatabase>}
     */
    async openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AgentNeoIdentity', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create identity store
                if (!db.objectStoreNames.contains('identity')) {
                    db.createObjectStore('identity', { keyPath: 'id' });
                }
                
                // Create operational keys store
                if (!db.objectStoreNames.contains('operational_keys')) {
                    db.createObjectStore('operational_keys', { keyPath: 'id' });
                }
                
                // Create recovery store
                if (!db.objectStoreNames.contains('recovery')) {
                    db.createObjectStore('recovery', { keyPath: 'id' });
                }
            };
        });
    }

    /**
     * Check if key rotation is needed
     */
    async checkKeyRotation() {
        try {
            if (!this.lastKeyRotation) return;

            const timeSinceRotation = Date.now() - this.lastKeyRotation;
            
            if (timeSinceRotation > this.keyRotationInterval) {
                console.log('🔄 Key rotation needed');
                eventBus.emit('identity:key_rotation_needed', {
                    lastRotation: this.lastKeyRotation,
                    timeSinceRotation
                });
            }
            
        } catch (error) {
            console.error('❌ Key rotation check failed:', error);
        }
    }

    /**
     * Rotate operational keys
     * @param {string} password - Password for key encryption
     */
    async rotateKeys(event) {
        try {
            const { password } = event.detail;
            
            if (!this.unlocked) {
                throw new Error('Session must be unlocked to rotate keys');
            }

            console.log('🔄 Rotating operational keys...');
            
            // Generate new operational key
            await this.generateOperationalKey(password);
            
            // Update DID document
            const didDocument = await this.generateDIDDocument();
            
            // Publish updated DID document
            eventBus.emit('identity:did_document_updated', {
                did: this.agentDID,
                didDocument,
                timestamp: Date.now()
            });
            
            console.log('✅ Keys rotated successfully');
            
            eventBus.emit('identity:keys_rotated', {
                did: this.agentDID,
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error('❌ Key rotation failed:', error);
            eventBus.emit('identity:error', { error, operation: 'rotate_keys' });
            throw error;
        }
    }

    /**
     * Unlock the session using WebAuthn and password
     * @param {string} password - User password
     */
    async unlockSession(event) {
        try {
            const { password } = event.detail;
            
            if (!this.agentDID) {
                throw new Error('No identity exists');
            }
            
            if (this.unlocked) {
                console.log('Session already unlocked');
                return;
            }
            
            console.log('🔓 Unlocking session...');
            
            // Step 1: WebAuthn authentication if available
            if (this.webAuthnCredentialId) {
                await this.authenticateWebAuthn();
            }
            
            // Step 2: Load and decrypt identity key
            const storedIdentity = await this.loadStoredIdentity();
            const identityPrivateKey = await CryptoManager.decryptWithPassword(
                storedIdentity.encryptedIdentityKey,
                password
            );
            
            this.identityKey = {
                privateKey: identityPrivateKey,
                publicKey: await CryptoManager.derivePublicKey(identityPrivateKey)
            };
            
            // Step 3: Check if operational key needs rotation
            if (this.shouldRotateKeys()) {
                await this.generateOperationalKey(password);
            } else {
                // Load existing operational key
                await this.loadOperationalKey(password);
            }
            
            this.unlocked = true;
            
            // Clear password from memory
            password = null;
            
            eventBus.emit('identity:unlocked', {
                did: this.agentDID,
                timestamp: Date.now()
            });
            
            console.log('✅ Session unlocked successfully');
            
        } catch (error) {
            console.error('❌ Session unlock failed:', error);
            eventBus.emit('identity:error', { error, operation: 'unlock' });
            throw error;
        }
    }

    /**
     * Lock the session and clear sensitive data from memory
     */
    async lockSession() {
        try {
            console.log('🔒 Locking session...');
            
            // Clear sensitive data from memory
            this.identityKey = null;
            this.operationalKey = null;
            this.operationalCertificate = null;
            this.unlocked = false;
            
            eventBus.emit('identity:locked', {
                did: this.agentDID,
                timestamp: Date.now()
            });
            
            console.log('✅ Session locked successfully');
            
        } catch (error) {
            console.error('❌ Session lock failed:', error);
            eventBus.emit('identity:error', { error, operation: 'lock' });
        }
    }

    /**
     * Rotate operational keys
     */
    async rotateKeys(event) {
        try {
            const { password } = event.detail;
            
            if (!this.unlocked) {
                throw new Error('Session must be unlocked to rotate keys');
            }
            
            console.log('🔄 Rotating operational keys...');
            
            await this.generateOperationalKey(password);
            
            // Update last rotation time
            this.lastKeyRotation = Date.now();
            await this.updateStoredIdentity({ lastKeyRotation: this.lastKeyRotation });
            
            // Publish updated DID document
            const didDocument = await this.generateDIDDocument();
            eventBus.emit('identity:did_document_updated', { didDocument });
            
            console.log('✅ Keys rotated successfully');
            
            eventBus.emit('identity:keys_rotated', {
                did: this.agentDID,
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error('❌ Key rotation failed:', error);
            eventBus.emit('identity:error', { error, operation: 'rotate_keys' });
            throw error;
        }
    }

    /**
     * Generate new operational key and certificate
     */
    async generateOperationalKey(password) {
        try {
            // Generate new operational key pair
            const operationalKeyPair = await CryptoManager.generateBLSKeyPair();
            this.operationalKey = operationalKeyPair;
            
            // Create operational certificate
            const validFrom = Date.now();
            const validUntil = validFrom + this.keyRotationInterval;
            
            const certificate = {
                agentDID: this.agentDID,
                operationalPublicKey: operationalKeyPair.publicKey,
                validFrom,
                validUntil,
                version: 1
            };
            
            // Sign certificate with identity key
            const certificateSignature = await CryptoManager.signBLS(
                JSON.stringify(certificate),
                this.identityKey.privateKey
            );
            
            this.operationalCertificate = {
                ...certificate,
                signature: certificateSignature
            };
            
            // Encrypt and store operational key
            const encryptedOperationalKey = await CryptoManager.encryptWithPassword(
                operationalKeyPair.privateKey,
                password
            );
            
            await this.storeOperationalKey({
                encryptedOperationalKey,
                certificate: this.operationalCertificate
            });
            
            console.log('✅ Operational key generated and stored');
            
        } catch (error) {
            console.error('❌ Operational key generation failed:', error);
            throw error;
        }
    }

    /**
     * Create recovery kit for account recovery
     */
    async createRecoveryKit(event) {
        try {
            if (!this.unlocked) {
                throw new Error('Session must be unlocked to create recovery kit');
            }
            
            console.log('🛡️ Creating recovery kit...');
            
            // Generate recovery phrase (12 words)
            const recoveryPhrase = await CryptoManager.generateRecoveryPhrase();
            
            // Encrypt identity key with recovery phrase
            const recoveryEncryptedKey = await CryptoManager.encryptWithPassword(
                this.identityKey.privateKey,
                recoveryPhrase
            );
            
            // Create recovery kit
            this.recoveryKit = {
                version: 1,
                agentDID: this.agentDID,
                encryptedIdentityKey: recoveryEncryptedKey,
                created: Date.now(),
                instructions: 'Use this recovery phrase to restore your Agent Neo identity'
            };
            
            eventBus.emit('identity:recovery_kit_created', {
                recoveryPhrase,
                recoveryKit: this.recoveryKit
            });
            
            console.log('✅ Recovery kit created successfully');
            
        } catch (error) {
            console.error('❌ Recovery kit creation failed:', error);
            eventBus.emit('identity:error', { error, operation: 'create_recovery' });
            throw error;
        }
    }

    /**
     * Recover account using recovery kit
     */
    async recoverAccount(event) {
        try {
            const { recoveryPhrase, recoveryKit, newPassword } = event.detail;
            
            console.log('🔄 Recovering account...');
            
            // Decrypt identity key using recovery phrase
            const recoveredPrivateKey = await CryptoManager.decryptWithPassword(
                recoveryKit.encryptedIdentityKey,
                recoveryPhrase
            );
            
            // Verify DID matches
            const recoveredPublicKey = await CryptoManager.derivePublicKey(recoveredPrivateKey);
            const recoveredDID = await this.deriveDID(recoveredPublicKey);
            
            if (recoveredDID !== recoveryKit.agentDID) {
                throw new Error('Recovery kit DID mismatch');
            }
            
            // Re-encrypt with new password
            const newEncryptedIdentityKey = await CryptoManager.encryptWithPassword(
                recoveredPrivateKey,
                newPassword
            );
            
            // Store recovered identity
            await this.storeIdentity({
                did: recoveredDID,
                encryptedIdentityKey: newEncryptedIdentityKey,
                credentialId: null, // Will need to re-register WebAuthn
                lastKeyRotation: Date.now()
            });
            
            this.agentDID = recoveredDID;
            
            console.log('✅ Account recovered successfully');
            
            eventBus.emit('identity:recovered', {
                did: this.agentDID,
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error('❌ Account recovery failed:', error);
            eventBus.emit('identity:error', { error, operation: 'recover' });
            throw error;
        }
    }

    /**
     * Sign a message with operational key
     */
    async signMessage(message) {
        if (!this.unlocked || !this.operationalKey) {
            throw new Error('Session must be unlocked to sign messages');
        }
        
        const signature = await CryptoManager.signBLS(message, this.operationalKey.privateKey);
        
        return {
            message,
            signature,
            certificate: this.operationalCertificate,
            timestamp: Date.now()
        };
    }

    /**
     * Verify a signed message
     */
    async verifyMessage(signedMessage, senderDID) {
        try {
            const { message, signature, certificate } = signedMessage;
            
            // Step 1: Verify certificate timestamp
            const now = Date.now();
            if (now < certificate.validFrom || now > certificate.validUntil) {
                throw new Error('Certificate expired or not yet valid');
            }
            
            // Step 2: Get sender's DID document (would need to fetch from network)
            // For now, we'll assume we have the public key
            const senderPublicKey = await this.getSenderPublicKey(senderDID);
            
            // Step 3: Verify certificate signature
            const certificateData = JSON.stringify({
                agentDID: certificate.agentDID,
                operationalPublicKey: certificate.operationalPublicKey,
                validFrom: certificate.validFrom,
                validUntil: certificate.validUntil,
                version: certificate.version
            });
            
            const certificateValid = await CryptoManager.verifyBLS(
                certificateData,
                certificate.signature,
                senderPublicKey
            );
            
            if (!certificateValid) {
                throw new Error('Invalid certificate signature');
            }
            
            // Step 4: Verify message signature
            const messageValid = await CryptoManager.verifyBLS(
                message,
                signature,
                certificate.operationalPublicKey
            );
            
            return messageValid;
            
        } catch (error) {
            console.error('❌ Message verification failed:', error);
            return false;
        }
    }

    /**
     * Generate DID Document
     */
    async generateDIDDocument() {
        if (!this.identityKey || !this.operationalKey) {
            throw new Error('Keys not available');
        }
        
        return {
            '@context': 'https://www.w3.org/ns/did/v1',
            id: this.agentDID,
            publicKey: [
                {
                    id: `${this.agentDID}#identity-key`,
                    type: 'BLS12381G2Key2020',
                    controller: this.agentDID,
                    publicKeyBase58: this.identityKey.publicKey
                },
                {
                    id: `${this.agentDID}#operational-key`,
                    type: 'BLS12381G2Key2020',
                    controller: this.agentDID,
                    publicKeyBase58: this.operationalKey.publicKey
                }
            ],
            authentication: [
                `${this.agentDID}#identity-key`,
                `${this.agentDID}#operational-key`
            ],
            service: [
                {
                    id: `${this.agentDID}#agent-service`,
                    type: 'AgentNeoService',
                    serviceEndpoint: 'p2p://' + this.agentDID
                }
            ],
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };
    }

    // Helper methods
    
    async deriveDID(publicKey) {
        const hash = await CryptoManager.sha256(publicKey);
        return `did:neo:${hash.substring(0, 32)}`;
    }

    isWebAuthnSupported() {
        return !!(navigator.credentials && navigator.credentials.create);
    }

    async registerWebAuthn() {
        if (!this.isWebAuthnSupported()) {
            throw new Error('WebAuthn not supported');
        }
        
        const credential = await navigator.credentials.create({
            publicKey: {
                challenge: new Uint8Array(32),
                rp: {
                    name: 'Agent Neo',
                    id: window.location.hostname
                },
                user: {
                    id: new TextEncoder().encode(this.agentDID),
                    name: this.agentDID,
                    displayName: 'Agent Neo Identity'
                },
                pubKeyCredParams: [
                    { alg: -7, type: 'public-key' }
                ],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',
                    userVerification: 'required'
                }
            }
        });
        
        return credential.id;
    }

    async authenticateWebAuthn() {
        if (!this.webAuthnCredentialId) {
            throw new Error('No WebAuthn credential registered');
        }
        
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: new Uint8Array(32),
                allowCredentials: [{
                    id: this.webAuthnCredentialId,
                    type: 'public-key'
                }],
                userVerification: 'required'
            }
        });
        
        return assertion;
    }

    shouldRotateKeys() {
        if (!this.lastKeyRotation) return true;
        return (Date.now() - this.lastKeyRotation) > this.keyRotationInterval;
    }

    async checkKeyRotation() {
        if (this.unlocked && this.shouldRotateKeys()) {
            eventBus.emit('identity:key_rotation_needed', {
                did: this.agentDID,
                lastRotation: this.lastKeyRotation
            });
        }
    }

    // Storage methods (using IndexedDB)
    
    async storeIdentity(identityData) {
        const db = await this.openDB();
        const tx = db.transaction(['identity'], 'readwrite');
        await tx.objectStore('identity').put(identityData, 'main');
        await tx.done;
    }

    async loadStoredIdentity() {
        const db = await this.openDB();
        const tx = db.transaction(['identity'], 'readonly');
        return await tx.objectStore('identity').get('main');
    }

    async loadExistingIdentity() {
        try {
            return await this.loadStoredIdentity();
        } catch (error) {
            return null;
        }
    }

    async updateStoredIdentity(updates) {
        const existing = await this.loadStoredIdentity();
        const updated = { ...existing, ...updates };
        await this.storeIdentity(updated);
    }

    async storeOperationalKey(keyData) {
        const db = await this.openDB();
        const tx = db.transaction(['operational_keys'], 'readwrite');
        await tx.objectStore('operational_keys').put(keyData, 'current');
        await tx.done;
    }

    async loadOperationalKey(password) {
        const db = await this.openDB();
        const tx = db.transaction(['operational_keys'], 'readonly');
        const keyData = await tx.objectStore('operational_keys').get('current');
        
        if (keyData) {
            const privateKey = await CryptoManager.decryptWithPassword(
                keyData.encryptedOperationalKey,
                password
            );
            
            this.operationalKey = {
                privateKey,
                publicKey: await CryptoManager.derivePublicKey(privateKey)
            };
            
            this.operationalCertificate = keyData.certificate;
        }
    }

    async openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AgentNeoIdentity', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('identity')) {
                    db.createObjectStore('identity');
                }
                
                if (!db.objectStoreNames.contains('operational_keys')) {
                    db.createObjectStore('operational_keys');
                }
            };
        });
    }

    async getSenderPublicKey(senderDID) {
        // This would typically fetch from the network or local cache
        // For now, return a placeholder
        throw new Error('DID resolution not implemented');
    }

    // Getters
    
    get isInitialized() {
        return this.initialized;
    }

    get isUnlocked() {
        return this.unlocked;
    }

    get hasIdentity() {
        return !!this.agentDID;
    }

    get currentDID() {
        return this.agentDID;
    }
}

export default new IdentityManager();