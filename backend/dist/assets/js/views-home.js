/* BTCBOX views-home.js — seed view upgrade (login/register/markets) on frozen design system.
 * All element ids, data-live-* attributes, and afterRender logic preserved verbatim. */
"use strict";
/* ================= VIEW BATCH A: Login / Register / Markets ================= */
const LOGO = '<img src="data:image/png;base64,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" alt="BTCBOX" class="logo-square" style="width:44px;height:44px;object-fit:contain;margin:0 auto;display:block">';
const GOOGLE_SVG = '<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>';

function authShell(innerHTML, footerHTML){
  return '<div class="auth-stage">'+
    '<aside class="auth-brand" aria-hidden="true">'+
      '<div class="auth-brand-mark">'+LOGO+'</div>'+
      '<div class="auth-brand-name">BTCBOX</div>'+
      '<div class="auth-brand-tag">Institutional-grade digital asset exchange</div>'+
      '<div class="auth-brand-trust"><span></span>Segregated cold storage<span></span>Bank-grade encryption<span></span>24/7 monitoring</div>'+
    '</aside>'+
    '<div class="auth-panel">'+
      '<div class="auth-brand-mobile">'+LOGO+'<div class="auth-brand-mobile-name">BTCBOX</div><div class="auth-brand-mobile-tag">Secure. Fast. Global.</div></div>'+
      '<div class="card auth-card border-shimmer">'+innerHTML+
        '<div class="auth-card-footer">'+footerHTML+'</div>'+
      '</div>'+
      '<div class="auth-legal">Protected by bank-grade encryption · <span class="auth-legal-link">Terms of Service</span> · <span class="auth-legal-link">Privacy Policy</span></div>'+
    '</div>'+
  '</div>';
}
function clearAuthErrors(form){
  form.querySelectorAll('.field-error').forEach(function(el){el.textContent='';});
  form.querySelectorAll('[aria-invalid="true"]').forEach(function(el){el.removeAttribute('aria-invalid');el.classList.remove('input-error');});
}
function setAuthError(form,id,message){
  const input=form.querySelector('#'+id), error=form.querySelector('[data-err-for="'+id+'"]');
  if(error) error.textContent=message;
  if(input){input.setAttribute('aria-invalid','true');input.classList.add('input-error');}
}
function bindAuthErrorClearing(form){
  form.querySelectorAll('input').forEach(function(input){
    function clear(){
      const error=form.querySelector('[data-err-for="'+input.id+'"]');
      if(error) error.textContent='';
      input.removeAttribute('aria-invalid');input.classList.remove('input-error');
    }
    input.addEventListener('input',clear);input.addEventListener('change',clear);
  });
}
function validAuthEmail(email){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);}
const EYE_OPEN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_CLOSED = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';
function bindPwdToggle(btnId, inputId){
  const btn=document.getElementById(btnId), input=document.getElementById(inputId);
  if(!btn||!input) return;
  btn.onclick=function(){
    const show=input.type==='password';
    input.type=show?'text':'password';
    btn.innerHTML=show?EYE_CLOSED:EYE_OPEN;
    btn.setAttribute('aria-pressed', show?'true':'false');
    btn.setAttribute('aria-label', show?'Hide password':'Show password');
    input.focus();
  };
}

VIEWS.login = function(){
  const inner =
    '<div class="auth-head">'+
      '<h1 class="auth-title">Welcome back</h1>'+
      '<p class="auth-sub">Sign in securely with your Google account</p>'+
    '</div>'+
    '<div class="auth-google-only"><button type="button" class="btn btn-google btn-block" id="google-login-btn" disabled>'+GOOGLE_SVG+'Continue with Google</button><div class="btn-google-hint" id="google-login-hint">Checking Google sign-in…</div></div>';
  return authShell(inner, 'New to BTCBOX? <a href="#/register" class="auth-link auth-link-strong">Create an account</a>');
};
VIEWS.login.afterRender = function(){
  applyGoogleButtons();
};

