// Agent Neo Voice Interface Module
// Web Speech API integration for voice input and output

export class VoiceInterface {
  constructor(core) {
    this.core = core;
    this.recognition = null;
    this.synthesis = null;
    this.isListening = false;
    this.isEnabled = false;
    this.voices = [];
    this.selectedVoice = null;
    this.settings = {
      continuous: true,
      interimResults: true,
      language: 'en-US',
      voiceRate: 1.0,
      voicePitch: 1.0,
      voiceVolume: 1.0,
      autoListen: false,
      wakeWord: 'agent neo'
    };
    
    this.commandPatterns = {
      'start node': () => this.core.toggleNode(true),
      'stop node': () => this.core.toggleNode(false),
      'pause node': () => this.core.toggleNode(false),
      'show dashboard': () => this.navigateToSection('dashboard'),
      'show tasks': () => this.navigateToSection('tasks'),
      'show network': () => this.navigateToSection('network'),
      'show metrics': () => this.navigateToSection('metrics'),
      'show settings': () => this.navigateToSection('settings'),
      'submit task': (transcript) => this.handleTaskSubmission(transcript),
      'what is my status': () => this.speakNodeStatus(),
      'how many peers': () => this.speakPeerCount(),
      'what tasks are running': () => this.speakTaskStatus()
    };
  }

  async init() {
    try {
      await this.initializeSpeechRecognition();
      await this.initializeSpeechSynthesis();
      
      this.isEnabled = true;
      
      console.log('Voice Interface initialized');
    } catch (error) {
      console.error('Error initializing Voice Interface:', error);
      this.isEnabled = false;
      throw error;
    }
  }

  async initializeSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      throw new Error('Speech recognition not supported in this browser');
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    this.recognition.continuous = this.settings.continuous;
    this.recognition.interimResults = this.settings.interimResults;
    this.recognition.lang = this.settings.language;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      console.log('Voice recognition started');
      this.notifyListeningStatus(true);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      console.log('Voice recognition ended');
      this.notifyListeningStatus(false);
      
