const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static('.'));

// API endpoint to get all groups (folders in chats directory)
app.get('/api/groups', async (req, res) => {
    try {
        const chatsDir = path.join(__dirname, 'chats');
        
        // Read all items in the chats directory
        const items = await fs.readdir(chatsDir, { withFileTypes: true });
        
        // Filter to get only directories, excluding 'parsers' folder
        const groups = items
            .filter(item => item.isDirectory() && item.name !== 'parsers')
            .map(item => item.name)
            .sort((a, b) => a.localeCompare(b));
        
        res.json(groups);
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ error: 'Failed to fetch groups' });
    }
});

// API endpoint to get chats for a specific group
app.get('/api/chats/:group', async (req, res) => {
    try {
        const group = req.params.group;
        const groupPath = path.join(__dirname, 'chats', group);
        
        // Check if group directory exists
        try {
            await fs.access(groupPath);
        } catch (error) {
            return res.json([]);
        }
        
        // Read all files in the group directory
        const files = await fs.readdir(groupPath);
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        const chats = [];
        
        // Process each JSON file
        for (const filename of jsonFiles) {
            try {
                const filePath = path.join(groupPath, filename);
                const fileContent = await fs.readFile(filePath, 'utf8');
                const chatData = JSON.parse(fileContent);
                
                // Extract chat_id and count messages
                const chatId = chatData.chat_id || filename.replace('.json', '');
                const messageCount = chatData.messages ? chatData.messages.length : 0;
                
                chats.push({
                    id: `${group}-${filename}`,
                    chat_id: chatId,
                    group: group,
                    filename: filename,
                    path: `chats/${group}/${filename}`,
                    message_count: messageCount
                });
            } catch (error) {
                console.error(`Error processing file ${filename}:`, error);
                // Skip files that can't be parsed
            }
        }
        
        // Sort chats by chat_id
        chats.sort((a, b) => a.chat_id.localeCompare(b.chat_id));
        
        res.json(chats);
    } catch (error) {
        console.error('Error fetching chats for group:', req.params.group, error);
        res.status(500).json({ error: 'Failed to fetch chats' });
    }
});

// API endpoint to get chat data from a specific file
app.get('/api/chat-data', async (req, res) => {
    try {
        const filePath = req.query.file;
        if (!filePath) {
            return res.status(400).json({ error: 'File path is required' });
        }
        
        // Security check: ensure the file is within the chats directory
        const fullPath = path.join(__dirname, filePath);
        const chatsDir = path.join(__dirname, 'chats');
        
        if (!fullPath.startsWith(chatsDir)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Read and parse the JSON file
        const fileContent = await fs.readFile(fullPath, 'utf8');
        const chatData = JSON.parse(fileContent);
        
        res.json(chatData);
    } catch (error) {
        console.error('Error fetching chat data:', req.query.file, error);
        res.status(500).json({ error: 'Failed to fetch chat data' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Chat viewer available at http://localhost:${PORT}/viewer.html`);
});
