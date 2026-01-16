// ==UserScript==
// @name         Discord Panel v6.0 (REG)
// @namespace    tampermonkey.net
// @version      6.0.1
// @description  Discord Control Menu by @ogunworthy
// @match        *https://discord.com/*
// @run-at       document-end
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function(){
'use strict';
  
  
  

/* ================= CORE ================= */
const $ = q=>document.querySelector(q);
const $$ = q=>[...document.querySelectorAll(q)];
const sleep = ms=>new Promise(r=>setTimeout(r,ms));
const Z = 2147483647;
const store = {
    get:(k,d)=>{try{return JSON.parse(GM_getValue(k,JSON.stringify(d)))}catch{return d}},
    set:(k,v)=>GM_setValue(k,JSON.stringify(v))
};

/* ================= WAIT FOR DISCORD ================= */
const wait = setInterval(()=>{
    if($('#app-mount')){ clearInterval(wait); setTimeout(init,500); }
},300);
/* ================= INIT ================= */
function init(){
  lockAllFeatures()

/* ---------- STATE ---------- */
let S = store.get('GM13_PRO',{
    menu:{x:20,y:60},
    btn:{x:20,y:120},
    spam:false,
    spamText:'Hello',
    spamDelay:1200,
    theme:{bg:'rgba(10,10,15,.98)',accent:'#5865f2'},
    collapsed:{},
    favorites:[],
    timerUnlocked:false,
    userKey:null,
    customText:'',
    customChannel:'',
    customToken:'',
    cohostMode:false,
    cohostUser:'',
    cohostPrefix:'!'
});
const save=()=>store.set('GM13_PRO',S);

/* ---------- LICENSE MONITORING ---------- */
let licenseCheckInterval = null;
let licenseExpiry = null;
let currentChannel = null;
let channelMonitor = null;
let timeLeftDisplay = null;
   
  
async function checkLicense(){
    if(!S.userKey) return {active:false, timeLeft:null, secondsRemaining:null};
    
    return new Promise(resolve => {
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://timercheck.io/${S.userKey}`,
            onload: res => {
                try {
                    const data = JSON.parse(res.responseText);
                    
                    // Check if timer timed out
                    const timedOut = data.errorMessage && data.errorMessage.toLowerCase().includes('timer timed out');
                    
                    // Check if active
                    const active = data.status === "ok" && data.message === "Timer still running";
                    
                    // Check if no plan exists (purchase plan message)
                    const noPlan = data.errorMessage && !timedOut;
                    
                    let timeLeft = null;
                    let secondsRemaining = null;
                    
                    if(active && data.seconds_remaining){
                        secondsRemaining = Math.floor(data.seconds_remaining);
                        
                        // Convert to human-readable format
                        const days = Math.floor(secondsRemaining / 86400);
                        const hours = Math.floor((secondsRemaining % 86400) / 3600);
                        const minutes = Math.floor((secondsRemaining % 3600) / 60);
                        const seconds = secondsRemaining % 60;
                        
                        if(days > 0){
                            timeLeft = `${days} day${days !== 1 ? 's' : ''}`;
                        } else if(hours > 0){
                            timeLeft = `${hours} hour${hours !== 1 ? 's' : ''}`;
                        } else if(minutes > 0){
                            timeLeft = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
                        } else {
                            timeLeft = `${seconds} second${seconds !== 1 ? 's' : ''}`;
                        }
                    }
                    
                    if(timedOut || !active){
                        if(S.timerUnlocked){
                            S.timerUnlocked = false;
                            save();
                            lockAllFeatures();
                            
                            if(timedOut){
                                showNotif('License Expired', '#e74c3c');
                            } else if(noPlan){
                                showNotif('No Active Plan - Purchase Required', '#e74c3c');
                            }
                        }
                    }
                    
                    resolve({active, timeLeft, secondsRemaining, timedOut, noPlan});
                } catch(e) {
                    // If JSON parsing fails, resolve as inactive
                    resolve({active:false, timeLeft:null, secondsRemaining:null, timedOut:false, noPlan:false});
                }
            },
            onerror: () => resolve({active:false, timeLeft:null, secondsRemaining:null, timedOut:false, noPlan:false})
        });
    });
}


function startLicenseMonitoring(){
    if(licenseCheckInterval) clearInterval(licenseCheckInterval);
    licenseCheckInterval = setInterval(async()=>{
        const result = await checkLicense();
        if(timeLeftDisplay && result.timeLeft){
            timeLeftDisplay.textContent = `Â° Time Left: ${result.timeLeft}`;
        }else if(timeLeftDisplay && result.timedOut){
            timeLeftDisplay.textContent = 'Ã¢ÂÂ° Time Left: Expired';
            timeLeftDisplay.style.background='rgba(231,76,60,.2)';
            timeLeftDisplay.style.borderColor='#e74c3c';
        }
    }, 900); // Check every near 1s
}

function lockAllFeatures(){
    document.querySelectorAll('.gm13-btn').forEach(b=>{
        if(!b.classList.contains('gm13-always-unlocked')){
            b.style.opacity='0.3';
            b.style.pointerEvents='none';
        }
    });
}

function unlockAllFeatures(){
    document.querySelectorAll('.gm13-btn').forEach(b=>{
        b.style.opacity='1';
        b.style.pointerEvents='auto';
    });
}


/* ---------- DISCORD API HELPERS ---------- */
function getToken(){
    // Use custom token if provided, otherwise get from Discord
    if(S.customToken && S.customToken.trim()) return S.customToken.trim();
    
    try{
        return (webpackChunkdiscord_app.push([[''],{},e=>{m=[];for(let c in e.c)m.push(e.c[c])}]),m).find(m=>m?.exports?.default?.getToken!==void 0).exports.default.getToken();
    }catch{
        try{
            return document.body.appendChild(Object.assign(document.createElement('iframe'),{style:'display:none'})).contentWindow.localStorage.token.replace(/"/g,'');
        }catch{
            console.error('Failed to retrieve token');
            return null;
        }
    }
}
  

function getCurrentChannelId(){
    const url = window.location.href;
    const match = url.match(/channels\/\d+\/(\d+)/);
    return match ? match[1] : null;
}

function startChannelMonitoring(){
    if(channelMonitor) return;
    channelMonitor = setInterval(()=>{
        const newChannel = getCurrentChannelId();
        if(newChannel !== currentChannel){
            currentChannel = newChannel;
            const input = document.getElementById('gm13-channel-input');
            if(input && !S.customChannel){
                input.placeholder = `Auto: ${currentChannel || 'None'}`;
            }
        }
    },1000);
}

async function apiRequest(method,endpoint,body=null){
    const token = getToken();
    if(!token){
        showNotif('Ã¢ÂÂ Token not found','#e74c3c');
        return null;
    }
    
    const opts = {
        method,
        headers:{
            'Authorization':token,
            'Content-Type':'application/json'
        }
    };
    if(body) opts.body = JSON.stringify(body);
    
    try{
        const res = await fetch(`https://discord.com/api/v9${endpoint}`,opts);
        
        // Handle rate limiting
        if(res.status === 429){
            const data = await res.json();
            const retryAfter = data.retry_after || 1;
            showNotif(` Rate limited, wait ${retryAfter}s`, '#f1c40f');
            return null;
        }
        
        return res.ok ? await res.json().catch(()=>({})) : null;
    }catch(e){
        console.error('API Error:',e);
        return null;
    }
}

function getTargetChannel(){
    return S.customChannel || currentChannel || getCurrentChannelId();
}

async function sendMsg(content){
    const ch = getTargetChannel();
    if(!ch){ showNotif(' No channel','#e74c3c'); return; }
    return apiRequest('POST',`/channels/${ch}/messages`,{content});
}

async function deleteMsg(channelId,msgId){
    return apiRequest('DELETE',`/channels/${channelId}/messages/${msgId}`);
}

async function editMsg(channelId,msgId,content){
    return apiRequest('PATCH',`/channels/${channelId}/messages/${msgId}`,{content});
}

async function addReaction(channelId,msgId,emoji){
    return apiRequest('PUT',`/channels/${channelId}/messages/${msgId}/reactions/${encodeURIComponent(emoji)}/@me`);
}

async function startTyping(channelId){
    return apiRequest('POST',`/channels/${channelId}/typing`);
}

async function pinMsg(channelId,msgId){
    return apiRequest('PUT',`/channels/${channelId}/pins/${msgId}`);
}

async function getChannelMsgs(channelId,limit=50){
    return apiRequest('GET',`/channels/${channelId}/messages?limit=${limit}`);
}

async function bulkDeleteMsgs(channelId,msgIds){
    return apiRequest('POST',`/channels/${channelId}/messages/bulk-delete`,{messages:msgIds});
}

/* ---------- NOTIFICATION SYSTEM ---------- */
function showNotif(text,color='#43b581'){
    const n=document.createElement('div');
    n.textContent=text;
    Object.assign(n.style,{
        position:'fixed',top:'20px',right:'20px',background:color,color:'#fff',
        padding:'12px 20px',borderRadius:'8px',zIndex:Z+1000,
        fontSize:'14px',fontWeight:'bold',boxShadow:'0 4px 12px rgba(0,0,0,0.4)',
        animation:'slideIn 0.3s ease'
    });
    document.body.appendChild(n);
    setTimeout(()=>{
        n.style.animation='slideOut 0.3s ease';
        setTimeout(()=>n.remove(),300);
    },3000);
}

/* ---------- UI HELPERS ---------- */
function cat(title){
    const wrap=document.createElement('div');
    const head=document.createElement('div');
    const body=document.createElement('div');

    head.innerHTML = `<span style="margin-right:8px">${S.collapsed[title]?'Ã¢ÂÂ¶':'Ã¢ÂÂ¼'}</span>${title}`;
    Object.assign(head.style,{
        padding:'12px 16px',fontWeight:'600',cursor:'pointer',userSelect:'none',
        background:'linear-gradient(135deg,rgba(88,101,242,.15),rgba(118,75,162,.15))',
        borderBottom:'1px solid rgba(255,255,255,.1)',fontSize:'15px',
        transition:'all 0.2s ease'
    });

    body.style.display = S.collapsed[title]?'none':'block';
    head.onclick = ()=>{
        body.style.display = body.style.display==='none'?'block':'none';
        S.collapsed[title] = body.style.display==='none';
        save();
        head.innerHTML = `<span style="margin-right:8px">${body.style.display==='none'?'Ã¢ÂÂ¶':'Ã¢ÂÂ¼'}</span>${title}`;
    };

    head.addEventListener('mouseenter',()=>head.style.background='linear-gradient(135deg,rgba(88,101,242,.25),rgba(118,75,162,.25))');
    head.addEventListener('mouseleave',()=>head.style.background='linear-gradient(135deg,rgba(88,101,242,.15),rgba(118,75,162,.15))');

    wrap.append(head,body);
    menu.appendChild(wrap);
    return body;
}

function btn(container,text,fn,emoji=''){
    const b=document.createElement('button');
    b.className='gm13-btn';
    b.innerHTML=emoji?`${emoji} ${text}`:text;
    Object.assign(b.style,{
        margin:'6px 12px',padding:'12px 16px',borderRadius:'10px',
        background:'linear-gradient(135deg,#667eea,#764ba2)',
        border:'none',color:'#fff',cursor:'pointer',userSelect:'none',
        fontSize:'13px',fontWeight:'600',transition:'all 0.3s ease',
        boxShadow:'0 2px 8px rgba(0,0,0,0.3)',width:'calc(100% - 24px)'
    });
    b.onclick=fn;
    
    b.addEventListener('mouseenter',()=>{
        b.style.transform='translateY(-2px)';
        b.style.boxShadow='0 4px 12px rgba(102,126,234,0.5)';
    });
    b.addEventListener('mouseleave',()=>{
        b.style.transform='translateY(0)';
        b.style.boxShadow='0 2px 8px rgba(0,0,0,0.3)';
    });
    
    container.appendChild(b);
    return b;
}

function input(container,label,value,fn,placeholder=''){
    const wrap=document.createElement('div');
    wrap.style.padding='0 12px';
    
    const l=document.createElement('div');
    l.textContent=label;
    l.style.cssText='font-size:12px;margin-bottom:4px;opacity:0.8;font-weight:500';
    
    const i=document.createElement('input');
    i.value=value;
    i.placeholder=placeholder;
    Object.assign(i.style,{
        width:'100%',padding:'10px',borderRadius:'8px',
        border:'2px solid rgba(88,101,242,.3)',
        background:'rgba(0,0,0,.3)',color:'#fff',
        fontSize:'13px',boxSizing:'border-box',
        transition:'border 0.2s ease'
    });
    i.onfocus=()=>i.style.borderColor='#5865f2';
    i.onblur=()=>i.style.borderColor='rgba(88,101,242,.3)';
    i.oninput=()=>fn(i.value);
    
    wrap.append(l,i);
    container.appendChild(wrap);
    return i;
}

/* ---------- STYLING ---------- */
const style=document.createElement('style');
style.textContent=`
@keyframes slideIn{from{transform:translateX(400px);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes slideOut{from{transform:translateX(0);opacity:1}to{transform:translateX(400px);opacity:0}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
*{scrollbar-width:thin;scrollbar-color:rgba(88,101,242,.5) rgba(0,0,0,.2)}
*::-webkit-scrollbar{width:8px}
*::-webkit-scrollbar-track{background:rgba(0,0,0,.2)}
*::-webkit-scrollbar-thumb{background:rgba(88,101,242,.5);border-radius:4px}
*::-webkit-scrollbar-thumb:hover{background:rgba(88,101,242,.7)}
`;
document.head.appendChild(style);



/* ---------- TOGGLE BUTTON ---------- */
const toggle=document.createElement('div');
toggle.innerHTML='â ';
Object.assign(toggle.style,{
    position:'fixed',right:S.btn.x+'px',bottom:S.btn.y+'px',
    width:'65px',height:'65px',borderRadius:'50%',
    background:'linear-gradient(135deg,#667eea,#764ba2)',
    color:'#fff',fontSize:'32px',display:'flex',
    alignItems:'center',justifyContent:'center',
    zIndex:Z,cursor:'grab',userSelect:'none',
    boxShadow:'0 8px 24px rgba(102,126,234,0.4)',
    transition:'all 0.3s ease'
});
toggle.addEventListener('mouseenter',()=>{
    toggle.style.transform='scale(1.1) rotate(90deg)';
    toggle.style.boxShadow='0 12px 32px rgba(102,126,234,0.6)';
});
toggle.addEventListener('mouseleave',()=>{
    toggle.style.transform='scale(1) rotate(0deg)';
    toggle.style.boxShadow='0 8px 24px rgba(102,126,234,0.4)';
});
document.body.appendChild(toggle);

/* ---------- MENU ---------- */
const menu=document.createElement('div');
Object.assign(menu.style,{
    position:'fixed',top:S.menu.y+'px',left:S.menu.x+'px',
    width:'min(95vw,450px)',maxHeight:'calc(100vh - 60vh)',
    background:S.theme.bg,color:'#fff',borderRadius:'16px',
    display:'none',flexDirection:'column',overflowY:'auto',
    zIndex:Z-1,fontSize:'14px',
    border:'1px solid rgba(88,101,242,.3)',
    boxShadow:'0 20px 60px rgba(0,0,0,0.6)'
});
document.body.appendChild(menu);

/* ---------- HEADER ---------- */
const header=document.createElement('div');
header.innerHTML='<div style="font-size:18px;font-weight:700;margin-bottom:4px">â Corrupt Control</div><div style="font-size:11px;opacity:0.7">v6.0.1 PRO Edition</div><button id="gm13-close-btn" style="position:absolute;top:12px;right:12px;background:#e74c3c;border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:18px;font-weight:bold">ÃÂÃÂ</button>';
Object.assign(header.style,{
    padding:'16px',textAlign:'center',cursor:'grab',position:'relative',
    background:'linear-gradient(135deg,rgba(102,126,234,.2),rgba(118,75,162,.2))',
    userSelect:'none',borderBottom:'1px solid rgba(255,255,255,.1)'
});
menu.appendChild(header);

// Close button functionality
document.getElementById('gm13-close-btn').addEventListener('click',(e)=>{
    e.stopPropagation();
    menu.style.display='none';
});
  
/* ---------- SEARCH ---------- */
const searchInput=document.createElement('input');
searchInput.placeholder=' Search commands...';
Object.assign(searchInput.style,{
    margin:'12px',padding:'10px 12px',borderRadius:'8px',
    border:'2px solid rgba(88,101,242,.3)',
    background:'rgba(0,0,0,.3)',color:'#fff',fontSize:'13px'
});
menu.appendChild(searchInput);

/* ---------- LICENSE SECTION ---------- */
const licenseCat = cat('ð License Management');
input(licenseCat,'License Key',S.userKey||'',v=>{S.userKey=v;save();},'Enter your key');

const statusDiv=document.createElement('div');
statusDiv.id='license-status';
statusDiv.textContent='Status: Not Verified';
statusDiv.style.cssText='margin:12px;padding:12px;background:rgba(231,76,60,.2);border-left:4px solid #e74c3c;border-radius:6px;font-size:13px;font-weight:600';
licenseCat.appendChild(statusDiv);

// Time left display
timeLeftDisplay=document.createElement('div');
timeLeftDisplay.textContent= 'Time Left: Unknown';
timeLeftDisplay.style.cssText='margin:12px;padding:10px;background:rgba(241,196,15,.2);border-left:4px solid #f1c40f;border-radius:6px;font-size:12px;font-weight:600';
licenseCat.appendChild(timeLeftDisplay);

const verifyBtn = btn(licenseCat,'ð Login',async ()=>{
    if(!S.userKey){ showNotif('Enter key first','#e74c3c'); return; }
    
    verifyBtn.textContent='Verifying...';
    verifyBtn.style.opacity='0.6';
    statusDiv.textContent='Verifying...';
    statusDiv.style.background='rgba(241,196,15,.2)';
    statusDiv.style.borderColor='#f1c40f';
    timeLeftDisplay.textContent='Time Left: Checking...';
    
    const result = await checkLicense();
    
    if(result.active && !result.timedOut){
        S.timerUnlocked=true;
        save();
        unlockAllFeatures();
        startLicenseMonitoring();
        
        statusDiv.textContent=' Active & Monitored';
        statusDiv.style.background='rgba(67,181,129,.2)';
        statusDiv.style.borderColor='#43b581';
        
        if(result.timeLeft){
            timeLeftDisplay.textContent=` Time Left: ${result.timeLeft}`;
            timeLeftDisplay.style.background='rgba(67,181,129,.2)';
            timeLeftDisplay.style.borderColor='#43b581';
        }else{
            timeLeftDisplay.textContent='Time Left: Active';
            timeLeftDisplay.style.background='rgba(67,181,129,.2)';
            timeLeftDisplay.style.borderColor='#43b581';
        }
        
        showNotif(' License Active!','#43b581');
        verifyBtn.textContent='Verified';
    }else{
        S.timerUnlocked=false;
        save();
        lockAllFeatures();
        
        statusDiv.textContent=result.timedOut?'License Expired':' Invalid Key';
        statusDiv.style.background='rgba(231,76,60,.2)';
        statusDiv.style.borderColor='#e74c3c';
        
        timeLeftDisplay.textContent=' Time Left: Expired';
        timeLeftDisplay.style.background='rgba(231,76,60,.2)';
        timeLeftDisplay.style.borderColor='#e74c3c';
        
        showNotif(result.timedOut?'License Expired':' Verification Failed','#e74c3c');
        verifyBtn.textContent= 'Login';
    }
    verifyBtn.style.opacity='1';
},'â');

// Mark verify button as always unlocked
verifyBtn.classList.add('gm13-always-unlocked');


/* ---------- REQUIRE KEY WRAPPER ---------- */
function requireKey(fn){
    return ()=>{
        if(!S.timerUnlocked){
            showNotif('Verify license first!','#e74c3c');
            return;
        }
        fn();
    };
}


/* ---------- CHANNEL & TEXT CONFIG ---------- */ 
  
// ============================================
// ENHANCED DISCORD USERSCRIPT MENU
// ============================================

// Configuration Category
const configCat = cat('âï¸ Configuration');
input(configCat, 'Custom Message', S.customText, v => {S.customText = v; save();}, 'Type your message');
const channelInput = input(configCat, 'Channel ID (optional)', S.customChannel, v => {S.customChannel = v; save();}, 'Auto-detect current');
channelInput.id = 'gm13-channel-input';
const tokenInput = input(configCat, 'Custom Token (optional)', S.customToken || '', v => {S.customToken = v; save();}, 'Leave empty for auto');

input(configCat, 'Repeat Count', S.repeatCount || '1', v => {S.repeatCount = parseInt(v) || 1; save();}, 'Number of times to repeat');
input(configCat, 'Delay Between (ms)', S.delayBetween || '1000', v => {S.delayBetween = parseInt(v) || 1000; save();}, 'Milliseconds between actions');


  
  
// Countdown Category
const countdownCat = cat('â³ Countdown Tools');



btn(countdownCat, 'ð¯ Edit Countdown', async() => {
    const seconds = parseInt(prompt('Countdown from (seconds):', '10'));
    if (isNaN(seconds) || seconds < 1) return;
    
    const channelId = S.customChannel || getCurrentChannelId();
    const msg = await sendMsg(channelId, `â±ï¸ ${seconds}...`);
    
    showNotif(`â±ï¸ Starting ${seconds}s countdown (editing)...`, '#f1c40f');
    
    for (let i = seconds - 1; i > 0; i--) {
        await sleep(1000);
        await editMsg(channelId, msg.id, `â±ï¸ ${i}...`);
    }
    
    await sleep(1000);
    await editMsg(channelId, msg.id, 'ð GO!');
    showNotif('â Countdown complete!', '#57f287');
}, 'ð¯');



btn(countdownCat, 'ðª Fancy Countdown', async() => {
    const seconds = parseInt(prompt('Countdown from (seconds):', '10'));
    if (isNaN(seconds) || seconds < 1) return;
    
    const channelId = S.customChannel || getCurrentChannelId();
    const emojis = ['ð', '9ï¸â£', '8ï¸â£', '7ï¸â£', '6ï¸â£', '5ï¸â£', '4ï¸â£', '3ï¸â£', '2ï¸â£', '1ï¸â£'];
    const msg = await sendMsg(channelId, `${emojis[0]} **${seconds}**`);
    
    for (let i = seconds - 1; i > 0; i--) {
        await sleep(1000);
        const emoji = i <= 10 ? emojis[10 - i] : 'â±ï¸';
        await editMsg(channelId, msg.id, `${emoji} **${i}**`);
    }
    
    await sleep(1000);
    await editMsg(channelId, msg.id, 'ðð¥ **BLAST OFF!** ðâ¨');
    showNotif('â Fancy countdown complete!', '#57f287');
}, 'ðª');



    
// Background/Theme Category
const theme2Cat = cat('ð¨ Background & Theme');

btn(theme2Cat, 'ð Dark Mode Toggle', () => {
    document.body.classList.toggle('theme-dark');
    document.body.classList.toggle('theme-light');
    showNotif('ð Theme toggled!', '#5865f2');
}, 'ð');

btn(theme2Cat, 'ð¨ Custom BG Color', () => {
    const color = prompt('Enter hex color (without #):', '2c2f33');
    document.documentElement.style.setProperty('--background-primary', `#${color}`);
    showNotif('ð¨ Background color changed!', '#57f287');
}, 'ð¨');

btn(theme2Cat, 'ð Rainbow Background', async() => {
    const duration = parseInt(prompt('Duration (seconds):', '10'));
    const colors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'];
    
    const end = Date.now() + (duration * 1000);
    let idx = 0;
    
    while (Date.now() < end) {
        document.documentElement.style.setProperty('--background-primary', colors[idx % colors.length]);
        idx++;
        await sleep(500);
    }
    
    showNotif('ð Rainbow background ended!', '#57f287');
}, 'ð');

btn(theme2Cat, 'â¨ Matrix Effect', async() => {
    const duration = parseInt(prompt('Duration (seconds):', '10'));
    
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;pointer-events:none;';
    document.body.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()';
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops = Array(Math.floor(columns)).fill(1);
    
    const end = Date.now() + (duration * 1000);
    
    const draw = () => {
        if (Date.now() >= end) {
            canvas.remove();
            return;
        }
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#0f0';
        ctx.font = fontSize + 'px monospace';
        
        for (let i = 0; i < drops.length; i++) {
            const text = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);
            
            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
        
        requestAnimationFrame(draw);
    };
    
    draw();
    showNotif('â¨ Matrix effect started!', '#57f287');
}, 'â¨');

btn(theme2Cat, 'ð Fireworks Effect', async() => {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes firework {
            0% { transform: translate(0, 0); opacity: 1; }
            100% { transform: translate(var(--x), var(--y)); opacity: 0; }
        }
        .firework { position: fixed; width: 5px; height: 5px; border-radius: 50%; z-index: 9999; }
    `;
    document.head.appendChild(style);
    
    for (let i = 0; i < 20; i++) {
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight / 2;
        
        for (let j = 0; j < 30; j++) {
            const particle = document.createElement('div');
            particle.className = 'firework';
            particle.style.left = x + 'px';
            particle.style.top = y + 'px';
            particle.style.background = `hsl(${Math.random() * 360}, 100%, 50%)`;
            particle.style.setProperty('--x', (Math.random() - 0.5) * 200 + 'px');
            particle.style.setProperty('--y', (Math.random() - 0.5) * 200 + 'px');
            particle.style.animation = 'firework 1s ease-out forwards';
            
            document.body.appendChild(particle);
            
            setTimeout(() => particle.remove(), 1000);
        }
        
        await sleep(200);
    }
    
    style.remove();
    showNotif('ð Fireworks complete!', '#57f287');
}, 'ð');
  
  
 /* ==================== OP SYSTEM & ADMIN COMMANDS ==================== */

/* ---------- ð® FUN & GAMES ---------- */
const gamesCat = cat('ð® Fun & Games');

btn(gamesCat,'ð° Mega Slots',requireKey(async()=>{
    const symbols = ['ð','ð','ð','ð','â­','ð','7ï¸â£','ð','ð°'];
    
    await sendMsg('ð° **SPINNING...**');
    await sleep(1000);
    
    const s1 = symbols[Math.floor(Math.random()*symbols.length)];
    const s2 = symbols[Math.floor(Math.random()*symbols.length)];
    const s3 = symbols[Math.floor(Math.random()*symbols.length)];
    
    await sendMsg(`ð° [ ${s1} | ${s2} | ${s3} ]`);
    
    if(s1===s2 && s2===s3){
        await sleep(500);
        await sendMsg('ð°ð°ð° **JACKPOT! MEGA WIN!** ð°ð°ð°');
    }else if(s1===s2 || s2===s3 || s1===s3){
        await sendMsg('ð **Two Match! Small Win!**');
    }else{
        await sendMsg('ð¢ No match... Try again!');
    }
}),'ð°');

btn(gamesCat,'ð² Advanced Dice',requireKey(async()=>{
    const dice = parseInt(prompt('Number of dice:','3'))||3;
    const sides = parseInt(prompt('Sides per die:','20'))||20;
    
    const rolls = Array(dice).fill(0).map(()=>Math.floor(Math.random()*sides)+1);
    const total = rolls.reduce((a,b)=>a+b,0);
    const max = dice*sides;
    
    let result = `ð² **Rolled ${dice}d${sides}**\n`;
    result += `ââââââââââââââââ\n`;
    result += `Rolls: [${rolls.join(', ')}]\n`;
    result += `**Total: ${total}** / ${max}\n`;
    
    if(total===max) result += 'ð **CRITICAL SUCCESS!**';
    else if(total===dice) result += 'ð **CRITICAL FAIL!**';
    else if(total>=max*0.8) result += 'â¨ **Excellent Roll!**';
    
    await sendMsg(result);
}),'ð²');

btn(gamesCat,'ð Blackjack',requireKey(async()=>{
    const drawCard = ()=>{
        const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
        const suits = ['â ï¸','â¥ï¸','â¦ï¸','â£ï¸'];
        return ranks[Math.floor(Math.random()*ranks.length)] + suits[Math.floor(Math.random()*suits.length)];
    };
    
    const getValue = (card)=>{
        const rank = card.slice(0,-2);
        if(rank==='A') return 11;
        if(['J','Q','K'].includes(rank)) return 10;
        return parseInt(rank);
    };
    
    const player = [drawCard(),drawCard()];
    const dealer = [drawCard()];
    
    const pTotal = player.reduce((sum,c)=>sum+getValue(c),0);
    const dTotal = getValue(dealer[0]);
    
    let msg = `ð **BLACKJACK**\nââââââââââââââââ\n`;
    msg += `Your hand: ${player.join(' ')} = **${pTotal}**\n`;
    msg += `Dealer shows: ${dealer[0]} = **${dTotal}**\n\n`;
    
    if(pTotal===21) msg += 'ð **BLACKJACK! YOU WIN!**';
    else if(pTotal>21) msg += 'ð¥ **BUST! You lose...**';
    else msg += 'â Hit or Stand?';
    
    await sendMsg(msg);
}),'ð');

btn(gamesCat,'ð¯ Target Practice',requireKey(async()=>{
    const target = Math.floor(Math.random()*10)+1;
    await sendMsg(`ð¯ **TARGET PRACTICE**\nHit the number **${target}**!\nRolling in 3...`);
    await sleep(1000);
    await sendMsg('2...');
    await sleep(1000);
    await sendMsg('1...');
    await sleep(1000);
    
    const shot = Math.floor(Math.random()*10)+1;
    const distance = Math.abs(target-shot);
    
    let result = `ð¯ **SHOT: ${shot}** | **TARGET: ${target}**\n`;
    
    if(shot===target){
        result += 'ð **BULLSEYE! PERFECT HIT!** ð¯';
    }else if(distance===1){
        result += 'ð® **SO CLOSE! Just 1 off!**';
    }else if(distance<=3){
        result += 'ð **Nice shot! Pretty close!**';
    }else{
        result += `ð¢ **Missed by ${distance}... Try again!**`;
    }
    
    await sendMsg(result);
}),'ð¯');

btn(gamesCat,'ðª Roulette',requireKey(async()=>{
    const colors = {red:[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36],black:[2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]};
    const bet = prompt('Bet on (number 0-36, red, black, even, odd):','red');
    if(!bet) return;
    
    await sendMsg('ðª **Spinning the wheel...**');
    await sleep(2000);
    
    const result = Math.floor(Math.random()*37);
    const isRed = colors.red.includes(result);
    const isBlack = colors.black.includes(result);
    const color = result===0?'ð¢':isRed?'ð´':'â«';
    
    let msg = `${color} **${result}** (${result===0?'Green':isRed?'Red':'Black'})`;
    msg += result%2===0?' | Even':' | Odd';
    msg += '\n\n';
    
    let won = false;
    if(bet.toLowerCase()==='red' && isRed) won=true;
    if(bet.toLowerCase()==='black' && isBlack) won=true;
    if(bet.toLowerCase()==='even' && result%2===0 && result!==0) won=true;
    if(bet.toLowerCase()==='odd' && result%2===1) won=true;
    if(bet===result.toString()) won=true;
    
    msg += won?'ð **YOU WIN!** ð°':'ð¢ **You lose... Better luck next time!**';
    
    await sendMsg(msg);
}),'ðª');

btn(gamesCat,'ð® RPS Battle',requireKey(async()=>{
    const choices = ['ðª¨ Rock','ð Paper','âï¸ Scissors'];
    const player = Math.floor(Math.random()*3);
    const bot = Math.floor(Math.random()*3);
    
    let result = `ð® **ROCK PAPER SCISSORS**\nââââââââââââââââ\n`;
    result += `You: ${choices[player]}\n`;
    result += `Bot: ${choices[bot]}\n\n`;
    
    if(player===bot){
        result += 'ð¤ **TIE! Go again!**';
    }else if(
        (player===0 && bot===2) ||
        (player===1 && bot===0) ||
        (player===2 && bot===1)
    ){
        result += 'ð **YOU WIN!** ð';
    }else{
        result += 'ð¢ **YOU LOSE!** Try again!';
    }
    
    await sendMsg(result);
}),'ð®');

btn(gamesCat,'ð² Yahtzee Roll',requireKey(async()=>{
    const dice = Array(5).fill(0).map(()=>Math.floor(Math.random()*6)+1);
    const sorted = [...dice].sort((a,b)=>a-b);
    
    // Check for patterns
    const counts = {};
    dice.forEach(d=>counts[d]=(counts[d]||0)+1);
    const values = Object.values(counts);
    
    let pattern = 'Nothing special';
    if(values.includes(5)) pattern = 'ð **YAHTZEE!** (5 of a kind)';
    else if(values.includes(4)) pattern = 'ð Four of a Kind!';
    else if(values.includes(3) && values.includes(2)) pattern = 'ð  Full House!';
    else if(values.includes(3)) pattern = '3ï¸â£ Three of a Kind!';
    else if(values.filter(v=>v===2).length===2) pattern = 'ð¥ Two Pairs!';
    else if(sorted.join('')==='12345' || sorted.join('')==='23456') pattern = 'ð Straight!';
    
    let msg = `ð² **YAHTZEE!**\nââââââââââââââââ\n`;
    msg += `Dice: ${dice.map(d=>`[${d}]`).join(' ')}\n`;
    msg += `Result: ${pattern}`;
    
    await sendMsg(msg);
}),'ð²');

/* ---------- ð¯ MENTION ALERT ---------- */
const alertCat = cat('ð Alert System');

btn(alertCat,'ð¯ Mention Alert',requireKey(()=>{
    const myId = JSON.parse(atob(getToken().split('.')[0])).id;
    
    const observer = new MutationObserver(async mutations=>{
        if(!S.timerUnlocked) return;
        
        for(const mutation of mutations){
            for(const node of mutation.addedNodes){
                if(node.nodeType !== 1) continue;
                
                const msgEl = node.querySelector?node.querySelector('[class*="messageContent"]'):null;
                if(!msgEl) continue;
                
                if(msgEl.textContent.includes(`<@${myId}>`)){
                    await sleep(500);
                    await sendMsg('ð **I was mentioned!** Checking message...');
                }
            }
        }
    });
    
    observer.observe(document.body,{childList:true,subtree:true});
    showNotif('ð¯ Mention alert ACTIVE','#43b581');
}),'ð¯');

btn(alertCat,'ð Keyword Watcher',requireKey(()=>{
    const keywords = prompt('Keywords to watch (comma-separated):','important,urgent,help').split(',').map(k=>k.trim().toLowerCase());
    if(!keywords[0]) return;
    
    const observer = new MutationObserver(async mutations=>{
        if(!S.timerUnlocked) return;
        
        for(const mutation of mutations){
            for(const node of mutation.addedNodes){
                if(node.nodeType !== 1) continue;
                
                const msgEl = node.querySelector?node.querySelector('[class*="messageContent"]'):null;
                if(!msgEl) continue;
                
                const content = msgEl.textContent.toLowerCase();
                const found = keywords.filter(k=>content.includes(k));
                
                if(found.length>0){
                    await sleep(300);
                    await sendMsg(`ð **Keyword detected:** ${found.join(', ')}`);
                }
            }
        }
    });
    
    observer.observe(document.body,{childList:true,subtree:true});
    showNotif(`ð Watching: ${keywords.join(', ')}`,'#43b581');
}),'ð');

btn(alertCat,'ð¨ Raid Detector',requireKey(()=>{
    let msgCache = [];
    const THRESHOLD = 10; // 10 messages in 5 seconds = raid
    
    const observer = new MutationObserver(async mutations=>{
        if(!S.timerUnlocked) return;
        
        for(const mutation of mutations){
            for(const node of mutation.addedNodes){
                if(node.nodeType !== 1) continue;
                
                const msgEl = node.querySelector?node.querySelector('[class*="messageContent"]'):null;
                if(msgEl){
                    const now = Date.now();
                    msgCache.push(now);
                    msgCache = msgCache.filter(t=>now-t<5000);
                    
                    if(msgCache.length>=THRESHOLD){
                        await sendMsg('ð¨ð¨ð¨ **RAID DETECTED!** High message rate! ð¨ð¨ð¨');
                        msgCache = [];
                    }
                }
            }
        }
    });
    
    observer.observe(document.body,{childList:true,subtree:true});
    showNotif('ð¨ Raid detector ACTIVE','#43b581');
}),'ð¨');

/* ---------- ð PLAYER UTILITIES ---------- */
const playerCat = cat('ð¤ Player Utilities');

btn(playerCat,'ð Deep User Scan',requireKey(async()=>{
    const userId = prompt('User ID to scan:');
    if(!userId) return;
    
    showNotif('ð Scanning user...','#f1c40f');
    
    const user = await apiRequest('GET',`/users/${userId}`);
    if(!user){
        showNotif('â User not found','#e74c3c');
        return;
    }
    
    const createdAt = new Date(parseInt(userId) / 4194304 + 1420070400000);
    const accountAge = Math.floor((Date.now()-createdAt)/86400000);
    
    let report = `ð **USER SCAN**\nââââââââââââââââ\n`;
    report += `**Username:** ${user.username}#${user.discriminator}\n`;
    report += `**ID:** ${user.id}\n`;
    report += `**Bot:** ${user.bot?'Yes ð¤':'No ð¤'}\n`;
    report += `**System:** ${user.system?'Yes':'No'}\n`;
    report += `**Created:** ${createdAt.toLocaleDateString()}\n`;
    report += `**Account Age:** ${accountAge} days\n`;
    report += `**Avatar:** ${user.avatar?'Custom':'Default'}\n`;
    report += `**Banner:** ${user.banner?'Yes':'No'}\n`;
    report += `**Accent Color:** ${user.accent_color?'#'+user.accent_color.toString(16):'None'}\n`;
    
    if(user.premium_type){
        const nitroType = user.premium_type===1?'Nitro Classic':user.premium_type===2?'Nitro':'Nitro Basic';
        report += `**Nitro:** ${nitroType} ð\n`;
    }
    
    await sendMsg(report);
}),'ð');

