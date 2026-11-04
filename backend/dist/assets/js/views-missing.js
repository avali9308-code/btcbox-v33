/* BTCBOX views-missing.js — new account-hub views (me/fiat/cards/transfer/invite/payment).
   Loaded dynamically by views-account.js (index.html unchanged). All data from real interfaces only. */
"use strict";
/* ===== inject CSS (dedupe) ===== */
(function(){
  var CSS_HREF='/assets/css/views-account.css';
  if(!document.querySelector('link[href="'+CSS_HREF+'"]')){
    var l=document.createElement('link');l.rel='stylesheet';l.href=CSS_HREF;document.head.appendChild(l);
  }
})();

/* ===== push Account into sidebar NAV (idempotent) ===== */
if(typeof NAV!=='undefined' && Array.isArray(NAV) && !NAV.some(function(n){return n.route==='me';})){
  NAV.push({route:'me',label:'Account',icon:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'});
}

/* ===== shared helpers ===== */
function vmHeader(title, sub, backHref){
  return '<div class="va-header">'+
    '<a class="va-back" href="'+(backHref||'#/me')+'" aria-label="Back">'+
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>'+
    '</a>'+
    '<div style="flex:1;min-width:0"><h1 class="va-title">'+title+'</h1>'+(sub?'<div class="va-sub">'+sub+'</div>':'')+'</div>'+
  '</div>';
}
function vmSoonIcon(path){
  return '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg>';
}
function vmSoon(title, sub, items, backHref){
  return '<div class="va-page va-page-narrow">'+
    vmHeader(title, sub, backHref||'#/me')+
    '<div class="card va-soon">'+
      '<div class="va-soon-icon">'+vmSoonIcon('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>')+'</div>'+
      '<div class="va-soon-title">Service Unavailable</div>'+
      '<div class="va-soon-sub">This service is currently unavailable. Your funds are safe; please use the available spot trading, deposit, and earn services.</div>'+
      '<div class="va-soon-list">'+items.map(function(it){
        return '<div class="va-soon-item"><span class="va-soon-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span>'+it+'</span></div>';
      }).join('')+'</div>'+
      '<a href="'+(backHref||'#/me')+'" class="btn btn-primary">Back to Account</a>'+
    '</div>'+
  '</div>';
}

/* ================= #/me 我的 ================= */
VIEWS.me = function(){
  var email=(state.user&&state.user.email)||'Not signed in';
  var uid=(state.user&&state.user.uid)?('UID '+state.user.uid):'UID unavailable';
  var letter=(email[0]||'?').toUpperCase();
  var rawKycStatus=state.kyc&&state.kyc.status;
  var st=rawKycStatus&&typeof rawKycStatus==='object'?String(rawKycStatus.status||'unverified').toLowerCase():String(rawKycStatus||'unverified').toLowerCase();
  var kycLabel=st==='pending'?'Verification Pending':(st==='approved'?'Verified':'Unverified');
  var kycClass=st==='pending'?'va-badge-warn':(st==='approved'?'va-badge-up':'va-badge-muted');
  var twofaLabel=state.settings.twofa?'Enabled':'Not enabled';
  var fundLabel=state.settings.fundPwdSet?'Configured':'Not configured';
  function hubIcon(path){
    return '<span class="va-hub-icon" aria-hidden="true"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg></span>';
  }
  function hubLink(href,title,desc,icon,meta){
    return '<a class="va-hub-action" href="'+href+'">'+hubIcon(icon)+'<span class="va-hub-copy"><span class="va-hub-action-title">'+title+'</span><span class="va-hub-action-desc">'+desc+'</span></span>'+(meta||'')+'<svg class="va-hub-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></a>';
  }
  var personPath='<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>';
  var shieldPath='<path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6z"/><path d="m9 12 2 2 4-4"/>';
  var supportPath='<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h8M8 14h5"/>';
  var paymentPath='<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>';
  var rewardsPath='<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>';
  return '<div class="va-account-page va-page va-page-narrow va-hub">'+
    vmHeader('My Account','Your identity, security and account access','#/markets')+
    '<section class="va-hub-identity" aria-label="Account identity">'+
      '<div class="va-avatar">'+letter+'</div>'+
      '<div class="va-hub-identity-copy"><div class="va-hub-eyebrow">SIGNED IN AS</div><div class="va-email">'+email+'</div><div class="va-uid">'+uid+'</div>'+
        '<div class="va-profile-badges"><span class="va-badge '+kycClass+'"><span class="va-dot"></span>'+kycLabel+'</span></div>'+
      '</div>'+
      '<button type="button" id="me-profile" class="va-hub-profile-btn" aria-label="View profile details">Profile details <span aria-hidden="true">›</span></button>'+
    '</section>'+
    '<a class="va-hub-assets" href="#/assets" aria-label="Open Assets">'+
      '<span class="va-hub-assets-copy"><span class="va-hub-eyebrow">WALLET & ASSET RECORDS</span><span class="va-hub-assets-value">View your assets</span><span class="va-hub-assets-note">Balances, market valuation and transaction records</span></span>'+
      '<span class="va-hub-assets-cta">View Assets <span aria-hidden="true">›</span></span>'+
    '</a>'+
    '<section class="va-hub-section" aria-labelledby="hub-security-title">'+
      '<div class="va-hub-section-head"><div><h2 id="hub-security-title">Identity & Security</h2><p>Protect access to your account and funds</p></div><span class="va-hub-section-index">01</span></div>'+
      '<div class="va-hub-panel">'+
        hubLink('#/kyc','Identity Verification','Verification status and next steps',personPath,'<span class="va-hub-state">'+kycLabel+'</span>')+
        hubLink('#/settings','Security & Preferences','Passwords, 2FA and display preferences',shieldPath,'<span class="va-hub-state">'+(state.settings.twofa?'2FA on':'2FA off')+'</span>')+
      '</div>'+
      '<div class="va-hub-security-note"><span class="va-hub-security-dot"></span><span>Fund password: <b>'+fundLabel+'</b></span><span class="va-hub-security-sep">·</span><span>Two-factor authentication: <b>'+twofaLabel+'</b></span></div>'+
    '</section>'+
    '<section class="va-hub-section" aria-labelledby="hub-support-title">'+
      '<div class="va-hub-section-head"><div><h2 id="hub-support-title">Help & Support</h2><p>Get assistance with your account and services</p></div><span class="va-hub-section-index">02</span></div>'+
      '<div class="va-hub-panel">'+hubLink('#/support','Customer Support','Contact the BTCBOX support team',supportPath,'')+'</div>'+
    '</section>'+
    '<section class="va-hub-section va-hub-secondary" aria-labelledby="hub-services-title">'+
      '<div class="va-hub-section-head"><div><h2 id="hub-services-title">Additional Services</h2><p>Some services are not connected yet</p></div></div>'+
      '<div class="va-hub-panel">'+
        hubLink('#/fiat','Fiat & Payment Services','Fiat channels and payment management',paymentPath,'<span class="va-hub-preview">Preview</span>')+
        hubLink('#/invite','Rewards & Referrals','Referral programme information',rewardsPath,'<span class="va-hub-preview">Preview</span>')+
      '</div>'+
    '</section>'+
    '<button type="button" id="me-logout" class="va-hub-logout"><span class="va-hub-logout-icon" aria-hidden="true">↗</span><span><b>Log Out</b><small>Sign out of this BTCBOX account</small></span></button>'+
  '</div>';
};
VIEWS.me.afterRender = function(){
  // Refresh first, then rerender only when the account snapshot changed. The
  // route check prevents a late response from replacing a page the user left.
  function snapshot(){return JSON.stringify({user:state.user,kyc:state.kyc,settings:state.settings,balances:state.balances});}
  var before=snapshot();
  try{
    apiAdapter.account().then(function(r){
      if(r && r.ok && parseHash().route==='me' && snapshot()!==before) router();
    }).catch(function(){});
  }catch(e){}
  var prof=$('#me-profile');
  if(prof) prof.onclick=function(){
    var email=(state.user&&state.user.email)||'—';
    var uid=(state.user&&state.user.uid)?state.user.uid:'—';
    var rawKycStatus=state.kyc&&state.kyc.status;
    var st=rawKycStatus&&typeof rawKycStatus==='object'?String(rawKycStatus.status||'unverified').toLowerCase():String(rawKycStatus||'unverified').toLowerCase();
    BTCBox.modal({
      title:'Profile',
      content:'<div class="va-confirm-row"><span class="va-confirm-k">Email</span><span class="va-confirm-v">'+email+'</span></div>'+
        '<div class="va-confirm-row"><span class="va-confirm-k">UID</span><span class="va-confirm-v">'+uid+'</span></div>'+
        '<div class="va-confirm-row"><span class="va-confirm-k">KYC Status</span><span class="va-confirm-v">'+st.charAt(0).toUpperCase()+st.slice(1)+'</span></div>'+
        '<div class="va-confirm-row"><span class="va-confirm-k">2FA</span><span class="va-confirm-v">'+(state.settings.twofa?'Enabled':'Disabled')+'</span></div>'+
        '<div class="va-confirm-row"><span class="va-confirm-k">Fund Password</span><span class="va-confirm-v">'+(state.settings.fundPwdSet?'Set':'Not set')+'</span></div>',
      buttons:[{text:'Close',variant:'primary',onClick:function(c){c();}}]
    });
  };
  if(prof) prof.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();prof.click();}};
  var lo=$('#me-logout'); if(lo) lo.onclick=function(){ if(window.confirmLogout) window.confirmLogout(); };
};

