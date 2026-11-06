/* BTCBOX views-assets.js — UI/UX upgrade (feature/uiux-upgrade).
 * Scope: assets / deposit / withdraw / earn views.
 * PRESERVED verbatim: DW_COINS, NETWORKS, renderQR(), FEES table, EARN_PRODUCTS,
 *   all element ids bound by afterRender, all apiAdapter calls + params,
 *   all client-side validation checks in withdraw submit.
 * Changed: HTML structure / CSS classes / layout / interaction form
 *   (deposit network -> BTCBox.drawer bottom sheet; withdraw -> 4-step
 *   state machine; fund results -> BTCBox.modal; asset search; states).
 */
"use strict";
/* Inject view-scoped stylesheet (guarded against double inject). */
(function(){
  try{
    if(!document.getElementById('views-assets-css')){
      document.head.insertAdjacentHTML('beforeend','<link id="views-assets-css" rel="stylesheet" href="/assets/css/views-assets.css">');
    }
  }catch(e){}
})();

/* ===================== ASSETS OVERVIEW ===================== */
function assetQuoteValue(coin,amount){
  const qty=Number(amount)||0;
  if(qty===0) return 0;
  if(coin==='USDT') return qty;
  const quote=market[coin+'USDT'];
  const price=Number(quote&&quote.price);
  return Number.isFinite(price)&&price>0?qty*price:null;
}
function assetValuation(){
  let total=0,available=0,frozen=0,totalMissing=false,availableMissing=false,frozenMissing=false;
  for(const coin in state.balances){
    const balance=state.balances[coin]||{};
    const free=Number(balance.free)||0, locked=Number(balance.frozen)||0;
    const totalValue=assetQuoteValue(coin,free+locked);
    const freeValue=assetQuoteValue(coin,free);
    const frozenValue=assetQuoteValue(coin,locked);
    if(totalValue===null) totalMissing=true; else total+=totalValue;
    if(freeValue===null) availableMissing=true; else available+=freeValue;
    if(frozenValue===null) frozenMissing=true; else frozen+=frozenValue;
  }
  return {total:totalMissing?null:total,available:availableMissing?null:available,frozen:frozenMissing?null:frozen};
}
VIEWS.assets = function(){
  const valuation=state.accountLoaded?assetValuation():{total:null,available:null,frozen:null};
  return '<div class="va-page">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px">'+
      '<div><h1 class="page-title" style="margin:0">Assets Overview</h1>'+
      '<div class="page-sub" style="margin:4px 0 0">Spot wallet · valuations use live market prices</div></div>'+
    '</div>'+
    '<div class="va-quick">'+
      '<a href="#/deposit" class="btn btn-primary">Deposit</a>'+
      '<a href="#/withdraw" class="btn btn-ghost">Withdraw</a>'+
      '<button class="btn btn-ghost" id="assets-transfer">Transfer</button>'+
      '<button class="btn btn-ghost" id="assets-records-btn">Records</button>'+
    '</div>'+
    '<div class="va-hero">'+
      '<div class="va-hero-label">Total Estimated Value (Spot)</div>'+
      '<div class="va-hero-total num" id="assets-total-value">'+(valuation.total===null?'—':fmt(valuation.total,2))+'<span class="va-unit">USDT</span></div>'+
      '<div class="va-hero-sub">Account classification: Spot Wallet · '+Object.keys(state.balances).length+' assets</div>'+
      '<div class="va-stat-grid">'+
        '<div class="va-stat"><div class="va-stat-label">Available</div><div class="va-stat-val num" id="assets-available-value">'+(valuation.available===null?'—':fmt(valuation.available,2))+'<span class="va-unit">USDT</span></div></div>'+
        '<div class="va-stat"><div class="va-stat-label">Frozen (In Orders)</div><div class="va-stat-val num" id="assets-frozen-value">'+(valuation.frozen===null?'—':fmt(valuation.frozen,2))+'<span class="va-unit">USDT</span></div></div>'+
        '<div class="va-stat"><div class="va-stat-label">In Earn</div><div class="va-stat-val num">—</div></div>'+
      '</div>'+
    '</div>'+
    '<div class="va-card">'+
      '<div class="va-card-head">'+
        '<div class="va-card-title">My Assets</div>'+
        '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">'+
          '<div class="va-search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input id="assets-search" placeholder="Search coin…" autocomplete="off"></div>'+
          '<label class="va-toggle"><input type="checkbox" id="hide-small" '+(state.settings.hideSmall?'checked':'')+'> Hide small</label>'+
        '</div>'+
      '</div>'+
      '<div class="va-table-wrap scroll"><table class="va-table"><thead><tr><th>Coin</th><th>Total</th><th>Available</th><th>Frozen</th><th>Est. Value (USDT)</th><th>Action</th></tr></thead><tbody id="assets-body"></tbody></table></div>'+
    '</div>'+
    '<div class="va-card" id="assets-records">'+
      '<div class="va-card-head"><div class="va-card-title">Asset Records</div></div>'+
      '<div class="va-empty">Transaction record history is not available via the current API yet.<br>Deposit / withdrawal status can be tracked from the respective pages after submission.</div>'+
    '</div>'+
  '</div>';
};
VIEWS.assets.afterRender = function(){
  function render(){
    if(!state.accountLoaded){
      const totalEl=$('#assets-total-value'),availableEl=$('#assets-available-value'),frozenEl=$('#assets-frozen-value');
      if(totalEl)totalEl.innerHTML='—<span class="va-unit">USDT</span>';
      if(availableEl)availableEl.innerHTML='—<span class="va-unit">USDT</span>';
      if(frozenEl)frozenEl.innerHTML='—<span class="va-unit">USDT</span>';
      const body=$('#assets-body');
      if(body)body.innerHTML='<tr><td colspan="6">'+emptyState('Account data unavailable','Your wallet could not be loaded. Refresh the page or sign in again; no balance is assumed.')+'</td></tr>';
      return;
    }
    const hide=state.settings.hideSmall;
    const q=($('#assets-search')?$('#assets-search').value:'').trim().toUpperCase();
    const coins=Object.keys(state.balances);
    const valuation=assetValuation();
    const totalEl=$('#assets-total-value'), availableEl=$('#assets-available-value'), frozenEl=$('#assets-frozen-value');
    if(totalEl) totalEl.innerHTML=(valuation.total===null?'—':fmt(valuation.total,2))+'<span class="va-unit">USDT</span>';
    if(availableEl) availableEl.innerHTML=(valuation.available===null?'—':fmt(valuation.available,2))+'<span class="va-unit">USDT</span>';
    if(frozenEl) frozenEl.innerHTML=(valuation.frozen===null?'—':fmt(valuation.frozen,2))+'<span class="va-unit">USDT</span>';
    const rows=coins.map(c=>{
      const b=state.balances[c]||{}, free=Number(b.free)||0, frozen=Number(b.frozen)||0, total=free+frozen;
      const usdt=assetQuoteValue(c,total);
      return {coin:c,total,free,frozen,usdt};
    }).filter(r=>!hide||r.usdt===null||r.usdt>=1)
      .filter(r=>!q||r.coin.toUpperCase().indexOf(q)>=0)
      .sort((a,b)=>(b.usdt===null?-1:b.usdt)-(a.usdt===null?-1:a.usdt));
    if(!rows.length){$('#assets-body').innerHTML='<tr><td colspan="6">'+emptyState('No assets to show','Adjust search or disable "Hide small balances".')+'</td></tr>';return;}
    $('#assets-body').innerHTML=rows.map(r=>'<tr><td><div class="va-coin-cell"><span class="va-coin-ico">'+escapeHtml(r.coin.slice(0,3))+'</span><div><div class="va-coin-name">'+escapeHtml(r.coin)+'</div><div class="va-coin-sub">'+escapeHtml(r.coin)+' Wallet</div></div></div></td><td class="va-num">'+fmt(r.total,r.coin==='USDT'?2:6)+'</td><td class="va-num" style="color:var(--text-secondary)">'+fmt(r.free,r.coin==='USDT'?2:6)+'</td><td class="va-num" style="color:var(--text-secondary)">'+fmt(r.frozen,r.coin==='USDT'?2:6)+'</td><td class="va-num">'+(r.usdt===null?'—':fmt(r.usdt,2))+'</td><td><a class="va-act-link" href="#/deposit">Deposit</a><a class="va-act-link secondary" href="#/withdraw">Withdraw</a></td></tr>').join('');
  }
  render();
  if(state._assetsRefreshTimer) clearInterval(state._assetsRefreshTimer);
  state._assetsRefreshTimer=setInterval(()=>{
    if(!location.hash.startsWith('#/assets')){
      clearInterval(state._assetsRefreshTimer); state._assetsRefreshTimer=null; return;
    }
    render();
  },3000);
  $('#hide-small').onchange=e=>{state.settings.hideSmall=e.target.checked;render();};
  if($('#assets-search')) $('#assets-search').oninput=render;
  if($('#assets-records-btn')) $('#assets-records-btn').onclick=()=>{const el=$('#assets-records');if(el)el.scrollIntoView({behavior:'smooth',block:'start'});};
  if($('#assets-transfer')) $('#assets-transfer').onclick=()=>{BTCBox.modal({title:'Transfer',width:'md',closable:true,buttons:[{text:'Close',variant:'ghost'}],content:'<div style="font-size:13px;color:var(--text-secondary);line-height:1.7">Internal transfer between accounts is not yet available on this platform. You can <b style="color:var(--text-primary)">Deposit</b> or <b style="color:var(--text-primary)">Withdraw</b> from the Assets page.</div>'});};
};

