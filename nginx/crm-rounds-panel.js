(function () {
  var CARD_VIEW_ID = '913f2779-56a9-45fe-a491-0461031d670f';
  var overlayId = 'crm-rounds-overlay';

  function addStyle() {
    if (document.getElementById('crm-rounds-style')) return;
    var style = document.createElement('style');
    style.id = 'crm-rounds-style';
    style.textContent = [
      '#crm-rounds-overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.66);display:flex;align-items:center;justify-content:center;padding:24px;}',
      '.crm-rounds-dialog{width:min(1000px,92vw);max-height:88vh;background:#151515;color:#f2f2f2;border:1px solid #333;border-radius:14px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.65);font-family:inherit;}',
      '.crm-rounds-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 22px;border-bottom:1px solid #2a2a2a;}',
      '.crm-rounds-title{font-size:16px;font-weight:600;letter-spacing:.2px;}',
      '.crm-rounds-count{font-size:13px;font-weight:400;color:#8a8a8a;margin-left:8px;}',
      '.crm-rounds-close{background:transparent;border:0;color:#9a9a9a;font-size:28px;line-height:1;cursor:pointer;padding:0 4px;}',
      '.crm-rounds-close:hover{color:#fff;}',
      '.crm-rounds-body{padding:8px 22px 22px;overflow:auto;}',
      '.crm-rounds-loading{padding:48px 0;text-align:center;color:#9a9a9a;font-size:14px;}',
      '.crm-rounds-card{padding:16px 0;border-bottom:1px solid #262626;}',
      '.crm-rounds-card:last-child{border-bottom:0;}',
      '.crm-rounds-card-head{display:flex;align-items:baseline;gap:12px;margin-bottom:8px;}',
      '.crm-rounds-card-title{font-size:15px;font-weight:600;color:#fff;}',
      '.crm-rounds-card-date{font-size:12px;color:#8a8a8a;}',
      '.crm-rounds-card-content{font-size:14px;line-height:1.75;color:#d6d6d6;white-space:pre-wrap;word-break:break-word;}',
      '.crm-rounds-empty{padding:36px 0;text-align:center;color:#9a9a9a;font-size:14px;}'
    ].join('');
    document.head.appendChild(style);
  }

  function closeOverlay() {
    var el = document.getElementById(overlayId);
    if (el) el.remove();
    document.body.style.overflow = '';
  }

  function extractCards(anchors, doc) {
    var seen = {};
    var cards = [];
    anchors.forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (!href || seen[href]) return;
      seen[href] = true;
      var title = (a.innerText || a.textContent || '').trim().replace(/\s+/g, ' ').replace(/^第\s*第/, '第');
      function uniqueHrefCount(el) {
        var set = {};
        Array.prototype.forEach.call(el.querySelectorAll('a[href*="/object/communicationRecord/"]'), function (x) {
          var h = x.getAttribute('href');
          if (h) set[h] = 1;
        });
        return Object.keys(set).length;
      }
      var row = a;
      var prev = a;
      for (var i = 0; i < 10 && row; i++) {
        if (uniqueHrefCount(row) > 1) break;
        prev = row;
        row = row.parentElement;
      }
      row = prev;
      if (!row) return;
      var rowText = row.innerText || '';
      var dateMatch = rowText.match(/\d{4}\s*\d{1,2}\s*月\s*\d{1,2}(?:\s+\d{1,2}:\d{2})?/);
      var date = dateMatch ? dateMatch[0].replace(/\s+/g, ' ') : '';
      var texts = [];
      var walker = doc.createTreeWalker(row, NodeFilter.SHOW_TEXT, null);
      while (walker.nextNode()) {
        var t = (walker.currentNode.textContent || '').trim();
        if (t) texts.push(t);
      }
      if (!date) {
        var dateText = texts.filter(function (t) { return /\d{4}\s*\d{1,2}\s*月\s*\d{1,2}/.test(t); })[0];
        if (dateText) date = dateText.replace(/\s+/g, ' ');
      }
      var content = texts.filter(function (t) {
        if (t === title) return false;
        if (/^第\s*第?\d+轮/.test(t)) return false;
        if (/^\d+(\.\d+)?$/.test(t)) return false;
        if (/\d{4}\s*\d{1,2}\s*月/.test(t)) return false;
        if (['沟通人', '沟通内容', '本轮结果', '关联客户', '轮次', '标题', '打开记录'].indexOf(t) !== -1) return false;
        return true;
      }).sort(function (x, y) { return y.length - x.length; })[0] || '';
      cards.push({ title: title, date: date, content: content });
    });
    return cards;
  }

  function openModal(href) {
    addStyle();
    closeOverlay();

    var overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.innerHTML = '<div class="crm-rounds-dialog"><div class="crm-rounds-head"><div class="crm-rounds-title">沟通记录<span class="crm-rounds-count"></span></div><button class="crm-rounds-close" aria-label="关闭">×</button></div><div class="crm-rounds-body"><div class="crm-rounds-loading">正在加载沟通记录…</div></div></div>';
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    var body = overlay.querySelector('.crm-rounds-body');
    var count = overlay.querySelector('.crm-rounds-count');
    overlay.querySelector('.crm-rounds-close').addEventListener('click', closeOverlay);

    var iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;height:900px;border:0;visibility:visible;pointer-events:none;';
    iframe.src = href;
    document.body.appendChild(iframe);

    var tries = 0;
    var done = false;

    function finish(cards) {
      if (done) return;
      done = true;
      try { iframe.remove(); } catch (e) {}
      if (!cards || !cards.length) {
        body.innerHTML = '<div class="crm-rounds-empty">没有沟通记录</div>';
        count.textContent = '';
        return;
      }
      count.textContent = cards.length + ' 轮';
      body.innerHTML = '';
      cards.forEach(function (card) {
        var item = document.createElement('div');
        item.className = 'crm-rounds-card';
        var head = document.createElement('div');
        head.className = 'crm-rounds-card-head';
        var title = document.createElement('div');
        title.className = 'crm-rounds-card-title';
        title.textContent = card.title || '沟通记录';
        head.appendChild(title);
        if (card.date) {
          var date = document.createElement('div');
          date.className = 'crm-rounds-card-date';
          date.textContent = card.date;
          head.appendChild(date);
        }
        var content = document.createElement('div');
        content.className = 'crm-rounds-card-content';
        content.textContent = card.content || '（无内容）';
        item.appendChild(head);
        item.appendChild(content);
        body.appendChild(item);
      });
    }

    function scrape() {
      if (done) return;
      tries += 1;
      try {
        var doc = iframe.contentDocument;
        if (doc) {
          var bodyText = (doc.body && doc.body.innerText) || '';
          if (tries > 10 && (bodyText.indexOf('没有记录') !== -1 || bodyText.indexOf('无记录') !== -1 || bodyText.indexOf('暂无') !== -1 || bodyText.indexOf('No records') !== -1)) {
            finish([]);
            return;
          }
          var all = doc.querySelectorAll('a[href*="/object/communicationRecord/"]');
          var anchors = Array.prototype.slice.call(all).filter(function (a) { return a.offsetParent !== null; });
          if (anchors.length) {
            finish(extractCards(anchors, doc));
            return;
          }
        }
      } catch (e) {}
      if (tries < 40) {
        setTimeout(scrape, 300);
      } else {
        done = true;
        try { iframe.remove(); } catch (e) {}
        body.innerHTML = '<div class="crm-rounds-empty">加载失败，请稍后重试</div>';
      }
    }

    iframe.addEventListener('load', function () { setTimeout(scrape, 600); });
    setTimeout(scrape, 1800);
  }

  function setupLiveRefresh() {
    if (!/^\/object\/person\//.test(window.location.pathname)) return;
    var firstHref = '';
    var firstCount = 0;
    var initialized = false;

    function currentFirstHref() {
      var a = document.querySelector('a[href*="/object/communicationRecord/"]');
      return a ? a.getAttribute('href') : '';
    }

    function uniqueRecordCount() {
      var links = document.querySelectorAll('a[href*="/object/communicationRecord/"]');
      var seen = {};
      for (var i = 0; i < links.length; i++) {
        var h = links[i].getAttribute('href');
        if (h) seen[h] = 1;
      }
      return Object.keys(seen).length;
    }

    function init() {
      var h = currentFirstHref();
      var text = document.body ? document.body.innerText : '';
      var empty = text.indexOf('没有记录') !== -1 ||
        text.indexOf('无记录') !== -1 ||
        text.indexOf('暂无记录') !== -1 ||
        text.indexOf('没有沟通记录') !== -1 ||
        text.indexOf('暂无沟通记录') !== -1 ||
        text.indexOf('还没有记录') !== -1 ||
        text.indexOf('还没有沟通记录') !== -1;
      if (h || empty) {
        firstHref = h;
        firstCount = uniqueRecordCount();
        initialized = true;
      }
    }

    setTimeout(init, 4000);
    setInterval(function () {
      if (!initialized) {
        init();
        return;
      }
      var h = currentFirstHref();
      var c = uniqueRecordCount();
      if (h !== firstHref || c !== firstCount) {
        var active = document.activeElement;
        var editing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
        if (document.querySelector('[role="dialog"]') || editing) return;
        firstHref = h;
        firstCount = c;
        window.location.reload();
      }
    }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupLiveRefresh);
  } else {
    setupLiveRefresh();
  }

  document.addEventListener('click', function (event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target && event.target.closest ? event.target.closest('a[href*="/objects/communicationRecords"]') : null;
    if (!link) return;
    var url;
    try { url = new URL(link.href, window.location.origin); } catch (e) { return; }
    if (url.searchParams.get('viewId') !== CARD_VIEW_ID) return;
    event.preventDefault();
    event.stopPropagation();
    openModal(url.href);
  }, true);
})();
