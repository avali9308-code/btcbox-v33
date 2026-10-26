/* ============================================================
   BTCBOX v3 — 真实行情对接模块
   三级降级：Binance WebSocket 直连 → 同源 REST 轮询(/api/market) → 本地模拟
   K线/盘口：同源代理 /api/kline、/api/depth
   用法：在 app.js 之前引入，MarketAPI.start() 自动接管 BTCBOX.markets
   ============================================================ */
(function(global){
  'use strict';

  var WATCH_SYMBOLS = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT',
    'ADAUSDT','AVAXUSDT','LINKUSDT','DOTUSDT','TRXUSDT','MATICUSDT','LTCUSDT','BCHUSDT',
    'NEARUSDT','UNIUSDT','ATOMUSDT','ETCUSDT','XLMUSDT','ALGOUSDT'];

  var COIN_META = {
    BTC:'Bitcoin', ETH:'Ethereum', SOL:'Solana', BNB:'BNB', XRP:'Ripple', DOGE:'Dogecoin',
    ADA:'Cardano', AVAX:'Avalanche', LINK:'Chainlink', DOT:'Polkadot', TRX:'Tron',
    MATIC:'Polygon', LTC:'Litecoin', BCH:'Bitcoin Cash', NEAR:'Near Protocol',
    UNI:'Uniswap', ATOM:'Cosmos', ETC:'Ethereum Classic', XLM:'Stellar', ALGO:'Algorand',
  };

  var state = {
    mode: 'connecting', // connecting | websocket | polling | fallback
    ws: null,
    pollTimer: null,
    listeners: [],
    markets: {}, // sym -> {sym, name, price, chg, high, low, vol, ts}
    lastPollOk: 0,
    started: false,
  };

  function fmtVol(q){
    // q 是 USDT 计价成交额，转为 B/M 缩写
    var n = parseFloat(q) || 0;
    if(n >= 1e9) return (n/1e9).toFixed(1) + 'B';
    if(n >= 1e6) return (n/1e6).toFixed(1) + 'M';
    if(n >= 1e3) return (n/1e3).toFixed(1) + 'K';
    return n.toFixed(0);
  }

  function upsertTicker(sym, price, chgPct, high, low, quoteVol){
    var base = sym.replace('USDT','');
    if(!COIN_META[base]) return;
    state.markets[base] = {
      sym: base,
      name: COIN_META[base],
      price: parseFloat(price) || 0,
      chg: parseFloat(chgPct) || 0,
      high: parseFloat(high) || 0,
      low: parseFloat(low) || 0,
      vol: fmtVol(quoteVol),
      ts: Date.now(),
    };
  }

  function emit(){
    var arr = Object.keys(COIN_META).map(function(s){
      return state.markets[s] || {sym:s, name:COIN_META[s], price:0, chg:0, high:0, low:0, vol:'--', ts:0};
    }).filter(function(m){ return m.price > 0; });
    state.listeners.forEach(function(cb){ try{ cb(arr); }catch(e){} });
  }

  // ===== 一级：Binance WebSocket 组合流直连 =====
  function connectWS(){
    if(state.mode === 'websocket') return;
    try{
      var streams = WATCH_SYMBOLS.map(function(s){ return s.toLowerCase() + '@miniTicker'; }).join('/');
      var url = 'wss://stream.binance.com:9443/stream?streams=' + streams;
      var ws = new WebSocket(url);
      state.ws = ws;
      var opened = false;
      ws.onopen = function(){
        opened = true;
        state.mode = 'websocket';
        if(state.pollTimer){ clearInterval(state.pollTimer); state.pollTimer = null; }
      };
      ws.onmessage = function(ev){
        try{
          var msg = JSON.parse(ev.data);
          var d = msg.data || msg;
          if(d && d.s){
            // miniTicker 无 P 字段，用 (c-o)/o 自算涨跌幅；@ticker 有 P 字段直接用
            var chgPct = (d.P !== undefined && d.P !== null) ? d.P : ((parseFloat(d.c)-parseFloat(d.o))/parseFloat(d.o)*100);
            upsertTicker(d.s, d.c, chgPct, d.h, d.l, d.q);
            emit();
          }
        }catch(e){}
      };
      ws.onerror = function(){
        if(!opened) fallbackToPolling();
      };
      ws.onclose = function(){
        if(state.mode === 'websocket'){
          state.mode = 'connecting';
          setTimeout(connectWS, 3000); // 断线重连
        }
      };
      // 5秒内没连上，降级到轮询
      setTimeout(function(){ if(!opened) fallbackToPolling(); }, 5000);
    }catch(e){
      fallbackToPolling();
    }
  }

  // ===== 二级：同源 REST 轮询 /api/market =====
  function fallbackToPolling(){
    if(state.mode === 'polling' || state.pollTimer) return;
    state.mode = 'polling';
    if(state.ws){ try{ state.ws.close(); }catch(e){} state.ws = null; }
    pollOnce();
    state.pollTimer = setInterval(pollOnce, 4000);
  }

  function pollOnce(){
    fetch('/api/market', {cache:'no-store'})
      .then(function(r){ return r.json(); })
      .then(function(j){
        if(j && j.ok && j.data){
          state.lastPollOk = Date.now();
          Object.keys(j.data).forEach(function(base){
            var d = j.data[base];
            if(!COIN_META[base]) return;
            state.markets[base] = {
              sym: base, name: COIN_META[base],
              price: d.price || 0, chg: d.chg || 0,
              high: d.high || 0, low: d.low || 0,
              vol: fmtVol(d.vol), ts: d.ts ? d.ts*1000 : Date.now(),
            };
          });
          emit();
        }
      })
      .catch(function(){
        // 连续 10 秒拉不到，启动本地模拟兜底
        if(Date.now() - state.lastPollOk > 10000 && state.mode !== 'fallback'){
          startFallback();
        }
      });
  }

  // ===== 三级：本地模拟（保证页面永远有数据）=====
  function startFallback(){
    if(state.mode === 'fallback') return;
    state.mode = 'fallback';
    if(state.pollTimer){ clearInterval(state.pollTimer); state.pollTimer = null; }
    // 用初始价格种子（同时保存为基准用于均值回归）
    var seeds = {BTC:67432.5, ETH:3521.8, SOL:168.45, BNB:598.2, XRP:0.5234, DOGE:0.1287,
      ADA:0.4521, AVAX:34.56, LINK:14.23, DOT:6.78, TRX:0.1342, MATIC:0.7234, LTC:84.32,
      BCH:478.5, NEAR:5.678, UNI:8.923, ATOM:7.234, ETC:26.45, XLM:0.1123, ALGO:0.1876};
    var baseChg = {BTC:2.34, ETH:1.87, SOL:-0.92, BNB:0.56, XRP:3.21, DOGE:-1.45,
      ADA:1.12, AVAX:-2.18, LINK:4.56, DOT:-0.34, TRX:0.89, MATIC:-1.23, LTC:1.45,
      BCH:2.10, NEAR:3.45, UNI:-0.67, ATOM:1.78, ETC:-0.45, XLM:2.34, ALGO:-1.89};
    Object.keys(seeds).forEach(function(s){
      state.markets[s] = {sym:s, name:COIN_META[s], price:seeds[s], chg:baseChg[s]||0,
        high:seeds[s]*1.02, low:seeds[s]*0.97, vol:'1.2B', ts:Date.now()};
    });
    emit();
    setInterval(function(){
      Object.keys(state.markets).forEach(function(s){
        var m = state.markets[s];
        var base = seeds[s];
        var deviation = (m.price - base) / base;
        var meanRevert = -deviation * 0.05; // 每 tick 回归 5% 偏离
        var drift = meanRevert + (Math.random()-0.5) * 0.0006; // ±0.03% 真实量级波动
        m.price = Math.max(0.0001, m.price*(1+drift));
        var bc = baseChg[s] || 0;
        m.chg = bc + (m.chg - bc) * 0.93 + (Math.random()-0.5) * 0.06;
        m.chg = Math.max(-10, Math.min(10, m.chg));
      });
      emit();
    }, 3000);
  }

  // ===== K线（同源代理）=====
  function getKline(symbol, interval){
    symbol = (symbol || 'BTCUSDT').toUpperCase();
    return fetch('/api/kline?symbol=' + symbol, {cache:'no-store'})
      .then(function(r){ return r.json(); })
      .then(function(j){
        if(j && j.ok && j.data) return j.data;
        throw new Error('no kline data');
      })
      .catch(function(){
        // 兜底：生成模拟K线
        var data = [], price = (state.markets[symbol.replace('USDT','')]||{}).price || 67000;
        for(var i=0;i<80;i++){
          var open = price, change = (Math.random()-0.48)*price*0.005;
          var close = open + change;
          var high = Math.max(open,close) + Math.random()*price*0.002;
          var low = Math.min(open,close) - Math.random()*price*0.002;
          var vol = Math.random()*1000+200;
          data.push([Date.now()-(80-i)*60000, open, high, low, close, vol]);
          price = close;
        }
        return data;
      });
  }

  // ===== 盘口深度（同源代理）=====
  function getDepth(symbol){
    symbol = (symbol || 'BTCUSDT').toUpperCase();
    return fetch('/api/depth?symbol=' + symbol, {cache:'no-store'})
      .then(function(r){ return r.json(); })
      .then(function(j){
        if(j && j.ok) return {bids:j.bids, asks:j.asks};
        throw new Error('no depth');
      })
      .catch(function(){
        // 兜底：模拟盘口
        var p = (state.markets[symbol.replace('USDT','')]||{}).price || 67000;
        var bids=[], asks=[];
        for(var i=1;i<=10;i++){
          bids.push([(p*(1-i*0.0008)).toFixed(2), (Math.random()*2+0.3).toFixed(4)]);
          asks.push([(p*(1+i*0.0008)).toFixed(2), (Math.random()*2+0.3).toFixed(4)]);
        }
        return {bids:bids, asks:asks};
      });
  }

  function onTick(cb){ state.listeners.push(cb); }

  function start(){
    if(state.started) return;
    state.started = true;
    // 先尝试轮询拿初始数据（快），同时连 WebSocket
    pollOnce();
    connectWS();
    // 30秒后如果还在 connecting，强制降级
    setTimeout(function(){ if(state.mode==='connecting') fallbackToPolling(); }, 30000);
  }

  function getMode(){ return state.mode; }
  function getMarket(base){ return state.markets[base]; }

  global.MarketAPI = {
    start: start,
    onTick: onTick,
    getKline: getKline,
    getDepth: getDepth,
    getMode: getMode,
    getMarket: getMarket,
    WATCH_SYMBOLS: WATCH_SYMBOLS,
  };
})(window);
