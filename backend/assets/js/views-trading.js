/* BTCBOX views-trading.js — extracted from index.html, IIFE unwrapped, load order preserved. */
/* UI/UX upgrade: seconds contract (rules + risk, no marketing) + orders (modal confirm + detail drawer). */
"use strict";
if(!document.getElementById('views-trade-css')) document.head.insertAdjacentHTML('beforeend','<link id="views-trade-css" rel="stylesheet" href="/assets/css/views-trade.css">');

/* ================= VIEW BATCH C: Seconds / Orders ================= */
const SEC_COINS=['BTC','ETH','SOL','BNB'];
const SEC_DUR=[{label:'30s',sec:30},{label:'60s',sec:60},{label:'5m',sec:300},{label:'15m',sec:900}];

VIEWS.seconds = function(){
  return '<div class="seconds-page">'+
    '<div class="seconds-heading"><div><div class="seconds-eyebrow">TRADE</div><h1 class="page-title">Seconds Contracts</h1></div><span class="seconds-market-tag">USDT SETTLEMENT</span></div>'+
    '<div class="card sec-main-card">'+
      '<div class="sec-coin-row">'+SEC_COINS.map((c,i)=>'<button class="sec-coin'+(i===0?' active':'')+'" data-coin="'+c+'">'+c+'/USDT</button>').join('')+'</div>'+
      '<div class="sec-price-bar">'+
        '<div class="sec-price-block"><div class="sec-price-label">Current Price</div><div class="num" id="sec-price">—</div></div>'+
        '<div class="sec-dur-row" id="sec-dur-row">'+SEC_DUR.map((d,i)=>'<button class="sec-dur'+(i===0?' active':'')+'" data-sec="'+d.sec+'">'+d.label+'</button>').join('')+'</div>'+
        '<div class="sec-amount-block"><label class="auth-label">Amount (USDT)</label><input id="sec-amount" class="auth-input num" type="number" value="100" min="1"></div>'+
      '</div>'+
      '<div class="sec-dir-grid">'+
        '<button id="sec-up" class="sec-dir-btn"><span class="sec-dir-arrow">&#9650;</span>UP (Price rises)</button>'+
        '<button id="sec-down" class="sec-dir-btn"><span class="sec-dir-arrow">&#9660;</span>DOWN (Price falls)</button>'+
      '</div>'+
      '<div id="sec-countdown"><div class="cd-label">Position open — settling in</div><div id="sec-cd-num" class="num">30s</div></div>'+
      '<div class="sec-rules"><div class="rules-title">Rules</div>· At expiry the position settles against the reference price from Coinbase/Bybit.<br>· Correct direction: payout = amount × configured rate (minimum 85%). Wrong direction: full amount lost. Tie: principal refunded.<br>· Multiple open positions are allowed; each position settles independently.</div>'+
      '<div class="sec-risk"><div class="risk-title">Risk Warning</div>Seconds contracts are high-risk derivatives. You may lose the entire invested amount. This is not investment advice. Only use funds you can afford to lose and manage your risk.</div>'+
    '</div>'+
    '<div class="card sec-list-card"><div style="display:flex;border-bottom:1px solid var(--border)"><div class="tab active" data-stab="open">Open Positions</div><div class="tab" data-stab="history">History</div></div><div id="sec-list" class="scroll"></div></div>'+
  '</div>';
};
VIEWS.seconds.afterRender = function(){
  const secondsUserKey=state.user&&String(state.user.uid||state.user.email||'')||'';
  let coin='BTC', dur=30, positionsReady=false, positionsLoadFailed=false, policyReady=false, secondsPolicy=null;
  let positionsUnavailableMessage='The latest contract status could not be confirmed. Refresh before opening a new position.';
  const secondsPendingStorageKey=secondsUserKey?'btcbox.seconds.pending.v1.'+encodeURIComponent(secondsUserKey):'';
  function readPendingSecondsOrder(){
    if(!secondsPendingStorageKey)return null;
    try{
      const raw=localStorage.getItem(secondsPendingStorageKey);
      if(!raw)return null;
      let item;
      try{item=JSON.parse(raw);}catch(_){return {version:1,invalid:true};}
      if(!item||item.version!==1||!/^[-A-Za-z0-9_]{16,100}$/.test(String(item.request_id||''))||
        !/^(BTC|ETH|SOL|BNB)$/.test(String(item.symbol||''))||!/^(UP|DOWN)$/.test(String(item.direction||''))||
        (!Number.isSafeInteger(Number(item.duration_sec))||Number(item.duration_sec)<1||Number(item.duration_sec)>2147483647)||!Number.isFinite(Number(item.amount))||
        Number(item.amount)<=0||!Number.isFinite(Number(item.created_at)))return {version:1,invalid:true};
      return {version:1,request_id:String(item.request_id),symbol:String(item.symbol),direction:String(item.direction),
        duration_sec:Number(item.duration_sec),amount:String(item.amount),created_at:Number(item.created_at)};
    }catch(_){return {version:1,invalid:true};}
  }
  function persistPendingSecondsOrder(intent){
    if(!secondsPendingStorageKey)return false;
    try{localStorage.setItem(secondsPendingStorageKey,JSON.stringify(intent));return true;}catch(_){return false;}
  }
  function clearPendingSecondsOrder(){
    if(!secondsPendingStorageKey)return false;
    try{localStorage.removeItem(secondsPendingStorageKey);}catch(_){return false;}
    secondsPendingIntent=null;
    if(secondsUserKey&&state._secondsOrderUnknownUserKey===secondsUserKey)delete state._secondsOrderUnknownUserKey;
    return true;
  }
  let secondsPendingIntent=readPendingSecondsOrder();
  if(secondsPendingIntent&&secondsUserKey)state._secondsOrderUnknownUserKey=secondsUserKey;
  let busy=!!secondsPendingIntent||!!(secondsUserKey&&state._secondsOrderUnknownUserKey===secondsUserKey);
  const settlingPositionIds=new Set(), autoSettlementAttempted=new Set();
  function setSecondsEntryEnabled(enabled,reason){
    ['#sec-up','#sec-down'].forEach(function(selector){
      const button=$(selector);
      if(!button)return;
      if(state.user&&!policyReady){enabled=false;reason='Contract policy is unavailable. Refresh before opening a position.';}
      if(secondsPolicy&&secondsPolicy.enabled===false){enabled=false;reason='Seconds contracts are currently paused by the administrator.';}
      button.disabled=!enabled;
      button.setAttribute('aria-disabled',String(!enabled));
      if(!enabled&&reason)button.title=reason;
      else button.removeAttribute('title');
    });
  }
  function isSecondsOrderOutcomeUnknown(r){
    const status=Number(r&&r.status||0), code=String(r&&r.code||'');
    if(!r||status===0||code==='NETWORK_ERROR'||code==='NETWORK_RESPONSE_ERROR'||r.raw) return true;
    // A platform HTML 404/500 is not a structured business rejection.
    // apiFetch exposes invalid JSON responses through r.raw; keep the idempotency lock.
    // These two 503 contracts guarantee that no position/funds action occurred.
    if(code==='FINANCIAL_CUTOVER_INCOMPLETE'||code==='REFERENCE_PRICE_UNAVAILABLE') return false;
    return status>=500;
  }
  function findSecondsPositionSnapshot(position,snapshot){
    const id=String(position&&position.position_id||'');
    if(!id||!snapshot) return {status:'unknown',position:null};
    const open=Array.isArray(snapshot.open)?snapshot.open:[];
    const openPosition=open.find(function(item){return String(item&&item.position_id||'')===id;});
    if(openPosition){
      const settleAt=Number(openPosition.settle_at);
      return Number.isFinite(settleAt)&&settleAt>0?{status:'open',position:openPosition}:{status:'unknown',position:null};
    }
    const history=Array.isArray(snapshot.history)?snapshot.history:[];
    const historyPosition=history.find(function(item){return String(item&&item.position_id||'')===id;});
    if(historyPosition) return {status:'history',position:historyPosition};
    return {status:'unknown',position:null};
  }
  function updPrice(){const el=$('#sec-price');if(!el){clearInterval(iv);return;}const p=market[coin+'USDT'];el.textContent=p&&Number(p.price)>0?fmtPrice(p.price,coin):'—';}
  updPrice(); const iv=setInterval(updPrice,1500);
  $$('.sec-coin').forEach(b=>b.onclick=()=>{coin=b.dataset.coin;$$('.sec-coin').forEach(x=>x.classList.remove('active'));b.classList.add('active');updPrice();});
  function durationLabel(seconds){
    if(seconds%86400===0)return (seconds/86400)+'d';
    if(seconds%3600===0)return (seconds/3600)+'h';
    if(seconds%60===0)return (seconds/60)+'m';
    return seconds+'s';
  }
  function secondsRemainingLabel(settleAt){
    const left=Math.max(0,Math.ceil((Number(settleAt)*1000-Date.now())/1000));
    if(left<=0)return 'Settling…';
    const minutes=Math.floor(left/60),seconds=left%60;
    return minutes>0?(minutes+'m '+seconds+'s'):(seconds+'s');
  }
  function applySecondsPolicy(policy){
    if(!policy||!Array.isArray(policy.allowed_durations)||!policy.allowed_durations.length)return;
    secondsPolicy=policy;
    policyReady=true;
    const row=$('#sec-dur-row');
    const durations=policy.allowed_durations.map(Number).filter(function(v){return Number.isSafeInteger(v)&&v>=1&&v<=2147483647;});
    if(!durations.length)return;
    if(!durations.includes(dur))dur=durations[0];
    if(row){
      row.innerHTML=durations.map(function(v){return '<button class="sec-dur'+(v===dur?' active':'')+'" data-sec="'+v+'">'+durationLabel(v)+'</button>';}).join('');
      row.querySelectorAll('.sec-dur').forEach(function(button){
        button.onclick=function(){dur=Number(button.dataset.sec);row.querySelectorAll('.sec-dur').forEach(function(x){x.classList.toggle('active',x===button);});};
      });
    }
    const amountInput=$('#sec-amount');
    if(amountInput){
      amountInput.min=String(policy.min_order_amount);
      amountInput.max=String(policy.max_order_amount);
      amountInput.placeholder='Min '+policy.min_order_amount+' · Max '+policy.max_order_amount;
      const current=Number(amountInput.value);
      if(!Number.isFinite(current)||current<Number(policy.min_order_amount)||current>Number(policy.max_order_amount)){
        amountInput.value=String(policy.min_order_amount);
      }
    }
    if(policy.enabled===false){setSecondsEntryEnabled(false,'Seconds contracts are currently paused by the administrator.');}
    else setSecondsEntryEnabled(positionsReady&&!busy,'');
  }
  $('.sec-dur').forEach(b=>b.onclick=()=>{dur=parseInt(b.dataset.sec);$('.sec-dur').forEach(x=>x.classList.remove('active'));b.classList.add('active');});
  function renderList(tab){
    const box=$('#sec-list');
    if(!box) return;
    if(!state.user){
      setSecondsEntryEnabled(true,'');
      box.innerHTML='<div class="guest-orders-prompt"><strong>Sign in to view contract positions</strong><span>Open positions and settlement history are private account data.</span><button type="button" class="btn btn-primary" data-sec-login>Log in</button></div>';
      const gate=box.querySelector('[data-sec-login]');if(gate)gate.onclick=()=>window.BTCBoxRequireLogin(location.hash);
      return;
    }
    if(!positionsReady){
      box.innerHTML=emptyState(positionsLoadFailed?'Position status unavailable':'Checking open positions',
        positionsLoadFailed?positionsUnavailableMessage:'Please wait while the latest contract status is verified.');
      return;
    }
    const openPositions=Array.isArray(state.secondsPositions?.open)?state.secondsPositions.open:[];
    const historyPositions=Array.isArray(state.secondsPositions?.history)?state.secondsPositions.history:[];
    if(tab==='open'&&secondsPendingIntent&&secondsPendingIntent.invalid){
      box.innerHTML=emptyState('Order status needs review','A saved order record on this device is damaged. Do not submit another position. Contact support to reconcile your account history before retrying.');
      return;
    }
    if(tab==='open'&&secondsPendingIntent&&!secondsPendingIntent.invalid){
      box.innerHTML=emptyState('Order status unconfirmed','A previous request ('+secondsPendingIntent.request_id+') may have reached the server. Do not submit another position; contact support to reconcile it before retrying.');
      return;
    }
    if(tab==='open'&&secondsUserKey&&state._secondsOrderUnknownUserKey===secondsUserKey&&!openPositions.length){
      box.innerHTML=emptyState('Order status unconfirmed','The server may have received the previous request. Do not submit another position; contact support to reconcile it.');
      return;
    }
    const list=tab==='open'?openPositions:historyPositions;
    if(!list.length){box.innerHTML=emptyState('No '+tab+' positions','Open a UP/DOWN position to see it here.');return;}
    box.innerHTML='<table><thead><tr><th class="th">Position</th><th class="th">Direction</th><th class="th num">Amount</th><th class="th num">Open Price</th><th class="th num">Settle Price</th><th class="th">Result</th><th class="th">Countdown</th><th class="th">Action</th></tr></thead><tbody>'+
      list.map(p=>{const isOpen=tab==='open'||p.status==='open';return '<tr class="trow"><td class="td" style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">'+escapeHtml(String(p.position_id||'—').slice(0,12))+'</td><td class="td" style="color:'+(p.direction==='UP'?'var(--up)':'var(--down)')+';font-weight:600">'+escapeHtml(p.direction)+'</td><td class="td num">'+fmt(p.amount,2)+' USDT</td><td class="td num">'+fmtPrice(p.open_price,p.symbol)+'</td><td class="td num">'+(p.settle_price?fmtPrice(p.settle_price,p.symbol):'—')+'</td><td class="td">'+(isOpen?'<span style="color:var(--warning)">Pending</span>':p.tie?'<span style="color:var(--text-secondary);font-weight:600">TIE · Refunded</span>':p.win?'<span style="color:var(--up);font-weight:600">WIN +'+fmt(p.pnl,2)+'</span>':'<span style="color:var(--down);font-weight:600">LOSE '+fmt(p.pnl,2)+'</span>')+'</td><td class="td"><span data-sec-countdown="'+escapeHtml(p.position_id)+'">'+(isOpen?secondsRemainingLabel(p.settle_at):'—')+'</span></td><td class="td">'+(isOpen&&Number(p.settle_at)*1000<=Date.now()?'<button type="button" class="sec-settle-btn" data-position-id="'+escapeHtml(p.position_id)+'" data-symbol="'+escapeHtml(p.symbol)+'">Settle</button>':isOpen?'<span style="color:var(--text-muted)">Pending</span>':'—')+'</td></tr>';}).join('')+'</tbody></table>';
    $$('.sec-settle-btn').forEach(b=>b.onclick=()=>settlePosition(b.dataset.positionId,b.dataset.symbol));
  }
  let stab='open';
  apiAdapter.secondsPolicyGet().then(function(result){
    if(result&&result.ok&&result.policy)applySecondsPolicy(result.policy);
    else setSecondsEntryEnabled(false,'Contract policy is unavailable. Refresh before opening a position.');
  }).catch(function(){setSecondsEntryEnabled(false,'Contract policy is unavailable. Refresh before opening a position.');});
  if(state.user){
    busy=!!secondsPendingIntent||!!(secondsUserKey&&state._secondsOrderUnknownUserKey===secondsUserKey);
    setSecondsEntryEnabled(false,'Checking the latest contract position status.');
    apiAdapter.secondsPositionsGet().then(function(result){
      if(result&&result.ok&&!result.cutover_incomplete){
        positionsReady=true;positionsLoadFailed=false;
        busy=!!secondsPendingIntent||!!(secondsUserKey&&state._secondsOrderUnknownUserKey===secondsUserKey);
        setSecondsEntryEnabled(!busy,busy?'An open position or unresolved order must be reconciled first.':'');
      }else{
        positionsReady=false;positionsLoadFailed=true;busy=true;
        positionsUnavailableMessage=(result&&result.msg)||'Contract position data is unavailable. New positions are disabled until status can be verified.';
        setSecondsEntryEnabled(false,positionsUnavailableMessage);
      }
      renderList(stab);
    }).catch(function(){
      positionsReady=false;positionsLoadFailed=true;busy=true;
      setSecondsEntryEnabled(false,positionsUnavailableMessage);
      renderList(stab);
    });
  }
  async function settlePosition(positionId,symbol){
    if(settlingPositionIds.has(positionId)) return;
    settlingPositionIds.add(positionId);
    let result;
    try {
      result=await apiAdapter.secondsSettle({position_id:positionId,request_id:uid(),symbol:symbol});
    } catch (_) {
      result={ok:false,msg:'Settlement could not be confirmed. The position remains pending.'};
    }
    settlingPositionIds.delete(positionId);
    if(!result.ok){
      autoSettlementAttempted.add(positionId);
      busy=!!secondsPendingIntent||!!(secondsUserKey&&state._secondsOrderUnknownUserKey===secondsUserKey);
      setSecondsEntryEnabled(!busy,busy?'An unresolved order request must be reconciled first.':'');
      toast(result.msg||'Settlement could not be confirmed. The position remains pending.','err');
      renderList(stab);
      return false;
    }
    if(result.settled===false){
      autoSettlementAttempted.add(positionId);
      busy=!!secondsPendingIntent||!!(secondsUserKey&&state._secondsOrderUnknownUserKey===secondsUserKey);
      setSecondsEntryEnabled(!busy,busy?'An unresolved order request must be reconciled first.':'');
      toast('The position has not reached maturity yet. It remains open.','warn');
      renderList(stab);
      return false;
    }
    busy=!!secondsPendingIntent||!!(secondsUserKey&&state._secondsOrderUnknownUserKey===secondsUserKey);
    setSecondsEntryEnabled(!busy,busy?'An unresolved order request must be reconciled first.':'');
    renderList(stab);
    if(result.tie) toast('Settled: tie — principal refunded.','ok');
    else if(result.win) toast('Settled: WIN +'+fmt(result.pnl,2)+' USDT','ok');
    else toast('Settled: LOSS '+fmt(result.pnl,2)+' USDT','warn');
    return true;
  }
  renderList(stab);
  function updateSecondsCountdowns(){
    const open=Array.isArray(state.secondsPositions&&state.secondsPositions.open)?state.secondsPositions.open:[];
    if(!state._secLatestPositionId&&open.length)state._secLatestPositionId=open[0].position_id;
    const nodes=document.querySelectorAll('[data-sec-countdown]');
    nodes.forEach(function(node){
      const position=open.find(function(p){return String(p.position_id)===String(node.dataset.secCountdown);});
      if(position)node.textContent=secondsRemainingLabel(position.settle_at);
    });
    const latest=open.find(function(p){return String(p.position_id)===String(state._secLatestPositionId);})||open[0];
    const countdown=$('#sec-countdown');
    if(latest&&countdown){
      countdown.style.display='block';
      const cdn=$('#sec-cd-num');if(cdn)cdn.textContent=secondsRemainingLabel(latest.settle_at);
    }else if(countdown)countdown.style.display='none';
    open.forEach(function(position){
      const id=String(position.position_id||'');
      if(id&&Number(position.settle_at)*1000<=Date.now()&&!autoSettlementAttempted.has(id)&&!settlingPositionIds.has(id)){
        autoSettlementAttempted.add(id);
        settlePosition(id,position.symbol);
      }
    });
  }
  const oldCountdown=state._secCd;if(oldCountdown)clearInterval(oldCountdown);
  state._secCd=setInterval(updateSecondsCountdowns,250);
  updateSecondsCountdowns();
  $('[data-stab]').forEach(t=>t.onclick=()=>{stab=t.dataset.stab;$$('[data-stab]').forEach(x=>x.classList.remove('active'));t.classList.add('active');renderList(stab);});
  async function open(dir){
    if(!state.user){window.BTCBoxRequireLogin(location.hash);return;}
    if(!policyReady){toast('Contract policy is unavailable. Refresh before opening a position.','warn');return;}
    if(!positionsReady){toast('Contract positions are not confirmed yet. Refresh before opening a new position.','warn');return;}
    if(secondsPolicy&&secondsPolicy.enabled===false){toast('Seconds contracts are currently paused by the administrator.','warn');return;}
    if(busy){toast('A previous order request is still being reconciled. Do not repeat that request.','warn');return;}
    if(secondsPendingIntent){toast('A previous order is still unconfirmed. Do not submit another position until support reconciles it.','warn');return;}
    const amountText=String($('#sec-amount').value||'').trim();
    const amt=Number(amountText);
    const minAmount=secondsPolicy?Number(secondsPolicy.min_order_amount):1;
    const maxAmount=secondsPolicy?Number(secondsPolicy.max_order_amount):1e12;
    if(!/^(?:0|[1-9][0-9]{0,19})(?:[.][0-9]{1,18})?$/.test(amountText)||!Number.isFinite(amt)||amt<minAmount||amt>maxAmount){toast('Enter an amount within the current administrator limits.','err');return;}
    if(secondsPolicy&&secondsPolicy.enabled===false){toast('Seconds contracts are currently paused by the administrator.','warn');return;}
    const orderIntent={version:1,request_id:uid(),symbol:coin,direction:dir,duration_sec:dur,amount:amountText,created_at:Date.now()};
    if(!persistPendingSecondsOrder(orderIntent)){
      toast('This browser cannot safely retain the order request ID. No order was sent. Enable site storage and try again.','err');
      return;
    }
    secondsPendingIntent=orderIntent;
    busy=true;
    setSecondsEntryEnabled(false,'Order submission is being confirmed.');
    let r;
    try{
      r=await apiAdapter.secondsOrder({symbol:orderIntent.symbol,direction:orderIntent.direction,duration_sec:orderIntent.duration_sec,amount:orderIntent.amount,request_id:orderIntent.request_id});
    }catch(_){
      r={ok:false,status:0,code:'NETWORK_ERROR',msg:'The order response was interrupted.'};
    }
    if(r&&r.ok){
      const positionMatch=findSecondsPositionSnapshot(r.position,state.secondsPositions);
      if(positionMatch.status==='history'){
        const cleared=clearPendingSecondsOrder();
        busy=!!(state.secondsPositions.open&&state.secondsPositions.open.length)||!cleared;
        setSecondsEntryEnabled(!busy,busy?'An open position or saved request guard remains active.':'');
        stab='history';
        $('[data-stab]').forEach(t=>{t.classList.toggle('active',t.dataset.stab==='history');});
        toast('Position is already settled. Review Contract History.','ok');
        renderList('history');
        return;
      }
      if(positionMatch.status==='open'){
        // The read endpoint is canonical; never count down from a POST/duplicate response timestamp.
        r.position=positionMatch.position;
      }else{
        r={ok:false,status:0,code:'POSITION_STATUS_UNCONFIRMED',msg:'The order response was received, but the latest server position list did not confirm this position.'};
      }
    }
    if(!r||!r.ok){
      const status=Number(r&&r.status||0), code=String(r&&r.code||'');
      const unknown=isSecondsOrderOutcomeUnknown(r);
      if(unknown){
        if(secondsUserKey)state._secondsOrderUnknownUserKey=secondsUserKey;
        busy=true;
        setSecondsEntryEnabled(false,'Order status is unconfirmed. Do not submit again.');
        toast('Order status unconfirmed. The server may have received it. Do not submit again; check Open Positions and contact support if it does not appear.','warn');
        renderList('open');
      }else{
        if(clearPendingSecondsOrder()){
          busy=false;
        }else{
          busy=true;
          setSecondsEntryEnabled(false,'The saved request guard could not be cleared.');
          toast('The order was rejected, but this device could not clear its saved request guard. Contact support before trying again.','warn');
        }
        if(!busy)setSecondsEntryEnabled(true,'');
        toast((r&&(r.msg||r.message))||'Order was rejected.','err');
      }
      return;
    }
    const clearedPending=clearPendingSecondsOrder();
    if(!clearedPending&&secondsUserKey)state._secondsOrderUnknownUserKey=secondsUserKey;
    busy=!clearedPending;
    setSecondsEntryEnabled(!busy,busy?'The saved request guard could not be cleared.':'');
    if(!state.secondsPositions||!Array.isArray(state.secondsPositions.open))state.secondsPositions={open:[],history:[]};
    if(r.position&&!state.secondsPositions.open.some(function(p){return p.position_id===r.position.position_id;}))state.secondsPositions.open.unshift(r.position);
    state._secLatestPositionId=r.position.position_id;
    toast('Position opened: '+dir+' '+fmt(amt,2)+' USDT','ok'); renderList('open');
    updateSecondsCountdowns();
  }
  $('#sec-up').onclick=()=>open('UP');
  $('#sec-down').onclick=()=>open('DOWN');
  // cleanup interval on route change
  const oldCleanup=state._secCleanup; if(oldCleanup)clearInterval(oldCleanup); state._secCleanup=iv;
};

