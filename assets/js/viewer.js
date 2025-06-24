// Viewer JavaScript for Ransomch.at

// Configuration
const CHAT_INDEX_URL = 'https://raw.githubusercontent.com/Casualtek/Ransomchats/main/chat_index.json';

// State
let chatIndex = null;
let currentGroup = null;
let currentChat = null;
let lastScrollTop = 0;
let scrollThreshold = 50;

// Initialize the application
async function init() {
    // Create dropdown containers in dropdown bar
    const dropdownBar = document.querySelector('.dropdown-bar');
    dropdownBar.innerHTML = `
        <div class="dropdown-container-wrapper">
            <div class="dropdown-container">
                <select id="groupDropdown" class="dropdown-select">
                    <option value="">Loading groups...</option>
                </select>
                <div class="loading-indicator group-loading"></div>
            </div>
            <div class="dropdown-container">
                <select id="chatDropdown" class="dropdown-select" disabled>
                    <option value="">Select a group first</option>
                </select>
                <div class="loading-indicator chat-loading" style="display: none;"></div>
            </div>
        </div>
    `;

    // Load chat index
    await loadChatIndex();
    
    // Setup dropdown event listeners
    setupDropdownListeners();
    
    // Setup scroll listener
    setupScrollListener();
    
    // Show initial empty state
    showEmptyState();
}

// Setup scroll listener for dropdown bar visibility
function setupScrollListener() {
    const chatContent = document.getElementById('chatContent');
    const dropdownBar = document.querySelector('.dropdown-bar');
    const mainContent = document.querySelector('.main-content');
    
    chatContent.addEventListener('scroll', () => {
        const scrollTop = chatContent.scrollTop;
        const scrollHeight = chatContent.scrollHeight;
        const clientHeight = chatContent.clientHeight;
        
        // Check if we're at the top or bottom
        const isAtTop = scrollTop <= scrollThreshold;
        const isAtBottom = scrollTop >= scrollHeight - clientHeight - scrollThreshold;
        
        // Check if we're scrolling up or down
        const isScrollingUp = scrollTop < lastScrollTop;
        
        // Show dropdown bar if:
        // - At the top
        // - At the bottom
        // - Scrolling up and not too far down
        const shouldShow = isAtTop || isAtBottom || (isScrollingUp && scrollTop < 200);
        
        if (shouldShow) {
            dropdownBar.classList.remove('hidden');
            mainContent.classList.add('with-dropdown');
        } else {
            dropdownBar.classList.add('hidden');
            mainContent.classList.remove('with-dropdown');
        }
        
        lastScrollTop = scrollTop;
    });
}

// Load the chat index file
async function loadChatIndex() {
    const groupDropdown = document.getElementById('groupDropdown');
    groupDropdown.disabled = true;
    document.querySelector('.group-loading').style.display = 'block';
    
    try {
        // Fetch with cache busting
        const response = await fetch(`${CHAT_INDEX_URL}?t=${Date.now()}`);
        if (!response.ok) throw new Error('Failed to load chat index');
        
        chatIndex = await response.json();
        
        // Update UI with groups
        populateGroupDropdown();
        
    } catch (error) {
        console.error('Error loading chat index:', error);
        showErrorState("Failed to load chat index. Please try again later.");
    } finally {
        groupDropdown.disabled = false;
        document.querySelector('.group-loading').style.display = 'none';
    }
}

// Populate group dropdown from index
function populateGroupDropdown() {
    const groupDropdown = document.getElementById('groupDropdown');
    groupDropdown.innerHTML = '<option value="">Select a group...</option>';
    
    if (!chatIndex?.groups) return;
    
    Object.keys(chatIndex.groups)
        .sort((a, b) => a.localeCompare(b))
        .forEach(group => {
            const option = document.createElement('option');
            option.value = group;
            option.textContent = `${formatGroupName(group)} (${chatIndex.groups[group].chats.length})`;
            groupDropdown.appendChild(option);
        });
}

// Format group names for display
function formatGroupName(group) {
    // Handle special cases first
    if (group === 'lockbit3.0') return 'LockBit 3.0';
    if (group === 'mount-locker') return 'Mount Locker';
    if (group === 'fog') return 'Fog';
    if (group === 'trinity') return 'Trinity';
    
    // Capitalize first letter and maintain the rest
    return group.charAt(0).toUpperCase() + group.slice(1);
}

// Update header with chat information
function updateHeaderChatInfo(chatTitle, chatMeta) {
    const logoText = document.querySelector('.logo-text');
    const chatHeaderInfo = document.querySelector('.chat-header-info');
    
    if (chatTitle && chatMeta) {
        // Hide logo text and show chat info
        logoText.style.display = 'none';
        chatHeaderInfo.classList.add('active');
        chatHeaderInfo.querySelector('.chat-title').textContent = chatTitle;
        chatHeaderInfo.querySelector('.chat-meta').innerHTML = chatMeta;
    } else {
        // Show logo text and hide chat info
        logoText.style.display = 'block';
        chatHeaderInfo.classList.remove('active');
    }
}

