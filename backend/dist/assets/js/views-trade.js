/* BTCBOX views-trade.js — extracted from index.html, IIFE unwrapped, load order preserved. */
/* UI/UX upgrade: professional workspace layout + mobile hard layout + K-line bottom drawer. */
"use strict";
if(!document.getElementById('views-trade-css')) document.head.insertAdjacentHTML('beforeend','<link id="views-trade-css" rel="stylesheet" href="/assets/css/views-trade.css">');

/* ================= VIEW BATCH B: Trade / Kline ================= */
const TF = ['1m','5m','15m','1h','4h','1D'];
function klineAxisTime(timestamp){
  const d=new Date(Number(timestamp));
  if(isNaN(d.getTime())) return '';
  const pad=n=>String(n).padStart(2,'0');
  return String(state.currentInterval).toLowerCase()==='1d'
    ? pad(d.getMonth()+1)+'-'+pad(d.getDate())
    : pad(d.getHours())+':'+pad(d.getMinutes());
}
function candleOption(klines,symbol){
  const dates=klines.map(k=>klineAxisTime(k[0])), o=klines.map(k=>k[1]), c=klines.map(k=>k[2]), lows=klines.map(k=>k[3]), highs=klines.map(k=>k[4]), vols=klines.map((k,i)=>({value:k[5], itemStyle:{color: c[i]>=o[i]?'rgba(14,203,129,.5)':'rgba(246,70,93,.5)'}}));
  return {
    backgroundColor:'transparent', animation:false,
    tooltip:{trigger:'axis',axisPointer:{type:'cross'},backgroundColor:'#1E2329',borderColor:'#2B3139',textStyle:{color:'#EAECEF',fontSize:11}},
    axisPointer:{link:[{xAxisIndex:'all'}]},
    grid:[{left:8,right:12,top:24,height:'58%'},{left:8,right:12,top:'72%',height:'18%'}],
    xAxis:[
      {type:'category',data:dates,scale:true,boundaryGap:false,axisLine:{lineStyle:{color:'#2B3139'}},axisLabel:{color:'#848E9C',fontSize:10,hideOverlap:true},splitLine:{show:false},axisPointer:{z:100}},
      {type:'category',gridIndex:1,data:dates,scale:true,boundaryGap:false,axisLine:{lineStyle:{color:'#2B3139'}},axisLabel:{show:false},splitLine:{show:false}}
    ],
    yAxis:[
      {scale:true,position:'right',splitLine:{lineStyle:{color:'rgba(43,49,57,.5)'}},axisLabel:{color:'#848E9C',fontSize:10,hideOverlap:true}},
      {scale:true,gridIndex:1,position:'right',splitNumber:2,axisLabel:{show:false},splitLine:{show:false}}
    ],
    dataZoom:[
      {type:'inside',xAxisIndex:[0,1],start:60,end:100},
      {show:true,xAxisIndex:[0,1],type:'slider',bottom:4,height:16,start:60,end:100,borderColor:'#2B3139',backgroundColor:'#161A1E',fillerColor:'rgba(43,163,108,.15)',handleStyle:{color:'#2BA36C'},textStyle:{color:'#848E9C',fontSize:9}}
    ],
    series:[
      {name:symbol,type:'candlestick',data:klines.map(k=>[k[1],k[2],k[3],k[4]]),itemStyle:{color:'#0ECB81',color0:'#F6465D',borderColor:'#0ECB81',borderColor0:'#F6465D'}},
      {name:'Volume',type:'bar',xAxisIndex:1,yAxisIndex:1,data:vols}
    ]
  };
}
function renderOrderbook(sym){
  const base=sym.replace('USDT','');
  const mid=(market[sym]&&market[sym].price)||0;
  const chg=(market[sym]&&market[sym].chg)||0;
  let bids=[], asks=[];
  if(state.depthCache && state.depthCache.sym===sym){ bids=state.depthCache.bids.slice().sort((a,b)=>b[0]-a[0]).slice(0,10); asks=state.depthCache.asks.slice().sort((a,b)=>a[0]-b[0]).slice(0,10); }
  if(!bids.length && !asks.length) return '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">'+(state.marketUnavailable?'Market data unavailable — orderbook hidden (no simulated data).':'Loading orderbook…')+'</div>';
  const maxAmt=Math.max(...bids.map(b=>b[1]),...asks.map(a=>a[1]));
  const row=(p,a,side)=>{
    const w=(a/maxAmt*100).toFixed(1);
    return '<div class="ob-row '+(side==='bid'?'bid':'ask')+'" data-price="'+p+'">'+
      '<div class="ob-depth" style="width:'+w+'%;background:'+(side==='bid'?'var(--up)':'var(--down)')+'"></div>'+
      '<span class="num ob-price">'+fmtPrice(p,base)+'</span>'+
      '<span class="num ob-amt">'+fmt(a,3)+'</span>'+
      '<span class="num ob-total">'+fmt(p*a,2)+'</span></div>';
  };
  let h='<div class="ob-head"><span>Price (USDT)</span><span>Amount</span><span>Total</span></div>';
  h+=asks.slice().reverse().map(a=>row(a[0],a[1],'ask')).join('');
  h+='<div class="ob-mid">'+
     '<span class="num mid-price" style="color:'+(chg>=0?'var(--up)':'var(--down)')+'" data-live-price="'+sym+'">'+marketPriceText(market[sym],base)+'</span>'+
     '<span class="num mid-chg" style="color:'+(chg>=0?'var(--up)':'var(--down)')+'" data-live-chg="'+sym+'">'+marketChangeText(market[sym])+'</span></div>';
  h+=bids.map(b=>row(b[0],b[1],'bid')).join('');
  return h;
}
function renderRecentTrades(sym){
  let h='<div class="ob-head"><span>Price (USDT)</span><span>Amount</span><span>Time</span></div>';
  h+='<div style="padding:24px 12px;text-align:center;color:var(--text-muted);font-size:12px">'+(state.marketUnavailable?'Market data unavailable — recent trades hidden.':'Recent trade feed not exposed by backend.')+'</div>';
  return h;
}
function marketPriceText(m,symbol){
  const price=Number(m&&m.price);
  return Number.isFinite(price)&&price>0?fmtPrice(price,symbol):'—';
}
function marketChangeText(m){
  const price=Number(m&&m.price);
  return Number.isFinite(price)&&price>0?pct(Number(m.chg)||0):'—';
}
function orderPriceText(o){
  if(String(o&&o.type||'').toLowerCase()==='market') return 'Market';
  const price=Number(o&&o.price);
  return Number.isFinite(price)&&price>0?fmtPrice(price,(o.symbol||'BTCUSDT').replace('USDT','')):'—';
}
function orderTimeText(value){
  if(!value) return '—';
  const date=new Date(value);
  if(!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString('en-US',{year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
}
function orderStatusText(value){
  return String(value||'—').replace(/_/g,' ').replace(/(^| )([a-z])/g,function(_,space,letter){return space+letter.toUpperCase();});
}
function isActiveOrder(order){
  const status=String(order&&order.status||'').toLowerCase();
  return status==='open'||status==='partially_filled';
}

VIEWS.trade = function(params){
  const sym = (params[0]||'BTCUSDT').toUpperCase();
  if(!market[sym]) state.currentPair='BTCUSDT'; else state.currentPair=sym;
  const s=market[state.currentPair], base=state.currentPair.replace('USDT','');
  const pairList = PAIRS.slice(0,12).map(p=>{
    const m=market[p], up=m.chg>=0;
    return '<a href="#/trade/'+p+'" class="pair-item'+(p===state.currentPair?' active':'')+'">'+
      '<span><span class="pair-base">'+p.replace('USDT','')+'</span><span class="pair-quote">/USDT</span></span>'+
      '<span class="pair-right"><span class="num pair-price" data-live-price="'+p+'">'+marketPriceText(m,p.replace('USDT',''))+'</span><span class="num pair-chg" data-live-chg="'+p+'" style="color:'+(up?'var(--up)':'var(--down)')+'">'+marketChangeText(m)+'</span></span></a>';
  }).join('');
  const tfBtns = TF.map(t=>'<button data-tf="'+t+'" class="tf-btn'+(t===state.currentInterval?' active':'')+'">'+t+'</button>').join('');
  return '<div class="trade-page">'+
    '<nav class="mobile-module-nav" aria-label="Trading modules"><a class="active" href="#/trade/'+state.currentPair+'">Spot</a><button class="is-disabled" type="button" aria-disabled="true" title="Futures trading is not enabled">Futures</button><a href="#/seconds">Seconds</a><a href="#/earn">Earn</a></nav>'+
    (NOT_TRADEABLE[state.currentPair]?'<div style="background:rgba(246,70,93,.1);border:1px solid var(--down);color:var(--down);padding:10px 16px;border-radius:8px;margin-bottom:12px;font-size:13px;font-weight:500">Trading is not available for this pair (MATICUSDT). Order entry is disabled.</div>':'')+
    /* mobile top bar */
    '<div class="card mobile-pair-bar">'+
      '<span class="mp-pair">'+base+'/USDT</span>'+
      '<span class="num mp-price" style="color:'+(s.chg>=0?'var(--up)':'var(--down)')+'" data-live-price="'+state.currentPair+'">'+marketPriceText(s,base)+'</span>'+
      '<span class="num mp-change" style="color:'+(s.chg>=0?'var(--up)':'var(--down)')+'" data-live-chg="'+state.currentPair+'">'+marketChangeText(s)+'</span>'+
      '<span class="mp-spacer"></span>'+
      '<select id="mobile-pair-select">'+PAIRS.map(p=>'<option value="'+p+'"'+(p===state.currentPair?' selected':'')+'>'+p.replace('USDT','/USDT')+'</option>').join('')+'</select>'+
      '<div class="mp-stats" aria-label="24 hour market statistics">'+
        '<div><span>24h Change</span><b class="num" style="color:'+(s.chg>=0?'var(--up)':'var(--down)')+'">'+marketChangeText(s)+'</b></div>'+
        '<div><span>24h High</span><b class="num">'+(Number(s.high)>0?fmtPrice(s.high,base):'—')+'</b></div>'+
        '<div><span>24h Low</span><b class="num">'+(Number(s.low)>0?fmtPrice(s.low,base):'—')+'</b></div>'+
      '</div>'+
    '</div>'+
    /* desktop top workspace: pairs | chart | orderbook | form */
    '<div class="trade-top">'+
      '<div class="card pair-list-card scroll"><div class="pair-list-head">Markets</div>'+pairList+'</div>'+
      '<div class="card chart-card">'+
        '<div class="chart-header">'+
          '<div class="pair-title">'+base+'/USDT</div>'+
          '<div><div class="num price-big" style="color:'+(s.chg>=0?'var(--up)':'var(--down)')+'" data-live-price="'+state.currentPair+'">'+fmtPrice(s.price,base)+'</div><div class="num chg-small" style="color:'+(s.chg>=0?'var(--up)':'var(--down)')+'" data-live-chg="'+state.currentPair+'">'+pct(s.chg)+'</div></div>'+
          '<div class="hl"><div>24h High <span class="num">'+fmtPrice(s.high,base)+'</span></div><div>24h Low <span class="num">'+fmtPrice(s.low,base)+'</span></div></div>'+
          '<div class="spacer"></div>'+
          '<div id="tf-switch" class="tf-switch">'+tfBtns+'</div>'+
        '</div>'+
        '<div class="chart-body"><div id="trade-chart"></div></div>'+
      '</div>'+
      /* orderbook */
      '<div class="card ob-card">'+
        '<div class="ob-tabs"><div class="tab active" data-rt="ob">Order Book</div></div>'+
        '<div id="rt-panel" class="ob-panel scroll">'+renderOrderbook(state.currentPair)+'</div>'+
      '</div>'+
      /* order form */
      '<div class="card form-card">'+
        '<div class="side-switch"><button id="side-buy" class="btn btn-green">Buy</button><button id="side-sell" class="btn btn-ghost">Sell</button></div>'+
        '<div class="otype-row"><button class="otype active" data-ot="limit" aria-pressed="true">Limit Order</button></div>'+
        '<div class="form-field"><label class="auth-label">Price (USDT)</label><input id="ord-price" class="auth-input num" type="number" step="any" value="'+(Number(s.price)>0?s.price.toFixed(base==='BTC'||base==='ETH'?2:4):'')+'" placeholder="Enter limit price"></div>'+
        '<div class="form-field"><label id="ord-amount-label" class="auth-label">Amount ('+base+')</label><input id="ord-amount" class="auth-input num" type="number" step="any" placeholder="0.00"></div>'+
        '<div class="pct-row">'+[25,50,75,100].map(p=>'<button class="pct-btn" data-pct="'+p+'">'+p+'%</button>').join('')+'</div>'+
        '<div class="form-summary"><span>Total</span><span class="num" id="ord-total">0.00 USDT</span></div>'+
        '<div class="form-summary"><span>Available</span><span class="num" id="ord-avail">'+(state.user?(state.accountLoaded?fmt(state.balances.USDT?state.balances.USDT.free:0,2)+' USDT':'Loading…'):'Sign in to view')+'</span></div>'+
        '<button id="ord-submit" class="btn btn-green btn-block" '+(NOT_TRADEABLE[state.currentPair]?'disabled':'')+'>'+(state.user?'Buy '+base:'Log in to trade')+'</button>'+
      '</div>'+
    '</div>'+
    /* order type bottom sheet — only backend-supported types are offered */
    '<div id="otype-mask" class="otype-mask"></div>'+
    '<section id="otype-sheet" class="otype-sheet" role="dialog" aria-modal="true" aria-labelledby="otype-title">'+
      '<div class="otype-sheet-handle" aria-hidden="true"><span></span></div>'+
      '<div class="otype-sheet-head"><strong id="otype-title">Order Type</strong><button id="otype-close" type="button" aria-label="Close">×</button></div>'+
      '<button class="otype-option active" data-ot="limit" type="button"><span><strong>Limit Order</strong><small>Set the price at which you want to trade</small></span><span class="otype-check">✓</span></button>'+
      '<div class="otype-note">Only limit orders are currently supported by the trading API.</div>'+
    '</section>'+
    /* bottom: orders / history / trades / positions tabs — independent scroll */
    '<div class="card orders-card">'+
      '<div class="orders-tabs"><div class="tab active" data-otab="open">Open Orders</div><div class="tab" data-otab="history">Order History</div></div>'+
      '<div id="my-orders" class="orders-body scroll"></div>'+
    '</div>'+
    /* mobile K-line entry (fixed above bottom nav) */
    '<button id="kline-entry" class="kline-entry"><span>K-line Chart</span><span class="ke-caret">&#9650;</span></button>'+
    /* mobile K-line bottom drawer (88dvh) */
    '<div id="kline-drawer-mask" class="kline-drawer-mask"></div>'+
    '<div id="kline-drawer" class="kline-drawer">'+
      '<div class="kline-drawer-grab" role="button" tabindex="0" aria-label="Expand or collapse chart"><span></span></div>'+
      '<div class="kline-drawer-head">'+
        '<span class="kd-pair">'+base+'/USDT</span>'+
        '<div class="tf-switch kd-tf">'+tfBtns+'</div>'+
        '<span class="kd-spacer"></span>'+
        '<button id="kline-drawer-expand" type="button" aria-label="Expand chart">⤢</button>'+
        '<button id="kline-drawer-close" aria-label="Close">&times;</button>'+
      '</div>'+
      '<div id="kline-drawer-body" class="kline-drawer-body"></div>'+
    '</div>'+
  '</div>';
};

VIEWS.trade.afterRender = function(params){
  const sym=state.currentPair, base=sym.replace('USDT','');
  const mps=$('#mobile-pair-select'); if(mps)mps.onchange=e=>{location.hash='#/trade/'+e.target.value;};
  const pairBar=$('.mobile-pair-bar'), chartEntry=$('#kline-entry');
  if(pairBar&&chartEntry){ chartEntry.classList.add('pair-chart-entry'); pairBar.appendChild(chartEntry); }

  /* place chart in correct container by viewport (desktop: chart card; mobile: drawer body) */
  function placeChart(){
    const el=$('#trade-chart'); if(!el) return;
    const mobile=window.innerWidth<=768;
    const target=mobile?$('#kline-drawer-body'):document.querySelector('.chart-body');
    if(target && el.parentElement!==target){ target.appendChild(el); }
  }
  placeChart();

  /* chart init — business logic preserved */
  if(state.chart){state.chart.dispose();state.chart=null;}
  const el=$('#trade-chart');
  if(window.echarts && el){
    state.chart=echarts.init(el,'dark');
    apiAdapter.kline(sym,state.currentInterval).then(r=>{ if(state.chart) state.chart.setOption(candleOption(r.klines,sym)); });
    state._tradeResize=()=>{ placeChart(); state.chart&&state.chart.resize(); }; window.addEventListener('resize',state._tradeResize);
  } else if(el){ el.innerHTML='<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px">Chart library failed to load (offline). Connect to internet for live K-line.</div>'; }

  /* timeframe switch — binds both desktop + drawer sets; logic preserved */
  $$('.tf-btn').forEach(b=>b.onclick=()=>{
    state.currentInterval=b.dataset.tf;
    $$('.tf-btn').forEach(x=>{x.classList.remove('active');});
    b.classList.add('active');
    apiAdapter.kline(sym,state.currentInterval).then(r=>{ if(state.chart) state.chart.setOption(candleOption(r.klines,sym),true); });
  });

  /* mobile K-line drawer open/close */
  const drawer=$('#kline-drawer'), mask=$('#kline-drawer-mask');
  const mainContent=$('#main-content');
  let previousBodyOverflow='',previousMainOverflow='',previousMainOverflowY='',previousMainScrollTop=0;
  function openDrawer(){
    if(!drawer||drawer.classList.contains('open')) return;
    previousBodyOverflow=document.body.style.overflow;
    if(mainContent){previousMainOverflow=mainContent.style.overflow;previousMainOverflowY=mainContent.style.overflowY;previousMainScrollTop=mainContent.scrollTop;mainContent.style.overflow='hidden';}
    drawer.classList.remove('expanded');drawer.classList.add('open');mask.classList.add('open');document.body.style.overflow='hidden';
    setTimeout(()=>state.chart&&state.chart.resize(),320);
  }
  function closeDrawer(){
    if(!drawer) return;
    drawer.classList.remove('open','expanded');mask.classList.remove('open');document.body.style.overflow=previousBodyOverflow;
    if(mainContent){mainContent.style.overflow=previousMainOverflow;mainContent.style.overflowY=previousMainOverflowY;mainContent.scrollTop=previousMainScrollTop;}
  }
  state._klineDrawerCleanup=closeDrawer;
  const grab=$('.kline-drawer-grab');
  if(grab){
    let startY=0,dragHandled=false;
    grab.addEventListener('pointerdown',e=>{startY=e.clientY;dragHandled=false;});
    grab.addEventListener('pointerup',e=>{
      const delta=e.clientY-startY;
      if(delta>55){dragHandled=true;closeDrawer();}
      else if(delta<-35){dragHandled=true;drawer.classList.add('expanded');setTimeout(()=>state.chart&&state.chart.resize(),260);}
    });
    grab.onclick=()=>{if(dragHandled){dragHandled=false;return;}if(drawer.classList.contains('expanded'))drawer.classList.remove('expanded');else drawer.classList.add('expanded');setTimeout(()=>state.chart&&state.chart.resize(),260);};
    grab.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();grab.click();}};
  }
  const ke=$('#kline-entry'); if(ke) ke.onclick=openDrawer;
  const kc=$('#kline-drawer-close'); if(kc) kc.onclick=closeDrawer;
  const kx=$('#kline-drawer-expand'); if(kx) kx.onclick=()=>{drawer.classList.toggle('expanded');kx.textContent=drawer.classList.contains('expanded')?'↙':'⤢';setTimeout(()=>state.chart&&state.chart.resize(),280);};
  if(mask) mask.onclick=closeDrawer;
  const drawerHandle=$('.kline-drawer-handle');
  if(drawerHandle){
    let startY=0;
    drawerHandle.addEventListener('pointerdown',e=>{startY=e.clientY;});
    drawerHandle.addEventListener('pointerup',e=>{if(e.clientY-startY>55)closeDrawer();});
  }

  /* orderbook / trades tabs — logic preserved */
  let rt='ob';
  $$('[data-rt]').forEach(t=>t.onclick=()=>{rt=t.dataset.rt;$$('[data-rt]').forEach(x=>x.classList.remove('active'));t.classList.add('active');$('#rt-panel').innerHTML=rt==='ob'?renderOrderbook(sym):renderRecentTrades(sym);});
  /* ob row click → fill price — logic preserved */
  $('#rt-panel').addEventListener('click',e=>{const r=e.target.closest('[data-price]');if(r&&rt==='ob'){$('#ord-price').value=r.dataset.price;calcTotal();}});

  /* live orderbook refresh from depthCache (self-cleaning when view unmounts) */
  if(state._obIv){clearInterval(state._obIv);state._obIv=null;}
  state._obIv=setInterval(()=>{
    const panel=$('#rt-panel');
    if(!panel){clearInterval(state._obIv);state._obIv=null;return;}
    if(rt==='ob' && state.depthCache && state.depthCache.sym===sym){ panel.innerHTML=renderOrderbook(sym); }
  },2500);

  /* buy/sell side — logic preserved */
  let side='BUY';
  try{
    const pendingSide=sessionStorage.getItem('btcbox_login_intent');
    if(pendingSide==='BUY'||pendingSide==='SELL') side=pendingSide;
    sessionStorage.removeItem('btcbox_login_intent');
  }catch(e){}
  function applySide(){
    $('#side-buy').className=side==='BUY'?'btn btn-green':'btn btn-ghost';
    $('#side-sell').className=side==='SELL'?'btn btn-red':'btn btn-ghost';
    $('#ord-submit').textContent=(state.user?(side==='BUY'?'Buy ':'Sell '):'Log in to trade ')+base;
    $('#ord-submit').className='btn '+(side==='BUY'?'btn-green':'btn-red')+' btn-block';
  }
  applySide();
  $('#side-buy').onclick=()=>{if(!state.user){window.BTCBoxRequireLogin(location.hash,'BUY');return;}side='BUY';applySide();};
  $('#side-sell').onclick=()=>{if(!state.user){window.BTCBoxRequireLogin(location.hash,'SELL');return;}side='SELL';applySide();};

  /* The API currently accepts limit orders only; do not expose unsupported types. */
  const otype='limit';

  /* total calc — logic preserved */
  function calcTotal(){
    const p=parseFloat($('#ord-price').value)||market[sym].price, a=parseFloat($('#ord-amount').value)||0;
    $('#ord-total').textContent=fmt(p*a,2)+' USDT';
  }
  $('#ord-price').oninput=calcTotal; $('#ord-amount').oninput=calcTotal;

  /* pct buttons — logic preserved */
  $$('.pct-btn').forEach(b=>b.onclick=()=>{
    if(!state.user){window.BTCBoxRequireLogin(location.hash,side);return;}
    if(!state.accountLoaded){toast('Account data is unavailable. Please refresh before using balance shortcuts.','warn');return;}
    const pctV=parseInt(b.dataset.pct)/100;
    const price=Number($('#ord-price').value);
    if(!Number.isFinite(price)||price<=0){toast(otype==='market'?'Live market price unavailable.':'Enter a limit price first.','err');return;}
    let avail;
    if(side==='BUY'){ const usdt=(state.balances.USDT?state.balances.USDT.free:0)*pctV; avail=usdt/price; }
    else { avail=(state.balances[base]?state.balances[base].free:0)*pctV; }
    $('#ord-amount').value=avail.toFixed(base==='BTC'||base==='ETH'?6:4); calcTotal();
  });

  /* submit — API params preserved verbatim */
  $('#ord-submit').onclick=async ()=>{
    if(NOT_TRADEABLE[sym]){toast('Trading not available for this pair.','err');return;}
    const amount=parseFloat($('#ord-amount').value);
    if(!state.user){window.BTCBoxRequireLogin(location.hash,side);return;}
    if(!state.accountLoaded){toast('Account data is unavailable. Please refresh before submitting an order.','warn');return;}
    if(!amount||amount<=0){toast('Enter a valid amount.','err');return;}
    const limitPrice=Number($('#ord-price').value);
    if(!Number.isFinite(limitPrice)||limitPrice<=0){toast('Enter a valid limit price.','err');return;}
    const price=limitPrice;
    const btn=$('#ord-submit');
    if(btn.disabled||btn.dataset.submitting==='1'){return;} // re-entry / double-click guard
    btn.dataset.submitting='1'; btn.disabled=true;
    const old=btn.textContent; btn.textContent='Submitting…';
    // stable idempotency key for this submit intent — a retry of the SAME intent reuses it; a new submit generates a new one
    const clientOrderId=uid(); const requestId=uid();
    let r=null, thrown=null;
    try{ r=await apiAdapter.placeOrder({symbol:sym,side,type:otype,qty:amount,price,client_order_id:clientOrderId,request_id:requestId}); }
    catch(e){ thrown=e; }
    const status=Number(r&&r.status||0);
    const unknown=!!thrown||status===0||status>=500||!!(r&&(r.code==='NETWORK_ERROR'||r.code==='NETWORK_RESPONSE_ERROR'));
    if(unknown){
      // keep button disabled: order state is unconfirmed — user MUST check order list before submitting again
      btn.textContent='状态未知·查看订单';
      toast('订单状态未知，请在订单列表确认，勿重复提交。','warn');
      if(window.BTCBox&&BTCBox.modal){
        BTCBox.modal({title:'订单状态未确认', width:'md', closable:false,
          content:'<div style="font-size:14px;color:var(--text-secondary);line-height:1.6">服务器响应无法确认，订单可能已提交。请先到订单列表核对状态后再操作，<b>切勿重复提交</b>，以免产生重复订单。</div>',
          buttons:[{text:'我已知晓', variant:'primary', onClick:(close)=>close()}]});
      }
      return;
    }
    btn.disabled=false; btn.dataset.submitting=''; btn.textContent=old;
    if(r.ok){toast(side+' order placed: '+fmt(amount,4)+' '+base+' @ '+fmtPrice(price,base),'ok');renderMyOrders('open');}
    else toast(r.msg||'Order failed','err');
  };

  /* order detail — right drawer */
  function openOrderDetail(o){
    if(!o) return;
    const rows=[
      ['Order ID','<span class="num">'+escapeHtml(o.order_id||'—')+'</span>'],
      ['Pair',escapeHtml(o.symbol||'—')],
      ['Side','<span style="color:'+(o.side==='BUY'?'var(--up)':'var(--down)')+';font-weight:600">'+escapeHtml(o.side)+'</span>'],
      ['Type',escapeHtml((o.type||'').charAt(0).toUpperCase()+(o.type||'').slice(1))],
      ['Price','<span class="num">'+orderPriceText(o)+'</span>'],
      ['Qty','<span class="num">'+(Number(o.qty)>0?fmt(o.qty,4):'—')+'</span>'],
      ['Filled','<span class="num">'+(Number(o.qty)>0&&Number.isFinite(Number(o.remaining))?fmt(o.qty-o.remaining,4):'—')+'</span>'],
      ['Remaining','<span class="num">'+(Number.isFinite(Number(o.remaining))?fmt(o.remaining,4):'—')+'</span>'],
      ['Status','<span>'+orderStatusText(o.status)+'</span>'],
      ['Time',orderTimeText(o.created_at||o.time)],
    ];
    BTCBox.drawer({side:'right', title:'Order Detail', closable:true,
      content:'<div style="padding:4px 2px">'+rows.map(r=>'<div class="order-detail-row"><span class="od-label">'+r[0]+'</span><span class="od-value">'+r[1]+'</span></div>').join('')+'</div>'});
  }

  /* my orders / positions — logic preserved + positions tab added + cancel modal + detail drawer */
  function renderMyOrders(tab){
    const box=$('#my-orders');
    if(!state.user){
      box.innerHTML='<div class="guest-orders-prompt"><strong>Sign in to view your orders</strong><span>Open orders, order history and account positions are private.</span><button type="button" class="btn btn-primary" data-orders-login>Log in</button></div>';
      const gate=box.querySelector('[data-orders-login]');if(gate)gate.onclick=()=>window.BTCBoxRequireLogin(location.hash);
      return;
    }
    if(!state.accountLoaded){box.innerHTML=emptyState('Account data unavailable','Order and position information has not been confirmed. Refresh before relying on this panel.');return;}
    const rows = tab==='open'? (state.orders||[]).filter(isActiveOrder)
      : tab==='history'? (state.orders||[]).filter(o=>!isActiveOrder(o))
      : tab==='trades'? (state.trades||[])
      : null;
    if(tab==='positions'){
      const keys=Object.keys(state.balances||{}).filter(k=>{const b=state.balances[k];return (b.free||0)+(b.frozen||0)>0;});
      if(!keys.length){box.innerHTML=emptyState('No positions','Your asset balances will appear here.');return;}
      box.innerHTML='<div class="pos-list">'+keys.map(k=>{
        const b=state.balances[k], free=b.free||0, frozen=b.frozen||0, total=free+frozen;
        const m=market[k+'USDT']; const usdVal=m&&m.price?total*m.price:null;
        return '<div class="pos-row"><div><div class="pos-asset">'+k+'</div><div class="pos-sub">Free '+fmt(free,4)+' · Frozen '+fmt(frozen,4)+'</div></div>'+
          '<div class="pos-val"><div class="num">'+fmt(total,4)+'</div><div class="pos-sub">Total</div></div>'+
          (usdVal!=null?'<div class="pos-val"><div class="num">≈ '+fmt(usdVal,2)+' USDT</div><div class="pos-sub">Est. Value</div></div>':'<div></div>')+
          '<div></div></div>';
      }).join('')+'</div>';
      return;
    }
    if(!rows.length){box.innerHTML=emptyState('No '+tab+' yet','Place an order and it will appear here.');return;}
    if(tab==='trades'){
      box.innerHTML='<table><thead><tr><th class="th">Pair</th><th class="th">Side</th><th class="th num">Price</th><th class="th num">Qty</th><th class="th">Time</th></tr></thead><tbody>'+
        rows.map((t,i)=>'<tr class="trow" data-idx="'+i+'"><td class="td">'+escapeHtml(t.symbol)+'</td><td class="td" style="color:'+(t.side==='BUY'?'var(--up)':'var(--down)')+'">'+escapeHtml(t.side)+'</td><td class="td num">'+(Number(t.price)>0?fmtPrice(t.price,t.symbol.replace('USDT','')):'—')+'</td><td class="td num">'+(Number(t.qty)>0?fmt(t.qty,4):'—')+'</td><td class="td" style="color:var(--text-secondary)">'+orderTimeText(t.time||t.created_at)+'</td></tr>').join('')+'</tbody></table>';
      $$('#my-orders .trow').forEach(tr=>tr.onclick=()=>openOrderDetail(rows[+tr.dataset.idx]));
      return;
    }
    box.innerHTML='<table><thead><tr><th class="th">Pair</th><th class="th">Side</th><th class="th">Type</th><th class="th num">Price</th><th class="th num">Qty</th><th class="th num">Filled</th><th class="th num">Remaining</th><th class="th">Status</th><th class="th">Time</th><th class="th"></th></tr></thead><tbody>'+
      rows.map((o,i)=>'<tr class="trow" data-idx="'+i+'"><td class="td">'+escapeHtml(o.symbol)+'</td><td class="td" style="color:'+(o.side==='BUY'?'var(--up)':'var(--down)')+'">'+escapeHtml(o.side)+'</td><td class="td" style="color:var(--text-secondary);text-transform:capitalize">'+escapeHtml(o.type)+'</td><td class="td num">'+orderPriceText(o)+'</td><td class="td num">'+(Number(o.qty)>0?fmt(o.qty,4):'—')+'</td><td class="td num">'+(Number(o.qty)>0&&Number.isFinite(Number(o.remaining))?fmt(o.qty-o.remaining,4):'—')+'</td><td class="td num">'+(Number.isFinite(Number(o.remaining))?fmt(o.remaining,4):'—')+'</td><td class="td" style="color:var(--text-secondary);text-transform:capitalize">'+orderStatusText(o.status)+'</td><td class="td" style="color:var(--text-secondary);font-size:12px">'+orderTimeText(o.created_at||o.time)+'</td><td class="td">'+(isActiveOrder(o)?'<button class="cancel-btn" data-id="'+escapeHtml(o.order_id)+'">Cancel</button>':'')+'</td></tr>').join('')+'</tbody></table>';
    $$('.cancel-btn').forEach(b=>b.onclick=(e)=>{
      e.stopPropagation();
      const id=b.dataset.id;
      BTCBox.modal({title:'Cancel Order', width:'md', closable:false,
        content:'<div style="font-size:14px;color:var(--text-secondary);line-height:1.6">Are you sure you want to cancel this order? This action cannot be undone.</div>',
        buttons:[
          {text:'Keep Order', variant:'ghost', onClick:(close)=>close()},
          {text:'Confirm Cancel', variant:'danger', loading:true, onClick:async (close)=>{
            try{await apiAdapter.cancelOrder(id);}catch(e){}
            let ordersConfirmed=false;
            try{
              const orderResult=await apiAdapter.orders();
              ordersConfirmed=!!(orderResult&&orderResult.ok===true&&Array.isArray(orderResult.orders));
            }catch(e){}
            try{
              const accountResult=await apiAdapter.account();
              if(accountResult&&accountResult.ok===true&&Array.isArray(accountResult.orders)) ordersConfirmed=true;
            }catch(e){}
            const latest=(state.orders||[]).find(function(order){return String(order.order_id)===String(id);});
            const latestStatus=String(latest&&latest.status||'').toLowerCase();
            if(!ordersConfirmed){
              toast('Cancellation status is unconfirmed. Refresh your orders before taking further action.','warn');
            }else if(latestStatus==='cancelled'||latestStatus==='canceled'){
              toast('Order canceled.','ok');
            }else if(latestStatus==='filled'){
              toast('This order was filled before cancellation completed.','warn');
            }else if(latestStatus==='open'||latestStatus==='partially_filled'){
              toast('Cancellation is not confirmed. The order remains active; review its latest status before trying again.','warn');
            }else{
              toast('The latest order status could not be identified. Check your order history before retrying.','warn');
            }
            close(); renderMyOrders(tab);
          }}
        ]});
    });
    $$('#my-orders .trow').forEach(tr=>tr.onclick=(e)=>{ if(e.target.closest('.cancel-btn')) return; openOrderDetail(rows[+tr.dataset.idx]); });
  }
  let otab='open'; renderMyOrders(otab);
  if(state.user && state.accountLoaded){
    apiAdapter.orders().then(function(result){
      if(result&&result.ok) renderMyOrders(otab);
      else if($('#my-orders')) $('#my-orders').innerHTML=emptyState('Order data unavailable','The latest order status could not be confirmed. Refresh before taking action.');
    }).catch(function(){if($('#my-orders'))$('#my-orders').innerHTML=emptyState('Order data unavailable','The latest order status could not be confirmed. Refresh before taking action.');});
  }
  $$('[data-otab]').forEach(t=>t.onclick=()=>{otab=t.dataset.otab;$$('[data-otab]').forEach(x=>x.classList.remove('active'));t.classList.add('active');renderMyOrders(otab);});
};

/* ================= KLINE fullscreen view ================= */
VIEWS.kline = function(params){
  const sym=(params[0]||state.currentPair||'BTCUSDT').toUpperCase();
  state.currentPair=market[sym]?sym:'BTCUSDT';
  const base=state.currentPair.replace('USDT','');
  return '<div class="kline-full">'+
    '<div class="kline-head">'+
      '<a href="#/trade/'+state.currentPair+'" class="btn btn-ghost kline-back">&larr; Back to Trade</a>'+
      '<div class="kline-title">'+base+'/USDT <span class="kline-sub">Fullscreen K-Line</span></div>'+
      '<div id="kline-tf">'+TF.map(t=>'<button data-tf="'+t+'" class="ktf-btn'+(t===state.currentInterval?' active':'')+'">'+t+'</button>').join('')+'</div>'+
      '<div class="kline-spacer"></div><span class="tag" style="background:var(--brand-soft);color:var(--brand-bright)">LIVE DATA</span>'+
    '</div>'+
    '<div id="kline-chart"></div>'+
  '</div>';
};
VIEWS.kline.afterRender = function(params){
  if(state.chartKline){state.chartKline.dispose();state.chartKline=null;}
  const el=$('#kline-chart');
  if(window.echarts&&el){
    state.chartKline=echarts.init(el,'dark');
    apiAdapter.kline(state.currentPair,state.currentInterval).then(r=>{if(state.chartKline){state.chartKline.setOption(candleOption(r.klines,state.currentPair));setTimeout(()=>{state.chartKline&&state.chartKline.resize();},80);}});
    state._klineResize=()=>state.chartKline&&state.chartKline.resize();
    window.addEventListener('resize',state._klineResize);
  } else if(el){ el.innerHTML='<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted)">Chart library unavailable offline.</div>'; }
  $$('.ktf-btn').forEach(b=>b.onclick=()=>{
    state.currentInterval=b.dataset.tf;
    $$('.ktf-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    apiAdapter.kline(state.currentPair,state.currentInterval).then(r=>state.chartKline&&state.chartKline.setOption(candleOption(r.klines,state.currentPair),true));
  });
};
