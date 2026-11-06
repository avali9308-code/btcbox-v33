/* BTCBOX views-account.js — upgraded account/auth views. Load order: after app-core + ui-components. */
"use strict";
/* ===== module bootstrap: inject CSS + load views-missing.js + repoint mobile Account tab ===== */
(function(){
  var CSS_HREF='/assets/css/views-account.css';
  if(!document.querySelector('link[href="'+CSS_HREF+'"]')){
    var l=document.createElement('link');l.rel='stylesheet';l.href=CSS_HREF;document.head.appendChild(l);
  }
  var MISSING_SRC='/assets/js/views-missing.js';
  if(!document.querySelector('script[src="'+MISSING_SRC+'"]')){
    var s=document.createElement('script');s.src=MISSING_SRC;s.async=false;document.head.appendChild(s);
  }
  // mobile bottom-nav "Account" tab → 我的 (#/me)
  document.querySelectorAll('.mob-tab[data-route=account]').forEach(function(a){a.setAttribute('href','#/me');});
})();

/* ===== Logout confirm (shared by me page + anywhere else) ===== */
window.confirmLogout = function(){
  if(typeof BTCBox==='undefined'||!BTCBox.modal){
    (async function(){
      var r=null;
      try{r=await apiAdapter.logout();}catch(e){}
      var unknown=!r||Number(r.status||0)===0||r.code==='NETWORK_ERROR'||r.code==='NETWORK_RESPONSE_ERROR'||Number(r.status)>=500;
      if(r&&r.ok===true){
        try{if(window.supabaseClient)await window.supabaseClient.auth.signOut();}catch(e){}
        clearPrivateUserState();location.hash='#/login';return;
      }
      if(unknown){
        clearPrivateUserState();location.hash='#/login';
        toast('Sign-out status could not be confirmed. Local account data was cleared; please sign in again.','warn');
      }
    })();
    return;
  }
  BTCBox.modal({
    title:'Log Out?',
    content:'You will need to sign in again to view your account.',
    buttons:[
      {text:'Cancel',variant:'ghost',onClick:function(close){close();}},
      {text:'Log Out',variant:'danger',onClick:function(close,btn){
        btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Signing out…';
        (async function(){
          var r=null,failed=false,unknown=false,errMsg='';
          try{r=await apiAdapter.logout();}
          catch(e){failed=true;unknown=true;errMsg='Sign-out response could not be confirmed.';}
          if(!failed&&(!r||r.ok!==true)){
            failed=true;
            unknown=!!(!r||Number(r.status||0)===0||r.code==='NETWORK_ERROR'||r.code==='NETWORK_RESPONSE_ERROR'||Number(r.status)>=500);
            errMsg=unknown?'Sign-out response could not be confirmed.':'Sign-out failed. Please try again.';
            if(r&&(r.error||r.message||r.msg)&&!unknown)errMsg=r.error||r.message||r.msg;
          }
          if(failed){
            if(unknown){
              clearPrivateUserState();close();location.hash='#/login';
              toast('Sign-out status could not be confirmed. Local account data was cleared; please sign in again.','warn');
              return;
            }
            btn.disabled=false;btn.textContent='Log Out';
            BTCBox.modal({title:'Sign-Out Failed',content:errMsg,buttons:[{text:'OK',variant:'primary',onClick:function(c){c();}}]});
            return;
          }
          try{if(window.supabaseClient)await window.supabaseClient.auth.signOut();}catch(e){}
          clearPrivateUserState();close();
          if(typeof toast==='function')toast('Signed out.','ok');
          location.hash='#/login';
        })();
      }}
    ],
    closable:true
  });
};

/* ===== shared header helper ===== */
function vaHeader(title, sub, backHref){
  return '<div class="va-header">'+
    '<a class="va-back" href="'+(backHref||'#/me')+'" aria-label="Back">'+
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>'+
    '</a>'+
    '<div style="flex:1;min-width:0"><h1 class="va-title">'+title+'</h1>'+(sub?'<div class="va-sub">'+sub+'</div>':'')+'</div>'+
  '</div>';
}