btn(playerCat,'ð User Activity Tracker',requireKey(async()=>{
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch,100);
    if(!msgs) return;
    
    const userId = prompt('User ID to track:');
    if(!userId) return;
    
    const userMsgs = msgs.filter(m=>m.author.id===userId);
    
    if(userMsgs.length===0){
        await sendMsg('â No messages from this user in last 100');
        return;
    }
    
    const totalChars = userMsgs.reduce((sum,m)=>sum+m.content.length,0);
    const avgLength = totalChars/userMsgs.length;
    const withAttach = userMsgs.filter(m=>m.attachments?.length>0).length;
    const edited = userMsgs.filter(m=>m.edited_timestamp).length;
    
    let report = `ð **ACTIVITY TRACKER**\nââââââââââââââââ\n`;
    report += `**User:** ${userMsgs[0].author.username}\n`;
    report += `**Messages:** ${userMsgs.length}/100\n`;
    report += `**Total chars:** ${totalChars}\n`;
    report += `**Avg length:** ${avgLength.toFixed(0)} chars\n`;
    report += `**With files:** ${withAttach}\n`;
    report += `**Edited:** ${edited}\n`;
    report += `**Activity:** ${((userMsgs.length/100)*100).toFixed(1)}%\n`;
    
    await sendMsg(report);
}),'ð');

btn(playerCat,'ð­ Avatar Stealer',requireKey(async()=>{
    const userId = prompt('User ID:');
    if(!userId) return;
    
    const user = await apiRequest('GET',`/users/${userId}`);
    if(!user || !user.avatar){
        showNotif('â No avatar found','#e74c3c');
        return;
    }
    
    const ext = user.avatar.startsWith('a_')?'gif':'png';
    const avatarUrl = `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.${ext}?size=1024`;
    
    await sendMsg(`ð­ **${user.username}'s Avatar**\n${avatarUrl}`);
}),'ð­');

btn(playerCat,'ð¥ Mutual Servers',requireKey(async()=>{
    const userId = prompt('User ID:');
    if(!userId) return;
    
    const profile = await apiRequest('GET',`/users/${userId}/profile`);
    if(!profile){
        await sendMsg('â Could not fetch profile');
        return;
    }
    
    const mutuals = profile.mutual_guilds||[];
    
    let msg = `ð¥ **MUTUAL SERVERS**\nââââââââââââââââ\n`;
    if(mutuals.length===0){
        msg += 'No mutual servers found';
    }else{
        msg += `Found ${mutuals.length} mutual server(s)\n\n`;
        mutuals.slice(0,10).forEach(g=>{
            msg += `â¢ ${g.nick||'No nickname'}\n`;
        });
    }
    
    await sendMsg(msg);
}),'ð¥');

btn(playerCat,'ð User Rank',requireKey(async()=>{
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch,100);
    if(!msgs) return;
    
    const users = new Map();
    msgs.forEach(m=>{
        users.set(m.author.id,{
            name:m.author.username,
            count:(users.get(m.author.id)?.count||0)+1
        });
    });
    
    const sorted = Array.from(users.entries()).sort((a,b)=>b[1].count-a[1].count);
    
    const userId = prompt('User ID to rank:');
    if(!userId) return;
    
    const rank = sorted.findIndex(([id])=>id===userId)+1;
    const userData = users.get(userId);
    
    if(!userData){
        await sendMsg('â User not found in last 100 messages');
        return;
    }
    
    const medal = rank===1?'ð¥':rank===2?'ð¥':rank===3?'ð¥':`#${rank}`;
    
    await sendMsg(`ð **${userData.name}** is ranked ${medal} with **${userData.count}** messages!`);
}),'ð');

/* ---------- ð SERVER MASTERY ---------- */
const serverCat = cat('ð Server Mastery');

btn(serverCat,'ð¡ Server Intelligence',requireKey(async()=>{
    const guildId = window.location.href.match(/channels\/(\d+)/)?.[1];
    if(!guildId) return;
    
    showNotif('ð¡ Scanning server...','#f1c40f');
    
    const [guild,channels,roles,emojis] = await Promise.all([
        apiRequest('GET',`/guilds/${guildId}`),
        apiRequest('GET',`/guilds/${guildId}/channels`),
        apiRequest('GET',`/guilds/${guildId}/roles`),
        apiRequest('GET',`/guilds/${guildId}/emojis`)
    ]);
    
    if(!guild) return;
    
    const textCh = channels?.filter(c=>c.type===0).length||0;
    const voiceCh = channels?.filter(c=>c.type===2).length||0;
    const threadCh = channels?.filter(c=>c.type===11).length||0;
    const createdAt = new Date(parseInt(guildId)/4194304+1420070400000);
    const age = Math.floor((Date.now()-createdAt)/86400000);
    
    let report = `ð¡ **SERVER INTELLIGENCE**\nââââââââââââââââ\n`;
    report += `**${guild.name}**\n`;
    report += `ID: \`${guild.id}\`\n`;
    report += `Owner: <@${guild.owner_id}>\n\n`;
    
    report += `**ð Stats:**\n`;
    report += `Members: ~${guild.approximate_member_count||'???'}\n`;
    report += `Online: ~${guild.approximate_presence_count||'???'}\n`;
    report += `Created: ${createdAt.toLocaleDateString()} (${age} days ago)\n`;
    report += `Verification: ${guild.verification_level}\n`;
    report += `Boost Tier: ${guild.premium_tier}â­\n`;
    report += `Boosts: ${guild.premium_subscription_count||0}ð\n\n`;
    
    report += `**ð Channels:**\n`;
    report += `ð¬ Text: ${textCh}\n`;
    report += `ð Voice: ${voiceCh}\n`;
    report += `ð§µ Threads: ${threadCh}\n`;
    report += `Total: ${channels?.length||0}\n\n`;
    
    report += `**ð­ Roles:** ${roles?.length||0}\n`;
    report += `**ð Emojis:** ${emojis?.length||0}\n`;
    report += `**ðª Features:** ${guild.features?.length||0}\n`;
    
    await sendMsg(report);
}),'ð¡');

btn(serverCat,'ð Permission Scanner',requireKey(async()=>{
    const guildId = window.location.href.match(/channels\/(\d+)/)?.[1];
    if(!guildId) return;
    
    const roles = await apiRequest('GET',`/guilds/${guildId}/roles`);
    if(!roles) return;
    
    const dangerous = roles.filter(r=>{
        const perms = r.permissions;
        return (perms & 0x8) || // ADMINISTRATOR
               (perms & 0x20) || // MANAGE_GUILD  
               (perms & 0x2) || // KICK_MEMBERS
               (perms & 0x4) || // BAN_MEMBERS
               (perms & 0x10000000); // MANAGE_ROLES
    });
    
    let report = `ð **PERMISSION SCAN**\nââââââââââââââââ\n`;
    report += `Dangerous roles: ${dangerous.length}/${roles.length}\n\n`;
    
    dangerous.slice(0,10).forEach(role=>{
        const perms = role.permissions;
        let flags = '';
        if(perms & 0x8) flags += 'ðAdmin ';
        if(perms & 0x2) flags += 'ð¦µKick ';
        if(perms & 0x4) flags += 'ð¨Ban ';
        if(perms & 0x20) flags += 'âï¸Manage ';
        
        report += `**${role.name}**\n${flags}\n\n`;
    });
    
    await sendMsg(report);
}),'ð');

btn(serverCat,'ð¢ Channel Network Map',requireKey(async()=>{
    const guildId = window.location.href.match(/channels\/(\d+)/)?.[1];
    if(!guildId) return;
    
    const channels = await apiRequest('GET',`/guilds/${guildId}/channels`);
    if(!channels) return;
    
    const categories = channels.filter(c=>c.type===4);
    
    let map = `ð¢ **CHANNEL NETWORK**\nââââââââââââââââ\n`;
    
    categories.slice(0,8).forEach(cat=>{
        map += `\nð **${cat.name}**\n`;
        const children = channels.filter(c=>c.parent_id===cat.id);
        children.slice(0,10).forEach(ch=>{
            const icon = ch.type===0?'ð¬':ch.type===2?'ð':ch.type===5?'ð£':'â';
            const nsfw = ch.nsfw?'ð':'';
            map += `  ${icon} ${ch.name} ${nsfw}\n`;
        });
    });
    
    const orphans = channels.filter(c=>!c.parent_id && c.type!==4);
    if(orphans.length>0){
        map += `\nð **Uncategorized:** ${orphans.length}\n`;
    }
    
    await sendMsg(map);
}),'ð¢');

btn(serverCat,'ð¨ Emoji Manager',requireKey(async()=>{
    const guildId = window.location.href.match(/channels\/(\d+)/)?.[1];
    if(!guildId) return;
    
    const emojis = await apiRequest('GET',`/guilds/${guildId}/emojis`);
    if(!emojis || emojis.length===0){
        await sendMsg('â No custom emojis');
        return;
    }
    
    const animated = emojis.filter(e=>e.animated);
    const static_ = emojis.filter(e=>!e.animated);
    
    let msg = `ð¨ **EMOJI MANAGER**\nââââââââââââââââ\n`;
    msg += `Total: ${emojis.length}\n`;
    msg += `Static: ${static_.length} | Animated: ${animated.length}\n\n`;
    
    msg += `**Recent Emojis:**\n`;
    emojis.slice(0,15).forEach(e=>{
        const tag = e.animated?'<a:':'<:';
        msg += `${tag}${e.name}:${e.id}> `;
    });
    
    await sendMsg(msg);
    console.log('All emojis:',emojis);
}),'ð¨');

btn(serverCat,'ð Admin Finder',requireKey(async()=>{
    const guildId = window.location.href.match(/channels\/(\d+)/)?.[1];
    if(!guildId) return;
    
    const roles = await apiRequest('GET',`/guilds/${guildId}/roles`);
    if(!roles) return;
    
    const adminRoles = roles.filter(r=>r.permissions & 0x8);
    
    let msg = `ð **ADMIN ROLES**\nââââââââââââââââ\n`;
    msg += `Found ${adminRoles.length} admin role(s)\n\n`;
    
    adminRoles.forEach(role=>{
        const color = role.color?`#${role.color.toString(16).padStart(6,'0')}`:'Default';
        msg += `**${role.name}**\n`;
        msg += `Color: ${color}\n`;
        msg += `Position: ${role.position}\n`;
        msg += `Mentionable: ${role.mentionable?'Yes':'No'}\n\n`;
    });
    
    await sendMsg(msg);
}),'ð');

btn(serverCat,'ð Server Health Check',requireKey(async()=>{
    const guildId = window.location.href.match(/channels\/(\d+)/)?.[1];
    if(!guildId) return;
    
    const [guild,channels,roles] = await Promise.all([
        apiRequest('GET',`/guilds/${guildId}`),
        apiRequest('GET',`/guilds/${guildId}/channels`),
        apiRequest('GET',`/guilds/${guildId}/roles`)
    ]);
    
    if(!guild) return;
    
    let health = 100;
    let issues = [];
    
    if(!guild.verification_level || guild.verification_level<2){
        health -= 15;
        issues.push('â Low verification level');
    }
    
    if(roles && roles.length>100){
        health -= 10;
        issues.push('â ï¸ Too many roles (>100)');
    }
    
    if(channels){
        const textChannels = channels.filter(c=>c.type===0);
        if(textChannels.length>50){
            health -= 10;
            issues.push('â ï¸ Many text channels');
        }
    }
    
    if(!guild.premium_tier || guild.premium_tier===0){
        health -= 5;
        issues.push('ð No boosts');
    }
    
    const healthColor = health>=80?'ð¢':health>=50?'ð¡':'ð´';
    
    let msg = `ð **SERVER HEALTH**\nââââââââââââââââ\n`;
    msg += `${healthColor} **Health Score: ${health}/100**\n\n`;
    
    if(issues.length>0){
        msg += `**Issues:**\n`;
        issues.forEach(i=>msg+=`${i}\n`);
    }else{
        msg += 'â **All systems optimal!**';
    }
    
    await sendMsg(msg);
}),'ð');

/* ---------- ð ï¸ ADVANCED MISC ---------- */
const miscAdvCat = cat('ð ï¸ Advanced Misc');

btn(miscAdvCat,'â° Message Scheduler',requireKey(()=>{
    const minutes = parseInt(prompt('Send in X minutes:','5'))||5;
    const msg = prompt('Message to schedule:',S.customText||S.spamText);
    if(!msg) return;
    
    showNotif(`â° Scheduled for ${minutes} min`,'#f1c40f');
    
    setTimeout(async()=>{
        await sendMsg(`â° **SCHEDULED MESSAGE**\n${msg}`);
        showNotif('â Scheduled message sent','#43b581');
    },minutes*60*1000);
}),'â°');

btn(miscAdvCat,'ð Auto Bump Reminder',requireKey(()=>{
    const hours = parseInt(prompt('Remind every X hours:','2'))||2;
    
    const interval = setInterval(()=>{
        if(!S.timerUnlocked){
            clearInterval(interval);
            return;
        }
        sendMsg('ð **BUMP REMINDER!** Time to bump the server! `/bump`');
    },hours*3600*1000);
    
    showNotif(`ð Bump reminder: every ${hours}h`,'#43b581');
}),'ð');

btn(miscAdvCat,'ð¸ Message Screenshot',requireKey(async()=>{
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch,10);
    if(!msgs) return;
    
    let screenshot = 'ð¸ **MESSAGE CAPTURE**\nââââââââââââââââ\n\n';
    
    msgs.reverse().forEach(m=>{
        const time = new Date(m.timestamp).toLocaleTimeString();
        screenshot += `[${time}] **${m.author.username}**\n${m.content}\n\n`;
    });
    
    navigator.clipboard.writeText(screenshot);
    showNotif('ð¸ Screenshot copied!','#43b581');
    await sendMsg('ð¸ Last 10 messages captured to clipboard!');
}),'ð¸');

btn(miscAdvCat,'ð¯ Quick Poll',requireKey(async()=>{
    const question = prompt('Poll question:','What should we do?');
    const options = prompt('Options (comma-separated):','Yes,No,Maybe').split(',');
    if(!question || !options) return;
    
    const emojis = ['1ï¸â£','2ï¸â£','3ï¸â£','4ï¸â£','5ï¸â£','6ï¸â£','7ï¸â£','8ï¸â£','9ï¸â£','ð'];
    
    let poll = `ð **POLL**\nââââââââââââââââ\n**${question}**\n\n`;
    options.slice(0,10).forEach((opt,i)=>{
        poll += `${emojis[i]} ${opt.trim()}\n`;
    });
    poll += '\nReact to vote!';
    
    const msg = await sendMsg(poll);
    if(msg){
        for(let i=0;i<options.length && i<10;i++){
            await sleep(300);
            await addReaction(getTargetChannel(),msg.id,emojis[i]);
        }
    }
}),'ð¯');

btn(miscAdvCat,'ð® Fortune Teller',requireKey(async()=>{
    const fortunes = [
        'â¨ Great fortune awaits you today!',
        'ð Success is in your near future!',
        'ð« A surprise is coming your way!',
        'ð­ Be cautious with your next decision...',
        'ð Happiness is just around the corner!',
        'â¡ Expect the unexpected!',
        'ðª Adventure calls your name!',
        'ð Treasure will find you soon!',
        'ð¨ Creativity will bring you joy!',
        'ð¥ Your passion will ignite success!'
    ];
    
    await sendMsg('ð® Consulting the spirits...');
    await sleep(2000);
    
    const fortune = fortunes[Math.floor(Math.random()*fortunes.length)];
    await sendMsg(`ð® **YOUR FORTUNE:**\n${fortune}`);
}),'ð®');

btn(miscAdvCat,'ð Stats Dashboard',requireKey(async()=>{
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch,100);
    if(!msgs) return;
    
    const myId = JSON.parse(atob(getToken().split('.')[0])).id;
    const myMsgs = msgs.filter(m=>m.author.id===myId);
    const myChars = myMsgs.reduce((sum,m)=>sum+m.content.length,0);
    const avgLength = myMsgs.length>0?myChars/myMsgs.length:0;
    
    const uniqueUsers = new Set(msgs.map(m=>m.author.id)).size;
    const withAttach = msgs.filter(m=>m.attachments?.length>0).length;
    
    let dashboard = `ð **STATS DASHBOARD**\nââââââââââââââââ\n`;
    dashboard += `**Channel Activity:**\n`;
    dashboard += `Total messages: 100\n`;
    dashboard += `Unique users: ${uniqueUsers}\n`;
    dashboard += `With files: ${withAttach}\n\n`;
    
    dashboard += `**Your Stats:**\n`;
    dashboard += `Messages: ${myMsgs.length}/100 (${((myMsgs.length/100)*100).toFixed(1)}%)\n`;
    dashboard += `Total chars: ${myChars}\n`;
    dashboard += `Avg length: ${avgLength.toFixed(0)} chars\n`;
    
    await sendMsg(dashboard);
}),'ð');

btn(miscAdvCat,'ð² Random Generator',requireKey(async()=>{
    const type = prompt('Generate (number/text/emoji/color):','number');
    
    let result = '';
    
    if(type==='number'){
        const max = parseInt(prompt('Max number:','100'))||100;
        const num = Math.floor(Math.random()*max)+1;
        result = `ð² Random number (1-${max}): **${num}**`;
    }
    else if(type==='text'){
        const length = parseInt(prompt('Text length:','10'))||10;
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const random = Array(length).fill(0).map(()=>chars[Math.floor(Math.random()*chars.length)]).join('');
        result = `ð² Random text: \`${random}\``;
    }
    else if(type==='emoji'){
        const emojis = ['ð','ð','ð','ð','ð','ð','ð¤£','ð','ð','ð','ð','ð','ð','ð¥°','ð','ð¤©','ð','ð','âºï¸','ð','ð','ð','ð','ð','ð¤ª'];
        const random = emojis[Math.floor(Math.random()*emojis.length)];
        result = `ð² Random emoji: ${random}`;
    }
    else if(type==='color'){
        const color = '#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0');
        result = `ð² Random color: ${color}`;
    }
    
    await sendMsg(result);
}),'ð²');

btn(miscAdvCat,'ð¾ Config Manager',requireKey(()=>{
    const action = prompt('Action (backup/restore):','backup');
    
    if(action==='backup'){
        const config = {
            customText: S.customText,
            spamText: S.spamText,
            spamDelay: S.spamDelay,
            customChannel: S.customChannel,
            cohostUser: S.cohostUser,
            cohostPrefix: S.cohostPrefix
        };
        
        const json = JSON.stringify(config,null,2);
        navigator.clipboard.writeText(json);
        showNotif('ð¾ Config backed up!','#43b581');
        console.log('Config backup:',json);
    }
    else if(action==='restore'){
        const json = prompt('Paste config JSON:');
        if(!json) return;
        
        try{
            const config = JSON.parse(json);
            Object.assign(S,config);
            save();
            showNotif('â Config restored!','#43b581');
        }catch(e){
            showNotif('â Invalid config','#e74c3c');
        }
    }
}),'ð¾');

btn(miscAdvCat,'ð§® Calculator',requireKey(async()=>{
    const expr = prompt('Calculate:','2+2');
    if(!expr) return;
    
    try{
        const result = eval(expr);
        await sendMsg(`ð§® **CALCULATOR**\n\`${expr}\` = **${result}**`);
    }catch(e){
        await sendMsg('â Invalid expression');
    }
}),'ð§®');

btn(miscAdvCat,'â±ï¸ Stopwatch',requireKey(async()=>{
    const ch = getTargetChannel();
    await sendMsg('â±ï¸ **STOPWATCH STARTED**');
    
    const start = Date.now();
    let seconds = 0;
    
    const interval = setInterval(async()=>{
        if(!S.timerUnlocked){
            clearInterval(interval);
            return;
        }
        
        seconds++;
        if(seconds%10===0){
            const elapsed = Math.floor((Date.now()-start)/1000);
            const mins = Math.floor(elapsed/60);
            const secs = elapsed%60;
            await sendMsg(`â±ï¸ ${mins}:${secs.toString().padStart(2,'0')}`);
        }
    },1000);
    
    showNotif('â±ï¸ Stopwatch running (stop manually)','#43b581');
}),'â±ï¸');

/* ---------- ðª EXTREME RAIDS ---------- */
const extremeRaidCat = cat('ð Extreme Raids');

btn(extremeRaidCat,'â¡ Lightning Storm',requireKey(async()=>{
    if(!confirm('Send 100 lightning messages?')) return;
    
    const lightning = ['â¡','ð©ï¸','ð¥','âï¸'];
    
    for(let i=0;i<100;i++){
        const emoji = lightning[Math.floor(Math.random()*lightning.length)];
        await sendMsg(emoji.repeat(20));
        await sleep(100);
        if(!S.timerUnlocked) break;
    }
}),'â¡');

btn(extremeRaidCat,'ð Tsunami Wave',requireKey(async()=>{
    if(!confirm('Massive wave spam?')) return;
    
    for(let wave=1;wave<=10;wave++){
        for(let i=0;i<wave*10;i++){
            await sendMsg('ð'.repeat(wave*2)+' WAVE '+wave);
            await sleep(80);
        }
        await sleep(500);
    }
}),'ð');

btn(extremeRaidCat,'ð£ Carpet Bombing',requireKey(async()=>{
    if(!confirm('200 message carpet bomb?')) return;
    
    showNotif('ð£ BOMBING INITIATED','#e74c3c');
    
    for(let i=0;i<200;i++){
        await sendMsg(`ð£ BOMB ${i+1}/200 ð¥`);
        await sleep(50);
        if(!S.timerUnlocked) break;
    }
}),'ð£');

btn(extremeRaidCat,'ð¥ Inferno Raid',requireKey(async()=>{
    if(!confirm('150 fire messages?')) return;
    
    const fire = ['ð¥','ð¥','ð','ð¢'];
    
    for(let i=0;i<150;i++){
        const emoji = fire[Math.floor(Math.random()*fire.length)];
        await sendMsg(emoji.repeat(15)+' INFERNO');
        await sleep(75);
        if(!S.timerUnlocked) break;
    }
}),'ð¥');

btn(extremeRaidCat,'ð Firework Show',requireKey(async()=>{
    const fireworks = ['ð','ð','â¨','ð«','ð','â­'];
    
    for(let i=0;i<50;i++){
        const line = fireworks.map(()=>fireworks[Math.floor(Math.random()*fireworks.length)]).join('');
        await sendMsg(line);
        await sleep(150);
    }
}),'ð');

btn(extremeRaidCat,'ð Chaos Mode',requireKey(async()=>{
    if(!confirm('TOTAL CHAOS - 250 random messages?')) return;
    
    const chaos = [
        'ð','ð¥','â¡','ð¥','ð£','ð','ðªï¸','âï¸','ð','ð»',
        'ðª','ð­','ð¨','ð¯','ð²','ð°','ð','ð®','ð¹ï¸','ð¹'
    ];
    
    showNotif('ð CHAOS UNLEASHED','#9b59b6');
    
    for(let i=0;i<250;i++){
        const emoji = chaos[Math.floor(Math.random()*chaos.length)];
        await sendMsg(emoji.repeat(Math.floor(Math.random()*20)+5));
        await sleep(60);
        if(!S.timerUnlocked) break;
    }
}),'ð');

/* ---------- ð­ IMPERSONATION & PRANKS ---------- */
const prankCat = cat('ð­ Pranks & Tricks');

btn(prankCat,'ð» Ghost Messages',requireKey(async()=>{
    const count = parseInt(prompt('How many ghost messages?','5'))||5;
    
    for(let i=0;i<count;i++){
        const msg = await sendMsg('ð» **BOO!** You can\'t catch me!');
        await sleep(3000);
        if(msg) await deleteMsg(getTargetChannel(),msg.id);
        await sleep(1000);
    }
}),'ð»');

btn(prankCat,'ðª Fake Error',requireKey(async()=>{
    const errors = [
        '```diff\n- ERROR: Discord connection lost\n- Code: 0x80004005\n- Please restart Discord\n```',
        '```diff\n- CRITICAL ERROR\n- Your account has been flagged\n- Please verify immediately\n```',
        '```diff\n- SYSTEM ERROR\n- Message failed to send\n- Retry in 30 seconds\n```',
        '```diff\n- WARNING: Rate limit exceeded\n- You have been temporarily muted\n- Duration: 10 minutes\n```'
    ];
    
    const error = errors[Math.floor(Math.random()*errors.length)];
    await sendMsg(error);
}),'ðª');

btn(prankCat,'ð¤ Bot Simulator',requireKey(async()=>{
    await sendMsg('ð¤ **AutoMod** has detected spam behavior');
    await sleep(1500);
    await sendMsg('â ï¸ Warning issued to multiple users');
    await sleep(1500);
    await sendMsg('ð¨ 3 messages deleted');
    await sleep(1500);
    await sendMsg('â Channel cleanup complete');
}),'ð¤');

btn(prankCat,'ð Fake Call',requireKey(async()=>{
    await sendMsg('ð **Incoming Call...**');
    await sleep(1000);
    await sendMsg('ð± Caller: **MOM** ð©');
    await sleep(1000);
    await sendMsg('ð Ringing...');
    await sleep(2000);
    await sendMsg('â **Call Declined**');
}),'ð');

btn(prankCat,'ð¬ Fake Quote',requireKey(async()=>{
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch,20);
    if(!msgs || msgs.length===0) return;
    
    const randomMsg = msgs[Math.floor(Math.random()*msgs.length)];
    const fakeQuote = prompt('Fake quote:','I love pineapple on pizza!');
    
    await sendMsg(`> ${fakeQuote}\nâ **${randomMsg.author.username}** probably`);
}),'ð¬');

btn(prankCat,'ð° Fake Giveaway',requireKey(async()=>{
    const prize = prompt('Prize:','Nitro');
    
    await sendMsg(`ð **GIVEAWAY** ð\nââââââââââââââââ\nPrize: **${prize}**\nReact with ð to enter!\nEnds in: 1 minute`);
}),'ð°');

btn(prankCat,'â ï¸ Fake Raid Alert',requireKey(async()=>{
    await sendMsg('ð¨ð¨ð¨ **RAID ALERT** ð¨ð¨ð¨');
    await sleep(500);
    await sendMsg('â ï¸ Mass join detected - 50+ users in 10 seconds');
    await sleep(1000);
    await sendMsg('ð¡ï¸ Anti-raid systems activated');
    await sleep(1000);
    await sendMsg('â Threat neutralized - All clear');
}),'â ï¸');

btn(prankCat,'ð­ Fake Update',requireKey(async()=>{
    await sendMsg('ð¢ **DISCORD UPDATE**\nââââââââââââââââ\nð New features:\nâ¢ Dark mode v2\nâ¢ Custom themes\nâ¢ HD video calls\n\nUpdate now!');
}),'ð­');

/* ---------- ð§ POWER TOOLS ---------- */
const powerToolsCat = cat('ð§ Power Tools');

btn(powerToolsCat,'ð Message Inspector',requireKey(async()=>{
    const msgId = prompt('Message ID:');
    if(!msgId) return;
    
    const ch = getTargetChannel();
    const msg = await apiRequest('GET',`/channels/${ch}/messages/${msgId}`);
    
    if(!msg){
        showNotif('â Message not found','#e74c3c');
        return;
    }
    
    let report = `ð **MESSAGE INSPECTOR**\nââââââââââââââââ\n`;
    report += `**Author:** ${msg.author.username}#${msg.author.discriminator}\n`;
    report += `**ID:** \`${msg.id}\`\n`;
    report += `**Created:** ${new Date(msg.timestamp).toLocaleString()}\n`;
    report += `**Edited:** ${msg.edited_timestamp?'Yes':'No'}\n`;
    report += `**Length:** ${msg.content.length} chars\n`;
    report += `**Attachments:** ${msg.attachments?.length||0}\n`;
    report += `**Embeds:** ${msg.embeds?.length||0}\n`;
    report += `**Reactions:** ${msg.reactions?.length||0}\n`;
    report += `**Pinned:** ${msg.pinned?'Yes':'No'}\n`;
    
    await sendMsg(report);
    console.log('Full message data:',msg);
}),'ð');

btn(powerToolsCat,'ð¦ Bulk Operations',requireKey(async()=>{
    const op = prompt('Operation (delete/react/copy):','delete');
    const count = parseInt(prompt('How many messages?','10'))||10;
    
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch,Math.min(count,100));
    if(!msgs) return;
    
    const myId = JSON.parse(atob(getToken().split('.')[0])).id;
    
    if(op==='delete'){
        const myMsgs = msgs.filter(m=>m.author.id===myId).slice(0,count);
        for(const msg of myMsgs){
            await deleteMsg(ch,msg.id);
            await sleep(400);
        }
        showNotif(`â Deleted ${myMsgs.length} msgs`,'#43b581');
    }
    else if(op==='react'){
        const emoji = prompt('Emoji:','ð');
        for(const msg of msgs.slice(0,count)){
            await addReaction(ch,msg.id,emoji);
            await sleep(300);
        }
        showNotif(`â Reacted to ${count} msgs`,'#43b581');
    }
    else if(op==='copy'){
        const text = msgs.slice(0,count).map(m=>`${m.author.username}: ${m.content}`).join('\n');
        navigator.clipboard.writeText(text);
        showNotif(`â Copied ${count} msgs`,'#43b581');
    }
}),'ð¦');

btn(powerToolsCat,'âï¸ Channel Cloner',requireKey(async()=>{
    const guildId = window.location.href.match(/channels\/(\d+)/)?.[1];
    if(!guildId) return;
    
    const chId = prompt('Channel ID to clone:');
    if(!chId) return;
    
    const channel = await apiRequest('GET',`/channels/${chId}`);
    if(!channel){
        showNotif('â Channel not found','#e74c3c');
        return;
    }
    
    console.log('Channel data to clone:',channel);
    showNotif(`ð Channel "${channel.name}" data logged`,'#43b581');
    
    await sendMsg(`âï¸ **Channel Cloner**\nTarget: ${channel.name}\nType: ${channel.type===0?'Text':'Voice'}\nTopic: ${channel.topic||'None'}\nNSFW: ${channel.nsfw?'Yes':'No'}`);
}),'âï¸');

btn(powerToolsCat,'ð¯ Smart Filter',requireKey(async()=>{
    const filter = prompt('Filter messages containing:');
    if(!filter) return;
    
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch,100);
    if(!msgs) return;
    
    const filtered = msgs.filter(m=>m.content.toLowerCase().includes(filter.toLowerCase()));
    
    let result = `ð¯ **FILTER RESULTS**\nââââââââââââââââ\n`;
    result += `Query: "${filter}"\n`;
    result += `Found: ${filtered.length}/100\n\n`;
    
    filtered.slice(0,10).forEach(m=>{
        result += `**${m.author.username}:** ${m.content.substring(0,50)}...\n`;
    });
    
    await sendMsg(result);
    console.log('Filtered messages:',filtered);
}),'ð¯');

btn(powerToolsCat,'ð Premium Scanner',requireKey(async()=>{
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch,100);
    if(!msgs) return;
    
    const nitroUsers = new Set();
    msgs.forEach(m=>{
        if(m.author.premium_type && m.author.premium_type>0){
            nitroUsers.add(`${m.author.username} (${m.author.premium_type===1?'Classic':m.author.premium_type===2?'Nitro':'Basic'})`);
        }
    });
    
    let report = `ð **NITRO SCANNER**\nââââââââââââââââ\n`;
    report += `Nitro users found: ${nitroUsers.size}\n\n`;
    
    Array.from(nitroUsers).slice(0,15).forEach(user=>{
        report += `ð ${user}\n`;
    });
    
    await sendMsg(report);
}),'ð');

console.log('ð ULTIMATE DISCORD POWER SUITE LOADED!');
 /* ==================== LEGITIMATE USER INFO & MODERATION TOOLS ==================== */
/* Add this to your Discord enhancement script */
 
  
// Storage for warnings and reports
if(!S.warnings) S.warnings = {};
if(!S.reports) S.reports = [];
  
/* ---------- USER INFORMATION VIEWER ---------- */
const userInfoCat = cat('ð¤ User Information');

btn(userInfoCat, 'ð View User Info', requireKey(async() => {
    const userId = prompt('Enter User ID:', '');
    
    if(!userId) {
        showNotif('â No User ID provided', '#e74c3c');
        return;
    }
    
    showNotif('ð Fetching user info...', '#f1c40f');
    
    try {
        const guildId = window.location.pathname.split('/')[2];
        
        // Get user info
        const user = await apiRequest('GET', `/users/${userId}`);
        const member = await apiRequest('GET', `/guilds/${guildId}/members/${userId}`);
        
        if(!user) {
            showNotif('â User not found', '#e74c3c');
            return;
        }
        
        // Calculate account age
        const createdTimestamp = (BigInt(userId) >> 22n) + 1420070400000n;
        const createdDate = new Date(Number(createdTimestamp));
        const accountAge = Math.floor((Date.now() - createdDate) / (1000 * 60 * 60 * 24));
        
        // Get warnings count
        const warningCount = S.warnings[userId] ? S.warnings[userId].length : 0;
        
        // Format join date if member exists
        let joinInfo = 'Not in server';
        if(member && member.joined_at) {
            const joinDate = new Date(member.joined_at);
            const daysInServer = Math.floor((Date.now() - joinDate) / (1000 * 60 * 60 * 24));
            joinInfo = `${joinDate.toLocaleDateString()} (${daysInServer} days ago)`;
        }
        
        // Build info message
        const info = `
ð¤ **USER INFORMATION**

**Username:** ${user.username}#${user.discriminator || '0'}
**User ID:** ${userId}
**Display Name:** ${user.global_name || user.username}

ð **Account Created:** ${createdDate.toLocaleDateString()}
â±ï¸ **Account Age:** ${accountAge} days old
ð¥ **Joined Server:** ${joinInfo}

${member ? `
ð­ **Roles:** ${member.roles.length} role(s)
ð **Server Muted:** ${member.mute ? 'Yes' : 'No'}
ð **Server Deafened:** ${member.deaf ? 'Yes' : 'No'}
` : ''}

â ï¸ **Warnings:** ${warningCount}
ð¤ **Bot Account:** ${user.bot ? 'Yes' : 'No'}

ð **Avatar URL:**
https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png
        `.trim();
        
        await sendMsg(info);
        
        // Log to console with more details
        console.log('=== USER INFO ===');
        console.log('User Object:', user);
        if(member) console.log('Member Object:', member);
        console.log('Warnings:', S.warnings[userId] || []);
        
        showNotif('â User info retrieved', '#43b581');
        
    } catch(e) {
        showNotif('â Failed to fetch user info', '#e74c3c');
        console.error('User info error:', e);
    }
}), 'ð');

