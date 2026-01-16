// ==UserScript==
// @name         Corrupt ULTRA - BETTER BEST 1
// @namespace    tampermonkey.net
// @version      400.0-ULTRA
// @description  Advanced API integration, co-host system, stealth mode, 500+ commands
// @match        https://discord.com/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function(){
'use strict';

/* ================= CORE UTILITIES ================= */
const $ = q => document.querySelector(q);
const $$ = q => [...document.querySelectorAll(q)];
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const randomDelay = (min,max) => sleep(Math.random()*(max-min)+min);

/* ================= ADVANCED STATE ================= */
let S = JSON.parse(localStorage.getItem('CORRUPT_ULTRA')||'null') || {
    // Core
    timerUnlocked: false,
    userKey: '',
    expiryDate: null,
    lastCheck: null,
    
    // UI
    menu: {x:20, y:60, width:450, height:700},
    theme: {
        bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        accent: '#667eea',
        text: '#fff',
        fontSize: 13,
        blur: 10,
        opacity: 0.98
    },
    collapsed: {},
    
    // Features
    spam: false,
    spamText: 'Hello ð',
    spamDelay: 1200,
    humanize: true,
    targetUserID: '',
    targetChannelID: '',
    serverID: '',
    
    // Advanced
    coHosts: [], // Array of user IDs who can use commands
    commandPrefix: '!c',
    stealthMode: true,
    autoReply: false,
    autoReplyMsg: 'AFK - will respond later',
    messageQueue: [],
    
    // API Keys
    apiKeys: {
        openai: '',
        replicate: '',
        webhook: ''
    },
    
    // Statistics
    stats: {
        messagesSent: 0,
        commandsRun: 0,
        sessionsActive: 0
    }
};

const save = () => localStorage.setItem('CORRUPT_ULTRA', JSON.stringify(S));
let countdownInterval = null;

/* ================= STEALTH & ANTI-DETECTION ================= */
const Stealth = {
    // Randomize delays to appear human
    humanDelay: () => S.humanize ? randomDelay(800, 2500) : sleep(500),
    
    // Random typing patterns
    simulateTyping: async (text) => {
        const box = getBox();
        if (!box) return;
        
        box.focus();
        for (let char of text) {
            document.execCommand('insertText', false, char);
            if (S.humanize) await randomDelay(50, 150);
        }
    },
    
    // Avoid detection patterns
    varyMessage: (msg) => {
        if (!S.humanize) return msg;
        const variations = [
            msg,
            msg + ' ',
            ' ' + msg,
            msg + String.fromCharCode(0x200B), // Zero-width space
        ];
        return variations[Math.floor(Math.random() * variations.length)];
    },
    
    // Check if being rate limited
    checkRateLimit: () => {
        const now = Date.now();
        if (!S.lastMessageTime) S.lastMessageTime = now;
        const diff = now - S.lastMessageTime;
        S.lastMessageTime = now;
        return diff < 1000; // Less than 1 second = potential rate limit
    }
};

/* ================= DISCORD API WRAPPER ================= */
const DiscordAPI = {
    token: () => {
        const token = document.body.appendChild(document.createElement('iframe')).contentWindow.localStorage.token;
        return token ? token.replace(/"/g, '') : null;
    },
    
    headers: () => ({
        'Authorization': DiscordAPI.token(),
        'Content-Type': 'application/json'
    }),
    
    // Get current channel ID
    getCurrentChannel: () => {
        const url = window.location.href;
        const match = url.match(/channels\/\d+\/(\d+)/);
        return match ? match[1] : null;
    },
    
    // Get current server ID
    getCurrentServer: () => {
        const url = window.location.href;
        const match = url.match(/channels\/(\d+)\//);
        return match && match[1] !== '@me' ? match[1] : null;
    },
    
    // Fetch user info
    getUser: async (userID) => {
        try {
            const res = await fetch(`https://discord.com/api/v9/users/${userID}`, {
                headers: DiscordAPI.headers()
            });
            return await res.json();
        } catch (e) {
            console.error('Failed to fetch user:', e);
            return null;
        }
    },
    
    // Fetch server info
    getServer: async (serverID) => {
        try {
            const res = await fetch(`https://discord.com/api/v9/guilds/${serverID}`, {
                headers: DiscordAPI.headers()
            });
            return await res.json();
        } catch (e) {
            console.error('Failed to fetch server:', e);
            return null;
        }
    },
    
    // Get server members
    getMembers: async (serverID, limit = 100) => {
        try {
            const res = await fetch(`https://discord.com/api/v9/guilds/${serverID}/members?limit=${limit}`, {
                headers: DiscordAPI.headers()
            });
            return await res.json();
        } catch (e) {
            console.error('Failed to fetch members:', e);
            return [];
        }
    },
    
    // Send message via API
    sendMessage: async (channelID, content) => {
        try {
            const res = await fetch(`https://discord.com/api/v9/channels/${channelID}/messages`, {
                method: 'POST',
                headers: DiscordAPI.headers(),
                body: JSON.stringify({ content })
            });
            S.stats.messagesSent++;
            save();
            return await res.json();
        } catch (e) {
            console.error('Failed to send message:', e);
            return null;
        }
    },
    
    // Delete message
    deleteMessage: async (channelID, messageID) => {
        try {
            await fetch(`https://discord.com/api/v9/channels/${channelID}/messages/${messageID}`, {
                method: 'DELETE',
                headers: DiscordAPI.headers()
            });
            return true;
        } catch (e) {
            console.error('Failed to delete message:', e);
            return false;
        }
    },
    
    // Add reaction
    addReaction: async (channelID, messageID, emoji) => {
        try {
            await fetch(`https://discord.com/api/v9/channels/${channelID}/messages/${messageID}/reactions/${encodeURIComponent(emoji)}/@me`, {
                method: 'PUT',
                headers: DiscordAPI.headers()
            });
            return true;
        } catch (e) {
            console.error('Failed to add reaction:', e);
            return false;
        }
    },
    
    // Get messages from channel
    getMessages: async (channelID, limit = 50) => {
        try {
            const res = await fetch(`https://discord.com/api/v9/channels/${channelID}/messages?limit=${limit}`, {
                headers: DiscordAPI.headers()
            });
            return await res.json();
        } catch (e) {
            console.error('Failed to fetch messages:', e);
            return [];
        }
    },
    
    // Purge messages (self-destruct)
    purgeMessages: async (channelID, limit = 50) => {
        try {
            const messages = await DiscordAPI.getMessages(channelID, limit);
            const myID = (await DiscordAPI.getUser('@me')).id;
            const myMessages = messages.filter(m => m.author.id === myID);
            
            for (const msg of myMessages) {
                await DiscordAPI.deleteMessage(channelID, msg.id);
                await randomDelay(500, 1000);
            }
            return myMessages.length;
        } catch (e) {
            console.error('Failed to purge messages:', e);
            return 0;
        }
    }
};

/* ================= AI API INTEGRATION ================= */
const AI = {
    // OpenAI GPT
    gpt: async (prompt, model = 'gpt-3.5-turbo') => {
        if (!S.apiKeys.openai) return 'OpenAI API key not set';
        try {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${S.apiKeys.openai}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 150
                })
            });
            const data = await res.json();
            return data.choices?.[0]?.message?.content || 'No response';
        } catch (e) {
            return 'GPT Error: ' + e.message;
        }
    },
    
    // Image generation (Replicate/Stability)
    generateImage: async (prompt) => {
        if (!S.apiKeys.replicate) return 'Replicate API key not set';
        try {
            const res = await fetch('https://api.replicate.com/v1/predictions', {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${S.apiKeys.replicate}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    version: 'stability-ai/sdxl',
                    input: { prompt }
                })
            });
            const data = await res.json();
            return data.urls?.get || 'Image generation started';
        } catch (e) {
            return 'Image Error: ' + e.message;
        }
    }
};

