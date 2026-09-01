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
