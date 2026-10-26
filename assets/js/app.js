/* ============================================================
   BTCBOX v3 — 共享前端逻辑
   行情数据 · 账户系统 · 登录态 · 共享组件渲染
   ============================================================ */
(function(global){
  'use strict';

  // ===== 币种数据（含初始价格、涨跌幅）=====
  var COINS = [
    {sym:'BTC', name:'Bitcoin', price:67432.50, chg:2.34, vol:'28.5B'},
    {sym:'ETH', name:'Ethereum', price:3521.80, chg:1.87, vol:'14.2B'},
    {sym:'SOL', name:'Solana', price:168.45, chg:-0.92, vol:'3.8B'},
    {sym:'BNB', name:'BNB', price:598.20, chg:0.56, vol:'2.1B'},
    {sym:'XRP', name:'Ripple', price:0.5234, chg:3.21, vol:'1.9B'},
    {sym:'DOGE', name:'Dogecoin', price:0.1287, chg:-1.45, vol:'1.4B'},
    {sym:'ADA', name:'Cardano', price:0.4521, chg:1.12, vol:'0.8B'},
    {sym:'AVAX', name:'Avalanche', price:34.56, chg:-2.18, vol:'0.6B'},
    {sym:'LINK', name:'Chainlink', price:14.23, chg:4.56, vol:'0.5B'},
    {sym:'DOT', name:'Polkadot', price:6.78, chg:-0.34, vol:'0.4B'},
    {sym:'TRX', name:'Tron', price:0.1342, chg:0.89, vol:'0.5B'},
    {sym:'MATIC', name:'Polygon', price:0.7234, chg:-1.23, vol:'0.4B'},
    {sym:'LTC', name:'Litecoin', price:84.32, chg:1.45, vol:'0.6B'},
    {sym:'BCH', name:'Bitcoin Cash', price:478.50, chg:2.10, vol:'0.3B'},
    {sym:'NEAR', name:'Near Protocol', price:5.678, chg:3.45, vol:'0.3B'},
    {sym:'UNI', name:'Uniswap', price:8.923, chg:-0.67, vol:'0.2B'},
    {sym:'ATOM', name:'Cosmos', price:7.234, chg:1.78, vol:'0.2B'},
    {sym:'ETC', name:'Ethereum Classic', price:26.45, chg:-0.45, vol:'0.2B'},
    {sym:'XLM', name:'Stellar', price:0.1123, chg:2.34, vol:'0.1B'},
    {sym:'ALGO', name:'Algorand', price:0.1876, chg:-1.89, vol:'0.1B'},
  ];
  var COIN_COLORS = {BTC:'#f7931a',ETH:'#627eea',SOL:'#9945ff',BNB:'#f3ba2f',XRP:'#23292f',DOGE:'#c2a633',ADA:'#0033ad',AVAX:'#e84142',LINK:'#2a5ada',DOT:'#e6007a',TRX:'#ff0013',MATIC:'#8247e5',LTC:'#345d9d',BCH:'#8dc351',NEAR:'#00ec97',UNI:'#ff007a',ATOM:'#2e3148',ETC:'#328332',XLM:'#000000',ALGO:'#000000'};

  // ===== 工具函数 =====
  function fmtPrice(p){
    if(p >= 1000) return p.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    if(p >= 1) return p.toFixed(2);
    return p.toFixed(4);
  }
  function fmtNum(n, d){ return Number(n||0).toLocaleString('en-US',{minimumFractionDigits:d||2,maximumFractionDigits:d||2}); }
  function $(id){ return document.getElementById(id); }
  function coinIconHtml(sym, size){
    size = size || 32;
    var inPages = location.pathname.indexOf('/pages/') > -1;
    var base = inPages ? '../' : '';
    var c = COIN_COLORS[sym] || '#555';
    var fs = Math.round(size*0.3);
    return '<div class="coin-icon" style="width:'+size+'px;height:'+size+'px;background:'+c+'18;border:1px solid '+c+'33;position:relative;overflow:hidden;">'+
      '<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:'+c+';font-size:'+fs+'px;font-weight:800;">'+sym.slice(0,3)+'</span>'+
      '<img src="'+base+'assets/img/coins/'+sym+'.svg" alt="'+sym+'" style="width:100%;height:100%;position:relative;z-index:1;display:block;" onerror="this.remove()">'+
      '</div>';
  }

  // ===== 生成 sparkline SVG =====
  function genSpark(seed, trend){
    var pts = [];
    for(var i=0;i<24;i++){
      var r = Math.sin(seed*7+i*0.7)*8 + Math.cos(seed*3+i*1.3)*5 + (trend>0?i*0.55:-i*0.35);
      pts.push(50 + r + (i%3)*((seed%3)-1)*2);
    }
    return pts;
  }
  function sparkSVG(pts, up, w, h){
    var min = Math.min.apply(null,pts), max = Math.max.apply(null,pts);
    var range = max-min || 1;
    var step = w/(pts.length-1);
    var d = pts.map(function(p,i){
      var x = i*step, y = h - ((p-min)/range)*(h-4) - 2;
      return (i===0?'M':'L') + x.toFixed(1)+','+y.toFixed(1);
    }).join(' ');
    var col = up ? '#0ecb81' : '#f6465d';
    var lastY = h - ((pts[pts.length-1]-min)/range)*(h-4) - 2;
    return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none" style="display:block;">'+
      '<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'+
      '<circle cx="'+(w-1)+'" cy="'+lastY.toFixed(1)+'" r="2" fill="'+col+'"/></svg>';
  }

  // ===== Toast（专业多类型通知）=====
  var toastEl = null;
  var TOAST_ICONS = {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };
  function toast(msg, type, duration){
    if(typeof type === 'number'){ duration = type; type = 'info'; }
    type = type || 'info';
    if(!TOAST_ICONS[type]) type = 'info';
    if(!toastEl){
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.className = 'toast toast-' + type;
    toastEl.innerHTML = '<div class="toast-bar"></div><div class="toast-body"><div class="toast-icon">' + TOAST_ICONS[type] + '</div><div class="toast-msg"></div></div>';
    toastEl.querySelector('.toast-msg').textContent = msg;
    // 强制重排以触发动画
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function(){ toastEl.classList.remove('show'); }, duration||2200);
  }

  // ===== Modal（专业自定义弹窗）=====
  var MODAL_ICONS = {
    warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    danger: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };
  var currentModal = null;
  function closeModal(){
    if(!currentModal) return;
    currentModal.classList.remove('show');
    var el = currentModal;
    setTimeout(function(){ if(el && el.parentNode) el.parentNode.removeChild(el); }, 300);
    currentModal = null;
    document.body.style.overflow = '';
  }
  // 通用模态框：opts = {iconType, title, bodyHtml, confirmText, cancelText, danger, onConfirm, onCancel}
  function showModal(opts){
    closeModal();
    opts = opts || {};
    var iconType = opts.iconType || 'info';
    var iconClass = 'modal-icon';
    if(iconType === 'danger') iconClass += ' modal-danger';
    else if(iconType === 'success') iconClass += ' modal-success';
    else if(iconType === 'info') iconClass += ' modal-info';
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    var confirmBtnClass = opts.danger ? 'btn btn-gold' : 'btn btn-gold';
    var html = '<div class="modal-box" onclick="event.stopPropagation()">';
    html += '<div class="modal-head"><div class="' + iconClass + '">' + (MODAL_ICONS[iconType]||MODAL_ICONS.info) + '</div>';
    html += '<div class="modal-title">' + (opts.title||'提示') + '</div></div>';
    html += '<div class="modal-body">' + (opts.bodyHtml||'') + '</div>';
    html += '<div class="modal-actions">';
    if(opts.cancelText !== false){
      html += '<button class="btn btn-modal-cancel" id="__modalCancel">' + (opts.cancelText||'取消') + '</button>';
    }
    html += '<button class="' + confirmBtnClass + '" id="__modalConfirm">' + (opts.confirmText||'确认') + '</button>';
    html += '</div></div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    currentModal = overlay;
    document.body.style.overflow = 'hidden';
    void overlay.offsetWidth;
    overlay.classList.add('show');
    var confirmBtn = overlay.querySelector('#__modalConfirm');
    var cancelBtn = overlay.querySelector('#__modalCancel');
    // 返回 Promise（兼容 .then() 用法），同时保留 overlay 引用供需要 DOM 操作的场景
    var promise = new Promise(function(resolve){
      function doConfirm(){ closeModal(); resolve(true); if(opts.onConfirm) opts.onConfirm(); }
      function doCancel(){ closeModal(); resolve(false); if(opts.onCancel) opts.onCancel(); }
      if(confirmBtn) confirmBtn.addEventListener('click', doConfirm);
      if(cancelBtn) cancelBtn.addEventListener('click', doCancel);
      overlay.addEventListener('click', doCancel);
    });
    promise.overlay = overlay;
    return promise;
  }
  // Promise 风格确认框：resolve(true) 确认，resolve(false) 取消
  function confirmModal(opts){
    return new Promise(function(resolve){
      showModal({
        iconType: opts.iconType || 'warning',
        title: opts.title || '请确认操作',
        bodyHtml: opts.bodyHtml || '',
        confirmText: opts.confirmText || '确认',
        cancelText: opts.cancelText || '取消',
        danger: opts.danger || false,
        onConfirm: function(){ resolve(true); },
        onCancel: function(){ resolve(false); }
      });
    });
  }

  // ===== 账户系统（localStorage）=====
  var ACCOUNT_KEY = 'btcbox_account_v3';
  function defaultAccount(){
    return {
      loggedIn: false,
      email: '',
      kycLevel: 0,
      totalUsdt: 0,
      todayPnl: 0,
      todayPnlPct: 0,
      balances: {
        USDT: {free:0, frozen:0},
        BTC: {free:0, frozen:0},
        ETH: {free:0, frozen:0},
        SOL: {free:0, frozen:0},
      },
      hideAsset: false,
      synced: false,
    };
  }
  function loadAccount(){
    try{
      var raw = localStorage.getItem(ACCOUNT_KEY);
      if(raw) return Object.assign(defaultAccount(), JSON.parse(raw));
    }catch(e){}
    return defaultAccount();
  }
  function saveAccount(acc){
    try{ localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acc)); }catch(e){}
  }
  var account = loadAccount();

  function isLoggedIn(){ return account.loggedIn; }
  // 从服务端同步真实账户数据（余额/KYC/订单），替代本地初始数据
  function syncAccount(){
    if(!account.loggedIn) return Promise.resolve();
    return fetch('/api/account', {credentials:'include'})
      .then(function(r){ return r.json(); })
      .then(function(j){
        if(j && j.ok){
          if(j.balances) account.balances = j.balances;
          if(typeof j.totalUsdt === 'number') account.totalUsdt = j.totalUsdt;
          if(typeof j.kycLevel === 'number') account.kycLevel = j.kycLevel;
          account.synced = true;
          saveAccount(account);
          document.dispatchEvent(new CustomEvent('accountChange'));
        }
        return j;
      })
      .catch(function(){ return null; });
  }
  function login(email, pwd){
    account.loggedIn = true;
    account.email = email || 'user@btcbox.com';
    account.synced = false;
    saveAccount(account);
    document.dispatchEvent(new CustomEvent('accountChange'));
    syncAccount();
  }
  function logout(){
    // 同时清后端 session
    try{ fetch('/api/logout', {method:'POST', credentials:'include'}).catch(function(){}); }catch(e){}
    account = defaultAccount();
    saveAccount(account);
    document.dispatchEvent(new CustomEvent('accountChange'));
  }
  function requireLogin(callback){
    if(isLoggedIn()){ callback && callback(); return true; }
    toast((window.I18N?I18N.t('pleaseLogin'):''), 'warning');
    var inPages = location.pathname.indexOf('/pages/') > -1;
    var loginPath = inPages ? 'login.html' : 'pages/login.html';
    var backUrl = location.pathname + (location.search || '');
    setTimeout(function(){ location.href = loginPath + '?redirect=' + encodeURIComponent(backUrl); }, 800);
    return false;
  }

  // ===== 行情数据（MarketAPI 真实行情驱动，含三级降级：WebSocket→同源轮询→本地模拟）=====
  var markets = COINS.map(function(c){ return Object.assign({}, c); });
  function syncFromAPI(arr){
    var map = {};
    arr.forEach(function(m){ map[m.sym] = m; });
    markets.forEach(function(m){
      var live = map[m.sym];
      if(live && live.price > 0){
        m.price = live.price; m.chg = live.chg;
        m.high = live.high; m.low = live.low; m.vol = live.vol || m.vol;
      }
    });
    document.dispatchEvent(new CustomEvent('marketTick'));
  }
  if(global.MarketAPI){
    MarketAPI.onTick(syncFromAPI);
    MarketAPI.start();
  } else {
    setInterval(function(){
      markets.forEach(function(m, i){
        // 均值回归：价格围绕初始值小幅波动，偏离越远回归力越强（真实行情特征）
        var base = COINS[i].price;
        var deviation = (m.price - base) / base;
        var meanRevert = -deviation * 0.03; // 每 tick 回归 3% 偏离
        var drift = meanRevert + (Math.random()-0.5) * 0.0006; // ±0.03% 随机波动（真实量级）
        m.price = Math.max(0.0001, m.price * (1 + drift));
        // 涨跌幅围绕初始值回归，波动收窄
        var baseChg = COINS[i].chg;
        m.chg = baseChg + (m.chg - baseChg) * 0.94 + (Math.random()-0.5) * 0.06;
        m.chg = Math.max(-10, Math.min(10, m.chg));
      });
      document.dispatchEvent(new CustomEvent('marketTick'));
    }, 3000);
  }

  // ===== 渲染底部导航 =====
  function renderBottomNav(active){
    var items = [
      {key:'home', label:'首页', href:'../index.html', svg:'<path d="m3 9 9-7 9 9v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'},
      {key:'markets', label:'行情', href:'markets.html', svg:'<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'},
      {key:'trade', label:'交易', href:'trade.html?symbol=BTCUSDT', trade:true},
      {key:'assets', label:'资产', href:'assets.html', svg:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>'},
      {key:'me', label:'我的', href:'me.html', svg:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'},
    ];
    // 修正首页路径（pages/ 下 vs 根目录）
    var inPages = location.pathname.indexOf('/pages/') > -1;
    var homeHref = inPages ? '../index.html' : 'index.html';
    items[0].href = homeHref;
    items[1].href = inPages ? 'markets.html' : 'pages/markets.html';
    items[2].href = inPages ? 'trade.html?symbol=BTCUSDT' : 'pages/trade.html?symbol=BTCUSDT';
    items[3].href = inPages ? 'assets.html' : 'pages/assets.html';
    items[4].href = inPages ? 'me.html' : 'pages/me.html';

    var html = '<nav class="bottom-nav">';
    items.forEach(function(it){
      if(it.trade){
        var tradeMenuId = 'tradeMenu_' + Math.random().toString(36).substr(2,5);
        var inPages2 = location.pathname.indexOf('/pages/') > -1;
        var tHref = inPages2 ? 'trade.html?symbol=BTCUSDT' : 'pages/trade.html?symbol=BTCUSDT';
        var eHref = inPages2 ? 'earn.html' : 'pages/earn.html';
        var sHref = inPages2 ? 'seconds.html' : 'pages/seconds.html';
        html += '<div class="nav-trade-wrap" style="position:relative;">'+
          '<div class="nav-trade-btn" onclick="var m=document.getElementById(\''+tradeMenuId+'\');m.style.display=m.style.display==\'block\'?\'none\':\'block\';" style="cursor:pointer;" aria-label="交易菜单">'+
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg></div>'+
          '<div id="'+tradeMenuId+'" style="display:none;position:absolute;bottom:70px;left:50%;transform:translateX(-50%);background:var(--bg-2);border:1px solid var(--border);border-radius:14px;padding:8px;min-width:130px;box-shadow:0 8px 30px rgba(0,0,0,.4);z-index:999;">'+
          '<a href="'+tHref+'" style="display:block;padding:10px 16px;color:var(--text);font-size:13px;font-weight:600;border-radius:8px;text-decoration:none;">币币交易</a>'+
          '<a href="'+eHref+'" style="display:block;padding:10px 16px;color:var(--text);font-size:13px;font-weight:600;border-radius:8px;text-decoration:none;">理财申购</a>'+
          '<a href="'+sHref+'" style="display:block;padding:10px 16px;color:var(--text);font-size:13px;font-weight:600;border-radius:8px;text-decoration:none;">秒合约</a>'+
          '</div></div>';
        // 点击其他地方关闭菜单
        html += '<script>document.addEventListener("click",function(e){if(!e.target.closest(".nav-trade-wrap")){document.getElementById("'+tradeMenuId+'").style.display="none";}});</script>';
      } else {
        var cls = 'nav-item' + (it.key===active ? ' active' : '');
        html += '<a class="'+cls+'" href="'+it.href+'">'+
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+it.svg+'</svg>'+
          '<span>'+(global.I18N?I18N.t(it.key):it.label)+'</span></a>';
      }
    });
    html += '</nav>';
    return html;
  }

  // ===== 渲染行情列表 =====
  function renderMarketList(containerId, type, limit, onClick){
    var el = document.getElementById(containerId);
    if(!el) return;
    var list = markets.slice();
    if(type === 'gainers') list.sort(function(a,b){ return b.chg - a.chg; });
    else if(type === 'losers') list.sort(function(a,b){ return a.chg - b.chg; });
    else if(type === 'fav') list = list.filter(function(m){ return ['BTC','ETH','SOL','LINK'].indexOf(m.sym)>=0; });
    if(limit) list = list.slice(0, limit);
    var inPages = location.pathname.indexOf('/pages/') > -1;
    el.innerHTML = list.map(function(m, i){
      var up = m.chg >= 0;
      var pts = genSpark(i*3 + m.sym.charCodeAt(0), m.chg);
      var href = (inPages ? 'trade.html?symbol=' : 'pages/trade.html?symbol=') + m.sym + 'USDT';
      return '<div class="market-row" data-sym="'+m.sym+'" onclick="location.href=\''+href+'\'">'+
        '<div style="display:flex;align-items:center;gap:9px;min-width:0;">'+coinIconHtml(m.sym, 32)+
        '<div style="min-width:0;"><div style="font-size:13px;font-weight:700;white-space:nowrap;">'+m.sym+'<span style="color:var(--text-3);font-weight:500;font-size:10px;margin-left:4px;">/USDT</span></div>'+
        '<div style="font-size:10px;color:var(--text-3);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+m.name+'</div></div></div>'+
        '<div class="num row-price" data-sym="'+m.sym+'" style="text-align:right;font-size:13px;font-weight:700;">'+fmtPrice(m.price)+'</div>'+
        '<div style="text-align:right;"><span class="chg-pill num row-chg '+(up?'chg-up':'chg-down')+'" data-sym="'+m.sym+'">'+(up?'+':'')+m.chg.toFixed(2)+'%</span></div>'+
        '<div style="display:flex;justify-content:flex-end;">'+sparkSVG(pts, up, 48, 22)+'</div></div>';
    }).join('');
  }

  // ===== 行情增量更新（不重建 DOM，仅刷新价格/涨跌幅文本，大幅减少重绘）=====
  function updateMarketListInPlace(containerId){
    var el = document.getElementById(containerId);
    if(!el) return;
    var map = {};
    markets.forEach(function(m){ map[m.sym] = m; });
    el.querySelectorAll('.row-price').forEach(function(node){
      var sym = node.getAttribute('data-sym');
      var m = map[sym];
      if(!m) return;
      var newText = fmtPrice(m.price);
      if(node.textContent !== newText){
        var up = m.price >= parseFloat(node.dataset.lastPrice || m.price);
        node.textContent = newText;
        node.dataset.lastPrice = m.price;
      }
    });
    el.querySelectorAll('.row-chg').forEach(function(node){
      var sym = node.getAttribute('data-sym');
      var m = map[sym];
      if(!m) return;
      var up = m.chg >= 0;
      var newText = (up?'+':'') + m.chg.toFixed(2) + '%';
      if(node.textContent !== newText){
        node.textContent = newText;
        node.className = 'chg-pill num row-chg ' + (up?'chg-up':'chg-down');
        node.setAttribute('data-sym', sym);
      }
    });
  }

  // ===== 横滑行情卡片增量更新 =====
  function updateTopCoinsInPlace(containerId){
    var el = document.getElementById(containerId);
    if(!el) return;
    var map = {};
    markets.forEach(function(m,i){ if(i<4) map[m.sym] = m; });
    el.querySelectorAll('.coin-card').forEach(function(card){
      var priceNode = card.querySelector('.tc-price');
      var chgNode = card.querySelector('.tc-chg');
      if(!priceNode) return;
      var sym = priceNode.getAttribute('data-sym');
      var m = map[sym];
      if(!m) return;
      var newPrice = fmtPrice(m.price);
      if(priceNode.textContent !== newPrice) priceNode.textContent = newPrice;
      var up = m.chg >= 0;
      var newChg = (up?'+':'') + m.chg.toFixed(2) + '%';
      if(chgNode.textContent !== newChg){
        chgNode.textContent = newChg;
        chgNode.style.color = up ? 'var(--up)' : 'var(--down)';
      }
    });
  }

  // ===== 渲染顶部横滑行情卡片 =====
  function renderTopCoins(containerId, count){
    var el = document.getElementById(containerId);
    if(!el) return;
    var list = markets.slice(0, count||4);
    var inPages = location.pathname.indexOf('/pages/') > -1;
    el.innerHTML = list.map(function(m, i){
      var up = m.chg >= 0;
      var pts = genSpark(i+1, m.chg);
      var href = (inPages ? 'trade.html?symbol=' : 'pages/trade.html?symbol=') + m.sym + 'USDT';
      return '<a class="coin-card" href="'+href+'">'+
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">'+coinIconHtml(m.sym, 30)+
        '<div><div style="font-size:13px;font-weight:700;">'+m.sym+'</div><div style="font-size:10px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px;">'+m.name+'</div></div></div>'+
        '<div class="num tc-price" data-sym="'+m.sym+'" style="font-size:16px;font-weight:800;letter-spacing:-.01em;">'+fmtPrice(m.price)+'</div>'+
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">'+
        '<span class="num tc-chg" style="font-size:11px;font-weight:700;color:'+(up?'var(--up)':'var(--down)')+';">'+(up?'+':'')+m.chg.toFixed(2)+'%</span>'+
        sparkSVG(pts, up, 56, 24)+'</div></a>';
    }).join('');
  }

  // ===== 页面初始化：登录态切换 =====
  function initAuthUI(){
    // 所有 [data-auth] 元素：logged-in 仅登录显示，guest 仅游客显示
    function apply(){
      document.querySelectorAll('[data-auth]').forEach(function(el){
        var v = el.getAttribute('data-auth');
        el.style.display = (v === 'logged-in' && isLoggedIn()) || (v === 'guest' && !isLoggedIn()) ? '' : 'none';
      });
      // 资产隐藏
      if(account.hideAsset){
        document.querySelectorAll('[data-asset-val]').forEach(function(el){
          el.textContent = '******';
          el.classList.add('hidden-val');
        });
      }
    }
    apply();
    document.addEventListener('accountChange', apply);
  }

  // ===== 资产卡渲染（首页用）=====
  function renderAssetCard(){
    var totalEl = document.querySelector('[data-total-asset]');
    if(totalEl){
      totalEl.textContent = account.hideAsset ? '******' : fmtNum(account.totalUsdt);
    }
    var pnlEl = document.querySelector('[data-today-pnl]');
    if(pnlEl){
      pnlEl.textContent = (account.todayPnl>=0?'+':'') + fmtNum(account.todayPnl) + ' (' + (account.todayPnlPct>=0?'+':'') + account.todayPnlPct.toFixed(2) + '%)';
    }
  }

  // ===== 生成 K 线数据（交易页用）=====
  function genKline(count){
    var data = [], price = 67000;
    for(var i=0;i<count;i++){
      var open = price;
      var change = (Math.random()-0.48) * 200;
      var close = open + change;
      var high = Math.max(open, close) + Math.random()*100;
      var low = Math.min(open, close) - Math.random()*100;
      var vol = Math.random()*1000 + 200;
      data.push([open, close, low, high, vol]);
      price = close;
    }
    return data;
  }

  // ===== 画 K 线图（canvas）=====
  function drawKline(canvasId, data){
    var canvas = document.getElementById(canvasId);
    if(!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0,0,w,h);

    var padL = 8, padR = 52, padT = 10, padB = 24;
    var cw = w - padL - padR, ch = h - padT - padB;
    var highs = data.map(function(d){return d[3];}), lows = data.map(function(d){return d[2];});
    var max = Math.max.apply(null, highs), min = Math.min.apply(null, lows);
    var range = max - min || 1;
    var bw = cw / data.length;
    function y(v){ return padT + (1 - (v-min)/range) * ch; }

    // 网格线 + 价格标签
    ctx.strokeStyle = 'rgba(139,154,184,.08)';
    ctx.fillStyle = '#5a6478';
    ctx.font = '10px Public Sans';
    ctx.textAlign = 'left';
    for(var g=0; g<=4; g++){
      var gy = padT + (ch/4)*g;
      var gv = max - (range/4)*g;
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(w-padR, gy); ctx.stroke();
      ctx.fillText(gv >= 1000 ? Math.round(gv).toLocaleString() : gv.toFixed(2), w-padR+4, gy+3);
    }

    // K线
    data.forEach(function(d, i){
      var x = padL + i*bw + bw/2;
      var up = d[1] >= d[0];
      var col = up ? '#0ecb81' : '#f6465d';
      ctx.strokeStyle = col; ctx.fillStyle = col;
      // 影线
      ctx.beginPath(); ctx.moveTo(x, y(d[3])); ctx.lineTo(x, y(d[2])); ctx.stroke();
      // 实体
      var bodyH = Math.max(1, Math.abs(y(d[0]) - y(d[1])));
      var bodyY = Math.min(y(d[0]), y(d[1]));
      ctx.fillRect(x - bw*0.3, bodyY, bw*0.6, bodyH);
    });

    // 最新价线
    var last = data[data.length-1];
    var ly = y(last[1]);
    var lastUp = last[1] >= last[0];
    ctx.setLineDash([4,3]);
    ctx.strokeStyle = lastUp ? '#0ecb81' : '#f6465d';
    ctx.beginPath(); ctx.moveTo(padL, ly); ctx.lineTo(w-padR, ly); ctx.stroke();
    ctx.setLineDash([]);
    // 价格标签
    ctx.fillStyle = lastUp ? '#0ecb81' : '#f6465d';
    ctx.fillRect(w-padR, ly-9, padR-2, 18);
    ctx.fillStyle = '#0a0e1a';
    ctx.font = 'bold 10px Public Sans';
    ctx.textAlign = 'center';
    ctx.fillText(last[1] >= 1000 ? Math.round(last[1]).toLocaleString() : last[1].toFixed(2), w-padR + (padR-2)/2, ly+3);
  }

  // ===== 客服未读消息红点（全局轮询）=====
  function initChatBadge(){
    var inPages = location.pathname.indexOf('/pages/') > -1;
    var base = inPages ? '../' : '';
    function check(){
      if(!isLoggedIn()) return;
      fetch(base + 'api/chat/unread', {credentials:'include'})
        .then(function(r){ return r.json(); })
        .then(function(j){
          if(j.ok && j.unread > 0){
            document.querySelectorAll('.chat-badge').forEach(function(el){
              el.textContent = j.unread > 99 ? '99+' : j.unread;
              el.style.display = 'flex';
            });
            document.querySelectorAll('.chat-dot').forEach(function(el){ el.style.display = 'block'; });
          } else {
            document.querySelectorAll('.chat-badge').forEach(function(el){ el.style.display = 'none'; });
            document.querySelectorAll('.chat-dot').forEach(function(el){ el.style.display = 'none'; });
          }
        }).catch(function(){});
    }
    check();
    setInterval(check, 8000);
  }

  // ===== 导出全局对象 =====
  global.BTCBOX = {
    markets: markets,
    account: account,
    isLoggedIn: isLoggedIn,
    login: login,
    logout: logout,
    requireLogin: requireLogin,
    saveAccount: function(){ saveAccount(account); },
    toast: toast,
    confirm: confirmModal,
    modal: showModal,
    closeModal: closeModal,
    fmtPrice: fmtPrice,
    fmtNum: fmtNum,
    coinIconHtml: coinIconHtml,
    sparkSVG: sparkSVG,
    genSpark: genSpark,
    renderBottomNav: renderBottomNav,
    renderMarketList: renderMarketList,
    renderTopCoins: renderTopCoins,
    updateMarketListInPlace: updateMarketListInPlace,
    updateTopCoinsInPlace: updateTopCoinsInPlace,
    initAuthUI: initAuthUI,
    initChatBadge: initChatBadge,
    renderAssetCard: renderAssetCard,
    genKline: genKline,
    drawKline: drawKline,
    $: $,
  };

  // DOM 就绪后初始化
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ initAuthUI(); syncAccount(); });
  } else {
    initAuthUI(); syncAccount();
  }

  // 自动渲染底部导航（替代 document.write，避免时序问题）
  function autoRenderBottomNav(){
    var slot = document.getElementById('bottomNavSlot');
    if(slot){
      var active = slot.getAttribute('data-active') || 'home';
      slot.innerHTML = renderBottomNav(active);
    }
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', autoRenderBottomNav);
  } else {
    autoRenderBottomNav();
  }

  // 全局：输入框 focus 时防止被软键盘/底部导航遮挡（手机端）
  document.addEventListener('focusin', function(e){
    var t = e.target;
    if(t && (t.tagName==='INPUT' || t.tagName==='TEXTAREA' || t.tagName==='SELECT')){
      setTimeout(function(){
        try{ t.scrollIntoView({behavior:'smooth', block:'center'}); }catch(err){ t.scrollIntoView(); }
      }, 500);
      // 二次校准：虚拟键盘弹起需时，800ms 后再校准一次
      setTimeout(function(){
        try{ t.scrollIntoView({behavior:'smooth', block:'center'}); }catch(err){ t.scrollIntoView(); }
      }, 900);
    }
  });

  // ===== 桌面端顶部导航（>=768px 显示，移动端隐藏）=====
  function renderDesktopNav(){
    if(document.querySelector('.desktop-nav')) return;
    var inPages = location.pathname.indexOf('/pages/') > -1;
    var base = inPages ? '../' : '';
    var path = location.pathname;
    var links = [
      {key:'home', label:'首页', href: base + 'index.html'},
      {key:'markets', label:'行情', href: base + 'pages/markets.html'},
      {key:'trade', label:'交易', href: base + 'pages/trade.html?symbol=BTCUSDT'},
      {key:'seconds', label:'秒合约', href: base + 'pages/seconds.html'},
      {key:'assets', label:'资产', href: base + 'pages/assets.html'},
      {key:'me', label:'我的', href: base + 'pages/me.html'},
    ];
    // 当前页高亮
    var active = 'home';
    if(path.indexOf('markets')>-1) active='markets';
    else if(path.indexOf('trade')>-1) active='trade';
    else if(path.indexOf('seconds')>-1) active='seconds';
    else if(path.indexOf('assets')>-1 || path.indexOf('deposit')>-1 || path.indexOf('withdraw')>-1 || path.indexOf('orders')>-1) active='assets';
    else if(path.indexOf('me')>-1 || path.indexOf('settings')>-1 || path.indexOf('kyc')>-1) active='me';
    var html = '<div class="dn-brand"><div class="dn-brand-mark" style="background:transparent;box-shadow:none;border-radius:0;padding:0;"><img src="'+base+'assets/img/brand-icon.svg" alt="BTCBOX" style="width:100%;height:100%;object-fit:contain;display:block;"></div><div class="dn-brand-name">BTC<b>BOX</b></div></div>';
    html += '<div class="dn-links">';
    links.forEach(function(l){
      html += '<a class="dn-link' + (l.key===active?' active':'') + '" href="'+l.href+'">'+(global.I18N?I18N.t(l.key):l.label)+'</a>';
    });
    html += '</div>';
    html += '<div class="dn-actions" id="dnActions"></div>';
    var nav = document.createElement('nav');
    nav.className = 'desktop-nav';
    nav.innerHTML = html;
    // 插入到 body 最前
    document.body.insertBefore(nav, document.body.firstChild);
    updateDesktopNavAuth();
  }
  function updateDesktopNavAuth(){
    var box = document.getElementById('dnActions');
    if(!box) return;
    var inPages = location.pathname.indexOf('/pages/') > -1;
    var base = inPages ? '../' : '';
    if(isLoggedIn()){
      var email = account.email || 'user@btcbox.com';
      var initial = (email.charAt(0)||'U').toUpperCase();
      box.innerHTML = '<div class="dn-user"><div class="dn-avatar">'+initial+'</div><span style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+email+'</span></div>' +
        '<button class="dn-logout" id="dnLogout">退出</button>';
      var btn = document.getElementById('dnLogout');
      if(btn) btn.addEventListener('click', function(){ logout(); toast((window.I18N?I18N.t('logoutOk2'):''), 'info'); setTimeout(function(){ location.href = base + 'index.html'; }, 600); });
    } else {
      box.innerHTML = '<a class="dn-btn dn-btn-outline" href="'+base+'pages/login.html">'+(global.I18N?I18N.t('login'):'登录')+'</a>' +
        '<a class="dn-btn dn-btn-gold" href="'+base+'pages/login.html?mode=register">'+(global.I18N?I18N.t('register'):'注册')+'</a>';
    }
  }
  document.addEventListener('accountChange', updateDesktopNavAuth);
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', renderDesktopNav);
  } else {
    renderDesktopNav();
  }
})(window);