/* ================= KYC ================= */
function kycStatusValue(){
  var raw=state.kyc&&state.kyc.status;
  return raw&&typeof raw==='object'?String(raw.status||'unverified').toLowerCase():String(raw||'unverified').toLowerCase();
}
VIEWS.kyc = function(){
  // The current API's kyc_level is derived from status (pending=1, approved=2),
  // not a separately confirmed tier number. Do not present that status code as Lv.2.
  var st=kycStatusValue(), approved=st==='approved';
  var tiers=[
    {n:0,name:'Unverified',desc:'Deposits only; withdrawals and trading are unavailable.',limit:'0 USDT daily withdrawal',cls:'',badge:'<span class="va-badge va-badge-muted"><span class="va-dot"></span>Unverified</span>'},
    {n:1,name:'Basic Verification',desc:'Name and identity document; takes about 5 minutes.',limit:'2 BTC daily withdrawal',cls:(approved?'va-tier-done':(st==='pending'?'va-tier-pending':'')),badge:(approved?'<span class="va-badge va-badge-up"><span class="va-dot"></span>Approved</span>':(st==='pending'?'<span class="va-badge va-badge-warn"><span class="va-dot"></span>Under Review</span>':'<span class="va-badge va-badge-muted">Locked</span>'))},
    {n:2,name:'Advanced Verification',desc:'Proof of address and enhanced review for higher limits.',limit:'Unlimited withdrawals',cls:'',badge:'<span class="va-badge va-badge-muted">Locked</span>'}
  ];
  var banner='';
  if(st==='pending') banner='<div class="va-banner va-banner-warn">Your verification is under review. We will email the result within approximately 1–2 business days.</div>';
  else if(approved) banner='<div class="va-banner va-banner-ok">Basic verification approved. Apply for advanced verification to increase withdrawal limits.</div>';
  else banner='<div class="va-banner va-banner-info">Complete identity verification to unlock withdrawals and fiat features. Your information is encrypted and used only for verification.</div>';

  var form='';
  if(!approved && st!=='pending'){
    form='<form id="kyc-form">'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">'+
        '<div class="va-field"><label class="va-field-label">Full Name (as shown on document)</label><input id="kyc-name" class="va-input" placeholder="Enter your full name" required></div>'+
        '<div class="va-field"><label class="va-field-label">Document Type</label><select id="kyc-idtype" class="va-input" style="appearance:none"><option value="passport">Passport</option><option value="id_card">Identity Card</option><option value="driver_license">Driver License</option></select></div>'+
      '</div>'+
      '<div class="va-field"><label class="va-field-label">Document Number</label><input id="kyc-idnum" class="va-input num" placeholder="Enter document number" required></div>'+
      '<div class="va-field"><label class="va-field-label">Document Photo</label><div id="kyc-upload" style="border:1px dashed var(--border-strong);border-radius:10px;padding:22px;text-align:center;color:var(--text-muted);font-size:13px;cursor:pointer">No photo upload is required in this version; submit your document details below.</div></div>'+
      '<button type="submit" class="btn btn-primary btn-block" style="padding:12px;margin-top:6px">Submit for Review</button>'+
    '</form>';
  } else if(approved){
    form='<div class="va-empty"><div class="va-empty-title">Advanced verification is handled by support</div><div class="va-empty-sub">Contact the support team to confirm the current requirements and availability.</div><a href="#/support" class="btn btn-ghost btn-block" style="padding:12px;margin-top:12px">Ask Support About Advanced Verification</a></div>';
  } else {
    form='<div class="va-empty"><div class="va-empty-title">Under Review</div><div class="va-empty-sub">The result will be sent by email</div></div>';
  }

  return '<div class="va-account-page va-page va-page-narrow">'+
    vaHeader('Identity Verification (KYC)','Higher verification levels unlock higher withdrawal limits','#/me')+
    '<div class="va-tiers">'+tiers.map(function(t){
      return '<div class="va-tier '+t.cls+'"><div class="va-tier-head"><span class="va-tier-name">Lv.'+t.n+' '+t.name+'</span>'+t.badge+'</div>'+
        '<div class="va-tier-desc">'+t.desc+'</div><div class="va-tier-limit">'+t.limit+'</div></div>';
    }).join('')+'</div>'+
    banner+
    '<div class="card" style="padding:20px">'+
      '<div class="va-section-title">'+(!approved&&st!=='pending'?'Submit Basic Verification':'Verification Status')+'</div>'+
      form+
    '</div>'+
  '</div>';
};
VIEWS.kyc.afterRender = function(){
  var f=$('#kyc-form');
  var kycUserKey=state.user&&String(state.user.uid||state.user.email||'')||'';
  var submitting=false, outcomeUnknown=!!(kycUserKey&&state._kycUnknownUserKey===kycUserKey);
  function isKycOutcomeUnknown(r){
    if(!r||Number(r.status||0)===0||r.code==='NETWORK_ERROR'||r.code==='NETWORK_RESPONSE_ERROR')return true;
    return Number(r.status)===408||Number(r.status)>=500;
  }
  async function reconcileKycOutcome(btn){
    var check=null;
    try{check=await apiAdapter.account();}catch(reconcileError){}
    if(check&&check.ok){
      var status=kycStatusValue();
      if(status==='pending'||status==='approved'){
        state.kyc={level:status==='approved'?2:1,status:status};
        if(kycUserKey&&state._kycUnknownUserKey===kycUserKey)delete state._kycUnknownUserKey;
        outcomeUnknown=false;
        toast(status==='pending'?'Your verification application was received and is under review.':'Your identity verification is already approved.','ok');
        router();
        return true;
      }
    }
    // A non-pending account snapshot immediately after a timeout is not proof that
    // the original request can never commit. Keep the form locked rather than retry.
    outcomeUnknown=true;
    if(kycUserKey)state._kycUnknownUserKey=kycUserKey;
    btn.disabled=true; btn.textContent='Status Unconfirmed';
    toast('We could not confirm whether your application was received. Do not submit it again; refresh account status or contact support.','warn');
    return false;
  }
  if(f&&outcomeUnknown){
    var pendingBtn=f.querySelector('button[type=submit]');
    if(pendingBtn){pendingBtn.disabled=true;pendingBtn.textContent='Status Unconfirmed';reconcileKycOutcome(pendingBtn);}
  }
  if(f) f.onsubmit=async function(e){
    e.preventDefault();
    if(submitting||outcomeUnknown)return;
    var btn=f.querySelector('button[type=submit]');
    if(!btn)return;
    var old=btn.textContent;
    submitting=true; btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Submitting…';
    try{
      var r;
      try{
        r=await apiAdapter.kycSubmit({name:$('#kyc-name').value,id_type:$('#kyc-idtype').value,id_number:$('#kyc-idnum').value});
      }catch(err){
        await reconcileKycOutcome(btn);
        return;
      }
      if(r&&r.ok){
        if(kycUserKey&&state._kycUnknownUserKey===kycUserKey)delete state._kycUnknownUserKey;
        outcomeUnknown=false;
        state.kyc={level:0,status:'pending'};
        toast('KYC submitted for review.','ok');
        router();
      }else if(r&&r.code==='KYC_ALREADY_PENDING'){
        if(kycUserKey&&state._kycUnknownUserKey===kycUserKey)delete state._kycUnknownUserKey;
        outcomeUnknown=false;
        state.kyc={level:1,status:'pending'};
        toast('Your identity verification is already under review.','ok');
        router();
      }else if(r&&r.code==='KYC_ALREADY_APPROVED'){
        if(kycUserKey&&state._kycUnknownUserKey===kycUserKey)delete state._kycUnknownUserKey;
        outcomeUnknown=false;
        state.kyc={level:2,status:'approved'};
        toast('Your identity verification is already approved.','ok');
        router();
      }else if(isKycOutcomeUnknown(r)){
        await reconcileKycOutcome(btn);
      }else{
        toast((r&&(r.error||r.message||r.msg))||'Submission failed. Check your information and try again.','err');
      }
    }finally{
      submitting=false;
      if(!outcomeUnknown){btn.disabled=false;btn.textContent=old;}
    }
  };
  var up=$('#kyc-upload'); if(up) up.onclick=function(){toast('No photo upload is required in this version.','ok');};
};