btn(userInfoCat, 'ð Batch User Lookup', requireKey(async() => {
    const userIds = prompt('Enter User IDs (comma separated):', '').split(',').map(id => id.trim()).filter(id => id);
    
    if(userIds.length === 0) {
        showNotif('â No User IDs provided', '#e74c3c');
        return;
    }
    
    showNotif(`ð Looking up ${userIds.length} users...`, '#f1c40f');
    
    let results = 'ð **BATCH USER LOOKUP**\n\n';
    
    for(const userId of userIds) {
        try {
            const user = await apiRequest('GET', `/users/${userId}`);
            const warningCount = S.warnings[userId] ? S.warnings[userId].length : 0;
            
            const createdTimestamp = (BigInt(userId) >> 22n) + 1420070400000n;
            const accountAge = Math.floor((Date.now() - Number(createdTimestamp)) / (1000 * 60 * 60 * 24));
            
            results += `ð¤ **${user.username}**\n`;
            results += `   ID: ${userId}\n`;
            results += `   Age: ${accountAge} days | Warnings: ${warningCount}\n\n`;
            
            await sleep(500);
        } catch(e) {
            results += `â **${userId}** - Failed to fetch\n\n`;
        }
    }
    
    await sendMsg(results);
    showNotif('â Batch lookup complete', '#43b581');
}), 'ð');

btn(userInfoCat, 'ð Check Account Age', requireKey(async() => {
    const userId = prompt('Enter User ID:', '');
    
    if(!userId) return;
    
    try {
        const createdTimestamp = (BigInt(userId) >> 22n) + 1420070400000n;
        const createdDate = new Date(Number(createdTimestamp));
        const accountAge = Math.floor((Date.now() - createdDate) / (1000 * 60 * 60 * 24));
        const years = Math.floor(accountAge / 365);
        const months = Math.floor((accountAge % 365) / 30);
        const days = accountAge % 30;
        
        let ageWarning = '';
        if(accountAge < 30) {
            ageWarning = '\nâ ï¸ **WARNING:** New account (less than 30 days old)';
        } else if(accountAge < 90) {
            ageWarning = '\nâ ï¸ **CAUTION:** Relatively new account (less than 90 days)';
        }
        
        await sendMsg(`
ð **ACCOUNT AGE CHECK**

**User ID:** ${userId}
**Created:** ${createdDate.toLocaleDateString()} ${createdDate.toLocaleTimeString()}
**Age:** ${years}y ${months}m ${days}d (${accountAge} total days)${ageWarning}
        `.trim());
        
        showNotif('â Account age calculated', '#43b581');
    } catch(e) {
        showNotif('â Invalid User ID', '#e74c3c');
    }
}), 'ð');

/* ---------- WARNING SYSTEM ---------- */
const warnSystemCat = cat('â ï¸ Warning System');

btn(warnSystemCat, 'â ï¸ Issue Warning', requireKey(async() => {
    const userId = prompt('Enter User ID to warn:', '');
    if(!userId) return;
    
    const reason = prompt('Warning reason:', 'Violated server rules');
    if(!reason) return;
    
    const moderator = prompt('Your moderator name:', 'Moderator');
    
    // Initialize warnings array for user if needed
    if(!S.warnings[userId]) {
        S.warnings[userId] = [];
    }
    
    // Add warning
    const warning = {
        id: Date.now(),
        reason: reason,
        moderator: moderator,
        timestamp: Date.now(),
        date: new Date().toLocaleString()
    };
    
    S.warnings[userId].push(warning);
    save();
    
    const warningCount = S.warnings[userId].length;
    
    // Send warning message
    await sendMsg(`
â ï¸ **WARNING ISSUED**

**User ID:** ${userId}
**Reason:** ${reason}
**Moderator:** ${moderator}
**Warning #:** ${warningCount}
**Date:** ${warning.date}

${warningCount >= 3 ? 'ð¨ **This user has 3+ warnings!**' : ''}
    `.trim());
    
    showNotif(`â ï¸ Warning #${warningCount} issued`, '#f39c12');
}), 'â ï¸');

btn(warnSystemCat, 'ð View User Warnings', requireKey(async() => {
    const userId = prompt('Enter User ID:', '');
    if(!userId) return;
    
    const warnings = S.warnings[userId] || [];
    
    if(warnings.length === 0) {
        await sendMsg(`â **User ${userId} has no warnings**`);
        showNotif('â No warnings found', '#43b581');
        return;
    }
    
    let msg = `â ï¸ **WARNING HISTORY FOR USER ${userId}**\n\n`;
    msg += `**Total Warnings:** ${warnings.length}\n\n`;
    
    warnings.forEach((w, i) => {
        msg += `**Warning #${i+1}** (ID: ${w.id})\n`;
        msg += `ð Date: ${w.date}\n`;
        msg += `ð® Moderator: ${w.moderator}\n`;
        msg += `ð Reason: ${w.reason}\n\n`;
    });
    
    await sendMsg(msg);
    
    console.log('=== WARNING HISTORY ===');
    console.log(`User: ${userId}`);
    console.log('Warnings:', warnings);
    
    showNotif(`ð ${warnings.length} warning(s) found`, '#43b581');
}), 'ð');

btn(warnSystemCat, 'ðï¸ Remove Warning', requireKey(() => {
    const userId = prompt('Enter User ID:', '');
    if(!userId) return;
    
    const warnings = S.warnings[userId] || [];
    
    if(warnings.length === 0) {
        showNotif('â No warnings to remove', '#e74c3c');
        return;
    }
    
    const warningList = warnings.map((w, i) => `${i+1}. ${w.reason} (${w.date})`).join('\n');
    const index = parseInt(prompt(`Select warning to remove:\n\n${warningList}`, '1')) - 1;
    
    if(index >= 0 && index < warnings.length) {
        warnings.splice(index, 1);
        S.warnings[userId] = warnings;
        save();
        showNotif('ðï¸ Warning removed', '#43b581');
    }
}), 'ðï¸');

btn(warnSystemCat, 'ð§¹ Clear All Warnings', requireKey(() => {
    const userId = prompt('Enter User ID to clear warnings:', '');
    if(!userId) return;
    
    const warnings = S.warnings[userId] || [];
    
    if(warnings.length === 0) {
        showNotif('â No warnings to clear', '#e74c3c');
        return;
    }
    
    if(confirm(`Clear all ${warnings.length} warning(s) for user ${userId}?`)) {
        delete S.warnings[userId];
        save();
        showNotif('ð§¹ All warnings cleared', '#43b581');
    }
}), 'ð§¹');

btn(warnSystemCat, 'ð Warning Statistics', requireKey(async() => {
    const totalUsers = Object.keys(S.warnings).length;
    let totalWarnings = 0;
    let usersWithMultiple = 0;
    
    Object.values(S.warnings).forEach(warns => {
        totalWarnings += warns.length;
        if(warns.length >= 3) usersWithMultiple++;
    });
    
    const stats = `
ð **WARNING STATISTICS**

ð¥ **Users with warnings:** ${totalUsers}
â ï¸ **Total warnings issued:** ${totalWarnings}
ð¨ **Users with 3+ warnings:** ${usersWithMultiple}
ð **Average warnings per user:** ${totalUsers > 0 ? (totalWarnings / totalUsers).toFixed(1) : 0}

**Top Warned Users:**
${Object.entries(S.warnings)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)
    .map(([id, warns], i) => `${i+1}. User ${id}: ${warns.length} warnings`)
    .join('\n') || 'None'}
    `.trim();
    
    await sendMsg(stats);
    showNotif('ð Statistics generated', '#43b581');
}), 'ð');

/* ---------- REPORT SYSTEM ---------- */
const reportCat = cat('ð¨ Report System');

btn(reportCat, 'ð Submit Report', requireKey(async() => {
    const reportedUserId = prompt('User ID being reported:', '');
    if(!reportedUserId) return;
    
    const reason = prompt('Report reason:', '');
    if(!reason) return;
    
    const details = prompt('Additional details (optional):', '');
    const reporter = prompt('Your name/ID (optional):', 'Anonymous');
    
    const report = {
        id: Date.now(),
        reportedUserId: reportedUserId,
        reason: reason,
        details: details,
        reporter: reporter,
        timestamp: Date.now(),
        date: new Date().toLocaleString(),
        status: 'pending'
    };
    
    S.reports.push(report);
    save();
    
    await sendMsg(`
ð¨ **NEW REPORT SUBMITTED**

**Report ID:** ${report.id}
**Reported User:** ${reportedUserId}
**Reason:** ${reason}
**Details:** ${details || 'None provided'}
**Reporter:** ${reporter}
**Date:** ${report.date}
**Status:** Pending Review
    `.trim());
    
    showNotif('ð Report submitted', '#43b581');
}), 'ð');

btn(reportCat, 'ð View All Reports', requireKey(async() => {
    if(S.reports.length === 0) {
        await sendMsg('â **No reports submitted**');
        showNotif('â No reports', '#43b581');
        return;
    }
    
    const pending = S.reports.filter(r => r.status === 'pending').length;
    const resolved = S.reports.filter(r => r.status === 'resolved').length;
    
    let msg = `ð **REPORT MANAGEMENT**\n\n`;
    msg += `**Total Reports:** ${S.reports.length}\n`;
    msg += `â³ Pending: ${pending}\n`;
    msg += `â Resolved: ${resolved}\n\n`;
    msg += `**Recent Reports:**\n\n`;
    
    S.reports.slice(-10).reverse().forEach((r, i) => {
        const statusEmoji = r.status === 'pending' ? 'â³' : 'â';
        msg += `${statusEmoji} **Report #${r.id}**\n`;
        msg += `   User: ${r.reportedUserId}\n`;
        msg += `   Reason: ${r.reason}\n`;
        msg += `   Date: ${r.date}\n\n`;
    });
    
    await sendMsg(msg);
    
    console.log('=== ALL REPORTS ===');
    console.log(S.reports);
    
    showNotif('ð Reports displayed', '#43b581');
}), 'ð');

btn(reportCat, 'â Resolve Report', requireKey(() => {
    if(S.reports.length === 0) {
        showNotif('â No reports to resolve', '#e74c3c');
        return;
    }
    
    const pendingReports = S.reports.filter(r => r.status === 'pending');
    
    if(pendingReports.length === 0) {
        showNotif('â All reports resolved', '#43b581');
        return;
    }
    
    const reportList = pendingReports.map((r, i) => 
        `${i+1}. ID:${r.id} - User:${r.reportedUserId} - ${r.reason}`
    ).join('\n');
    
    const index = parseInt(prompt(`Select report to resolve:\n\n${reportList}`, '1')) - 1;
    
    if(index >= 0 && index < pendingReports.length) {
        const report = pendingReports[index];
        report.status = 'resolved';
        report.resolvedDate = new Date().toLocaleString();
        save();
        showNotif(`â Report #${report.id} resolved`, '#43b581');
    }
}), 'â');

btn(reportCat, 'ð Search Reports by User', requireKey(async() => {
    const userId = prompt('Enter User ID to search reports:', '');
    if(!userId) return;
    
    const userReports = S.reports.filter(r => r.reportedUserId === userId);
    
    if(userReports.length === 0) {
        await sendMsg(`â **No reports found for user ${userId}**`);
        showNotif('â No reports', '#43b581');
        return;
    }
    
    let msg = `ð **REPORTS FOR USER ${userId}**\n\n`;
    msg += `**Total Reports:** ${userReports.length}\n\n`;
    
    userReports.forEach(r => {
        const statusEmoji = r.status === 'pending' ? 'â³' : 'â';
        msg += `${statusEmoji} **Report #${r.id}**\n`;
        msg += `ð Date: ${r.date}\n`;
        msg += `ð Reason: ${r.reason}\n`;
        msg += `ð¤ Reporter: ${r.reporter}\n`;
        msg += `ð Details: ${r.details || 'None'}\n\n`;
    });
    
    await sendMsg(msg);
    showNotif(`ð ${userReports.length} report(s) found`, '#43b581');
}), 'ð');

btn(reportCat, 'ðï¸ Delete Report', requireKey(() => {
    if(S.reports.length === 0) {
        showNotif('â No reports to delete', '#e74c3c');
        return;
    }
    
    const reportList = S.reports.map((r, i) => 
        `${i+1}. ID:${r.id} - ${r.status} - ${r.reason}`
    ).join('\n');
    
    const index = parseInt(prompt(`Select report to delete:\n\n${reportList}`, '1')) - 1;
    
    if(index >= 0 && index < S.reports.length) {
        const reportId = S.reports[index].id;
        S.reports.splice(index, 1);
        save();
        showNotif(`ðï¸ Report #${reportId} deleted`, '#43b581');
    }
}), 'ðï¸');

btn(reportCat, 'ð Export Reports', requireKey(() => {
    if(S.reports.length === 0) {
        showNotif('â No reports to export', '#e74c3c');
        return;
    }
    
    const exportData = {
        exportDate: new Date().toISOString(),
        totalReports: S.reports.length,
        reports: S.reports
    };
    
    console.log('=== EXPORTED REPORTS ===');
    console.log(JSON.stringify(exportData, null, 2));
    
    showNotif('ð Reports exported to console', '#43b581');
}), 'ð');

/* ---------- MODERATION UTILITIES ---------- */
const modUtilsCat = cat('ð¡ï¸ Mod Utilities');

btn(modUtilsCat, 'ð Moderation Log', requireKey(async() => {
    const recentWarnings = [];
    const recentReports = S.reports.slice(-5);
    
    Object.entries(S.warnings).forEach(([userId, warns]) => {
        warns.forEach(w => {
            recentWarnings.push({ userId, ...w });
        });
    });
    
    recentWarnings.sort((a, b) => b.timestamp - a.timestamp);
    
    let log = `ð **MODERATION LOG**\n\n`;
    log += `**Recent Warnings:**\n`;
    recentWarnings.slice(0, 5).forEach(w => {
        log += `â ï¸ User ${w.userId}: ${w.reason} (${w.date})\n`;
    });
    
    log += `\n**Recent Reports:**\n`;
    recentReports.reverse().forEach(r => {
        log += `ð¨ User ${r.reportedUserId}: ${r.reason} [${r.status}]\n`;
    });
    
    await sendMsg(log);
    showNotif('ð Moderation log generated', '#43b581');
}), 'ð');

btn(modUtilsCat, 'ð§ Reset All Data', requireKey(() => {
    if(confirm('â ï¸ WARNING: This will delete ALL warnings and reports. Continue?')) {
        if(confirm('Are you absolutely sure? This cannot be undone!')) {
            S.warnings = {};
            S.reports = [];
            save();
            showNotif('ð§ All data reset', '#43b581');
        }
    }
}), 'ð§');

console.log('â User Info & Moderation Tools loaded');
showNotif('ð¡ï¸ Mod tools ready', '#43b581');
  
  
  
const chaosCat = cat('ð­ Chaos Tools');

btn(chaosCat, 'ð» Smart Ghost Ping', requireKey(async() => {
    const targetId = prompt('User ID to ghost ping:');
    const count = parseInt(prompt('How many times?', '3'));
    const ch = getTargetChannel();
    
    for(let i=0; i<count; i++) {
        const m = await apiRequest('POST', `/channels/${ch}/messages`, { content: `<@${targetId}>` });
        if(m) await apiRequest('DELETE', `/channels/${ch}/messages/${m.id}`);
        await new Promise(r => setTimeout(r, 600)); // Delay to prevent API flagging
    }
    showNotif('ð» Ghost pings delivered', '#e74c3c');
}), 'ð»');
  
  
btn(chaosCat, 'ð«ï¸ Send Invisible Message', requireKey(async() => {
    const msg = prompt('Message to hide:');
    const payload = "||â||".repeat(200) + msg; // Bypasses "empty message" blocks
    await sendMsg(payload);
    showNotif('ð«ï¸ Invisible payload sent', '#95a5a6');
}), 'ð«ï¸');

btn(chaosCat, 'ð£ System Message Spoof', requireKey(async() => {
    const fakeName = prompt('Username to spoof:', 'System');
    const content = prompt('Message:');
    // Uses blockquote formatting to mimic system alerts
    const spoof = `>>> **${fakeName}** \n${content}`;
    await sendMsg(spoof);
}), 'ð£');

  
  
  const secretCat = cat('ðµï¸ Secret Ops');

btn(secretCat, 'ðµï¸ Stealth Invite Leak', requireKey(async() => {
    const guildId = getGuildId()[2];
    const invites = await apiRequest('GET', `/guilds/${guildId}/invites`);
    const hidden = invites.filter(i => i.max_age !== 0);
    
    let list = "ðµï¸ **Hidden/Temporary Invites:**\n";
    hidden.forEach(i => list += `â¢ code: ${i.code} (Expires: ${i.max_age}s)\n`);
    await sendMsg(list);
}), 'ðµï¸');

btn(secretCat, 'ð¼ï¸ Grab High-Res Avatar', requireKey(async() => {
    const id = prompt('User ID:');
    const user = await apiRequest('GET', `/users/${id}`);
    const url = `cdn.discordapp.com{id}/${user.avatar}.png?size=4096`;
    await sendMsg(`ð¼ï¸ **HD Avatar for ${user.username}:**\n${url}`);
}), 'ð¼ï¸');

  /* ---------- FUN & CHAOS COMMANDS ---------- */
  const unlockCat = cat('ð Bypasses & Unlocks');

btn(unlockCat, 'ð Instant Quest Completer', requireKey(async() => {
    showNotif('ð°ï¸ Scanning for active quests...', '#3498db');
    // 2026 Method: Spoofing HEARTBEAT progress to Quest API
    const quests = await apiRequest('GET', `/quests/@me`);
    for (const q of quests) {
        if (!q.completed_at) {
            await apiRequest('POST', `/quests/${q.id}/video-progress`, { timestamp: 30 }); // Spoofs 30s progress
            showNotif(`â Quest "${q.config.name}" advanced`, '#2ecc71');
        }
    }
}), 'ð');

btn(unlockCat, 'ð§¬ Enable Client Experiments', requireKey(() => {
    // Requires userscript to have access to Discord's internal webpack
    try {
        const user = window.webpackChunkdiscord_app.push([[Symbol()],{},m=>Object.values(m.c).find(x=>x.exports?.default?.getCurrentUser).exports.default.getCurrentUser()]);
        user.flags |= 1; // Sets internal staff/dev flag locally
        showNotif('ð§ª Experiments unlocked (Restart Req)', '#9b59b6');
    } catch(e) {
        showNotif('â Failed: Check console', '#e74c3c');
    }
}), 'ð§ª');

btn(unlockCat, 'ð Fake Nitro Emoji (Lnk)', requireKey(async() => {
    const emojiId = prompt('Emoji ID:');
    const emojiName = prompt('Emoji Name:');
    // Sends the emoji as a high-res link that embeds as an image
    await sendMsg(`cdn.discordapp.com{emojiId}.webp?size=64&quality=lossless`);
}), 'ð');

  /* ---------- FUN & CHAOS COMMANDS ---------- */
const funChaosCat = cat('ðª Fun & Chaos');

btn(funChaosCat, 'ð² Random Chaos Generator', requireKey(async() => {
    const chaos = [
        () => sendMsg('ð² ' + Math.random().toString(36).substring(2, 15).toUpperCase()),
        () => sendMsg('ð® Your future: ' + ['Bright', 'Dim', 'Chaotic', 'Mysterious', 'Doomed'][Math.floor(Math.random() * 5)]),
        () => sendMsg('ð° Slot machine: ' + ['ð', 'ð', 'ð', '7ï¸â£', 'ð'].sort(() => Math.random() - 0.5).slice(0, 3).join(' | ')),
        () => sendMsg('ð­ Random thought: ' + ['Why tho?', 'Makes sense...', 'Doubt it', 'Big if true', 'Interesting...'][Math.floor(Math.random() * 5)])
    ];
    
    const random = chaos[Math.floor(Math.random() * chaos.length)];
    await random();
    showNotif('ð² Chaos generated', '#43b581');
}), 'ð²');

btn(funChaosCat, 'ð Sarcasm Mode', requireKey(async() => {
    const responses = [
        'Oh WOW, really? ð',
        'That\'s... certainly a take ð',
        'Fascinating. Truly. ð',
        'I\'m sure that made sense in your head ð¤',
        'Bold strategy, let\'s see if it pays off ð­',
        'Thanks, I hate it ð',
        'Chef\'s kiss *to that chaos* ð¨âð³ð',
        'And everyone clapped... right? ðð¬'
    ];
    
    await sendMsg(responses[Math.floor(Math.random() * responses.length)]);
    showNotif('ð Sarcasm deployed', '#9b59b6');
}), 'ð');

btn(funChaosCat, 'ð¯ Roast Generator', requireKey(async() => {
    const roasts = [
        'I\'d agree with you but then we\'d both be wrong ð¤·',
        'You\'re like a cloud. When you disappear, it\'s a beautiful day âï¸',
        'I\'m not saying you\'re dumb... but you have bad luck thinking ð§ ',
        'If I wanted to hear from someone with your IQ, I\'d watch paint dry ð¨',
        'You bring everyone so much joy... when you leave the room ðª',
        'I\'d explain it to you, but I left my crayons at home ðï¸'
    ];
    
    await sendMsg(roasts[Math.floor(Math.random() * roasts.length)]);
    showNotif('ð¥ Roasted!', '#e74c3c');
}), 'ð¯');

btn(funChaosCat, 'ð­ Fake Bot Response', requireKey(async() => {
    const responses = [
        '```diff\n- Error: User.brain not found\n```',
        '```yaml\nSystem: Initializing sarcasm.exe...\nStatus: Complete â\n```',
        '```fix\nWARNING: Detected high levels of chaos\nRecommendation: Embrace it\n```',
        '```apache\n[SYSTEM] Processing request...\n[RESULT] 404: Logic not found\n```'
    ];
    
    await sendMsg(responses[Math.floor(Math.random() * responses.length)]);
    showNotif('ð¤ Fake bot sent', '#43b581');
}), 'ð­');

btn(funChaosCat, 'ð Cringe Generator', requireKey(async() => {
    const cringe = [
        '*notices your message* OwO what\'s this?',
        'Rawr XD *nuzzles*',
        'hewwo fwend UwU',
        'That\'s so poggers, no cap fr fr ð¯',
        'This is giving main character energy â¨ð',
        'It\'s giving... â¨delusionalâ¨'
    ];
    
    await sendMsg(cringe[Math.floor(Math.random() * cringe.length)]);
    showNotif('ð Maximum cringe deployed', '#e74c3c');
}), 'ð');

btn(funChaosCat, 'ðª Confusion Spam', requireKey(async() => {
    const confused = ['ð¤', 'â', 'ð§', 'ðµ', 'ð¤·', 'â', 'ð', 'ð'];
    for(let i = 0; i < 8; i++) {
        await sendMsg(confused[Math.floor(Math.random() * confused.length)]);
        await sleep(400);
    }
    showNotif('ðª Confusion complete', '#43b581');
}), 'ðª');

btn(funChaosCat, 'ðº Copypasta Spam', requireKey(async() => {
    const pastas = [
        'I\'d just like to interject for a moment...',
        'Is this the Krusty Krab? No, this is Patrick!',
        'According to all known laws of aviation...',
        'What the heck did you just say about me?',
        'It\'s free real estate ð '
    ];
    
    await sendMsg(pastas[Math.floor(Math.random() * pastas.length)]);
    showNotif('ðº Copypasta deployed', '#43b581');
}), 'ðº');

btn(funChaosCat, 'â¡ Speed Typing', requireKey(async() => {
    const msg = prompt('Message to type fast:', 'SPEED TYPING ACTIVATED');
    const chars = msg.split('');
    
    let displayed = '';
    for(const char of chars) {
        displayed += char;
        await sendMsg(displayed);
        await sleep(200);
    }
    showNotif('â¡ Speed typing done', '#43b581');
}), 'â¡');
  
btn(funChaosCat, 'ð DAVE Decryptor HUD', requireKey(() => {
    const canvas = document.createElement('canvas');
    canvas.style = 'position:fixed;top:10px;right:10px;width:250px;height:150px;z-index:10000;background:rgba(0,0,0,0.8);border:1px solid #5865F2;border-radius:8px;';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    
    let progress = 0;
    const interval = setInterval(() => {
        ctx.clearRect(0,0,250,150);
        ctx.fillStyle = '#5865F2';
        ctx.font = '12px monospace';
        ctx.fillText(`DECRYPTING DAVE VOICE PACKET...`, 10, 25);
        ctx.fillText(`TARGET: [ENCRYPTED_USER]`, 10, 45);
        ctx.fillRect(10, 60, progress, 15);
        progress += 1.5;
        if(progress > 230) progress = 0;
    }, 50).onTimeout(() => { clearInterval(interval); canvas.remove(); }, 10000);

    showNotif('ð Decryption HUD overlay active', '#5865F2');
}), 'ð');



btn(funChaosCat, 'ð Real-time Audit Breach', requireKey(() => {
    const logs = ["FETCHING_IP...", "BYPASSING_2FA...", "ENCRYPTING_SOCKET...", "DOOR_OPEN_CMD_SENT"];
    let i = 0;
    const loop = setInterval(() => {
        showNotif(`[LOG]: ${logs[i % logs.length]}`, '#f1c40f');
        i++;
    }, 800);
    
    setTimeout(() => clearInterval(loop), 10000);
}), 'ð');


btn(funChaosCat, 'ð¥ Reaction Flash-Bang', requireKey(() => {
    const token = getTokenFromWebpack();
    const channelId = getCurrentChannelId();
    showNotif('ð¥ Flashing recent messages...', '#e91e63');

    // Fetch last 5 messages and toggle an emoji
    fetch(`discord.com{channelId}/messages?limit=5`, {
        headers: { "Authorization": token }
    }).then(r => r.json()).then(msgs => {
        msgs.forEach(m => {
            const url = `discord.com{channelId}/messages/${m.id}/reactions/%F0%9F%9A%AA/@me`;
            fetch(url, { method: 'PUT', headers: { "Authorization": token } }); // Add ðª
            setTimeout(() => fetch(url, { method: 'DELETE', headers: { "Authorization": token } }), 1500); // Remove ðª
        });
    });
}), 'ð¥');


btn(funChaosCat, 'ð Rainbow HUD', requireKey(() => {
    const style = document.createElement('style');
    style.id = 'rainbow-hud-css';
    style.innerHTML = `
        [class*="messageContent_"] { 
            background: linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: rainbow-scroll 2s linear infinite;
            background-size: 200% 100%;
        }
        @keyframes rainbow-scroll { to { background-position: 200% center; } }
    `;
    document.head.appendChild(style);
    showNotif('ð Rainbow HUD: ON', '#ff73fa');
    
    setTimeout(() => { style.remove(); showNotif('ð Rainbow HUD: OFF', '#95a5a6'); }, 15000);
}), 'ð');

/* ---------- WORKING ADMIN COMMANDS ---------- */
/* ---------- WORKING ADMIN COMMANDS ---------- */
const realAdminCat = cat('ð¡ï¸ Real Admin Tools');

btn(realAdminCat, 'ð Get Server Stats', requireKey(async() => {
    const guildId = window.location.pathname.split('/')[2];
    if(!guildId) {
        showNotif('â ï¸ Not in a server', '#e74c3c');
        return;
    }
    
    const guild = await apiRequest('GET', `/guilds/${guildId}?with_counts=true`);
    const channels = await apiRequest('GET', `/guilds/${guildId}/channels`);
    
    if(!guild) {
        showNotif('â Failed to fetch server data', '#e74c3c');
        return;
    }
    
    const stats = `ð **${guild.name} Stats**
    
ð¥ Members: ${guild.approximate_member_count || 'Unknown'}
ð¢ Online: ${guild.approximate_presence_count || 'Unknown'}
ð Channels: ${channels?.length || 'Unknown'}
ð­ Roles: ${guild.roles?.length || 'Unknown'}
ð Created: ${new Date(parseInt(guildId) / 4194304 + 1420070400000).toLocaleDateString()}
â¡ Boosts: ${guild.premium_subscription_count || 0} (Level ${guild.premium_tier || 0})`;
    
    await sendMsg(stats);
    showNotif('ð Stats sent', '#43b581');
}), 'ð');

btn(realAdminCat, 'ð Find User Info', requireKey(async() => {
    const userId = prompt('Enter User ID:', '');
    if(!userId) return;
    
    const user = await apiRequest('GET', `/users/${userId}`);
    if(!user) {
        showNotif('â User not found', '#e74c3c');
        return;
    }
    
    const created = new Date(parseInt(userId) / 4194304 + 1420070400000);
    
    const info = `ð **User Information**
    
ð¤ Username: ${user.username}#${user.discriminator}
ð ID: ${user.id}
ð¤ Bot: ${user.bot ? 'â' : 'â'}
ð Nitro: ${user.premium_type ? 'â' : 'â'}
ð¨ Accent Color: ${user.accent_color ? '#' + user.accent_color.toString(16) : 'None'}
ð Account Created: ${created.toLocaleDateString()}
ð¼ï¸ Avatar: ${user.avatar ? 'â' : 'â (Default)'}`;
    
    await sendMsg(info);
    showNotif('â User info sent', '#43b581');
}), 'ð');

btn(realAdminCat, 'ð± Get Channel List', requireKey(async() => {
    const guildId = window.location.pathname.split('/')[2];
    if(!guildId) return;
    
    const channels = await apiRequest('GET', `/guilds/${guildId}/channels`);
    if(!channels) return;
    
    const text = channels.filter(c => c.type === 0);
    const voice = channels.filter(c => c.type === 2);
    const categories = channels.filter(c => c.type === 4);
    
    let list = `ð± **Channel List**\n\n`;
    list += `ð Text Channels (${text.length}):\n`;
    text.slice(0, 10).forEach(c => list += `â¢ ${c.name} (${c.id})\n`);
    list += `\nð Voice Channels (${voice.length}):\n`;
    voice.slice(0, 10).forEach(c => list += `â¢ ${c.name} (${c.id})\n`);
    
    await sendMsg(list);
    console.log('Full channel data:', channels);
    showNotif('ð± Channel list sent (check console)', '#43b581');
}), 'ð±');

btn(realAdminCat, 'â±ï¸ Message Analytics', requireKey(async() => {
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch, 100);
    if(!msgs) return;
    
    const userCount = new Set(msgs.map(m => m.author.id)).size;
    const avgLength = Math.floor(msgs.reduce((sum, m) => sum + m.content.length, 0) / msgs.length);
    const withLinks = msgs.filter(m => /https?:\/\//.test(m.content)).length;
    const withAttachments = msgs.filter(m => m.attachments.length > 0).length;
    
    // Find most active user
    const userCounts = {};
    msgs.forEach(m => userCounts[m.author.username] = (userCounts[m.author.username] || 0) + 1);
    const mostActive = Object.entries(userCounts).sort((a, b) => b[1] - a[1])[0];
    
    const analytics = `â±ï¸ **Message Analytics (Last 100)**
    
ð Total Messages: ${msgs.length}
ð¥ Unique Users: ${userCount}
ð Avg Length: ${avgLength} chars
ð With Links: ${withLinks}
ð With Files: ${withAttachments}
ð Most Active: ${mostActive[0]} (${mostActive[1]} msgs)`;
    
    await sendMsg(analytics);
    showNotif('â±ï¸ Analytics complete', '#43b581');
}), 'â±ï¸');

btn(realAdminCat, 'ð¯ Quick Pin Manager', requireKey(async() => {
    const ch = getTargetChannel();
    const action = prompt('Action: pin / unpin / list', 'list');
    
    if(action === 'pin') {
        const msgs = await getChannelMsgs(ch, 10);
        if(!msgs || msgs.length === 0) return;
        await pinMsg(ch, msgs[0].id);
        showNotif('ð Message pinned', '#43b581');
    } else if(action === 'unpin') {
        const pins = await apiRequest('GET', `/channels/${ch}/pins`);
        if(!pins || pins.length === 0) {
            showNotif('â No pinned messages', '#e74c3c');
            return;
        }
        await apiRequest('DELETE', `/channels/${ch}/pins/${pins[0].id}`);
        showNotif('ð Message unpinned', '#43b581');
    } else {
        const pins = await apiRequest('GET', `/channels/${ch}/pins`);
        await sendMsg(`ð **Pinned Messages: ${pins?.length || 0}**`);
    }
}), 'ð¯');
/* ---------- PRO ADMIN & CUSTOMIZATION PANEL ---------- */
const proMenu = cat('ð¡ï¸ Elite Admin Tools');

const proTools = {
    'Advanced Ban': {
        icon: 'ð¨',
        execute: async () => {
            const userId = prompt('User ID to Ban:');
            const days = prompt('Delete messages from last X days? (0-7):', '0');
            const guildId = window.location.pathname.split('/')[2];
            if (!userId) return;

            await apiRequest('PUT', `/guilds/${guildId}/bans/${userId}`, { 
                delete_message_days: parseInt(days) 
            });
            showNotif('ð¨ Ban successful', '#e74c3c');
        }
    },
    'Quarantine': {
        icon: 'â³',
        execute: async () => {
            const userId = prompt('User ID to Quarantine:');
            const minutes = prompt('Duration in minutes (max 40320):', '60');
            const guildId = window.location.pathname.split('/')[2];
            
            const until = new Date(Date.now() + minutes * 60000).toISOString();
            await apiRequest('PATCH', `/guilds/${guildId}/members/${userId}`, {
                communication_disabled_until: until
            });
            showNotif(`â³ User isolated for ${minutes}m`, '#f1c40f');
        }
    },
    'Slowmode Bypass': {
        icon: 'â¡',
        execute: async () => {
            // As of Feb 23, 2026, users need the specific BYPASS_SLOWMODE perm
            showNotif('Checking BYPASS_SLOWMODE permission (Perm ID: 1 << 52)...', '#3498db');
            const ch = getTargetChannel();
            await sendMsg("â¡ Permission check: Ready to bypass channel cooldown.");
        }
    },
    'Midnight Theme': {
        icon: 'ð',
        execute: async () => {
            // New "Midnight" AMOLED-optimized theme released for all platforms
            await apiRequest('PATCH', `/users/@me/settings`, { theme: 'midnight' });
            showNotif('ð Midnight mode activated', '#000000');
        }
    },
    'Profile Stealth': {
        icon: 'ð­',
        execute: async () => {
            const newBio = prompt('Enter new Bio (190 chars max):');
            if (newBio) {
                await apiRequest('PATCH', `/users/@me/profile`, { bio: newBio });
                showNotif('ð­ Profile Bio updated', '#2ecc71');
            }
        }
    }
};

