/* BTCBOX boot.js — extracted from index.html, IIFE unwrapped, load order preserved. */
"use strict";
/* ---------- boot ---------- */
async function boot(){
  bindTopbar();
  startTicker();
  await Auth.init();
  let isRecoveryCallback = false;
  let accountProbe = null;
  let supabaseTwoFactorPending = null;
  try{
    if(window.supabaseClient){
      const hash = location.hash || '';
      const gs = await window.supabaseClient.auth.getSession();
      const session = gs && gs.data && gs.data.session;
      isRecoveryCallback = hash.indexOf('type=recovery')>=0 || hash.indexOf('recovery')>=0;
      // Email/password recovery is not an enabled BTCBOX sign-in flow. Never exchange a recovery token as a login session.
      if(isRecoveryCallback){
        try{ await window.supabaseClient.auth.signOut(); }catch(e){}
        try{ history.replaceState(null,'',window.location.pathname+'#/login'); }catch(e){ location.hash='#/login'; }
        toast('Password recovery is not available. Please continue with Google sign-in.','warn');
      }
      // If a Supabase session exists but no local cookie, exchange token for local cookie
      if(session && session.access_token && !isRecoveryCallback){
        try{
          accountProbe = await apiAdapter.account();
          if(!accountProbe || !accountProbe.ok){
            if(accountProbe && (accountProbe.status===401 || accountProbe.need_login===true)){
              const exchange=await apiAdapter.supabaseLogin(session.access_token);
              if(exchange && exchange.require_2fa===true && exchange.temp_token){
                supabaseTwoFactorPending={email:String(session.user&&session.user.email||''),tempToken:exchange.temp_token};
              }
            }
          }
        }catch(e){}
      }
      // Listen for token refresh / sign-out events
      try{
        window.supabaseClient.auth.onAuthStateChange(function(event, sess){
          if(event==='SIGNED_OUT'){
            if(state.user && typeof rememberLoginReturn==='function') rememberLoginReturn(location.hash);
            state.user=null;state.accountLoaded=false;state.balances={};state.orders=[];state.trades=[];state.secondsPositions={open:[],history:[]};state.kyc={level:0,status:'unverified'};state.settings.twofa=false;state.settings.fundPwdSet=false;state.supportMsgs=[];state.adminAuth=null;
            try{ location.hash='#/login'; }catch(e){}
          }
        });
      }catch(e){}
    }
  }catch(e){}
  // Reuse a successful session probe; retry only when the earlier probe did not establish the account.
  try{
    const ar = accountProbe && accountProbe.ok ? accountProbe : await apiAdapter.account();
    if(ar && ar.ok && ar.email){
      const ae=$('#avatar-email'); if(ae)ae.textContent=ar.email;
      const al=$('#avatar-letter'); if(al)al.textContent=(ar.email[0]||'?').toUpperCase();
    }
  }catch(e){}
  // OAuth callback (Google): ?auth_callback=1 or hash carries access_token/type=oauth — once a local session exists, redirect into the app (otherwise fall through to login)
  try{
    const _cbqp=new URLSearchParams(location.search);
    const _isAuthCallback=!isRecoveryCallback && (_cbqp.get('auth_callback')==='1' || /access_token=/.test(location.hash) || /type=oauth/.test(location.hash));
    if(_isAuthCallback && state.user){
      var _rt=consumeOAuthReturnTarget();
      if(_rt){ location.replace(_rt); }
      else { location.hash='#/markets'; }
      return;
    }
  }catch(e){}
  // hide splash
  setTimeout(()=>{const sp=$('#splash');if(sp){sp.classList.add('hide');setTimeout(()=>sp.remove(),500);}},900);
  if(!location.hash) location.hash='#/home';
  router();
  if(supabaseTwoFactorPending && supabaseTwoFactorPending.email){
    Auth.showLoginTwoFactor(supabaseTwoFactorPending.email,supabaseTwoFactorPending.tempToken);
  }
}
window.googleAuthEnabled=false;
function applyGoogleButtons(){
  const enabled=window.googleAuthEnabled && !!window.supabaseClient;
  [['google-login-btn','google-login-hint'],['google-register-btn','google-register-hint']].forEach(function(pair){
    const btn=document.getElementById(pair[0]), hint=document.getElementById(pair[1]);
    if(!btn) return;
    if(enabled){
      btn.disabled=false; if(hint) hint.textContent='';
      btn.onclick=async function(){
        if(!window.supabaseClient){ toast('Authentication service is not configured.','err'); return; }
        const old=btn.innerHTML; btn.disabled=true; btn.innerHTML='Redirecting…';
        try{
          try{
            const existing=sessionStorage.getItem('oauth_return_to')||sessionStorage.getItem('btcbox_login_return_to');
          if(existing){
            sessionStorage.setItem('oauth_return_to',existing);
          }else{
            let desired=location.hash||'#/markets';
            if(/^#\/(login|register)(?:\/|$)/i.test(desired)||!/^#\/[a-z0-9-]+(?:\/[a-z0-9._-]+)?$/i.test(desired))desired='#/markets';
            sessionStorage.setItem('oauth_return_to',desired);
          }
          }catch(e){}
          const isRegister=btn.id==='google-register-btn';
        if(isRegister){ const terms=document.getElementById('reg-terms'); if(!terms || !terms.checked){ const error=document.querySelector('[data-err-for="reg-terms"]'); if(error) error.textContent='Please accept the Terms of Service and Privacy Policy to continue.'; toast('Please accept the Terms of Service and Privacy Policy.','err'); btn.disabled=false; btn.innerHTML=old; return; } }
        const res=await window.supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+window.location.pathname+'?auth_callback=1',queryParams:{prompt:'select_account'}}});
          if(res && res.error){ toast(Auth.friendlyError(res.error),'err'); btn.disabled=false; btn.innerHTML=old; }
        }catch(e){ toast('Google sign-in failed. Please try again.','err'); btn.disabled=false; btn.innerHTML=old; }
      };
    } else {
      btn.disabled=true; if(hint) hint.textContent='Google sign-in is temporarily unavailable. Please try again later.';
    }
  });
}
async function probeAuthHealth(){
  try{ const r=await fetch(API_BASE+'/auth-health',{cache:'no-store'}); const d=r.ok?await r.json():{}; window.googleAuthEnabled=!!(d && d.provider_enabled===true); }catch(e){ window.googleAuthEnabled=false; }
  applyGoogleButtons();
}
probeAuthHealth();
boot();
