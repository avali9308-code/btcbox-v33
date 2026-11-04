/* BTCBOX ui-components.js — frozen public UI component library.
 * Loads after app-core.js, reassigns legacy global modal() to a compatible
 * wrapper so all existing call sites keep working. Fund-operation results
 * must use BTCBox.modal (not toast) — enforced by convention in views.
 */
"use strict";
window.BTCBox = window.BTCBox || {};
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var _escHandler = null;
  var _focusHandler = null;
  var _drawerEscHandler = null;
  var _drawerFocusHandler = null;
  function removeEsc() { if (_escHandler) { document.removeEventListener('keydown', _escHandler); _escHandler = null; } }
  function removeFocusTrap() { if (_focusHandler) { document.removeEventListener('keydown', _focusHandler); _focusHandler = null; } }
  function removeDrawerHandlers() {
    if (_drawerEscHandler) { document.removeEventListener('keydown', _drawerEscHandler); _drawerEscHandler = null; }
    if (_drawerFocusHandler) { document.removeEventListener('keydown', _drawerFocusHandler); _drawerFocusHandler = null; }
  }
  function focusableIn(root) {
    return Array.prototype.slice.call(root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(function (el) { return !el.hidden && el.getAttribute('aria-hidden') !== 'true' && el.getClientRects().length > 0; });
  }
  function escClose(close, closable) {
    removeEsc();
    _escHandler = function (e) { if (e.key === 'Escape' && closable) close(); };
    document.addEventListener('keydown', _escHandler);
  }
  function strContent(c) {
    if (typeof c === 'string') return c;
    if (c && c.outerHTML) return c.outerHTML;
    return '';
  }
  function btnClass(v) { return v === 'danger' ? 'btn-danger' : v === 'ghost' ? 'btn-ghost' : 'btn-primary'; }

  /* ---- BTCBox.modal({title, content, buttons, width, closable, onClose, onMount}) ---- */
  window.BTCBox.modal = function (opts) {
    opts = opts || {};
    var title = opts.title || '';
    var buttons = opts.buttons || [];
    var width = opts.width != null ? opts.width : 'md'; // sm|md|lg|risk|number(px)
    var closable = opts.closable !== false;
    var onClose = opts.onClose;
    var onMount = opts.onMount;
    var root = $('#modal-root');
    var previousFocus = document.activeElement;
    if (root.children.length) _unlockBodyScroll();
    var wAttr = (typeof width === 'number') ? '' : ' data-w="' + width + '"';
    var wStyle = (typeof width === 'number') ? ' style="max-width:' + width + 'px"' : '';
    var buttonsHTML = '';
    if (buttons.length) {
      buttonsHTML = '<div class="modal-actions">' + buttons.map(function (b, i) {
        return '<button class="btn ' + btnClass(b.variant) + '" data-mbtn="' + i + '"' + (b.disabled ? ' disabled' : '') + '>' + (b.loading ? '<span class="spinner"></span> ' : '') + (b.text || 'OK') + '</button>';
      }).join('') + '</div>';
    }
    var xBtn = closable ? '<button id="modal-x" style="color:var(--text-muted);font-size:22px;line-height:1;background:none;border:none;cursor:pointer;padding:0 4px">&times;</button>' : '';
    root.innerHTML = '<div class="modal-mask" id="modal-mask"><div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"' + wAttr + wStyle + '>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border)"><div id="modal-title" style="font-weight:600;font-size:16px">' + title + '</div>' + xBtn + '</div>'
      + '<div class="modal-body">' + strContent(opts.content) + '</div>'
      + buttonsHTML + '</div></div>';
    var closed = false;
    var api = {};
    var modalNode = root.firstElementChild;
    var close = function () {
      if (closed) return;
      closed = true;
      /* A stale async callback must not close, unlock, or mutate a replacement modal. */
      if (root.firstElementChild !== modalNode) return;
      root.innerHTML = '';
      _unlockBodyScroll();
      removeEsc();
      removeFocusTrap();
      if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus();
      if (onClose) onClose();
    };
    api.close = close;
    api.setLoading = function (i, on) {
      if (root.firstElementChild !== modalNode) return;
      var b = modalNode.querySelector('[data-mbtn="' + i + '"]'); if (!b) return;
      if (on) { b.classList.add('is-loading'); if (!b.querySelector('.spinner')) b.insertAdjacentHTML('afterbegin', '<span class="spinner"></span> '); b.disabled = true; }
      else { b.classList.remove('is-loading'); var s = b.querySelector('.spinner'); if (s) s.remove(); b.disabled = false; }
    };
    api.el = modalNode;
    if (closable) {
      var x = modalNode.querySelector('#modal-x'); if (x) x.onclick = close;
      var mask = modalNode.querySelector('#modal-mask'); if (mask) mask.onclick = function (e) { if (e.target.id === 'modal-mask') close(); };
    }
    escClose(close, closable);
    var dialog = modalNode.querySelector('.modal-box');
    _focusHandler = function (e) {
      if (e.key !== 'Tab' || !dialog || !dialog.isConnected) return;
      var items = focusableIn(dialog);
      if (!items.length) { e.preventDefault(); dialog.focus(); return; }
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', _focusHandler);
    _lockBodyScroll();
    var initialFocus = focusableIn(dialog)[0];
    (initialFocus || dialog).focus();
    buttons.forEach(function (b, i) {
      var el = modalNode.querySelector('[data-mbtn="' + i + '"]'); if (!el) return;
      el.onclick = async function () {
        if (el.disabled) return;
        if (b.onClick) {
          api.setLoading(i, true);
          try { var r = b.onClick(close, el); if (r && typeof r.then === 'function') await r; }
          finally { api.setLoading(i, false); }
        } else { close(); }
      };
    });
    if (onMount) onMount(close, api);
    return api;
  };

  /* ---- BTCBox.drawer({side:'bottom'|'right', title, content, height, closable, onClose, onMount}) ---- */
  if (!$('#drawer-root')) { var dr = document.createElement('div'); dr.id = 'drawer-root'; document.body.appendChild(dr); }
  var _activeDrawerClose = null;
  window.BTCBox.drawer = function (opts) {
    opts = opts || {};
    if (_activeDrawerClose) _activeDrawerClose();
    var side = opts.side === 'right' ? 'right' : 'bottom';
    var closable = opts.closable !== false;
    var onClose = opts.onClose;
    var root = $('#drawer-root');
    var previousFocus = document.activeElement;
    var titleId = 'drawer-title';
    var hStyle = (opts.height && side === 'bottom') ? ' style="height:' + (typeof opts.height === 'number' ? opts.height + 'px' : opts.height) + '"' : '';
    var drawerX = closable ? '<button id="drawer-x" type="button" aria-label="Close panel" style="color:var(--text-muted);font-size:22px;line-height:1;background:none;border:none;cursor:pointer;padding:0 4px">&times;</button>' : '';
    root.innerHTML = '<div class="drawer-mask" id="drawer-mask"></div><div class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="' + titleId + '" tabindex="-1" data-side="' + side + '"' + hStyle + '>'
      + '<div class="drawer-head"><div id="' + titleId + '" style="font-weight:600;font-size:16px">' + (opts.title || '') + '</div>' + drawerX + '</div>'
      + '<div class="drawer-body">' + strContent(opts.content) + '</div></div>';
    var closed = false;
    var panel = root.querySelector('.drawer-panel');
    var close = function () {
      if (closed) return;
      closed = true;
      root.innerHTML = '';
      removeDrawerHandlers();
      _unlockBodyScroll();
      if (_activeDrawerClose === close) _activeDrawerClose = null;
      if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus();
      if (onClose) onClose();
    };
    _activeDrawerClose = close;
    var api = { close: close, el: panel };
    var drawerClose = $('#drawer-x');
    if (drawerClose) drawerClose.onclick = close;
    if (closable) {
      $('#drawer-mask').onclick = function (e) { if (e.target.id === 'drawer-mask') close(); };
    }
    removeDrawerHandlers();
    _drawerEscHandler = function (e) { if (e.key === 'Escape' && closable) close(); };
    _drawerFocusHandler = function (e) {
      if (e.key !== 'Tab' || !panel || !panel.isConnected) return;
      var items = focusableIn(panel);
      if (!items.length) { e.preventDefault(); panel.focus(); return; }
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', _drawerEscHandler);
    document.addEventListener('keydown', _drawerFocusHandler);
    _lockBodyScroll();
    var initialFocus = focusableIn(panel)[0];
    (initialFocus || panel).focus();
    if (opts.onMount) opts.onMount(close, api);
    return api;
  };

  /* ---- BTCBox.toast(msg, type) — lightweight; fund results MUST use modal ---- */
  window.BTCBox.toast = function (msg, type) { return toast(msg, type); };

  /* ---- Legacy compatibility: modal(title, bodyHTML, onMount) — exact old behavior (480px, closable) ---- */
  var _legacyModal = function (title, bodyHTML, onMount) {
    var m = window.BTCBox.modal({
      title: title, content: bodyHTML, width: 480, closable: true,
      onMount: onMount ? function (close) { onMount(close); } : null
    });
    return m.close;
  };
  modal = _legacyModal; // reassign global function binding; all call sites resolved at invocation time
})();
