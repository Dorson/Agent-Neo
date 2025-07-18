/**
 * Identity Setup Component
 * 
 * Provides a user-friendly interface for creating and managing Agent Neo identities.
 * Handles the complete identity lifecycle including creation, authentication, 
 * key rotation, and recovery.
 */

import eventBus from '../../core/EventBus.js';
import stateManager from '../../core/StateManager.js';

class IdentitySetup {
    constructor() {
        this.name = 'IdentitySetup';
        this.initialized = false;
        this.currentStep = 'check';
        this.identityData = null;
        
        this.init();
    }

    async init() {
        try {
            console.log('🔐 Initializing Identity Setup...');
            
            this.setupEventListeners();
            this.render();
            
            this.initialized = true;
            console.log('✅ Identity Setup initialized');
            
        } catch (error) {
            console.error('❌ Identity Setup initialization failed:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Identity events
        eventBus.on('identity:initialized', this.handleIdentityInitialized.bind(this));
        eventBus.on('identity:created', this.handleIdentityCreated.bind(this));
        eventBus.on('identity:unlocked', this.handleIdentityUnlocked.bind(this));
        eventBus.on('identity:locked', this.handleIdentityLocked.bind(this));
        eventBus.on('identity:error', this.handleIdentityError.bind(this));
        
        // UI events
        eventBus.on('ui:show-identity-setup', this.show.bind(this));
        eventBus.on('ui:hide-identity-setup', this.hide.bind(this));
    }

    render() {
        const container = document.getElementById('identitySetup');
        if (!container) {
            // Create container if it doesn't exist
            const newContainer = document.createElement('div');
            newContainer.id = 'identitySetup';
            newContainer.className = 'identity-setup-container hidden';
            document.body.appendChild(newContainer);
        }

        this.renderCurrentStep();
    }

    renderCurrentStep() {
        const container = document.getElementById('identitySetup');
        if (!container) return;

        switch (this.currentStep) {
            case 'check':
                this.renderIdentityCheck();
                break;
            case 'create':
                this.renderIdentityCreation();
                break;
            case 'unlock':
                this.renderIdentityUnlock();
                break;
            case 'recovery':
                this.renderRecoverySetup();
                break;
            case 'complete':
                this.renderComplete();
                break;
            default:
                this.renderIdentityCheck();
        }
    }

    renderIdentityCheck() {
        const container = document.getElementById('identitySetup');
        container.innerHTML = `
            <div class="identity-setup-modal">
                <div class="setup-header">
                    <div class="neo-logo">
                        <div class="logo-ring"></div>
                        <div class="logo-core"></div>
                    </div>
                    <h2>Agent Neo Identity</h2>
                    <p>Secure decentralized identity management</p>
                </div>
                
                <div class="setup-content">
                    <div class="identity-status">
                        <div class="status-icon">🔍</div>
                        <h3>Checking Identity Status...</h3>
                        <p>Verifying if you have an existing Agent Neo identity.</p>
                        <div class="loading-spinner"></div>
                    </div>
                </div>
            </div>
        `;
    }

    renderIdentityCreation() {
        const container = document.getElementById('identitySetup');
        container.innerHTML = `
            <div class="identity-setup-modal">
                <div class="setup-header">
                    <div class="neo-logo">
                        <div class="logo-ring"></div>
                        <div class="logo-core"></div>
                    </div>
                    <h2>Create Your Agent Neo Identity</h2>
                    <p>Set up your secure, decentralized identity</p>
                </div>
                
                <div class="setup-content">
                    <form id="identityCreationForm" class="identity-form">
                        <div class="form-group">
                            <label for="masterPassword">Master Password</label>
                            <input type="password" id="masterPassword" required 
                                   placeholder="Enter a strong password" 
                                   minlength="8">
                            <div class="password-strength" id="passwordStrength"></div>
                            <small>This password encrypts your identity keys. Choose a strong, unique password.</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="confirmPassword">Confirm Password</label>
                            <input type="password" id="confirmPassword" required 
                                   placeholder="Confirm your password">
                            <div class="password-match" id="passwordMatch"></div>
                        </div>
                        
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="enableWebAuthn" checked>
                                <span class="checkmark"></span>
                                Enable WebAuthn (Biometric/Hardware Key)
                            </label>
                            <small>Use your device's biometric authentication or hardware security key for enhanced security.</small>
                        </div>
                        
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="agreeTerms" required>
                                <span class="checkmark"></span>
                                I understand that I am responsible for securing my identity
                            </label>
                            <small>Agent Neo uses decentralized identity. You are in full control of your keys and data.</small>
                        </div>
                        
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary" id="createIdentityBtn">
                                <span class="btn-icon">🔐</span>
                                Create Identity
                            </button>
                        </div>
                    </form>
                </div>
                
                <div class="setup-footer">
                    <p><strong>Important:</strong> Your password cannot be recovered. Write it down and store it securely.</p>
                </div>
            </div>
        `;

        this.setupCreationFormHandlers();
    }

    renderIdentityUnlock() {
        const container = document.getElementById('identitySetup');
        container.innerHTML = `
            <div class="identity-setup-modal">
                <div class="setup-header">
                    <div class="neo-logo">
                        <div class="logo-ring"></div>
                        <div class="logo-core"></div>
                    </div>
                    <h2>Unlock Your Identity</h2>
                    <p>DID: <code>${this.identityData?.did || 'Unknown'}</code></p>
                </div>
                
                <div class="setup-content">
                    <form id="identityUnlockForm" class="identity-form">
                        <div class="form-group">
                            <label for="unlockPassword">Master Password</label>
                            <input type="password" id="unlockPassword" required 
                                   placeholder="Enter your master password">
                        </div>
                        
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary" id="unlockIdentityBtn">
                                <span class="btn-icon">🔓</span>
                                Unlock Identity
                            </button>
                            <button type="button" class="btn btn-secondary" id="useWebAuthnBtn">
                                <span class="btn-icon">👆</span>
                                Use Biometric
                            </button>
                        </div>
                    </form>
                    
                    <div class="unlock-options">
                        <button class="btn btn-link" id="recoverIdentityBtn">
                            <span class="btn-icon">🔄</span>
                            Recover Identity
                        </button>
                        <button class="btn btn-link" id="createNewIdentityBtn">
                            <span class="btn-icon">➕</span>
                            Create New Identity
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.setupUnlockFormHandlers();
    }

    renderRecoverySetup() {
        const container = document.getElementById('identitySetup');
        container.innerHTML = `
            <div class="identity-setup-modal">
                <div class="setup-header">
                    <div class="neo-logo">
                        <div class="logo-ring"></div>
                        <div class="logo-core"></div>
                    </div>
                    <h2>Create Recovery Kit</h2>
                    <p>Secure your identity with a recovery phrase</p>
                </div>
                
                <div class="setup-content">
                    <div class="recovery-warning">
                        <div class="warning-icon">⚠️</div>
                        <h3>Important Security Notice</h3>
                        <p>Your recovery phrase is the only way to restore your identity if you lose access. 
                           Write it down and store it in a secure location.</p>
                    </div>
                    
                    <div class="recovery-phrase-container">
                        <div class="recovery-phrase" id="recoveryPhrase">
                            <!-- Recovery phrase will be generated here -->
                        </div>
                        <button class="btn btn-secondary" id="generateRecoveryBtn">
                            <span class="btn-icon">🔄</span>
                            Generate Recovery Phrase
                        </button>
                    </div>
                    
                    <div class="recovery-verification">
                        <h4>Verify Recovery Phrase</h4>
                        <p>Please enter the recovery phrase to confirm you've saved it:</p>
                        <textarea id="recoveryVerification" placeholder="Enter your recovery phrase here..."></textarea>
                    </div>
                    
                    <div class="form-actions">
                        <button class="btn btn-primary" id="confirmRecoveryBtn" disabled>
                            <span class="btn-icon">✅</span>
                            Confirm & Continue
                        </button>
                        <button class="btn btn-secondary" id="skipRecoveryBtn">
                            <span class="btn-icon">⏭️</span>
                            Skip for Now
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.setupRecoveryHandlers();
    }

    renderComplete() {
        const container = document.getElementById('identitySetup');
        container.innerHTML = `
            <div class="identity-setup-modal">
                <div class="setup-header">
                    <div class="neo-logo">
                        <div class="logo-ring"></div>
                        <div class="logo-core"></div>
                    </div>
                    <h2>Identity Setup Complete</h2>
                    <p>Your Agent Neo identity is ready!</p>
                </div>
                
                <div class="setup-content">
                    <div class="completion-status">
                        <div class="status-icon">✅</div>
                        <h3>Welcome to Agent Neo</h3>
                        <p>Your decentralized identity has been created and secured.</p>
                        
                        <div class="identity-info">
                            <h4>Your Identity Details:</h4>
                            <div class="info-item">
                                <strong>DID:</strong> <code>${this.identityData?.did || 'Unknown'}</code>
                            </div>
                            <div class="info-item">
                                <strong>Created:</strong> ${new Date().toLocaleString()}
                            </div>
                            <div class="info-item">
                                <strong>Status:</strong> <span class="status-active">Active</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="next-steps">
                        <h4>Next Steps:</h4>
                        <ul>
                            <li>Start your Agent Neo node</li>
                            <li>Connect to the P2P network</li>
                            <li>Begin interacting with other agents</li>
                            <li>Explore the decentralized AI ecosystem</li>
                        </ul>
                    </div>
                    
                    <div class="form-actions">
                        <button class="btn btn-primary" id="startAgentBtn">
                            <span class="btn-icon">🚀</span>
                            Start Agent Neo
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.setupCompleteHandlers();
    }

    setupCreationFormHandlers() {
        const form = document.getElementById('identityCreationForm');
        const passwordInput = document.getElementById('masterPassword');
        const confirmInput = document.getElementById('confirmPassword');
        const strengthIndicator = document.getElementById('passwordStrength');
        const matchIndicator = document.getElementById('passwordMatch');

        // Password strength indicator
        passwordInput.addEventListener('input', () => {
            const strength = this.calculatePasswordStrength(passwordInput.value);
            this.updatePasswordStrength(strengthIndicator, strength);
        });

        // Password match indicator
        confirmInput.addEventListener('input', () => {
            const match = passwordInput.value === confirmInput.value;
            this.updatePasswordMatch(matchIndicator, match);
        });

        // Form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleIdentityCreation(form);
        });
    }

    setupUnlockFormHandlers() {
        const form = document.getElementById('identityUnlockForm');
        const webauthnBtn = document.getElementById('useWebAuthnBtn');
        const recoverBtn = document.getElementById('recoverIdentityBtn');
        const createNewBtn = document.getElementById('createNewIdentityBtn');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleIdentityUnlock(form);
        });

        webauthnBtn.addEventListener('click', () => {
            this.handleWebAuthnUnlock();
        });

        recoverBtn.addEventListener('click', () => {
            this.showRecoveryFlow();
        });

        createNewBtn.addEventListener('click', () => {
            this.currentStep = 'create';
            this.renderCurrentStep();
        });
    }

    setupRecoveryHandlers() {
        const generateBtn = document.getElementById('generateRecoveryBtn');
        const confirmBtn = document.getElementById('confirmRecoveryBtn');
        const skipBtn = document.getElementById('skipRecoveryBtn');
        const verificationInput = document.getElementById('recoveryVerification');

        generateBtn.addEventListener('click', () => {
            this.generateRecoveryPhrase();
        });

        verificationInput.addEventListener('input', () => {
            this.validateRecoveryPhrase();
        });

        confirmBtn.addEventListener('click', () => {
            this.confirmRecoverySetup();
        });

        skipBtn.addEventListener('click', () => {
            this.skipRecoverySetup();
        });
    }

    setupCompleteHandlers() {
        const startBtn = document.getElementById('startAgentBtn');
        
        startBtn.addEventListener('click', () => {
            this.hide();
            eventBus.emit('agent:start');
        });
    }

    async handleIdentityCreation(form) {
        try {
            const formData = new FormData(form);
            const password = formData.get('masterPassword');
            const confirmPassword = formData.get('confirmPassword');
            const enableWebAuthn = formData.get('enableWebAuthn') === 'on';

            if (password !== confirmPassword) {
                this.showError('Passwords do not match');
                return;
            }

            if (this.calculatePasswordStrength(password) < 3) {
                this.showError('Password is too weak. Please choose a stronger password.');
                return;
            }

            this.showLoading('Creating identity...');

            eventBus.emit('identity:create', {
                password,
                enableWebAuthn
            });

        } catch (error) {
            console.error('Identity creation failed:', error);
            this.showError('Failed to create identity: ' + error.message);
        }
    }

    async handleIdentityUnlock(form) {
        try {
            const formData = new FormData(form);
            const password = formData.get('unlockPassword');

            this.showLoading('Unlocking identity...');

            eventBus.emit('identity:unlock', { password });

        } catch (error) {
            console.error('Identity unlock failed:', error);
            this.showError('Failed to unlock identity: ' + error.message);
        }
    }

    calculatePasswordStrength(password) {
        let strength = 0;
        
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;
        
        return Math.min(strength, 5);
    }

    updatePasswordStrength(indicator, strength) {
        const levels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
        const colors = ['#ff4444', '#ff8844', '#ffaa44', '#44aa44', '#44ff44'];
        
        indicator.textContent = levels[strength - 1] || 'Very Weak';
        indicator.style.color = colors[strength - 1] || '#ff4444';
    }

    updatePasswordMatch(indicator, match) {
        if (match) {
            indicator.textContent = 'Passwords match ✓';
            indicator.style.color = '#44aa44';
        } else {
            indicator.textContent = 'Passwords do not match ✗';
            indicator.style.color = '#ff4444';
        }
    }

    handleIdentityInitialized(event) {
        const { hasIdentity, did } = event.detail;
        
        if (hasIdentity) {
            this.identityData = { did };
            this.currentStep = 'unlock';
        } else {
            this.currentStep = 'create';
        }
        
        this.renderCurrentStep();
    }

    handleIdentityCreated(event) {
        this.identityData = event.detail;
        this.currentStep = 'recovery';
        this.renderCurrentStep();
    }

    handleIdentityUnlocked(event) {
        this.identityData = event.detail;
        this.currentStep = 'complete';
        this.renderCurrentStep();
    }

    handleIdentityError(event) {
        this.showError(event.detail.error.message);
    }

    show() {
        const container = document.getElementById('identitySetup');
        if (container) {
            container.classList.remove('hidden');
        }
    }

    hide() {
        const container = document.getElementById('identitySetup');
        if (container) {
            container.classList.add('hidden');
        }
    }

    showLoading(message) {
        // Implementation for loading state
        console.log('Loading:', message);
    }

    showError(message) {
        // Implementation for error display
        console.error('Error:', message);
        
        // Show error in UI
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        const container = document.querySelector('.setup-content');
        if (container) {
            container.insertBefore(errorDiv, container.firstChild);
            
            // Remove error after 5 seconds
            setTimeout(() => {
                errorDiv.remove();
            }, 5000);
        }
    }
}

export default IdentitySetup;