/* ================= #/fiat 法币 (no interface → placeholder) ================= */
VIEWS.fiat = function(){
  return vmSoon('Fiat','Fiat deposits / withdrawals / balance / payment methods / records',
    ['Fiat deposits — multiple payment channels and arrival notifications','Fiat withdrawals — withdraw to a linked bank card in your name','Fiat balance — multi-currency balances and transaction details','Payment management — link bank cards and third-party channels','Records and order details — track the complete fiat order lifecycle'],
    '#/me');
};

/* ================= #/cards 银行卡 (no interface → empty shell + disabled add) ================= */
VIEWS.cards = function(){
  return '<div class="va-page va-page-narrow">'+
    vmHeader('Bank Cards','Link a bank card for fiat withdrawals','#/me')+
    '<div class="va-banner va-banner-warn">The bank card interface is not connected. This preview <b>will not link a real card</b>.</div>'+
    '<div id="cards-list"></div>'+
    '<button id="cards-add" class="btn btn-primary btn-block" style="padding:12px;margin-top:4px">'+
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px;margin-right:6px"><path d="M12 5v14M5 12h14"/></svg>Add Bank Card'+
    '</button>'+
  '</div>';
};
VIEWS.cards.afterRender = function(){
  // no real interface → honest empty state (no fake cards)
  $('#cards-list').innerHTML='<div class="card va-empty"><div class="va-empty-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:.4"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg></div><div class="va-empty-title">No Linked Bank Cards</div><div class="va-empty-sub">Once connected, you can link a card in your name for fiat withdrawals</div></div>';
  $('#cards-add').onclick=function(){
    BTCBox.modal({
      title:'Add Bank Card',
      content:'<form id="card-form">'+
        '<div class="va-field"><label class="va-field-label">Bank</label><select id="card-bank" class="va-input" disabled><option>China Merchants Bank</option><option>ICBC</option><option>China Construction Bank</option></select></div>'+
        '<div class="va-field"><label class="va-field-label">Cardholder Name (matching KYC)</label><input id="card-holder" class="va-input" placeholder="Enter name" disabled></div>'+
        '<div class="va-field"><label class="va-field-label">Card Number</label><input id="card-num" class="va-input num" placeholder="Enter card number" disabled></div>'+
        '<div class="va-field"><label class="va-field-label">Bank-Registered Phone</label><input id="card-phone" class="va-input num" placeholder="Used for verification codes" disabled></div>'+
        '<div class="va-banner va-banner-warn" style="margin:0">Bank card linking is not connected; this form is disabled.</div>'+
      '</form>',
      buttons:[{text:'Linking Unavailable',variant:'ghost',disabled:true,onClick:function(c){c();}},{text:'Close',variant:'primary',onClick:function(c){c();}}],
      closable:true
    });
  };
};