/* ===================== SHARED CONSTANTS (preserved) ===================== */
// Keep deposit/withdrawal options identical to api/core.js. Unsupported assets
// must not be offered as if a real transaction could succeed.
const DW_COINS=['USDT','BTC','ETH','SOL','BNB','USDC'];
const NETWORKS={USDT:['ERC20','TRC20','BEP20'],BTC:['BTC'],ETH:['ERC20'],SOL:['SOL'],BNB:['BEP20'],USDC:['ERC20']};
const WITHDRAW_FEES={USDT:1,BTC:0.0001,ETH:0.001,SOL:0.01,BNB:0.0005,USDC:1};
function renderQR(addr,elId){
  const el=document.getElementById(elId); if(!el)return;
  try{
    if(window.qrcode){
      const qr=qrcode(0,'M'); qr.addData(addr); qr.make();
      el.innerHTML=qr.createSvgTag({cellSize:4,margin:0});
      const svg=el.querySelector('svg'); if(svg){svg.setAttribute('width','160');svg.setAttribute('height','160');svg.style.background='#fff';svg.style.padding='8px';svg.style.borderRadius='8px';}
    } else {
      el.innerHTML='<div style="width:160px;height:160px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px;border:1px dashed var(--border);border-radius:8px">QR unavailable</div>';
    }
  }catch(e){ el.innerHTML='<div style="color:var(--text-muted);font-size:12px">QR unavailable</div>'; }
}