VIEWS.register = function(){
  const inner =
    '<div class="auth-head"><h1 class="auth-title">Create your BTCBOX account</h1><p class="auth-sub">Continue securely with your Google account</p></div>'+
    '<label class="auth-terms" for="reg-terms"><input type="checkbox" id="reg-terms" required><span>I agree to the <span class="auth-legal-link">Terms of Service</span> and <span class="auth-legal-link">Privacy Policy</span>.</span></label><div class="field-error" data-err-for="reg-terms"></div>'+
    '<div class="auth-google-only"><button type="button" class="btn btn-google btn-block" id="google-register-btn" disabled>'+GOOGLE_SVG+'Continue with Google</button><div class="btn-google-hint" id="google-register-hint">Checking Google sign-in…</div></div>';
  return authShell(inner, 'Already have an account? <a href="#/login" class="auth-link auth-link-strong">Log in</a>');
};
VIEWS.register.afterRender = function(){
  applyGoogleButtons();
  const terms=$('#reg-terms');
  if(terms) terms.addEventListener('change',function(){
    const error=document.querySelector('[data-err-for="reg-terms"]');
    if(error)error.textContent='';
  });
};

VIEWS.markets = function(){
  const tabs=['All','Favorites','Top Volume'];
  return '<div class="view-enter markets-page">'+
    '<header class="markets-heading">'+
      '<div><h1 class="page-title">Markets</h1><p class="page-sub">Spot markets <span aria-hidden="true">·</span> Live prices <span aria-hidden="true">·</span> USDT pairs</p></div>'+
      '<label class="markets-search-wrap"><span class="sr-only">Search markets</span><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input id="mkt-search" class="auth-input" placeholder="Search pair (BTC, ETH…)" autocomplete="off"></label>'+
    '</header>'+
    '<section class="card markets-card" aria-label="Spot markets">'+
      '<div class="markets-toolbar"><div class="markets-tabs no-scrollbar" id="mkt-tabs" role="group" aria-label="Market filter">'+tabs.map((t,i)=>'<button type="button" class="tab '+(i===0?'active':'')+'" data-tab="'+t+'">'+t+'</button>').join('')+'</div><span class="markets-quote">QUOTE <b>USDT</b></span></div>'+
      '<div class="markets-table-wrap scroll"><table class="markets-table"><thead><tr><th class="th">Pair</th><th class="th">Last Price</th><th class="th">24h Change</th><th class="th">24h High</th><th class="th">24h Low</th><th class="th">24h Volume</th></tr></thead><tbody id="mkt-body"></tbody></table></div>'+
    '</section></div>';
};
VIEWS.markets.afterRender = function(){
  let activeTab='All', q='';
  function render(){
    let list=PAIRS.slice();
    if(activeTab==='Favorites') list=list.filter(s=>state.favorites.has(s));
    if(activeTab==='Top Volume') list.sort((a,b)=>Number(market[b]?.vol||0)-Number(market[a]?.vol||0));
    if(q) list=list.filter(s=>s.toLowerCase().includes(q));
    if(!list.length){ $('#mkt-body').innerHTML='<tr><td colspan="6">'+emptyState('No markets found','Try a different search or category.')+'</td></tr>'; return; }
    $('#mkt-body').innerHTML=list.map(sym=>{
      const m=market[sym], base=sym.replace('USDT',''), up=m.chg>=0;
      const fav=state.favorites.has(sym);
      return '<tr class="trow markets-row" data-sym="'+sym+'">'+
        '<td class="td markets-pair-cell"><button type="button" class="fav-btn" data-sym="'+sym+'" aria-label="'+(fav?'Remove ':'Add ')+' '+base+' to favorites" aria-pressed="'+fav+'">'+(fav?'★':'☆')+'</button><div class="markets-pair-name"><b>'+base+'</b><span>/USDT</span><div style="font-size:11px;color:var(--text-muted)">'+base+' Spot</div></div></td>'+
        '<td class="td num markets-last" data-live-price="'+sym+'">'+fmtPrice(m.price,base)+'</td>'+
        '<td class="td num markets-change '+(up?'is-up':'is-down')+'" data-live-chg="'+sym+'">'+pct(m.chg)+'</td>'+
        '<td class="td num markets-secondary">'+fmtPrice(m.high,base)+'</td>'+
        '<td class="td num markets-secondary">'+fmtPrice(m.low,base)+'</td>'+
        '<td class="td num markets-secondary">'+fmt(m.vol,0)+'</td></tr>';
    }).join('');
    $$('#mkt-body tr[data-sym]').forEach(tr=>tr.onclick=e=>{ if(e.target.classList.contains('fav-btn'))return; location.hash='#/trade/'+tr.dataset.sym; });
    $$('.fav-btn').forEach(b=>b.onclick=e=>{e.stopPropagation();const s=b.dataset.sym; if(state.favorites.has(s))state.favorites.delete(s);else state.favorites.add(s); render();});
  }
  render();
  $$('#mkt-tabs .tab').forEach(t=>t.onclick=()=>{$$('#mkt-tabs .tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');activeTab=t.dataset.tab;render();});
  $('#mkt-search').oninput=e=>{q=e.target.value.trim().toLowerCase();render();};
};


