class PersonalityCustomizer {
    constructor() {
        this.customResponseCount = 0;
        this.init();
    }

    async init() {
        await this.loadSavedData();
        this.setupEventListeners();
    }

    async loadSavedData() {
        try {
            const result = await chrome.storage.local.get(['userPersonality', 'cerebrumApiKey']);
            const personality = result.userPersonality || this.getDefaultPersonality();
            this.populateForm(personality);
            
            // Load API key
            document.getElementById('apiKey').value = result.cerebrumApiKey || '';
        } catch (error) {
            console.error('Error loading saved data:', error);
            this.showStatus('Error loading saved data', 'error');
        }
    }

    getDefaultPersonality() {
        return {
            name: '',
            headline: '',
            bio: '',
            responseStyle: 'friendly',
            commonResponses: {
                work: '',
                skills: '',
                goals: '',
                contact: '',
                interests: ''
            },
            customResponses: []
        };
    }

    populateForm(personality) {
        // Basic information
        document.getElementById('name').value = personality.name || '';
        document.getElementById('headline').value = personality.headline || '';
        document.getElementById('bio').value = personality.bio || '';
        document.getElementById('responseStyle').value = personality.responseStyle || 'friendly';

        // Common responses
        const commonResponses = personality.commonResponses || {};
        document.getElementById('workResponse').value = commonResponses.work || '';
        document.getElementById('skillsResponse').value = commonResponses.skills || '';
        document.getElementById('goalsResponse').value = commonResponses.goals || '';
        document.getElementById('contactResponse').value = commonResponses.contact || '';
        document.getElementById('interestsResponse').value = commonResponses.interests || '';

        // Custom responses
        const customResponses = personality.customResponses || [];
        customResponses.forEach(response => {
            this.addCustomResponse(response.question, response.answer);
        });
    }