/* ===================== DEPOSIT (independent view) ===================== */
VIEWS.deposit = function(){
  return '<div class="va-page" style="max-width:720px;margin:0 auto">'+
    '<h1 class="page-title">Deposit</h1>'+
    '<p class="page-sub">Send funds to your deposit address. Manual review applies.</p>'+
    '<div class="va-card"><div class="va-card-body">'+
      '<div class="va-form-grid">'+
        '<div><label class="auth-label">Coin</label><select id="dep-coin" class="auth-input" style="appearance:none">'+DW_COINS.map(c=>'<option>'+c+'</option>').join('')+'</select></div>'+
        '<div><label class="auth-label">Network</label>'+
          '<button type="button" id="dep-net-btn" class="va-net-btn"><span class="va-net-val" id="dep-net-label">—</span><span class="va-chevron">▾</span></button>'+
          '<select id="dep-network" style="display:none"></select>'+
        '</div>'+
      '</div>'+
      '<div id="dep-memo-row" class="va-memo-box" style="display:none">'+
        '<div class="va-memo-label" id="dep-memo-label">Memo / Tag (required)</div>'+
        '<div class="va-addr-row"><input id="dep-memo" class="auth-input num" readonly style="flex:1"><button type="button" id="dep-memo-copy" class="btn btn-ghost">Copy</button></div>'+
        '<div style="font-size:11px;color:var(--text-muted);margin-top:6px">You must include this Memo/Tag with your deposit, otherwise funds cannot be credited.</div>'+
      '</div>'+
      '<div class="va-qr-card">'+
        '<div class="va-qr-box" id="dep-qr"><div class="skel" style="width:160px;height:160px;border-radius:8px"></div></div>'+
        '<div style="margin-top:12px;text-align:left"><label class="auth-label">Deposit Address</label>'+
        '<div class="va-addr-row"><input id="dep-addr" class="auth-input num" readonly style="flex:1;font-size:12px"><button type="button" id="dep-copy" class="btn btn-ghost">Copy</button></div></div>'+
      '</div>'+
      '<div class="va-info">Send funds only to the exact address configured by BTCBOX for this coin and network. After staff manually verifies receipt, staff will credit your account balance.</div>'+
      '<div class="va-warn">'+
        '<div class="va-warn-title">Important</div>'+
        '<ul><li>充值地址由后台配置，请核对币种和网络，<b>请勿向错误地址或网络转账</b>。</li><li>Send only <b id="dep-coin-warn">USDT</b> on the selected network. Sending other coins or using another network may result in permanent loss.</li><li>After staff verifies the transfer manually, your balance is credited manually. Displaying an address does not mean a deposit has been credited.</li></ul>'+
      '</div>'+
    '</div></div>'+
    '<div class="va-card"><div class="va-card-head"><div class="va-card-title">Deposit Records</div></div>'+
      '<div class="va-empty">This page displays the receiving address configured by BTCBOX. After you transfer funds, staff will verify receipt and manually credit your balance.</div>'+
    '</div>'+
  '</div>';
};
VIEWS.deposit.afterRender = function(){
  let depositRequestSeq=0;
  function refresh(){
    const requestSeq=++depositRequestSeq;
    const coin=$('#dep-coin').value, nets=NETWORKS[coin]||['ERC20'];
    const prevNet=$('#dep-network').value;
    $('#dep-network').innerHTML=nets.map(n=>'<option>'+escapeHtml(n)+'</option>').join('');
    if(nets.indexOf(prevNet)>=0) $('#dep-network').value=prevNet;
    const net=$('#dep-network').value;
    if($('#dep-net-label')) $('#dep-net-label').textContent=net;
    $('#dep-addr').value='Loading address…';
    $('#dep-addr').classList.add('va-addr-loading');
    $('#dep-coin-warn').textContent=coin;
    // Reset dependent fields until the current coin/network response is confirmed.
    if($('#dep-memo-row')) $('#dep-memo-row').style.display='none';
    if($('#dep-memo')) $('#dep-memo').value='';
    if($('#dep-qr')) $('#dep-qr').textContent='Loading address…';
    apiAdapter.deposit({coin:coin, network:net}).then(r=>{
      // Latest selection wins: ignore a slower response for an older coin/network.
      if(requestSeq!==depositRequestSeq)return;
      $('#dep-addr').classList.remove('va-addr-loading');
      const addr=(r&&r.ok&&r.address)?r.address:('— '+((r&&(r.msg||r.message))||'address unavailable'));
      $('#dep-addr').value=addr;
      if(r&&r.ok&&r.address) renderQR(r.address,'dep-qr');
      else if($('#dep-qr')) $('#dep-qr').textContent='Address unavailable';
      // Memo/Tag: show only when backend returns one (XRP-style networks).
      const memo = r&&(r.memo || r.tag || r.memo_tag) || '';
      if(memo && $('#dep-memo-row')){
        $('#dep-memo-row').style.display='';
        $('#dep-memo').value=memo;
        if(r.tag) $('#dep-memo-label').textContent='Tag (required)'; else $('#dep-memo-label').textContent='Memo (required)';
      }
    }).catch(()=>{
      if(requestSeq!==depositRequestSeq)return;
      $('#dep-addr').classList.remove('va-addr-loading');
      $('#dep-addr').value='— Address unavailable. Please refresh and try again.';
      if($('#dep-qr')) $('#dep-qr').textContent='Address unavailable';
      if($('#dep-memo-row')) $('#dep-memo-row').style.display='none';
      if($('#dep-memo')) $('#dep-memo').value='';
      toast('Deposit address could not be loaded. Please refresh and try again.','err');
    });
  }
  function openNetDrawer(){
    const coin=$('#dep-coin').value, nets=NETWORKS[coin]||['ERC20'];
    const cur=$('#dep-network').value;
    const items=nets.map(n=>'<div class="va-drawer-item '+(n===cur?'active':'')+'" data-net="'+n+'"><div><div style="font-weight:600">'+n+'</div><div class="va-net-desc">'+coin+' · '+n+' network</div></div>'+(n===cur?'<span style="color:var(--brand-bright)">✓</span>':'')+'</div>').join('');
    BTCBox.drawer({side:'bottom', title:'Select Network — '+coin, height:'auto', closable:true, content:'<div style="display:flex;flex-direction:column;gap:6px">'+items+'</div>',
      onMount:function(close){
        $$('.va-drawer-item').forEach(it=>it.onclick=()=>{
          $('#dep-network').value=it.dataset.net;
          if($('#dep-net-label')) $('#dep-net-label').textContent=it.dataset.net;
          close(); refresh();
        });
      }
    });
  }
  $('#dep-coin').onchange=refresh; $('#dep-network').onchange=refresh;
  if($('#dep-net-btn')) $('#dep-net-btn').onclick=openNetDrawer;
  async function copyDepositValue(input,label){
    if(!input||!input.value||input.value==='Loading address…'||input.value.indexOf('—')===0){
      toast(label+' is not available to copy yet.','err');return;
    }
    let copied=false;
    try{
      if(navigator.clipboard&&window.isSecureContext){
        await navigator.clipboard.writeText(input.value);
        copied=true;
      }
    }catch(e){}
    if(!copied){
      try{
        input.focus();input.select();
        copied=!!document.execCommand('copy');
        input.setSelectionRange(0,0);
      }catch(e){}
    }
    toast(copied?label+' copied to clipboard.':'Unable to copy '+label.toLowerCase()+'. Please select and copy it manually.',copied?'ok':'err');
  }
  $('#dep-copy').onclick=()=>copyDepositValue($('#dep-addr'),'Address');
  if($('#dep-memo-copy')) $('#dep-memo-copy').onclick=()=>copyDepositValue($('#dep-memo'),'Memo');
  refresh();
};