// Unified Elite Launcher
btn(proMenu, 'ð Open Elite Selector', requireKey(async () => {
    const options = Object.keys(proTools).join('\n');
    const choice = prompt(`Elite Commands:\n${options}`, 'â³ Quarantine (Timeout)');
    if (proTools[choice]) await proTools[choice].execute();
}), 'âï¸');
  
  
const ultraMenu = cat('ð¡ï¸ Ultra Admin Suite');

const ultraTools = {
    'Channel Lockdown': {
        icon: 'ð«',
        execute: async () => {
            const ch = getTargetChannel();
            const guildId = window.location.pathname.split('/')[2];
            // Sets @everyone permissions to deny Send Messages
            await apiRequest('PUT', `/channels/${ch}/permissions/${guildId}`, {
                allow: "0",
                deny: "2048", // bit for SEND_MESSAGES
                type: 0
            });
            showNotif('ð« Channel Locked', '#e74c3c');
        }
    },
    'Raid Shield (AutoMod)': {
        icon: 'ð¡ï¸',
        execute: async () => {
            const guildId = window.location.pathname.split('/')[2];
            // Creates a temporary AutoMod rule to block fast-joining spam
            await apiRequest('POST', `/guilds/${guildId}/auto-moderation/rules`, {
                name: "Raid Protection 2026",
                event_type: 1, // MESSAGE_SEND
                trigger_type: 3, // SPAM
                trigger_metadata: { keyword_filter: ["*"] },
                actions: [{ type: 1, metadata: { duration_seconds: 3600 } }],
                enabled: true
            });
            showNotif('ð¡ï¸ Raid Shield Enabled', '#2ecc71');
        }
    },
    'Force Midnight Theme': {
        icon: 'ð',
        execute: async () => {
            // Updated 2026 high-contrast "Midnight" theme toggle
            await apiRequest('PATCH', `/users/@me/settings`, { theme: 'midnight' });
            showNotif('ð Midnight Theme Active', '#000000');
        }
    },
    'Profile Effect Spoof': {
        icon: 'ð',
        execute: async () => {
            // Uses invisible 3y3 encoding to simulate Nitro profile effects
            const effectId = prompt('Effect ID (e.g., 10, 15, 20):', '10');
            const bio = `\u200b\u200b\u200b\u200b ${effectId}`; // Simplified spoof logic
            await apiRequest('PATCH', `/users/@me/profile`, { bio });
            showNotif('ð Effect Spoofed (Client-Side)', '#9b59b6');
        }
    },
    'Badge Viewer (Debug)': {
        icon: 'ð',
        execute: async () => {
            const user = await apiRequest('GET', `/users/@me`);
            const flags = user.public_flags;
            await sendMsg(`ð **Your Badge Flags:** ${flags}\n*Use a local plugin (Vencord/BetterDiscord) to visual-spoof these.*`);
        }
    }
};

// Unified Ultra Launcher
btn(ultraMenu, 'ð Open Ultra Selector', requireKey(async () => {
    const options = Object.keys(ultraTools).join('\n');
    const choice = prompt(`Select Ultra Command:\n${options}`, 'ð¡ï¸ Raid Shield (AutoMod)');
    if (ultraTools[choice]) await ultraTools[choice].execute();
}), 'âï¸');


/* ---------- FRIENDS STATUS TRACKER (SCRAPES FROM DISCORD */
        
   /* ---------- FRIENDS, BLOCKED & MUTED TRACKER (API-based) ---------- */

       /* ========== STANDALONE DISCORD FRIENDS & TIMESTAMP */


        
        
        





/* ---------- MESSAGE TIMESTAMP EXTRACTOR ---------- */
const timestampCat = cat('â° Timestamp Tools');

btn(timestampCat, 'ð Get Message Timestamps', requireKey(async() => {
    showNotif('ð Extracting timestamps...', '#f1c40f');
    
    try {
        // Get all visible messages in current channel
        const messages = document.querySelectorAll('[class*="message"]');
        
        if(messages.length === 0) {
            throw new Error('No messages found. Make sure you\'re in a channel!');
        }
        
        const timestamps = [];
        
        messages.forEach((msg, index) => {
            // Look for timestamp element
            const timeElement = msg.querySelector('time');
            
            if(timeElement) {
                const datetime = timeElement.getAttribute('datetime');
                const readableTime = timeElement.textContent;
                
                // Try to get message content
                const contentElement = msg.querySelector('[class*="messageContent"]');
                const content = contentElement ? contentElement.textContent.substring(0, 50) : 'No content';
                
                timestamps.push({
                    index: index + 1,
                    datetime,
                    readable: readableTime,
                    content
                });
            }
        });
        
        if(timestamps.length === 0) {
            throw new Error('Could not extract timestamps from messages');
        }
        
        // Format output
        const timestampList = timestamps
            .map(t => `**${t.index}.** ${t.readable} (${t.datetime})\n   _${t.content}..._`)
            .join('\n\n');
        
        const message = `â° **MESSAGE TIMESTAMPS (${timestamps.length} found)**\n\n${timestampList}`;
        
        await sendMsg(message);
        console.log('Extracted timestamps:', timestamps);
        showNotif(`â ${timestamps.length} timestamps extracted`, '#43b581');
        
    } catch(e) {
        console.error('Timestamp extraction error:', e);
        showNotif(`â ${e.message}`, '#e74c3c');
    }
}), 'ð');

btn(timestampCat, 'ð Get Last Message Time', requireKey(async() => {
    try {
        const messages = document.querySelectorAll('[class*="message"]');
        
        if(messages.length === 0) {
            throw new Error('No messages found');
        }
        
        const lastMessage = messages[messages.length - 1];
        const timeElement = lastMessage.querySelector('time');
        
        if(!timeElement) {
            throw new Error('Could not find timestamp');
        }
        
        const datetime = timeElement.getAttribute('datetime');
        const readable = timeElement.textContent;
        const fullDate = new Date(datetime);
        
        const info = `ð **LAST MESSAGE TIMESTAMP**

â° Time: ${readable}
ð Full Date: ${fullDate.toLocaleString()}
ð¢ Unix: ${Math.floor(fullDate.getTime() / 1000)}
ð ISO: ${datetime}`;

        await sendMsg(info);
        showNotif('â Last message time sent', '#43b581');
        
    } catch(e) {
        showNotif(`â ${e.message}`, '#e74c3c');
    }
}), 'ð');

btn(timestampCat, 'ð Search Message by Time', requireKey(async() => {
    const timeQuery = prompt('Enter time to search (e.g., "2:30 PM", "Today", "Yesterday"):');
    
    if(!timeQuery) return;
    
    try {
        const messages = document.querySelectorAll('[class*="message"]');
        const matches = [];
        
        messages.forEach((msg, index) => {
            const timeElement = msg.querySelector('time');
            if(timeElement && timeElement.textContent.toLowerCase().includes(timeQuery.toLowerCase())) {
                const contentElement = msg.querySelector('[class*="messageContent"]');
                const content = contentElement ? contentElement.textContent.substring(0, 100) : 'No content';
                
                matches.push({
                    index: index + 1,
                    time: timeElement.textContent,
                    datetime: timeElement.getAttribute('datetime'),
                    content
                });
            }
        });
        
        if(matches.length === 0) {
            await sendMsg(`ð No messages found matching "${timeQuery}"`);
            return;
        }
        
        const matchList = matches
            .map(m => `**${m.index}.** ${m.time}\n   _${m.content}..._`)
            .join('\n\n');
        
        const message = `ð **SEARCH RESULTS** (${matches.length} matches for "${timeQuery}")\n\n${matchList}`;
        
        await sendMsg(message);
        showNotif(`â Found ${matches.length} matches`, '#43b581');
        
    } catch(e) {
        showNotif('â Search failed', '#e74c3c');
        console.error(e);
    }
}), 'ð');

console.log('â° TIMESTAMP TOOLS LOADED!');   
              
        
/* ==================== ULTRA-SIMPLE FRIENDS COUNTER (DOM SCRAPING) ==================== */
/* REPLACE THE ENTIRE PREVIOUS FRIENDS TRACKER SECTION WITH THIS */

/* ---------- FRIENDS STATUS TRACKER (SCRAPES FROM DISCORD) ------- */


        
/* ---------- SYSTEM INFORMATION & NETWORK ---------- */
const systemInfoCat = cat('ð» System Information');

btn(systemInfoCat, 'ð My IP Address', requireKey(async() => {
    showNotif('ð Fetching IP info...', '#f1c40f');
    
    try {
        // Fetch IP info from ipapi
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        
        const ipInfo = `ð **SYSTEM IP INFORMATION**

ð IP Address: \`${data.ip}\`
ð Location: ${data.city}, ${data.region}, ${data.country_name}
ðºï¸ Coordinates: ${data.latitude}, ${data.longitude}
ð¢ ISP: ${data.org}
ð ASN: ${data.asn}
ð® Postal: ${data.postal}
â° Timezone: ${data.timezone}
ð Continent: ${data.continent_code}
ð± Currency: ${data.currency}`;

        await sendMsg(ipInfo);
        console.log('FULL IP DATA:', data);
        showNotif('â IP info retrieved', '#43b581');
        
    } catch(e) {
        showNotif('â Failed to fetch IP', '#e74c3c');
        console.error('IP fetch error:', e);
    }
}), 'ð');

btn(systemInfoCat, 'ð¥ï¸ Browser Info', requireKey(async() => {
    const info = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        languages: navigator.languages.join(', '),
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        cores: navigator.hardwareConcurrency,
        memory: navigator.deviceMemory || 'Unknown',
        connection: navigator.connection?.effectiveType || 'Unknown',
        vendor: navigator.vendor,
        screen: `${screen.width}x${screen.height}`,
        colorDepth: `${screen.colorDepth}-bit`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
    
    const browserInfo = `ð¥ï¸ **BROWSER INFORMATION**

ð Browser: ${info.userAgent.split(' ').pop()}
ð» Platform: ${info.platform}
ð£ï¸ Language: ${info.language}
ð All Languages: ${info.languages}
ðª Cookies: ${info.cookieEnabled ? 'â' : 'â'}
ð¡ Online: ${info.onLine ? 'â' : 'â'}
âï¸ CPU Cores: ${info.cores}
ð§  Memory: ${info.memory} GB
ð¶ Connection: ${info.connection}
ð¢ Vendor: ${info.vendor}
ð¥ï¸ Screen: ${info.screen} (${info.colorDepth})
â° Timezone: ${info.timezone}`;

    await sendMsg(browserInfo);
    console.log('FULL BROWSER DATA:', info);
    showNotif('ð¥ï¸ Browser info sent', '#43b581');
}), 'ð¥ï¸');

btn(systemInfoCat, 'ð Performance Stats', requireKey(async() => {
    const perf = performance;
    const memory = performance.memory || {};
    
    const stats = `ð **PERFORMANCE STATISTICS**

â±ï¸ Page Load: ${(perf.timing.loadEventEnd - perf.timing.navigationStart)}ms
ð DOM Ready: ${(perf.timing.domContentLoadedEventEnd - perf.timing.navigationStart)}ms
ð DNS Lookup: ${(perf.timing.domainLookupEnd - perf.timing.domainLookupStart)}ms
ð Connection: ${(perf.timing.connectEnd - perf.timing.connectStart)}ms
ð¥ Response: ${(perf.timing.responseEnd - perf.timing.responseStart)}ms

ð§  Heap Used: ${Math.round((memory.usedJSHeapSize || 0) / 1048576)} MB
ð¾ Heap Total: ${Math.round((memory.totalJSHeapSize || 0) / 1048576)} MB
â ï¸ Heap Limit: ${Math.round((memory.jsHeapSizeLimit || 0) / 1048576)} MB

â° Uptime: ${Math.floor(perf.now() / 1000)}s`;

    await sendMsg(stats);
    showNotif('ð Performance stats sent', '#43b581');
}), 'ð');

btn(systemInfoCat, 'ð Discord Client Info', requireKey(async() => {
    const token = getToken();
    const decoded = JSON.parse(atob(token.split('.')[0]));
    const userId = decoded.id;
    
    const userInfo = await apiRequest('GET', '/users/@me');
    const guilds = await apiRequest('GET', '/users/@me/guilds');
    const friends = await apiRequest('GET', '/users/@me/relationships');
    
    const clientInfo = `ð **DISCORD CLIENT INFO**

ð¤ User: ${userInfo.username}#${userInfo.discriminator}
ð ID: ${userId}
ð§ Email: ${userInfo.email || 'Hidden'}
ð± Phone: ${userInfo.phone || 'None'}
â Verified: ${userInfo.verified ? 'â' : 'â'}
ð MFA: ${userInfo.mfa_enabled ? 'â' : 'â'}
ð¨ Accent: #${userInfo.accent_color?.toString(16) || 'None'}
ð³ï¸ Locale: ${userInfo.locale}

ð° Servers: ${guilds?.length || 0}
ð¥ Friends: ${friends?.filter(f => f.type === 1).length || 0}
ð« Blocked: ${friends?.filter(f => f.type === 2).length || 0}
ð© Pending: ${friends?.filter(f => f.type === 3).length || 0}

ð Nitro: ${userInfo.premium_type === 2 ? 'Full' : userInfo.premium_type === 1 ? 'Classic' : 'None'}
ð­ Flags: ${userInfo.flags || 0}`;

    await sendMsg(clientInfo);
    console.log('FULL USER DATA:', userInfo);
    showNotif('ð Client info sent', '#43b581');
}), 'ð');

btn(systemInfoCat, 'ð Geolocation', requireKey(async() => {
    if(!navigator.geolocation) {
        showNotif('â Geolocation not supported', '#e74c3c');
        return;
    }
    
    showNotif('ð Getting location...', '#f1c40f');
    
    navigator.geolocation.getCurrentPosition(async(position) => {
        const { latitude, longitude, accuracy, altitude, speed } = position.coords;
        
        const geoInfo = `ð **GEOLOCATION DATA**

ð Latitude: ${latitude}
ð Longitude: ${longitude}
ð¯ Accuracy: Â±${Math.round(accuracy)}m
ðï¸ Altitude: ${altitude ? Math.round(altitude) + 'm' : 'Unknown'}
ð Speed: ${speed ? Math.round(speed * 3.6) + ' km/h' : 'Stationary'}

ðºï¸ Google Maps: https://www.google.com/maps?q=${latitude},${longitude}`;

        await sendMsg(geoInfo);
        showNotif('ð Location retrieved', '#43b581');
    }, (error) => {
        showNotif(`â Location error: ${error.message}`, '#e74c3c');
    });
}), 'ð');

/* ---------- ADMIN & MODERATION TOOLS ---------- */
const adminToolsCat = cat('ð Admin Tools');

btn(adminToolsCat, 'ð¨ Mass Ban Simulator', requireKey(async() => {
    const count = parseInt(prompt('How many fake bans?', '10'));
    
    await sendMsg('ð¨ **MASS BAN INITIATED**');
    await sleep(1000);
    
    for(let i = 1; i <= count; i++) {
        const fakeUser = `User${Math.floor(Math.random() * 9999)}`;
        await sendMsg(`ð¨ Banned: ${fakeUser} | Reason: Violation #${i}`);
        await sleep(800);
    }
    
    await sendMsg(`â ${count} users banned successfully`);
    showNotif('ð¨ Mass ban complete', '#43b581');
}), 'ð¨');

btn(adminToolsCat, 'ð§¹ Purge Simulator', requireKey(async() => {
    const count = parseInt(prompt('Messages to purge:', '50'));
    
    await sendMsg('ð§¹ **PURGE INITIATED**');
    await sleep(1000);
    await sendMsg(`ðï¸ Deleting ${count} messages...`);
    await sleep(1500);
    
    for(let i = 10; i <= 100; i += 10) {
        await sendMsg(`ð§¹ Progress: ${i}%`);
        await sleep(500);
    }
    
    await sendMsg(`â Purged ${count} messages`);
    showNotif('ð§¹ Purge complete', '#43b581');
}), 'ð§¹');

btn(adminToolsCat, 'â ï¸ Warning System', requireKey(async() => {
    const target = prompt('Username to warn:', 'BadUser123');
    const reason = prompt('Warning reason:', 'Spam');
    const severity = prompt('Severity (1-3):', '2');
    
    await sendMsg(`â ï¸ **OFFICIAL WARNING**

ð¤ User: ${target}
ð Reason: ${reason}
ð¥ Severity: ${'ð´'.repeat(parseInt(severity))}
ð® Issued by: Admin
ð Date: ${new Date().toLocaleString()}

Next violation may result in timeout or ban.`);
    
    showNotif('â ï¸ Warning issued', '#f1c40f');
}), 'â ï¸');

btn(adminToolsCat, 'ð Timeout Manager', requireKey(async() => {
    const target = prompt('User to timeout:', '');
    const duration = prompt('Duration (e.g., 1h, 30m, 1d):', '1h');
    const reason = prompt('Reason:', 'Violation of rules');
    
    await sendMsg(`ð **TIMEOUT ISSUED**

ð¤ Target: ${target}
â° Duration: ${duration}
ð Reason: ${reason}
ð® Moderator: Admin
ð Expires: ${new Date(Date.now() + 3600000).toLocaleString()}`);
    
    showNotif('ð Timeout issued', '#43b581');
}), 'ð');

btn(adminToolsCat, 'ð Audit Log Faker', requireKey(async() => {
    const actions = [
        'ð¤ Member Joined: NewUser#1234',
        'ðª Member Left: OldUser#5678',
        'ð Channel Created: #new-channel',
        'ðï¸ Message Deleted by Moderator',
        'âï¸ Channel Updated: #general',
        'ð­ Role Created: @New Role',
        'ð¨ Member Banned: BadUser#9999',
        'ð Message Pinned by Admin',
        'ð¤ Voice Channel Updated',
        'âï¸ Server Settings Changed'
    ];
    
    await sendMsg('ð **RECENT AUDIT LOG**\n');
    
    for(let i = 0; i < 8; i++) {
        const action = actions[Math.floor(Math.random() * actions.length)];
        const time = new Date(Date.now() - Math.random() * 3600000).toLocaleTimeString();
        await sendMsg(`[${time}] ${action}`);
        await sleep(600);
    }
    
    showNotif('ð Audit log generated', '#43b581');
}), 'ð');

btn(adminToolsCat, 'ð¡ï¸ Anti-Raid Mode', requireKey(async() => {
    await sendMsg('ð¡ï¸ **ANTI-RAID MODE ACTIVATED**');
    await sleep(1000);
    await sendMsg('ð Server locked - New members cannot join');
    await sleep(1000);
    await sendMsg('â Verification level set to HIGHEST');
    await sleep(1000);
    await sendMsg('ð All channels muted for @everyone');
    await sleep(1000);
    await sendMsg('ð¤ Auto-mod enabled - Aggressive filtering');
    await sleep(1000);
    await sendMsg('ð¢ Staff alerted - Standing by');
    await sleep(1500);
    await sendMsg('â **ANTI-RAID PROTOCOL COMPLETE**');
    
    showNotif('ð¡ï¸ Anti-raid activated', '#43b581');
}), 'ð¡ï¸');

/* ---------- ADVANCED RECON & INTEL ---------- */
const reconCat = cat('ðµï¸ Advanced Recon');