    setupEventListeners() {
        // Save button
        document.getElementById('save-btn').addEventListener('click', () => {
            this.savePersonality();
        });

        // Reset button
        document.getElementById('reset-btn').addEventListener('click', () => {
            this.resetToDefault();
        });

        // Add custom response button
        document.getElementById('add-custom').addEventListener('click', () => {
            this.addCustomResponse();
        });

        // Test API button
        document.getElementById('test-api').addEventListener('click', () => {
            this.testApiConnection();
        });

        // Debug storage button
        document.getElementById('debug-storage').addEventListener('click', () => {
            this.debugStorage();
        });

        // Form submission
        document.getElementById('personality-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePersonality();
        });
    }

    addCustomResponse(question = '', answer = '') {
        const container = document.getElementById('custom-responses');
        const responseId = `custom-${this.customResponseCount++}`;
        
        const responseDiv = document.createElement('div');
        responseDiv.className = 'custom-response-pair';
        responseDiv.innerHTML = `
            <button type="button" class="remove-custom" onclick="this.parentElement.remove()">×</button>
            <div class="form-group">
                <label for="${responseId}-question">Question/Trigger</label>
                <input type="text" id="${responseId}-question" 
                       placeholder="e.g., What's your management style?" 
                       value="${question}">
            </div>
            <div class="form-group">
                <label for="${responseId}-answer">Your Response</label>
                <textarea id="${responseId}-answer" rows="2" 
                          placeholder="e.g., I believe in collaborative leadership and empowering team members...">${answer}</textarea>
            </div>
        `;
        
        container.appendChild(responseDiv);
    }

    collectFormData() {
        // API key
        const apiKey = document.getElementById('apiKey').value.trim();
        
        // Basic information
        const name = document.getElementById('name').value.trim();
        const headline = document.getElementById('headline').value.trim();
        const bio = document.getElementById('bio').value.trim();
        const responseStyle = document.getElementById('responseStyle').value;

        // Common responses
        const commonResponses = {
            work: document.getElementById('workResponse').value.trim(),
            skills: document.getElementById('skillsResponse').value.trim(),
            goals: document.getElementById('goalsResponse').value.trim(),
            contact: document.getElementById('contactResponse').value.trim(),
            interests: document.getElementById('interestsResponse').value.trim()
        };

        // Custom responses
        const customResponses = [];
        const customPairs = document.querySelectorAll('.custom-response-pair');
        customPairs.forEach(pair => {
            const question = pair.querySelector('input[type="text"]').value.trim();
            const answer = pair.querySelector('textarea').value.trim();
            if (question && answer) {
                customResponses.push({ question, answer });
            }
        });

        return {
            apiKey,
            personality: {
                name,
                headline,
                bio,
                responseStyle,
                commonResponses,
                customResponses,
                lastUpdated: new Date().toISOString()
            }
        };
    }

    async savePersonality() {
        const saveBtn = document.getElementById('save-btn');
        const originalText = saveBtn.textContent;
        
        try {
            // Validate required fields
            const name = document.getElementById('name').value.trim();
            if (!name) {
                this.showStatus('Please enter your name', 'error');
                return;
            }

            // Show loading state
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            // Collect and save data
            const formData = this.collectFormData();
            await chrome.storage.local.set({ 
                userPersonality: formData.personality,
                cerebrumApiKey: formData.apiKey
            });

            // Show success message
            this.showStatus('Personality saved successfully!', 'success');
            
            // Auto-hide success message after 3 seconds
            setTimeout(() => {
                this.hideStatus();
            }, 3000);

        } catch (error) {
            console.error('Error saving personality:', error);
            this.showStatus('Error saving personality. Please try again.', 'error');
        } finally {
            // Reset button state
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }

    async resetToDefault() {
        if (confirm('Are you sure you want to reset to default settings? This will clear all your customizations including your API key.')) {
            try {
                const defaultPersonality = this.getDefaultPersonality();
                await chrome.storage.local.set({ 
                    userPersonality: defaultPersonality,
                    cerebrumApiKey: ''
                });
                
                // Clear custom responses
                document.getElementById('custom-responses').innerHTML = '';
                this.customResponseCount = 0;
                
                // Repopulate form
                this.populateForm(defaultPersonality);
                
                // Clear API key field
                document.getElementById('apiKey').value = '';
                
                this.showStatus('Settings reset to default', 'success');
                setTimeout(() => {
                    this.hideStatus();
                }, 3000);
                
            } catch (error) {
                console.error('Error resetting to default:', error);
                this.showStatus('Error resetting settings', 'error');
            }
        }
    }

    showStatus(message, type = 'success') {
        const statusEl = document.getElementById('status-message');
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
        statusEl.style.display = 'block';
    }

    hideStatus() {
        const statusEl = document.getElementById('status-message');
        statusEl.style.display = 'none';
    }

    // Export/Import functionality (bonus feature)
    async exportPersonality() {
        try {
            const result = await chrome.storage.local.get('userPersonality');
            const personality = result.userPersonality || this.getDefaultPersonality();
            
            const blob = new Blob([JSON.stringify(personality, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'chatbot-personality.json';
            a.click();
            
            URL.revokeObjectURL(url);
            
        } catch (error) {
            console.error('Error exporting personality:', error);
            this.showStatus('Error exporting personality', 'error');
        }
    }

    async importPersonality(file) {
        try {
            const text = await file.text();
            const personality = JSON.parse(text);
            
            // Validate the imported data structure
            if (this.validatePersonalityData(personality)) {
                await chrome.storage.local.set({ userPersonality: personality });
                
                // Clear and repopulate form
                document.getElementById('custom-responses').innerHTML = '';
                this.customResponseCount = 0;
                this.populateForm(personality);
                
                this.showStatus('Personality imported successfully!', 'success');
            } else {
                this.showStatus('Invalid personality file format', 'error');
            }
            
        } catch (error) {
            console.error('Error importing personality:', error);
            this.showStatus('Error importing personality file', 'error');
        }
    }

    validatePersonalityData(data) {
        // Basic validation of the personality data structure
        return data && 
               typeof data === 'object' &&
               typeof data.name === 'string' &&
               typeof data.responseStyle === 'string' &&
               (data.commonResponses === undefined || typeof data.commonResponses === 'object') &&
               (data.customResponses === undefined || Array.isArray(data.customResponses));
    }

    async testApiConnection() {
        const apiKey = document.getElementById('apiKey').value.trim();
        const statusEl = document.getElementById('api-status');
        const testBtn = document.getElementById('test-api');
        
        if (!apiKey) {
            this.showApiStatus('Please enter an API key first', 'error');
            return;
        }

        testBtn.disabled = true;
        testBtn.textContent = 'Testing...';
        this.showApiStatus('Testing API connection...', 'info');

        try {
            // Use chrome.runtime.sendMessage to call background script
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: 'testCerebrumAPI',
                    apiKey: apiKey
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });

            if (response.success) {
                this.showApiStatus('✅ ' + response.message, 'success');
            } else {
                this.showApiStatus('❌ ' + response.message, 'error');
            }
        } catch (error) {
            console.error('API test error:', error);
            this.showApiStatus(`❌ Connection failed: ${error.message}`, 'error');
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = 'Test API Connection';
        }
    }

    showApiStatus(message, type) {
        const statusEl = document.getElementById('api-status');
        statusEl.textContent = message;
        statusEl.style.display = 'block';
        
        // Set color based on type
        const colors = {
            success: '#155724',
            error: '#721c24',
            warning: '#856404',
            info: '#0c5460'
        };
        statusEl.style.color = colors[type] || colors.info;
        
        // Auto-hide after 5 seconds for success messages
        if (type === 'success') {
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 5000);
        }
    }

    async debugStorage() {
        try {
            const result = await chrome.storage.local.get(null); // Get all stored data
            console.log('=== STORAGE DEBUG ===');
            console.log('All stored data:', result);
            console.log('cerebrumApiKey exists:', !!result.cerebrumApiKey);
            console.log('cerebrumApiKey length:', result.cerebrumApiKey ? result.cerebrumApiKey.length : 0);
            console.log('userPersonality exists:', !!result.userPersonality);
            console.log('====================');
            
            const message = `Storage Debug:
• API Key: ${result.cerebrumApiKey ? 'EXISTS (' + result.cerebrumApiKey.length + ' chars)' : 'NOT FOUND'}
• User Personality: ${result.userPersonality ? 'EXISTS' : 'NOT FOUND'}
Check console for full details.`;
            
            this.showApiStatus(message, 'info');
        } catch (error) {
            console.error('Error debugging storage:', error);
            this.showApiStatus('Error accessing storage: ' + error.message, 'error');
        }
    }
}

// Initialize the personality customizer when the popup loads
document.addEventListener('DOMContentLoaded', () => {
    new PersonalityCustomizer();
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        document.getElementById('save-btn').click();
    }
}); 