      // Restart if auto-listen is enabled
      if (this.settings.autoListen && this.isEnabled) {
        setTimeout(() => this.startListening(), 1000);
      }
    };

    this.recognition.onresult = (event) => {
      this.handleSpeechResult(event);
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.handleSpeechError(event.error);
    };
  }

  async initializeSpeechSynthesis() {
    if (!('speechSynthesis' in window)) {
      throw new Error('Speech synthesis not supported in this browser');
    }

    this.synthesis = window.speechSynthesis;
    
    // Load available voices
    await this.loadVoices();
    
    // Select default voice
    this.selectDefaultVoice();
    
    // Listen for voice changes
    this.synthesis.onvoiceschanged = () => {
      this.loadVoices();
    };
  }

  async loadVoices() {
    return new Promise((resolve) => {
      const loadVoices = () => {
        this.voices = this.synthesis.getVoices();
        if (this.voices.length > 0) {
          resolve();
        } else {
          setTimeout(loadVoices, 100);
        }
      };
      loadVoices();
    });
  }

  selectDefaultVoice() {
    // Prefer English voices
    const englishVoices = this.voices.filter(voice => voice.lang.startsWith('en'));
    
    if (englishVoices.length > 0) {
      // Prefer female voices for Agent Neo
      const femaleVoice = englishVoices.find(voice => 
        voice.name.toLowerCase().includes('female') || 
        voice.name.toLowerCase().includes('woman') ||
        voice.name.toLowerCase().includes('samantha') ||
        voice.name.toLowerCase().includes('alice')
      );
      
      this.selectedVoice = femaleVoice || englishVoices[0];
    } else {
      this.selectedVoice = this.voices[0];
    }
  }

  startListening() {
    if (!this.isEnabled || this.isListening) return;
    
    try {
      this.recognition.start();
    } catch (error) {
      console.error('Error starting voice recognition:', error);
    }
  }

  stopListening() {
    if (!this.isListening) return;
    
    try {
      this.recognition.stop();
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
    }
  }

  handleSpeechResult(event) {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    // Process final transcript
    if (finalTranscript) {
      this.processVoiceCommand(finalTranscript.trim().toLowerCase());
    }

    // Update UI with interim results
    this.updateTranscriptDisplay(finalTranscript, interimTranscript);
  }

  processVoiceCommand(transcript) {
    console.log('Processing voice command:', transcript);
    
    // Check for wake word
    if (this.settings.wakeWord && !transcript.includes(this.settings.wakeWord)) {
      return;
    }

    // Remove wake word from transcript
    const cleanTranscript = transcript.replace(this.settings.wakeWord, '').trim();
    
    // Try to match command patterns
    let commandExecuted = false;
    
    for (const [pattern, action] of Object.entries(this.commandPatterns)) {
      if (cleanTranscript.includes(pattern)) {
        try {
          action(cleanTranscript);
          commandExecuted = true;
          break;
        } catch (error) {
          console.error('Error executing voice command:', error);
          this.speak('Sorry, I encountered an error executing that command.');
        }
      }
    }

    if (!commandExecuted) {
      this.handleUnknownCommand(cleanTranscript);
    }
  }

  handleUnknownCommand(transcript) {
    // Try to interpret as a general task
    if (transcript.length > 5) {
      this.speak('I\'ll process that as a new task.');
      this.core.submitTask({
        description: transcript,
        priority: 'medium',
        resourceStake: 50
      });
    } else {
      this.speak('I didn\'t understand that command. Please try again.');
    }
  }

  handleTaskSubmission(transcript) {
    // Extract task description after "submit task"
    const taskMatch = transcript.match(/submit task (.+)/);
    if (taskMatch) {
      const description = taskMatch[1];
      this.speak('Submitting task: ' + description);
      this.core.submitTask({
        description,
        priority: 'medium',
        resourceStake: 50
      });
    } else {
      this.speak('Please specify what task you want to submit.');
    }
  }

  speak(text, options = {}) {
    if (!this.isEnabled || !this.synthesis) return;

    // Cancel any current speech
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Apply settings
    utterance.voice = this.selectedVoice;
    utterance.rate = options.rate || this.settings.voiceRate;
    utterance.pitch = options.pitch || this.settings.voicePitch;
    utterance.volume = options.volume || this.settings.voiceVolume;

    utterance.onstart = () => {
      console.log('Started speaking:', text);
    };

    utterance.onend = () => {
      console.log('Finished speaking:', text);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
    };

    this.synthesis.speak(utterance);
  }

  speakNodeStatus() {
    const metrics = this.core.getMetrics();
    const message = `Node status: ${metrics.status}. 
                    Uptime: ${metrics.nodeUptime}. 
                    ${metrics.tasksProcessed} tasks processed. 
                    ${metrics.networkPeers} peers connected.`;
    this.speak(message);
  }

  speakPeerCount() {
    const peerCount = this.core.p2p.getPeerCount();
    this.speak(`You have ${peerCount} peers connected to your network.`);
  }

  speakTaskStatus() {
    const tasks = this.core.tasks.getTasks();
    const processingTasks = tasks.filter(t => t.status === 'processing');
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    
    let message = `You have ${processingTasks.length} tasks currently processing`;
    if (pendingTasks.length > 0) {
      message += ` and ${pendingTasks.length} tasks pending`;
    }
    message += '.';
    
    this.speak(message);
  }

  navigateToSection(section) {
    // Emit custom event for navigation
    window.dispatchEvent(new CustomEvent('voiceNavigate', {
      detail: { section }
    }));
    
    this.speak(`Navigating to ${section}`);
  }

  handleSpeechError(error) {
    let message = 'Voice recognition error';
    
    switch (error) {
      case 'no-speech':
        message = 'No speech detected. Please try again.';
        break;
      case 'audio-capture':
        message = 'Audio capture failed. Please check your microphone.';
        break;
      case 'not-allowed':
        message = 'Microphone access denied. Please allow microphone access.';
        break;
      case 'network':
        message = 'Network error occurred during speech recognition.';
        break;
      default:
        message = `Speech recognition error: ${error}`;
    }
    
    console.error(message);
    this.notifyError(message);
  }

  updateTranscriptDisplay(finalTranscript, interimTranscript) {
    // Emit event for UI updates
    window.dispatchEvent(new CustomEvent('voiceTranscript', {
      detail: { 
        final: finalTranscript,
        interim: interimTranscript
      }
    }));
  }

  notifyListeningStatus(listening) {
    // Emit event for UI updates
    window.dispatchEvent(new CustomEvent('voiceListening', {
      detail: { listening }
    }));
  }

  notifyError(error) {
    // Emit event for UI updates
    window.dispatchEvent(new CustomEvent('voiceError', {
      detail: { error }
    }));
  }

  // Configuration methods
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    
    // Update recognition settings
    if (this.recognition) {
      this.recognition.continuous = this.settings.continuous;
      this.recognition.interimResults = this.settings.interimResults;
      this.recognition.lang = this.settings.language;
    }
  }

  setVoice(voiceIndex) {
    if (voiceIndex >= 0 && voiceIndex < this.voices.length) {
      this.selectedVoice = this.voices[voiceIndex];
    }
  }

  getVoices() {
    return this.voices.map((voice, index) => ({
      index,
      name: voice.name,
      lang: voice.lang,
      gender: voice.name.toLowerCase().includes('female') ? 'female' : 'male'
    }));
  }

  // Utility methods
  isSupported() {
    return 'speechSynthesis' in window && 
           ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  }

  getStatus() {
    return {
      enabled: this.isEnabled,
      listening: this.isListening,
      supported: this.isSupported(),
      voiceCount: this.voices.length,
      selectedVoice: this.selectedVoice?.name || 'None',
      settings: this.settings
    };
  }

  enable() {
    this.isEnabled = true;
    if (this.settings.autoListen) {
      this.startListening();
    }
  }

  disable() {
    this.isEnabled = false;
    this.stopListening();
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }

  addCustomCommand(pattern, action) {
    this.commandPatterns[pattern] = action;
  }

  removeCustomCommand(pattern) {
    delete this.commandPatterns[pattern];
  }

  getCommands() {
    return Object.keys(this.commandPatterns);
  }
}