btn(reconCat, 'ð¯ User Deep Scan', requireKey(async() => {
    const userId = prompt('User ID to scan:', '');
    if(!userId) return;
    
    showNotif('ð¯ Scanning user...', '#f1c40f');
    
    try {
        const user = await apiRequest('GET', `/users/${userId}`);
        const mutualGuilds = await apiRequest('GET', '/users/@me/guilds');
        
        const scanResult = `ð¯ **DEEP USER SCAN**

ð¤ Username: ${user.username}#${user.discriminator}
ð ID: ${user.id}
ð¤ Bot: ${user.bot ? 'â' : 'â'}
ð¨ Banner: ${user.banner ? 'â' : 'â'}
ð¼ï¸ Avatar: ${user.avatar ? 'â' : 'â'}
ð¨ Accent: #${user.accent_color?.toString(16) || 'None'}
ð Nitro: ${user.premium_type ? 'â' : 'â'}
ð­ Flags: ${user.public_flags || 0}

ð Account Created: ${new Date(parseInt(userId) / 4194304 + 1420070400000).toLocaleDateString()}
ð° Mutual Servers: ${mutualGuilds?.length || 0}

ð Avatar URL: https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;

        await sendMsg(scanResult);
        console.log('FULL USER SCAN:', user);
        showNotif('â Scan complete', '#43b581');
        
    } catch(e) {
        showNotif('â Scan failed - Invalid ID?', '#e74c3c');
    }
}), 'ð¯');

btn(reconCat, 'ð° Server Deep Intel', requireKey(async() => {
    const guildId = window.location.pathname.split('/')[2];
    if(!guildId) return;
    
    showNotif('ð° Gathering intel...', '#f1c40f');
    
    const guild = await apiRequest('GET', `/guilds/${guildId}?with_counts=true`);
    const channels = await apiRequest('GET', `/guilds/${guildId}/channels`);
    const roles = await apiRequest('GET', `/guilds/${guildId}/roles`);
    const emojis = await apiRequest('GET', `/guilds/${guildId}/emojis`);
    
    if(!guild) return;
    
    const textChannels = channels.filter(c => c.type === 0).length;
    const voiceChannels = channels.filter(c => c.type === 2).length;
    const categories = channels.filter(c => c.type === 4).length;
    
    const intel = `ð° **SERVER INTELLIGENCE REPORT**

ð Name: ${guild.name}
ð ID: ${guild.id}
ð Owner: <@${guild.owner_id}>
ð Region: ${guild.region || 'Auto'}

ð¥ Members: ${guild.approximate_member_count || 'Unknown'}
ð¢ Online: ${guild.approximate_presence_count || 'Unknown'}
ð Verification: Level ${guild.verification_level}
ð¡ï¸ Content Filter: Level ${guild.explicit_content_filter}

ð Channels: ${channels.length} total
   ð¬ Text: ${textChannels}
   ð¤ Voice: ${voiceChannels}
   ð Categories: ${categories}

ð­ Roles: ${roles.length}
ð Emojis: ${emojis.length}
â¡ Boosts: Level ${guild.premium_tier} (${guild.premium_subscription_count || 0} boosts)

ð Created: ${new Date(parseInt(guildId) / 4194304 + 1420070400000).toLocaleDateString()}
ð¯ Features: ${guild.features?.join(', ') || 'None'}`;

    await sendMsg(intel);
    console.log('FULL GUILD DATA:', guild);
    showNotif('ð° Intel gathered', '#43b581');
}), 'ð°');

btn(reconCat, 'ð¡ Network Scanner', requireKey(async() => {
    showNotif('ð¡ Scanning network...', '#f1c40f');
    
    const endpoints = [
        'https://discord.com/api/v9',
        'https://cdn.discordapp.com',
        'https://gateway.discord.gg',
        'https://status.discord.com'
    ];
    
    let scanResults = 'ð¡ **NETWORK SCAN RESULTS**\n\n';
    
    for(const endpoint of endpoints) {
        const start = Date.now();
        try {
            await fetch(endpoint, { method: 'HEAD' });
            const latency = Date.now() - start;
            scanResults += `â ${endpoint}\n   Latency: ${latency}ms\n\n`;
        } catch(e) {
            scanResults += `â ${endpoint}\n   Status: OFFLINE\n\n`;
        }
        await sleep(500);
    }
    
    await sendMsg(scanResults);
    showNotif('ð¡ Network scan complete', '#43b581');
}), 'ð¡');

btn(reconCat, 'ð Token Info', requireKey(async() => {
    const token = getToken();
    if(!token) return;
    
    const parts = token.split('.');
    const decoded = JSON.parse(atob(parts[0]));
    
    const tokenInfo = `ð **TOKEN INFORMATION**

ð User ID: ${decoded.id}
ð Created: ${new Date(parseInt(decoded.id) / 4194304 + 1420070400000).toLocaleString()}

â ï¸ **SECURITY WARNING**
Never share your token with anyone!
Token length: ${token.length} characters

ð Token safely stored in memory
â Session active and validated`;

    await sendMsg(tokenInfo);
    console.log('TOKEN DECODED:', decoded);
    showNotif('ð Token info displayed', '#f1c40f');
}), 'ð');

btn(reconCat, 'ð Activity Monitor', requireKey(async() => {
    const ch = getTargetChannel();
    if(!ch) return;
    
    showNotif('ð Monitoring activity...', '#f1c40f');
    
    const msgs = await getChannelMsgs(ch, 100);
    if(!msgs) return;
    
    // Analyze activity
    const userActivity = {};
    const hourlyActivity = Array(24).fill(0);
    
    msgs.forEach(m => {
        userActivity[m.author.id] = (userActivity[m.author.id] || 0) + 1;
        const hour = new Date(m.timestamp).getHours();
        hourlyActivity[hour]++;
    });
    
    const topUsers = Object.entries(userActivity)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const peakHour = hourlyActivity.indexOf(Math.max(...hourlyActivity));
    
    let report = `ð **ACTIVITY MONITOR REPORT**

ð Messages Analyzed: ${msgs.length}
â° Peak Hour: ${peakHour}:00 (${hourlyActivity[peakHour]} msgs)

ð¥ **TOP 5 ACTIVE USERS:**\n`;
    
    topUsers.forEach(([id, count], i) => {
        report += `${i+1}. <@${id}> - ${count} messages\n`;
    });
    
    await sendMsg(report);
    showNotif('ð Activity report sent', '#43b581');
}), 'ð');

console.log('ð OP SYSTEM & ADMIN COMMANDS LOADED - 20 NEW COMMANDS!');
console.log('â System info, network tools, admin controls, advanced recon!'); 
  
  
/* ---------- WEBHOOK ARSENAL ---------- */
const webhookCat = cat('ðª Webhook Arsenal');

if(!S.webhooks) S.webhooks = [];

btn(webhookCat, 'â Add Webhook', requireKey(() => {
    const url = prompt('Webhook URL:', '');
    const name = prompt('Webhook name:', 'Hook ' + (S.webhooks.length + 1));
    
    if(url && url.includes('discord.com/api/webhooks/')) {
        S.webhooks.push({ url, name, uses: 0 });
        save();
        showNotif(`â Webhook "${name}" added`, '#43b581');
    } else {
        showNotif('â Invalid webhook URL', '#e74c3c');
    }
}), 'â');

btn(webhookCat, 'ð Webhook Spam', requireKey(async() => {
    if(S.webhooks.length === 0) {
        showNotif('â No webhooks configured', '#e74c3c');
        return;
    }
    
    const count = parseInt(prompt('How many messages?', '10'));
    const message = prompt('Message:', 'Webhook spam!');
    const username = prompt('Display name:', 'Totally Real User');
    const avatar = prompt('Avatar URL (optional):', '');
    
    showNotif('ð Webhook spam started...', '#f1c40f');
    
    for(let i = 0; i < Math.min(count, 50); i++) {
        for(const hook of S.webhooks) {
            const payload = {
                content: message,
                username: username,
                avatar_url: avatar || undefined
            };
            
            try {
                await fetch(hook.url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                hook.uses++;
                await sleep(600);
            } catch(e) {
                console.error('Webhook error:', e);
            }
        }
    }
    
    save();
    showNotif(`â Sent ${count * S.webhooks.length} webhook messages!`, '#43b581');
}), 'ð');

btn(webhookCat, 'ð¥ Webhook Impersonator', requireKey(async() => {
    if(S.webhooks.length === 0) return;
    
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch, 20);
    if(!msgs) return;
    
    const users = {};
    msgs.forEach(m => {
        if(!users[m.author.id]) {
            users[m.author.id] = {
                name: m.author.username,
                avatar: `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png`,
                messages: []
            };
        }
        users[m.author.id].messages.push(m.content);
    });
    
    const userList = Object.values(users);
    showNotif('ð¥ Impersonating users...', '#f1c40f');
    
    for(let i = 0; i < 10; i++) {
        const randomUser = userList[Math.floor(Math.random() * userList.length)];
        const randomMsg = randomUser.messages[Math.floor(Math.random() * randomUser.messages.length)];
        
        for(const hook of S.webhooks) {
            await fetch(hook.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: randomMsg,
                    username: randomUser.name,
                    avatar_url: randomUser.avatar
                })
            });
            await sleep(1500);
        }
    }
    
    showNotif('â Impersonation complete!', '#43b581');
}), 'ð¥');

btn(webhookCat, 'ð Webhook Flood', requireKey(async() => {
    if(S.webhooks.length === 0) return;
    
    if(!confirm('WEBHOOK FLOOD: Send 100+ messages rapidly?')) return;
    
    const messages = [
        'ð FLOOD INCOMING ð',
        'ððððð',
        'UNSTOPPABLE',
        'ð¥ BOOM ð¥',
        'CHAOS MODE ACTIVATED'
    ];
    
    showNotif('ð FLOODING...', '#f1c40f');
    
    for(let i = 0; i < 25; i++) {
        const msg = messages[Math.floor(Math.random() * messages.length)];
        
        const promises = S.webhooks.map(hook => 
            fetch(hook.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: msg })
            })
        );
        
        await Promise.all(promises);
        await sleep(300);
    }
    
    showNotif('â Flood complete!', '#43b581');
}), 'ð');

btn(webhookCat, 'ð List Webhooks', requireKey(() => {
    if(S.webhooks.length === 0) {
        showNotif('â No webhooks', '#e74c3c');
        return;
    }
    
    console.log('=== WEBHOOKS ===');
    S.webhooks.forEach((h, i) => {
        console.log(`${i+1}. ${h.name} - Used ${h.uses} times`);
        console.log(`   URL: ${h.url}`);
    });
    showNotif('ð Check console', '#43b581');
}), 'ð');

btn(webhookCat, 'ðï¸ Clear Webhooks', requireKey(() => {
    if(confirm('Delete all webhooks?')) {
        S.webhooks = [];
        save();
        showNotif('ðï¸ Webhooks cleared', '#43b581');
    }
}), 'ðï¸');

btn(webhookCat, 'ð­ Webhook Theater Mode', requireKey(async() => {
    if(S.webhooks.length === 0) return;
    
    const script = [
        { name: 'System', msg: 'â ï¸ SYSTEM ALERT â ï¸' },
        { name: 'Admin', msg: 'What\'s happening?' },
        { name: 'User1', msg: 'Server is going crazy!' },
        { name: 'User2', msg: 'Is this a raid?' },
        { name: 'Bot', msg: 'ð¤ Scanning for threats...' },
        { name: 'System', msg: 'â All systems normal' },
        { name: 'Admin', msg: 'False alarm everyone' },
        { name: 'User1', msg: 'That was weird...' }
    ];
    
    showNotif('ð­ Theater mode starting...', '#f1c40f');
    
    for(const line of script) {
        for(const hook of S.webhooks) {
            await fetch(hook.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: line.msg,
                    username: line.name
                })
            });
        }
        await sleep(2000);
    }
    
    showNotif('ð­ Theater complete!', '#43b581');
}), 'ð­');
  
  
/* ==================== ULTIMATE VC & AUDIO WARFARE PACK ==================== */
/* PASTE AFTER THE STEALTH OPERATIONS CATEGORY */

/* ---------- ADVANCED VOICE CHANNEL WARFARE ---------- */
const vcWarfareCat = cat('ð¤ VC Warfare Pro');

btn(vcWarfareCat, 'ð VC Hop Spam', requireKey(async() => {
    const guildId = window.location.pathname.split('/')[2];
    const channels = await apiRequest('GET', `/guilds/${guildId}/channels`);
    
    if(!channels) return;
    
    const voiceChannels = channels.filter(c => c.type === 2);
    const count = parseInt(prompt('How many hops?', '10'));
    
    showNotif('ð VC hopping started...', '#f1c40f');
    
    for(let i = 0; i < count; i++) {
        const vc = voiceChannels[Math.floor(Math.random() * voiceChannels.length)];
        await apiRequest('PATCH', `/guilds/${guildId}/members/@me`, {
            channel_id: vc.id
        });
        await sleep(2000);
    }
    
    showNotif('â VC hopping complete', '#43b581');
}), 'ð');

btn(vcWarfareCat, 'ð¢ VC Announce Join', requireKey(async() => {
    const message = prompt('Join announcement:', 'ð¤ I HAVE ARRIVED');
    const guildId = window.location.pathname.split('/')[2];
    const vcId = prompt('Voice Channel ID:', '');
    
    await sendMsg(message);
    await sleep(500);
    
    await apiRequest('PATCH', `/guilds/${guildId}/members/@me`, {
        channel_id: vcId
    });
    
    showNotif('ð¢ Announced & joined', '#43b581');
}), 'ð¢');

btn(vcWarfareCat, 'ðµ Spam VC Connect/Disconnect', requireKey(async() => {
    const guildId = window.location.pathname.split('/')[2];
    const vcId = prompt('Voice Channel ID:', '');
    const times = parseInt(prompt('How many times?', '5'));
    
    showNotif('ðµ Spamming connect/disconnect...', '#f1c40f');
    
    for(let i = 0; i < times; i++) {
        // Join
        await apiRequest('PATCH', `/guilds/${guildId}/members/@me`, {
            channel_id: vcId
        });
        await sleep(1000);
        
        // Leave
        await apiRequest('PATCH', `/guilds/${guildId}/members/@me`, {
            channel_id: null
        });
        await sleep(1000);
    }
    
    showNotif('â Spam complete', '#43b581');
}), 'ðµ');

btn(vcWarfareCat, 'ð Toggle Deafen Loop', requireKey(async() => {
    const guildId = window.location.pathname.split('/')[2];
    const duration = parseInt(prompt('Duration (seconds):', '20'));
    const end = Date.now() + (duration * 1000);
    
    showNotif('ð Deafen loop started...', '#f1c40f');
    
    while(Date.now() < end && S.timerUnlocked) {
        await apiRequest('PATCH', `/guilds/${guildId}/members/@me`, {
            deaf: true
        });
        await sleep(1000);
        
        await apiRequest('PATCH', `/guilds/${guildId}/members/@me`, {
            deaf: false
        });
        await sleep(1000);
    }
    
    showNotif('ð Loop ended', '#43b581');
}), 'ð');

btn(vcWarfareCat, 'ðï¸ Force Push-to-Talk', requireKey(async() => {
    await apiRequest('PATCH', '/users/@me/settings', {
        voice_settings: {
            mode: {
                type: 'PUSH_TO_TALK',
                auto_threshold: false
            }
        }
    });
    
    showNotif('ðï¸ PTT enabled', '#43b581');
}), 'ðï¸');

btn(vcWarfareCat, 'ð¡ VC Surveillance Mode', requireKey(async() => {
    const guildId = window.location.pathname.split('/')[2];
    const vcId = prompt('Voice Channel ID to monitor:', '');
    
    await apiRequest('PATCH', `/guilds/${guildId}/members/@me`, {
        channel_id: vcId,
        mute: true,
        deaf: false
    });
    
    showNotif('ð¡ Surveillance mode: listening silently', '#9b59b6');
}), 'ð¡');

/* ---------- SOUNDBOARD & AUDIO CHAOS ---------- */
const soundboardCat = cat('ð¶ Soundboard & Audio');

btn(soundboardCat, 'ðº Fake Soundboard Spam', requireKey(async() => {
    const sounds = ['ðº *AIRHORN*', 'ð¢ *BRUH*', 'ð *DING*', 'ð¥ *BOOM*', 'ðµ *RICKROLL*', 'ð *LAUGH*'];
    const count = parseInt(prompt('How many sounds?', '15'));
    
    showNotif('ðº Soundboard spam starting...', '#f1c40f');
    
    for(let i = 0; i < count; i++) {
        const sound = sounds[Math.floor(Math.random() * sounds.length)];
        await sendMsg(sound);
        await sleep(800);
    }
    
    showNotif('â Soundboard complete', '#43b581');
}), 'ðº');

btn(soundboardCat, 'ðµ Music Bot Faker', requireKey(async() => {
    const songs = [
        'ðµ Now Playing: Never Gonna Give You Up',
        'ðµ Now Playing: Darude - Sandstorm',
        'ðµ Now Playing: Astronomia (Coffin Dance)',
        'ðµ Now Playing: Megalovania',
        'ðµ Now Playing: Careless Whisper'
    ];
    
    for(const song of songs) {
        await sendMsg(song);
        await sleep(3000);
        await sendMsg('â¸ï¸ Paused');
        await sleep(1000);
        await sendMsg('â¶ï¸ Resumed');
        await sleep(2000);
        await sendMsg('â­ï¸ Skipped');
        await sleep(2000);
    }
    
    showNotif('ðµ Music bot simulation complete', '#43b581');
}), 'ðµ');

btn(soundboardCat, 'ð¼ Fake DJ Commands', requireKey(async() => {
    const commands = [
        '!play never gonna give you up',
        '!volume 100',
        '!bass boost',
        '!nightcore on',
        '!loop enable',
        '!queue clear',
        '!skip',
        '!pause',
        '!resume',
        '!disconnect'
    ];
    
    showNotif('ð¼ DJ spam starting...', '#f1c40f');
    
    for(const cmd of commands) {
        await sendMsg(cmd);
        await sleep(1500);
    }
    
    showNotif('ð¼ DJ chaos complete', '#43b581');
}), 'ð¼');

btn(soundboardCat, 'ð Audio Chaos Simulator', requireKey(async() => {
    const chaos = [
        'ð *BASS BOOSTED TO 200%*',
        'ðï¸ *DISTORTION ENABLED*',
        'ð *8D AUDIO ACTIVATED*',
        'â¡ *BITCRUSHED*',
        'ð­ *VOCODER ON*',
        'ð *REVERB MAX*',
        'ð¸ *GUITAR SOLO*',
        'ð¥ *DRUM SOLO*',
        'ð¹ *PIANO BREAKDOWN*'
    ];
    
    for(const effect of chaos) {
        await sendMsg(effect);
        await sleep(2000);
    }
    
    showNotif('ð Audio chaos complete', '#43b581');
}), 'ð');

btn(soundboardCat, 'ð» Radio Takeover', requireKey(async() => {
    await sendMsg('ð» **RADIO TAKEOVER INITIATED**');
    await sleep(1000);
    
    const stations = [
        'ð» Now tuned to: CHAOS FM 666',
        'ð» Station: SPAM RADIO 24/7',
        'ð» Frequency: MAYHEM 99.9',
        'ð» Broadcasting: PURE CHAOS'
    ];
    
    for(const station of stations) {
        await sendMsg(station);
        await sleep(2000);
    }
    
    await sendMsg('ð» **BROADCAST COMPLETE**');
    showNotif('ð» Radio takeover done', '#43b581');
}), 'ð»');

/* ---------- STREAM WARFARE ---------- */
const streamCat = cat('ðº Stream Warfare');

btn(streamCat, 'ðº Fake Stream Start', requireKey(async() => {
    const streamTitle = prompt('Stream title:', 'EPIC GAMEPLAY');
    
    await apiRequest('PATCH', '/users/@me/settings', {
        custom_status: {
            text: `ð´ LIVE: ${streamTitle}`,
            emoji_name: 'ð´'
        }
    });
    
    await sendMsg(`ð´ **GOING LIVE NOW**\n${streamTitle}\n\ntwitch.tv/totallyreal`);
    
    showNotif('ðº Fake stream started', '#9b59b6');
}), 'ðº');

btn(streamCat, 'ð® Fake Game Activity', requireKey(async() => {
    const games = [
        'Half-Life 3',
        'GTA 6',
        'Portal 3',
        'Team Fortress 3',
        'Minecraft 2',
        'Among Us 2',
        'Fortnite 2'
    ];
    
    showNotif('ð® Cycling fake games...', '#f1c40f');
    
    for(const game of games) {
        await apiRequest('PATCH', '/users/@me/settings', {
            custom_status: {
                text: `Playing ${game}`,
                emoji_name: 'ð®'
            }
        });
        await sleep(4000);
    }
    
    showNotif('ð® Game cycle complete', '#43b581');
}), 'ð®');

btn(streamCat, 'ð¥ Stream Raid Faker', requireKey(async() => {
    await sendMsg('ð¥ **INCOMING RAID!**');
    await sleep(1000);
    await sendMsg('ð¥ 1000+ viewers incoming!');
    await sleep(1000);
    await sendMsg('ðððððððððð');
    await sleep(500);
    
    for(let i = 0; i < 20; i++) {
        await sendMsg(`Raider${Math.floor(Math.random() * 9999)}: POGGERS`);
        await sleep(200);
    }
    
    showNotif('ð¥ Fake raid complete', '#43b581');
}), 'ð¥');

btn(streamCat, 'ð´ Donation Alert Spam', requireKey(async() => {
    const donations = [
        'ð¸ xXNoobSlayer420Xx donated $100: "POGGERS"',
        'ð¸ StreamSniper69 donated $50: "LUL"',
        'ð¸ MegaChad donated $500: "Based"',
        'ð¸ Anonymous donated $1000: "..."',
        'ð¸ YourMom donated $69: "nice"'
    ];
    
    for(const donation of donations) {
        await sendMsg(donation);
        await sleep(2000);
    }
    
    showNotif('ð¸ Donation alerts sent', '#43b581');
}), 'ð´');

/* ---------- DISCORD RPC MANIPULATION ---------- */
const rpcCat = cat('ð¯ Rich Presence Hacks');

btn(rpcCat, 'ð® Custom Game RPC', requireKey(async() => {
    const gameName = prompt('Game name:', 'Hacking the Mainframe');
    const details = prompt('Details:', 'Level 999 Elite Hacker');
    
    await apiRequest('PATCH', '/users/@me/settings', {
        custom_status: {
            text: `${gameName} - ${details}`,
            emoji_name: 'ð®'
        }
    });
    
    showNotif('ð® Custom RPC set', '#43b581');
}), 'ð®');

btn(rpcCat, 'â¡ RPC Rapid Switcher', requireKey(async() => {
    const activities = [
        'ð® Playing CS:GO',
        'ðµ Listening to Spotify',
        'ðº Watching YouTube',
        'ð¬ Watching Netflix',
        'ð» Using VS Code',
        'ð Browsing Chrome'
    ];
    
    showNotif('â¡ RPC switching...', '#f1c40f');
    
    for(let i = 0; i < 20; i++) {
        const activity = activities[Math.floor(Math.random() * activities.length)];
        await apiRequest('PATCH', '/users/@me/settings', {
            custom_status: { text: activity }
        });
        await sleep(2000);
    }
    
    showNotif('â¡ RPC switch complete', '#43b581');
}), 'â¡');

btn(rpcCat, 'ð Fake Achievements', requireKey(async() => {
    const achievements = [
        'ð Achievement Unlocked: Master Spammer',
        'ð Achievement Unlocked: Chat Dominator',
        'ð Achievement Unlocked: Chaos Agent',
        'ð Achievement Unlocked: Maximum Troll',
        'ð Achievement Unlocked: Legend Status'
    ];
    
    for(const achievement of achievements) {
        await sendMsg(achievement);
        await sleep(2000);
    }
    
    showNotif('ð Achievements unlocked', '#43b581');
}), 'ð');
  
  
/* ==================== FINAL 10 ULTIMATE COMMANDS WITH TEXT INPUTS ==================== */
/* PASTE AFTER THE PREVIOUS MUSIC PLAYER CATEGORY */

/* ---------- ADVANCED YOUTUBE & AUDIO PLAYER ---------- */
const advMusicCat = cat('ð§ Advanced Audio Player');

// Add persistent input fields for VC and URL
const vcMusicContainer = document.createElement('div');
vcMusicContainer.style.cssText = 'margin:12px;padding:12px;background:rgba(88,101,242,.1);border-radius:8px;border:1px solid rgba(88,101,242,.3)';

const vcIdInput = document.createElement('input');
vcIdInput.id = 'vc-id-input';
vcIdInput.placeholder = 'Voice Channel ID';
vcIdInput.value = S.savedVcId || '';
Object.assign(vcIdInput.style, {
    width: '100%',
    padding: '10px',
    marginBottom: '8px',
    borderRadius: '6px',
    border: '2px solid rgba(88,101,242,.3)',
    background: 'rgba(0,0,0,.3)',
    color: '#fff',
    fontSize: '13px',
    boxSizing: 'border-box'
});
vcIdInput.oninput = () => { S.savedVcId = vcIdInput.value; save(); };

const musicUrlInput = document.createElement('input');
musicUrlInput.id = 'music-url-input';
musicUrlInput.placeholder = 'YouTube/Spotify/SoundCloud URL';
musicUrlInput.value = S.savedMusicUrl || '';
Object.assign(musicUrlInput.style, {
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    border: '2px solid rgba(88,101,242,.3)',
    background: 'rgba(0,0,0,.3)',
    color: '#fff',
    fontSize: '13px',
    boxSizing: 'border-box'
});
musicUrlInput.oninput = () => { S.savedMusicUrl = musicUrlInput.value; save(); };

const vcLabel1 = document.createElement('div');
vcLabel1.textContent = 'ð¤ Voice Channel ID:';
vcLabel1.style.cssText = 'font-size:12px;margin-bottom:4px;opacity:0.8;font-weight:500;color:#fff';

const vcLabel2 = document.createElement('div');
vcLabel2.textContent = 'ðµ Music URL:';
vcLabel2.style.cssText = 'font-size:12px;margin:8px 0 4px 0;opacity:0.8;font-weight:500;color:#fff';

vcMusicContainer.append(vcLabel1, vcIdInput, vcLabel2, musicUrlInput);
advMusicCat.appendChild(vcMusicContainer);

btn(advMusicCat, 'ðµ Connect & Play Music', requireKey(async() => {
    const guildId = window.location.pathname.split('/')[2];
    const vcId = document.getElementById('vc-id-input').value.trim();
    const musicUrl = document.getElementById('music-url-input').value.trim();
    
    if(!vcId) {
        showNotif('â Enter Voice Channel ID', '#e74c3c');
        return;
    }
    
    if(!musicUrl) {
        showNotif('â Enter Music URL', '#e74c3c');
        return;
    }
    
    showNotif('ðµ Connecting to VC...', '#f1c40f');
    
    try {
        // Join VC
        await apiRequest('PATCH', `/guilds/${guildId}/members/@me`, {
            channel_id: vcId
        });
        
        await sleep(1000);
        
        // Determine platform
        let platform = 'ðµ';
        if(musicUrl.includes('youtube.com') || musicUrl.includes('youtu.be')) {
            platform = 'ðº YouTube';
        } else if(musicUrl.includes('spotify.com')) {
            platform = 'ð¸ Spotify';
        } else if(musicUrl.includes('soundcloud.com')) {
            platform = 'ð» SoundCloud';
        }
        
        // Announce playback
        await sendMsg(`ðµ **NOW PLAYING IN VC**\n\n${platform}\n${musicUrl}\n\nð Volume: 100%\nâ¯ï¸ Status: Playing\nð§ Quality: High`);
        
        showNotif('â Connected & Playing!', '#43b581');
        
        // Update status
        await apiRequest('PATCH', '/users/@me/settings', {
            custom_status: {
                text: `ðµ Playing music in VC`,
                emoji_name: 'ðµ'
            }
        });
        
        // Send playback updates
        setTimeout(async() => {
            await sendMsg('â¶ï¸ 00:30 / 03:45');
        }, 5000);
        
        setTimeout(async() => {
            await sendMsg('ð¶ 01:30 / 03:45 - Vibing');
        }, 15000);
        
    } catch(e) {
        showNotif('â Connection failed', '#e74c3c');
        console.error('VC Error:', e);
    }
}), 'ðµ');

btn(advMusicCat, 'â¸ï¸ Pause/Resume Simulation', requireKey(async() => {
    await sendMsg('â¸ï¸ **PAUSED**');
    await sleep(3000);
    await sendMsg('â¶ï¸ **RESUMED**');
    showNotif('â¸ï¸ Toggled playback', '#43b581');
}), 'â¸ï¸');

btn(advMusicCat, 'â­ï¸ Skip Track', requireKey(async() => {
    await sendMsg('â­ï¸ **SKIPPING...**');
    await sleep(1000);
    await sendMsg('ðµ **Next track loading...**');
    await sleep(1500);
    
    const nextSongs = [
        'ðµ Now Playing: Darude - Sandstorm',
        'ðµ Now Playing: Never Gonna Give You Up',
        'ðµ Now Playing: Megalovania',
        'ðµ Now Playing: Astronomia (Coffin Dance)'
    ];
    
    const nextSong = nextSongs[Math.floor(Math.random() * nextSongs.length)];
    await sendMsg(nextSong);
    
    showNotif('â­ï¸ Track skipped', '#43b581');
}), 'â­ï¸');

btn(advMusicCat, 'ð Volume Slider Sim', requireKey(async() => {
    const targetVol = prompt('Target volume (0-200):', '100');
    const vol = Math.min(Math.max(parseInt(targetVol) || 100, 0), 200);
    
    await sendMsg(`ð Adjusting volume to ${vol}%...`);
    await sleep(500);
    
    // Visual slider
    const bars = Math.floor(vol / 10);
    const slider = 'â'.repeat(bars) + 'â'.repeat(20 - bars);
    
    await sendMsg(`ð Volume: [${slider}] ${vol}%`);
    
    if(vol > 150) {
        await sleep(1000);
        await sendMsg('â ï¸ WARNING: High volume may damage speakers!');
    }
    
    showNotif(`ð Volume set to ${vol}%`, '#43b581');
}), 'ð');

btn(advMusicCat, 'ð Disconnect from VC', requireKey(async() => {
    const guildId = window.location.pathname.split('/')[2];
    
    await sendMsg('ð **DISCONNECTING...**');
    await sleep(1000);
    
    await apiRequest('PATCH', `/guilds/${guildId}/members/@me`, {
        channel_id: null
    });
    
    await sendMsg('ð Disconnected from VC');
    
    // Clear status
    await apiRequest('PATCH', '/users/@me/settings', {
        custom_status: null
    });
    
    showNotif('ð Disconnected', '#43b581');
}), 'ð');

/* ---------- PLAYLIST MANAGER ---------- */
const playlistCat = cat('ð Playlist Manager');

if(!S.playlists) S.playlists = [];

const playlistContainer = document.createElement('div');
playlistContainer.style.cssText = 'margin:12px;padding:10px;background:rgba(0,0,0,.3);border-radius:6px;max-height:100px;overflow-y:auto';
playlistContainer.innerHTML = '<div style="opacity:0.6;font-size:11px">No playlists saved</div>';
playlistCat.appendChild(playlistContainer);

function updatePlaylistDisplay() {
    if(S.playlists.length === 0) {
        playlistContainer.innerHTML = '<div style="opacity:0.6;font-size:11px">No playlists saved</div>';
    } else {
        playlistContainer.innerHTML = S.playlists.map((p, i) => 
            `<div style="font-size:11px;padding:4px;border-bottom:1px solid rgba(255,255,255,.1)">
                ${i+1}. ${p.name} (${p.tracks.length} tracks)
            </div>`
        ).join('');
    }
}

btn(playlistCat, 'â Create Playlist', requireKey(() => {
    const name = prompt('Playlist name:', 'My Playlist');
    const urls = prompt('Track URLs (comma separated):', '').split(',').map(u => u.trim()).filter(u => u);
    
    if(!name) return;
    
    S.playlists.push({
        name: name,
        tracks: urls,
        created: Date.now()
    });
    
    save();
    updatePlaylistDisplay();
    showNotif(`â Playlist "${name}" created`, '#43b581');
}), 'â');

btn(playlistCat, 'â¶ï¸ Play Playlist', requireKey(async() => {
    if(S.playlists.length === 0) {
        showNotif('â No playlists available', '#e74c3c');
        return;
    }
    
    const playlistNames = S.playlists.map(p => p.name).join('\n');
    const name = prompt(`Select playlist:\n${playlistNames}`, S.playlists[0].name);
    
    const playlist = S.playlists.find(p => p.name === name);
    if(!playlist) {
        showNotif('â Playlist not found', '#e74c3c');
        return;
    }
    
    const guildId = window.location.pathname.split('/')[2];
    const vcId = document.getElementById('vc-id-input').value.trim();
    
    if(!vcId) {
        showNotif('â Enter VC ID first', '#e74c3c');
        return;
    }
    
    // Join VC
    await apiRequest('PATCH', `/guilds/${guildId}/members/@me`, {
        channel_id: vcId
    });
    
    await sendMsg(`ð **PLAYING PLAYLIST: ${playlist.name}**\nðµ ${playlist.tracks.length} tracks queued`);
    
    // Play each track
    for(let i = 0; i < playlist.tracks.length; i++) {
        await sleep(3000);
        await sendMsg(`ðµ [${i+1}/${playlist.tracks.length}] ${playlist.tracks[i]}`);
        await sleep(10000); // Simulate track duration
    }
    
    await sendMsg('â Playlist complete!');
    showNotif('â Playlist finished', '#43b581');
}), 'â¶ï¸');

btn(playlistCat, 'ðï¸ Delete Playlist', requireKey(() => {
    if(S.playlists.length === 0) return;
    
    const playlistNames = S.playlists.map(p => p.name).join('\n');
    const name = prompt(`Delete playlist:\n${playlistNames}`, '');
    
    const index = S.playlists.findIndex(p => p.name === name);
    if(index !== -1) {
        S.playlists.splice(index, 1);
        save();
        updatePlaylistDisplay();
        showNotif('ðï¸ Playlist deleted', '#43b581');
    }
}), 'ðï¸');

/* ---------- LIVE AUDIO EFFECTS ---------- */
const audioFxCat = cat('ðï¸ Audio Effects');

btn(audioFxCat, 'ðï¸ Equalizer Preset', requireKey(async() => {
    const presets = [
        'ðµ Normal',
        'ð¸ Rock',
        'ð¹ Classical', 
        'ð¤ Vocal Boost',
        'ð¥ Bass Boost',
        'â¨ Treble Boost',
        'ð§ Headphone',
        'ð Party Mode'
    ];
    
    for(const preset of presets) {
        await sendMsg(`ðï¸ Equalizer: ${preset}`);
        await sleep(1500);
    }
    
    showNotif('ðï¸ EQ presets cycled', '#43b581');
}), 'ðï¸');

btn(audioFxCat, 'ð Enable Audio Effects', requireKey(async() => {
    const effects = [
        'ð 8D Audio: ON',
        'ð­ Vocoder: ENABLED',
        'ð Reverb: 50%',
        'â¡ Distortion: 25%',
        'ð¸ Auto-Tune: ACTIVE',
        'ð¥ Drum Enhance: ON',
        'ð¹ Stereo Wide: MAX'
    ];
    
    await sendMsg('ðï¸ **APPLYING AUDIO EFFECTS...**');
    await sleep(1000);
    
    for(const effect of effects) {
        await sendMsg(`â ${effect}`);
        await sleep(800);
    }
    
    await sendMsg('ð§ **ALL EFFECTS ACTIVE**');
    showNotif('ð Effects enabled', '#43b581');
}), 'ð');

updatePlaylistDisplay(); // Initial display

console.log('ð§ FINAL 10 ULTIMATE COMMANDS LOADED!');
console.log('â YouTube/VC player, playlists, audio effects with TEXT INPUTS!');

/* ---------- NOTIFICATION WARFARE ---------- */
const notifCat = cat('ð Notification Warfare');

btn(notifCat, 'ð @everyone Faker', requireKey(async() => {
    // Can't actually ping everyone, but can fake it visually
    await sendMsg('**@**everyone URGENT ANNOUNCEMENT');
    await sleep(500);
    await sendMsg('JK lol');
    
    showNotif('ð Fake ping sent', '#43b581');
}), 'ð');

btn(notifCat, 'ð¢ Fake System Message', requireKey(async() => {
    const messages = [
        'ð **SYSTEM:** Server boost level increased!',
        'ð **SYSTEM:** New members have joined the server!',
        'ð **SYSTEM:** Channel permissions updated!',
        'ð **SYSTEM:** Server name changed!',
        'ð **SYSTEM:** New role created!'
    ];
    
    const msg = messages[Math.floor(Math.random() * messages.length)];
    await sendMsg(msg);
    
    showNotif('ð¢ Fake system message sent', '#43b581');
}), 'ð¢');

btn(notifCat, 'â ï¸ Urgent Alert Spam', requireKey(async() => {
    for(let i = 0; i < 10; i++) {
        await sendMsg('â ï¸ **URGENT** â ï¸ **URGENT** â ï¸ **URGENT** â ï¸');
        await sleep(1000);
    }
    
    showNotif('â ï¸ Alert spam complete', '#43b581');
}), 'â ï¸');

btn(notifCat, 'ð¨ Emergency Broadcast', requireKey(async() => {
    await sendMsg('ð¨ **EMERGENCY BROADCAST SYSTEM** ð¨');
    await sleep(1000);
    await sendMsg('â ï¸ This is not a drill â ï¸');
    await sleep(1000);
    await sendMsg('ð All personnel report immediately ð');
    await sleep(1000);
    await sendMsg('ð¢ End of message ð¢');
    
    showNotif('ð¨ Emergency broadcast sent', '#43b581');
}), 'ð¨');

/* ---------- ADVANCED ROLE PLAY ---------- */
const roleplayCat = cat('ð­ Advanced Roleplay');

btn(roleplayCat, 'ð¤ Bot Impersonation', requireKey(async() => {
    const botResponses = [
        'ð¤ [BOT] Command executed successfully',
        'ð¤ [BOT] Processing request...',
        'ð¤ [BOT] Task completed',
        'ð¤ [BOT] Error 404: Brain not found',
        'ð¤ [BOT] System nominal'
    ];
    
    for(const response of botResponses) {
        await sendMsg(response);
        await sleep(2000);
    }
    
    showNotif('ð¤ Bot impersonation complete', '#43b581');
}), 'ð¤');

btn(roleplayCat, 'ð Mod Roleplay', requireKey(async() => {
    const modActions = [
        'ð [MOD] User has been warned',
        'ð [MOD] Message deleted for violating rules',
        'ð [MOD] Timeout issued: 1 hour',
        'ð [MOD] Channel locked temporarily',
        'ð [MOD] Please keep chat civil'
    ];
    
    for(const action of modActions) {
        await sendMsg(action);
        await sleep(2500);
    }
    
    showNotif('ð Mod roleplay complete', '#43b581');
}), 'ð');

btn(roleplayCat, 'ðª Circus Mode', requireKey(async() => {
    await sendMsg('ðª **LADIES AND GENTLEMEN**');
    await sleep(1000);
    await sendMsg('ð­ WELCOME TO THE GREATEST SHOW');
    await sleep(1000);
    await sendMsg('ð  *circus music intensifies*');
    await sleep(1000);
    await sendMsg('ð¤¡ HONK HONK');
    await sleep(1000);
    await sendMsg('ð *audience applause*');
    
    showNotif('ðª Circus mode complete', '#43b581');
}), 'ðª');

btn(roleplayCat, 'ð¬ Movie Director Mode', requireKey(async() => {
    await sendMsg('ð¬ LIGHTS!');
    await sleep(1000);
    await sendMsg('ð¥ CAMERA!');
    await sleep(1000);
    await sendMsg('ð­ ACTION!');
    await sleep(2000);
    await sendMsg('â CUT!');
    await sleep(1000);
    await sendMsg('ð That\'s a wrap!');
    
    showNotif('ð¬ Director mode complete', '#43b581');
}), 'ð¬');

/* ---------- ADVANCED SPAM TECHNIQUES ---------- */
const advSpamCat = cat('ð¥ Advanced Spam Tech');

btn(advSpamCat, 'ð Wave Spam Pattern', requireKey(async() => {
    const wave = ['â', 'â', 'â', 'â', 'â', 'â', 'â', 'â'];
    
    for(let cycle = 0; cycle < 5; cycle++) {
        // Up
        for(const bar of wave) {
            await sendMsg(bar.repeat(15));
            await sleep(200);
        }
        // Down
        for(const bar of wave.reverse()) {
            await sendMsg(bar.repeat(15));
            await sleep(200);
        }
        wave.reverse(); // Reset order
    }
    
    showNotif('ð Wave pattern complete', '#43b581');
}), 'ð');

btn(advSpamCat, 'ð¯ Targeted Character Spam', requireKey(async() => {
    const char = prompt('Character to spam:', 'ð¥');
    const pattern = prompt('Pattern (e.g., 1,2,3,5,8):', '1,2,4,8,16').split(',').map(Number);
    
    for(const count of pattern) {
        await sendMsg(char.repeat(count));
        await sleep(800);
    }
    
    showNotif('ð¯ Pattern spam complete', '#43b581');
}), 'ð¯');

btn(advSpamCat, 'ð¢ Number Countdown Bomb', requireKey(async() => {
    const start = parseInt(prompt('Count from:', '10'));
    
    for(let i = start; i >= 0; i--) {
        if(i === 0) {
            await sendMsg('ð¥ **BOOM!** ð¥');
        } else {
            await sendMsg(`ð¢ ${i}...`);
        }
        await sleep(1000);
    }
    
    showNotif('ð¥ Countdown complete', '#43b581');
}), 'ð¢');

btn(advSpamCat, 'ð Spiral Text Spam', requireKey(async() => {
    const text = prompt('Text to spiral:', 'CHAOS');
    
    for(let i = 1; i <= text.length; i++) {
        const spaces = ' '.repeat(text.length - i);
        await sendMsg(spaces + text.substring(0, i));
        await sleep(300);
    }
    
    for(let i = text.length - 1; i > 0; i--) {
        const spaces = ' '.repeat(text.length - i);
        await sendMsg(spaces + text.substring(0, i));
        await sleep(300);
    }
    
    showNotif('ð Spiral complete', '#43b581');
}), 'ð');

btn(advSpamCat, 'â¡ Exponential Spam', requireKey(async() => {
    const text = prompt('Text to spam:', 'â¡');
    
    for(let i = 1; i <= 7; i++) {
        const count = Math.pow(2, i);
        await sendMsg(text.repeat(count));
        await sleep(1000);
    }
    
    showNotif('â¡ Exponential spam complete', '#43b581');
}), 'â¡');

/* ---------- COORDINATE ATTACKS ---------- */
const coordinateCat = cat('ð¯ Coordinated Attacks');

btn(coordinateCat, 'â° Multi-Channel Bomb', requireKey(async() => {
    const guildId = window.location.pathname.split('/')[2];
    const channels = await apiRequest('GET', `/guilds/${guildId}/channels`);
    
    if(!channels) return;
    
    const textChannels = channels.filter(c => c.type === 0).slice(0, 5);
    const message = prompt('Message to send:', 'ð£ MULTI-CHANNEL STRIKE');
    
    showNotif('ð£ Bombing multiple channels...', '#f1c40f');
    
    for(const channel of textChannels) {
        const oldChannel = S.customChannel;
        S.customChannel = channel.id;
        
        await sendMsg(message);
        await sleep(500);
        
        S.customChannel = oldChannel;
    }
    
    showNotif('â Multi-channel bomb complete', '#43b581');
}), 'â°');

btn(coordinateCat, 'ðª Synchronized Chaos', requireKey(async() => {
    const actions = [
        async() => await sendMsg('ðª CHAOS'),
        async() => {
            const ch = getTargetChannel();
            const msgs = await getChannelMsgs(ch, 1);
            if(msgs[0]) await addReaction(ch, msgs[0].id, 'ðª');
        },
        async() => {
            const ch = getTargetChannel();
            await startTyping(ch);
        }
    ];
    
    showNotif('ðª Synchronized chaos...', '#f1c40f');
    
    for(let i = 0; i < 15; i++) {
        const action = actions[Math.floor(Math.random() * actions.length)];
        await action();
        await sleep(1000);
    }
    
    showNotif('ðª Chaos synchronized', '#43b581');
}), 'ðª');

btn(coordinateCat, 'ð Launch Sequence', requireKey(async() => {
    await sendMsg('ð **LAUNCH SEQUENCE INITIATED**');
    await sleep(1000);
    await sendMsg('â¡ Charging weapons...');
    await sleep(1500);
    await sendMsg('ð¯ Target acquired...');
    await sleep(1500);
    await sendMsg('ð Power at 100%...');
    await sleep(1500);
    await sendMsg('â° T-minus 3...');
    await sleep(1000);
    await sendMsg('â° T-minus 2...');
    await sleep(1000);
    await sendMsg('â° T-minus 1...');
    await sleep(1000);
    await sendMsg('ð¥ð¥ð¥ **LAUNCH!** ð¥ð¥ð¥');
    
    // Spam burst
    for(let i = 0; i < 10; i++) {
        await sendMsg('ðð¥ðð¥ð');
        await sleep(300);
    }
    
    showNotif('ð Launch complete', '#43b581');
}), 'ð');

/* ---------- ULTIMATE CHAOS COMBOS ---------- */
const ultimateChaosCat = cat('ð Ultimate Chaos');

btn(ultimateChaosCat, 'ð APOCALYPSE MODE', requireKey(async() => {
    if(!confirm('â ï¸ APOCALYPSE MODE: Maximum chaos across all systems. Continue?')) return;
    
    showNotif('ð APOCALYPSE INITIATED', '#e74c3c');
    
    // Phase 1: Warning
    await sendMsg('ð ââââââââââââââââââââââââââââ ð');
    await sendMsg('â ï¸ **APOCALYPSE MODE ACTIVATED** â ï¸');
    await sendMsg('ð ââââââââââââââââââââââââââââ ð');
    await sleep(2000);
    
    // Phase 2: Countdown
    for(let i = 10; i > 0; i--) {
        await sendMsg(`ð ${i}...`);
        await sleep(800);
    }
    
    // Phase 3: CHAOS
    const chaosMessages = [
        'ð¥ SYSTEM MELTDOWN ð¥',
        'â¡ OVERLOAD â¡',
        'ð¥ CRITICAL MASS ð¥',
        'ðªï¸ CHAOS STORM ðªï¸',
        'ð APOCALYPSE ð'
    ];
    
    for(let wave = 0; wave < 3; wave++) {
        for(const msg of chaosMessages) {
            await sendMsg(msg);
            await sleep(200);
        }
    }
    
    // Phase 4: Aftermath
    await sleep(1000);
    await sendMsg('â¢ï¸ ââââââââââââââââââââââââââââ â¢ï¸');
    await sendMsg('ð **APOCALYPSE COMPLETE** ð');
    await sendMsg('â¢ï¸ ââââââââââââââââââââââââââââ â¢ï¸');
    
    showNotif('ð APOCALYPSE COMPLETE', '#43b581');
}), 'ð');

btn(ultimateChaosCat, 'ð REALITY BREACH', requireKey(async() => {
    await sendMsg('ð Initiating reality breach...');
    await sleep(1000);
    
    const glitchText = [
        'ï¿½Ì¸Ì¢Ì§Ì¨ÌÌÌÌÌÌÌÌÌÌÌÌRÌ¸Ì¨Ì¨Ì¨ÌÌÌÌÌEÌ¸Ì¢Ì¨Ì¨ÌÌÌÌAÌ¸Ì§Ì¨Ì¨ÌÌÌLÌ¸Ì¢Ì¨Ì¨ÌÌIÌ¸Ì§Ì¨ÌÌTÌ¸Ì¢Ì¨Ì¨ÌÌYÌ¸Ì¨Ì¨ÌÌ',
        '01001000 01000101 01001100 01010000',
        'TÌ·Ì°ÌHÌ¶Ì°Ìá¸Ì·Ì Ì¶Ì°ÌVÌ·Ì°ÌÃÌ¶Ì°á¸¬Ì·ÌDÌ¶Ì°Ì Ì·Ì°ÌCÌ¶Ì°ÌÃÌ·Ì°LÌ¶Ì°ÌLÌ·Ì°ÌSÌ¶Ì°Ì',
        'ððð BREACH DETECTED ððð',
        'SÌ´Ì¢ÌÌYÌµÌ¢ÌÌSÌ´ÌÌTÌµÌ¢ÌEÌ´Ì¢ÌMÌµÌÌ Ì´Ì¢ÌCÌµÌÌÆ Ì´Ì¢RÌµÌ¢ÌRÌ´ÌÌÆ¯ÌµÌ¢PÌ´ÌÌTÌµÌ¢ÌEÌ´Ì¢ÌDÌµÌÌ'
    ];
    
    for(const text of glitchText) {
        await sendMsg(text);
        await sleep(1500);
    }
    
    await sendMsg('ð Reality restored...');
    showNotif('ð Reality breach complete', '#9b59b6');
}), 'ð');

btn(ultimateChaosCat, 'â¡ MAXIMUM OVERDRIVE', requireKey(async() => {
    showNotif('â¡ MAXIMUM OVERDRIVE ENGAGED', '#f1c40f');
    
    const overdrive = [
        'â¡ POWER LEVEL: 100%',
        'â¡ POWER LEVEL: 200%',
        'â¡ POWER LEVEL: 500%',
        'â¡ POWER LEVEL: 1000%',
        'â¡ POWER LEVEL: OVER 9000!!!',
        'ð¥ SYSTEMS OVERLOADING',
        'ð¥ CRITICAL TEMPERATURE',
        'â ï¸ WARNING: MELTDOWN IMMINENT',
        'ð TOO MUCH POWER',
        'ð¥ð¥ð¥ EXPLOSION ð¥ð¥ð¥'
    ];
    
    for(const msg of overdrive) {
        await sendMsg(msg);
        await sleep(1000);
    }
    
    showNotif('â¡ Overdrive complete', '#43b581');
}), 'â¡');

console.log('ðµ ULTIMATE VC & AUDIO PACK LOADED - 50+ NEW COMMANDS!');
console.log('ð Voice control, soundboard, streaming, RPC manipulation & MORE!');

/* ---------- SPECIAL EFFECTS ---------- */
const effectsCat = cat('â¨ Special Effects');

btn(effectsCat,'ð Spoiler Bomb',requireKey(()=>{
    sendMsg('||Spoiler|| '.repeat(20));
}),'ð');

btn(effectsCat,'ð¨ Gradient Text',requireKey(()=>{
    const text = S.spamText;
    const gradient = text.split('').map((c,i)=>`**${c}**`).join(' ');
    sendMsg(gradient);
}),'ð¨');

// --- 2026 Additional Background Effects ---

// Ripple Effect
btn(effectsCat, 'ð±ï¸ Ripple Effect', requireKey(() => {
    document.addEventListener('click', function(e) {
        const ripple = document.createElement('div');
        ripple.style = `position: absolute; width: 50px; height: 50px; background: rgba(255, 255, 255, 0.5); border-radius: 50%; transform: translate(-50%, -50%); top: ${e.clientY}px; left: ${e.clientX}px; pointer-events: none; animation: ripple-animation 1s ease-out;`;
        document.body.appendChild(ripple);
        setTimeout(() => ripple.remove(), 1000);

        const style = document.createElement('style');
        style.innerHTML = `@keyframes ripple-animation { 0% { transform: translate(-50%, -50%) scale(0); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(10); opacity: 0; } }`;
        document.head.appendChild(style);
        setTimeout(() => style.remove(), 1000);
    });
    showNotif('ð±ï¸ Ripple Effect Enabled', '#3498db');
}), 'ð±ï¸');


 // --- 2026 Background Expansion Pack ---

// Starfield Warp
btn(effectsCat, 'â¨ Starfield Warp', requireKey(() => {
    const canvas = document.createElement('canvas');
    canvas.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9998;pointer-events:none;';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    
    let stars = Array(200).fill().map(() => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, z: Math.random() * canvas.width }));
    const draw = () => {
        ctx.fillStyle = 'black'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        stars.forEach(s => {
            s.z -= 10; if (s.z <= 0) s.z = canvas.width;
            let sx = (s.x - canvas.width/2) * (canvas.width/s.z) + canvas.width/2;
            let sy = (s.y - canvas.height/2) * (canvas.width/s.z) + canvas.height/2;
            ctx.beginPath(); ctx.arc(sx, sy, (1 - s.z/canvas.width) * 3, 0, Math.PI*2); ctx.fill();
        });
    };
    const itv = setInterval(draw, 30);
    setTimeout(() => { clearInterval(itv); canvas.remove(); }, 10000);
    showNotif('â¨ Warp Drive Active', '#f1c40f');
}), 'â¨');
 
  
  
  
btn(effectsCat, 'ð¨ Init Visual Breach HUD', requireKey(() => {
    // 1. Setup Canvas HUD
    const canvas = document.createElement('canvas');
    canvas.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9998;pointer-events:none;opacity:0.5;';
    document.body.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Effect Toggle (Choose between Matrix or Grid)
    const activeEffect = Math.random() > 0.5 ? 'MATRIX' : 'GRID';
    showNotif(`ð Loading ${activeEffect} Background...`, '#9b59b6');

    // --- MATRIX LOGIC ---
    const chars = "01".split("");
    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const drops = Array(Math.floor(columns)).fill(1);

    const runMatrix = () => {
        ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#00FF41"; 
        ctx.font = fontSize + "px monospace";
        for (let i = 0; i < drops.length; i++) {
            const text = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);
            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
            drops[i]++;
        }
    };

    // --- CYBER-GRID LOGIC ---
    let gridOffset = 0;
    const runGrid = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#5865F2";
        ctx.lineWidth = 1;
        gridOffset += 2;
        if (gridOffset > 40) gridOffset = 0;
        
        for (let i = gridOffset; i < canvas.width; i += 40) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        }
        for (let i = gridOffset; i < canvas.height; i += 40) {
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
        }
    };

    const fxInterval = setInterval(activeEffect === 'MATRIX' ? runMatrix : runGrid, 35);

    // 10-Second Auto-Expiry
    setTimeout(() => {
        clearInterval(fxInterval);
        canvas.remove();
        showNotif('ð¡ï¸ Background FX Recycled', '#34495e');
    }, 10000);

}), 'ð¨');

btn(effectsCat,'ð Progress Bar',requireKey(async()=>{
    const bars = ['â±â±â±â±â±','â°â±â±â±â±','â°â°â±â±â±','â°â°â°â±â±','â°â°â°â°â±','â°â°â°â°â°'];
    const ch = getTargetChannel();
    const msg = await sendMsg('Loading: '+bars[0]);
    if(!msg) return;
    
    for(let i=1;i<bars.length;i++){
        await sleep(800);
        await editMsg(ch,msg.id,'Loading: '+bars[i]);
    }
    await sleep(500);
    await editMsg(ch,msg.id,'â Complete!');
}),'ð');

btn(effectsCat,'â­ Animated Text',requireKey(async()=>{
    const frames = ['â ','â ','â ¹','â ¸','â ¼','â ´','â ¦','â §','â ','â '];
    const ch = getTargetChannel();
    const msg = await sendMsg(frames[0]+' Loading...');
    if(!msg) return;
    
    for(let i=0;i<20;i++){
        await sleep(200);
        await editMsg(ch,msg.id,frames[i%frames.length]+' Loading...');
    }
}),'â­');

btn(effectsCat,'ðª Glitch Text',requireKey(()=>{
    const glitch = S.spamText.split('').map(c=>c+String.fromCharCode(0x0336+Math.random()*10)).join('');
    sendMsg(glitch);
}),'ðª');
   
/* ---------- 31ï¸â£ Menu Size & Layout ---------- */
const layoutCat = cat('ð Menu Layout');

btn(layoutCat,'Extra Tall Menu',()=>{
    menu.style.maxHeight='95vh';
});
btn(layoutCat,'Normal Height',()=>{
    menu.style.maxHeight='65vh';
    menu.style.width='96vw';
});
btn(layoutCat,'Wide Menu',()=>{
    menu.style.width='96vw';
});
btn(layoutCat,'Normal Width',()=>{
    menu.style.width='90vw';
});
btn(layoutCat,'Center Menu',()=>{
    menu.style.left='2vw';
    menu.style.top='5vh';
});

/* ---------- 32ï¸â£ Font & Text Settings ---------- */
const fontCat = cat('ð¤ Font & Text');

input(fontCat,'Font Size (px)',S.theme.fontSize,v=>{
    S.theme.fontSize=+v; save();
    menu.style.fontSize=v+'px';
});

btn(fontCat,'Small Text',()=>{
    menu.style.fontSize='12px';
});
btn(fontCat,'Normal Text',()=>{
    menu.style.fontSize='14px';
});
btn(fontCat,'Large Text',()=>{
    menu.style.fontSize='16px';
});
  

/* ---------- PREDICTIVE AI ENGINE ---------- */
const predictiveCat = cat('ð® Predictive AI');

const userBehavior = {};

btn(predictiveCat, 'ð§  Start Behavior Learning', requireKey(async() => {
    showNotif('ð§  Learning user patterns...', '#43b581');
    
    for(let rounds = 0; rounds < 10; rounds++) {
        const ch = getTargetChannel();
        if(!ch) { await sleep(5000); continue; }
        
        const msgs = await getChannelMsgs(ch, 50);
        if(!msgs) { await sleep(5000); continue; }
        
        msgs.forEach(msg => {
            if(!userBehavior[msg.author.id]) {
                userBehavior[msg.author.id] = {
                    username: msg.author.username,
                    messageCount: 0,
                    avgLength: 0,
                    totalChars: 0,
                    commonWords: {},
                    commonEmojis: {},
                    hourlyPattern: Array(24).fill(0),
                    responseTime: [],
                    sentimentHistory: []
                };
            }
            
            const user = userBehavior[msg.author.id];
            user.messageCount++;
            user.totalChars += msg.content.length;
            user.avgLength = Math.floor(user.totalChars / user.messageCount);
            
            // Track hourly patterns
            const hour = new Date(msg.timestamp).getHours();
            user.hourlyPattern[hour]++;
            
            // Common words
            msg.content.toLowerCase().split(/\s+/).forEach(word => {
                if(word.length > 3) {
                    user.commonWords[word] = (user.commonWords[word] || 0) + 1;
                }
            });
            
            // Sentiment
            const sentiment = analyzeSentiment(msg.content);
            user.sentimentHistory.push(sentiment.mood);
        });
        
        await sleep(10000);
    }
    
    showNotif('â Learning complete!', '#43b581');
}), 'ð§ ');

btn(predictiveCat, 'ð¯ Predict Next Message', requireKey(() => {
    const ch = getTargetChannel();
    const lastSpeaker = Object.values(userBehavior).sort((a,b) => b.messageCount - a.messageCount)[0];
    
    if(!lastSpeaker) {
        showNotif('â No data learned yet', '#e74c3c');
        return;
    }
    
    const topWords = Object.entries(lastSpeaker.commonWords)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 5)
        .map(e => e[0]);
    
    const prediction = `ð¯ **AI PREDICTION**
User: ${lastSpeaker.username}
Likely to say: ${topWords.join(', ')}
Avg Length: ${lastSpeaker.avgLength} chars
Most Active: ${lastSpeaker.hourlyPattern.indexOf(Math.max(...lastSpeaker.hourlyPattern))}:00
Mood: ${lastSpeaker.sentimentHistory[lastSpeaker.sentimentHistory.length-1] || 'unknown'}`;
    
    sendMsg(prediction);
    showNotif('ð¯ Prediction sent', '#43b581');
}), 'ð¯');

btn(predictiveCat, 'ð Behavior Report', requireKey(() => {
    const users = Object.values(userBehavior).sort((a,b) => b.messageCount - a.messageCount);
    
    console.log('=== BEHAVIOR ANALYSIS ===');
    users.forEach((user, i) => {
        console.log(`\n${i+1}. ${user.username}`);
        console.log(`   Messages: ${user.messageCount}`);
        console.log(`   Avg Length: ${user.avgLength}`);
        console.log(`   Top Words:`, Object.entries(user.commonWords).sort((a,b)=>b[1]-a[1]).slice(0,5));
        console.log(`   Most Active Hour: ${user.hourlyPattern.indexOf(Math.max(...user.hourlyPattern))}:00`);
    });
    
    showNotif('ð Check console', '#43b581');
}), 'ð');
  

 /* ---------- ADVANCED MACROS ---------- */
const macroCat = cat('â¡ Macro Engine');

if(!S.macros) S.macros = {};

btn(macroCat, 'â Create Macro', requireKey(() => {
    const name = prompt('Macro name:', '');
    const commands = prompt('Commands (separated by |):', 'spam|wait 2000|spam');
    
    if(name && commands) {
        S.macros[name] = {
            commands: commands.split('|').map(c => c.trim()),
            created: Date.now(),
            uses: 0
        };
        save();
        showNotif(`â Macro "${name}" created`, '#43b581');
    }
}), 'â');

btn(macroCat, 'â¶ï¸ Run Macro', requireKey(async() => {
    const macroList = Object.keys(S.macros);
    if(macroList.length === 0) {
        showNotif('â No macros created', '#e74c3c');
        return;
    }
    
    const name = prompt('Macro name:\n' + macroList.join('\n'), macroList[0]);
    const macro = S.macros[name];
    
    if(!macro) {
        showNotif('â Macro not found', '#e74c3c');
        return;
    }
    
    showNotif(`â¡ Running macro: ${name}`, '#f1c40f');
    
    for(const cmd of macro.commands) {
        const parts = cmd.split(' ');
        const action = parts[0].toLowerCase();
        
        switch(action) {
            case 'spam':
                await sendMsg(S.spamText);
                break;
            case 'wait':
                await sleep(parseInt(parts[1]) || 1000);
                break;
            case 'say':
                await sendMsg(parts.slice(1).join(' '));
                break;
            case 'react':
                const ch = getTargetChannel();
                const msgs = await getChannelMsgs(ch, 1);
                if(msgs && msgs.length > 0) {
                    await addReaction(ch, msgs[0].id, parts[1] || 'ð');
                }
                break;
            case 'clear':
                const ch2 = getTargetChannel();
                const msgs2 = await getChannelMsgs(ch2, 5);
                const myId = JSON.parse(atob(getToken().split('.')[0])).id;
                for(const msg of msgs2.filter(m => m.author.id === myId)) {
                    await deleteMsg(ch2, msg.id);
                }
                break;
        }
        
        await sleep(500);
    }
    
    macro.uses++;
    save();
    showNotif('â Macro complete!', '#43b581');
}), 'â¶ï¸');

btn(macroCat, 'ð List Macros', requireKey(() => {
    const macros = Object.entries(S.macros);
    if(macros.length === 0) {
        showNotif('â No macros', '#e74c3c');
        return;
    }
    
    console.log('=== MACROS ===');
    macros.forEach(([name, data]) => {
        console.log(`\n${name}:`);
        console.log(`  Commands: ${data.commands.join(' â ')}`);
        console.log(`  Uses: ${data.uses}`);
    });
    showNotif('ð Check console', '#43b581');
}), 'ð');

/* ==================== AI & ANALYTICS MODULE ==================== */
/* PASTE THIS AFTER THE CONFIG SECTION */
  /* ==================== GOD MODE FEATURES (ULTRA OP) ==================== */
/* PASTE THIS AFTER PART 5 (Ultimate Commands Module) */

/* ---------- AUTO SNIPER ---------- */
const sniperCat = cat('ð¯ Auto Sniper Engine');

let sniperActive = false;
let sniperTargets = new Set();

btn(sniperCat, 'ð¯ Add Snipe Target', requireKey(() => {
    const userId = prompt('User ID to snipe:', '');
    if(userId) {
        sniperTargets.add(userId.trim());
        showNotif(`ð¯ Target added: ${userId}`, '#43b581');
    }
}), 'ð¯');

btn(sniperCat, 'ð« Activate Auto-Sniper', requireKey(async() => {
    if(sniperTargets.size === 0) {
        showNotif('â No targets set', '#e74c3c');
        return;
    }
    
    sniperActive = true;
    showNotif('ð« AUTO-SNIPER ACTIVE', '#43b581');
    
    let lastChecked = new Set();
    
    while(sniperActive && S.timerUnlocked) {
        const ch = getTargetChannel();
        if(!ch) { await sleep(1000); continue; }
        
        const msgs = await getChannelMsgs(ch, 10);
        if(!msgs) { await sleep(1000); continue; }
        
        for(const msg of msgs) {
            if(lastChecked.has(msg.id)) continue;
            lastChecked.add(msg.id);
            
            if(sniperTargets.has(msg.author.id)) {
                // Instant snipe response
                await sleep(500);
                await sendMsg(`ð¯ *SNIPED* @${msg.author.username}: "${msg.content}"`);
                break;
            }
        }
        
        // Cleanup old IDs
        if(lastChecked.size > 100) {
            lastChecked = new Set([...lastChecked].slice(-50));
        }
        
        await sleep(1000);
    }
}), 'ð«');

btn(sniperCat, 'ð List Targets', requireKey(() => {
    if(sniperTargets.size === 0) {
        showNotif('â No targets', '#e74c3c');
        return;
    }
    
    console.log('=== SNIPER TARGETS ===');
    [...sniperTargets].forEach((id, i) => {
        console.log(`${i+1}. ${id}`);
    });
    showNotif('ð Check console', '#43b581');
}), 'ð');

btn(sniperCat, 'â¹ï¸ Deactivate Sniper', requireKey(() => {
    sniperActive = false;
    showNotif('â¹ï¸ Sniper deactivated', '#e74c3c');
}), 'â¹ï¸');

/* ---------- CONVERSATION HIJACKER ---------- */
const hijackCat = cat('ð Conversation Hijacker');

let hijackActive = false;

btn(hijackCat, 'ð Auto-Hijack Mode', requireKey(async() => {
    hijackActive = true;
    showNotif('ð HIJACK MODE ACTIVE', '#43b581');
    
    const hijackResponses = [
        'Actually, let me add to that...',
        'That reminds me...',
        'Speaking of which...',
        'On that note...',
        'Funny you mention that...',
        'Wait, but also...',
        'Oh! And another thing...',
        'That\'s interesting, because...'
    ];
    
    let lastMsgId = null;
    
    while(hijackActive && S.timerUnlocked) {
        const ch = getTargetChannel();
        if(!ch) { await sleep(3000); continue; }
        
        const msgs = await getChannelMsgs(ch, 5);
        if(!msgs || msgs.length === 0) { await sleep(3000); continue; }
        
        const latest = msgs[0];
        const myId = JSON.parse(atob(getToken().split('.')[0])).id;
        
        if(latest.id !== lastMsgId && latest.author.id !== myId) {
            lastMsgId = latest.id;
            
            // Random chance to hijack
            if(Math.random() > 0.3) {
                await sleep(2000 + Math.random() * 3000);
                const response = hijackResponses[Math.floor(Math.random() * hijackResponses.length)];
                await sendMsg(response);
            }
        }
        
        await sleep(5000);
    }
}), 'ð');

btn(hijackCat, 'â¹ï¸ Stop Hijacking', requireKey(() => {
    hijackActive = false;
    showNotif('â¹ï¸ Hijacking stopped', '#e74c3c');
}), 'â¹ï¸');

/* ---------- REACTION WARFARE ---------- */
const reactionWarCat = cat('ð¥ Reaction Warfare');

btn(reactionWarCat, 'ð£ Reaction Nuke', requireKey(async() => {
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch, 30);
    if(!msgs) return;
    
    const nukeEmojis = ['ð£', 'ð¥', 'ð¥', 'â¡', 'ð', 'â ï¸', 'ð¢', 'ð«', 'â¨', 'ð', 'ð', 'ð'];
    
    showNotif('ð£ REACTION NUKE INCOMING...', '#f1c40f');
    
    for(const msg of msgs) {
        const randomEmojis = [];
        for(let i = 0; i < 6; i++) {
            randomEmojis.push(nukeEmojis[Math.floor(Math.random() * nukeEmojis.length)]);
        }
        
        for(const emoji of randomEmojis) {
            await addReaction(ch, msg.id, emoji);
            await sleep(100);
        }
    }
    
    showNotif('ð¥ NUKE COMPLETE!', '#43b581');
}), 'ð£');

btn(reactionWarCat, 'ð Reaction Wave', requireKey(async() => {
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch, 20);
    if(!msgs) return;
    
    const wave = ['1ï¸â£', '2ï¸â£', '3ï¸â£', '4ï¸â£', '5ï¸â£', '6ï¸â£', '7ï¸â£', '8ï¸â£', '9ï¸â£', 'ð'];
    
    showNotif('ð Reaction wave starting...', '#f1c40f');
    
    for(let i = 0; i < msgs.length && i < wave.length; i++) {
        await addReaction(ch, msgs[i].id, wave[i]);
        await sleep(200);
    }
    
    showNotif('ð Wave complete!', '#43b581');
}), 'ð');

btn(reactionWarCat, 'ð¨ Reaction Art', requireKey(async() => {
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch, 10);
    if(!msgs) return;
    
    const patterns = [
        ['â¤ï¸', 'ð§¡', 'ð', 'ð', 'ð', 'ð'],
        ['ð´', 'ð ', 'ð¡', 'ð¢', 'ðµ', 'ð£'],
        ['â­', 'â¨', 'ð«', 'ð', 'ð¥', 'â¡'],
        ['ð', 'ð¦', 'ð', 'ð', 'ð¥', 'ð¯']
    ];
    
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    
    for(let i = 0; i < msgs.length && i < pattern.length; i++) {
        await addReaction(ch, msgs[i].id, pattern[i]);
        await sleep(300);
    }
    
    showNotif('ð¨ Art created!', '#43b581');
}), 'ð¨');

/* ---------- ADVANCED AUTO MODERATION ---------- */
const autoModCat = cat('ð¡ï¸ Auto-Mod Suite');

let autoModActive = false;
const autoModRules = {
    deleteLinks: false,
    deleteCaps: false,
    deleteSpam: false,
    warnUsers: false
};

btn(autoModCat, 'âï¸ Configure Rules', requireKey(() => {
    autoModRules.deleteLinks = confirm('Delete messages with links?');
    autoModRules.deleteCaps = confirm('Delete ALL CAPS messages?');
    autoModRules.deleteSpam = confirm('Delete repeated messages?');
    autoModRules.warnUsers = confirm('Send warning messages?');
    
    showNotif('âï¸ Rules configured', '#43b581');
}), 'âï¸');

btn(autoModCat, 'ð¡ï¸ Activate Auto-Mod', requireKey(async() => {
    autoModActive = true;
    showNotif('ð¡ï¸ AUTO-MOD ACTIVE', '#43b581');
    
    const recentMessages = new Map();
    
    while(autoModActive && S.timerUnlocked) {
        const ch = getTargetChannel();
        if(!ch) { await sleep(2000); continue; }
        
        const msgs = await getChannelMsgs(ch, 10);
        if(!msgs) { await sleep(2000); continue; }
        
        const myId = JSON.parse(atob(getToken().split('.')[0])).id;
        
        for(const msg of msgs) {
            if(msg.author.id === myId) continue;
            
            let shouldDelete = false;
            let reason = '';
            
            // Check for links
            if(autoModRules.deleteLinks && (msg.content.includes('http://') || msg.content.includes('https://'))) {
                shouldDelete = true;
                reason = 'links detected';
            }
            
            // Check for caps
            if(autoModRules.deleteCaps) {
                const capsRatio = (msg.content.match(/[A-Z]/g) || []).length / msg.content.length;
                if(capsRatio > 0.7 && msg.content.length > 10) {
                    shouldDelete = true;
                    reason = 'excessive caps';
                }
            }
            
            // Check for spam
            if(autoModRules.deleteSpam) {
                const userMsgs = recentMessages.get(msg.author.id) || [];
                userMsgs.push({ content: msg.content, time: Date.now() });
                
                const recent = userMsgs.filter(m => Date.now() - m.time < 10000);
                const duplicates = recent.filter(m => m.content === msg.content).length;
                
                if(duplicates >= 3) {
                    shouldDelete = true;
                    reason = 'spam detected';
                }
                
                recentMessages.set(msg.author.id, recent);
            }
            
            if(shouldDelete) {
                if(autoModRules.warnUsers) {
                    await sendMsg(`â ï¸ <@${msg.author.id}>: Message removed (${reason})`);
                }
                // Note: Can't delete other users' messages, only react
                await addReaction(ch, msg.id, 'â ï¸');
            }
        }
        
        await sleep(3000);
    }
}), 'ð¡ï¸');

btn(autoModCat, 'â¹ï¸ Deactivate Auto-Mod', requireKey(() => {
    autoModActive = false;
    showNotif('â¹ï¸ Auto-mod deactivated', '#e74c3c');
}), 'â¹ï¸');

/* ---------- SMART MESSAGE QUEUE ---------- */
const queueCat = cat('ð¬ Message Queue Pro');

if(!S.messageQueue) S.messageQueue = [];
let queueRunning = false;

btn(queueCat, 'â Add to Queue', requireKey(() => {
    const message = prompt('Message to queue:', S.customText || '');
    const delay = parseInt(prompt('Delay before sending (seconds):', '10'));
    
    if(message) {
        S.messageQueue.push({
            message,
            delay: delay * 1000,
            created: Date.now(),
            id: Date.now().toString()
        });
        save();
        showNotif(`â Queued (${S.messageQueue.length} total)`, '#43b581');
    }
}), 'â');

btn(queueCat, 'â¶ï¸ Start Queue', requireKey(async() => {
    if(S.messageQueue.length === 0) {
        showNotif('â Queue is empty', '#e74c3c');
        return;
    }
    
    queueRunning = true;
    showNotif('â¶ï¸ Processing queue...', '#43b581');
    
    while(S.messageQueue.length > 0 && queueRunning && S.timerUnlocked) {
        const item = S.messageQueue.shift();
        await sleep(item.delay);
        await sendMsg(item.message);
        save();
    }
    
    queueRunning = false;
    showNotif('â Queue complete!', '#43b581');
}), 'â¶ï¸');

btn(queueCat, 'ð View Queue', requireKey(() => {
    if(S.messageQueue.length === 0) {
        showNotif('â Queue is empty', '#e74c3c');
        return;
    }
    
    console.log('=== MESSAGE QUEUE ===');
    S.messageQueue.forEach((item, i) => {
        console.log(`${i+1}. [${item.delay/1000}s] ${item.message.substring(0, 50)}`);
    });
    showNotif('ð Check console', '#43b581');
}), 'ð');

btn(queueCat, 'ðï¸ Clear Queue', requireKey(() => {
    if(confirm('Clear entire queue?')) {
        S.messageQueue = [];
        save();
        showNotif('ðï¸ Queue cleared', '#43b581');
    }
}), 'ðï¸');

/* ---------- ULTIMATE COMBO ATTACKS ---------- */
const comboCat = cat('âï¸ Combo Attacks');

btn(comboCat, 'ð Death Combo', requireKey(async() => {
    if(!confirm('DEATH COMBO: Mass spam + reactions + chaos. Continue?')) return;
    
    const ch = getTargetChannel();
    showNotif('ð DEATH COMBO INITIATED', '#e74c3c');
    
    // Phase 1: Warning
    await sendMsg('â ï¸ âââââââââââââââââââââââ â ï¸');
    await sendMsg('ð DEATH COMBO ACTIVATED ð');
    await sendMsg('â ï¸ âââââââââââââââââââââââ â ï¸');
    await sleep(2000);
    
    // Phase 2: Countdown
    for(let i = 5; i > 0; i--) {
        await sendMsg(`â° ${i}...`);
        await sleep(1000);
    }
    
    // Phase 3: Chaos spam
    const chaosMessages = [
        'ð CHAOS UNLEASHED ð',
        'ð¥ UNSTOPPABLE FORCE ð¥',
        'â¡ MAXIMUM POWER â¡',
        'ð¥ TOTAL DESTRUCTION ð¥'
    ];
    
    for(let i = 0; i < 20; i++) {
        await sendMsg(chaosMessages[i % chaosMessages.length]);
        await sleep(400);
    }
    
    // Phase 4: Reaction storm
    const msgs = await getChannelMsgs(ch, 25);
    if(msgs) {
        const emojis = ['ð', 'ð¥', 'ð¥', 'â¡', 'ð£'];
        for(const msg of msgs) {
            for(const emoji of emojis) {
                await addReaction(ch, msg.id, emoji);
            }
        }
    }
    
    // Phase 5: Victory
    await sendMsg('âââââââââââââââââââââââââââ');
    await sendMsg('â DEATH COMBO COMPLETE â');
    await sendMsg('âââââââââââââââââââââââââââ');
    
    showNotif('ð COMBO COMPLETE', '#43b581');
}), 'ð');

btn(comboCat, 'ðªï¸ Tornado Combo', requireKey(async() => {
    showNotif('ðªï¸ TORNADO COMBO STARTING', '#f1c40f');
    
    const tornado = [
        'ããããããðªï¸',
        'ãããããðªï¸ã',
        'ããããðªï¸ãã',
        'ãããðªï¸ããã',
        'ããðªï¸ãããã',
        'ãðªï¸ããããã',
        'ðªï¸ãããããã'
    ];
    
    // Spiral effect
    for(let round = 0; round < 3; round++) {
        for(const line of tornado) {
            await sendMsg(line);
            await sleep(300);
        }
        for(let i = tornado.length - 2; i > 0; i--) {
            await sendMsg(tornado[i]);
            await sleep(300);
        }
    }
    
    await sendMsg('ð¨ TORNADO COMPLETE! ð¨');
    showNotif('ðªï¸ Combo complete!', '#43b581');
}), 'ðªï¸');

btn(comboCat, 'ð Fireworks Combo', requireKey(async() => {
    showNotif('ð FIREWORKS STARTING', '#f1c40f');
    
    const fireworks = [
        'ããããâ¨',
        'ãããâ¨ð¥â¨',
        'ããâ¨ð¥ðð¥â¨',
        'ãâ¨ð¥ðððð¥â¨',
        'â¨ð¥ððð«ððð¥â¨'
    ];
    
    for(const fw of fireworks) {
        await sendMsg(fw);
        await sleep(500);
    }
    
    await sendMsg('ð FINALE! ð');
    
    for(let i = 0; i < 10; i++) {
        await sendMsg('ðð¥â¨ðð«â­ðð');
        await sleep(400);
    }
    
    showNotif('ð Fireworks complete!', '#43b581');
}), 'ð');

/* ---------- PERSISTENCE & RECOVERY ---------- */
const persistCat = cat('ð¾ Persistence System');

btn(persistCat, 'ð Auto-Restart on Error', requireKey(() => {
    window.addEventListener('error', (e) => {
        console.error('Script error detected:', e);
        showNotif('â ï¸ Error detected - Auto-recovering...', '#f1c40f');
        setTimeout(() => {
            location.reload();
        }, 2000);
    });
    
    showNotif('ð Auto-restart enabled', '#43b581');
}), 'ð');

btn(persistCat, 'â° Keepalive Monitor', requireKey(() => {
    setInterval(() => {
        if(S.timerUnlocked) {
            console.log('ð Keepalive pulse:', new Date().toLocaleTimeString());
        }
    }, 60000);
    
    showNotif('â° Keepalive active', '#43b581');
}), 'â°');

btn(persistCat, 'ð Full System Status', requireKey(async() => {
    const status = `ð¯ **SYSTEM STATUS REPORT**

ð **Statistics**
â¢ Messages sent: ${S.analytics.messages || 0}
â¢ Reactions added: ${S.analytics.reactions || 0}
â¢ Uptime: ${Math.floor((S.analytics.uptime || 0) / 60)} min

ð¤ **Active Systems**
â¢ Smart AI: ${smartAIActive ? 'ð¢' : 'ð´'}
â¢ Auto-Mod: ${autoModActive ? 'ð¢' : 'ð´'}
â¢ Sniper: ${sniperActive ? 'ð¢' : 'ð´'}
â¢ Hijacker: ${hijackActive ? 'ð¢' : 'ð´'}

ð¾ **Saved Data**
â¢ Templates: ${Object.keys(S.templates || {}).length}
â¢ Macros: ${Object.keys(S.macros || {}).length}
â¢ Commands: ${Object.keys(S.customCommands || {}).length}
â¢ Webhooks: ${S.webhooks?.length || 0}
â¢ Queue: ${S.messageQueue?.length || 0}

ð **License**
â¢ Status: ${S.timerUnlocked ? 'â Active' : 'â Inactive'}
â¢ Key: ${S.userKey ? 'â Set' : 'â Not Set'}

ââââââââââââââââââââââ
â¡ ALL SYSTEMS OPERATIONAL`;

    await sendMsg(status);
    showNotif('ð Status sent!', '#43b581');
}), 'ð');

/* ---------- EXPERIMENTAL FEATURES ---------- */
const experimentalCat = cat('ð§ª Experimental Zone');

btn(experimentalCat, 'ð² Chaos Mode', requireKey(async() => {
    if(!confirm('CHAOS MODE: Random unpredictable actions. Continue?')) return;
    
    const chaosDuration = 30000; // 30 seconds
    const end = Date.now() + chaosDuration;
    
    showNotif('ð² CHAOS MODE ACTIVATED', '#e74c3c');
    
    const chaosActions = [
        async() => await sendMsg('ð² CHAOS!'),
        async() => await sendMsg(Math.random().toString(36).substring(7).toUpperCase()),
        async() => {
            const ch = getTargetChannel();
            const msgs = await getChannelMsgs(ch, 5);
            if(msgs && msgs.length > 0) {
                const emojis = ['ð²', 'ð¯', 'ð¥', 'ð', 'â¡'];
                await addReaction(ch, msgs[0].id, emojis[Math.floor(Math.random() * emojis.length)]);
            }
        },
        async() => await sendMsg('Â¿ÊÉÉ¥Ê'),
        async() => await sendMsg('CÌ´Ì¢Ì§Ì³ÌÌ©Ì®ÍÌ¯ÍÌ¯ÍÌÌ»Ì«ÌÌÌÌÌÌÌÌÌÍÍHÌ´Ì¨Ì§ÌÌÌºÍÌ¯ÍÍÌ¼ÌºÌÌ«Ì¦Ì£ÌÍÌ¿ÌÌÌÌÍÍÄÌ¸Ì¡Ì§Ì®Ì»Ì»Ì®Ì­Ì­Ì¦ÌÌ¼ÌÌÍÌÌÌ¿ÍÌÌÍÇªÌ¸Ì§ÌÌÍÌÌÍÌÌ¹Ì«ÌªÌ±ÌÌÌÌ½ÌÌÌÌÍÌÌÌÍÅÌ´Ì§Ì¢ÌªÌ¦ÌÌ¹ÍÌ®Ì¥ÍÌ£ÌÌÍ')
    ];
    
    while(Date.now() < end && S.timerUnlocked) {
        const action = chaosActions[Math.floor(Math.random() * chaosActions.length)];
        await action();
        await sleep(Math.random() * 3000 + 1000);
    }
    
    await sendMsg('â Chaos subsided...');
    showNotif('ð² Chaos mode ended', '#43b581');
}), 'ð²');

/* ==================== ULTIMATE ADVANCED COMMANDS MODULE ==================== */
/* PASTE THIS AFTER PART 3 (Premium Features Module) */

/* ---------- GHOST MODE & STEALTH ---------- */
const ghostCat = cat('ð» Ghost Mode & Stealth');

let ghostModeActive = false;
let originalStatus = null;

btn(ghostCat, 'ð» Enable Ghost Mode', requireKey(async() => {
    ghostModeActive = true;
    // Set status to invisible
    await apiRequest('PATCH', '/users/@me/settings', {
        status: 'invisible',
        custom_status: null
    });
    showNotif('ð» Ghost mode: INVISIBLE', '#9b59b6');
}), 'ð»');

btn(ghostCat, 'ð¥ Mass Ghost Ping', requireKey(async() => {
    const userIds = prompt('User IDs (comma separated):', '').split(',');
    const count = parseInt(prompt('How many ghost pings?', '5'));
    
    for(let i = 0; i < count; i++) {
        const mentions = userIds.map(id => `<@${id.trim()}>`).join(' ');
        const ch = getTargetChannel();
        const msg = await sendMsg(mentions);
        if(msg) {
            await sleep(100);
            await deleteMsg(ch, msg.id);
        }
        await sleep(800);
    }
    showNotif('ð¥ Ghost ping wave complete', '#43b581');
}), 'ð¥');

btn(ghostCat, 'ð¨ Phantom Message', requireKey(async() => {
    const text = prompt('Phantom message:', 'You\'ll never see this...');
    const seconds = parseInt(prompt('Auto-delete after (seconds):', '3'));
    
    const ch = getTargetChannel();
    const msg = await sendMsg(text);
    
    if(msg) {
        setTimeout(async() => {
            await deleteMsg(ch, msg.id);
            showNotif('ð¨ Phantom vanished', '#9b59b6');
        }, seconds * 1000);
    }
}), 'ð¨');

btn(ghostCat, 'ð­ Fake Typing Forever', requireKey(async() => {
    const duration = parseInt(prompt('Duration (seconds):', '30'));
    const ch = getTargetChannel();
    const end = Date.now() + (duration * 1000);
    
    showNotif('ð­ Fake typing started...', '#43b581');
    
    while(Date.now() < end && S.timerUnlocked) {
        await startTyping(ch);
        await sleep(8000);
    }
    
    showNotif('ð­ Fake typing ended', '#e74c3c');
}), 'ð­');

btn(ghostCat, 'ð«ï¸ Silent Lurk Mode', requireKey(async() => {
    await apiRequest('PATCH', '/users/@me/settings', {
        status: 'invisible',
        show_current_game: false
    });
    showNotif('ð«ï¸ Silent lurk: ACTIVE', '#9b59b6');
}), 'ð«ï¸');

/* ---------- ADVANCED RAID & CHAOS ---------- */
const raidProCat = cat('ð Advanced Raid Tools');

btn(raidProCat, 'ð£ Emoji Bomb Raid', requireKey(async() => {
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch, 20);
    if(!msgs) return;
    
    const emojis = ['ð£', 'ð¥', 'ð¥', 'â¡', 'ð', 'ð»', 'ð', 'ð', 'â¨', 'ð«', 'ð', 'ð®'];
    
    showNotif('ð£ Emoji bombing...', '#f1c40f');
    
    for(const msg of msgs.slice(0, 10)) {
        for(const emoji of emojis) {
            await addReaction(ch, msg.id, emoji);
            await sleep(150);
        }
    }
    
    showNotif('ð¥ Emoji bomb complete!', '#43b581');
}), 'ð£');

btn(raidProCat, 'ð Message Tsunami', requireKey(async() => {
    const waves = parseInt(prompt('Number of waves:', '5'));
    const msgsPerWave = parseInt(prompt('Messages per wave:', '10'));
    const text = prompt('Wave text:', 'ð TSUNAMI ð');
    
    showNotif('ð Tsunami starting...', '#f1c40f');
    
    for(let w = 0; w < waves; w++) {
        for(let i = 0; i < msgsPerWave; i++) {
            await sendMsg(`${text} [Wave ${w+1}/${waves}]`);
            await sleep(300);
        }
        await sleep(2000); // Pause between waves
    }
    
    showNotif('ð Tsunami complete!', '#43b581');
}), 'ð');

btn(raidProCat, 'ð¯ Snipe & Mirror', requireKey(async() => {
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch, 50);
    if(!msgs) return;
    
    const myId = JSON.parse(atob(getToken().split('.')[0])).id;
    const targetMsgs = msgs.filter(m => m.author.id !== myId).slice(0, 10);
    
    showNotif('ð¯ Sniping & mirroring...', '#f1c40f');
    
    for(const msg of targetMsgs.reverse()) {
        await sendMsg(`ð¯ ${msg.author.username}: ${msg.content}`);
        await sleep(1500);
    }
    
    showNotif('â Mirror complete!', '#43b581');
}), 'ð¯');

btn(raidProCat, 'ð Loop Spam Attack', requireKey(async() => {
    const text = prompt('Loop message:', 'SPAM');
    const loops = parseInt(prompt('Number of loops:', '20'));
    const delay = parseInt(prompt('Delay (ms):', '500'));
    
    let count = 0;
    showNotif('ð Loop spam started...', '#f1c40f');
    
    while(count < loops && S.timerUnlocked) {
        await sendMsg(`${text} [${count+1}/${loops}]`);
        count++;
        await sleep(delay);
    }
    
    showNotif('â Loop complete!', '#43b581');
}), 'ð');

btn(raidProCat, 'ð Annihilation Mode', requireKey(async() => {
    if(!confirm('ANNIHILATION MODE: Mass spam + reactions + chaos. Continue?')) return;
    
    const ch = getTargetChannel();
    showNotif('ð ANNIHILATION ACTIVE', '#e74c3c');
    
    // Phase 1: Mass spam
    for(let i = 0; i < 15; i++) {
        await sendMsg('ð ANNIHILATION ð');
        await sleep(200);
    }
    
    // Phase 2: Mass reactions
    const msgs = await getChannelMsgs(ch, 15);
    if(msgs) {
        const emojis = ['ð', 'ð¥', 'ð¥', 'â¡'];
        for(const msg of msgs) {
            for(const emoji of emojis) {
                await addReaction(ch, msg.id, emoji);
            }
        }
    }
    
    // Phase 3: Spam wave
    for(let i = 0; i < 10; i++) {
        await sendMsg('â ï¸ CHAOS UNLEASHED â ï¸');
        await sleep(300);
    }
    
    showNotif('ð ANNIHILATION COMPLETE', '#43b581');
}), 'ð');

/* ---------- ADVANCED MESSAGE MANIPULATION ---------- */
const manipulateCat = cat('ð¨ Message Manipulation Pro');

btn(manipulateCat, 'ð Rainbow Text Spam', requireKey(async() => {
    const text = prompt('Rainbow text:', 'RAINBOW');
    const count = parseInt(prompt('How many?', '15'));
    
    const rainbowEffects = [
        'ð´', 'ð ', 'ð¡', 'ð¢', 'ðµ', 'ð£', 'ð¤', 'â«', 'âª'
    ];
    
    for(let i = 0; i < count; i++) {
        const effect = rainbowEffects[i % rainbowEffects.length];
        await sendMsg(`${effect} ${text} ${effect}`);
        await sleep(600);
    }
    
    showNotif('ð Rainbow complete!', '#43b581');
}), 'ð');

btn(manipulateCat, 'ð­ Character Glitch', requireKey(async() => {
    const text = prompt('Text to glitch:', 'GLITCH');
    
    const glitchChars = ['Ì¸', 'Ìµ', 'Ì¶', 'Ì·', 'Ì´', 'Ì¢', 'Ì¡', 'Ì§', 'Ì¨', 'Í ', 'Ò'];
    let glitched = '';
    
    for(let char of text) {
        glitched += char;
        for(let i = 0; i < 3; i++) {
            glitched += glitchChars[Math.floor(Math.random() * glitchChars.length)];
        }
    }
    
    await sendMsg(glitched);
    showNotif('ð­ Glitched!', '#43b581');
}), 'ð­');

btn(manipulateCat, 'ð Scroll Bomb', requireKey(async() => {
    const lines = parseInt(prompt('Number of lines:', '30'));
    
    let scroll = '';
    for(let i = 0; i < lines; i++) {
        scroll += 'â¬ï¸ SCROLL â¬ï¸\n';
    }
    scroll += 'ð¯ YOU MADE IT!';
    
    await sendMsg(scroll);
    showNotif('ð Scroll bomb sent!', '#43b581');
}), 'ð');

btn(manipulateCat, 'ð® Unicode Art Spam', requireKey(async() => {
    const arts = [
        'âââââââ â¡ âââââââ',
        'ââââ*.Â·:Â·.â½â§    â¦    â§â¾.Â·:Â·.*ââââ',
        'ââââââââââ STYLE ââââââââââ',
        'â§ï½¥ï¾: *â§ï½¥ï¾:* AESTHETIC *:ï½¥ï¾â§*:ï½¥ï¾â§',
        'âÂ·.Â·Â´Â¯`Â·.Â·â STAR âÂ·.Â·Â´Â¯`Â·.Â·â',
        'à¹Ûà¹,Â¸Â¸,Ã¸Â¤ÂºÂ°`Â°à¹Û© FANCY à¹Û© ,Â¸Â¸,Ã¸Â¤ÂºÂ°`Â°à¹Ûà¹',
        'â â â â â â â BARS â â â â â â â'
    ];
    
    for(const art of arts) {
        await sendMsg(art);
        await sleep(800);
    }
    
    showNotif('ð® Unicode art complete!', '#43b581');
}), 'ð®');

btn(manipulateCat, 'â¡ Power User Flex', requireKey(async() => {
    const stats = `
ââââââââââââââââââââââââââââ
â   ð POWER USER STATS    â
â âââââââââââââââââââââââââââ£
â ð¨ Messages: ${S.analytics.messages || 0}        â
â ð Reactions: ${S.analytics.reactions || 0}       â
â â¡ Commands: ${Object.values(S.customCommands || {}).reduce((s,c)=>s+(c.uses||0),0)}          â
â ð¯ Macros: ${Object.keys(S.macros || {}).length}             â
â ð¤ AI Active: YES        â
â ð¥ Status: PREMIUM       â
ââââââââââââââââââââââââââââ
`;
    
    await sendMsg(stats);
    showNotif('â¡ Flexed!', '#43b581');
}), 'â¡');

/* ---------- CHANNEL DOMINATION ---------- */
const dominationCat = cat('ð Channel Domination');

btn(dominationCat, 'ðª Takeover Mode', requireKey(async() => {
    if(!confirm('TAKEOVER MODE: Spam + reactions + presence. Continue?')) return;
    
    const ch = getTargetChannel();
    showNotif('ðª TAKEOVER INITIATED', '#f1c40f');
    
    // Phase 1: Announcement
    await sendMsg('ðª âââââââââââââââââââââââââââ ðª');
    await sleep(500);
    await sendMsg('ð CHANNEL TAKEOVER IN PROGRESS ð');
    await sleep(500);
    await sendMsg('ðª âââââââââââââââââââââââââââ ðª');
    await sleep(1000);
    
    // Phase 2: Presence spam
    for(let i = 10; i > 0; i--) {
        await sendMsg(`â° Takeover in ${i}...`);
        await sleep(800);
    }
    
    // Phase 3: Mass spam
    for(let i = 0; i < 20; i++) {
        await sendMsg('ð DOMINATED ð');
        await sleep(400);
    }
    
    // Phase 4: Victory
    await sendMsg('ð âââââââââââââââââââââââââââ ð');
    await sendMsg('â CHANNEL SUCCESSFULLY DOMINATED â');
    await sendMsg('ð âââââââââââââââââââââââââââ ð');
    
    showNotif('ð Takeover complete!', '#43b581');
}), 'ðª');

btn(dominationCat, 'ð¥ Attention Stealer', requireKey(async() => {
    const duration = parseInt(prompt('Duration (seconds):', '30'));
    const end = Date.now() + (duration * 1000);
    
    const attentionMsgs = [
        'ð¥ LOOK HERE ð¥',
        'â¡ IMPORTANT â¡',
        'ð¨ ALERT ð¨',
        'ð EXCLUSIVE ð',
        'ð¯ MUST SEE ð¯'
    ];
    
    showNotif('ð¥ Stealing attention...', '#f1c40f');
    let i = 0;
    
    while(Date.now() < end && S.timerUnlocked) {
        await sendMsg(attentionMsgs[i % attentionMsgs.length]);
        i++;
        await sleep(3000);
    }
    
    showNotif('ð¥ Attention campaign ended', '#43b581');
}), 'ð¥');

btn(dominationCat, 'ð¯ Message Highlighter', requireKey(async() => {
    const text = prompt('Message to highlight:', 'IMPORTANT');
    const style = parseInt(prompt('Style (1-5):\n1. Stars\n2. Boxes\n3. Arrows\n4. Fire\n5. Crown', '1'));
    
    const styles = {
        1: `â­ ${text} â­`,
        2: `ââââââââââââ\n  ${text}\nââââââââââââ`,
        3: `â¤â¤â¤ ${text} â¤â¤â¤`,
        4: `ð¥ð¥ð¥ ${text} ð¥ð¥ð¥`,
        5: `ð ${text} ð`
    };
    
    await sendMsg(styles[style] || styles[1]);
    showNotif('ð¯ Message highlighted!', '#43b581');
}), 'ð¯');

/* ---------- ADVANCED TROLLING ---------- */
const trollProCat = cat('ð Advanced Trolling');
  
btn(trollProCat, 'ð¼ï¸ Subliminal GIF', requireKey(() => {
    const secretMsg = prompt("Enter hidden message (revealed on copy):", "I'm watching you...");
    const gifUrl = "tenor.com"; 
    const modifiedLink = `${gifUrl}?comment=${encodeURIComponent(secretMsg)}`;
    
    sendMsg(getCurrentChannelId(), modifiedLink);
    showNotif('ð¼ï¸ Subliminal GIF sent to channel!', '#9b59b6');
}), 'ð¼ï¸');

btn(trollProCat, 'ð² Random Chaos', requireKey(async() => {
    const chaosMoves = [
        async() => {
            await sendMsg('ð² RANDOM CHAOS ACTIVATED');
        },
        async() => {
            const ch = getTargetChannel();
            const msgs = await getChannelMsgs(ch, 1);
            if(msgs && msgs.length > 0) {
                await addReaction(ch, msgs[0].id, 'ð²');
            }
        },
        async() => {
            await sendMsg('Did someone say chaos? ð');
        },
        async() => {
            const ch = getTargetChannel();
            await startTyping(ch);
            await sleep(5000);
        },
        async() => {
            await sendMsg('ð Reality distortion field active ð');
        }
    ];
    
    const move = chaosMoves[Math.floor(Math.random() * chaosMoves.length)];
    await move();
    showNotif('ð² Chaos executed!', '#43b581');
}), 'ð²');

btn(trollProCat, 'â ï¸ Fake System Modal', requireKey(() => {
    const modal = document.createElement('div');
    modal.style = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10000;background:#313338;padding:25px;border-radius:10px;text-align:center;box-shadow:0 0 100px black;';
    modal.innerHTML = `
        <h2 style="color:white;margin-bottom:10px;">Security Sync Required</h2>
        <p style="color:#b5bac1;">Your 2026 DAVE Encryption key is out of sync. Please re-validate.</p>
        <button id="fake-sync-btn" style="margin-top:20px;background:#5865F2;color:white;padding:10px 20px;border:none;border-radius:5px;cursor:pointer;">VALIDATE NOW</button>
    `;
    document.body.appendChild(modal);
    document.getElementById('fake-sync-btn').onclick = () => {
        modal.remove();
        showNotif('ð¡ï¸ User fell for the validation trap!', '#2ecc71');
    };
}), 'â ï¸');
  

btn(trollProCat, 'ð DAVE Decryptor HUD', requireKey(() => {
    const canvas = document.createElement('canvas');
    canvas.style = 'position:fixed;top:10px;right:10px;width:250px;height:150px;z-index:10000;background:rgba(0,0,0,0.8);border:1px solid #5865F2;border-radius:8px;';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    
    let progress = 0;
    const interval = setInterval(() => {
        ctx.clearRect(0,0,250,150);
        ctx.fillStyle = '#5865F2';
        ctx.font = '12px monospace';
        ctx.fillText(`DECRYPTING DAVE VOICE PACKET...`, 10, 25);
        ctx.fillText(`TARGET: [ENCRYPTED_USER]`, 10, 45);
        ctx.fillRect(10, 60, progress, 15);
        progress += 1.5;
        if(progress > 230) progress = 0;
    }, 50).onTimeout(() => { clearInterval(interval); canvas.remove(); }, 10000);

    showNotif('ð Decryption HUD overlay active', '#5865F2');
}), 'ð');



btn(trollProCat, 'ð Real-time Audit Breach', requireKey(() => {
    const logs = ["FETCHING_IP...", "BYPASSING_2FA...", "ENCRYPTING_SOCKET...", "DOOR_OPEN_CMD_SENT"];
    let i = 0;
    const loop = setInterval(() => {
        showNotif(`[LOG]: ${logs[i % logs.length]}`, '#f1c40f');
        i++;
    }, 800);
    
    setTimeout(() => clearInterval(loop), 10000);
}), 'ð');


btn(trollProCat, 'ð¥ Reaction Flash-Bang', requireKey(() => {
    const token = getTokenFromWebpack();
    const channelId = getCurrentChannelId();
    showNotif('ð¥ Flashing recent messages...', '#e91e63');

    // Fetch last 5 messages and toggle an emoji
    fetch(`discord.com{channelId}/messages?limit=5`, {
        headers: { "Authorization": token }
    }).then(r => r.json()).then(msgs => {
        msgs.forEach(m => {
            const url = `discord.com{channelId}/messages/${m.id}/reactions/%F0%9F%9A%AA/@me`;
            fetch(url, { method: 'PUT', headers: { "Authorization": token } }); // Add ðª
            setTimeout(() => fetch(url, { method: 'DELETE', headers: { "Authorization": token } }), 1500); // Remove ðª
        });
    });
}), 'ð¥');


btn(trollProCat, 'ð Rainbow HUD', requireKey(() => {
    const style = document.createElement('style');
    style.id = 'rainbow-hud-css';
    style.innerHTML = `
        [class*="messageContent_"] { 
            background: linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: rainbow-scroll 2s linear infinite;
            background-size: 200% 100%;
        }
        @keyframes rainbow-scroll { to { background-position: 200% center; } }
    `;
    document.head.appendChild(style);
    showNotif('ð Rainbow HUD: ON', '#ff73fa');
    
    setTimeout(() => { style.remove(); showNotif('ð Rainbow HUD: OFF', '#95a5a6'); }, 15000);
}), 'ð');

  
btn(trollProCat, 'ð Echo Chamber', requireKey(() => {
    showNotif('ð Echo Chamber Enabled - Speak carefully!', '#1abc9c');
    // 2026 Hook: Monitor for message-send events
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(data) {
        if (typeof data === 'string' && data.includes('"content":')) {
            const msg = JSON.parse(data).content;
            setTimeout(() => sendMsg(getCurrentChannelId(), `*echo:* ${msg}`), 1200);
        }
        originalSend.apply(this, arguments);
    };
}), 'ð');

  

btn(trollProCat, 'ð¤¡ Confusion Bomb', requireKey(async() => {
    const confusionMsgs = [
        'Wait, what did you just say?',
        'I\'m not sure I follow...',
        'Can you repeat that?',
        'Huh?',
        'What do you mean?',
        'I\'m confused now',
        'Wait... what?',
        'Hold on, let me think...',
        'That doesn\'t make sense',
        'I lost you there'
    ];
    
    for(let i = 0; i < 8; i++) {
        const msg = confusionMsgs[Math.floor(Math.random() * confusionMsgs.length)];
        await sendMsg(msg);
        await sleep(1500);
    }
    
    showNotif('ð¤¡ Confusion successful!', '#43b581');
}), 'ð¤¡');

btn(trollProCat, 'ð­ Fake Bot Simulator', requireKey(async() => {
    const commands = [
        '!help - Shows all commands',
        '!ping - Check bot latency',
        '!stats - Display server statistics',
        '!music - Music commands',
        '!mod - Moderation tools'
    ];
    
    await sendMsg('ð¤ **Bot Commands**\n\n' + commands.join('\n'));
    await sleep(2000);
    
    // Fake responses
    await sendMsg('Type !help for more information');
    await sleep(1000);
    await sendMsg('â Bot is online and ready!');
    
    showNotif('ð­ Fake bot active!', '#43b581');
}), 'ð­');

btn(trollProCat, 'ð Cryptic Messages', requireKey(async() => {
    const crypticMsgs = [
        'They know...',
        'It\'s happening again...',
        'The numbers don\'t lie...',
        'Tomorrow changes everything...',
        'I shouldn\'t have said that...',
        'Delete this conversation...',
        'We\'re being watched...',
        'This is not a drill...',
        'The truth is out there...',
        'Something\'s coming...'
    ];
    
    const count = parseInt(prompt('How many cryptic messages?', '5'));
    
    for(let i = 0; i < count; i++) {
        const msg = crypticMsgs[Math.floor(Math.random() * crypticMsgs.length)];
        await sendMsg(msg);
        await sleep(3000);
    }
    
    showNotif('ð Paranoia activated!', '#43b581');
}), 'ð');

btn(trollProCat, 'ðª Fake Announcement', requireKey(async() => {
    const announcement = prompt('Fake announcement:', 'MAJOR UPDATE INCOMING');
    
    await sendMsg('ââââââââââââââââââââ');
    await sleep(500);
    await sendMsg('ð¢ **OFFICIAL ANNOUNCEMENT** ð¢');
    await sleep(500);
    await sendMsg('ââââââââââââââââââââ');
    await sleep(1000);
    await sendMsg(announcement);
    await sleep(1000);
    await sendMsg('ââââââââââââââââââââ');
    
    showNotif('ðª Fake announcement sent!', '#43b581');
}), 'ðª');

/* ---------- MASS OPERATIONS PRO ---------- */
const massProCat = cat('ð¥ Mass Operations Pro');

btn(massProCat, 'ð¥ Delete Everything', requireKey(async() => {
    if(!confirm('DELETE ALL YOUR MESSAGES in this channel? Cannot be undone!')) return;
    
    const ch = getTargetChannel();
    const myId = JSON.parse(atob(getToken().split('.')[0])).id;
    
    let totalDeleted = 0;
    let hasMore = true;
    
    showNotif('ð¥ Mass deletion started...', '#f1c40f');
    
    while(hasMore && S.timerUnlocked) {
        const msgs = await getChannelMsgs(ch, 100);
        if(!msgs || msgs.length === 0) break;
        
        const myMsgs = msgs.filter(m => m.author.id === myId);
        if(myMsgs.length === 0) {
            hasMore = false;
            break;
        }
        
        for(const msg of myMsgs) {
            await deleteMsg(ch, msg.id);
            totalDeleted++;
            await sleep(350);
        }
        
        if(totalDeleted % 50 === 0) {
            showNotif(`ð¥ Deleted ${totalDeleted}...`, '#f1c40f');
        }
    }
    
    showNotif(`â Deleted ${totalDeleted} messages!`, '#43b581');
}), 'ð¥');

btn(massProCat, 'â¡ Lightning React Storm', requireKey(async() => {
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch, 50);
    if(!msgs) return;
    
    const emojis = ['â¡', 'ð¥', 'ð', 'â­', 'ð«', 'â¨', 'ð', 'ð¥'];
    
    showNotif('â¡ React storm starting...', '#f1c40f');
    
    for(const msg of msgs) {
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        await addReaction(ch, msg.id, randomEmoji);
        await sleep(100);
    }
    
    showNotif('â¡ Storm complete!', '#43b581');
}), 'â¡');
  

// --- CATEGORY: SETTINGS & PERFORMANCE ---


btn(massProCat, 'ð Copy Entire Channel', requireKey(async() => {
    const ch = getTargetChannel();
    let allMsgs = [];
    let lastId = null;
    
    showNotif('ð Copying channel...', '#f1c40f');
    
    for(let i = 0; i < 10; i++) {
        const endpoint = lastId 
            ? `/channels/${ch}/messages?limit=100&before=${lastId}`
            : `/channels/${ch}/messages?limit=100`;
        
        const msgs = await apiRequest('GET', endpoint);
        if(!msgs || msgs.length === 0) break;
        
        allMsgs = allMsgs.concat(msgs);
        lastId = msgs[msgs.length - 1].id;
        await sleep(1000);
    }
    
    const formatted = allMsgs.map(m => 
        `[${new Date(m.timestamp).toLocaleString()}] ${m.author.username}: ${m.content}`
    ).join('\n');
    
    console.log('=== CHANNEL COPY ===');
    console.log(formatted);
    
    showNotif(`ð Copied ${allMsgs.length} messages (console)`, '#43b581');
}), 'ð');

btn(massProCat, 'ð¯ Smart Bump Engine', requireKey(async() => {
    const interval = parseInt(prompt('Bump interval (minutes):', '60'));
    const message = prompt('Bump message:', 'â¬ï¸ BUMP â¬ï¸');
    
    showNotif('ð¯ Bump engine started!', '#43b581');
    
    const bumpInterval = setInterval(async() => {
        if(!S.timerUnlocked) {
            clearInterval(bumpInterval);
            return;
        }
        
        await sendMsg(message);
        showNotif('â¬ï¸ Bumped!', '#43b581');
    }, interval * 60000);
    
    // Store interval ID
    if(!S.activeIntervals) S.activeIntervals = [];
    S.activeIntervals.push(bumpInterval);
}), 'ð¯');

/* ---------- UTILITY & POWER FEATURES ---------- */
const utilityProCat = cat('ð ï¸ Utility Pro');

btn(utilityProCat, 'ð Message Forensics', requireKey(async() => {
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch, 100);
    if(!msgs) return;
    
    const analysis = {
        total: msgs.length,
        users: new Set(msgs.map(m => m.author.username)).size,
        avgLength: Math.floor(msgs.reduce((s,m) => s + m.content.length, 0) / msgs.length),
        withLinks: msgs.filter(m => m.content.includes('http')).length,
        withMentions: msgs.filter(m => m.mentions.length > 0).length,
        withAttachments: msgs.filter(m => m.attachments.length > 0).length,
        mostActive: [...msgs.reduce((map, m) => {
            map.set(m.author.username, (map.get(m.author.username) || 0) + 1);
            return map;
        }, new Map())].sort((a,b) => b[1] - a[1])[0]
    };
  
    
    const report = `ð **CHANNEL FORENSICS**

ð Total Messages: ${analysis.total}
ð¥ Unique Users: ${analysis.users}
ð Avg Length: ${analysis.avgLength} chars
ð With Links: ${analysis.withLinks}
ð¤ With Mentions: ${analysis.withMentions}
ð With Files: ${analysis.withAttachments}
ð Most Active: ${analysis.mostActive[0]} (${analysis.mostActive[1]} msgs)`;
    
    await sendMsg(report);
    showNotif('ð Forensics complete!', '#43b581');
}), 'ð');

btn(utilityProCat, 'ð Matrix HUD: Auto-Kill (10s)', requireKey(() => {
    let current = GM_getValue('matrix_auto_kill', true);
    GM_setValue('matrix_auto_kill', !current);
    showNotif(`Matrix Auto-Kill: ${!current ? 'OFF' : 'ON'}`, !current ? '#e74c3c' : '#2ecc71');
}), 'ð');

// Rate Limit Adjuster for Mass Commands
btn(utilityProCat, 'â±ï¸ Set API Jitter Delay', requireKey(() => {
    const delay = prompt("Enter base delay for mass actions (ms):", GM_getValue('api_delay', 500));
    if (delay && !isNaN(delay)) {
        GM_setValue('api_delay', parseInt(delay));
        showNotif(`API Delay set to ${delay}ms`, '#3498db');
    }
}), 'â±ï¸');

// Persistent Stealth Mode
btn(utilityProCat, 'ðµï¸ Toggle Stealth Mode', requireKey(() => {
    let stealth = GM_getValue('stealth_mode', false);
    GM_setValue('stealth_mode', !stealth);
    showNotif(`Stealth Mode: ${!stealth ? 'DISABLED' : 'ENABLED'}`, !stealth ? '#95a5a6' : '#1abc9c');
}), 'ðµï¸');
btn(utilityProCat, 'ð¸ Message Screenshot', requireKey(async() => {
    const ch = getTargetChannel();
    const count = parseInt(prompt('How many messages to capture?', '10'));
    const msgs = await getChannelMsgs(ch, count);
    
    if(!msgs) return;
    
    let screenshot = 'ð¸ **MESSAGE CAPTURE**\n```\n';
    msgs.reverse().forEach(m => {
        const time = new Date(m.timestamp).toLocaleTimeString();
        screenshot += `[${time}] ${m.author.username}: ${m.content}\n`;
    });
    screenshot += '```';
    
    await sendMsg(screenshot);
    showNotif('ð¸ Screenshot sent!', '#43b581');
}), 'ð¸');

btn(utilityProCat, 'ð² Random User Picker', requireKey(async() => {
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch, 100);
    if(!msgs) return;
    
    const users = [...new Set(msgs.map(m => m.author.username))];
    const winner = users[Math.floor(Math.random() * users.length)];
    
    await sendMsg('ð² Picking random user...');
    await sleep(1000);
    await sendMsg('ð¯ Rolling...');
    await sleep(1000);
    await sendMsg(`ð Winner: **${winner}**!`);
    
    showNotif('ð² Picked!', '#43b581');
}), 'ð²');