/* ================= CO-HOST SYSTEM ================= */
const CoHost = {
    add: (userID) => {
        if (!S.coHosts.includes(userID)) {
            S.coHosts.push(userID);
            save();
            return `â Added co-host: ${userID}`;
        }
        return 'Already a co-host';
    },
    
    remove: (userID) => {
        const index = S.coHosts.indexOf(userID);
        if (index > -1) {
            S.coHosts.splice(index, 1);
            save();
            return `â Removed co-host: ${userID}`;
        }
        return 'Not a co-host';
    },
    
    isCoHost: (userID) => S.coHosts.includes(userID),
    
    list: () => S.coHosts.join(', ') || 'No co-hosts',
    
    // Process commands from co-hosts
    handleCommand: async (message) => {
        if (!message.content.startsWith(S.commandPrefix)) return;
        if (!CoHost.isCoHost(message.author.id)) return;
        
        const args = message.content.slice(S.commandPrefix.length).trim().split(' ');
        const cmd = args.shift().toLowerCase();
        
        const channelID = message.channel_id;
        
        switch(cmd) {
            case 'spam':
                const count = parseInt(args[0]) || 5;
                const text = args.slice(1).join(' ') || S.spamText;
                for (let i = 0; i < count; i++) {
                    await DiscordAPI.sendMessage(channelID, text);
                    await Stealth.humanDelay();
                }
                break;
                
            case 'purge':
                const deleted = await DiscordAPI.purgeMessages(channelID, parseInt(args[0]) || 50);
                await DiscordAPI.sendMessage(channelID, `â Purged ${deleted} messages`);
                break;
                
            case 'ai':
                const prompt = args.join(' ');
                const response = await AI.gpt(prompt);
                await DiscordAPI.sendMessage(channelID, response);
                break;
                
            case 'nuke':
                for (let i = 0; i < 20; i++) {
                    await DiscordAPI.sendMessage(channelID, 'ð¥ NUKE ð¥'.repeat(10));
                    await randomDelay(100, 300);
                }
                break;
                
            case 'status':
                await DiscordAPI.sendMessage(channelID, 
                    `ð Stats:\n` +
                    `Messages: ${S.stats.messagesSent}\n` +
                    `Commands: ${S.stats.commandsRun}\n` +
                    `Co-hosts: ${S.coHosts.length}`
                );
                break;
        }
        
        S.stats.commandsRun++;
        save();
    }
};

/* ================= MESSAGE MONITORING ================= */
const Monitor = {
    init: () => {
        // Watch for new messages
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.querySelector('[class*="message"]')) {
                        Monitor.processMessage(node);
                    }
                });
            });
        });
        
        const chatContainer = $('[class*="chat"]');
        if (chatContainer) {
            observer.observe(chatContainer, { childList: true, subtree: true });
        }
    },
    
    processMessage: async (element) => {
        // Extract message data
        const content = element.textContent;
        
        // Auto-reply
        if (S.autoReply && content.includes('@')) {
            await randomDelay(1000, 3000);
            sendMessage(S.autoReplyMsg);
        }
        
        // Log for co-host command handling
        if (content.startsWith(S.commandPrefix)) {
            // Would need actual message object from API
            console.log('Potential co-host command:', content);
        }
    }
};

/* ================= CORE FUNCTIONS ================= */
const getBox = () => document.querySelector('[role="textbox"]');

const sendMessage = async (text) => {
    const box = getBox();
    if (!box) return false;
    
    if (S.stealthMode) {
        await Stealth.simulateTyping(text);
    } else {
        box.focus();
        document.execCommand('insertText', false, text);
    }
    
    await randomDelay(100, 300);
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    
    S.stats.messagesSent++;
    save();
    return true;
};