/* ================= ORDERS view ================= */
VIEWS.orders = function(){
  return '<div class="orders-page">'+
    '<div class="orders-heading"><div><div class="orders-eyebrow">ACTIVITY</div><h1 class="page-title">Orders</h1></div></div>'+
    '<div class="card orders-view-card"><div class="orders-tabs"><div class="tab active" data-otab="open">Open Orders</div><div class="tab" data-otab="history">Order History</div></div><div id="orders-body" class="orders-body scroll"></div></div>'+
  '</div>';
};
VIEWS.orders.afterRender = function(){
  function openDetail(o){
    if(!o) return;
    const rows=[
      ['Order ID','<span class="num">'+(o.order_id||'—')+'</span>'],
      ['Pair',o.symbol||'—'],
      ['Side','<span style="color:'+(o.side==='BUY'?'var(--up)':'var(--down)')+';font-weight:600">'+o.side+'</span>'],
      ['Type',(o.type||'').charAt(0).toUpperCase()+(o.type||'').slice(1)],
      ['Price','<span class="num">'+fmtPrice(o.price||0,(o.symbol||'BTCUSDT').replace('USDT',''))+'</span>'],
      ['Amount','<span class="num">'+fmt(o.qty||0,4)+'</span>'],
      ['Filled','<span class="num">'+fmt((o.qty||0)-(o.remaining||0),4)+'</span>'],
      ['Remaining','<span class="num">'+fmt(o.remaining||0,4)+'</span>'],
      ['Total','<span class="num">'+fmt((o.price||0)*(o.qty||0),2)+' USDT</span>'],
      ['Status','<span style="text-transform:capitalize">'+(o.status||'—')+'</span>'],
      ['Time',o.created_at?new Date(o.created_at).toLocaleString('en-US',{hour12:false}):(o.time?new Date(o.time).toLocaleString('en-US',{hour12:false}):'—')],
    ];
    BTCBox.drawer({side:'right', title:'Order Detail', closable:true,
      content:'<div style="padding:4px 2px">'+rows.map(r=>'<div class="order-detail-row"><span class="od-label">'+r[0]+'</span><span class="od-value">'+r[1]+'</span></div>').join('')+'</div>'});
  }
  function isActiveOrderStatus(status){
    const value=String(status||'').toLowerCase();
    return value==='open'||value==='partially_filled';
  }
  function render(tab){
    const box=$('#orders-body');
    if(!state.accountLoaded){box.innerHTML=emptyState('Account data unavailable','Order information has not been confirmed. Refresh or sign in again.');return;}
    const rows = tab==='open'? (state.orders||[]).filter(o=>isActiveOrderStatus(o.status))
      : (state.orders||[]).filter(o=>!isActiveOrderStatus(o.status));
    if(!rows.length){box.innerHTML=emptyState('No '+tab+' yet','');return;}
    if(tab==='trades'){
      box.innerHTML='<table style="width:100%;border-collapse:collapse;min-width:600px"><thead><tr><th class="th">Pair</th><th class="th">Side</th><th class="th num">Price</th><th class="th num">Amount</th><th class="th num">Total</th><th class="th">Time</th></tr></thead><tbody>'+
        rows.map((t,i)=>'<tr class="trow" data-idx="'+i+'"><td class="td">'+escapeHtml(t.symbol)+'</td><td class="td" style="color:'+(t.side==='BUY'?'var(--up)':'var(--down)')+'">'+escapeHtml(t.side)+'</td><td class="td num">'+fmtPrice(t.price,t.symbol.replace('USDT',''))+'</td><td class="td num">'+fmt(t.qty,4)+'</td><td class="td num">'+fmt(t.price*t.qty,2)+'</td><td class="td" style="color:var(--text-secondary)">'+new Date(t.time).toLocaleString('en-US',{hour12:false})+'</td></tr>').join('')+'</tbody></table>';
      $$('#orders-body .trow').forEach(tr=>tr.onclick=()=>openDetail(rows[+tr.dataset.idx]));
      return;
    }
    box.innerHTML='<table style="width:100%;border-collapse:collapse;min-width:720px"><thead><tr><th class="th">Date</th><th class="th">Pair</th><th class="th">Side</th><th class="th">Type</th><th class="th num">Price</th><th class="th num">Amount</th><th class="th num">Filled</th><th class="th">Status</th><th class="th"></th></tr></thead><tbody>'+
      rows.map((o,i)=>'<tr class="trow" data-idx="'+i+'"><td class="td" style="color:var(--text-secondary);font-size:12px">'+new Date(o.created_at).toLocaleString('en-US',{hour12:false})+'</td><td class="td">'+escapeHtml(o.symbol)+'</td><td class="td" style="color:'+(o.side==='BUY'?'var(--up)':'var(--down)')+'">'+escapeHtml(o.side)+'</td><td class="td" style="color:var(--text-secondary);text-transform:capitalize">'+escapeHtml(o.type)+'</td><td class="td num">'+fmtPrice(o.price,o.symbol.replace('USDT',''))+'</td><td class="td num">'+fmt(o.qty,4)+'</td><td class="td num">'+fmt(o.qty-(o.remaining||0),4)+'</td><td class="td" style="color:var(--text-secondary);text-transform:capitalize">'+escapeHtml(o.status)+'</td><td class="td">'+(isActiveOrderStatus(o.status)?'<button class="oc-btn" data-id="'+escapeHtml(o.order_id)+'">Cancel</button>':'')+'</td></tr>').join('')+'</tbody></table>';
    $$('.oc-btn').forEach(b=>b.onclick=(e)=>{
      e.stopPropagation();
      const id=b.dataset.id;
      BTCBox.modal({title:'Cancel Order', width:'md', closable:false,
        content:'<div style="font-size:14px;color:var(--text-secondary);line-height:1.6">Are you sure you want to cancel this order? This action cannot be undone.</div>',
        buttons:[
          {text:'Keep Order', variant:'ghost', onClick:(close)=>close()},
          {text:'Confirm Cancel', variant:'danger', loading:true, onClick:async (close)=>{
            try { await apiAdapter.cancelOrder(id); }
            catch (_) { /* Always reconcile against the canonical order read below. */ }
            let refreshed;
            try { refreshed=await apiAdapter.orders(); }
            catch (_) { refreshed={ok:false,code:'NETWORK_ERROR'}; }
            if(!refreshed||refreshed.ok!==true||!Array.isArray(refreshed.orders)){
              toast('Cancellation status is unconfirmed. Refresh your orders before taking further action.','warn');
              close();return;
            }
            const latest=(refreshed.orders||[]).find(function(order){return String(order.order_id)===String(id);});
            const latestStatus=String(latest&&latest.status||'').toLowerCase();
            if(latestStatus==='cancelled'||latestStatus==='canceled'){
              toast('Order canceled.','ok');
            }else if(latestStatus==='filled'){
              toast('This order was filled before cancellation completed.','warn');
            }else if(isActiveOrderStatus(latestStatus)){
              toast('Cancellation is not confirmed. The order remains active; review its latest status before trying again.','warn');
            }else{
              toast('The latest order status could not be identified. Check your order history before retrying.','warn');
            }
            close(); render(tab);
          }}
        ]});
    });
    $$('#orders-body .trow').forEach(tr=>tr.onclick=(e)=>{ if(e.target.closest('.oc-btn')) return; openDetail(rows[+tr.dataset.idx]); });
  }
  let tab='open'; render(tab);
  if(state.user && state.accountLoaded){
    apiAdapter.orders().then(function(result){
      if(result&&result.ok) render(tab);
      else if($('#orders-body'))$('#orders-body').innerHTML=emptyState('Order data unavailable','The latest order status could not be confirmed. Refresh before taking action.');
    }).catch(function(){if($('#orders-body'))$('#orders-body').innerHTML=emptyState('Order data unavailable','The latest order status could not be confirmed. Refresh before taking action.');});
  }
  $('[data-otab]').forEach(t=>t.onclick=()=>{tab=t.dataset.otab;$('[data-otab]').forEach(x=>x.classList.remove('active'));t.classList.add('active');render(tab);});
};