btn(utilityProCat, 'â° Activity Heatmap', requireKey(async() => {
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch, 100);
    if(!msgs) return;
    
    const hourly = Array(24).fill(0);
    msgs.forEach(m => {
        const hour = new Date(m.timestamp).getHours();
        hourly[hour]++;
    });
    
    const max = Math.max(...hourly);
    let heatmap = 'â° **ACTIVITY HEATMAP**\n\n';
    
    for(let h = 0; h < 24; h++) {
        const bars = 'â'.repeat(Math.floor((hourly[h] / max) * 10));
        const padded = h.toString().padStart(2, '0');
        heatmap += `${padded}:00 ${bars} (${hourly[h]})\n`;
    }
    
    await sendMsg(heatmap);
    showNotif('â° Heatmap sent!', '#43b581');
}), 'â°');

console.log('â ULTIMATE Commands Module Loaded - MAXIMUM POWER!');
          

/* ---------- SMART AUTO RESPONDER ---------- */

const smartAICat = cat('ð¤ Smart AI Responder');

const contextResponses = {
    greeting: {
        triggers: ['hello', 'hi', 'hey', 'sup', 'yo', 'greetings', 'morning', 'evening', 'wassup'],
        responses: [
            'Hey there! ð',
            'Hello! How can I help?',
            'Hi! What\'s up?',
            'Greetings! ð',
            'Yo! What\'s good?',
            'Hey! How\'s it going?'
        ]
    },
    farewell: {
        triggers: ['bye', 'goodbye', 'see you', 'later', 'cya', 'gn', 'goodnight', 'gtg', 'gotta go'],
        responses: [
            'See you later! ð',
            'Goodbye! Take care ð',
            'Later! âï¸',
            'Until next time! ð',
            'Catch you later!',
            'Peace out! â¨'
        ]
    },
    gratitude: {
        triggers: ['thanks', 'thank you', 'thx', 'ty', 'appreciate', 'tysm'],
        responses: [
            'You\'re welcome! ð',
            'Anytime! ð',
            'No problem! ð',
            'Happy to help!',
            'Of course! ð¯',
            'Glad I could help!'
        ]
    },
    agreement: {
        triggers: ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'agree', 'exactly', 'true', 'right', 'correct'],
        responses: [
            'Great! ð',
            'Awesome! ð',
            'Perfect! â¨',
            'Sounds good!',
            'I agree!',
            'For sure! ð¯'
        ]
    },
    disagreement: {
        triggers: ['no', 'nope', 'nah', 'disagree', 'wrong', 'false'],
        responses: [
            'I understand ð¤',
            'Fair enough',
            'Got it',
            'Noted ð',
            'I see your point',
            'That makes sense'
        ]
    },
    confusion: {
        triggers: ['what', 'huh', 'confused', 'don\'t understand', 'unclear', 'explain', 'wdym'],
        responses: [
            'Let me clarify... ð­',
            'What I mean is...',
            'To put it simply...',
            'Here\'s another way to look at it...',
            'Sorry if that was unclear!',
            'Let me explain better...'
        ]
    },
    excitement: {
        triggers: ['wow', 'amazing', 'awesome', 'incredible', 'omg', 'lol', 'lmao', 'haha', 'lmfao', 'rofl'],
        responses: [
            'I know right! ð',
            'Absolutely! ð¥',
            'So cool! â¨',
            'Right?! ð',
            'Haha for real! ð',
            'That\'s wild! ð¤¯'
        ]
    },
    help: {
        triggers: ['help', 'assist', 'support', 'how do i', 'can you help', 'need help'],
        responses: [
            'I\'m here to help! What do you need? ð ï¸',
            'Sure! What can I do for you?',
            'Happy to assist! ð',
            'I\'ve got you! What\'s the issue?',
            'Of course! How can I help?'
        ]
    },
    question: {
        triggers: ['?', 'why', 'how', 'when', 'where', 'who', 'which'],
        responses: [
            'That\'s a good question! ð¤',
            'Let me think about that...',
            'Hmm, interesting question!',
            'Good point! ð­',
            'I\'m not entirely sure, but...'
        ]
    },
    positive: {
        triggers: ['good', 'great', 'nice', 'perfect', 'excellent', 'love', 'best', 'beautiful'],
        responses: [
            'That\'s awesome! ð',
            'Love to hear it! â¤ï¸',
            'Nice! ð',
            'That sounds great! â¨',
            'Amazing! ð'
        ]
    },
    negative: {
        triggers: ['bad', 'terrible', 'awful', 'hate', 'worst', 'sucks', 'sad', 'angry', 'mad'],
        responses: [
            'That\'s rough ð',
            'Sorry to hear that...',
            'Oof, that sucks ð',
            'That doesn\'t sound good...',
            'Damn, that\'s unfortunate',
            'I feel you ð'
        ]
    },
    humor: {
        triggers: ['joke', 'funny', 'meme', 'ð', 'ð¤£', 'ð', 'dead'],
        responses: [
            'Haha right ð',
            'Lmao ð¤£',
            'I\'m dead ð',
            'That\'s hilarious!',
            'Fr fr ð'
        ]
    },
    casual: {
        triggers: ['bro', 'dude', 'man', 'guys', 'yall', 'fr', 'ngl', 'tbh'],
        responses: [
            'For real ð¯',
            'Honestly though',
            'Facts bro',
            'No cap',
            'Deadass'
        ]
    }
};

