// KnowledgeScout - Document Q&A Application

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const questionInput = document.getElementById('questionInput');
const askButton = document.getElementById('askButton');
const chatHistory = document.getElementById('chatHistory');
const historyList = document.getElementById('historyList');

// Application State
let uploadedFiles = [];
let chatMessages = [];
let queryHistory = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadFromLocalStorage();
    setupEventListeners();
    renderFileList();
    renderChatHistory();
    renderQueryHistory();
});

// Set up event listeners
function setupEventListeners() {
    // File upload events
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleFileDrop);
    fileInput.addEventListener('change', handleFileSelect);
    
    // Q&A events
    askButton.addEventListener('click', handleQuestionSubmit);
    questionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleQuestionSubmit();
    });
    
    // Navigation smooth scrolling
    document.querySelectorAll('nav a').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            document.querySelector(targetId).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });
}

// File handling functions
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleFileDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    processFiles(files);
}

function handleFileSelect(e) {
    const files = e.target.files;
    processFiles(files);
}

function processFiles(files) {
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Check if file type is supported
        if (!isFileTypeSupported(file)) {
            showNotification(`File type not supported: ${file.name}`, 'error');
            continue;
        }
        
        // Check if file is already uploaded
        if (uploadedFiles.some(f => f.name === file.name && f.size === file.size)) {
            showNotification(`File already uploaded: ${file.name}`, 'warning');
            continue;
        }
        
        // Add file to uploaded files
        uploadedFiles.push({
            id: generateId(),
            file: file,
            name: file.name,
            size: formatFileSize(file.size),
            type: file.type,
            uploadDate: new Date()
        });
        
        showNotification(`File uploaded: ${file.name}`, 'success');
    }
    
    renderFileList();
    saveToLocalStorage();
}

function isFileTypeSupported(file) {
    const supportedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    ];
    
    return supportedTypes.includes(file.type);
}

function renderFileList() {
    if (uploadedFiles.length === 0) {
        fileList.innerHTML = '<p class="empty-state">No files uploaded yet.</p>';
        return;
    }
    
    fileList.innerHTML = uploadedFiles.map(file => `
        <div class="file-item">
            <div class="file-name">
                <i class="fas fa-file-${getFileIcon(file.type)}"></i>
                <div>
                    <div>${file.name}</div>
                    <small>${file.size} • ${formatDate(file.uploadDate)}</small>
                </div>
            </div>
            <div class="file-actions">
                <button class="btn-secondary" onclick="processFile('${file.id}')">
                    <i class="fas fa-cog"></i> Process
                </button>
                <button class="btn-danger" onclick="removeFile('${file.id}')">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </div>
        </div>
    `).join('');
}

function getFileIcon(fileType) {
    if (fileType === 'application/pdf') return 'pdf';
    if (fileType.includes('word')) return 'word';
    if (fileType === 'text/plain') return 'alt';
    return 'file';
}

function removeFile(fileId) {
    uploadedFiles = uploadedFiles.filter(file => file.id !== fileId);
    renderFileList();
    saveToLocalStorage();
    showNotification('File removed', 'info');
}

function processFile(fileId) {
    const file = uploadedFiles.find(f => f.id === fileId);
    if (!file) return;
    
    showNotification(`Processing ${file.name}...`, 'info');
    
    // Simulate API call to backend
    setTimeout(() => {
        showNotification(`${file.name} processed successfully! You can now ask questions about it.`, 'success');
        
        // Add a bot message about the processed file
        addBotMessage(`I've processed "${file.name}". You can now ask me questions about this document.`);
    }, 1500);
}

// Q&A Functions
function handleQuestionSubmit() {
    const question = questionInput.value.trim();
    
    if (!question) {
        showNotification('Please enter a question', 'warning');
        return;
    }
    
    if (uploadedFiles.length === 0) {
        showNotification('Please upload a document first', 'warning');
        return;
    }
    
    // Add user message to chat
    addUserMessage(question);
    
    // Clear input
    questionInput.value = '';
    
    // Simulate API call to backend
    simulateAnswerGeneration(question);
}

function addUserMessage(message) {
    const messageObj = {
        id: generateId(),
        type: 'user',
        content: message,
        timestamp: new Date()
    };
    
    chatMessages.push(messageObj);
    renderChatHistory();
    saveToLocalStorage();
}

function addBotMessage(message) {
    const messageObj = {
        id: generateId(),
        type: 'bot',
        content: message,
        timestamp: new Date()
    };
    
    chatMessages.push(messageObj);
    renderChatHistory();
    saveToLocalStorage();
}