/* ===================== WITHDRAW (multi-step state machine) ===================== */
VIEWS.withdraw = function(){
  return '<div class="va-page" style="max-width:720px;margin:0 auto">'+
    '<h1 class="page-title">Withdraw</h1>'+
    '<p class="page-sub">Withdrawals require fund password and are reviewed manually.</p>'+
    '<div class="va-stepper" id="wd-stepper">'+
      '<div class="va-step-h active" data-wstep="1"><div class="va-step-dot">1</div><div class="va-step-label">Info</div></div>'+
      '<div class="va-step-line" data-wline="1"></div>'+
      '<div class="va-step-h" data-wstep="2"><div class="va-step-dot">2</div><div class="va-step-label">Confirm</div></div>'+
      '<div class="va-step-line" data-wline="2"></div>'+
      '<div class="va-step-h" data-wstep="3"><div class="va-step-dot">3</div><div class="va-step-label">Security</div></div>'+
      '<div class="va-step-line" data-wline="3"></div>'+
      '<div class="va-step-h" data-wstep="4"><div class="va-step-dot">4</div><div class="va-step-label">Result</div></div>'+
    '</div>'+

    '<form id="wd-form" autocomplete="off">'+
      /* ---- STEP 1: fill info ---- */
      '<div class="va-step-panel active" data-wpanel="1">'+
        '<div class="va-card"><div class="va-card-body">'+
          '<div class="va-form-grid">'+
            '<div><label class="auth-label">Coin</label><select id="wd-coin" class="auth-input" style="appearance:none">'+DW_COINS.map(c=>'<option>'+c+'</option>').join('')+'</select></div>'+
            '<div><label class="auth-label">Network</label><select id="wd-network" class="auth-input" style="appearance:none"></select></div>'+
          '</div>'+
          '<div class="va-field"><label class="auth-label">Withdrawal Address</label><input id="wd-addr" class="auth-input num" placeholder="Paste destination address" required></div>'+
          '<div class="va-field"><label class="auth-label">Amount</label>'+
            '<div class="va-amt-row"><input id="wd-amount" class="auth-input num" type="number" step="any" placeholder="0.00" required><button type="button" id="wd-max" class="btn btn-ghost">MAX</button></div>'+
            '<div class="va-amt-meta"><span>Available: <span id="wd-avail" class="num">—</span> <span id="wd-coin2">USDT</span></span><span>Fee: <span id="wd-fee" class="num">—</span> <span id="wd-coin3">USDT</span></span></div>'+
          '</div>'+
          '<div class="va-receive-box"><span class="va-r-label">You will receive</span><span class="va-r-val num"><span id="wd-receive-val">0.00</span> <span id="wd-receive-coin">USDT</span></span></div>'+
          '<input id="wd-receive" class="auth-input num" readonly value="0.00" style="position:absolute;left:-9999px;opacity:0;width:1px;height:1px" tabindex="-1">'+
          '<div class="va-nav-row"><button type="button" class="btn btn-primary btn-block" id="wd-next" style="padding:13px;font-size:15px">Next: Confirm</button></div>'+
        '</div></div>'+
      '</div>'+

      /* ---- STEP 3: security verification ---- */
      '<div class="va-step-panel" data-wpanel="3">'+
        '<div class="va-card"><div class="va-card-body">'+
          '<div class="section-title" style="margin-bottom:14px">Security Verification</div>'+
          '<div class="va-field"><label class="auth-label">Fund Password (6 digits)</label><input id="wd-fundpwd" class="auth-input num" type="password" maxlength="6" placeholder="******" required></div>'+
          '<div class="va-field"><label class="auth-label">2FA Code '+(state.settings.twofa?'':'(disabled — optional)')+'</label><input id="wd-2fa" class="auth-input num" maxlength="6" placeholder="000000"></div>'+
          '<div class="va-info" style="margin-bottom:16px">The requested amount and fee are reserved when you submit. Staff reviews every request; approval finalizes the debit, and staff then transfers funds manually.</div>'+
          '<div class="va-info" style="margin-bottom:16px;border-color:var(--warning);color:var(--text-primary)"><b>提现流程：</b>每笔申请都由后台人工审核。批准后仍需工作人员手动转账，只有标记为“已完成”才代表后台已记录出款。</div>'+
          '<div class="va-nav-row"><button type="button" class="btn btn-ghost" id="wd-back3">Back</button><button type="submit" id="wd-submit" class="btn btn-primary" style="flex:2;padding:13px;font-size:15px">Submit Withdrawal</button></div>'+
        '</div></div>'+
      '</div>'+
    '</form>'+

    /* ---- STEP 2: full-screen confirm review (outside form to avoid submit) ---- */
    '<div class="va-step-panel" data-wpanel="2">'+
      '<div class="section-title" style="margin-bottom:12px">Confirm Withdrawal Details</div>'+
      '<div class="va-review" id="wd-review-list"></div>'+
      '<div class="va-risk-box"><div class="va-risk-title">Risk Warning</div>Verify the full address and network. Staff will transfer funds manually only after approval; a transfer sent to the wrong address or network may result in permanent loss. A request may be rejected before the manual transfer.</div>'+
      '<div class="va-nav-row"><button type="button" class="btn btn-ghost" id="wd-back2">Back</button><button type="button" class="btn btn-primary" id="wd-confirm" style="flex:2;padding:13px">Confirm &amp; Continue</button></div>'+
    '</div>'+

    /* ---- STEP 4: result ---- */
    '<div class="va-step-panel" data-wpanel="4"><div class="va-card"><div class="va-card-body" id="wd-result-box"></div></div></div>'+
    '<div class="va-card" style="margin-top:18px"><div class="va-card-head"><div class="va-card-title">Withdrawal History</div><button type="button" class="btn btn-ghost" id="wd-history-refresh" style="padding:6px 10px;font-size:12px">Refresh</button></div><div id="wd-history" class="va-card-body"><div class="va-empty">Loading withdrawal history…</div></div></div>'+
  '</div>';
};
VIEWS.withdraw.afterRender = function(){
  const withdrawalUserKey=state.user&&String(state.user.uid||state.user.email||'')||'';
  const withdrawalPendingStorageKey=withdrawalUserKey?'btcbox.withdrawal.pending.v1.'+encodeURIComponent(withdrawalUserKey):'';
  function readPendingWithdrawal(){
    if(!withdrawalPendingStorageKey)return null;
    try{
      const raw=localStorage.getItem(withdrawalPendingStorageKey);
      if(!raw)return null;
      let item;
      try{item=JSON.parse(raw);}catch(_){return {version:1,invalid:true};}
      if(!item||item.version!==1||!/^[-A-Za-z0-9_]{16,80}$/.test(String(item.request_id||''))||
        !/^[A-Z0-9]{2,12}$/.test(String(item.coin||''))||!Number.isFinite(Number(item.amount))||
        Number(item.amount)<=0||!String(item.address||'').trim()||!String(item.network||''))return {version:1,invalid:true};
      return {version:1,request_id:String(item.request_id),coin:String(item.coin),amount:String(item.amount),
        address:String(item.address),network:String(item.network),created_at:Number(item.created_at)||0};
    }catch(_){return {version:1,invalid:true};}
  }
  function persistPendingWithdrawal(intent){
    if(!withdrawalPendingStorageKey)return false;
    try{localStorage.setItem(withdrawalPendingStorageKey,JSON.stringify(intent));return true;}
    catch(_){return false;}
  }
  function clearPendingWithdrawal(){
    if(withdrawalPendingStorageKey){try{localStorage.removeItem(withdrawalPendingStorageKey);}catch(_){}}
    withdrawalPendingIntent=null;
    if(withdrawalUserKey&&state._withdrawUnknownUserKey===withdrawalUserKey)state._withdrawUnknownUserKey=null;
  }
  let withdrawalPendingIntent=readPendingWithdrawal();
  let withdrawalSubmitting=false, withdrawalOutcomeUnknown=!!(withdrawalPendingIntent||(withdrawalUserKey&&state._withdrawUnknownUserKey===withdrawalUserKey));
  function currentFee(){return WITHDRAW_FEES[$('#wd-coin').value]||0;}
  function goStep(n){
    $$('.va-step-panel').forEach(p=>p.classList.toggle('active', p.dataset.wpanel==String(n)));
    $$('.va-step-h').forEach(h=>{
      const s=Number(h.dataset.wstep);
      h.classList.toggle('active', s===n);
      h.classList.toggle('done', s<n);
    });
    $$('.va-step-line').forEach(l=>l.classList.toggle('done', Number(l.dataset.wline)<n));
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function refresh(){
    const coin=$('#wd-coin').value, nets=NETWORKS[coin]||['ERC20'];
    const prevNet=$('#wd-network').value;
    $('#wd-network').innerHTML=nets.map(n=>'<option>'+escapeHtml(n)+'</option>').join('');
    if(nets.indexOf(prevNet)>=0) $('#wd-network').value=prevNet;
    const net=$('#wd-network').value;
    const avail=state.balances[coin]?state.balances[coin].free:0;
    const fee=currentFee();
    $('#wd-avail').textContent=fmt(avail,coin==='USDT'?2:6);
    $('#wd-coin2').textContent=coin; $('#wd-coin3').textContent=coin;
    $('#wd-fee').textContent=fmt(fee,coin==='USDT'?2:6);
    if($('#wd-receive-coin')) $('#wd-receive-coin').textContent=coin;
    calcReceive();
  }
  function calcReceive(){
    const coin=$('#wd-coin').value;
    const amt=parseFloat($('#wd-amount').value)||0;
    // Backend contract: amount is the recipient amount; fee is debited separately.
    const recv=fmt(amt,coin==='USDT'?2:6);
    $('#wd-receive').value=recv;
    if($('#wd-receive-val')) $('#wd-receive-val').textContent=recv;
  }
  function fillReview(){
    const coin=$('#wd-coin').value, net=$('#wd-network').value, addr=$('#wd-addr').value.trim();
    const amt=parseFloat($('#wd-amount').value)||0;
    const fee=currentFee();
    const safeAddr=addr.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const row=(k,v,cls)=>'<div class="va-review-row'+(cls?' '+cls:'')+'"><span class="va-k">'+k+'</span><span class="va-v'+(cls==='addr'?' addr':'')+'">'+v+'</span></div>';
    $('#wd-review-list').innerHTML=
      row('Coin',coin)+row('Network',net)+
      row('Withdrawal Address','<span style="word-break:break-all">'+safeAddr+'</span>','addr')+
      row('Recipient Amount',fmt(amt,coin==='USDT'?2:6)+' '+coin)+
      row('Network Fee',fmt(fee,coin==='USDT'?2:6)+' '+coin)+
      row('Total Debited',fmt(amt+fee,coin==='USDT'?2:6)+' '+coin,'total');
  }
  /* Unknown transport/RPC outcomes must never be presented as a confirmed failure. */
  function isWdOutcomeUnknown(r){
    if(!r||Number(r.status||0)===0||r.code==='NETWORK_ERROR'||r.code==='NETWORK_RESPONSE_ERROR'||r.code==='FINANCIAL_RPC_FAILED'||r.code==='FINANCIAL_RPC_UNAVAILABLE') return true;
    return Number(r.status)>=500 && ['FINANCIAL_CUTOVER_INCOMPLETE','FINANCIAL_RPC_NOT_CONFIGURED'].indexOf(r.code)<0;
  }
  /* Map backend status to a user-visible result without inventing balance guarantees. */
  function escapeWdText(value){
    return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});
  }
  async function refreshWithdrawalHistory(){
    const host=$('#wd-history');
    if(!host)return;
    host.innerHTML='<div class="va-empty">Loading withdrawal history…</div>';
    try{
      const result=await apiAdapter.withdrawalHistory();
      if(!result||!result.ok||!Array.isArray(result.withdrawals)){
        host.innerHTML='<div class="va-empty">Withdrawal history is temporarily unavailable. Please refresh later.</div>';
        return;
      }
      const rows=result.withdrawals;
      if(!rows.length){host.innerHTML='<div class="va-empty">No withdrawal requests yet.</div>';return;}
      const statusLabel={pending:'待审核',approved:'已批准 · 等待人工转账',rejected:'已拒绝 · 预留金额已退回',completed:'已完成 · 人工转账已记录',broadcast:'转账处理中',failed:'失败'};
      host.innerHTML='<div class="va-table-wrap scroll"><table class="va-table" style="min-width:620px"><thead><tr><th>币种 / 网络</th><th>申请金额</th><th>状态</th><th>时间</th><th>转账参考号</th></tr></thead><tbody>'+
        rows.map(function(w){
          const status=String(w.status||'');
          const timeValue=w.paid_at||w.time||'';
          const timeText=timeValue?new Date(timeValue).toLocaleString():'—';
          return '<tr><td>'+escapeWdText(w.coin)+' / '+escapeWdText(w.network)+'</td><td class="num">'+escapeWdText(w.amount)+' <span style="color:var(--text-muted)">Fee '+escapeWdText(w.fee)+'</span></td><td>'+escapeWdText(statusLabel[status]||status)+'</td><td class="num">'+escapeWdText(timeText)+'</td><td class="num" style="font-size:11px;word-break:break-all">'+escapeWdText(w.payout_reference||w.txid||'—')+'</td></tr>';
        }).join('')+'</tbody></table></div>';
    }catch(_){
      host.innerHTML='<div class="va-empty">Withdrawal history is temporarily unavailable. Please refresh later.</div>';
    }
  }
  function wdResultState(r){
    if(isWdOutcomeUnknown(r)) return {key:'unknown',title:'Status Unconfirmed',ico:'unknown',sub:'We could not confirm whether this withdrawal request was recorded. Do not submit it again until its status has been checked.'};
    if(!r||!r.ok) return {key:'failed',title:'Request Not Confirmed',ico:'failed',sub:(r&&(r.msg||r.message))||'The withdrawal request was rejected. Please review the details and try again.'};
    const s=String(r.status||'').toLowerCase();
    if(r.duplicate) return {key:'submitted',title:'Already Submitted',ico:'submitted',sub:'This withdrawal request was already received. Do not submit it again.'};
    if(s.indexOf('cancel')>=0) return {key:'cancelled',title:'Cancelled',ico:'cancelled',sub:'This withdrawal was cancelled.'};
    if(s.indexOf('fail')>=0||s.indexOf('reject')>=0) return {key:'failed',title:'Failed / Rejected',ico:'failed',sub:r.msg||'Withdrawal was rejected. Please review the details and try again.'};
    if(s.indexOf('complete')>=0||s.indexOf('sent')>=0||s.indexOf('success')>=0) return {key:'done',title:'Completed (Manual Transfer)',ico:'done',sub:'Staff recorded the manual transfer as completed. Any transaction reference is shown in your withdrawal history.'};
    if(s.indexOf('process')>=0||s.indexOf('broadcast')>=0) return {key:'processing',title:'Processing',ico:'processing',sub:'Withdrawal is being processed / broadcast. Please wait for on-chain confirmation.'};
    if(s.indexOf('review')>=0||s.indexOf('pending')>=0||s.indexOf('audit')>=0||s.indexOf('approve')>=0) return {key:'review',title:'Under Review',ico:'review',sub:'Withdrawal submitted and awaiting manual review. It has NOT been sent on-chain yet.'};
    return {key:'submitted',title:'Submitted',ico:'submitted',sub:'Withdrawal request submitted. It will be reviewed manually before funds are sent. This is NOT a chain-arrival confirmation.'};
  }
  function showResult(r, coin, amt){
    const st=wdResultState(r);
    const wid = r&&(r.withdrawal_id||r.operation_id||r.request_id)||(withdrawalPendingIntent&&withdrawalPendingIntent.request_id)||'';
    coin = coin || $('#wd-coin').value;
    amt = amt || parseFloat($('#wd-amount').value) || 0;
    const safeSub=escapeWdText(st.sub), safeWid=escapeWdText(wid), safeCoin=escapeWdText(coin);
    const html='<div class="va-result">'+
      '<div class="va-result-ico '+st.ico+'">'+(st.ico==='failed'?'✕':st.ico==='cancelled'?'⊘':st.ico==='unknown'?'?':'✓')+'</div>'+
      '<div class="va-result-title">'+st.title+'</div>'+
      '<div class="va-result-sub">'+safeSub+'</div>'+
      (wid?'<div class="va-result-id">ID: '+safeWid+'</div>':'')+
      (r&&r.ok?'<div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">Amount: <b class="num">'+fmt(amt,2)+' '+safeCoin+'</b></div>':'')+
      '<div class="va-result-note">'+(st.key==='done'?'Staff recorded this manual transfer as completed. Check withdrawal history for its reference.':'Your request is awaiting manual review. Approval is not the same as payment: staff will send the funds manually and update the status.')+' Do not submit the same withdrawal twice.</div>'+
      '<div class="va-nav-row" style="margin-top:16px">'+(st.key==='unknown'?'':'<button type="button" class="btn btn-ghost" id="wd-new">New Withdrawal</button>')+'<a href="#/assets" class="btn btn-primary" style="flex:2">Back to Assets</a></div>'+
    '</div>';
    $('#wd-result-box').innerHTML=html;
    if($('#wd-new')) $('#wd-new').onclick=()=>{ $('#wd-form').reset(); refresh(); goStep(1); };
    // result MUST be shown via modal (not only toast)
    BTCBox.modal({title:'Withdrawal Result',width:'md',closable:true,
      buttons:[{text:'Done',variant:'primary'}],
      content:'<div style="font-size:13px;line-height:1.7">'+
        '<div style="font-weight:700;font-size:15px;margin-bottom:8px;color:'+(st.ico==='failed'?'var(--down)':st.ico==='unknown'?'var(--warning)':'var(--brand-bright)')+'">'+st.title+'</div>'+
        '<div style="color:var(--text-secondary)">'+safeSub+'</div>'+
        (wid?'<div style="margin-top:10px;font-family:var(--font-mono);font-size:12px;color:var(--text-muted);word-break:break-all">ID: '+safeWid+'</div>':'')+
        '<div style="margin-top:12px;font-size:11px;color:var(--text-muted)">'+(st.key==='unknown'?'Do not submit another withdrawal until this request is reconciled.':st.key==='done'?'Staff recorded the manual transfer as completed.':'Approval is not payment; staff will transfer funds manually after approval.')+'</div>'+
      '</div>'});
    goStep(4);
  }
  $('#wd-coin').onchange=refresh; $('#wd-network').onchange=refresh; $('#wd-amount').oninput=calcReceive;
  $('#wd-max').onclick=()=>{
    const coin=$('#wd-coin').value;
    const avail=state.balances[coin]?state.balances[coin].free:0;
    const maxAmount=Math.max(0,avail-currentFee());
    if(maxAmount<=0){toast('Available balance does not cover the network fee.','err');return;}
    $('#wd-amount').value=String(maxAmount);calcReceive();
  };
  refresh();
  refreshWithdrawalHistory();
  if($('#wd-history-refresh')) $('#wd-history-refresh').onclick=refreshWithdrawalHistory;
  if(withdrawalOutcomeUnknown){
    const blockedBtn=$('#wd-submit');
    if(blockedBtn){blockedBtn.disabled=true;blockedBtn.textContent='Status Unconfirmed';}
    if(withdrawalPendingIntent){
      showResult({ok:false,code:'NETWORK_ERROR',status:0,request_id:withdrawalPendingIntent.request_id,
        msg:'A previous withdrawal attempt has no confirmed result. Its original request ID is being retained; contact support to reconcile it before creating another withdrawal.'},
        withdrawalPendingIntent.coin,Number(withdrawalPendingIntent.amount));
    }else{
      toast('A previous withdrawal result is unconfirmed. Do not create another withdrawal until support reconciles it.','warn');
    }
  }
  /* step 1 -> step 2 (light validation with inline errors) */
  if($('#wd-next')) $('#wd-next').onclick=()=>{
    const addr=$('#wd-addr').value.trim(), amt=parseFloat($('#wd-amount').value);
    const coin=$('#wd-coin').value;
    let ok=true;
    if(!addr||addr.length<8){toast('Enter a valid withdrawal address.','err');ok=false;}
    if(!amt||amt<=0){toast('Enter a valid amount.','err');ok=false;}
    const avail=state.balances[coin]?state.balances[coin].free:0;
    if(amt+currentFee()>avail){toast('Insufficient balance for the amount plus network fee.','err');ok=false;}
    if(!ok)return;
    fillReview(); goStep(2);
  };
  if($('#wd-back2')) $('#wd-back2').onclick=()=>goStep(1);
  /* step 2 -> risk confirm modal (closable:false, risk size) -> step 3 */
  if($('#wd-confirm')) $('#wd-confirm').onclick=()=>{
    const coin=$('#wd-coin').value, net=$('#wd-network').value, addr=$('#wd-addr').value.trim();
    const amt=parseFloat($('#wd-amount').value)||0;
    BTCBox.modal({title:'Confirm Withdrawal',width:'risk',closable:false,
      buttons:[{text:'Cancel',variant:'ghost'},{text:'I Confirm, Continue',variant:'primary'}],
      content:'<div style="font-size:13px;line-height:1.8">'+
        '<div class="va-review-row" style="padding:8px 0"><span class="va-k">Coin / Network</span><span class="va-v">'+coin+' · '+net+'</span></div>'+
        '<div class="va-review-row" style="padding:8px 0"><span class="va-k">Address</span><span class="va-v addr">'+String(addr).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')+'</span></div>'+
        '<div class="va-review-row" style="padding:8px 0"><span class="va-k">Recipient Amount</span><span class="va-v num">'+fmt(amt,coin==='USDT'?2:6)+' '+coin+'</span></div>'+
        '<div class="va-review-row" style="padding:8px 0"><span class="va-k">Fee / Total Debit</span><span class="va-v num">'+fmt(currentFee(),coin==='USDT'?2:6)+' / '+fmt(amt+currentFee(),coin==='USDT'?2:6)+' '+coin+'</span></div>'+
        '<div class="va-risk-box" style="margin:12px 0 0"><div class="va-risk-title">Irreversible after broadcast</div>Verify the address one more time. Withdrawals cannot be cancelled once broadcast. A wrong address/network causes permanent loss.</div>'+
      '</div>',
      onMount:function(close,api){
        api.el.querySelectorAll('[data-mbtn]').forEach((b,i)=>{
          b.onclick=()=>{ if(i===0){close();} else {close(); goStep(3); setTimeout(()=>{const f=$('#wd-fundpwd');if(f)f.focus();},200);} };
        });
      }});
  };
  if($('#wd-back3')) $('#wd-back3').onclick=()=>goStep(2);
  /* Restore the guarded presentation when returning to this route in the same SPA session. */
  const withdrawalSubmitButton=$('#wd-submit');
  if(withdrawalSubmitButton&&withdrawalOutcomeUnknown){withdrawalSubmitButton.disabled=true;withdrawalSubmitButton.textContent='Status Unconfirmed';}
  /* submit handler — one in-flight action; ambiguous outcomes are not retried blindly */
  $('#wd-form').onsubmit=async e=>{
    e.preventDefault();
    if(withdrawalSubmitting||withdrawalOutcomeUnknown){
      toast('A previous withdrawal result for this account is still unconfirmed. Do not submit another request; contact support to reconcile it.','warn');
      return;
    }
    const coin=$('#wd-coin').value, addr=$('#wd-addr').value.trim(), amt=parseFloat($('#wd-amount').value);
    if(!addr||addr.length<8){toast('Enter a valid withdrawal address.','err');return;}
    if(!amt||amt<=0){toast('Enter a valid amount.','err');return;}
    const avail=state.balances[coin]?state.balances[coin].free:0;
    if(amt+currentFee()>avail){toast('Insufficient balance for the amount plus network fee.','err');return;}
    if(!/^\d{6}$/.test($('#wd-fundpwd').value)){toast('Fund password must be 6 digits.','err');return;}
    if(state.settings.twofa&&!/^\d{6}$/.test($('#wd-2fa').value)){toast('Enter your 6-digit 2FA code.','err');return;}
    const btn=$('#wd-submit');if(!btn)return;
    const withdrawalIntent={version:1,request_id:uid(),coin,amount:String(amt),address:addr,network:$('#wd-network').value,created_at:Date.now()};
    /* Persist the exact idempotency key + immutable intent before network I/O. Never store fund password or 2FA. */
    if(!persistPendingWithdrawal(withdrawalIntent)){
      toast('This browser cannot safely retain the withdrawal request ID. No request was sent. Enable site storage and try again.','err');
      return;
    }
    withdrawalPendingIntent=withdrawalIntent;
    withdrawalSubmitting=true;btn.disabled=true;btn.textContent='Submitting…';
    let r;
    try{
      r=await apiAdapter.withdraw({coin:withdrawalIntent.coin,amount:amt,address:withdrawalIntent.address,
        network:withdrawalIntent.network,request_id:withdrawalIntent.request_id,
        fund_password:$('#wd-fundpwd').value,twofa_code:$('#wd-2fa').value||undefined});
      withdrawalOutcomeUnknown=isWdOutcomeUnknown(r);
      if(withdrawalOutcomeUnknown){
        if(withdrawalUserKey)state._withdrawUnknownUserKey=withdrawalUserKey;
      }else{
        clearPendingWithdrawal();
      }
    }catch(err){
      r={ok:false,code:'NETWORK_ERROR',status:0,request_id:withdrawalIntent.request_id,msg:'The withdrawal result could not be confirmed.'};
      withdrawalOutcomeUnknown=true;
      if(withdrawalUserKey)state._withdrawUnknownUserKey=withdrawalUserKey;
    }finally{
      withdrawalSubmitting=false;
      if(withdrawalOutcomeUnknown){btn.disabled=true;btn.textContent='Status Unconfirmed';}
      else{btn.disabled=false;btn.textContent='Submit Withdrawal';}
    }
    if(r&&typeof r==='object'&&!r.request_id)r.request_id=withdrawalIntent.request_id;
    if(r&&r.ok){
      /* capture before reset (preserved reset+refresh behavior) */
      const okCoin=coin, okAmt=amt;
      $('#wd-form').reset();refresh();
      showResult(r, okCoin, okAmt);
      refreshWithdrawalHistory();
    }else{
      showResult(r, coin, amt);
    }
  };
};

