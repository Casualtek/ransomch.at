/* Viewer JavaScript for Ransomch.at
 *
 * Features:
 *  - Chat directory sidebar (grouped, searchable)
 *  - Deep links:  #/chat/<group>/<chatId>  and  ?group=<g>&chat=<id>
 *  - Copy direct link to the current chat
 *  - Clean, professional rendering of attacker / victim / system messages
 */

'use strict';

const CHAT_INDEX_URL =
    'https://raw.githubusercontent.com/Casualtek/Ransomchats/main/chat_index.json';

// ---- State ---------------------------------------------------------------
let chatIndex = null;
let currentGroup = null;
let currentChat = null;   // the chat index entry for the open conversation
let searchToken = 0;
const openGroups = new Set();  // remember which groups are expanded

// ---- Utilities ------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatGroupName(group) {
    const known = {
        'lockbit3.0': 'LockBit 3.0',
        'mount-locker': 'Mount Locker',
        fog: 'Fog',
        trinity: 'Trinity',
    };
    if (known[group]) return known[group];
    return group.charAt(0).toUpperCase() + group.slice(1);
}

function chatIdOf(chat) {
    return chat.chat_id || chat.filename || '';
}

function chatFileUrl(group, chat) {
    if (chat.raw_url) return chat.raw_url;
    if (chat.path) return `https://raw.githubusercontent.com/Casualtek/Ransomchats/main/${chat.path.replace(/^\/+/, '')}`;
    return `https://raw.githubusercontent.com/Casualtek/Ransomchats/main/chats/${group}/${chat.filename}`;
}

// Canonical deep link for a chat (optionally pointing at a specific message)
function deepLinkFor(group, chat, msgIndex = null) {
    let url = `${location.origin}${location.pathname}#/chat/${encodeURIComponent(group)}/${encodeURIComponent(chatIdOf(chat))}`;
    if (msgIndex !== null) url += `/msg/${msgIndex}`;
    return url;
}

// Find a chat entry by chatId (or filename) within a group
function findChat(group, chatId) {
    const g = chatIndex?.groups?.[group];
    if (!g) return null;
    return (g.chats || []).find(
        (c) => chatIdOf(c) === chatId || c.filename === chatId
    ) || null;
}

