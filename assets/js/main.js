/* Main JavaScript for Ransomch.at (informational pages: index, about, analysis)
 *
 * Responsibilities:
 *  - Load archive statistics (negotiations / brands / messages) with a
 *    count-up animation.
 *  - Load the "last updated" date.
 * No framework, no build step.
 */

'use strict';

const INDEX_URL =
    'https://raw.githubusercontent.com/Casualtek/Ransomchats/main/chat_index.json';

let statsRequested = false;

// ---- Number formatting / animation -----------------------------------------

function formatNumber(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
}

function animateNumber(el, target, duration = 1200) {
    if (!el) return;
    const start = performance.now();

    function frame(now) {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = formatNumber(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(frame);
    }
    // If RAF is unavailable (very old/edge), set the final value directly.
    if (typeof requestAnimationFrame !== 'function') {
        el.textContent = formatNumber(target);
    } else {
        requestAnimationFrame(frame);
    }
}

// ---- Data -------------------------------------------------------------------

function totalFromGroups(groups, reducer) {
    return Object.values(groups || {}).reduce(reducer, 0);
}

function computeStats(data) {
    const s = data.statistics || {};
    const groups = data.groups || {};

    const chats = s.total_chats ??
        totalFromGroups(groups, (sum, g) => sum + (g.chats ? g.chats.length : 0));

    const brands = s.total_groups ?? Object.keys(groups).length;

    const messages = s.total_messages ??
        totalFromGroups(groups, (sum, g) =>
            sum + (g.chats
                ? g.chats.reduce((n, c) => n + (c.message_count || 0), 0)
                : 0));

    return { chats, brands, messages, lastUpdated: data.last_updated || null };
}

function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
    });
}

async function loadStatistics() {
    if (statsRequested) return;   // prevent duplicate fetch/animation on re-trigger
    statsRequested = true;

    const el = {
        chats: document.getElementById('stat-chats'),
        groups: document.getElementById('stat-groups'),
        messages: document.getElementById('stat-messages'),
        updated: document.getElementById('last-updated'),
    };
    const err = {
        chats: document.getElementById('error-chats'),
        groups: document.getElementById('error-groups'),
        messages: document.getElementById('error-messages'),
    };

    Object.values(el).forEach((n) => n && n.classList && n.classList.add('loading'));
    Object.values(err).forEach((n) => { if (n) { n.classList.remove('show'); n.textContent = ''; } });

    try {
        const res = await fetch(`${INDEX_URL}?t=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const s = computeStats(data);

        if (el.updated) {
            el.updated.textContent = s.lastUpdated
                ? `Last updated: ${formatDate(s.lastUpdated)}`
                : 'Last updated: Unknown';
        }

        animateNumber(el.chats, s.chats);
        animateNumber(el.groups, s.brands);
        animateNumber(el.messages, s.messages);
    } catch (e) {
        // Show honest "couldn't load" state instead of fake demo numbers.
        if (el.chats) el.chats.textContent = '—';
        if (el.groups) el.groups.textContent = '—';
        if (el.messages) el.messages.textContent = '—';
        if (el.updated) el.updated.textContent = 'Last updated: Unable to load';
        Object.values(err).forEach((n) => { if (n) { n.textContent = 'Unable to load'; n.classList.add('show'); } });
    } finally {
        Object.values(el).forEach((n) => n && n.classList && n.classList.remove('loading'));
    }
}

// ---- Init -------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // Stats + last-updated are only present on index.html
    if (document.getElementById('stat-chats')) loadStatistics();
    else if (document.getElementById('last-updated')) loadStatistics(); // analysis/about show the date only
});
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

// Canonical deep link for a chat
function deepLinkFor(group, chat) {
    return `${location.origin}${location.pathname}#/chat/${encodeURIComponent(group)}/${encodeURIComponent(chatIdOf(chat))}`;
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
//   ?group=<g>&chat=<id>
function parseRoute() {
    const hash = location.hash || '';

    const m = hash.match(/^#\/chat\/([^\/]+)\/(.+)$/);
    if (m) {
        return { group: decodeURIComponent(m[1]), chatId: decodeURIComponent(m[2]) };
    }

    const params = new URLSearchParams(location.search);
    const g = params.get('group');
    const c = params.get('chat');
    if (g && c) return { group: g, chatId: c };

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

    await selectGroup(group);

    if (route.chatId) {
        const chat = findChat(group, route.chatId);
        if (chat) {
            await openChat(group, chat, /*updateUrl=*/false);
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
            item.textContent = chatIdOf(chat);
            item.title = `${groupName} · ${chatIdOf(chat)}`;
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
async function selectGroup(group) {
    currentGroup = group;
    currentChat = null;
    renderDirectory($('#searchInput')?.value || '');
    setRoute(group, null);
    $('#copyLinkBtn').disabled = true;
}

async function openChat(group, chat, updateUrl = true) {
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

    for (const message of messages) {
        const party = (message.party || '').toLowerCase();
        const type = party === 'victim' ? 'victim' : party === 'system' ? 'system' : 'attacker';
        const sender = String(message.party || 'Unknown');
        const initial = escapeHtml((sender.replace(/[^a-zA-Z0-9 ]/g, '').trim()[0] || '?').toUpperCase());

        const el = document.createElement('div');
        el.className = `message message-${type}`;
        el.innerHTML = `
            <div class="message-head">
                <span class="msg-avatar avatar-${type}">${initial}</span>
                <span class="msg-sender sender-${type}">${escapeHtml(sender)}</span>
                ${message.timestamp && message.timestamp.trim()
                    ? `<span class="msg-time">${escapeHtml(message.timestamp)}</span>` : ''}
            </div>
            <div class="msg-body">${escapeHtml(message.content ?? '')}</div>
        `;
        chatContent.appendChild(el);
    }

    chatContent.scrollTop = 0;
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