/* ===================== EARN ===================== */
/* No authoritative live product catalogue/APY feed is connected.
   Keep Earn non-actionable until product terms and financial cutover are verified.
   The catalogue below is kept for reference/contract tests only; the rendered EARN_PRODUCTS list stays empty. */
const EARN_PRODUCT_CATALOG=[
  {id:'flex_USDT',type:'flexible',coin:'USDT',apy:4.8,min:10,term:'Flexible',desc:'Redeem anytime, interest distributed daily'},
  {id:'flex_BTC',type:'flexible',coin:'BTC',apy:1.2,min:0.001,term:'Flexible',desc:'Redeem anytime, interest distributed daily'},
  {id:'flex_ETH',type:'flexible',coin:'ETH',apy:2.1,min:0.01,term:'Flexible',desc:'Redeem anytime, interest distributed daily'},
  {id:'fixed30',type:'fixed',coin:'USDT',apy:8.5,min:100,term:'30 days',desc:'Locked 30 days, higher APY'},
  {id:'fixed90',type:'fixed',coin:'USDT',apy:12.0,min:500,term:'90 days',desc:'Locked 90 days, higher APY'},
  {id:'fixed180',type:'fixed',coin:'USDT',apy:14.0,min:1000,term:'180 days',desc:'Locked 180 days, highest indicative APY'},
];
const EARN_PRODUCTS=[];
VIEWS.earn = function(){
  return '<div class="va-page">'+
    '<h1 class="page-title">Earn</h1>'+
    '<p class="page-sub">Earn products are currently unavailable. Product terms and rates will appear only when verified and enabled.</p>'+
    '<div class="va-earn-tabs">'+
      '<div class="tab active" data-etab="flexible">Flexible</div>'+
      '<div class="tab" data-etab="fixed">Fixed</div>'+
    '</div>'+
    '<div id="earn-grid" class="va-earn-grid"></div>'+
    '<div class="va-card" style="margin-top:24px">'+
      '<div class="va-card-head"><div class="va-card-title">My Earn Positions</div></div>'+
      '<div id="earn-positions">'+emptyState('Position data unavailable','Earn position records are not currently connected to this view. Do not submit another subscription solely because a position is not displayed.')+'</div>'+
    '</div>'+
  '</div>';
};
VIEWS.earn.afterRender = function(){
  let tab='flexible';
  const earnUserKey=state.user&&String(state.user.uid||state.user.email||'')||'__anonymous__';
  if(!state._earnUnknownProductIdsByUser||typeof state._earnUnknownProductIdsByUser!=='object') state._earnUnknownProductIdsByUser={};
  if(!Array.isArray(state._earnUnknownProductIdsByUser[earnUserKey])) state._earnUnknownProductIdsByUser[earnUserKey]=[];
  const earnUnknownProductIds=state._earnUnknownProductIdsByUser[earnUserKey];
  function render(){
    const list=EARN_PRODUCTS.filter(p=>p.type===tab);
    if(!list.length){$('#earn-grid').innerHTML=emptyState('Earn is not available yet','No verified product catalogue or live APY schedule is currently published. Subscriptions are disabled until product terms and the financial service are approved.');return;}
    $('#earn-grid').innerHTML=list.map(p=>'<div class="va-earn-card">'+
      '<div class="va-earn-head"><div><div class="va-earn-name">'+p.coin+' '+p.type.charAt(0).toUpperCase()+p.type.slice(1)+'</div><div class="va-earn-term">'+p.term+'</div></div><span class="tag" style="background:'+(p.type==='flexible'?'var(--brand-soft)':'rgba(240,185,11,.12)')+';color:'+(p.type==='flexible'?'var(--brand-bright)':'var(--warning)')+'">'+p.type+'</span></div>'+
      '<div class="va-apy"><div class="va-apy-label">Reference APY</div><div class="va-apy-val num">'+fmt(p.apy,1)+'<span class="va-unit">%</span></div></div>'+
      '<div class="va-earn-desc">'+p.desc+'</div>'+
      '<div class="va-earn-meta">Min. subscription: <span class="num">'+fmt(p.min,p.coin==='USDT'?2:4)+'</span> '+p.coin+' · Available: <span class="num">'+fmt(state.balances[p.coin]?state.balances[p.coin].free:0,p.coin==='USDT'?2:4)+'</span> '+p.coin+'</div>'+
      '<div class="va-risk-note">Risk: principal is not guaranteed. APY is indicative and may change. Redemption subject to product rules.</div>'+
      '<button class="btn btn-primary btn-block earn-sub" data-id="'+p.id+'">Subscribe</button></div>').join('');
    document.querySelectorAll('.earn-sub').forEach(b=>{
      const blocked=earnUnknownProductIds.indexOf(b.dataset.id)>=0;
      if(blocked){b.disabled=true;b.textContent='Status Unconfirmed';}
      b.onclick=()=>{
      if(blocked){toast('This subscription result is unconfirmed. Do not submit again until its status is confirmed by support or account operations.','warn');return;}
      const p=EARN_PRODUCTS.find(x=>x.id===b.dataset.id);
      BTCBox.modal({title:'Subscribe — '+p.coin+' '+p.type, width:'risk', closable:false,
        content:'<div style="margin-bottom:16px">'+
          '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px"><span style="color:var(--text-secondary)">APY</span><span class="num" style="color:var(--brand-bright);font-weight:700">'+fmt(p.apy,1)+'%</span></div>'+
          '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px"><span style="color:var(--text-secondary)">Term</span><span>'+p.term+'</span></div>'+
          '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:16px"><span style="color:var(--text-secondary)">Available</span><span class="num">'+fmt(state.balances[p.coin]?state.balances[p.coin].free:0,p.coin==='USDT'?2:4)+' '+p.coin+'</span></div>'+
          '<label class="auth-label">Amount ('+p.coin+')</label><input id="earn-amt" class="auth-input num" type="number" step="any" placeholder="Min '+fmt(p.min,p.coin==='USDT'?2:4)+'"></div>'+
          '<div class="va-risk-note" style="margin-bottom:16px">Subscription is final after confirmation. APY is indicative. Read the product rules before subscribing.</div>'+
          '<div style="display:flex;gap:10px"><button id="earn-cancel" class="btn btn-ghost" style="flex:1">Cancel</button><button id="earn-confirm" class="btn btn-primary" style="flex:2">Confirm Subscription</button></div>',
        onMount:function(close){
          let submitting=false,outcomeUnknown=false,requestId=null,lastPayloadKey='';
          const cancelBtn=$('#earn-cancel'), amountInput=$('#earn-amt');
          cancelBtn.onclick=()=>{if(!submitting)close();};
          $('#earn-confirm').onclick=async ()=>{
            if(submitting||outcomeUnknown)return;
            const amt=parseFloat($('#earn-amt').value);
            if(!amt||amt<p.min){toast('Minimum subscription is '+fmt(p.min,p.coin==='USDT'?2:4)+' '+p.coin,'err');return;}
            const payloadKey=p.id+'|'+String(amt);
            if(payloadKey!==lastPayloadKey){requestId=uid();lastPayloadKey=payloadKey;}
            const btn=$('#earn-confirm');submitting=true;btn.disabled=true;cancelBtn.disabled=true;amountInput.disabled=true;btn.textContent='Submitting…';
            let r;
            try{
              r=await apiAdapter.earn({action:'subscribe',request_id:requestId,amount:amt,product_id:p.id});
              outcomeUnknown=!!(!r||Number(r.status||0)===0||r.code==='NETWORK_ERROR'||r.code==='NETWORK_RESPONSE_ERROR'||(Number(r.status)>=500&&r.code!=='FINANCIAL_CUTOVER_INCOMPLETE'));
            }catch(err){
              r={ok:false,code:'NETWORK_ERROR',status:0,msg:'Subscription result could not be confirmed.'};
              outcomeUnknown=true;
            }finally{
              submitting=false;
              if(outcomeUnknown){btn.disabled=true;cancelBtn.disabled=false;amountInput.disabled=true;btn.textContent='Status Unconfirmed';}
              else{btn.disabled=false;cancelBtn.disabled=false;amountInput.disabled=false;btn.textContent='Confirm Subscription';}
            }
            if(outcomeUnknown){
              if(earnUnknownProductIds.indexOf(p.id)<0) earnUnknownProductIds.push(p.id);
              document.querySelectorAll('.earn-sub').forEach(function(sub){if(sub.dataset.id===p.id){sub.disabled=true;sub.textContent='Status Unconfirmed';}});
              toast('Subscription status is unconfirmed. Do not submit again until its status is confirmed by support or account operations.','warn');
              return;
            }
            if(r&&r.ok){
              close();
              BTCBox.modal({title:'Subscription Result',width:'md',closable:true,buttons:[{text:'Done',variant:'primary'}],
                content:'<div style="font-size:13px;line-height:1.7"><div style="font-weight:700;color:var(--brand-bright);margin-bottom:8px">Subscription Submitted</div><div style="color:var(--text-secondary)">'+(r.msg||'Subscribed')+' '+fmt(amt,2)+' '+p.coin+' @ '+fmt(p.apy,1)+'% APY.</div>'+(r.record_id?'<div style="margin-top:10px;font-family:var(--font-mono);font-size:12px;color:var(--text-muted)">Record ID: '+r.record_id+'</div>':'')+'<div style="margin-top:10px;font-size:11px;color:var(--text-muted)">Earn position records are not currently displayed in this view. Verify the authoritative account record before taking further action.</div></div>'});
            } else {
              toast((r&&(r.msg||r.message))||'Subscription was not confirmed. Please review and try again.','err');
            }
          };
        }});
      };
    });
  }
  render();
  $$('[data-etab]').forEach(t=>t.onclick=()=>{tab=t.dataset.etab;$$('[data-etab]').forEach(x=>x.classList.remove('active'));t.classList.add('active');render();});
};