/* ================= #/transfer 划转 (no transfer interface; balances real) ================= */
VIEWS.transfer = function(){
  var coins=state.balances?Object.keys(state.balances):['USDT'];
  if(!coins.length) coins=['USDT'];
  var coinOpts=coins.map(function(c){return '<option value="'+c+'">'+c+'</option>';}).join('');
  return '<div class="va-page va-page-narrow">'+
    vmHeader('Transfer','Transfer between accounts (available balances are live data)','#/me')+
    '<div class="va-banner va-banner-warn">The transfer interface is not connected. Balances are live, but <b>confirmation will not execute a real transfer</b>.</div>'+
    '<div class="card va-transfer-box">'+
      '<div class="va-acc-select">'+
        '<div class="va-field"><label class="va-field-label">From</label><select id="tf-from" class="va-input"><option value="spot">Spot Account</option><option value="earn">Earn Account</option></select></div>'+
        '<div class="va-swap" id="tf-swap" title="Swap direction"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4"/></svg></div>'+
        '<div class="va-field"><label class="va-field-label">To</label><select id="tf-to" class="va-input"><option value="earn">Earn Account</option><option value="spot">Spot Account</option></select></div>'+
      '</div>'+
      '<div class="va-field"><label class="va-field-label">Asset</label><select id="tf-coin" class="va-input">'+coinOpts+'</select>'+
        '<div class="va-avail"><span>Available</span><span><span id="tf-avail" class="num">—</span> <button type="button" class="va-max-btn" id="tf-max">MAX</button></span></div>'+
      '</div>'+
      '<div class="va-field"><label class="va-field-label">Amount</label><div class="va-input-wrap"><input id="tf-amount" class="va-input num" type="text" inputmode="decimal" placeholder="0.00"><span class="va-input-suffix" id="tf-coin-sym">USDT</span></div></div>'+
      '<button id="tf-submit" class="btn btn-primary btn-block" style="padding:12px">Confirm Transfer</button>'+
    '</div>'+
  '</div>';
};
VIEWS.transfer.afterRender = function(){
  // refresh real balances
  try{ apiAdapter.account().catch(function(){}); }catch(e){}
  function avail(){
    var coin=$('#tf-coin').value;
    var b=(state.balances&&state.balances[coin])||{};
    var free=Number(b.free||0);
    $('#tf-avail').textContent=fmt(free, coin==='USDT'?2:6)+' '+coin;
    $('#tf-coin-sym').textContent=coin;
    return free;
  }
  avail();
  $('#tf-coin').onchange=avail;
  $('#tf-swap').onclick=function(){
    var f=$('#tf-from'), t=$('#tf-to');
    var fv=f.value, tv=t.value;
    f.value=tv; t.value=fv;
  };
  $('#tf-max').onclick=function(){ var free=avail(); $('#tf-amount').value=free?String(free):''; };
  $('#tf-submit').onclick=function(){
    var from=$('#tf-from').value, to=$('#tf-to').value, coin=$('#tf-coin').value, amt=$('#tf-amount').value;
    var fromName=$('#tf-from option:checked').textContent, toName=$('#tf-to option:checked').textContent;
    if(from===to){ toast('Source and destination accounts must be different.','err'); return; }
    if(!amt||Number(amt)<=0){ toast('Enter a valid transfer amount.','err'); return; }
    var b=(state.balances&&state.balances[coin])||{};
    if(Number(amt)>Number(b.free||0)){ toast('Transfer amount exceeds available balance.','err'); return; }
    BTCBox.modal({
      title:'Confirm Transfer',
      content:'<div class="va-confirm-row"><span class="va-confirm-k">From</span><span class="va-confirm-v down">'+fromName+'</span></div>'+
        '<div class="va-confirm-row"><span class="va-confirm-k">To</span><span class="va-confirm-v up">'+toName+'</span></div>'+
        '<div class="va-confirm-row"><span class="va-confirm-k">Asset</span><span class="va-confirm-v">'+coin+'</span></div>'+
        '<div class="va-confirm-row"><span class="va-confirm-k">Amount</span><span class="va-confirm-v">'+fmt(Number(amt),coin==='USDT'?2:6)+' '+coin+'</span></div>'+
        '<div class="va-banner va-banner-warn" style="margin-top:12px;margin-bottom:0">The transfer interface is not connected. This is a preview and will not execute a real transfer.</div>',
      buttons:[{text:'Got It',variant:'primary',onClick:function(c){c();}}],
      closable:true
    });
  };
};

/* ================= #/invite 邀请 (no interface → placeholder) ================= */
VIEWS.invite = function(){
  return vmSoon('Referrals','Invite friends and earn trading-fee commissions',
    ['Personal invite code and link — copy and share','Commission rates — multi-level rules','Commission records — invites / total commission / details','Referral leaderboard and campaign rewards (available after integration)'],
    '#/me');
};

/* ================= #/payment 支付方式 (no interface → placeholder) ================= */
VIEWS.payment = function(){
  return vmSoon('Payment Methods','Manage payment channels for fiat transactions',
    ['Link bank cards for fiat withdrawals','Add third-party channels (Alipay / WeChat / online banking)','Enable / disable methods and set a default','Fiat transaction records and channel reconciliation'],
    '#/me');
};