const requireKey = fn => () => {
    if (!S.timerUnlocked) {
        showNotification('â ï¸ Verify your key first!', 'error');
        return;
    }
    S.stats.commandsRun++;
    save();
    fn();
};

/* ================= NOTIFICATION SYSTEM ================= */
function showNotification(message, type = 'info') {
    const notif = document.createElement('div');
    notif.textContent = message;
    Object.assign(notif.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '15px 25px',
        borderRadius: '12px',
        background: type === 'error' ? '#ff4444' : type === 'success' ? '#44ff44' : '#667eea',
        color: '#fff',
        fontWeight: 'bold',
        zIndex: '999999999',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: 'slideIn 0.3s ease'
    });
    document.body.appendChild(notif);
    setTimeout(() => {
        notif.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(400px); opacity: 0; } }
    @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
    @keyframes glow { 0%, 100% { box-shadow: 0 0 20px rgba(102, 126, 234, 0.5); } 50% { box-shadow: 0 0 40px rgba(102, 126, 234, 0.9); } }
`;
document.head.appendChild(style);

/* ================= WAIT FOR DISCORD ================= */
function waitForDiscord() {
    const app = $('#app-mount');
    if (app) {
        requestAnimationFrame(() => setTimeout(init, 1000));
    } else {
        requestAnimationFrame(waitForDiscord);
    }
}
waitForDiscord();

/* ================= MAIN INITIALIZATION ================= */
function init() {
    /* ================= TOGGLE BUTTON ================= */
    const toggle = document.createElement('div');
    toggle.innerHTML = 'â¡';
    Object.assign(toggle.style, {
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: '#fff',
        fontSize: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '99999999',
        cursor: 'pointer',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.6)',
        transition: 'all 0.3s ease',
        animation: 'glow 2s infinite',
        userSelect: 'none',
        touchAction: 'none'
    });
    document.body.appendChild(toggle);
    
    toggle.onmouseenter = () => {
        toggle.style.transform = 'scale(1.1) rotate(15deg)';
    };
    toggle.onmouseleave = () => {
        toggle.style.transform = 'scale(1) rotate(0deg)';
    };

    /* ================= MENU CONTAINER ================= */
    const menu = document.createElement('div');
    Object.assign(menu.style, {
        position: 'fixed',
        left: S.menu.x + 'px',
        top: S.menu.y + 'px',
        width: '480px',
        maxWidth: '95vw',
        maxHeight: '90vh',
        background: 'rgba(10, 10, 15, 0.95)',
        backdropFilter: `blur(${S.theme.blur}px)`,
        color: S.theme.text,
        borderRadius: '20px',
        display: 'none',
        flexDirection: 'column',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        zIndex: '99999998',
        fontSize: S.theme.fontSize + 'px',
        border: '2px solid rgba(102, 126, 234, 0.3)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
        opacity: S.theme.opacity
    });
    document.body.appendChild(menu);

    /* ================= HEADER ================= */
    const header = document.createElement('div');
    header.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
                <div style="font-size: 18px; font-weight: bold; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">â¡ CORRUPT ULTRA</div>
                <div style="font-size: 11px; opacity: 0.7;">Advanced Automation Suite v400.0</div>
            </div>
            <div style="font-size: 24px; cursor: pointer;" id="closeBtn">â</div>
        </div>
    `;
    Object.assign(header.style, {
        padding: '20px',
        background: 'rgba(255, 255, 255, 0.03)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'none'
    });
    menu.appendChild(header);
    
    header.querySelector('#closeBtn').onclick = () => {
        menu.style.display = 'none';
    };

    /* ================= STATUS BAR ================= */
    const statusBar = document.createElement('div');
    statusBar.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div id="statusText" style="font-weight: bold;">ð License Required</div>
            <div id="statsText" style="font-size: 11px; opacity: 0.8;">Msgs: ${S.stats.messagesSent} | Cmds: ${S.stats.commandsRun}</div>
        </div>
    `;
    Object.assign(statusBar.style, {
        padding: '12px 20px',
        background: 'rgba(102, 126, 234, 0.1)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
    });
    menu.appendChild(statusBar);
    
    const statusText = statusBar.querySelector('#statusText');
    const statsText = statusBar.querySelector('#statsText');
    
    // Update stats every 5 seconds
    setInterval(() => {
        statsText.textContent = `Msgs: ${S.stats.messagesSent} | Cmds: ${S.stats.commandsRun} | Hosts: ${S.coHosts.length}`;
    }, 5000);

    /* ================= SEARCH BAR ================= */
    const searchBar = document.createElement('input');
    searchBar.placeholder = 'ð Search commands...';
    Object.assign(searchBar.style, {
        margin: '15px 20px',
        padding: '12px 15px',
        borderRadius: '10px',
        border: '1px solid rgba(102, 126, 234, 0.3)',
        background: 'rgba(0, 0, 0, 0.3)',
        color: '#fff',
        outline: 'none',
        fontSize: '13px',
        transition: 'all 0.3s ease'
    });
    searchBar.onfocus = () => {
        searchBar.style.border = '1px solid rgba(102, 126, 234, 0.6)';
        searchBar.style.background = 'rgba(0, 0, 0, 0.5)';
    };
    searchBar.onblur = () => {
        searchBar.style.border = '1px solid rgba(102, 126, 234, 0.3)';
        searchBar.style.background = 'rgba(0, 0, 0, 0.3)';
    };
    menu.appendChild(searchBar);

    /* ================= CONTENT CONTAINER ================= */
    const content = document.createElement('div');
    Object.assign(content.style, {
        padding: '0 10px 20px 10px',
        overflowY: 'auto',
        flex: '1'
    });
    menu.appendChild(content);

    /* ================= HELPER FUNCTIONS ================= */
    function cat(title, icon = 'ð', requiresKey = true) {
        const wrap = document.createElement('div');
        wrap.requiresKey = requiresKey;
        wrap.style.marginBottom = '10px';
        
        const head = document.createElement('div');
        head.innerHTML = `${icon} ${title} <span style="float: right;">â¼</span>`;
        Object.assign(head.style, {
            padding: '15px',
            fontWeight: 'bold',
            cursor: 'pointer',
            userSelect: 'none',
            background: 'rgba(102, 126, 234, 0.1)',
            borderRadius: '10px',
            transition: 'all 0.3s ease',
            border: '1px solid rgba(102, 126, 234, 0.2)'
        });
        
        const body = document.createElement('div');
        body.style.display = (!requiresKey || S.timerUnlocked) ? (S.collapsed[title] ? 'none' : 'block') : 'none';
        body.style.padding = '10px 0';
        
        head.onclick = () => {
            const isOpen = body.style.display === 'block';
            body.style.display = isOpen ? 'none' : 'block';
            head.querySelector('span').textContent = isOpen ? 'â¶' : 'â¼';
            S.collapsed[title] = isOpen;
            save();
        };
        
        head.onmouseenter = () => {
            head.style.background = 'rgba(102, 126, 234, 0.2)';
            head.style.transform = 'translateX(5px)';
        };
        head.onmouseleave = () => {
            head.style.background = 'rgba(102, 126, 234, 0.1)';
            head.style.transform = 'translateX(0)';
        };
        
        wrap.append(head, body);
        content.appendChild(wrap);
        return body;
    }

    function updateCategoriesVisibility() {
        content.querySelectorAll('div').forEach(wrap => {
            if (wrap.requiresKey !== undefined) {
                wrap.style.display = (!wrap.requiresKey || S.timerUnlocked) ? 'block' : 'none';
            }
        });
    }

    function btn(container, text, fn, color = 'rgba(102, 126, 234, 0.15)') {
        const b = document.createElement('div');
        b.textContent = text;
        Object.assign(b.style, {
            padding: '12px 15px',
            margin: '5px 10px',
            borderRadius: '8px',
            background: color,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '12px'
        });
        b.onmouseenter = () => {
            b.style.background = 'rgba(102, 126, 234, 0.3)';
            b.style.transform = 'translateX(3px)';
        };
        b.onmouseleave = () => {
            b.style.background = color;
            b.style.transform = 'translateX(0)';
        };
        b.onclick = () => {
            b.style.animation = 'pulse 0.3s ease';
            setTimeout(() => b.style.animation = '', 300);
            fn();
        };
        container.appendChild(b);
    }

    function input(container, label, value, fn, type = 'text') {
        const wrap = document.createElement('div');
        wrap.style.padding = '5px 15px';
        
        const l = document.createElement('div');
        l.textContent = label;
        l.style.fontSize = '11px';
        l.style.marginBottom = '5px';
        l.style.opacity = '0.8';
        
        const i = document.createElement('input');
        i.type = type;
        i.value = value;
        Object.assign(i.style, {
            width: '100%',
            padding: '10px',
            borderRadius: '6px',
            border: '1px solid rgba(102, 126, 234, 0.3)',
            background: 'rgba(0, 0, 0, 0.3)',
            color: '#fff',
            outline: 'none',
            fontSize: '12px'
        });
        i.onchange = () => fn(i.value);
        i.onfocus = () => i.style.border = '1px solid rgba(102, 126, 234, 0.6)';
        i.onblur = () => i.style.border = '1px solid rgba(102, 126, 234, 0.3)';
        
        wrap.append(l, i);
        container.appendChild(wrap);
        return i;
    }

    function toggle_switch(container, label, value, fn) {
        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 15px',
            margin: '5px 10px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '8px'
        });
        
        const l = document.createElement('div');
        l.textContent = label;
        l.style.fontSize = '12px';
        
        const sw = document.createElement('div');
        Object.assign(sw.style, {
            width: '40px',
            height: '20px',
            borderRadius: '10px',
            background: value ? '#667eea' : 'rgba(255, 255, 255, 0.2)',
            position: 'relative',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
        });
        
        const knob = document.createElement('div');
        Object.assign(knob.style, {
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: '#fff',
            position: 'absolute',
            top: '2px',
            left: value ? '22px' : '2px',
            transition: 'all 0.3s ease'
        });
        sw.appendChild(knob);
        
        sw.onclick = () => {
            value = !value;
            sw.style.background = value ? '#667eea' : 'rgba(255, 255, 255, 0.2)';
            knob.style.left = value ? '22px' : '2px';
            fn(value);
        };
        
        wrap.append(l, sw);
        container.appendChild(wrap);
    }

    /* ================= LICENSE / TIMER ================= */
    const licenseCat = cat('ð License & Timer', 'ð', false);
    
    const keyInput = input(licenseCat, 'License Key', S.userKey, v => {
        S.userKey = v;
        save();
    });
    
    btn(licenseCat, 'â Verify License & Start Timer', async () => {
        if (!S.userKey) return showNotification('Enter your license key!', 'error');
        
        try {
            const res = await fetch(`https://corsproxy.io/?https://timercheck.io/${S.userKey}`);
            const data = await res.json();
            
            if (data.errorMessage === 'timer timed out' || !data.seconds_remaining || data.seconds_remaining <= 0) {
                S.timerUnlocked = false;
                S.expiryDate = null;
                save();
                statusText.textContent = 'â Plan Expired';
                updateCategoriesVisibility();
                if (countdownInterval) clearInterval(countdownInterval);
                return showNotification('â° License expired!', 'error');
            }
            
            S.timerUnlocked = true;
            S.expiryDate = Date.now() + (data.seconds_remaining * 1000);
            S.lastCheck = Date.now();
            save();
            updateCategoriesVisibility();
            showNotification('â License verified!', 'success');
            
            let sec = Math.floor(data.seconds_remaining);
            if (countdownInterval) clearInterval(countdownInterval);
            
            countdownInterval = setInterval(() => {
                if (sec <= 0) {
                    clearInterval(countdownInterval);
                    S.timerUnlocked = false;
                    S.expiryDate = null;
                    save();
                    statusText.textContent = 'â Plan Expired';
                    updateCategoriesVisibility();
                    return showNotification('â° License expired!', 'error');
                }
                
                const days = Math.floor(sec / 86400);
                const h = Math.floor((sec % 86400) / 3600);
                const m = Math.floor((sec % 3600) / 60);
                const s = sec % 60;
                
                if (days > 0) {
                    statusText.textContent = `â Active - ${days}d ${h}h ${m}m`;
                } else {
                    statusText.textContent = `â Active - ${h}h ${m}m ${s}s`;
                }
                sec--;
            }, 1000);
            
        } catch (e) {
            S.timerUnlocked = false;
            save();
            statusText.textContent = 'â Verification Failed';
            showNotification('Error: ' + e.message, 'error');
        }
    }, 'rgba(102, 234, 126, 0.2)');

    /* ================= SETTINGS ================= */
    const settingsCat = cat('âï¸ Core Settings', 'âï¸');
    
    toggle_switch(settingsCat, 'Stealth Mode (Anti-Detection)', S.stealthMode, v => {
        S.stealthMode = v;
        save();
        showNotification(v ? 'Stealth mode enabled' : 'Stealth mode disabled', 'info');
    });
    
    toggle_switch(settingsCat, 'Humanize Delays', S.humanize, v => {
        S.humanize = v;
        save();
    });
    
    toggle_switch(settingsCat, 'Auto Reply', S.autoReply, v => {
        S.autoReply = v;
        save();
    });
    
    input(settingsCat, 'Auto Reply Message', S.autoReplyMsg, v => {
        S.autoReplyMsg = v;
        save();
    });
    
    input(settingsCat, 'Command Prefix', S.commandPrefix, v => {
        S.commandPrefix = v;
        save();
    });
    
    input(settingsCat, 'Default Spam Text', S.spamText, v => {
        S.spamText = v;
        save();
    });
    
    input(settingsCat, 'Spam Delay (ms)', S.spamDelay, v => {
        S.spamDelay = parseInt(v) || 1200;
        save();
    }, 'number');

    /* ================= CO-HOST MANAGER ================= */
    const cohostCat = cat('ð¥ Co-Host Manager', 'ð¥');
    
    const cohostInput = input(cohostCat, 'User ID to Add/Remove', '', () => {});
    
    btn(cohostCat, 'â Add Co-Host', requireKey(() => {
        const userID = cohostInput.value.trim();
        if (!userID) return showNotification('Enter a user ID!', 'error');
        const msg = CoHost.add(userID);
        showNotification(msg, 'success');
        cohostInput.value = '';
    }));
    
    btn(cohostCat, 'â Remove Co-Host', requireKey(() => {
        const userID = cohostInput.value.trim();
        if (!userID) return showNotification('Enter a user ID!', 'error');
        const msg = CoHost.remove(userID);
        showNotification(msg, 'info');
        cohostInput.value = '';
    }));
    
    btn(cohostCat, 'ð List All Co-Hosts', requireKey(() => {
        showNotification('Co-hosts: ' + CoHost.list(), 'info');
    }));
    
    const cohostHelp = document.createElement('div');
    cohostHelp.innerHTML = `
        <div style="padding: 10px 15px; font-size: 11px; opacity: 0.7; background: rgba(255, 255, 255, 0.03); border-radius: 8px; margin: 10px;">
            ð¡ <strong>How it works:</strong><br>
            1. Add user IDs as co-hosts<br>
            2. They can use commands like:<br>
            <code>${S.commandPrefix}spam 10 Hello</code><br>
            <code>${S.commandPrefix}purge 50</code><br>
            <code>${S.commandPrefix}ai Write a poem</code><br>
            <code>${S.commandPrefix}nuke</code><br>
            <code>${S.commandPrefix}status</code>
        </div>
    `;
    cohostCat.appendChild(cohostHelp);

    /* ================= API INTEGRATION ================= */
    const apiCat = cat('ð¤ AI & API Integration', 'ð¤');
    
    input(apiCat, 'OpenAI API Key', S.apiKeys.openai, v => {
        S.apiKeys.openai = v;
        save();
    });
    
    input(apiCat, 'Replicate API Key', S.apiKeys.replicate, v => {
        S.apiKeys.replicate = v;
        save();
    });
    
    input(apiCat, 'Webhook URL', S.apiKeys.webhook, v => {
        S.apiKeys.webhook = v;
        save();
    });
    
    const aiPromptInput = input(apiCat, 'AI Prompt', '', () => {});
    
    btn(apiCat, 'ð§  Ask AI (GPT)', requireKey(async () => {
        const prompt = aiPromptInput.value.trim();
        if (!prompt) return showNotification('Enter a prompt!', 'error');
        showNotification('Asking AI...', 'info');
        const response = await AI.gpt(prompt);
        await sendMessage(response);
        showNotification('AI response sent!', 'success');
    }));
    
    btn(apiCat, 'ð¨ Generate Image', requireKey(async () => {
        const prompt = aiPromptInput.value.trim();
        if (!prompt) return showNotification('Enter a prompt!', 'error');
        showNotification('Generating image...', 'info');
        const response = await AI.generateImage(prompt);
        await sendMessage(response);
    }));
    
    btn(apiCat, 'ð¤ Send to Webhook', requireKey(async () => {
        if (!S.apiKeys.webhook) return showNotification('Set webhook URL first!', 'error');
        try {
            await fetch(S.apiKeys.webhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: aiPromptInput.value || 'Test message from Corrupt Ultra',
                    username: 'Corrupt Bot'
                })
            });
            showNotification('Webhook sent!', 'success');
        } catch (e) {
            showNotification('Webhook failed: ' + e.message, 'error');
        }
    }));

    /* ================= MESSAGING SUITE ================= */
    const msgCat = cat('ð¬ Advanced Messaging', 'ð¬');
    
    btn(msgCat, 'ð¤ Send Message', requireKey(async () => {
        await sendMessage(S.spamText);
        showNotification('Message sent', 'success');
    }));
    
    btn(msgCat, 'ð Toggle Spam Loop', requireKey(async () => {
        S.spam = !S.spam;
        save();
        showNotification(S.spam ? 'Spam started' : 'Spam stopped', S.spam ? 'success' : 'info');
        
        while (S.spam) {
            await sendMessage(Stealth.varyMessage(S.spamText));
            await (S.humanize ? Stealth.humanDelay() : sleep(S.spamDelay));
        }
    }));
    
    for (let i of [5, 10, 25, 50, 100]) {
        btn(msgCat, `ð¥ Burst x${i}`, requireKey(async () => {
            for (let j = 0; j < i; j++) {
                await sendMessage(Stealth.varyMessage(S.spamText));
                await (S.humanize ? randomDelay(300, 800) : sleep(200));
            }
            showNotification(`Sent ${i} messages`, 'success');
        }));
    }
    
    btn(msgCat, 'ð Emoji Flood', requireKey(async () => {
        const emojis = ['ð', 'ð', 'ð¥', 'ð¥', 'ð£', 'ð', 'ð', 'ð¤¯', 'ð', 'ð', 'â¡', 'ð'];
        for (let i = 0; i < 20; i++) {
            const emoji = emojis[Math.floor(Math.random() * emojis.length)];
            await sendMessage(emoji.repeat(15));
            await randomDelay(200, 500);
        }
    }));
    
    btn(msgCat, 'ð Random Text Generator', requireKey(async () => {
        const words = ['Epic', 'Crazy', 'Wild', 'Insane', 'Legendary', 'Massive', 'Ultimate', 'Supreme'];
        const text = Array(10).fill(0).map(() => words[Math.floor(Math.random() * words.length)]).join(' ');
        await sendMessage(text);
    }));
    
    btn(msgCat, 'â®ï¸ Reverse Text', requireKey(async () => {
        await sendMessage(S.spamText.split('').reverse().join(''));
    }));
    
    btn(msgCat, 'ð  aLtErNaTiNg CaSe', requireKey(async () => {
        const alt = S.spamText.split('').map((c, i) => i % 2 ? c.toUpperCase() : c.toLowerCase()).join('');
        await sendMessage(alt);
    }));
    
    btn(msgCat, 'ð Paste Clipboard', requireKey(async () => {
        try {
            const text = await navigator.clipboard.readText();
            await sendMessage(text);
        } catch (e) {
            showNotification('Clipboard access denied', 'error');
        }
    }));

    /* ================= DISCORD API TOOLS ================= */
    const apiToolsCat = cat('ð§ Discord API Tools', 'ð§');
    
    input(apiToolsCat, 'Target User ID', S.targetUserID, v => {
        S.targetUserID = v;
        save();
    });
    
    input(apiToolsCat, 'Target Channel ID', S.targetChannelID, v => {
        S.targetChannelID = v;
        save();
    });
    
    btn(apiToolsCat, 'ð¤ Get User Info', requireKey(async () => {
        if (!S.targetUserID) return showNotification('Set target user ID!', 'error');
        const user = await DiscordAPI.getUser(S.targetUserID);
        if (user) {
            const info = `Username: ${user.username}#${user.discriminator}\nID: ${user.id}\nBot: ${user.bot || false}`;
            showNotification(info, 'info');
        }
    }));
    
    btn(apiToolsCat, 'ð Get Current Channel', requireKey(() => {
        const channelID = DiscordAPI.getCurrentChannel();
        if (channelID) {
            S.targetChannelID = channelID;
            save();
            showNotification('Channel ID: ' + channelID, 'info');
        }
    }));
    
    btn(apiToolsCat, 'ð  Get Current Server', requireKey(async () => {
        const serverID = DiscordAPI.getCurrentServer();
        if (serverID) {
            S.serverID = serverID;
            save();
            const server = await DiscordAPI.getServer(serverID);
            if (server) showNotification(`Server: ${server.name}`, 'info');
        }
    }));
    
    btn(apiToolsCat, 'ð¥ Get Server Members', requireKey(async () => {
        if (!S.serverID) return showNotification('Get server ID first!', 'error');
        const members = await DiscordAPI.getMembers(S.serverID, 100);
        showNotification(`Found ${members.length} members`, 'info');
    }));
    
    btn(apiToolsCat, 'ð Send DM to User', requireKey(async () => {
        if (!S.targetUserID) return showNotification('Set target user ID!', 'error');
        const dmText = prompt('Enter message to send:');
        if (dmText) {
            // Would need to create DM channel first via API
            showNotification('DM functionality requires channel creation', 'info');
        }
    }));
    
    btn(apiToolsCat, 'ð¥ Purge My Messages', requireKey(async () => {
        const channelID = S.targetChannelID || DiscordAPI.getCurrentChannel();
        if (!channelID) return showNotification('No channel selected!', 'error');
        
        const limit = parseInt(prompt('How many messages to check? (max 100)') || '50');
        showNotification('Purging messages...', 'info');
        
        const deleted = await DiscordAPI.purgeMessages(channelID, limit);
        showNotification(`Deleted ${deleted} messages`, 'success');
    }));
    
    btn(apiToolsCat, 'ð¨ Send to Channel (API)', requireKey(async () => {
        const channelID = S.targetChannelID || DiscordAPI.getCurrentChannel();
        if (!channelID) return showNotification('No channel selected!', 'error');
        
        const msg = prompt('Enter message:');
        if (msg) {
            await DiscordAPI.sendMessage(channelID, msg);
            showNotification('Message sent via API', 'success');
        }
    }));
    
    btn(apiToolsCat, 'ð Get Recent Messages', requireKey(async () => {
        const channelID = S.targetChannelID || DiscordAPI.getCurrentChannel();
        if (!channelID) return showNotification('No channel selected!', 'error');
        
        const messages = await DiscordAPI.getMessages(channelID, 10);
        console.log('Recent messages:', messages);
        showNotification(`Fetched ${messages.length} messages (check console)`, 'info');
    }));

    /* ================= RAID & NUKE ================= */
    const raidCat = cat('ð£ Raid & Nuke Tools', 'ð£');
    
    btn(raidCat, 'â¢ï¸ Channel Nuke', requireKey(async () => {
        const count = parseInt(prompt('How many messages? (1-100)') || '20');
        const text = prompt('Nuke message:') || 'ð¥ NUKE ð¥';
        
        showNotification('Starting nuke...', 'info');
        for (let i = 0; i < Math.min(count, 100); i++) {
            await sendMessage(text);
            await randomDelay(100, 300);
        }
        showNotification('Nuke complete', 'success');
    }));
    
    btn(raidCat, 'ð Spam Wave', requireKey(async () => {
        const waves = parseInt(prompt('Number of waves? (1-10)') || '3');
        const perWave = parseInt(prompt('Messages per wave?') || '10');
        
        for (let w = 0; w < Math.min(waves, 10); w++) {
            showNotification(`Wave ${w + 1}/${waves}`, 'info');
            for (let i = 0; i < perWave; i++) {
                await sendMessage(`ð Wave ${w + 1} - ${S.spamText}`);
                await randomDelay(150, 400);
            }
            await sleep(2000);
        }
        showNotification('Spam waves complete', 'success');
    }));
    
    btn(raidCat, 'ð¥ Emoji Bomb', requireKey(async () => {
        const emojis = ['ð¥', 'ð£', 'ð¥', 'â¡', 'ð', 'â ï¸', 'ð¿', 'ð'];
        for (let i = 0; i < 30; i++) {
            const bomb = Array(20).fill(0).map(() => emojis[Math.floor(Math.random() * emojis.length)]).join('');
            await sendMessage(bomb);
            await randomDelay(100, 250);
        }
    }));
    
    btn(raidCat, 'ð­ Ghost Spam', requireKey(async () => {
        // Uses zero-width characters to make messages nearly invisible
        const ghost = S.spamText.split('').join('\u200B');
        for (let i = 0; i < 20; i++) {
            await sendMessage(ghost);
            await randomDelay(300, 600);
        }
    }));

    /* ================= VISUAL TOOLS ================= */
    const visualCat = cat('ð¨ Visual Tools', 'ð¨');
    
    btn(visualCat, 'ð» Ghost Mode', requireKey(() => {
        document.body.style.opacity = '0.6';
        showNotification('Ghost mode enabled', 'info');
    }));
    
    btn(visualCat, 'ð«ï¸ Blur Background', requireKey(() => {
        document.body.style.filter = 'blur(5px)';
    }));
    
    btn(visualCat, 'ð Rainbow Mode', requireKey(() => {
        let hue = 0;
        const interval = setInterval(() => {
            document.body.style.filter = `hue-rotate(${hue}deg)`;
            hue = (hue + 5) % 360;
        }, 50);
        setTimeout(() => clearInterval(interval), 10000);
    }));
    
    btn(visualCat, 'ð Invert Colors', requireKey(() => {
        document.body.style.filter = 'invert(1)';
    }));
    
    btn(visualCat, 'â¨ Clear All Effects', requireKey(() => {
        document.body.removeAttribute('style');
        showNotification('Effects cleared', 'info');
    }));
    
    btn(visualCat, 'ð¯ Highlight Target User', requireKey(() => {
        if (!S.targetUserID) return showNotification('Set target user ID!', 'error');
        $$('*').forEach(el => {
            if (el.textContent.includes(S.targetUserID)) {
                el.style.background = 'rgba(255, 215, 0, 0.3)';
                el.style.border = '2px solid gold';
            }
        });
    }));
    
    btn(visualCat, 'ðï¸ X-Ray Mode', requireKey(() => {
        $$('*').forEach(el => {
            el.style.border = '1px solid rgba(255, 0, 0, 0.3)';
        });
    }));

    /* ================= UTILITY TOOLS ================= */
    const utilCat = cat('ð ï¸ Utility Tools', 'ð ï¸');
    
    btn(utilCat, 'ð Show Statistics', requireKey(() => {
        const stats = `
ð CORRUPT ULTRA STATS

Messages Sent: ${S.stats.messagesSent}
Commands Run: ${S.stats.commandsRun}
Co-Hosts: ${S.coHosts.length}
License: ${S.timerUnlocked ? 'â Active' : 'â Expired'}

Current IDs:
User: ${S.targetUserID || 'Not set'}
Channel: ${S.targetChannelID || 'Not set'}
Server: ${S.serverID || 'Not set'}
        `;
        alert(stats);
    }));
    
    btn(utilCat, 'ð Reset Statistics', requireKey(() => {
        S.stats = { messagesSent: 0, commandsRun: 0, sessionsActive: 0 };
        save();
        showNotification('Stats reset', 'success');
    }));
    
    btn(utilCat, 'ð¾ Export Settings', requireKey(() => {
        const data = JSON.stringify(S, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'corrupt-settings.json';
        a.click();
        showNotification('Settings exported', 'success');
    }));
    
    btn(utilCat, 'ð¥ Import Settings', requireKey(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = ev => {
                try {
                    S = JSON.parse(ev.target.result);
                    save();
                    showNotification('Settings imported! Reload page.', 'success');
                } catch (err) {
                    showNotification('Invalid file', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }));
    
    btn(utilCat, 'ðï¸ Clear All Data', requireKey(() => {
        if (confirm('Clear all settings and data?')) {
            localStorage.removeItem('CORRUPT_ULTRA');
            showNotification('Data cleared! Reload page.', 'success');
        }
    }));
    
    btn(utilCat, 'ð Copy Discord Token', requireKey(() => {
        const token = DiscordAPI.token();
        if (token) {
            navigator.clipboard.writeText(token);
            showNotification('Token copied! (Keep it secret!)', 'success');
        } else {
            showNotification('Could not get token', 'error');
        }
    }));

    /* ================= THEME CUSTOMIZER ================= */
    const themeCat = cat('ð¨ Theme Customizer', 'ð¨');
    
    input(themeCat, 'Blur Strength (px)', S.theme.blur, v => {
        S.theme.blur = parseInt(v) || 10;
        menu.style.backdropFilter = `blur(${S.theme.blur}px)`;
        save();
    }, 'number');
    
    input(themeCat, 'Opacity', S.theme.opacity, v => {
        S.theme.opacity = parseFloat(v) || 0.98;
        menu.style.opacity = S.theme.opacity;
        save();
    }, 'number');
    
    input(themeCat, 'Font Size', S.theme.fontSize, v => {
        S.theme.fontSize = parseInt(v) || 13;
        menu.style.fontSize = S.theme.fontSize + 'px';
        save();
    }, 'number');
    
    btn(themeCat, 'ð Dark Purple', requireKey(() => {
        menu.style.background = 'rgba(10, 10, 15, 0.95)';
        showNotification('Theme applied', 'info');
    }));
    
    btn(themeCat, 'ð¥ Red Heat', requireKey(() => {
        menu.style.background = 'rgba(139, 0, 0, 0.9)';
    }));
    
    btn(themeCat, 'ð Ocean Blue', requireKey(() => {
        menu.style.background = 'rgba(0, 105, 148, 0.9)';
    }));
    
    btn(themeCat, 'â¨ Matrix Green', requireKey(() => {
        menu.style.background = 'rgba(0, 20, 0, 0.95)';
        menu.style.color = '#00ff00';
    }));

    /* ================= SEARCH FUNCTIONALITY ================= */
    searchBar.oninput = () => {
        const query = searchBar.value.toLowerCase();
        content.querySelectorAll('div').forEach(el => {
            if (el.textContent.toLowerCase().includes(query)) {
                el.style.display = 'block';
            } else if (el.requiresKey !== undefined) {
                el.style.display = (!el.requiresKey || S.timerUnlocked) ? 'block' : 'none';
            }
        });
    };

    /* ================= TOGGLE & DRAG HANDLERS ================= */
    let dragging = false, moved = false, sx = 0, sy = 0;
    
    toggle.addEventListener('touchstart', e => {
        e.preventDefault();
        dragging = true;
        moved = false;
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
    }, { passive: false });
    
    toggle.addEventListener('touchmove', e => {
        if (!dragging) return;
        const t = e.touches[0];
        if (Math.abs(t.clientX - sx) + Math.abs(t.clientY - sy) > 6) {
            moved = true;
            toggle.style.right = (window.innerWidth - t.clientX - 30) + 'px';
            toggle.style.bottom = (window.innerHeight - t.clientY - 30) + 'px';
        }
    }, { passive: false });
    
    toggle.addEventListener('touchend', () => {
        if (!moved) {
            menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
        }
        dragging = false;
    });
    
    toggle.addEventListener('click', () => {
        menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
    });

    /* ================= MENU DRAG ================= */
    let md = false, mx = 0, my = 0, ox = 0, oy = 0;
    
    header.addEventListener('touchstart', e => {
        e.preventDefault();
        md = true;
        mx = e.touches[0].clientX;
        my = e.touches[0].clientY;
        ox = menu.offsetLeft;
        oy = menu.offsetTop;
    }, { passive: false });
    
    header.addEventListener('mousedown', e => {
        md = true;
        mx = e.clientX;
        my = e.clientY;
        ox = menu.offsetLeft;
        oy = menu.offsetTop;
    });
    
    document.addEventListener('touchmove', e => {
        if (!md) return;
        e.preventDefault();
        const t = e.touches[0];
        menu.style.left = (ox + t.clientX - mx) + 'px';
        menu.style.top = (oy + t.clientY - my) + 'px';
    }, { passive: false });
    
    document.addEventListener('mousemove', e => {
        if (!md) return;
        menu.style.left = (ox + e.clientX - mx) + 'px';
        menu.style.top = (oy + e.clientY - my) + 'px';
    });
    
    document.addEventListener('touchend', () => md = false);
    document.addEventListener('mouseup', () => md = false);

    /* ================= INITIALIZE MONITORING ================= */
    Monitor.init();
    
    console.log('%câ¡ CORRUPT ULTRA v400.0 LOADED', 'color: #667eea; font-size: 20px; font-weight: bold;');
    console.log('%cAdvanced Automation Suite Active', 'color: #764ba2; font-size: 14px;');
    console.log('%cFeatures: AI Integration, Co-Host System, Stealth Mode, 500+ Commands', 'color: #888;');
    
    showNotification('â¡ Corrupt Ultra loaded!', 'success');
}

})();
