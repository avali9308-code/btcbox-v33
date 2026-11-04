(function(){
  var $ = function(id){ return document.getElementById(id); };
  var show = function(id){ ['stage-loading','stage-error','stage-signin','stage-consent'].forEach(function(s){ $(s).classList.toggle('hidden', s!==id); }); };
  var fail = function(msg){ $('error-msg').textContent = msg || 'Unable to load authorization details. Please try again.'; show('stage-error'); };
  var params = new URLSearchParams(location.search);
  var authorizationId = params.get('authorization_id') || params.get('auth_id') || params.get('id');
  if(!authorizationId){ fail('Invalid authorization request: missing authorization_id. Please restart the sign-in flow from the application.'); return; }

  var sbClient = null;
  function redirectUrlOf(data){
    if(!data) return null;
    return data.redirect_url || data.redirect_to || data.redirect_uri || (data.data && (data.data.redirect_url || data.data.redirect_to || data.data.redirect_uri)) || null;
  }

  fetch('/api/config').then(function(r){ return r.json(); }).then(function(cfg){
    if(!cfg || !cfg.ok || !cfg.supabase_auth_url || !cfg.supabase_auth_publishable_key){
      fail('Authentication service is not configured. Please try again later or contact support.'); return;
    }
    if(!window.supabase || typeof window.supabase.createClient !== 'function'){
      fail('Authentication library failed to load. Please refresh the page.'); return;
    }
    sbClient = window.supabase.createClient(cfg.supabase_auth_url, cfg.supabase_auth_publishable_key);
    init();
  }).catch(function(){ fail('Unable to reach authentication service. Please check your connection and retry.'); });

  function init(){
    sbClient.auth.getSession().then(function(res){
      var session = res && res.data && res.data.session;
      if(!session){
        try{ sessionStorage.setItem('oauth_return_to', location.href); }catch(e){}
        show('stage-signin');
        return;
      }
      if(!sbClient.auth.oauth || typeof sbClient.auth.oauth.getAuthorizationDetails !== 'function'){
        fail('OAuth Server methods are unavailable in this client version. Please refresh or contact support.'); return;
      }
      loadDetails();
    }).catch(function(){ fail('Unable to verify your session. Please sign in again.'); });
  }

  function loadDetails(){
    show('stage-loading');
    sbClient.auth.oauth.getAuthorizationDetails(authorizationId).then(function(res){
      if(res.error){ fail('Authorization request expired or invalid. Please restart the sign-in flow from the application.'); return; }
      var d = res.data || {};
      // If no authorization_id is returned, the user previously consented — redirect straight through.
      if(!('authorization_id' in d) || d.already_consented){
        var ru = redirectUrlOf(d);
        if(ru){ location.replace(ru); return; }
      }
      renderConsent(d);
    }).catch(function(){ fail('Unable to load authorization details. Please try again.'); });
  }

  function renderConsent(d){
    var client = d.client || d.application || {};
    var name = client.name || client.application_name || null;
    $('app-name').textContent = name || 'Third-party application';
    var metaParts = [];
    if(client.id) metaParts.push('Client ID: ' + client.id);
    if(d.redirect_uri) metaParts.push('Redirects to: ' + (function(){ try{ return new URL(d.redirect_uri).host; }catch(e){ return d.redirect_uri; } })());
    $('app-meta').innerHTML = metaParts.map(function(m){ return '<span class="code">'+m+'</span>'; }).join('<br>');
    if(!name){
      $('consent-note').style.display = 'block';
      $('consent-note').textContent = 'Application name unavailable. Verify the Client ID matches the application you intend to authorize before allowing access.';
    }
    var scopes = Array.isArray(d.scopes) ? d.scopes : (typeof d.scopes === 'string' ? d.scopes.split(/[ ,]+/).filter(Boolean) : []);
    var list = $('scopes-list'); list.innerHTML = '';
    if(scopes.length){
      scopes.forEach(function(s){
        var li = document.createElement('li');
        li.innerHTML = '<span class="scope-name">'+s+'</span>';
        list.appendChild(li);
      });
    } else {
      var li = document.createElement('li');
      li.textContent = 'Basic account identification (no additional scopes requested).';
      list.appendChild(li);
    }
    $('app-icon').textContent = (name || '?').charAt(0).toUpperCase();
    show('stage-consent');
    $('btn-allow').onclick = function(){ decide(true); };
    $('btn-deny').onclick = function(){ decide(false); };
  }

  function decide(allow){
    var btnA = $('btn-allow'), btnD = $('btn-deny');
    btnA.disabled = true; btnD.disabled = true;
    btnA.textContent = allow ? 'Allowing…' : btnA.textContent;
    btnD.textContent = !allow ? 'Denying…' : btnD.textContent;
    var method = allow ? 'approveAuthorization' : 'denyAuthorization';
    var opts = { skipBrowserRedirect: true };
    var p = sbClient.auth.oauth[method](authorizationId, opts);
    p.then(function(res){
      if(res.error){
        btnA.disabled = false; btnD.disabled = false;
        btnA.textContent = 'Allow access'; btnD.textContent = 'Deny';
        fail(allow ? 'Unable to complete authorization. Please try again.' : 'Unable to deny authorization. Please try again.');
        show('stage-error');
        return;
      }
      var ru = redirectUrlOf(res.data);
      if(ru){ location.replace(ru); return; }
      // If skipBrowserRedirect was not honoured and no URL returned, the SDK may have navigated already.
      fail('Authorization completed but no redirect URL was returned. Please return to the application.');
    }).catch(function(){
      btnA.disabled = false; btnD.disabled = false;
      btnA.textContent = 'Allow access'; btnD.textContent = 'Deny';
      fail(allow ? 'Unable to complete authorization. Please try again.' : 'Unable to deny authorization. Please try again.');
      show('stage-error');
    });
  }
})();

/* externalized from inline onclick; CSP forbids inline handlers */
(function(){var b=document.getElementById("retry-btn");if(b){b.addEventListener("click",function(){location.reload();});}})();