// ---- Routing ---------------------------------------------------------------
// Supported:
//   #/chat/<group>/<chatId>
//   #/chat/<group>/<chatId>/msg/<n>
//   ?group=<g>&chat=<id>&msg=<n>
function parseRoute() {
    const hash = location.hash || '';

    const mm = hash.match(/^#\/chat\/([^\/]+)\/(.+?)\/msg\/(\d+)$/);
    if (mm) {
        return {
            group: decodeURIComponent(mm[1]),
            chatId: decodeURIComponent(mm[2]),
            msgIndex: parseInt(mm[3], 10),
        };
    }

    const m = hash.match(/^#\/chat\/([^\/]+)\/(.+)$/);
    if (m) {
        return { group: decodeURIComponent(m[1]), chatId: decodeURIComponent(m[2]) };
    }

    const params = new URLSearchParams(location.search);
    const g = params.get('group');
    const c = params.get('chat');
    const msg = params.get('msg');
    if (g && c) {
        const route = { group: g, chatId: c };
        if (msg !== null && /^\d+$/.test(msg)) route.msgIndex = parseInt(msg, 10);
        return route;
    }

    const g2 = params.get('group');
    if (g2) return { group: g2, chatId: null };

    return null;
}

async function applyRoute() {
    if (!chatIndex) return; // will be applied after index loads
    const route = parseRoute();
    if (!route) return;

    const group = route.group;
    if (!chatIndex.groups?.[group]) {
        // Try a case-insensitive group match as a convenience
        const match = Object.keys(chatIndex.groups).find(
            (k) => k.toLowerCase() === String(group).toLowerCase()
        );
        if (match) await selectGroup(match);
        return showToast(`Unknown group "${escapeHtml(group)}"`);
    }

    await selectGroup(group, { updateUrl: !route.chatId });

    if (route.chatId) {
        const chat = findChat(group, route.chatId);
        if (chat) {
            await openChat(group, chat, {
                updateUrl: route.msgIndex == null,
                focusIndex: route.msgIndex ?? null,
            });
        } else {
            showToast(`Chat "${escapeHtml(route.chatId)}" not found`);
        }
    }
}

// Keep the URL in sync with the open conversation (deep links)
function setRoute(group, chat) {
    const url = chat
        ? `#/chat/${encodeURIComponent(group)}/${encodeURIComponent(chatIdOf(chat))}`
        : `#/group/${encodeURIComponent(group)}`;
    history.replaceState(null, '', url);
}

// ---- Directory sidebar ------------------------------------------------------
function renderDirectory(filter = '') {
    const container = $('#groupList');
    const q = filter.trim().toLowerCase();
    container.innerHTML = '';

    if (!chatIndex?.groups) {
        container.innerHTML = '<div class="sidebar-empty">Failed to load conversations.</div>';
        return;
    }

    const groups = Object.keys(chatIndex.groups).sort((a, b) => a.localeCompare(b));
    let anyVisible = false;

    for (const group of groups) {
        const chats = (chatIndex.groups[group].chats || []).slice();
        const groupName = formatGroupName(group);

        const visibleChats = q
            ? chats.filter((c) =>
                chatIdOf(c).toLowerCase().includes(q) ||
                groupName.toLowerCase().includes(q) ||
                group.toLowerCase().includes(q))
            : chats;

        // Hide groups that don't match the filter and have no matching chats
        if (q && visibleChats.length === 0 && !groupName.toLowerCase().includes(q)) {
            continue;
        }
        anyVisible = true;

        const groupEl = document.createElement('div');
        const isOpen = openGroups.has(group) || group === currentGroup || Boolean(q);
        if (isOpen) openGroups.add(group);
        groupEl.className = 'group-block' + (isOpen ? ' open' : '');

        const header = document.createElement('button');
        header.className = 'group-header';
        header.setAttribute('role', 'treeitem');
        header.innerHTML = `
            <span class="group-chevron">›</span>
            <span class="group-name">${escapeHtml(groupName)}</span>
            <span class="group-count">${chats.length}</span>
        `;
        header.addEventListener('click', () => {
            groupEl.classList.toggle('open');
            if (groupEl.classList.contains('open')) openGroups.add(group);
            else openGroups.delete(group);
        });

        const list = document.createElement('div');
        list.className = 'group-chats';

        for (const chat of visibleChats.sort((a, b) =>
            chatIdOf(a).localeCompare(chatIdOf(b)))) {
            const item = document.createElement('button');
            item.className = 'chat-item' +
                (currentChat && chatIdOf(currentChat) === chatIdOf(chat) ? ' active' : '');

            const count = chat.message_count;
            const countText =
                (typeof count === 'number' && isFinite(count)) ? String(count) : '…';

            item.innerHTML = `
                <span class="chat-id">${escapeHtml(chatIdOf(chat))}</span>
                <span class="chat-msgs" title="${countText === '…' ? 'message count unknown' : countText + ' messages'}">${countText}</span>
            `;
            item.title = `${groupName} · ${chatIdOf(chat)}` +
                (countText === '…' ? ' · message count unknown' : ` · ${countText} messages`);
            item.addEventListener('click', () => {
                openChat(group, chat, true);
                // On small screens, collapse the directory so the chat is visible
                if (window.innerWidth <= 900) document.querySelector('.viewer-shell')?.classList.add('collapsed');
            });
            list.appendChild(item);
        }

        groupEl.appendChild(header);
        groupEl.appendChild(list);
        container.appendChild(groupEl);
    }

    if (!anyVisible) {
        container.innerHTML = '<div class="sidebar-empty">No conversations match your filter.</div>';
    }
}

// ---- Conversation selection -------------------------------------------------
async function selectGroup(group, { updateUrl = true } = {}) {
    currentGroup = group;
    currentChat = null;
    renderDirectory($('#searchInput')?.value || '');
    if (updateUrl) setRoute(group, null);
    $('#copyLinkBtn').disabled = true;
}

async function openChat(group, chat, opts = {}) {
    // Support the legacy boolean signature: openChat(group, chat, true)
    if (typeof opts === 'boolean') opts = { updateUrl: opts };
    const { updateUrl = true, focusIndex = null } = opts;
    currentGroup = group;
    currentChat = chat;

    // Reflect selection in the directory
    document.querySelectorAll('.chat-item.active').forEach((el) => el.classList.remove('active'));
    renderDirectory($('#searchInput')?.value || '');

    if (updateUrl) setRoute(group, chat);

    // Enable + wire the copy-link button
    const copyBtn = $('#copyLinkBtn');
    copyBtn.disabled = false;
    copyBtn.onclick = () => copyLink(group, chat);

    // Header info
    setTopbarInfo(chatIdOf(chat), `${formatGroupName(group)} · ${chat.message_count ?? '…'} messages`);

    // Loading state
    const chatContent = $('#chatContent');
    chatContent.innerHTML = `
        <div class="empty-state">
            <div class="message-loading"><span></span><span></span><span></span></div>
            <p>Loading messages…</p>
        </div>`;
    chatContent.scrollTop = 0;

    try {
        const data = await fetchChatData(chatFileUrl(group, chat));
        const messages = data.messages || [];
        setTopbarInfo(chatIdOf(chat), `${formatGroupName(group)} · ${messages.length} messages`);
        renderMessages(messages);
        if (focusIndex !== null) focusMessage(focusIndex);
    } catch (err) {
        console.error('Error loading chat:', err);
        chatContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <h3>Could not load conversation</h3>
                <p>${escapeHtml(err.message)}</p>
            </div>`;
    }
}

async function fetchChatData(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ---- Rendering --------------------------------------------------------------
function setTopbarInfo(title, meta) {
    $('#topbarInfo').innerHTML = `
        <div class="topbar-title">${escapeHtml(title)}</div>
        <div class="topbar-meta">${escapeHtml(meta)}</div>
    `;
}

function renderMessages(messages) {
    const chatContent = $('#chatContent');
    chatContent.innerHTML = '';

    if (!messages || messages.length === 0) {
        chatContent.innerHTML = '<div class="empty-state"><p>No messages in this conversation.</p></div>';
        return;
    }

    messages.forEach((message, index) => {
        const party = (message.party || '').toLowerCase();
        const type = party === 'victim' ? 'victim' : party === 'system' ? 'system' : 'attacker';
        const sender = String(message.party || 'Unknown');
        const initial = escapeHtml((sender.replace(/[^a-zA-Z0-9 ]/g, '').trim()[0] || '?').toUpperCase());

        const el = document.createElement('div');
        el.className = `message message-${type}`;
        el.id = `msg-${index}`;
        el.innerHTML = `
            <div class="message-head">
                <span class="msg-avatar avatar-${type}">${initial}</span>
                <span class="msg-sender sender-${type}">${escapeHtml(sender)}</span>
                ${message.timestamp && message.timestamp.trim()
                    ? `<span class="msg-time">${escapeHtml(message.timestamp)}</span>` : ''}
                <button class="msg-link-btn" title="Copy direct link to this message" aria-label="Copy direct link to this message">
                    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M10.6 13.4a1 1 0 0 0 1.4 1.4l3.2-3.2a3 3 0 0 0 0-4.24l-1.5-1.5a1 1 0 1 0-1.42 1.42l1.5 1.5a1 1 0 0 1 0 1.4l-3.14 3.22Zm2.8-2.8a1 1 0 0 0-1.4-1.4l-3.2 3.2a3 3 0 0 0 0 4.24l1.5 1.5a1 1 0 0 0 1.4-1.42l-1.5-1.5a1 1 0 0 1 0-1.4l3.2-3.22Z"/></svg>
                </button>
            </div>
            <div class="msg-body">${escapeHtml(message.content ?? '')}</div>
        `;
        el.querySelector('.msg-link-btn').addEventListener('click', () => copyMessageLink(index));
        chatContent.appendChild(el);
    });

    chatContent.scrollTop = 0;
}

// Scroll to a message by index and flash-highlight it
function focusMessage(index) {
    const el = document.getElementById(`msg-${index}`);
    if (!el) {
        showToast(`Message #${index + 1} not found in this conversation`);
        return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('msg-highlight');
    setTimeout(() => el.classList.remove('msg-highlight'), 2600);
}

// Copy a direct link pointing at a specific message
async function copyMessageLink(index) {
    if (!currentGroup || !currentChat) return;
    const link = deepLinkFor(currentGroup, currentChat, index);
    try {
        await navigator.clipboard.writeText(link);
        showToast(`Link to message #${index + 1} copied`);
    } catch {
        const ta = document.createElement('textarea');
        ta.value = link;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); showToast(`Link to message #${index + 1} copied`); }
        catch { showToast(link); }
        document.body.removeChild(ta);
    }
}

// ---- Copy link --------------------------------------------------------------
async function copyLink(group, chat) {
    const link = deepLinkFor(group, chat);
    try {
        await navigator.clipboard.writeText(link);
        showToast('Direct link copied to clipboard');
    } catch {
        // Fallback for older browsers / permission issues
        const ta = document.createElement('textarea');
        ta.value = link;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); showToast('Direct link copied to clipboard'); }
        catch { showToast(link); }
        document.body.removeChild(ta);
    }
}