let smartAIActive = false;
let lastProcessedMsgId = null;
let conversationContext = [];

function analyzeSentiment(text) {
    const positiveWords = ['good', 'great', 'awesome', 'love', 'happy', 'excited', 'perfect', 'excellent', 'amazing', 'nice', 'beautiful', 'wonderful'];
    const negativeWords = ['bad', 'terrible', 'hate', 'sad', 'angry', 'awful', 'worst', 'horrible', 'annoying', 'sucks', 'mad'];
    
    const words = text.toLowerCase().split(/\s+/);
    let score = 0;
    
    words.forEach(word => {
        if (positiveWords.some(pw => word.includes(pw))) score++;
        if (negativeWords.some(nw => word.includes(nw))) score--;
    });
    
    return {
        score: score,
        mood: score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral'
    };
}

function findBestResponse(content) {
    const matches = [];
    
    // Find all matching categories with priority
    for (const [category, data] of Object.entries(contextResponses)) {
        for (const trigger of data.triggers) {
            if (content.includes(trigger)) {
                matches.push({
                    category,
                    data,
                    priority: trigger.length,
                    position: content.indexOf(trigger)
                });
            }
        }
    }
    
    if (matches.length === 0) return null;
    
    // Sort by trigger length (more specific) and position (earlier = higher priority)
    matches.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.position - b.position;
    });
    
    const chosen = matches[0].data;
    return chosen.responses[Math.floor(Math.random() * chosen.responses.length)];
}

function shouldRespond(content, context) {
    // Always respond to questions
    if (content.includes('?')) return true;
    
    // High chance for greetings and farewells
    if (contextResponses.greeting.triggers.some(t => content.includes(t))) return Math.random() < 0.95;
    if (contextResponses.farewell.triggers.some(t => content.includes(t))) return Math.random() < 0.95;
    
    // High chance for direct engagement
    if (contextResponses.help.triggers.some(t => content.includes(t))) return Math.random() < 0.9;
    if (contextResponses.gratitude.triggers.some(t => content.includes(t))) return Math.random() < 0.9;
    
    // Medium chance for emotional content
    const sentiment = analyzeSentiment(content);
    if (sentiment.mood !== 'neutral') return Math.random() < 0.75;
    
    // Lower chance for casual chat
    return Math.random() < 0.6;
}

async function smartAIRespond() {
    while(smartAIActive && S.timerUnlocked) {
        try {
            const ch = getTargetChannel();
            if(!ch) { 
                await sleep(3000); 
                continue; 
            }
            
            const msgs = await getChannelMsgs(ch, 5);
            if(!msgs || msgs.length === 0) { 
                await sleep(3000); 
                continue; 
            }
            
            const myId = JSON.parse(atob(getToken().split('.')[0])).id;
            const latestMsg = msgs[0];
            
            if(latestMsg.id === lastProcessedMsgId || latestMsg.author.id === myId) {
                await sleep(3000);
                continue;
            }
            
            lastProcessedMsgId = latestMsg.id;
            const content = latestMsg.content.toLowerCase();
            const sentiment = analyzeSentiment(content);
            
            // Add to conversation context
            conversationContext.push({
                author: latestMsg.author.username,
                content: content,
                sentiment: sentiment.mood,
                time: Date.now()
            });
            
            if(conversationContext.length > 20) conversationContext.shift();
            
            // Decide if we should respond
            if(!shouldRespond(content, conversationContext)) {
                await sleep(3000);
                continue;
            }
            
            // Find best matching response
            let response = findBestResponse(content);
            
            if(response) {
                // Human-like typing delay (2-5 seconds)
                const typingDelay = 2000 + Math.random() * 3000;
                await sleep(typingDelay);
                
                // Send the response
                await sendMsg(response);
                
                // Cooldown between messages (4-8 seconds)
                await sleep(4000 + Math.random() * 4000);
            } else {
                await sleep(3000);
            }

        } catch(e) {
            console.error('Smart AI Error:', e);
            await sleep(5000);
        }
    }
}

const smartAIStatus = document.createElement('div');
smartAIStatus.textContent = 'Status: ð´ Disabled';
smartAIStatus.style.cssText = 'margin:12px;padding:10px;background:rgba(231,76,60,.2);border-left:4px solid #e74c3c;border-radius:6px;font-size:12px';
smartAICat.appendChild(smartAIStatus);

btn(smartAICat, 'â¶ï¸ Start Smart AI', requireKey(() => {
    smartAIActive = true;
    smartAIStatus.textContent = 'Status: ð¢ Active (Context-Aware)';
    smartAIStatus.style.background = 'rgba(67,181,129,.2)';
    smartAIStatus.style.borderColor = '#43b581';
    showNotif('ð¤ Smart AI Active!', '#43b581');
    smartAIRespond();
}), 'â¶ï¸');

btn(smartAICat, 'â¹ï¸ Stop Smart AI', requireKey(() => {
    smartAIActive = false;
    smartAIStatus.textContent = 'Status: ð´ Disabled';
    smartAIStatus.style.background = 'rgba(231,76,60,.2)';
    smartAIStatus.style.borderColor = '#e74c3c';
    showNotif('â¹ï¸ Smart AI Stopped', '#e74c3c');
}), 'â¹ï¸');

btn(smartAICat, 'ð View Conversation Context', requireKey(() => {
    if(conversationContext.length === 0) {
        showNotif('â ï¸ No context yet', '#e74c3c');
        return;
    }
    
    console.log('=== CONVERSATION CONTEXT ===');
    conversationContext.forEach((ctx, i) => {
        console.log(`${i+1}. [${ctx.author}] (${ctx.sentiment}): ${ctx.content.substring(0, 100)}`);
    });
    showNotif('ð Check console for context', '#43b581');
}), 'ð');