function renderChatHistory() {
    chatHistory.innerHTML = chatMessages.map(msg => `
        <div class="message ${msg.type}-message">
            <div class="message-content">
                <p>${msg.content}</p>
                <small>${formatTime(msg.timestamp)}</small>
            </div>
        </div>
    `).join('');
    
    // Scroll to bottom
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function simulateAnswerGeneration(question) {
    // Show loading indicator
    const loadingId = generateId();
    chatMessages.push({
        id: loadingId,
        type: 'bot',
        content: '<div class="loading-dots"><span></span><span></span><span></span></div>',
        timestamp: new Date()
    });
    renderChatHistory();
    
    // Simulate API delay
    setTimeout(() => {
        // Remove loading indicator
        chatMessages = chatMessages.filter(msg => msg.id !== loadingId);
        
        // Generate simulated answer based on question
        const answer = generateSimulatedAnswer(question);
        
        // Add answer to chat and history
        addBotMessage(answer);
        
        // Add to query history
        queryHistory.push({
            id: generateId(),
            question: question,
            answer: answer,
            timestamp: new Date()
        });
        
        renderQueryHistory();
        saveToLocalStorage();
    }, 2000);
}

function generateSimulatedAnswer(question) {
    // Simple pattern matching for demo purposes
    const lowerQuestion = question.toLowerCase();
    
    if (lowerQuestion.includes('what') && lowerQuestion.includes('document')) {
        return "This document appears to be a sample document uploaded for demonstration purposes. It contains various sections that can be queried using this Q&A system.";
    } else if (lowerQuestion.includes('who') && (lowerQuestion.includes('author') || lowerQuestion.includes('created'))) {
        return "Based on the document metadata, it was created by a user of the KnowledgeScout system. The exact author information would depend on the original document properties.";
    } else if (lowerQuestion.includes('summary') || lowerQuestion.includes('summarize')) {
        return "The document covers multiple topics that can be explored through specific questions. For a detailed summary, I would need to analyze the content more thoroughly. Could you ask about a specific section or topic?";
    } else if (lowerQuestion.includes('how many') || lowerQuestion.includes('number of')) {
        return "The document contains several sections, but the exact count would depend on the document structure. In a typical document, you might find sections like introduction, methodology, results, and conclusion.";
    } else {
        // Generic answer
        const answers = [
            "Based on the document content, I can tell you that this information is covered in section 3.2. Would you like me to provide more specific details?",
            "The document mentions this topic in the context of the main discussion. The relevant information appears in the second half of the document.",
            "I found several references to this in the document. The most relevant passage states that this is an important aspect of the overall topic.",
            "This question relates to the core subject matter of the document. The author discusses this in detail across multiple sections.",
            "The document provides comprehensive coverage of this topic. Would you like me to focus on a specific aspect of it?"
        ];
        
        return answers[Math.floor(Math.random() * answers.length)];
    }
}

// History Functions
function renderQueryHistory() {
    if (queryHistory.length === 0) {
        historyList.innerHTML = '<p class="empty-state">No queries yet. Ask a question to see your history here.</p>';
        return;
    }
    
    // Show latest first
    const sortedHistory = [...queryHistory].reverse();
    
    historyList.innerHTML = sortedHistory.map(item => `
        <div class="history-item" onclick="loadHistoryItem('${item.id}')">
            <div class="history-question">${item.question}</div>
            <div class="history-answer">${item.answer.substring(0, 100)}...</div>
            <small>${formatDate(item.timestamp)}</small>
        </div>
    `).join('');
}

function loadHistoryItem(historyId) {
    const item = queryHistory.find(h => h.id === historyId);
    if (!item) return;
    
    // Add to chat
    addUserMessage(item.question);
    addBotMessage(item.answer);
    
    // Scroll to Q&A section
    document.getElementById('qa').scrollIntoView({
        behavior: 'smooth'
    });
}

// Utility Functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatTime(date) {
    return new Date(date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    // Add styles if not already added
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 6px;
                color: white;
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: space-between;
                min-width: 300px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                animation: slideIn 0.3s ease-out;
            }
            .notification-info { background-color: var(--primary); }
            .notification-success { background-color: var(--success); }
            .notification-warning { background-color: var(--warning); color: var(--dark); }
            .notification-error { background-color: var(--danger); }
            .notification button {
                background: none;
                border: none;
                color: inherit;
                font-size: 1.2rem;
                cursor: pointer;
                margin-left: 10px;
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Local Storage Functions
function saveToLocalStorage() {
    const data = {
        uploadedFiles: uploadedFiles.map(f => ({
            id: f.id,
            name: f.name,
            size: f.size,
            type: f.type,
            uploadDate: f.uploadDate
        })),
        chatMessages: chatMessages,
        queryHistory: queryHistory
    };
    
    localStorage.setItem('knowledgeScoutData', JSON.stringify(data));
}

function loadFromLocalStorage() {
    const data = JSON.parse(localStorage.getItem('knowledgeScoutData'));
    
    if (data) {
        uploadedFiles = data.uploadedFiles || [];
        chatMessages = data.chatMessages || [];
        queryHistory = data.queryHistory || [];
    }
}

// Export functions for global scope
window.removeFile = removeFile;
window.processFile = processFile;
window.loadHistoryItem = loadHistoryItem;