let toastTimer = null;
function showToast(text) {
    const toast = $('#toast');
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

// ---- Load index --------------------------------------------------------------
async function loadChatIndex() {
    const container = $('#groupList');
    try {
        const res = await fetch(`${CHAT_INDEX_URL}?t=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        chatIndex = await res.json();
        renderDirectory('');
        await applyRoute();
    } catch (err) {
        console.error('Error loading chat index:', err);
        container.innerHTML = `
            <div class="sidebar-empty">
                Failed to load conversations.<br>
                <small>${escapeHtml(err.message)}</small>
            </div>`;
    }
}

// ---- Sidebar collapse (mobile) ------------------------------------------------
function setupSidebarToggle() {
    const btn = $('#sidebarToggle');
    const shell = document.querySelector('.viewer-shell');
    const apply = () => {
        if (window.innerWidth > 900) {
            shell.classList.remove('collapsed');
            btn.style.display = 'none';
        } else {
            btn.style.display = 'flex';
        }
    };
    btn.addEventListener('click', () => shell.classList.toggle('collapsed'));
    window.addEventListener('resize', apply);
    apply();
}

// ---- Search -------------------------------------------------------------------
function setupSearch() {
    const input = $('#searchInput');
    input.addEventListener('input', () => {
        const token = ++searchToken;
        // debounce ~150ms
        setTimeout(() => {
            if (token === searchToken) renderDirectory(input.value);
        }, 150);
    });
}

// ---- Init ---------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    setupSidebarToggle();
    setupSearch();
    loadChatIndex();
    window.addEventListener('hashchange', applyRoute);
});