/* ================= HOME / TRADE TYPE ENTRY ================= */
VIEWS.home = function(){
  const ready = PAIRS.filter(sym => market[sym] && Number(market[sym].price) > 0);
  const movers = ready.slice().sort((a,b) => Number(market[b].vol||0) - Number(market[a].vol||0)).slice(0,4);
  const live = !state.marketUnavailable && ready.length > 0;
  return '<div class="view-enter home-view">'+
    '<section class="home-hero">'+
      '<div class="home-hero-copy"><div class="home-eyebrow">BTCBOX · DIGITAL ASSET EXCHANGE</div><h1>Trade with clarity.</h1><p>Explore live spot markets, manage your assets and access BTCBOX trading services from one place.</p>'+
        '<div class="home-hero-actions"><a class="btn btn-primary" href="#/trade-hub">Explore trading</a><a class="btn btn-ghost" href="#/markets">View markets</a>'+(state.user?'':'<a class="btn btn-ghost home-auth-link" href="#/login">Log in</a><a class="btn btn-ghost home-auth-link" href="#/register">Create account</a>')+'</div></div>'+
      '<div class="home-hero-mark" aria-hidden="true"><div class="home-orbit home-orbit-one"></div><div class="home-orbit home-orbit-two"></div><div class="home-mark-core">B</div></div>'+
    '</section>'+
    '<section class="home-metrics" aria-label="Market overview">'+
      '<div class="home-metric"><span>Market data</span><strong class="'+(live?'is-live':'is-pending')+'">'+(live?'Live':'Updating')+'</strong><small>Connected market feed</small></div>'+
      '<div class="home-metric"><span>Available spot pairs</span><strong>'+ready.length+'</strong><small>USDT-quoted markets</small></div>'+
      '<div class="home-metric"><span>Trading services</span><strong>2</strong><small>Spot and seconds access</small></div>'+
    '</section>'+
    '<section class="home-section"><div class="home-section-head"><div><h2>Markets by volume</h2><p>Live data from supported spot pairs</p></div><a href="#/markets">View all markets <span aria-hidden="true">→</span></a></div>'+
      (movers.length?'<div class="home-market-grid">'+movers.map(sym=>{const m=market[sym],base=sym.replace('USDT',''),up=Number(m.chg)>=0;return '<a class="home-market-card" href="#/trade/'+sym+'"><span class="home-market-name">'+base+' <small>/ USDT</small></span><strong class="num">'+fmtPrice(m.price,base)+'</strong><span class="home-market-change '+(up?'up':'down')+'">'+pct(m.chg)+' <small>24h</small></span></a>';}).join('')+'</div>':'<div class="home-empty">Live market data is loading. Market values will appear when the provider responds.</div>')+
    '</section>'+
    '<section class="home-section"><div class="home-section-head"><div><h2>Quick access</h2><p>Common account and trading destinations</p></div></div><div class="home-quick-grid">'+
      '<a href="#/trade-hub"><strong>Trade</strong><span>Choose a trading service</span></a><a href="#/assets"><strong>Assets</strong><span>Review available balances</span></a><a href="#/deposit"><strong>Deposit</strong><span>Fund your account</span></a><a href="#/me"><strong>My account</strong><span>Profile and security</span></a><a href="#/help"><strong>Help & announcements</strong><span>Public service information and support access</span></a>'+
    '</div></section>'+
  '</div>';
};

