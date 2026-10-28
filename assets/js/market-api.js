/* BTCBOX live market client.
 * All market data is proxied through the same-origin API. The server owns
 * provider priority (Coinbase first, Bybit fallback) and USDT quote validation.
 * No direct exchange WebSocket, fabricated price, or stale-value fallback.
 */
(function(global){
  'use strict';
  var COIN_META = {
    BTC:'Bitcoin', ETH:'Ethereum', SOL:'Solana', BNB:'BNB', XRP:'Ripple', DOGE:'Dogecoin',
    ADA:'Cardano', AVAX:'Avalanche', LINK:'Chainlink', DOT:'Polkadot', TRX:'Tron',
    MATIC:'Polygon', LTC:'Litecoin', BCH:'Bitcoin Cash', NEAR:'Near Protocol',
    UNI:'Uniswap', ATOM:'Cosmos', ETC:'Ethereum Classic', XLM:'Stellar', ALGO:'Algorand'
  };
  var state = { mode:'connecting', pollTimer:null, listeners:[], markets:{}, lastPollOk:0, started:false, inFlight:false };
  function fmtVol(q){
    var n=Number(q);
    if(!Number.isFinite(n)||n<0) return '--';
    if(n>=1e9) return (n/1e9).toFixed(1)+'B';
    if(n>=1e6) return (n/1e6).toFixed(1)+'M';
    if(n>=1e3) return (n/1e3).toFixed(1)+'K';
    return n.toFixed(0);
  }
  function emit(){
    var arr=Object.keys(COIN_META).map(function(sym){return state.markets[sym];}).filter(Boolean);
    state.listeners.slice().forEach(function(cb){try{cb(arr);}catch(e){}});
  }
  function pollOnce(){
    if(state.inFlight) return;
    state.inFlight=true;
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeout = controller ? setTimeout(function(){controller.abort();},6000) : null;
    fetch('/api/market',{cache:'no-store',signal:controller?controller.signal:undefined})
      .then(function(r){if(!r.ok) throw new Error('Market API unavailable'); return r.json();})
      .then(function(j){
        if(!j||j.ok!==true||!j.data||typeof j.data!=='object') throw new Error('Invalid market response');
        var next={};
        Object.keys(j.data).forEach(function(base){
          var d=j.data[base];
          if(!COIN_META[base]||!d) return;
          var price=Number(d.price), chg=Number(d.chg), high=Number(d.high), low=Number(d.low), vol=Number(d.vol);
          if(!Number.isFinite(price)||price<=0||!Number.isFinite(chg)||!Number.isFinite(high)||high<=0||!Number.isFinite(low)||low<=0||!Number.isFinite(vol)||vol<0) return;
          next[base]={sym:base,name:COIN_META[base],price:price,chg:chg,high:high,low:low,vol:fmtVol(vol),ts:Number(d.ts||Date.now()/1000)*1000,source:d.source||j.source||'unknown'};
        });
        if(!Object.keys(next).length) throw new Error('No valid market rows');
        state.markets=next;
        state.lastPollOk=Date.now();
        state.mode='polling';
        emit();
      })
      .catch(function(){
        if(Date.now()-state.lastPollOk>10000){state.markets={};state.mode='unavailable';emit();}
      })
      .finally(function(){if(timeout)clearTimeout(timeout);state.inFlight=false;});
  }
  function start(){
    if(state.started)return;
    state.started=true;
    pollOnce();
    state.pollTimer=setInterval(pollOnce,4000);
  }
  function getKline(symbol,interval){
    symbol=(symbol||'BTCUSDT').toUpperCase(); interval=interval||'1m';
    if(!/^[A-Z0-9]{1,16}USDT$/.test(symbol)) return Promise.reject(new Error('Invalid USDT market symbol'));
    return fetch('/api/kline?symbol='+encodeURIComponent(symbol)+'&interval='+encodeURIComponent(interval),{cache:'no-store'})
      .then(function(r){return r.json().then(function(j){if(!r.ok||!j||j.ok!==true||!Array.isArray(j.data))throw new Error('Live candlestick data is unavailable');return j.data;});});
  }
  function getDepth(symbol){
    symbol=(symbol||'BTCUSDT').toUpperCase();
    if(!/^[A-Z0-9]{1,16}USDT$/.test(symbol)) return Promise.reject(new Error('Invalid USDT market symbol'));
    return fetch('/api/depth?symbol='+encodeURIComponent(symbol),{cache:'no-store'})
      .then(function(r){return r.json().then(function(j){if(!r.ok||!j||j.ok!==true||!Array.isArray(j.bids)||!Array.isArray(j.asks))throw new Error('Live order-book data is unavailable');return {bids:j.bids,asks:j.asks,source:j.source};});});
  }
  global.MarketAPI={start:start,onTick:function(cb){if(typeof cb==='function')state.listeners.push(cb);},getKline:getKline,getDepth:getDepth,getMode:function(){return state.mode;},getMarket:function(base){return state.markets[base];},WATCH_SYMBOLS:Object.keys(COIN_META).map(function(s){return s+'USDT';})};
})(window);