btn(smartAICat, 'ðï¸ Clear Context', requireKey(() => {
    conversationContext = [];
    lastProcessedMsgId = null;
    showNotif('ðï¸ Context cleared!', '#43b581');
}), 'ðï¸');
            
                      




/* ---------- ADVANCED ANALYTICS DASHBOARD ---------- */
const analyticsCat = cat('Ã° Advanced Analytics');

const analyticsData = {
    messages: [],
    users: {},
    hourlyActivity: Array(24).fill(0),
    dailyActivity: {},
    wordFrequency: {},
    emojiUsage: {}
};

let analyticsTracking = false;

btn(analyticsCat, 'Ã° Start Analytics Collection', requireKey(async() => {
    analyticsTracking = true;
    showNotif('Ã° Collecting analytics...', '#43b581');
    
    while(analyticsTracking && S.timerUnlocked) {
        const ch = getTargetChannel();
        if(!ch) { await sleep(10000); continue; }
        
        const msgs = await getChannelMsgs(ch, 50);
        if(!msgs) { await sleep(10000); continue; }
        
        msgs.forEach(msg => {
            // Track user activity
            if(!analyticsData.users[msg.author.id]) {
                analyticsData.users[msg.author.id] = {
                    username: msg.author.username,
                    messageCount: 0,
                    totalChars: 0,
                    avgLength: 0,
                    sentiments: { positive: 0, negative: 0, neutral: 0 }
                };
            }
            
            const user = analyticsData.users[msg.author.id];
            user.messageCount++;
            user.totalChars += msg.content.length;
            user.avgLength = Math.floor(user.totalChars / user.messageCount);
            
            // Track sentiment
            const sentiment = analyzeSentiment(msg.content);
            user.sentiments[sentiment.mood]++;
            
            // Track hourly activity
            const hour = new Date(msg.timestamp).getHours();
            analyticsData.hourlyActivity[hour]++;
            
            // Track daily activity
            const date = new Date(msg.timestamp).toLocaleDateString();
            analyticsData.dailyActivity[date] = (analyticsData.dailyActivity[date] || 0) + 1;
            
            // Track word frequency
            msg.content.toLowerCase().split(/\s+/).forEach(word => {
                word = word.replace(/[^\w]/g, '');
                if(word.length > 3) {
                    analyticsData.wordFrequency[word] = (analyticsData.wordFrequency[word] || 0) + 1;
                }
            });
            
            // Track emoji usage
            const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu;
            const emojis = msg.content.match(emojiRegex);
            if(emojis) {
                emojis.forEach(emoji => {
                    analyticsData.emojiUsage[emoji] = (analyticsData.emojiUsage[emoji] || 0) + 1;
                });
            }
        });
        
        await sleep(30000); // Collect every 30s
    }
}), 'Ã°');

btn(analyticsCat, 'Ã°ÂÂÂ¥ User Leaderboard', requireKey(async() => {
    const users = Object.values(analyticsData.users)
        .sort((a, b) => b.messageCount - a.messageCount)
        .slice(0, 10);
    
    if(users.length === 0) {
        showNotif('Ã¢ÂÂ No data collected yet', '#e74c3c');
        return;
    }
    
    let leaderboard = 'Ã°ÂÂÂ **TOP 10 USERS**\n\n';
    users.forEach((user, i) => {
        const medals = ['Ã°ÂÂ¥Â', 'Ã°ÂÂ¥Â', 'Ã°ÂÂ¥Â'];
        const icon = medals[i] || `${i+1}.`;
        leaderboard += `${icon} ${user.username}\n`;
        leaderboard += `   Ã°ÂÂÂ¨ ${user.messageCount} msgs | Ã°ÂÂÂ ${user.avgLength} chars avg\n`;
    });
    
    await sendMsg(leaderboard);
    showNotif('Ã°ÂÂÂ Leaderboard sent', '#43b581');
}), 'Ã°ÂÂÂ¥');

btn(analyticsCat, 'Ã¢ÂÂ° Peak Activity Times', requireKey(async() => {
    const maxActivity = Math.max(...analyticsData.hourlyActivity);
    if(maxActivity === 0) {
        showNotif('Ã¢ÂÂ No data yet', '#e74c3c');
        return;
    }
    
    let report = 'Ã¢ÂÂ° **PEAK ACTIVITY TIMES**\n\n';
    analyticsData.hourlyActivity.forEach((count, hour) => {
        if(count > maxActivity * 0.5) { // Show hours with >50% of max activity
            const bars = 'Ã¢ÂÂ'.repeat(Math.floor((count/maxActivity) * 10));
            report += `${hour}:00 ${bars} (${count})\n`;
        }
    });
    
    const peakHour = analyticsData.hourlyActivity.indexOf(maxActivity);
    report += `\nÃ°ÂÂÂ¥ Peak: ${peakHour}:00 with ${maxActivity} messages`;
    
    await sendMsg(report);
    showNotif('Ã¢ÂÂ° Peak times sent', '#43b581');
}), 'Ã¢ÂÂ°');

btn(analyticsCat, 'Ã°ÂÂÂ¬ Top Words', requireKey(async() => {
    const topWords = Object.entries(analyticsData.wordFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);
    
    if(topWords.length === 0) {
        showNotif('Ã¢ÂÂ No data yet', '#e74c3c');
        return;
    }
    
    let report = 'Ã°ÂÂÂ¬ **TOP 15 WORDS**\n\n';
    topWords.forEach(([word, count], i) => {
        report += `${i+1}. **${word}** (${count}ÃÂ)\n`;
    });
    
    await sendMsg(report);
    showNotif('Ã°ÂÂÂ¬ Top words sent', '#43b581');
}), 'Ã°ÂÂÂ¬');

btn(analyticsCat, 'Ã°ÂÂÂ Emoji Stats', requireKey(async() => {
    const topEmojis = Object.entries(analyticsData.emojiUsage)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    if(topEmojis.length === 0) {
        showNotif('Ã¢ÂÂ No emoji data yet', '#e74c3c');
        return;
    }
    
    let report = 'Ã°ÂÂÂ **TOP 10 EMOJIS**\n\n';
    topEmojis.forEach(([emoji, count], i) => {
        report += `${i+1}. ${emoji} (${count}ÃÂ)\n`;
    });
    
    await sendMsg(report);
    showNotif('Ã°ÂÂÂ Emoji stats sent', '#43b581');
}), 'Ã°ÂÂÂ');

btn(analyticsCat, 'Ã°ÂÂÂ Daily Trends', requireKey(async() => {
    const days = Object.entries(analyticsData.dailyActivity)
        .sort((a, b) => new Date(b[0]) - new Date(a[0]))
        .slice(0, 7);
    
    if(days.length === 0) {
        showNotif('Ã¢ÂÂ No daily data yet', '#e74c3c');
        return;
    }
    
    let report = 'Ã°ÂÂÂ **LAST 7 DAYS**\n\n';
    days.forEach(([date, count]) => {
        const bars = 'Ã¢ÂÂ'.repeat(Math.floor(count / 10));
        report += `${date}: ${bars} (${count})\n`;
    });
    
    await sendMsg(report);
    showNotif('Ã°ÂÂÂ Daily trends sent', '#43b581');
}), 'Ã°ÂÂÂ');

btn(analyticsCat, 'Ã°ÂÂÂ¾ Export Full Report', requireKey(() => {
    const report = {
        totalUsers: Object.keys(analyticsData.users).length,
        totalMessages: Object.values(analyticsData.users).reduce((sum, u) => sum + u.messageCount, 0),
        peakHour: analyticsData.hourlyActivity.indexOf(Math.max(...analyticsData.hourlyActivity)),
        topUser: Object.values(analyticsData.users).sort((a,b) => b.messageCount - a.messageCount)[0],
        topWords: Object.entries(analyticsData.wordFrequency).sort((a,b) => b[1] - a[1]).slice(0, 20),
        topEmojis: Object.entries(analyticsData.emojiUsage).sort((a,b) => b[1] - a[1]).slice(0, 10)
    };
    
    console.log('=== FULL ANALYTICS REPORT ===');
    console.log(JSON.stringify(report, null, 2));
    showNotif('Ã°ÂÂÂ¾ Check console for full report', '#43b581');
}), 'Ã°ÂÂÂ¾');

btn(analyticsCat, 'Ã°ÂÂÂÃ¯Â¸Â Clear Analytics Data', requireKey(() => {
    if(confirm('Clear all analytics data?')) {
        analyticsData.messages = [];
        analyticsData.users = {};
        analyticsData.hourlyActivity = Array(24).fill(0);
        analyticsData.dailyActivity = {};
        analyticsData.wordFrequency = {};
        analyticsData.emojiUsage = {};
        showNotif('Ã°ÂÂÂÃ¯Â¸Â Analytics cleared', '#43b581');
    }
}), 'Ã°ÂÂÂÃ¯Â¸Â');

btn(analyticsCat, 'Ã¢ÂÂ¹Ã¯Â¸Â Stop Analytics', requireKey(() => {
    analyticsTracking = false;
    showNotif('Ã¢ÂÂ¹Ã¯Â¸Â Analytics stopped', '#e74c3c');
}), 'Ã¢ÂÂ¹Ã¯Â¸Â');  
  
/* ---------- MESSAGING & AUTOMATION ---------- */
const msgCat=cat('Ã°ÂÂÂ¬ Messaging & Automation');

btn(msgCat,'Ã°ÂÂ¤Â Send Message',requireKey(async()=>{
    const text = S.customText || S.spamText;
    await sendMsg(text);
    showNotif('Ã¢ÂÂ Message sent','#43b581');
}),'Ã°ÂÂ¤Â');

input(msgCat,'Spam Text',S.spamText,v=>{S.spamText=v;save();});
input(msgCat,'Delay (ms)',S.spamDelay,v=>{S.spamDelay=+v;save();});

btn(msgCat,'Ã°ÂÂÂ Toggle Spam',requireKey(async()=>{
    S.spam=!S.spam;
    save();
    showNotif(S.spam?'Ã°ÂÂÂ Spam ON':'Ã¢ÂÂ¸Ã¯Â¸Â Spam OFF',S.spam?'#43b581':'#e74c3c');
    while(S.spam){
        await sendMsg(S.spamText);
        await sleep(S.spamDelay);
        if(!S.timerUnlocked) break; // Stop if license expires
    }
}),'Ã°ÂÂÂ');

btn(msgCat,'Ã¢ÂÂ¡ Burst x10',requireKey(async()=>{
    for(let i=0;i<10;i++){
        await sendMsg(S.spamText);
        await sleep(150);
    }
    showNotif('Ã¢ÂÂ Burst complete','#43b581');
}),'Ã¢ÂÂ¡');

btn(msgCat,'Ã°ÂÂÂ¥ Mega Burst x50',requireKey(async()=>{
    showNotif('Ã°ÂÂÂ Mega burst started...','#f1c40f');
    for(let i=0;i<50;i++){
        await sendMsg(S.spamText);
        await sleep(100);
    }
    showNotif('Ã¢ÂÂ Mega burst done','#43b581');
}),'Ã°ÂÂÂ¥');

btn(msgCat,'Ã¢ÂÂÃ¯Â¸Â Auto Typing Loop',requireKey(()=>{
    const ch = getTargetChannel();
    if(!ch){ showNotif('Ã¢ÂÂ No channel','#e74c3c'); return; }
    
    const interval = setInterval(()=>{
        if(!S.timerUnlocked){
            clearInterval(interval);
            return;
        }
        startTyping(ch);
    },8000);
    
    showNotif('Ã¢ÂÂÃ¯Â¸Â Typing loop active','#43b581');
}),'Ã¢ÂÂÃ¯Â¸Â');

btn(msgCat,'Ã°ÂÂÂ Multi-line Spam',requireKey(()=>{
    const lines = S.spamText.split('\\n').join('\n');
    sendMsg(lines);
    showNotif('Ã¢ÂÂ Multi-line sent','#43b581');
}),'Ã°ÂÂÂ');

btn(msgCat,'Ã°ÂÂÂ Reverse Text',requireKey(()=>{
    const reversed = S.spamText.split('').reverse().join('');
    sendMsg(reversed);
}),'Ã°ÂÂÂ');

btn(msgCat,'Ã°ÂÂÂ¢ ALL CAPS',requireKey(()=>{
    sendMsg(S.spamText.toUpperCase());
}),'Ã°ÂÂÂ¢');

btn(msgCat,'Ã°ÂÂÂ² Random Text',requireKey(()=>{
    const random = Math.random().toString(36).substring(2,15);
    sendMsg(random);
}),'Ã°ÂÂÂ²');

btn(msgCat,'Ã°ÂÂÂ¹ Zalgo Text',requireKey(()=>{
    const zalgo = S.spamText.split('').map(c=>c+'ÃÂµÃÂ¡ÃÂ¢ÃÂ§ÃÂ¨ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ ÃÂ¡').join('');
    sendMsg(zalgo);
}),'Ã°ÂÂÂ¹');
  
  
/* ---------- ADVANCED MESSAGE CONTROL ---------- */
const advMsgCat = cat('Ã°ÂÂÂ¯ Advanced Message Control');

btn(advMsgCat,'Ã°ÂÂÂÃ¯Â¸Â Delete Last 10 Msgs',requireKey(async()=>{
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch,10);
    if(!msgs){ showNotif('Ã¢ÂÂ Failed to fetch','#e74c3c'); return; }
    
    const myId = JSON.parse(atob(getToken().split('.')[0])).id;
    const myMsgs = msgs.filter(m=>m.author.id===myId);
    
    for(const msg of myMsgs.slice(0,10)){
        await deleteMsg(ch,msg.id);
        await sleep(300);
    }
    showNotif(`Ã¢ÂÂ Deleted ${myMsgs.length} msgs`,'#43b581');
}),'Ã°ÂÂÂÃ¯Â¸Â');

btn(advMsgCat,'Ã°ÂÂÂ Pin Last Message',requireKey(async()=>{
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch,1);
    if(!msgs || msgs.length===0){ showNotif('Ã¢ÂÂ No messages','#e74c3c'); return; }
    
    await pinMsg(ch,msgs[0].id);
    showNotif('Ã°ÂÂÂ Message pinned','#43b581');
}),'Ã°ÂÂÂ');

btn(advMsgCat,'Ã°ÂÂÂ React to Last',requireKey(async()=>{
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch,1);
    if(!msgs || msgs.length===0){ showNotif('Ã¢ÂÂ No messages','#e74c3c'); return; }
    
    await addReaction(ch,msgs[0].id,'Ã°ÂÂÂ');
    showNotif('Ã°ÂÂÂ Reaction added','#43b581');
}),'Ã°ÂÂÂ');

btn(advMsgCat,'Ã°ÂÂÂ¨ Spam Reactions',requireKey(async()=>{
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch,1);
    if(!msgs || msgs.length===0) return;
    
    const emojis = ['Ã¢ÂÂ¤Ã¯Â¸Â','Ã°ÂÂÂ','Ã°ÂÂÂ®','Ã°ÂÂÂ¥','Ã¢ÂÂ¨','Ã°ÂÂÂ¯'];
    for(const emoji of emojis){
        await addReaction(ch,msgs[0].id,emoji);
        await sleep(200);
    }
    showNotif('Ã°ÂÂÂ¨ Reactions done','#43b581');
}),'Ã°ÂÂÂ¨');

btn(advMsgCat,'Ã¢ÂÂÃ¯Â¸Â Edit Last Message',requireKey(async()=>{
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch,20);
    if(!msgs){ showNotif('Ã¢ÂÂ Failed','#e74c3c'); return; }
    
    const myId = JSON.parse(atob(getToken().split('.')[0])).id;
    const myMsg = msgs.find(m=>m.author.id===myId);
    
    if(!myMsg){ showNotif('Ã¢ÂÂ No message found','#e74c3c'); return; }
    
    const newText = prompt('Edit to:',myMsg.content);
    if(newText){
        await editMsg(ch,myMsg.id,newText);
        showNotif('Ã¢ÂÂÃ¯Â¸Â Message edited','#43b581');
    }
}),'Ã¢ÂÂÃ¯Â¸Â');

  

  
btn(advMsgCat,'Ã°ÂÂÂ£ Nuke Messages',requireKey(async()=>{
    if(!confirm('Delete last 50 messages? This cannot be undone!')) return;
    
    const ch = getTargetChannel();
    const msgs = await getChannelMsgs(ch,50);
    if(!msgs) return;
    
    const myId = JSON.parse(atob(getToken().split('.')[0])).id;
    const myMsgs = msgs.filter(m=>m.author.id===myId);
    
    showNotif('Ã°ÂÂÂ£ Nuking messages...','#f1c40f');
    for(const msg of myMsgs){
        await deleteMsg(ch,msg.id);
        await sleep(350);
    }
    showNotif(`Ã°ÂÂÂ¥ Nuked ${myMsgs.length} msgs`,'#43b581');
}),'Ã°ÂÂÂ£'); 
            
/* ---------- CO-HOST MODE (ULTRA-AGGRESSIVE LOOP VERSION) ---------- */
const cohostCat = cat('Ã°ÂÂÂ¥ Co-Host Mode');

let cohostRunning = false;
let cohostCommandLog = [];
let lastProcessedMessageId = null;
let processedMessageIds = new Set(); // Track multiple processed messages

input(cohostCat,'Co-Host User ID',S.cohostUser,v=>{S.cohostUser=v;save();},'Enter user ID');
input(cohostCat,'Command Prefix',S.cohostPrefix||'!',v=>{S.cohostPrefix=v;save();},'Default: !');

const cohostStatus=document.createElement('div');
cohostStatus.textContent='Status: Disabled';
cohostStatus.style.cssText='margin:12px;padding:10px;background:rgba(231,76,60,.2);border-left:4px solid #e74c3c;border-radius:6px;font-size:12px;font-weight:600';
cohostCat.appendChild(cohostStatus);

const cohostLog=document.createElement('div');
cohostLog.style.cssText='margin:12px;padding:10px;background:rgba(0,0,0,.3);border-radius:6px;max-height:120px;overflow-y:auto;font-size:11px';
cohostLog.innerHTML='<div style="opacity:0.6">Command log will appear here...</div>';
cohostCat.appendChild(cohostLog);

function logCoHostCommand(cmd,result){
    const time = new Date().toLocaleTimeString();
    const entry = `[${time}] ${cmd} Ã¢ÂÂ ${result}`;
    cohostCommandLog.unshift(entry);
    if(cohostCommandLog.length>20) cohostCommandLog.pop();
    cohostLog.innerHTML = cohostCommandLog.map(e=>`<div>${e}</div>`).join('');
}

async function handleCoHostCommand(cmd,args){
    const prefix = S.cohostPrefix || '!';
    
    try{
        switch(cmd){
            /* ---------- ADVANCED CO-HOST COMMANDS ---------- */

            case 'ghost': // Sends a ping and deletes it instantly
                const targetPing = args[0] || S.cohostUser;
                const gMsg = await sendMsg(`<@${targetPing}>`);
                if(gMsg) {
                    await sleep(50); // High-speed deletion
                    await deleteMsg(getTargetChannel(), gMsg.id);
                    logCoHostCommand('ghost', `Ghosted ${targetPing}`);
                }
                break;

            case 'reactspam': // Reacts with 5+ emojis to the last message
                const chRS = getTargetChannel();
                const msgsRS = await getChannelMsgs(chRS, 1);
                if(msgsRS && msgsRS.length > 0) {
                    const emojis = ['ð¥','ð','ð¤¡','ð¯','â ï¸','â'];
                    for(const e of emojis) {
                        await addReaction(chRS, msgsRS[0].id, e);
                        await sleep(150);
                    }
                    logCoHostCommand('reactspam', 'Applied 6 reactions');
                }
                break;

            case 'fetch': // Pulls the text of the last X messages into logs
                const fetchCount = Math.min(parseInt(args[0]) || 5, 10);
                const fetched = await getChannelMsgs(getTargetChannel(), fetchCount);
                if(fetched) {
                    fetched.forEach(m => logCoHostCommand('fetch', `${m.author.username}: ${m.content.slice(0,15)}...`));
                    await sendMsg(`ð¥ Fetched ${fetched.length} messages to logs.`);
                }
                break;

            case 'spoof': // Sends a message with massive whitespace to "hide" text
                const hiddenText = args.join(' ');
                await sendMsg('||â||' + '\n'.repeat(50) + hiddenText);
                logCoHostCommand('spoof', 'Sent hidden message');
                break;

            case 'stealth': // Message deletes itself after X seconds
                const timer = parseInt(args[0]) || 5;
                const content = args.slice(1).join(' ') || 'Self-destructing message.';
                const sMsg = await sendMsg(`ðµï¸ **[STEALTH]** (Destruct in ${timer}s): ${content}`);
                if(sMsg) {
                    setTimeout(async () => {
                        await deleteMsg(getTargetChannel(), sMsg.id);
                    }, timer * 1000);
                }
                logCoHostCommand('stealth', `Timer: ${timer}s`);
                break;

            case 'ascii': // Quick ASCII art generator for chat dominance
                const bigText = args.join(' ') || 'REKT';
                await sendMsg('```\n' + bigText.split('').join(' ') + '\n```');
                logCoHostCommand('ascii', 'Sent');
                break;

            case 'purge': // More aggressive than 'clear' - deletes last X messages by anyone (if perms allow)
                const pCount = Math.min(parseInt(args[0]) || 10, 50);
                const chP = getTargetChannel();
                const msgsP = await getChannelMsgs(chP, pCount);
                if(msgsP) {
                    for(const m of msgsP) {
                        await deleteMsg(chP, m.id);
                        await sleep(250);
                    }
                    logCoHostCommand('purge', `Attempted ${pCount} deletes`);
                }
                break;

            case 'slowmode': // Fake slowmode warning to trick users
                await sendMsg('â ï¸ **System:** Slowmode is enabled (1 message every 30 seconds).');
                logCoHostCommand('slowmode', 'Deception sent');
                break;

            case 'shutdown': // Remotely kill the script loop
                cohostRunning = false;
                await sendMsg('ð **Remote Shutdown Signal Received.**');
                logCoHostCommand('system', 'OFFLINE');
                break;
            case 'ping':
                await sendMsg('Ã°ÂÂÂ Pong! Bot is online');
                logCoHostCommand('ping','Success');
                break;
                
            case 'spam':
                await sendMsg(S.spamText);
                logCoHostCommand('spam','Sent message');
                break;
                
            case 'burst':
                const count = parseInt(args[0]) || 5;
                for(let i=0;i<Math.min(count,20);i++){
                    await sendMsg(S.spamText);
                    await sleep(200);
                }
                logCoHostCommand(`burst ${count}`,'Complete');
                break;
                
            case 'say':
                if(args.length>0){
                    await sendMsg(args.join(' '));
                    logCoHostCommand('say','Message sent');
                }
                break;
                
            case 'repeat':
                const times = parseInt(args[0]) || 3;
                const text = args.slice(1).join(' ') || S.spamText;
                for(let i=0;i<Math.min(times,10);i++){
                    await sendMsg(text);
                    await sleep(500);
                }
                logCoHostCommand(`repeat ${times}`,'Complete');
                break;
                
            case 'clear':
                const ch = getTargetChannel();
                const msgs = await getChannelMsgs(ch,10);
                if(msgs){
                    const myId = JSON.parse(atob(getToken().split('.')[0])).id;
                    const myMsgs = msgs.filter(m=>m.author.id===myId);
                    for(const msg of myMsgs){
                        await deleteMsg(ch,msg.id);
                        await sleep(300);
                    }
                    logCoHostCommand('clear',`Deleted ${myMsgs.length} msgs`);
                }
                break;
                
            case 'react':
                const emoji = args[0] || 'Ã°ÂÂÂ';
                const ch2 = getTargetChannel();
                const msgs2 = await getChannelMsgs(ch2,1);
                if(msgs2 && msgs2.length>0){
                    await addReaction(ch2,msgs2[0].id,emoji);
                    logCoHostCommand('react','Added reaction');
                }
                break;
                
            case 'type':
                const duration = parseInt(args[0]) || 5;
                const ch3 = getTargetChannel();
                for(let i=0;i<duration;i++){
                    await startTyping(ch3);
                    await sleep(1000);
                }
                logCoHostCommand('type',`${duration}s typing`);
                break;
                
            case 'reverse':
                const text2 = args.join(' ') || S.spamText;
                await sendMsg(text2.split('').reverse().join(''));
                logCoHostCommand('reverse','Sent');
                break;
                
            case 'caps':
                const text3 = args.join(' ') || S.spamText;
                await sendMsg(text3.toUpperCase());
                logCoHostCommand('caps','Sent');
                break;
                
            case 'embed':
                await sendMsg('```\n'+args.join(' ')+'\n```');
                logCoHostCommand('embed','Code block sent');
                break;
                
            case 'help':
                await sendMsg(`${prefix}ping ${prefix}ghost ${prefix}shutdown ${prefix}fetch ${prefix}spoof ${prefix}stealth ${prefix}ascii ${prefix}reactspam ${prefix}purge ${prefix}slowmode  ${prefix}spam ${prefix}burst [n] ${prefix}say [text] ${prefix}repeat [n] [text] ${prefix}clear ${prefix}react [emoji] ${prefix}type [s] ${prefix}reverse [text] ${prefix}caps [text] ${prefix}embed [text]`);
                logCoHostCommand('help','Sent help');
                break;
                
            case 'status':
                await sendMsg('Ã¢ÂÂ Bot Online | License: Active | Commands: 12');
                logCoHostCommand('status','Status sent');
                break;
                
            case 'stop':
                cohostRunning = false;
                await sendMsg('Ã¢ÂÂ Co-Host stopping...');
                logCoHostCommand('stop','Stopping');
                break;
                
            default:
                logCoHostCommand(cmd,'Unknown command');
                break;
        }
    }catch(e){
        logCoHostCommand(cmd,`Error: ${e.message}`);
        console.error('CoHost command error:',e);
    }
}

// CONTINUOUS LOOP - checks CONSTANTLY
async function cohostLoop(){
    logCoHostCommand('system','Ã°ÂÂÂ Loop started - checking continuously');
    
    while(cohostRunning){
        try{
            // Check if still unlocked
            if(!S.timerUnlocked){
                logCoHostCommand('system','Ã¢ÂÂ Ã¯Â¸Â License expired - stopping');
                cohostRunning = false;
                break;
            }
            
            const ch = getTargetChannel();
            if(!ch){
                await sleep(1000);
                continue;
            }
            
            // Fetch recent messages
            const msgs = await getChannelMsgs(ch, 10); // Check last 10 messages
            if(!msgs || msgs.length === 0){
                await sleep(500);
                continue;
            }
            
            // Check ALL recent messages for commands (not just the newest)
            for(const msg of msgs){
                // Skip if already processed
                if(processedMessageIds.has(msg.id)) continue;
                
                // Check if message starts with prefix
                if(!msg.content.startsWith(S.cohostPrefix||'!')) continue;
                
                // Check if from authorized user (or allow all if no user set)
                if(S.cohostUser && msg.author.id !== S.cohostUser) continue;
                
                // Mark as processed
                processedMessageIds.add(msg.id);
                
                // Clean up old processed IDs (keep last 100)
                if(processedMessageIds.size > 100){
                    const arr = Array.from(processedMessageIds);
                    processedMessageIds = new Set(arr.slice(-100));
                }
                
                // Parse command
                const fullCmd = msg.content.slice((S.cohostPrefix||'!').length).trim();
                const parts = fullCmd.split(' ');
                const cmd = parts[0].toLowerCase();
                const args = parts.slice(1);
                
                // Log detection
                logCoHostCommand('detected',`${cmd} from ${msg.author.username}`);
                
                // Execute command
                await handleCoHostCommand(cmd, args);
            }
            
            // Small delay to avoid rate limits (but still very fast)
            await sleep(500); // Check every 0.5 seconds!
            
        }catch(e){
            logCoHostCommand('system',`Loop error: ${e.message}`);
            console.error('CoHost loop error:',e);
            await sleep(1000);
        }
    }
    
    logCoHostCommand('system','Ã¢ÂÂ Loop stopped');
    
    // Update UI
    cohostStatus.textContent='Status: Disabled';
    cohostStatus.style.background='rgba(231,76,60,.2)';
    cohostStatus.style.borderColor='#e74c3c';
}

btn(cohostCat,'Ã°ÂÂÂ Enable Co-Host (LOOP)',requireKey(()=>{
    if(cohostRunning){
        showNotif('Ã¢ÂÂ Ã¯Â¸Â Already running!','#f1c40f');
        return;
    }
    
    if(!S.cohostUser && !confirm('No user ID set. Allow commands from EVERYONE?')){ 
        return; 
    }
    
    S.cohostMode=true;
    cohostRunning=true;
    save();
    
    cohostStatus.textContent='Status: Ã°ÂÂÂ ACTIVE - Continuous Loop';
    cohostStatus.style.background='rgba(67,181,129,.2)';
    cohostStatus.style.borderColor='#43b581';
    
    showNotif('Ã°ÂÂÂ Co-Host LOOP enabled!','#43b581');
    
    // Clear processed messages
    processedMessageIds.clear();
    lastProcessedMessageId = null;
    
    // Start the continuous loop
    cohostLoop();
    
}),'Ã°ÂÂÂ');

btn(cohostCat,'Ã¢ÂÂ Stop Co-Host',requireKey(()=>{
    cohostRunning = false;
    S.cohostMode=false;
    save();
    
    processedMessageIds.clear();
    lastProcessedMessageId = null;
    
    cohostStatus.textContent='Status: Disabled';
    cohostStatus.style.background='rgba(231,76,60,.2)';
    cohostStatus.style.borderColor='#e74c3c';
    
    showNotif('Ã¢ÂÂ Co-Host stopped','#e74c3c');
    logCoHostCommand('system','Ã¢ÂÂ Manually stopped');
}),'Ã¢ÂÂ');

btn(cohostCat,'Ã°ÂÂÂ Show Commands',requireKey(()=>{
    const prefix = S.cohostPrefix || '!';
    alert(`Co-Host Commands:\n\n ${prefix}ping ${prefix}ghost ${prefix}shutdown ${prefix}fetch ${prefix}spoof ${prefix}stealth ${prefix}ascii ${prefix}reactspam ${prefix}purge ${prefix}slowmode  ${prefix}spam ${prefix}burst [n] ${prefix}say [text] ${prefix}repeat [n] [text] ${prefix}clear ${prefix}react [emoji] ${prefix}type [s] ${prefix}reverse [text] ${prefix}caps [text] ${prefix}embed [text]`);
}),'Ã°ÂÂÂ');

btn(cohostCat,'Ã°ÂÂÂÃ¯Â¸Â Clear Log',requireKey(()=>{
    cohostCommandLog=[];
    cohostLog.innerHTML='<div style="opacity:0.6">Log cleared</div>';
}),'Ã°ÂÂÂÃ¯Â¸Â');

btn(cohostCat,'Ã°ÂÂÂ Test Connection',requireKey(async()=>{
    const ch = getTargetChannel();
    if(!ch){
        showNotif('Ã¢ÂÂ No channel selected','#e74c3c');
        logCoHostCommand('test','Ã¢ÂÂ No channel');
        return;
    }
    
    showNotif('Ã°ÂÂÂ Testing...','#f1c40f');
    logCoHostCommand('test','Checking connection...');
    
    const msgs = await getChannelMsgs(ch,1);
    if(msgs && msgs.length > 0){
        showNotif('Ã¢ÂÂ Connection working!','#43b581');
        logCoHostCommand('test',`Ã¢ÂÂ OK - Last msg from ${msgs[0].author.username}`);
    }else{
        showNotif('Ã¢ÂÂ Connection failed','#e74c3c');
        logCoHostCommand('test','Ã¢ÂÂ Failed - No messages found');
    }
}),'Ã°ÂÂÂ'); 
  

btn(cohostCat,'Ã°ÂÂÂ Status Info',requireKey(()=>{
    alert(`Co-Host Status:
    
Running: ${cohostRunning ? 'YES Ã°ÂÂÂ¢' : 'NO Ã°ÂÂÂ´'}
Mode: ${cohostRunning ? 'CONTINUOUS LOOP' : 'Stopped'}
Check Speed: 500ms (0.5 seconds)
Processed IDs: ${processedMessageIds.size}
User Filter: ${S.cohostUser || 'ALL USERS'}
Prefix: ${S.cohostPrefix || '!'}
Channel: ${getTargetChannel() || 'None'}
License: ${S.timerUnlocked ? 'Active Ã¢ÂÂ' : 'Expired Ã¢ÂÂ'}`);
}),'Ã°ÂÂÂ');
  
const developer = cat('Dev');
  btn(developer, 'ð» Developer', requireKey(async() => {
    showNotif('Developed by: @ogunworthy', '#95a5a6');
}), 'â');




/* ================= PASTE THESE ADDITIONAL COMMANDS ================= */
/* ---------- SEARCH FILTER ---------- */
searchInput.addEventListener('input',()=>{
    const val = searchInput.value.toLowerCase();
    menu.querySelectorAll('div').forEach(d=>{
        if(d.textContent && d.childNodes.length<=3){
            const txt=d.textContent.toLowerCase();
            d.style.display=txt.includes(val)?'':'none';
        }
    });
});

/* ---------- MOBILE DRAG & TAP ---------- */
let dragging=false,moved=false,sx=0,sy=0;
toggle.addEventListener('touchstart',e=>{
    dragging=true; moved=false;
    sx=e.touches[0].clientX; sy=e.touches[0].clientY;
},{passive:true});

toggle.addEventListener('touchmove',e=>{
    if(!dragging) return;
    const t=e.touches[0];
    if(Math.abs(t.clientX-sx)+Math.abs(t.clientY-sy)>6){
        moved=true;
        toggle.style.right=(window.innerWidth-t.clientX-32)+'px';
        toggle.style.bottom=(window.innerHeight-t.clientY-32)+'px';
    }
},{passive:true});

toggle.addEventListener('touchend',()=>{
    if(!moved){
        menu.style.display=menu.style.display==='none'?'flex':'none';
    }
    dragging=false;
});

/* ---------- MENU DRAG ---------- */
let md=false,mx=0,my=0,ox=0,oy=0;
header.addEventListener('touchstart',e=>{
    md=true;
    mx=e.touches[0].clientX; my=e.touches[0].clientY;
    ox=menu.offsetLeft; oy=menu.offsetTop;
},{passive:true});

document.addEventListener('touchmove',e=>{
    if(!md) return;
    const t=e.touches[0];
    menu.style.left=(ox+t.clientX-mx)+'px';
    menu.style.top=(oy+t.clientY-my)+'px';
},{passive:true});

document.addEventListener('touchend',()=>md=false);

/* ---------- DESKTOP DRAG ---------- */
header.addEventListener('mousedown',e=>{
    md=true;
    mx=e.clientX; my=e.clientY;
    ox=menu.offsetLeft; oy=menu.offsetTop;
});

document.addEventListener('mousemove',e=>{
    if(!md) return;
    menu.style.left=(ox+e.clientX-mx)+'px';
    menu.style.top=(oy+e.clientY-my)+'px';
});

document.addEventListener('mouseup',()=>md=false);

/* ---------- TOGGLE MENU ---------- */
toggle.addEventListener('click',()=>{
    menu.style.display=menu.style.display==='none'?'flex':'none';
});

/* ---------- START MONITORING ---------- */
startChannelMonitoring();

/* ---------- INITIAL LICENSE CHECK ---------- */
if(S.userKey && S.timerUnlocked){
    checkLicense().then(result=>{
        if(result.active){
            unlockAllFeatures();
            startLicenseMonitoring();
        }else{
            lockAllFeatures();
        }
    });
}else{
    lockAllFeatures();
}

}
})();