VIEWS.tradehub = function(){
  return '<div class="view-enter trade-hub-view"><div class="trade-hub-heading"><div class="home-eyebrow">BTCBOX MARKETS</div><h1 class="page-title">Choose your trading service</h1><p class="page-sub">Select an available product. Services not yet enabled are clearly marked.</p></div>'+
    '<div class="trade-hub-grid">'+
      '<a class="trade-hub-card is-available" href="#/trade/BTCUSDT"><span class="trade-hub-index">01</span><span class="trade-hub-status">Available</span><h2>Spot</h2><p>Buy and sell supported digital assets using live spot market data.</p><span class="trade-hub-link">Open spot trading →</span></a>'+
      '<div class="trade-hub-card is-unavailable" aria-disabled="true"><span class="trade-hub-index">02</span><span class="trade-hub-status">Disabled</span><h2>Futures</h2><p>Derivatives trading is disabled in this release.</p><span class="trade-hub-link">Not available</span></div>'+
      '<a class="trade-hub-card is-available" href="#/seconds"><span class="trade-hub-index">03</span><span class="trade-hub-status">Available</span><h2>Seconds</h2><p>Access the existing short-term contract interface and its supported pairs.</p><span class="trade-hub-link">Open seconds →</span></a>'+
      '<a class="trade-hub-card is-available" href="#/earn"><span class="trade-hub-index">04</span><span class="trade-hub-status">Available</span><h2>Earn</h2><p>Review the currently configured earn products and account positions.</p><span class="trade-hub-link">Explore earn →</span></a>'+
    '</div></div>';
};


/* ================= PUBLIC HELP & ANNOUNCEMENTS ================= */
if(!NAV.some(function(item){return item.route==='help';})){
  NAV.push({route:'help',label:'Help & Announcements',icon:'<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>'});
}
VIEWS.help = function(){
  return '<div class="view-enter help-center-view">'+
    '<div class="home-eyebrow">BTCBOX INFORMATION</div>'+
    '<h1 class="page-title">Help & Announcements</h1>'+
    '<p class="page-sub">Public service information and official BTCBOX updates.</p>'+
    '<section class="card" style="padding:22px;margin:18px 0">'+
      '<div style="font-size:16px;font-weight:650;margin-bottom:12px">Latest announcement</div>'+
      '<div id="public-announcement" style="color:var(--text-secondary);font-size:14px;line-height:1.7">Loading public announcement…</div>'+
    '</section>'+
    '<section class="card" style="padding:22px">'+
      '<div style="font-size:16px;font-weight:650;margin-bottom:8px">Contact customer support</div>'+
      '<p style="color:var(--text-secondary);font-size:14px;line-height:1.7;margin:0 0 16px">Sign in to open a private support conversation. Your account and conversation details are not exposed publicly.</p>'+
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn btn-primary" id="help-contact-support">Contact support</button><a class="btn btn-ghost" href="#/markets">Browse markets</a></div>'+
    '</section>'+
  '</div>';
};
VIEWS.help.afterRender = async function(){
  const target=$('#public-announcement');
  if(target){
    try{
      const result=await apiAdapter.config();
      const announcement=String(result&&result.announcement||'').trim();
      target.textContent=announcement||'There are no public announcements at this time.';
    }catch(e){
      target.textContent='Announcement information is temporarily unavailable. Please try again later.';
    }
  }
  const contact=$('#help-contact-support');
  if(contact) contact.onclick=function(){
    if(!state.user){window.BTCBoxRequireLogin('#/support');return;}
    location.hash='#/support';
  };
};