/* ================= Support ================= */
VIEWS.support = function(){
  return '<div class="va-account-page va-page va-page-narrow va-support-page">'+
    vaHeader('Support Center','Send a question to the BTCBOX support team','#/me')+
    '<section class="va-support-intro">'+
      '<span class="va-support-intro-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h8M8 14h5"/></svg></span>'+
      '<span><b>How can we help?</b><small>Your message will be submitted to the support system.</small></span>'+
    '</section>'+
    '<section class="card va-chat-wrap" aria-label="Support conversation">'+
      '<div class="va-chat-head"><span class="va-support-brand-mark" aria-hidden="true">B</span><span class="va-support-head-copy"><b>BTCBOX Support</b><small>Message Center</small></span></div>'+
      '<div id="chat-body" class="va-chat-body scroll" aria-live="polite" aria-relevant="additions text"></div>'+
      '<div class="va-chat-input"><input id="chat-input" class="va-input" type="text" aria-label="Your support message" placeholder="Describe your question…" style="flex:1"><button id="chat-send" type="button" class="btn btn-primary" style="min-height:44px">Send</button></div>'+
    '</section>'+
    '<section class="va-support-topics" aria-labelledby="support-topics-title">'+
      '<div class="va-support-topics-title" id="support-topics-title">Quick topics</div>'+
      ['How long do deposits take?','What are the trading fees?','How do I enable 2FA?','How does Earn work?'].map(function(q){
        return '<button type="button" class="chat-q btn btn-ghost">'+q+'</button>';
      }).join('')+
    '</section>'+
  '</div>';
};
VIEWS.support.afterRender = function(){
  var supportUserKey=state.user&&String(state.user.uid||state.user.email||'')||'';
  if(state._supportMessagesUserKey!==supportUserKey){
    state.supportMsgs=[];
    state._supportMessagesUserKey=supportUserKey;
  }
  if(!Array.isArray(state.supportMsgs)) state.supportMsgs=[];
  var greeting={from:'bot',text:'Hello, I am the BTCBOX support assistant. Describe your question and I will help or connect you with an agent.',ts:Date.now()};
  if(!state.supportMsgs.length) state.supportMsgs.push(greeting);
  var sendInFlight=false;
  var historyLoading=false;
  var historyFailed=false;
  var chatInput=$('#chat-input'), chatSend=$('#chat-send');
  var historyNotice=document.createElement('div');
  historyNotice.style.cssText='display:none;padding:10px 12px;margin:8px 0;border:1px solid var(--warning);border-radius:8px;color:var(--text-secondary);font-size:12px;line-height:1.5';
  historyNotice.setAttribute('role','status');
  historyNotice.setAttribute('aria-live','polite');
  var historyRetry=document.createElement('button');
  historyRetry.type='button';
  historyRetry.className='btn btn-ghost';
  historyRetry.style.cssText='margin-left:8px;padding:5px 9px;min-height:30px;font-size:12px';
  historyRetry.textContent='Retry';
  var historyNoticeText=document.createTextNode('Conversation history could not be loaded. Sending is paused to avoid duplicate messages. ');
  historyNotice.appendChild(historyNoticeText);
  historyNotice.appendChild(historyRetry);
  var chatBody=$('#chat-body');
  if(chatBody&&chatBody.parentNode) chatBody.parentNode.insertBefore(historyNotice,chatBody.nextSibling);
  function setHistoryControls(){
    var blocked=historyLoading||historyFailed;
    if(chatSend){chatSend.disabled=blocked;chatSend.textContent=historyLoading?'Loading…':historyFailed?'History Unavailable':'Send';}
    if(chatInput) chatInput.disabled=blocked;
    $$('.chat-q').forEach(function(b){b.disabled=blocked;});
    historyNotice.style.display=historyFailed?'block':'none';
  }
  function render(){
    var body=$('#chat-body');
    if(!body)return;
    // Message text is untrusted (user input and server history): never parse it as HTML.
    while(body.firstChild) body.removeChild(body.firstChild);
    state.supportMsgs.forEach(function(m){
      var item=document.createElement('div');
      item.className=m.from==='bot'?'bot-msg':'user-msg';
      item.style.fontSize='13px';
      item.style.lineHeight='1.5';
      item.textContent=String(m.text==null?'':m.text);
      body.appendChild(item);
    });
    body.scrollTop=body.scrollHeight;
  }
  render();
  async function loadHistory(){
    if(historyLoading||!supportUserKey)return;
    historyLoading=true;historyFailed=false;setHistoryControls();
    try{
      // The server stores conversations per authenticated user; refresh on every visit and before sending.
      var r=await apiAdapter.supportMessages();
      if(state._supportMessagesUserKey!==supportUserKey)return;
      if(!r||r.ok!==true||!Array.isArray(state.supportMsgs)) throw new Error('History unavailable');
      if(!state.supportMsgs.length) state.supportMsgs.push(greeting);
      historyNoticeText.textContent='Conversation history could not be loaded. Sending is paused to avoid duplicate messages. ';
      render();
    }catch(err){
      if(state._supportMessagesUserKey===supportUserKey){
        historyFailed=true;
        toast('Conversation history is unavailable. Sending is paused until it can be loaded.','warn');
      }
    }finally{
      if(state._supportMessagesUserKey===supportUserKey){
        historyLoading=false;
        setHistoryControls();
      }
    }
  }
  historyRetry.onclick=loadHistory;
  if(supportUserKey) loadHistory();
  async function send(text){
    var message=String(text||'').trim();
    if(!message||sendInFlight||historyLoading||historyFailed)return;
    sendInFlight=true;
    var sendBtn=$('#chat-send'), input=$('#chat-input');
    var oldLabel=sendBtn?sendBtn.textContent:'Send';
    if(sendBtn){sendBtn.disabled=true;sendBtn.textContent='Sending…';}
    try{
      var r=await apiAdapter.supportChat(message);
      if(!r||r.ok!==true){
        var ambiguous=!!(r&&(r.status===0||r.code==='NETWORK_ERROR'||r.status>=500));
        if(ambiguous){
          historyFailed=true;
          historyNoticeText.textContent='Message delivery is unconfirmed. Reload conversation history before sending again. ';
          setHistoryControls();
        }
        toast(ambiguous
          ?'Delivery could not be confirmed. Reload conversation history before trying again.'
          :(r&&(r.error||r.message))||'Message was not sent. Please check and try again.','err');
        if(input&&!input.value.trim()) input.value=message;
        return;
      }
      state.supportMsgs.push({from:'user',text:message,ts:Date.now()});
      if(input&&input.value.trim()===message) input.value='';
      render();
    }catch(e){
      historyFailed=true;
      historyNoticeText.textContent='Message delivery is unconfirmed. Reload conversation history before sending again. ';
      setHistoryControls();
      toast('Delivery could not be confirmed. Reload conversation history before trying again.','warn');
      if(input&&!input.value.trim()) input.value=message;
    }finally{
      sendInFlight=false;
      setHistoryControls();
    }
  }
  $('#chat-send').onclick=function(){send($('#chat-input').value);};
  $('#chat-input').onkeydown=function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(e.target.value);}};
  $$('.chat-q').forEach(function(b){b.onclick=function(){send(b.textContent);};});
};