// Setup dropdown event listeners
function setupDropdownListeners() {
    const groupDropdown = document.getElementById('groupDropdown');
    const chatDropdown = document.getElementById('chatDropdown');
    
    // Group selection changed
    groupDropdown.addEventListener('change', async (e) => {
        const group = e.target.value;
        currentGroup = group;
        currentChat = null;
        
        // Clear header chat info
        updateHeaderChatInfo(null, null);
        
        // Enable/disable chat dropdown
        chatDropdown.disabled = true;
        chatDropdown.innerHTML = '<option value="">Loading chats...</option>';
        document.querySelector('.chat-loading').style.display = 'block';
        
        // Show loading state for messages
        const chatContent = document.getElementById('chatContent');
        chatContent.innerHTML = `
            <div class="empty-state">
                <div class="message-loading">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                </div>
                <p>Loading chats list...</p>
            </div>
        `;
        chatContent.scrollTop = 0;
        
        // Small delay to show loading state (UX improvement)
        setTimeout(() => {
            try {
                if (group && chatIndex?.groups[group]) {
                    // Populate chat dropdown
                    const chats = chatIndex.groups[group].chats || [];
                    chatDropdown.innerHTML = '<option value="">Select a chat...</option>';
                    
                    chats.forEach((chat, index) => {
                        const option = document.createElement('option');
                        // Use the filename as the unique identifier
                        option.value = chat.filename;
                        option.textContent = `${chat.chat_id} (${chat.message_count} messages)`;
                        chatDropdown.appendChild(option);
                    });
                    
                    chatDropdown.disabled = false;
                } else {
                    chatDropdown.innerHTML = '<option value="">Select a group first</option>';
                }
                
                // Show empty state
                showEmptyState();
            } finally {
                document.querySelector('.chat-loading').style.display = 'none';
            }
        }, 300);
    });
    
    // Chat selection changed
    chatDropdown.addEventListener('change', async (e) => {
        const chatFilename = e.target.value;
        if (!chatFilename) {
            showEmptyState();
            updateHeaderChatInfo(null, null);
            return;
        }
        
        // Show loading state for messages
        const chatContent = document.getElementById('chatContent');
        chatContent.innerHTML = `
            <div class="empty-state">
                <div class="message-loading">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                </div>
                <p>Loading messages...</p>
            </div>
        `;
        chatContent.scrollTop = 0;
        
        // Find selected chat by filename
        const group = currentGroup;
        const chat = (chatIndex.groups[group].chats || []).find(c => c.filename === chatFilename);
        
        if (chat) {
            await selectChat(chat);
        }
    });
}

// Select and display a chat
async function selectChat(chat) {
    currentChat = chat;
    
    try {
        // Fetch chat data from raw URL
        const chatData = await fetchChatData(chat.raw_url);
        
        // Update header with chat information
        const chatTitle = chat.chat_id;
        const chatMeta = `
            <span>Group: ${formatGroupName(currentGroup)}</span> • 
            <span>Messages: ${chatData.messages?.length || 0}</span>
        `;
        updateHeaderChatInfo(chatTitle, chatMeta);
        
        // Render messages
        renderMessages(chatData.messages || []);
    } catch (error) {
        console.error('Error loading chat:', error);
        const chatContent = document.getElementById('chatContent');
        chatContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <h3>Error loading chat</h3>
                <p>${error.message}</p>
            </div>
        `;
        updateHeaderChatInfo(null, null);
    }
}

// Fetch chat data from raw URL
async function fetchChatData(rawUrl) {
    try {
        const response = await fetch(rawUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching chat data:', error);
        throw error;
    }
}

// Render chat messages
function renderMessages(messages) {
    const chatContent = document.getElementById('chatContent');
    chatContent.innerHTML = '';
    
    if (!messages || messages.length === 0) {
        chatContent.innerHTML = '<div class="empty-state">No messages found in this chat</div>';
        return;
    }
    
    messages.forEach(message => {
        const messageDiv = document.createElement('div');
        
        // Determine message type based on party
        let messageType = 'system';
        const party = (message.party || '').toLowerCase();
        
        if (party === 'victim') {
            messageType = 'victim';
        } else if (party === 'system') {
            messageType = 'system';
        } else {
            // Any other party (like "Akira", "Conti", etc.) is considered attacker
            messageType = 'attacker';
        }
        
        messageDiv.className = `message ${messageType}`;
        
        // Format sender name
        const sender = message.party || 'Unknown';
        const cleanSender = sender.replace(/[^a-zA-Z0-9 ]/g, '');
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${cleanSender[0]?.toUpperCase() || '?'}</div>
            <div class="message-content">
                <div class="message-header">
                    <div class="message-sender">${cleanSender}</div>
                    ${message.timestamp && message.timestamp.trim() ? `<div class="message-time">${message.timestamp}</div>` : ''}
                </div>
                <div class="message-text">${message.content || ''}</div>
            </div>
        `;
        
        chatContent.appendChild(messageDiv);
    });
    
    // Scroll to top
    chatContent.scrollTop = 0;
}

// Show empty state
function showEmptyState() {
    document.getElementById('chatContent').innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">💬</div>
            <h3>Select a conversation</h3>
            <p>Choose a group and then select a chat from the dropdowns above</p>
        </div>
    `;
}

// Show error state
function showErrorState(message) {
    document.getElementById('chatContent').innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <h3>Error</h3>
            <p>${message}</p>
        </div>
    `;
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);