/* ================= Settings ================= */
VIEWS.settings = function(){
  var twofaOn=!!state.settings.twofa;
  var fundSet=!!state.settings.fundPwdSet;
  return '<div class="va-account-page va-page va-page-narrow va-settings-page">'+
    vaHeader('Settings','Security controls and account preferences','#/me')+
    '<section class="va-settings-overview" aria-label="Security overview">'+
      '<div class="va-settings-overview-head"><span class="va-settings-shield" aria-hidden="true">✓</span><span><b>Protect your account</b><small>Review your sign-in and withdrawal security controls</small></span></div>'+
      '<div class="va-settings-status-grid">'+
        '<div class="va-settings-status"><span>Two-factor authentication</span><b class="'+(twofaOn?'is-on':'is-off')+'">'+(twofaOn?'Enabled':'Not enabled')+'</b></div>'+
        '<div class="va-settings-status"><span>Fund password</span><b class="'+(fundSet?'is-on':'is-off')+'">'+(fundSet?'Configured':'Not configured')+'</b></div>'+
      '</div>'+
    '</section>'+
    '<section class="va-settings-group" aria-labelledby="settings-security-title">'+
      '<div class="va-settings-group-head"><div><h2 id="settings-security-title">Account Security</h2><p>Manage credentials and additional account protection</p></div></div>'+
      '<div class="va-settings-list">'+
        '<div class="va-settings-row"><span class="va-settings-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span><div class="va-settings-copy"><b>Login Password</b><small>Update the password used to sign in</small></div><button type="button" id="set-pwd" class="btn btn-ghost btn-sm">Change</button></div>'+
        '<div class="va-settings-row"><span class="va-settings-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 20 7v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="m9 12 2 2 4-4"/></svg></span><div class="va-settings-copy"><b>Fund Password</b><small>'+(fundSet?'A separate password is configured for protected fund actions':'Set a separate password to protect fund actions')+'</small></div><button type="button" id="set-fundpwd" class="btn btn-ghost btn-sm">'+(fundSet?'Change':'Set up')+'</button></div>'+
        '<div class="va-settings-row"><span class="va-settings-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12v-2a4 4 0 0 1 8 0v2M8 12h8v5H8z"/></svg></span><div class="va-settings-copy"><b>Two-Factor Authentication</b><small>'+(twofaOn?'An additional verification step is enabled':'Add an extra verification step to your account')+'</small></div><button type="button" id="set-2fa" class="btn '+(twofaOn?'btn-red':'btn-primary')+' btn-sm">'+(twofaOn?'Disable':'Enable')+'</button></div>'+
      '</div>'+
    '</section>'+
    '<section class="va-settings-group" aria-labelledby="settings-preferences-title">'+
      '<div class="va-settings-group-head"><div><h2 id="settings-preferences-title">Preferences</h2><p>Personalize your account display</p></div></div>'+
      '<div class="va-settings-list">'+
        '<div class="va-settings-row"><span class="va-settings-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/><circle cx="12" cy="12" r="2.5"/></svg></span><div class="va-settings-copy"><b>Hide Small Balances</b><small>Hide assets valued below 1 USDT on the Assets page</small></div><label class="va-switch"><input type="checkbox" id="pref-hide" '+(state.settings.hideSmall?'checked':'')+'><span class="va-slider"></span></label></div>'+
        '<div class="va-settings-row"><span class="va-settings-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 6h16M12 6v13M8 19l4-8 4 8M7 10h10"/></svg></span><div class="va-settings-copy"><b>Interface Language</b><small>Current display language</small></div><span class="va-settings-value">English</span></div>'+
      '</div>'+
    '</section>'+
  '</div>';
};
VIEWS.settings.afterRender = function(){
  $('#set-pwd').onclick=function(){
    modal('Change Login Password','<form id="pwd-form"><div style="margin-bottom:12px"><label class="auth-label">Current Password</label><input id="pwd-old" class="auth-input" type="password" required></div><div style="margin-bottom:12px"><label class="auth-label">New Password</label><input id="pwd-new" class="auth-input" type="password" required></div><div style="margin-bottom:16px"><label class="auth-label">Confirm New Password</label><input id="pwd-new2" class="auth-input" type="password" required></div><button class="btn btn-primary btn-block">Update Password</button></form>',function(close){
      var pwdModalUserKey=state.user&&String(state.user.uid||state.user.email||'')||'';
    if(pwdModalUserKey&&state._passwordChangeUnknownUserKey===pwdModalUserKey){var pwdStatusButton=$('#pwd-form button');if(pwdStatusButton){pwdStatusButton.disabled=true;pwdStatusButton.textContent='Status Unconfirmed';}}
    $('#pwd-form').onsubmit=async function(e){
        e.preventDefault();
        if($('#pwd-new').value!==$('#pwd-new2').value){toast('The new passwords do not match.','err');return;}
        var pwdUserKey=state.user&&String(state.user.uid||state.user.email||'')||'';
        if(pwdUserKey&&state._passwordChangeUnknownUserKey===pwdUserKey){toast('The previous password change is still unconfirmed. Verify your sign-in status before trying again.','warn');return;}
        var btn=$('#pwd-form button'); var old=btn.textContent; btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Updating…';
        var r, pwdUnknown=false;
        try{ r=await apiAdapter.changePassword({old_password:$('#pwd-old').value,new_password:$('#pwd-new').value}); }
        catch(err){pwdUnknown=true;}
        if(!pwdUnknown&&(!r||Number(r.status||0)===0||Number(r.status||0)>=500||r.code==='NETWORK_ERROR'||r.code==='NETWORK_RESPONSE_ERROR'))pwdUnknown=true;
        if(pwdUnknown){
          if(pwdUserKey)state._passwordChangeUnknownUserKey=pwdUserKey;
          btn.disabled=true;btn.textContent='Status Unconfirmed';
          toast('The password change may have been applied. Verify account access before attempting another change.','warn');
          return;
        }
        btn.disabled=false;btn.textContent=old;
        if(r&&r.ok){toast('Password updated.','ok');close();}else toast((r&&(r.error||r.message||r.msg))||'Update failed.','err');
      };
    });
  };
  $('#set-fundpwd').onclick=function(){
    modal(fundSet?'Change Fund Password':'Set Fund Password','<form id="fp-form"><div style="margin-bottom:12px"><label class="auth-label">'+(fundSet?'Current Fund Password':'New Fund Password (6 digits)')+'</label><input id="fp-new" class="auth-input num" type="password" maxlength="6" required></div><div style="margin-bottom:16px"><label class="auth-label">Current Login Password</label><input id="fp-cur" class="auth-input" type="password" required></div><button class="btn btn-primary btn-block">'+(fundSet?'Confirm Change':'Set Fund Password')+'</button></form>',function(close){
      var fundModalUserKey=state.user&&String(state.user.uid||state.user.email||'')||'';
      if(fundModalUserKey&&state._fundPasswordUnknownUserKey===fundModalUserKey){var fundStatusButton=$('#fp-form button');if(fundStatusButton){fundStatusButton.disabled=true;fundStatusButton.textContent='Status Unconfirmed';}}
      $('#fp-form').onsubmit=async function(e){
        e.preventDefault();
        if(!/^\d{6}$/.test($('#fp-new').value)){toast('Fund password must be 6 digits.','err');return;}
        var fundUserKey=state.user&&String(state.user.uid||state.user.email||'')||'';
        if(fundUserKey&&state._fundPasswordUnknownUserKey===fundUserKey){toast('The previous fund-password change is still unconfirmed. Verify the account security status before trying again.','warn');return;}
        var btn=$('#fp-form button'); var old=btn.textContent; btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Submitting…';
        var r, fundUnknown=false;
        try{r=await apiAdapter.setFundPassword({fund_password:$('#fp-new').value,current_password:$('#fp-cur').value});}
        catch(err){fundUnknown=true;}
        if(!fundUnknown&&(!r||Number(r.status||0)===0||Number(r.status||0)>=500||r.code==='NETWORK_ERROR'||r.code==='NETWORK_RESPONSE_ERROR'))fundUnknown=true;
        if(fundUnknown){
          if(fundUserKey)state._fundPasswordUnknownUserKey=fundUserKey;
          btn.disabled=true;btn.textContent='Status Unconfirmed';
          toast('The fund-password change may have been applied. Verify account security status before attempting another change.','warn');
          return;
        }
        btn.disabled=false;btn.textContent=old;
        if(r&&r.ok){state.settings.fundPwdSet=true;toast('Fund password set.','ok');close();router();}else toast((r&&(r.error||r.message||r.msg))||'Setup failed.','err');
      };
    });
  };
  var fundSet=!!state.settings.fundPwdSet;
  var securityUserKey=state.user&&String(state.user.uid||state.user.email||'')||'';
  var twofaOutcomeUnknown=!!(securityUserKey&&state._twofaChangeUnknownUserKey===securityUserKey);
  var twofaButton=$('#set-2fa');
  if(twofaButton&&twofaOutcomeUnknown){twofaButton.disabled=true;twofaButton.textContent='Status Unconfirmed';}
  $('#set-2fa').onclick=async function(){
    var btn=$('#set-2fa');
    if(!btn||btn.disabled||twofaOutcomeUnknown)return;
    var old=btn.textContent;
    var enabling=!state.settings.twofa;
    var confirmed=false;
    btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Processing…';
    try{
      var r=enabling?await apiAdapter.twofaEnable():await apiAdapter.twofaDisable();
      if(r&&r.ok===true){
        confirmed=true;
        toast(enabling?'Two-factor authentication enabled.':'Two-factor authentication disabled.','ok');
      }else{
        var status=Number(r&&r.status||0);
        var unknown=!r||status===0||status>=500||!!(r&&(r.code==='NETWORK_ERROR'||r.code==='NETWORK_RESPONSE_ERROR'));
        if(unknown){
          twofaOutcomeUnknown=true;
          if(securityUserKey)state._twofaChangeUnknownUserKey=securityUserKey;
          btn.textContent='Status Unconfirmed';
          toast('The security change may have been applied. Check account security status before trying again.','warn');
          return;
        }
        toast((r&&(r.msg||r.error))||'The server did not confirm this security change. Please try again.','err');
      }
    }catch(e){
      twofaOutcomeUnknown=true;
      if(securityUserKey)state._twofaChangeUnknownUserKey=securityUserKey;
      btn.textContent='Status Unconfirmed';
      toast('The security change may have been applied. Check account security status before trying again.','warn');
      return;
    }finally{
      if(!twofaOutcomeUnknown){btn.disabled=false;btn.textContent=old;}
    }
    if(confirmed) router();
  };
  $('#pref-hide').onchange=function(e){state.settings.hideSmall=e.target.checked;toast('Preference saved.','ok');};
};

/* ================= Admin ================= */
VIEWS.admin = function(){
  return '<div class="va-account-page va-page" style="max-width:1200px">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:12px">'+
      '<div style="display:flex;align-items:center;gap:12px">'+
        '<a class="va-back" href="#/markets" aria-label="Back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></a>'+
        '<h1 class="va-title" style="margin:0">管理后台 Admin Console</h1>'+
      '</div>'+
      '<span class="tag" style="background:rgba(240,185,11,.12);color:var(--warning)">管理员 — HTTP Basic Auth</span>'+
    '</div>'+
    '<div id="admin-stats" class="va-admin-stats">'+skeleton(4,1)+'</div>'+
    '<div id="admin-err" style="display:none" class="va-banner va-banner-err"></div>'+
    '<div class="card" style="padding:0;margin-bottom:16px">'+
      '<div style="display:flex;border-bottom:1px solid var(--border);overflow-x:auto" class="no-scrollbar">'+
        '<div class="tab active" data-atab="users">用户管理</div><div class="tab" data-atab="deposits">充值地址</div><div class="tab" data-atab="withdrawals">提币审批</div><div class="tab" data-atab="kyc">KYC 审核</div><div class="tab" data-atab="seconds">秒合约</div>'+
      '</div>'+
      '<div id="admin-body" style="overflow-x:auto" class="scroll">'+skeleton(5,4)+'</div>'+
    '</div>'+
  '</div>';
};
VIEWS.admin.afterRender = function(){
  apiAdapter.adminStats().then(function(r){
    if(!r.ok){
      var err=$('#admin-err'); if(err){err.style.display='block';err.textContent='统计数据加载失败：'+(r.error||'请确认管理员权限与网络连接。');}
      $('#admin-stats').innerHTML='';
      return;
    }
    var cards=[['总用户数',r.total_users,'var(--brand-bright)'],['待处理提现',r.pending_withdrawals,'var(--warning)'],['待审核 KYC',r.pending_kyc,'var(--down)'],['充值地址数',r.deposit_addresses,'var(--text-secondary)']];
    $('#admin-stats').innerHTML=cards.map(function(c){
      return '<div class="card va-stat"><div class="va-stat-label">'+c[0]+'</div><div class="va-stat-val" style="color:'+c[2]+'">'+fmt(c[1],0)+'</div></div>';
    }).join('');
  }).catch(function(){
    var err=$('#admin-err'); if(err){err.style.display='block';err.textContent='网络错误，统计数据加载失败。';}
  });
  async function runAdminAction(button, action, successText, pendingText){
    if(button.disabled) return;
    var oldText=button.textContent;
    var row=button.closest('tr');
    var rowButtons=row?Array.from(row.querySelectorAll('button')):[button];
    var previousDisabled=rowButtons.map(function(item){return item.disabled;});
    rowButtons.forEach(function(item){item.disabled=true;});
    button.textContent=pendingText||'处理中…';
    try{
      var result=await action();
      if(result&&result.ok){
        button.textContent=successText;
        toast(successText,'ok');
        return;
      }
      var status=Number(result&&result.status||0);
      var unknown=status===0||status>=500||!!(result&&(result.code==='NETWORK_ERROR'||result.code==='NETWORK_RESPONSE_ERROR'));
      if(unknown){
        button.textContent='结果待核实';
        toast('操作结果暂时无法确认。请先刷新并核对服务器记录，不要重复执行。','warn');
        return;
      }
      rowButtons.forEach(function(item,index){item.disabled=previousDisabled[index];});
      button.textContent=oldText;
      toast((result&&(result.error||result.msg||result.message))||'操作未成功，请检查权限和服务器返回。','err');
    }catch(error){
      button.textContent='结果待核实';
      toast('网络中断，操作结果无法确认。请先核对服务器记录，不要重复执行。','warn');
    }
  }
  /* Admin sensitive-action confirmation. Resolves true only after the operator explicitly confirms.
     Summary HTML must be built with escapeHtml() around every record field. */
  function confirmAdminAction(title, summaryHTML){
    return new Promise(function(resolve){
      if(!(window.BTCBox&&BTCBox.modal)){ resolve(true); return; }
      BTCBox.modal({title:title, width:'md', closable:true,
        content:'<div style="font-size:14px;line-height:1.8;color:var(--text-secondary)">'+summaryHTML+'</div><div style="margin-top:14px;padding:10px 12px;border-radius:8px;background:rgba(246,180,60,.08);border:1px solid var(--warning);color:var(--warning);font-size:12px">此操作立即生效并写入审计日志。请核对上述信息，确认无误后再执行。</div>',
        buttons:[
          {text:'取消', variant:'ghost', onClick:function(close){close();resolve(false);}},
          {text:'确认执行', variant:'danger', onClick:function(close){close();resolve(true);}}
        ]});
    });
  }
  function render(tab, loaded){
    if(tab==='deposits' && !loaded){
      $('#admin-body').innerHTML=skeleton(8,2);
      apiAdapter.adminConfig().then(function(r){
        if(!r||!r.ok||!r.deposit_addresses){
          $('#admin-body').innerHTML=emptyState('充值地址配置暂不可用',(r&&(r.msg||r.error))||'请检查管理员权限与配置接口。');
          return;
        }
        if(!state.admin)state.admin={};
        state.admin.depositAddresses=r.deposit_addresses;
        render('deposits',true);
      }).catch(function(){
        $('#admin-body').innerHTML=emptyState('充值地址配置暂不可用','网络错误。请刷新后重试。');
      });
      return;
    }
    if(tab==='withdrawals' && !loaded){
      $('#admin-body').innerHTML=skeleton(6,3);
      apiAdapter.adminWithdrawals().then(function(r){
        if(!r||!r.ok||!Array.isArray(r.withdrawals)){
          $('#admin-body').innerHTML=emptyState('提现列表暂时不可用','请检查管理员权限和财务数据库连接，稍后刷新重试。');
          return;
        }
        if(!state.admin) state.admin={};
        state.admin.withdrawals=r.withdrawals;
        render('withdrawals',true);
      }).catch(function(){
        $('#admin-body').innerHTML=emptyState('提现列表暂时不可用','网络错误。请刷新后再试。');
      });
      return;
    }
    if(tab==='seconds' && !loaded){
      $('#admin-body').innerHTML=skeleton(6,3);
      Promise.all([apiAdapter.adminSecondsPolicy(),apiAdapter.adminSecondsPositions({limit:200,offset:0})]).then(function(results){
        const policyResult=results[0], positionsResult=results[1];
        if(!policyResult||!policyResult.ok||!policyResult.policy){
          $('#admin-body').innerHTML=emptyState('秒合约策略暂不可用','数据库策略表尚未完成迁移或管理员接口暂不可用。');
          return;
        }
        const p=policyResult.policy;
        let positions=positionsResult&&positionsResult.ok&&Array.isArray(positionsResult.positions)?positionsResult.positions:[];
        const positionsAvailable=!!(positionsResult&&positionsResult.ok&&Array.isArray(positionsResult.positions));
        const totalPositions=Number(positionsResult&&positionsResult.total||0);
        const durationText=(p.allowed_durations||[]).join(', ');
        const rowHtml=function(x){
          return '<tr class="trow"><td class="td">'+escapeHtml(x.email||x.user_id)+'</td><td class="td num">'+escapeHtml(x.position_id)+'</td><td class="td">'+escapeHtml(x.symbol)+'/USDT</td><td class="td">'+escapeHtml(x.direction)+'</td><td class="td num">'+escapeHtml(x.amount)+'</td><td class="td">'+escapeHtml(x.duration_sec)+'s</td><td class="td num">'+escapeHtml((Number(x.payout_rate)*100).toFixed(2))+'%</td><td class="td">'+escapeHtml(x.settle_at?new Date(Number(x.settle_at)*1000).toLocaleString():'—')+'</td></tr>';
        };
        const queueMarkup=!positionsAvailable
          ? '<div style="padding:16px;color:var(--warning)">未完成仓位列表加载失败。请检查数据库迁移状态与管理员接口；这里不会把加载失败显示成“没有订单”。</div>'
          : positions.length
            ? '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:900px"><thead><tr><th class="th">用户</th><th class="th">仓位 ID</th><th class="th">标的</th><th class="th">方向</th><th class="th num">金额</th><th class="th">周期</th><th class="th num">盈利比例</th><th class="th">结算时间</th></tr></thead><tbody id="admin-sec-rows">'+positions.map(rowHtml).join('')+'</tbody></table></div><div id="admin-sec-more-wrap" style="padding:12px;text-align:center"><button id="admin-sec-load-more" class="btn btn-ghost">加载更多</button></div>'
            : '<div style="padding:20px;color:var(--text-muted)">当前没有未完成秒合约仓位。</div>';
        $('#admin-body').innerHTML=
          '<div style="padding:16px;border-bottom:1px solid var(--border)">'+
            '<h3 style="margin:0 0 14px">秒合约规则设置</h3>'+
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">'+
              '<label class="auth-label" style="display:flex;align-items:center;gap:8px"><input id="admin-sec-enabled" type="checkbox" '+(p.enabled?'checked':'')+'> 开放秒合约下单</label>'+
              '<div><label class="auth-label">可选周期（秒，逗号分隔）</label><input id="admin-sec-durations" class="auth-input" value="'+escapeHtml(durationText)+'" placeholder="30,60,300,900"></div>'+
              '<div><label class="auth-label">最低金额（USDT）</label><input id="admin-sec-min" class="auth-input num" type="number" min="0.00000001" step="any" value="'+escapeHtml(p.min_order_amount)+'"></div>'+
              '<div><label class="auth-label">最高金额（USDT）</label><input id="admin-sec-max" class="auth-input num" type="number" min="0.00000001" step="any" value="'+escapeHtml(p.max_order_amount)+'"></div>'+
              '<div><label class="auth-label">盈利比例（%，最低 85）</label><input id="admin-sec-payout" class="auth-input num" type="number" min="85" step="0.01" value="'+escapeHtml((Number(p.payout_rate)*100).toFixed(2))+'"></div>'+
            '</div>'+
            '<div style="display:flex;align-items:center;gap:12px;margin-top:14px;flex-wrap:wrap"><button id="admin-sec-save" class="btn btn-primary">保存秒合约规则</button><span style="font-size:12px;color:var(--text-muted)">当前规则版本：'+escapeHtml(p.policy_version)+'</span><span style="font-size:12px;color:var(--text-muted)">新规则只影响新开仓位。</span></div>'+
          '</div>'+
          '<div style="padding:16px"><h3 style="margin:0 0 12px">全部未完成仓位（'+escapeHtml(totalPositions)+'）</h3>'+queueMarkup+'</div>';
        const more=$('#admin-sec-load-more');
        if(more)more.onclick=async function(){
          more.disabled=true;more.textContent='加载中…';
          const next=await apiAdapter.adminSecondsPositions({limit:200,offset:positions.length});
          if(!next||!next.ok||!Array.isArray(next.positions)){more.disabled=false;more.textContent='加载更多';toast('更多未完成仓位暂时无法加载。','err');return;}
          positions=positions.concat(next.positions);
          const tbody=$('#admin-sec-rows');if(tbody)tbody.innerHTML=positions.map(rowHtml).join('');
          if(positions.length>=totalPositions){const wrap=$('#admin-sec-more-wrap');if(wrap)wrap.remove();}
          else{more.disabled=false;more.textContent='加载更多';}
        };
        const save=$('#admin-sec-save');
        if(save)save.onclick=async function(){
          const durations=String($('#admin-sec-durations').value||'').split(',').map(function(v){return Number(v.trim());}).filter(function(v){return Number.isFinite(v);});
          const payout=Number($('#admin-sec-payout').value);
          const payload={enabled:$('#admin-sec-enabled').checked,allowed_durations:durations,
            min_order_amount:$('#admin-sec-min').value,max_order_amount:$('#admin-sec-max').value,payout_rate:payout/100};
          await runAdminAction(save,()=>apiAdapter.adminSecondsPolicyUpdate(payload),'规则已保存');
          const latest=await apiAdapter.adminSecondsPolicy();
          if(latest&&latest.ok&&latest.policy)render('seconds',false);
        };
      }).catch(function(){
        $('#admin-body').innerHTML=emptyState('秒合约数据暂不可用','请检查管理员权限和数据库连接，稍后刷新重试。');
      });
      return;
    }
    if(tab==='deposits'){
      var addressFields=[
        ['USDT-TRC20','USDT · TRC20'],['USDT-ERC20','USDT · ERC20'],['USDT-BEP20','USDT · BEP20'],
        ['BTC-BTC','BTC · Bitcoin'],['ETH-ERC20','ETH · ERC20'],['SOL-SOL','SOL · Solana'],
        ['BNB-BEP20','BNB · BEP20'],['USDC-ERC20','USDC · ERC20']
      ];
      var addresses=state.admin&&state.admin.depositAddresses||{};
      $('#admin-body').innerHTML='<div style="padding:16px"><div style="margin-bottom:14px;color:var(--text-secondary);font-size:13px;line-height:1.7">设置用户充值页实际展示的收款地址。用户按所选币种和网络转账，工作人员核实到账后再从用户账户资产页人工上分。留空并保存可停用该网络地址。</div>'+
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">'+addressFields.map(function(field){
          return '<label class="va-field"><span class="auth-label">'+field[1]+'</span><input class="auth-input num" data-deposit-key="'+field[0]+'" maxlength="180" autocomplete="off" value="'+escapeHtml(addresses[field[0]]||'')+'" placeholder="未配置时用户端显示不可用"></label>';
        }).join('')+'</div>'+
        '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:16px"><button type="button" id="admin-deposit-save" class="btn btn-primary">保存充值地址</button><span id="admin-deposit-status" style="font-size:12px;color:var(--text-muted)">保存后用户充值页会读取最新配置。</span></div></div>';
      var saveButton=$('#admin-deposit-save');
      if(saveButton)saveButton.onclick=async function(){
        if(saveButton.disabled)return;
        var updates={};
        $('[data-deposit-key]').forEach(function(input){updates[input.dataset.depositKey]=input.value.trim();});
        saveButton.disabled=true;saveButton.textContent='保存中…';
        var status=$('#admin-deposit-status');
        if(status)status.textContent='正在保存配置…';
        try{
          var result=await apiAdapter.adminConfig({deposit_addresses:updates});
          if(!result||!result.ok||!result.deposit_addresses){
            if(status)status.textContent=(result&&(result.msg||result.error))||'保存失败，请检查地址格式后重试。';
            saveButton.disabled=false;saveButton.textContent='重新保存';
            toast('充值地址保存失败。','err');
            return;
          }
          if(!state.admin)state.admin={};
          state.admin.depositAddresses=result.deposit_addresses;
          toast('充值地址配置已保存。','ok');
          render('deposits',true);
        }catch(error){
          if(status)status.textContent='网络错误，保存结果未确认；请重新读取配置后再操作。';
          saveButton.disabled=false;saveButton.textContent='重新保存';
          toast('保存结果暂时无法确认，请先重新读取配置。','warn');
        }
      };
      return;
    }
    if(tab==='users' && !loaded){
      $('#admin-body').innerHTML=skeleton(5,4);
      apiAdapter.adminUsers().then(function(r){
        if(!r||!r.ok||!Array.isArray(r.users)){
          $('#admin-body').innerHTML=emptyState('用户列表暂时不可用','请检查管理员权限和服务器连接，稍后刷新重试。');
          return;
        }
        if(!state.admin) state.admin={};
        state.admin.users=r.users;
        render('users',true);
      }).catch(function(){
        $('#admin-body').innerHTML=emptyState('用户列表暂时不可用','网络错误。请刷新后再试。');
      });
      return;
    }
    if(tab==='users'){
      if(!state.admin.users||!state.admin.users.length){$('#admin-body').innerHTML=emptyState('暂无用户数据','用户列表为空。');return;}
      $('#admin-body').innerHTML='<table style="width:100%;border-collapse:collapse;min-width:760px"><thead><tr><th class="th">UID</th><th class="th">邮箱</th><th class="th">KYC</th><th class="th">状态</th><th class="th" style="text-align:right">余额 (USDT)</th><th class="th">操作</th></tr></thead><tbody>'+
        state.admin.users.map(function(u){
          var kyc=String(u.kyc_status||'unverified');
          return '<tr class="trow"><td class="td num" style="font-size:12px">'+escapeHtml(u.uid)+'</td><td class="td">'+escapeHtml(u.email)+'</td><td class="td" style="text-transform:capitalize;color:'+(kyc==='verified'?'var(--up)':kyc==='pending'?'var(--warning)':'var(--text-muted)')+'">'+escapeHtml(kyc)+'</td><td class="td">'+(u.frozen?'<span style="color:var(--down);font-weight:600">已冻结</span>':'<span style="color:var(--up)">正常</span>')+'</td><td class="td num" style="text-align:right">'+fmt(u.total_usdt,2)+'</td><td class="td"><button class="au-account" data-uid="'+escapeHtml(u.uid)+'" style="color:var(--brand-bright);font-size:12px;font-weight:600;margin-right:10px;background:none;border:none;cursor:pointer">账户资产</button><button class="au-freeze" data-uid="'+escapeHtml(u.uid)+'" data-f="'+(u.frozen?0:1)+'" style="color:'+(u.frozen?'var(--up)':'var(--down)')+';font-size:12px;font-weight:600;background:none;border:none;cursor:pointer">'+(u.frozen?'解冻':'冻结')+'</button></td></tr>';
        }).join('')+'</tbody></table><div id="admin-user-account-panel" style="margin:16px"></div>';
      $$('.au-freeze').forEach(function(b){b.onclick=async function(){
        var freeze=b.dataset.f==='1';
        var ok=await confirmAdminAction(freeze?'确认冻结用户':'确认解冻用户','<b>用户 UID：</b>'+escapeHtml(b.dataset.uid)+'<br><b>操作：</b>'+(freeze?'冻结账户（禁止登录与交易）':'解冻账户（恢复正常）'));
        if(!ok)return;
        await runAdminAction(b,()=>apiAdapter.adminFreeze({uid:b.dataset.uid,frozen:freeze,reason:'Admin action'}),'状态已更新');
      };});
      async function showAccountPanel(accountUid, account){
        var panel=$('#admin-user-account-panel');
        if(!panel)return;
        var balances=account.balances&&typeof account.balances==='object'?account.balances:{};
        var assets=['USDT','BTC','ETH','SOL','BNB','USDC'];
        panel.innerHTML='<div class="va-card"><div class="va-card-head"><div><div class="va-card-title">用户账户资产</div><div style="font-size:12px;color:var(--text-muted);margin-top:4px">'+escapeHtml(account.email||'')+' · UID '+escapeHtml(accountUid)+'</div></div><button type="button" class="au-account-close" style="background:none;border:0;color:var(--text-secondary);cursor:pointer">收起</button></div><div class="va-card-body"><div class="va-info" style="margin-bottom:14px">先核实链上实际到账，再从对应币种资产行进行人工上分。用户 UID 和币种会自动绑定，无需手动填写。</div>'+
          assets.map(function(coin){
            var b=balances[coin]||{free:0,frozen:0};
            var free=Number(b.free||0), frozen=Number(b.frozen||0);
            return '<div class="va-card" style="padding:12px;margin:10px 0"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><b>'+coin+'</b><div style="font-size:12px;color:var(--text-muted);margin-top:4px">可用 '+fmt(free,coin==='USDT'?2:8)+' · 冻结 '+fmt(frozen,coin==='USDT'?2:8)+'</div></div><button type="button" class="au-credit-open btn btn-primary" data-coin="'+coin+'" style="padding:8px 12px">人工上分</button></div><form class="au-credit-form" data-coin="'+coin+'" style="display:none;margin-top:12px" autocomplete="off"><div class="va-field"><label class="auth-label">实际到账金额 ('+coin+')</label><input class="auth-input au-credit-amount" type="number" min="0" step="any" required placeholder="输入核实到账金额"></div><div class="va-field"><label class="auth-label">交易哈希 / 参考号（可选）</label><input class="auth-input au-credit-reference" maxlength="120" placeholder="TxID / transfer reference"></div><div class="va-field"><label class="auth-label">备注（可选）</label><input class="auth-input au-credit-note" maxlength="300" placeholder="人工核对说明"></div><button type="submit" class="btn btn-primary" style="padding:10px 16px">确认给此用户上分</button></form></div>';
          }).join('')+'</div></div>';
        $('.au-account-close').forEach(function(b){b.onclick=function(){panel.innerHTML='';};});
        $('.au-credit-open').forEach(function(b){b.onclick=function(){var form=b.closest('.va-card').querySelector('.au-credit-form');if(form){form.style.display=form.style.display==='none'?'block':'none';}};});
        $('.au-credit-form').forEach(function(form){form.onsubmit=async function(event){
          event.preventDefault();
          var coin=form.dataset.coin;
          var amountText=form.querySelector('.au-credit-amount').value.trim();
          var reference=form.querySelector('.au-credit-reference').value.trim();
          var note=form.querySelector('.au-credit-note').value.trim();
          if(!amountText||!Number.isFinite(Number(amountText))||Number(amountText)<=0){toast('请输入有效的实际到账金额。','err');return;}
          var requestKey=form.dataset.requestId||(form.dataset.requestId=uid());
          var confirmed=await confirmAdminAction('确认人工上分','<b>用户：</b>'+escapeHtml(account.email||accountUid)+'<br><b>UID：</b>'+escapeHtml(accountUid)+'<br><b>币种：</b>'+escapeHtml(coin)+'<br><b>到账金额：</b>'+escapeHtml(amountText)+'<br><b>交易参考：</b>'+escapeHtml(reference||'—')+'<br><b>备注：</b>'+escapeHtml(note||'—')+'<br><br>请确认已核实该币种、该网络的实际到账。');
          if(!confirmed)return;
          var button=form.querySelector('button[type="submit"]');
          await runAdminAction(button,()=>apiAdapter.adminConfirmDeposit({uid:accountUid,coin:coin,amount:amountText,reference:reference,note:note,idempotency_key:requestKey}),'已人工上分');
          if(button.textContent==='已人工上分'){
            var refreshed=await apiAdapter.adminUser(accountUid);
            if(refreshed&&refreshed.ok&&refreshed.user) await showAccountPanel(accountUid,refreshed.user);
            apiAdapter.adminUsers().then(function(list){if(list&&list.ok&&Array.isArray(list.users)){state.admin.users=list.users;render('users',true);}});
          }
        };});
      }
      $$('.au-account').forEach(function(b){b.onclick=async function(){
        var panel=$('#admin-user-account-panel');
        if(panel)panel.innerHTML='<div class="va-info">正在读取该用户资产…</div>';
        var result=await apiAdapter.adminUser(b.dataset.uid);
        if(!result||!result.ok||!result.user){if(panel)panel.innerHTML=emptyState('账户资产暂时不可用',(result&&(result.msg||result.error))||'请检查管理员权限和财务数据连接。');return;}
        await showAccountPanel(b.dataset.uid,result.user);
      };});
    } else if(tab==='withdrawals'){
      var wlist=(state.admin.withdrawals||[]).filter(function(w){return w.status==='pending'||w.status==='approved';});
      if(!wlist.length){$('#admin-body').innerHTML=emptyState('暂无待处理提现','新提现申请会显示在这里；已批准的申请需要人工转账后标记完成。');return;}
      $('#admin-body').innerHTML='<table style="width:100%;border-collapse:collapse;min-width:900px"><thead><tr><th class="th">ID</th><th class="th">用户</th><th class="th">币种</th><th class="th" style="text-align:right">数量</th><th class="th">网络</th><th class="th">收款地址</th><th class="th">状态</th><th class="th">操作</th></tr></thead><tbody>'+
        wlist.map(function(w){
          var pending=w.status==='pending';
          var action=pending
            ? '<button class="aw-approve" data-id="'+escapeHtml(w.id)+'" style="color:var(--up);font-weight:600;font-size:12px;margin-right:10px;background:none;border:none;cursor:pointer">批准</button><button class="aw-reject" data-id="'+escapeHtml(w.id)+'" style="color:var(--down);font-weight:600;font-size:12px;background:none;border:none;cursor:pointer">驳回</button>'
            : '<button class="aw-paid" data-id="'+escapeHtml(w.id)+'" style="color:var(--brand-bright);font-weight:600;font-size:12px;background:none;border:none;cursor:pointer">标记已转账</button>';
          return '<tr class="trow"><td class="td num" style="font-size:12px">'+escapeHtml(w.id)+'</td><td class="td">'+escapeHtml(w.uid)+'</td><td class="td">'+escapeHtml(w.coin)+'</td><td class="td num" style="text-align:right">'+fmt(w.amount,w.coin==='USDT'?2:6)+'<div style="font-size:10px;color:var(--text-muted)">Fee '+fmt(w.fee,w.coin==='USDT'?2:6)+'</div></td><td class="td">'+escapeHtml(w.network)+'</td><td class="td num" style="font-size:11px;color:var(--text-secondary);word-break:break-all;max-width:220px">'+escapeHtml(w.address)+'</td><td class="td">'+(pending?'<span style="color:var(--warning)">待审核</span>':'<span style="color:var(--brand-bright)">已批准·待人工转账</span>')+'</td><td class="td">'+action+'</td></tr>';
        }).join('')+'</tbody></table>';
      $('.aw-approve').forEach(function(b){b.onclick=async function(){
        var w=(state.admin.withdrawals||[]).find(function(x){return String(x.id)===String(b.dataset.id);})||{};
        var ok=await confirmAdminAction('批准提现','<b>提现 ID：</b>'+escapeHtml(b.dataset.id)+'<br><b>用户 UID：</b>'+escapeHtml(w.uid||'—')+'<br><b>币种/数量：</b>'+escapeHtml(w.coin||'—')+' '+escapeHtml(w.amount||'—')+'<br><b>网络：</b>'+escapeHtml(w.network||'—')+'<br><b>目标地址：</b>'+escapeHtml(w.address||'—')+'<br><b>批准后：</b>金额完成账本扣除，但仍需工作人员手动转账。');
        if(!ok)return;
        await runAdminAction(b,()=>apiAdapter.adminApproveWithdraw(b.dataset.id),'提现已批准');
        render('withdrawals');
      };});
      $('.aw-reject').forEach(function(b){b.onclick=async function(){
        var w=(state.admin.withdrawals||[]).find(function(x){return String(x.id)===String(b.dataset.id);})||{};
        var ok=await confirmAdminAction('驳回提现','<b>提现 ID：</b>'+escapeHtml(b.dataset.id)+'<br><b>用户 UID：</b>'+escapeHtml(w.uid||'—')+'<br><b>币种/数量：</b>'+escapeHtml(w.coin||'—')+' '+escapeHtml(w.amount||'—')+'<br><b>目标地址：</b>'+escapeHtml(w.address||'—')+'<br><b>驳回后：</b>系统会退回预留金额。');
        if(!ok)return;
        await runAdminAction(b,()=>apiAdapter.adminRejectWithdraw({id:b.dataset.id,reason:'Rejected by administrator'}),'提现已驳回');
        render('withdrawals');
      };});
      $('.aw-paid').forEach(function(b){b.onclick=async function(){
        var w=(state.admin.withdrawals||[]).find(function(x){return String(x.id)===String(b.dataset.id);})||{};
        var reference=await new Promise(function(resolve){
          if(!(window.BTCBox&&BTCBox.modal)){resolve(null);return;}
          BTCBox.modal({title:'记录人工转账完成',width:'md',closable:true,
            content:'<div style="font-size:13px;line-height:1.7;margin-bottom:12px">请先确认工作人员已向用户提供的地址实际转账。此操作只记录已完成，不会再次扣款。</div><div class="va-field"><label class="auth-label">TxID / 转账参考号（必填）</label><input id="admin-payout-reference" class="auth-input num" maxlength="160" required aria-required="true" placeholder="输入交易哈希或转账参考号"></div>',
            buttons:[
              {text:'取消',variant:'ghost',onClick:function(close){close();resolve(null);}},
              {text:'确认已转账',variant:'primary',onClick:function(close){var input=document.getElementById('admin-payout-reference');var value=input?input.value.trim():'';if(!value){toast('请填写实际转账的 TxID / 参考号。','err');if(input)input.focus();return;}close();resolve(value);}}
            ]});
        });
        if(reference===null)return;
        await runAdminAction(b,()=>apiAdapter.adminMarkWithdrawPaid({id:b.dataset.id,reference:reference,note:'Staff manually transferred funds.'}),'已记录转账完成');
        render('withdrawals');
      };});
    } else {
      var klist=(state.admin.kycs||[]).filter(function(k){return k.status==='pending';});
      if(!klist.length){$('#admin-body').innerHTML=emptyState('暂无待审核 KYC','所有 KYC 申请均已审核。');return;}
      $('#admin-body').innerHTML='<table style="width:100%;border-collapse:collapse;min-width:560px"><thead><tr><th class="th">用户</th><th class="th">姓名</th><th class="th">证件类型</th><th class="th">操作</th></tr></thead><tbody>'+
        klist.map(function(k){
          return '<tr class="trow"><td class="td">'+escapeHtml(k.uid)+'</td><td class="td">'+escapeHtml(k.name)+'</td><td class="td" style="text-transform:capitalize;color:var(--text-secondary)">'+escapeHtml((k.id_type||'').replace('_',' '))+'</td><td class="td"><button class="ak-approve" data-uid="'+escapeHtml(k.uid)+'" style="color:var(--up);font-weight:600;font-size:12px;margin-right:10px;background:none;border:none;cursor:pointer">通过</button><button class="ak-reject" data-uid="'+escapeHtml(k.uid)+'" style="color:var(--down);font-weight:600;font-size:12px;background:none;border:none;cursor:pointer">驳回</button></td></tr>';
        }).join('')+'</tbody></table>';
      $('.ak-approve').forEach(function(b){b.onclick=async function(){var k=(state.admin.kycs||[]).find(function(x){return String(x.uid)===String(b.dataset.uid);})||{};var ok=await confirmAdminAction('通过 KYC 审核','<b>用户 UID：</b>'+escapeHtml(b.dataset.uid)+'<br><b>姓名：</b>'+escapeHtml(k.name||'—')+'<br><b>证件类型：</b>'+escapeHtml(k.id_type||'—'));if(!ok)return;await runAdminAction(b,()=>apiAdapter.adminApproveKyc({uid:b.dataset.uid}),'KYC 审核已提交');};});
      $('.ak-reject').forEach(function(b){b.onclick=async function(){var k=(state.admin.kycs||[]).find(function(x){return String(x.uid)===String(b.dataset.uid);})||{};var ok=await confirmAdminAction('驳回 KYC 审核','<b>用户 UID：</b>'+escapeHtml(b.dataset.uid)+'<br><b>姓名：</b>'+escapeHtml(k.name||'—')+'<br><b>证件类型：</b>'+escapeHtml(k.id_type||'—')+'<br><b>驳回原因：</b>证件不清晰 (Document unclear)');if(!ok)return;await runAdminAction(b,()=>apiAdapter.adminRejectKyc({uid:b.dataset.uid,reason:'Document unclear'}),'KYC 驳回已提交');};});
    }
  }
  var tab='users'; render(tab);
  $$('[data-atab]').forEach(function(t){t.onclick=function(){tab=t.dataset.atab;$$('[data-atab]').forEach(function(x){x.classList.remove('active');});t.classList.add('active');render(tab);};});
};

/* ================= 404 (override app-core stub) ================= */
VIEWS['404'] = function(){
  return '<div class="va-account-page va-page va-page-narrow">'+
    '<div class="card va-soon">'+
      '<div class="va-soon-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></div>'+
      '<div class="va-soon-title">404 — 页面不存在</div>'+
      '<div class="va-soon-sub">您访问的页面不存在或已被移除。请检查链接是否正确，或返回首页继续交易。</div>'+
      '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">'+
        '<a href="#/markets" class="btn btn-primary">返回行情</a>'+
        '<a href="#/me" class="btn btn-ghost">我的账户</a>'+
      '</div>'+
    '</div>'+
  '</div>';
};
