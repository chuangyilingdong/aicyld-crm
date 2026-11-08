(function () {
  'use strict';

  if (window.__crmInsightsLoaded) return;
  window.__crmInsightsLoaded = true;

  var PENDING_VIEW_ID = '309e9f72-29b4-4419-8b20-8e08d7e93056';
  var PENDING_VIEW_URL = '/objects/people?viewId=' + PENDING_VIEW_ID;
  var API_URL = '/graphql';
  var CARD_ID = 'crm-insights-card';
  var OVERLAY_ID = 'crm-insights-overlay';
  var STYLE_ID = 'crm-insights-style';
  var POLL_MS = 60 * 1000;

  var LABELS = {
    developer: {
      STAFF_A: '刘羽驰',
      STAFF_B: '影子 11',
      STAFF_C: '张镇峰',
      STAFF_D: '员工D'
    },
    customerStatus: {
      NEW: '可逼单',
      FOLLOWING: '已电话',
      WON: '已演示',
      LOST: '在考虑',
      BAO_ZHENG_JIN_JIAO_NA: '保证金缴纳',
      DAI_PEI_XUN: '待培训',
      DAI_ZHAO_SHENG: '待招生',
      KAI_KE_ZHONG: '开课中'
    },
    sourceChannel: {
      DOUYIN: '抖音',
      XIAOHONGSHU: '小红书',
      SHIPINHAO: '视频号',
      WECHAT: '微信',
      REFERRAL: '转介绍',
      OFFLINE: '线下',
      WEBSITE: '官网',
      OTHER: '闲鱼',
      QQQUN: 'QQ群'
    }
  };

  var COLORS = {
    developer: {
      STAFF_A: '#3e63dd',
      STAFF_B: '#30a46c',
      STAFF_C: '#8e4ec6',
      STAFF_D: '#f76b15'
    },
    customerStatus: {
      NEW: '#e5484d',
      FOLLOWING: '#3e63dd',
      WON: '#30a46c',
      LOST: '#8a8a8a',
      BAO_ZHENG_JIN_JIAO_NA: '#e5484d',
      DAI_PEI_XUN: '#e54666',
      DAI_ZHAO_SHENG: '#e93d82',
      KAI_KE_ZHONG: '#f76b15'
    },
    sourceChannel: {
      DOUYIN: '#3e63dd',
      XIAOHONGSHU: '#e5484d',
      SHIPINHAO: '#30a46c',
      WECHAT: '#12a594',
      REFERRAL: '#8e4ec6',
      OFFLINE: '#f76b15',
      WEBSITE: '#3e9dd8',
      OTHER: '#8a8a8a',
      QQQUN: '#e93d82'
    }
  };

  var STAGE_ORDER = [
    'NEW',
    'FOLLOWING',
    'WON',
    'LOST',
    'BAO_ZHENG_JIN_JIAO_NA',
    'DAI_PEI_XUN',
    'DAI_ZHAO_SHENG',
    'KAI_KE_ZHONG'
  ];

  var OWNER_ORDER = ['STAFF_A', 'STAFF_B', 'STAFF_C', 'STAFF_D'];

  var cache = {
    data: null,
    ts: 0,
    promise: null,
    error: null,
    unauthorized: false
  };

  var overlayOpen = false;
  var pendingAnchor = null;
  var started = false;
  var applyTimer = null;
  var lastSummary = null;
  var mutationTimer = null;
  var overlayRefreshBusy = false;

  var PEOPLE_QUERY =
    'query CrmInsightsPeople($after: String) {' +
    '  people(first: 100, after: $after) {' +
    '    pageInfo { hasNextPage endCursor }' +
    '    edges { node {' +
    '      id name { firstName lastName } createdAt developer customerStatus sourceChannel' +
    '      nextReminderAt reminderAcknowledged lastContactAt reminderText' +
    '    } }' +
    '  }' +
    '}';

  var COMMS_QUERY =
    'query CrmInsightsComms($after: String) {' +
    '  communicationRecords(first: 100, after: $after) {' +
    '    pageInfo { hasNextPage endCursor }' +
    '    edges { node { id communicatedAt customer { id } } }' +
    '  }' +
    '}';

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function setText(node, value) {
    if (node && node.textContent !== String(value)) node.textContent = String(value);
  }

  function shiftToShanghai(date) {
    return new Date(date.getTime() + 8 * 60 * 60 * 1000);
  }

  function startOfDayShanghai(date) {
    var d = shiftToShanghai(date);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 8 * 60 * 60 * 1000);
  }

  function startOfWeekShanghai(date) {
    var dayStart = startOfDayShanghai(date);
    var d = shiftToShanghai(dayStart);
    var offset = (d.getUTCDay() + 6) % 7;
    return new Date(dayStart.getTime() - offset * 24 * 60 * 60 * 1000);
  }

  function fmtTime(date) {
    if (!date) return '--:--';
    var d = shiftToShanghai(date);
    return pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes());
  }

  function fmtDate(date) {
    if (!date) return '—';
    var d = shiftToShanghai(date);
    return d.getUTCMonth() + 1 + '月' + d.getUTCDate() + '日';
  }

  function fmtDateTime(date) {
    if (!date) return '—';
    return fmtDate(date) + ' ' + fmtTime(date);
  }

  function fmtMonthDay(date) {
    var d = shiftToShanghai(date);
    return d.getUTCMonth() + 1 + '/' + d.getUTCDate();
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function humanDuration(ms) {
    var minutes = Math.max(1, Math.floor(ms / 60000));
    if (minutes < 60) return minutes + ' 分钟';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + ' 小时';
    return Math.floor(hours / 24) + ' 天';
  }

  function daysSince(date) {
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  }

  function labelOf(kind, value, fallback) {
    if (value === null || value === undefined || value === '') return fallback || '未填写';
    return (LABELS[kind] && LABELS[kind][value]) || value;
  }

  function colorOf(kind, value) {
    return (COLORS[kind] && COLORS[kind][value]) || '#6f6f6f';
  }

  function getTokenPair() {
    var match = document.cookie.match(/(?:^|;\s*)tokenPair=([^;]+)/);
    if (!match) return null;
    try {
      var parsed = JSON.parse(decodeURIComponent(match[1]));
      return (
        parsed &&
        parsed.accessOrWorkspaceAgnosticToken &&
        parsed.accessOrWorkspaceAgnosticToken.token
      ) || null;
    } catch (e) {
      return null;
    }
  }

  function buildHeaders(withBearer) {
    var headers = {
      'Content-Type': 'application/json',
      'x-twenty-session-cookie': '1',
      'apollo-require-preflight': 'true'
    };
    if (withBearer) {
      var token = getTokenPair();
      if (token) headers.Authorization = 'Bearer ' + token;
    }
    return headers;
  }

  function isAuthError(message) {
    return /unauthorized|not authenticated|forbidden|session/i.test(message || '');
  }

  function request(query, variables, withBearer) {
    return fetch(API_URL, {
      method: 'POST',
      credentials: 'include',
      headers: buildHeaders(withBearer),
      body: JSON.stringify({ query: query, variables: variables || {} })
    }).then(function (response) {
      if (response.status === 401 || response.status === 403) {
        var authError = new Error('unauthorized');
        authError.unauthorized = true;
        throw authError;
      }
      var contentType = response.headers.get('content-type') || '';
      if (contentType.indexOf('json') === -1) {
        var contentTypeError = new Error('unauthorized');
        contentTypeError.unauthorized = true;
        throw contentTypeError;
      }
      return response.json().then(function (json) {
        if (json.errors && json.errors.length) {
          var message = json.errors[0].message || 'GraphQL error';
          var error = new Error(message);
          if (isAuthError(message)) error.unauthorized = true;
          throw error;
        }
        return json.data;
      });
    });
  }

  function graphql(query, variables) {
    return request(query, variables, false).catch(function (error) {
      if (error.unauthorized && getTokenPair()) {
        return request(query, variables, true);
      }
      throw error;
    });
  }

  function fetchAll(root, query) {
    var all = [];
    var after = null;
    var page = 0;

    function next() {
      return graphql(query, { after: after }).then(function (data) {
        var connection = data && data[root];
        if (!connection) return all;
        (connection.edges || []).forEach(function (edge) {
          if (edge && edge.node) all.push(edge.node);
        });
        page += 1;
        if (connection.pageInfo && connection.pageInfo.hasNextPage && connection.pageInfo.endCursor && page < 100) {
          after = connection.pageInfo.endCursor;
          return next();
        }
        return all;
      });
    }

    return next();
  }

  function loadData(force) {
    if (!force && cache.data && Date.now() - cache.ts < POLL_MS) {
      return Promise.resolve(cache.data);
    }
    if (cache.promise) return cache.promise;

    cache.promise = Promise.all([
      fetchAll('people', PEOPLE_QUERY),
      fetchAll('communicationRecords', COMMS_QUERY)
    ])
      .then(function (results) {
        cache.data = { people: results[0], comms: results[1] };
        cache.ts = Date.now();
        cache.error = null;
        cache.unauthorized = false;
        return cache.data;
      })
      .catch(function (error) {
        cache.error = error;
        cache.unauthorized = !!error.unauthorized;
        throw error;
      })
      .then(
        function (data) {
          cache.promise = null;
          return data;
        },
        function (error) {
          cache.promise = null;
          throw error;
        }
      );

    return cache.promise;
  }

  function computeSummary(data, now) {
    var people = data.people || [];
    var comms = data.comms || [];
    var startToday = startOfDayShanghai(now);
    var endToday = new Date(startToday.getTime() + 86400000);
    var weekStart = startOfWeekShanghai(now);
    var staleCut = new Date(now.getTime() - 30 * 86400000);
    var neverCut = new Date(now.getTime() - 7 * 86400000);

    var overdue = 0;
    var today = 0;
    var future = 0;
    var stale = 0;
    var weekNew = 0;
    var noReminder = 0;
    var noOwner = 0;
    var noComms = 0;
    var commCustomerIds = {};

    comms.forEach(function (comm) {
      if (comm.customer && comm.customer.id) commCustomerIds[comm.customer.id] = true;
    });

    people.forEach(function (person) {
      if (!person.nextReminderAt) noReminder += 1;
      if (!person.developer) noOwner += 1;
      if (!commCustomerIds[person.id]) noComms += 1;
      var reminder = person.nextReminderAt ? new Date(person.nextReminderAt) : null;
      if (reminder && !person.reminderAcknowledged) {
        if (reminder.getTime() < now.getTime()) overdue += 1;
        else if (reminder.getTime() < endToday.getTime()) today += 1;
        else future += 1;
      }

      var lastContact = person.lastContactAt ? new Date(person.lastContactAt) : null;
      var createdAt = person.createdAt ? new Date(person.createdAt) : null;
      if (
        (lastContact && lastContact.getTime() < staleCut.getTime()) ||
        (!lastContact && createdAt && createdAt.getTime() < neverCut.getTime())
      ) {
        stale += 1;
      }

      if (createdAt && createdAt.getTime() >= weekStart.getTime()) weekNew += 1;
    });

    var weekComms = 0;
    comms.forEach(function (comm) {
      if (comm.communicatedAt && new Date(comm.communicatedAt).getTime() >= weekStart.getTime()) {
        weekComms += 1;
      }
    });

    return {
      total: people.length,
      weekNew: weekNew,
      overdue: overdue,
      today: today,
      future: future,
      due: overdue + today,
      pendingAll: overdue + today + future,
      weekComms: weekComms,
      stale: stale,
      noReminder: noReminder,
      noOwner: noOwner,
      noComms: noComms,
      startToday: startToday,
      endToday: endToday,
      weekStart: weekStart
    };
  }

  function findPendingAnchor() {
    var anchors = document.querySelectorAll('a[href]');
    var i;
    for (i = 0; i < anchors.length; i += 1) {
      var href = anchors[i].getAttribute('href') || '';
      if (href.indexOf('viewId=' + PENDING_VIEW_ID) !== -1) return anchors[i];
    }

    var items = document.querySelectorAll('.navigation-drawer-item');
    for (i = 0; i < items.length; i += 1) {
      var text = (items[i].textContent || '').replace(/\s+/g, '');
      if (text.indexOf('待提醒') !== -1) {
        return items[i].closest ? items[i].closest('a') || items[i] : items[i];
      }
    }
    return null;
  }

  function findBadge(anchor) {
    var badge = anchor.querySelector('.crm-due-badge');
    if (badge) return badge;
    var parent = anchor.parentElement;
    if (!parent) return null;
    for (var i = 0; i < parent.children.length; i += 1) {
      if (parent.children[i].classList && parent.children[i].classList.contains('crm-due-badge')) {
        return parent.children[i];
      }
    }
    return null;
  }

  function ensureBadge(anchor) {
    var badge = findBadge(anchor);
    if (badge) return badge;

    badge = el('span', 'crm-due-badge');
    var parent = anchor.parentElement;
    var parentStyle = parent ? window.getComputedStyle(parent) : null;
    var host =
      parentStyle &&
      parentStyle.display.indexOf('flex') !== -1 &&
      parentStyle.flexDirection === 'row'
        ? parent
        : anchor;
    host.appendChild(badge);
    return badge;
  }

  function buildCard() {
    var card = el('div', 'crm-insights-card');
    card.id = CARD_ID;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('title', '打开业务总览');

    var head = el('div', 'crm-insights-card-head');
    head.appendChild(el('span', 'crm-insights-card-title', '业务概览'));
    var time = el('span', 'crm-insights-card-time', '--:--');
    time.setAttribute('data-crm-time', '1');
    head.appendChild(time);
    card.appendChild(head);

    card.appendChild(cardRow('待处理', 'data-crm-due', 'crm-insights-num red'));
    card.appendChild(cardRow('逾期', 'data-crm-overdue', 'crm-insights-num red'));
    card.appendChild(cardRow('本周沟通', 'data-crm-week', 'crm-insights-num'));
    card.appendChild(cardRow('30天未联系', 'data-crm-stale', 'crm-insights-num orange'));

    var link = el('div', 'crm-insights-link', '查看完整总览 →');
    card.appendChild(link);

    card.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      openDashboard();
    });
    card.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDashboard();
      }
    });
    return card;
  }

  function cardRow(label, attr, valueClass) {
    var row = el('div', 'crm-insights-row');
    row.appendChild(el('span', 'crm-insights-row-label', label));
    var value = el('span', valueClass, '—');
    value.setAttribute(attr, '1');
    row.appendChild(value);
    return row;
  }

  function findNavColumn(anchor) {
    var node = anchor.parentElement;
    for (var i = 0; i < 7 && node; i += 1) {
      var style = window.getComputedStyle(node);
      if (
        style.display.indexOf('flex') !== -1 &&
        style.flexDirection === 'column' &&
        node.querySelectorAll('a[href*="/objects/people?viewId="]').length >= 1
      ) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function ensureCard(anchor) {
    var existing = document.getElementById(CARD_ID);
    if (existing) return existing;

    var card = buildCard();
    var navColumn = findNavColumn(anchor);
    if (navColumn) {
      navColumn.appendChild(card);
      return card;
    }

    var item = anchor.closest ? anchor.closest('.navigation-drawer-item') || anchor : anchor;
    var branch = item;
    while (branch.parentElement && branch.parentElement.children.length === 1) {
      branch = branch.parentElement;
    }
    if (branch.parentElement) {
      branch.parentElement.insertBefore(card, branch.nextSibling);
      return card;
    }
    return null;
  }

  function isCollapsed(anchor) {
    if (!anchor) return false;
    var rect = anchor.getBoundingClientRect();
    if (rect.width && rect.width < 72) return true;
    var label = anchor.querySelector('.navigation-drawer-item-label');
    return !!(label && label.offsetParent === null);
  }

  function applyBadge(anchor, summaryData) {
    if (!anchor) return;
    var badge = ensureBadge(anchor);
    var collapsed = isCollapsed(anchor);

    anchor.classList.remove('crm-due-alert', 'crm-due-today');

    if (!summaryData || cache.unauthorized) {
      if (badge.style.display !== 'none') badge.style.display = 'none';
      if (anchor.hasAttribute('title')) anchor.removeAttribute('title');
      if (badge.hasAttribute('title')) badge.removeAttribute('title');
      return;
    }

    if (summaryData.due > 0) {
      if (badge.style.display !== 'inline-flex') badge.style.display = 'inline-flex';
      badge.classList.toggle('crm-due-dot', collapsed);
      setText(badge, collapsed ? '' : summaryData.due > 99 ? '99+' : summaryData.due);
      anchor.classList.toggle('crm-due-alert', summaryData.overdue > 0);
      anchor.classList.toggle('crm-due-today', summaryData.overdue === 0 && summaryData.today > 0);
      var badgeTitle = '逾期 ' + summaryData.overdue + ' 条 · 今天 ' + summaryData.today + ' 条';
      if (anchor.getAttribute('title') !== badgeTitle) anchor.setAttribute('title', badgeTitle);
      if (badge.getAttribute('title') !== badgeTitle) badge.setAttribute('title', badgeTitle);
    } else {
      if (badge.style.display !== 'none') badge.style.display = 'none';
      if (anchor.hasAttribute('title')) anchor.removeAttribute('title');
      if (badge.hasAttribute('title')) badge.removeAttribute('title');
    }
  }

  function applyCard(card, summaryData) {
    if (!card) return;
    var time = card.querySelector('[data-crm-time]');
    var due = card.querySelector('[data-crm-due]');
    var overdue = card.querySelector('[data-crm-overdue]');
    var week = card.querySelector('[data-crm-week]');
    var stale = card.querySelector('[data-crm-stale]');

    if (!summaryData || cache.unauthorized) {
      setText(time, cache.unauthorized ? '登录后显示' : '--:--');
      [due, overdue, week, stale].forEach(function (node) {
        setText(node, '—');
      });
      return;
    }

    setText(time, fmtTime(new Date(cache.ts)));
    if (due) {
      setText(due, summaryData.due);
      due.classList.toggle('red', summaryData.due > 0);
    }
    if (overdue) {
      setText(overdue, summaryData.overdue);
      overdue.classList.toggle('red', summaryData.overdue > 0);
    }
    if (week) setText(week, summaryData.weekComms);
    if (stale) {
      setText(stale, summaryData.stale);
      stale.classList.toggle('orange', summaryData.stale > 0);
    }
  }

  function applyTitle(summaryData) {
    if (!document.title) return;
    var base = document.title.replace(/^\(\d+\)\s*/, '');
    if (!base) return;
    var nextTitle = summaryData && summaryData.due > 0 ? '(' + summaryData.due + ') ' + base : base;
    if (document.title !== nextTitle) document.title = nextTitle;
  }

  function applyAll() {
    pendingAnchor = findPendingAnchor();
    if (!pendingAnchor) return false;

    if (!started) {
      started = true;
      refresh(false).catch(function () {});
    }

    var card = ensureCard(pendingAnchor);
    var collapsed = isCollapsed(pendingAnchor);
    if (card) {
      var cardDisplay = collapsed ? 'none' : 'block';
      if (card.style.display !== cardDisplay) card.style.display = cardDisplay;
    }

    applyBadge(pendingAnchor, lastSummary);
    applyCard(card, lastSummary);
    applyTitle(lastSummary);
    return true;
  }

  function scheduleApply() {
    if (applyTimer) return;
    applyTimer = window.setTimeout(function () {
      applyTimer = null;
      applyAll();
    }, 300);
  }

  function scheduleMutationRefresh() {
    if (mutationTimer) window.clearTimeout(mutationTimer);
    mutationTimer = window.setTimeout(function () {
      mutationTimer = null;
      cache.ts = 0;
      refresh(true).catch(function () {});
    }, 1200);
  }

  function installMutationRefresh() {
    if (window.__crmInsightsFetchWrapped) return;
    window.__crmInsightsFetchWrapped = true;
    var originalFetch = window.fetch;
    if (typeof originalFetch !== 'function') return;
    window.fetch = function (input, init) {
      var promise = originalFetch.apply(this, arguments);
      try {
        var url = typeof input === 'string' ? input : input && input.url;
        var body = init && init.body;
        if (
          url &&
          url.indexOf('/graphql') !== -1 &&
          typeof body === 'string' &&
          body.indexOf('mutation') !== -1
        ) {
          promise.then(function () {
            scheduleMutationRefresh();
          }, function () {});
        }
      } catch (e) {
        // never break the app because of the observer
      }
      return promise;
    };
  }

  function refresh(force) {
    return loadData(force)
      .then(function (data) {
        lastSummary = computeSummary(data, new Date());
        applyAll();
        if (overlayOpen) renderDashboard(data);
        return lastSummary;
      })
      .catch(function (error) {
        if (error && error.unauthorized) lastSummary = null;
        applyAll();
        if (overlayOpen) renderDashboardError(error);
        throw error;
      });
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.crm-insights-card{box-sizing:border-box;margin:6px 8px 6px;padding:11px 12px;background:#151515;border:1px solid #303030;border-radius:10px;color:#d6d6d6;font-size:12px;line-height:1.5;cursor:pointer;transition:background .15s,border-color .15s;}',
      '.crm-insights-card:hover{background:#1c1c1c;border-color:#4a4a4a;}',
      '.crm-insights-card:focus-visible{outline:2px solid #3e63dd;outline-offset:2px;}',
      '.crm-insights-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;}',
      '.crm-insights-card-title{color:#f2f2f2;font-weight:600;font-size:12px;}',
      '.crm-insights-card-time{color:#6f6f6f;font-size:10px;font-variant-numeric:tabular-nums;}',
      '.crm-insights-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:2px 0;}',
      '.crm-insights-row-label{color:#9a9a9a;}',
      '.crm-insights-num{font-weight:600;color:#e6e6e6;font-variant-numeric:tabular-nums;}',
      '.crm-insights-num.red{color:#ff6b6b;}',
      '.crm-insights-num.orange{color:#f5a623;}',
      '.crm-insights-link{margin-top:6px;padding-top:7px;border-top:1px solid #272727;color:#7aa2ff;font-size:11px;}',
      'a.crm-due-alert .navigation-drawer-item-label,a.crm-due-alert .navigation-drawer-item-label *{color:#ff6b6b!important;}',
      'a.crm-due-alert svg{color:#ff6b6b!important;stroke:#ff6b6b!important;}',
      'a.crm-due-today .navigation-drawer-item-label,a.crm-due-today .navigation-drawer-item-label *{color:#f5a623!important;}',
      'a.crm-due-today svg{color:#f5a623!important;stroke:#f5a623!important;}',
      '.crm-due-badge{display:inline-flex;align-items:center;justify-content:center;flex:none;min-width:18px;height:18px;padding:0 5px;padding-left:6px;margin-left:auto;border-radius:9px;background:#e5484d;color:#fff;font-size:11px;font-weight:600;line-height:1;font-variant-numeric:tabular-nums;}',
      '.crm-due-badge.crm-due-dot{min-width:8px;width:8px;height:8px;padding:0;margin-left:4px;border-radius:50%;}',
      '#crm-insights-overlay{position:fixed;inset:0;z-index:2147483100;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.7);}',
      '.crm-insights-dialog{box-sizing:border-box;width:min(1240px,94vw);max-height:92vh;display:flex;flex-direction:column;overflow:hidden;background:#121212;color:#f2f2f2;border:1px solid #333;border-radius:16px;box-shadow:0 30px 90px rgba(0,0,0,.7);font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;}',
      '.crm-insights-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 22px;background:#151515;border-bottom:1px solid #2a2a2a;}',
      '.crm-insights-title{font-size:18px;font-weight:700;letter-spacing:.2px;}',
      '.crm-insights-sub{margin-top:4px;font-size:12px;color:#8a8a8a;}',
      '.crm-insights-actions{display:flex;align-items:center;gap:8px;flex:none;}',
      '.crm-insights-btn{display:inline-flex;align-items:center;justify-content:center;background:#1f1f1f;border:1px solid #3a3a3a;border-radius:8px;padding:6px 10px;color:#d6d6d6;font-size:12px;line-height:1.2;text-decoration:none;cursor:pointer;}',
      '.crm-insights-btn:hover{background:#2a2a2a;color:#fff;}',
      '.crm-insights-btn[disabled]{opacity:.55;cursor:default;}',
      '.crm-insights-close{background:transparent;border:0;color:#9a9a9a;font-size:28px;line-height:1;padding:0 4px;cursor:pointer;}',
      '.crm-insights-close:hover{color:#fff;}',
      '.crm-insights-body{padding:18px 22px 24px;overflow:auto;}',
      '.crm-insights-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:14px;}',
      '.crm-kpi{background:#171717;border:1px solid #2a2a2a;border-radius:12px;padding:14px;}',
      '.crm-kpi-label{font-size:12px;color:#8a8a8a;}',
      '.crm-kpi-value{margin-top:6px;font-size:26px;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums;}',
      '.crm-kpi-value.red{color:#ff6b6b;}',
      '.crm-kpi-value.orange{color:#f5a623;}',
      '.crm-kpi-sub{margin-top:6px;font-size:11px;color:#8a8a8a;}',
      '.crm-insights-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:start;}',
      '.crm-section{min-width:0;background:#171717;border:1px solid #2a2a2a;border-radius:12px;padding:16px;}',
      '.crm-section-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:14px;}',
      '.crm-section-title{font-size:14px;font-weight:600;}',
      '.crm-section-note{font-size:11px;color:#7e7e7e;text-align:right;}',
      '.crm-section-foot{margin-top:10px;padding-top:10px;border-top:1px solid #262626;font-size:11px;color:#8a8a8a;}',
      '.crm-bar-row{display:flex;align-items:center;gap:10px;margin:7px 0;font-size:12px;}',
      '.crm-bar-label{flex:none;width:82px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:#bfbfbf;}',
      '.crm-bar-track{flex:1;height:10px;overflow:hidden;background:#242424;border-radius:5px;}',
      '.crm-bar-fill{height:100%;min-width:2px;border-radius:5px;}',
      '.crm-bar-value{flex:none;width:76px;text-align:right;color:#9a9a9a;font-variant-numeric:tabular-nums;}',
      '.crm-table{width:100%;border-collapse:collapse;font-size:12px;}',
      '.crm-table th{padding:6px 4px;border-bottom:1px solid #2a2a2a;color:#8a8a8a;font-weight:500;text-align:right;white-space:nowrap;}',
      '.crm-table th:first-child,.crm-table td:first-child{text-align:left;}',
      '.crm-table td{padding:7px 4px;border-bottom:1px solid #222;text-align:right;color:#d6d6d6;font-variant-numeric:tabular-nums;}',
      '.crm-table tr:last-child td{border-bottom:0;}',
      '.crm-table td.red,.crm-table .red{color:#ff6b6b;}',
      '.crm-table tr.crm-table-total td{font-weight:600;color:#f2f2f2;border-top:1px solid #2a2a2a;}',
      '.crm-trend{display:flex;align-items:flex-end;gap:8px;height:190px;padding-top:8px;}',
      '.crm-trend-col{display:flex;flex:1;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;min-width:0;}',
      '.crm-trend-value{height:16px;font-size:11px;color:#9a9a9a;font-variant-numeric:tabular-nums;}',
      '.crm-trend-bar-wrap{display:flex;align-items:flex-end;width:100%;flex:1;}',
      '.crm-trend-bar{width:100%;max-width:42px;margin:0 auto;min-height:2px;border-radius:4px 4px 0 0;background:#3e63dd;}',
      '.crm-trend-bar.current{background:#6b8dff;}',
      '.crm-trend-label{margin-top:6px;font-size:10px;color:#7e7e7e;white-space:nowrap;}',
      '.crm-donut-wrap{display:flex;align-items:center;gap:18px;}',
      '.crm-donut{position:relative;flex:none;width:132px;height:132px;border-radius:50%;}',
      '.crm-donut::after{content:"";position:absolute;inset:22px;border-radius:50%;background:#171717;}',
      '.crm-donut-center{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;}',
      '.crm-donut-center b{font-size:22px;font-weight:700;}',
      '.crm-donut-center span{font-size:10px;color:#8a8a8a;}',
      '.crm-legend{flex:1;min-width:0;}',
      '.crm-legend-row{display:flex;align-items:center;gap:8px;padding:3px 0;font-size:12px;color:#c9c9c9;}',
      '.crm-dot{flex:none;width:8px;height:8px;border-radius:50%;}',
      '.crm-legend-name{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}',
      '.crm-legend-val{color:#8a8a8a;font-variant-numeric:tabular-nums;}',
      '.crm-attention{display:flex;flex-direction:column;}',
      '.crm-att-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #232323;}',
      '.crm-att-row:last-child{border-bottom:0;}',
      '.crm-att-main{flex:1;min-width:0;}',
      '.crm-att-name{font-size:13px;font-weight:600;color:#f2f2f2;text-decoration:none;}',
      '.crm-att-name:hover{text-decoration:underline;}',
      '.crm-att-meta{margin-top:2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:11px;color:#8a8a8a;}',
      '.crm-att-chip{flex:none;padding:3px 8px;border-radius:999px;font-size:11px;white-space:nowrap;}',
      '.crm-att-chip.red{background:rgba(229,72,77,.14);border:1px solid rgba(229,72,77,.35);color:#ff7b7f;}',
      '.crm-att-chip.orange{background:rgba(245,166,35,.12);border:1px solid rgba(245,166,35,.3);color:#f5b45a;}',
      '.crm-insights-loading,.crm-insights-empty{padding:64px 20px;text-align:center;color:#8a8a8a;font-size:13px;line-height:1.8;}',
      '.crm-insights-empty a{color:#7aa2ff;}',
      '@media (max-width:1180px){.crm-insights-kpis{grid-template-columns:repeat(3,minmax(0,1fr));}.crm-insights-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}@media (max-width:860px){.crm-insights-kpis{grid-template-columns:repeat(2,minmax(0,1fr));}.crm-insights-grid{grid-template-columns:1fr;}}'
    ].join('');
    document.head.appendChild(style);
  }

  function openDashboard() {
    ensureStyle();
    if (overlayOpen) return;
    var overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = buildOverlay();
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    overlayOpen = true;
    overlay.__previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onOverlayKeyDown, true);

    if (cache.data) {
      renderDashboard(cache.data);
      if (Date.now() - cache.ts >= POLL_MS) refresh(false).catch(function () {});
    } else {
      showLoading();
      refresh(false).catch(function (error) {
        renderDashboardError(error);
      });
    }
  }

  function closeDashboard() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.style.display = 'none';
    overlayOpen = false;
    document.body.style.overflow = (overlay && overlay.__previousBodyOverflow) || '';
    document.removeEventListener('keydown', onOverlayKeyDown, true);
  }

  function onOverlayKeyDown(event) {
    if (event.key === 'Escape') closeDashboard();
  }

  function buildOverlay() {
    var overlay = el('div');
    overlay.id = OVERLAY_ID;
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeDashboard();
    });

    var dialog = el('div', 'crm-insights-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', '业务总览');

    var head = el('div', 'crm-insights-head');
    var headMain = el('div');
    headMain.appendChild(el('div', 'crm-insights-title', '业务总览'));
    var sub = el('div', 'crm-insights-sub', '客户数据 · 更新于 --:-- · 北京时间');
    sub.id = 'crm-insights-updated';
    headMain.appendChild(sub);
    head.appendChild(headMain);

    var actions = el('div', 'crm-insights-actions');
    var refreshButton = el('button', 'crm-insights-btn', '刷新');
    refreshButton.type = 'button';
    refreshButton.id = 'crm-insights-refresh';
    refreshButton.addEventListener('click', function () {
      refreshDashboard();
    });
    actions.appendChild(refreshButton);

    var pendingLink = el('a', 'crm-insights-btn', '待提醒');
    pendingLink.href = PENDING_VIEW_URL;
    actions.appendChild(pendingLink);

    var closeButton = el('button', 'crm-insights-close', '×');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', '关闭');
    closeButton.addEventListener('click', closeDashboard);
    actions.appendChild(closeButton);

    head.appendChild(actions);
    dialog.appendChild(head);

    var body = el('div', 'crm-insights-body');
    body.id = 'crm-insights-body';
    dialog.appendChild(body);
    overlay.appendChild(dialog);
    return overlay;
  }

  function refreshDashboard() {
    if (overlayRefreshBusy) return;
    overlayRefreshBusy = true;
    var button = document.getElementById('crm-insights-refresh');
    if (button) {
      button.disabled = true;
      button.textContent = '刷新中…';
    }
    refresh(true)
      .catch(function () {})
      .then(function () {
        overlayRefreshBusy = false;
        if (button) {
          button.disabled = false;
          button.textContent = '刷新';
        }
      });
  }

  function showLoading() {
    var body = document.getElementById('crm-insights-body');
    if (!body) return;
    body.innerHTML = '';
    body.appendChild(el('div', 'crm-insights-loading', '正在加载业务数据…'));
  }

  function renderDashboardError(error) {
    var body = document.getElementById('crm-insights-body');
    if (!body || !overlayOpen) return;
    body.innerHTML = '';

    var empty = el('div', 'crm-insights-empty');
    if (error && error.unauthorized) {
      empty.appendChild(document.createTextNode('请先登录 CRM 后再查看业务总览。'));
      empty.appendChild(document.createElement('br'));
      var login = el('a', '', '返回 CRM 登录');
      login.href = '/';
      empty.appendChild(login);
    } else {
      empty.appendChild(document.createTextNode('加载失败，请稍后重试。'));
      empty.appendChild(document.createElement('br'));
      var retry = el('a', '', '重新加载');
      retry.href = '#';
      retry.addEventListener('click', function (event) {
        event.preventDefault();
        showLoading();
        refresh(true).catch(function (err) {
          renderDashboardError(err);
        });
      });
      empty.appendChild(retry);
    }
    body.appendChild(empty);
  }

  function renderDashboard(data) {
    if (!overlayOpen) return;
    var body = document.getElementById('crm-insights-body');
    if (!body) return;

    var now = new Date();
    var summaryData = computeSummary(data, now);
    var previousScrollTop = body.scrollTop;
    var updated = document.getElementById('crm-insights-updated');
    if (updated) {
      updated.textContent = '客户数据 · 更新于 ' + fmtTime(new Date(cache.ts)) + ' · 北京时间';
    }

    body.innerHTML = '';
    body.appendChild(renderKpis(summaryData, data));
    body.appendChild(
      renderGrid([
        renderStages(data.people, summaryData),
        renderOwners(data.people, data.comms, summaryData, now),
        renderSources(data.people)
      ])
    );
    body.appendChild(
      renderGrid([
        renderTrend(data.comms, summaryData.weekStart),
        renderRounds(data.people, data.comms),
        renderAttention(data.people, now, summaryData)
      ])
    );
    body.scrollTop = previousScrollTop;
  }

  function renderKpis(summaryData, data) {
    var grid = el('div', 'crm-insights-kpis');
    grid.appendChild(kpi('客户总数', summaryData.total, '本周新增 ' + summaryData.weekNew));
    grid.appendChild(
      kpi(
        '无下次提醒',
        summaryData.noReminder,
        '没有提醒 = 没人管',
        summaryData.noReminder > 0 ? 'orange' : ''
      )
    );
    var dueSub =
      '逾期 ' + summaryData.overdue + ' · 今天 ' + summaryData.today;
    if (summaryData.future > 0) dueSub += ' · 未来 ' + summaryData.future;
    grid.appendChild(kpi('待处理提醒', summaryData.due, dueSub, summaryData.due > 0 ? 'red' : ''));
    grid.appendChild(kpi('本周沟通', summaryData.weekComms, '沟通记录数'));
    grid.appendChild(
      kpi(
        '30天未联系',
        summaryData.stale,
        '最后沟通超 30 天 / 从未联系',
        summaryData.stale > 0 ? 'orange' : ''
      )
    );
    return grid;
  }

  function kpi(label, value, sub, tone) {
    var box = el('div', 'crm-kpi');
    box.appendChild(el('div', 'crm-kpi-label', label));
    box.appendChild(el('div', 'crm-kpi-value' + (tone ? ' ' + tone : ''), value));
    box.appendChild(el('div', 'crm-kpi-sub', sub));
    return box;
  }

  function renderGrid(sections) {
    var grid = el('div', 'crm-insights-grid');
    grid.style.marginBottom = '14px';
    sections.forEach(function (section) {
      grid.appendChild(section);
    });
    return grid;
  }

  function section(title, note) {
    var box = el('div', 'crm-section');
    var head = el('div', 'crm-section-head');
    head.appendChild(el('div', 'crm-section-title', title));
    if (note) head.appendChild(el('div', 'crm-section-note', note));
    box.appendChild(head);
    return box;
  }

  function renderStages(people, summaryData) {
    var box = section('阶段分布', '全部客户 · 按当前阶段');
    var counts = {};
    people.forEach(function (person) {
      var key = person.customerStatus || '__empty';
      counts[key] = (counts[key] || 0) + 1;
    });

    var rows = STAGE_ORDER.map(function (value) {
      return { value: value, label: labelOf('customerStatus', value), count: counts[value] || 0, color: colorOf('customerStatus', value) };
    });
    if (counts.__empty) {
      rows.push({ value: '__empty', label: '未设置', count: counts.__empty, color: '#6f6f6f' });
    }
    Object.keys(counts).forEach(function (value) {
      if (value === '__empty' || STAGE_ORDER.indexOf(value) !== -1) return;
      rows.push({ value: value, label: value, count: counts[value], color: '#6f6f6f' });
    });

    var max = 1;
    rows.forEach(function (row) {
      if (row.count > max) max = row.count;
    });

    rows.forEach(function (row) {
      var percent = summaryData.total ? Math.round((row.count / summaryData.total) * 100) : 0;
      box.appendChild(barRow(row.label, row.count, percent, (row.count / max) * 100, row.color));
    });

    var depositValues = ['BAO_ZHENG_JIN_JIAO_NA', 'DAI_PEI_XUN', 'DAI_ZHAO_SHENG', 'KAI_KE_ZHONG'];
    var deposit = depositValues.reduce(function (sum, value) {
      return sum + (counts[value] || 0);
    }, 0);
    var depositPercent = summaryData.total ? Math.round((deposit / summaryData.total) * 100) : 0;
    box.appendChild(
      el('div', 'crm-section-foot', '保证金缴纳及以后 ' + deposit + ' 人 · 占 ' + depositPercent + '%')
    );
    return box;
  }

  function barRow(label, count, percent, widthPercent, color) {
    var row = el('div', 'crm-bar-row');
    row.appendChild(el('div', 'crm-bar-label', label));
    var track = el('div', 'crm-bar-track');
    var fill = el('div', 'crm-bar-fill');
    var safeWidth = Math.max(0, Math.min(100, widthPercent));
    fill.style.width = safeWidth + '%';
    fill.style.background = color;
    if (safeWidth <= 0) fill.style.minWidth = '0';
    track.appendChild(fill);
    row.appendChild(track);
    row.appendChild(el('div', 'crm-bar-value', count + ' · ' + percent + '%'));
    return row;
  }

  function ownerKey(person) {
    return person.developer || '__none';
  }

  function renderOwners(people, comms, summaryData, now) {
    var box = section('负责人工作量', '客户归属 · 本周按周一算');
    var stats = {};
    var personById = {};

    OWNER_ORDER.concat(['__none']).forEach(function (key) {
      stats[key] = { total: 0, due: 0, overdue: 0, weekComms: 0, stale: 0 };
    });

    people.forEach(function (person) {
      personById[person.id] = person;
      var key = ownerKey(person);
      if (!stats[key]) {
        stats[key] = { total: 0, due: 0, overdue: 0, weekComms: 0, stale: 0 };
      }
      stats[key].total += 1;

      var reminder = person.nextReminderAt ? new Date(person.nextReminderAt) : null;
      if (reminder && !person.reminderAcknowledged) {
        if (reminder.getTime() < now.getTime()) {
          stats[key].overdue += 1;
          stats[key].due += 1;
        } else if (reminder.getTime() < summaryData.endToday.getTime()) {
          stats[key].due += 1;
        }
      }

      var lastContact = person.lastContactAt ? new Date(person.lastContactAt) : null;
      var createdAt = person.createdAt ? new Date(person.createdAt) : null;
      var staleCut = new Date(now.getTime() - 30 * 86400000);
      var neverCut = new Date(now.getTime() - 7 * 86400000);
      if (
        (lastContact && lastContact.getTime() < staleCut.getTime()) ||
        (!lastContact && createdAt && createdAt.getTime() < neverCut.getTime())
      ) {
        stats[key].stale += 1;
      }
    });

    comms.forEach(function (comm) {
      if (!comm.communicatedAt || new Date(comm.communicatedAt).getTime() < summaryData.weekStart.getTime()) {
        return;
      }
      var person = comm.customer ? personById[comm.customer.id] : null;
      var key = person ? ownerKey(person) : '__none';
      if (!stats[key]) {
        stats[key] = { total: 0, due: 0, overdue: 0, weekComms: 0, stale: 0 };
      }
      stats[key].weekComms += 1;
    });

    var table = el('table', 'crm-table');
    var thead = el('thead');
    var headRow = el('tr');
    ['负责人', '客户', '待处理', '逾期', '本周沟通', '30天未联系'].forEach(function (label) {
      headRow.appendChild(el('th', '', label));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = el('tbody');
    var order = OWNER_ORDER.concat(['__none']);
    Object.keys(stats).forEach(function (key) {
      if (order.indexOf(key) === -1) order.push(key);
    });

    var total = { total: 0, due: 0, overdue: 0, weekComms: 0, stale: 0 };
    order.forEach(function (key) {
      var rowStats = stats[key];
      if (!rowStats) return;
      total.total += rowStats.total;
      total.due += rowStats.due;
      total.overdue += rowStats.overdue;
      total.weekComms += rowStats.weekComms;
      total.stale += rowStats.stale;

      var row = el('tr');
      row.appendChild(el('td', '', key === '__none' ? '未分配' : labelOf('developer', key)));
      row.appendChild(el('td', '', rowStats.total));
      row.appendChild(el('td', rowStats.due > 0 ? 'red' : '', rowStats.due));
      row.appendChild(el('td', rowStats.overdue > 0 ? 'red' : '', rowStats.overdue));
      row.appendChild(el('td', '', rowStats.weekComms));
      row.appendChild(el('td', rowStats.stale > 0 ? 'red' : '', rowStats.stale));
      tbody.appendChild(row);
    });

    var totalRow = el('tr', 'crm-table-total');
    totalRow.appendChild(el('td', '', '合计'));
    totalRow.appendChild(el('td', '', total.total));
    totalRow.appendChild(el('td', '', total.due));
    totalRow.appendChild(el('td', '', total.overdue));
    totalRow.appendChild(el('td', '', total.weekComms));
    totalRow.appendChild(el('td', '', total.stale));
    tbody.appendChild(totalRow);
    table.appendChild(tbody);
    box.appendChild(table);
    return box;
  }

  function renderTrend(comms, weekStart) {
    var box = section('沟通趋势', '最近 8 周 · 周一为起点');
    var trend = el('div', 'crm-trend');
    var counts = [];

    for (var i = 7; i >= 0; i -= 1) {
      var start = new Date(weekStart.getTime() - i * 7 * 86400000);
      var end = new Date(start.getTime() + 7 * 86400000);
      var count = 0;
      comms.forEach(function (comm) {
        if (!comm.communicatedAt) return;
        var at = new Date(comm.communicatedAt).getTime();
        if (at >= start.getTime() && at < end.getTime()) count += 1;
      });
      counts.push({ start: start, count: count, current: i === 0 });
    }

    var max = 1;
    counts.forEach(function (item) {
      if (item.count > max) max = item.count;
    });

    counts.forEach(function (item) {
      var col = el('div', 'crm-trend-col');
      col.appendChild(el('div', 'crm-trend-value', item.count > 0 ? item.count : ''));
      var wrap = el('div', 'crm-trend-bar-wrap');
      var bar = el('div', 'crm-trend-bar' + (item.current ? ' current' : ''));
      bar.style.height = item.count > 0 ? Math.max(3, (item.count / max) * 100) + '%' : '0';
      if (item.count <= 0) bar.style.minHeight = '0';
      wrap.appendChild(bar);
      col.appendChild(wrap);
      col.appendChild(el('div', 'crm-trend-label', fmtMonthDay(item.start)));
      trend.appendChild(col);
    });

    box.appendChild(trend);
    return box;
  }

  function renderRounds(people, comms) {
    var box = section('轮次分布', '按每个客户的沟通记录数');
    var perCustomer = {};
    comms.forEach(function (comm) {
      if (!comm.customer || !comm.customer.id) return;
      perCustomer[comm.customer.id] = (perCustomer[comm.customer.id] || 0) + 1;
    });

    var buckets = [
      { label: '0 轮', count: 0, color: '#6f6f6f' },
      { label: '1 轮', count: 0, color: '#3e63dd' },
      { label: '2 轮', count: 0, color: '#12a594' },
      { label: '3–4 轮', count: 0, color: '#8e4ec6' },
      { label: '5 轮+', count: 0, color: '#f76b15' }
    ];

    people.forEach(function (person) {
      var count = perCustomer[person.id] || 0;
      if (count === 0) buckets[0].count += 1;
      else if (count === 1) buckets[1].count += 1;
      else if (count === 2) buckets[2].count += 1;
      else if (count <= 4) buckets[3].count += 1;
      else buckets[4].count += 1;
    });

    var total = people.length || 1;
    var max = 1;
    buckets.forEach(function (bucket) {
      if (bucket.count > max) max = bucket.count;
    });

    buckets.forEach(function (bucket) {
      box.appendChild(
        barRow(
          bucket.label,
          bucket.count,
          Math.round((bucket.count / total) * 100),
          (bucket.count / max) * 100,
          bucket.color
        )
      );
    });
    return box;
  }

  function renderSources(people) {
    var box = section('来源渠道', '按客户来源');
    var counts = {};
    people.forEach(function (person) {
      var key = person.sourceChannel || '__empty';
      counts[key] = (counts[key] || 0) + 1;
    });

    var rows = Object.keys(counts)
      .map(function (value) {
        return {
          value: value,
          label: value === '__empty' ? '未填写' : labelOf('sourceChannel', value),
          count: counts[value],
          color: value === '__empty' ? '#5a5a5a' : colorOf('sourceChannel', value)
        };
      })
      .sort(function (a, b) {
        return b.count - a.count;
      });

    var total = people.length;
    var wrap = el('div', 'crm-donut-wrap');
    var donut = el('div', 'crm-donut');

    if (!total) {
      donut.style.background = '#242424';
    } else {
      var stops = [];
      var cursor = 0;
      rows.forEach(function (row) {
        var start = cursor;
        var end = cursor + (row.count / total) * 360;
        stops.push(row.color + ' ' + start + 'deg ' + end + 'deg');
        cursor = end;
      });
      donut.style.background = 'conic-gradient(' + stops.join(',') + ')';
    }

    var center = el('div', 'crm-donut-center');
    center.appendChild(el('b', '', total));
    center.appendChild(el('span', '', '客户'));
    donut.appendChild(center);
    wrap.appendChild(donut);

    var legend = el('div', 'crm-legend');
    if (!rows.length) {
      legend.appendChild(el('div', 'crm-section-foot', '暂无来源数据'));
    } else {
      rows.forEach(function (row) {
        var line = el('div', 'crm-legend-row');
        var dot = el('span', 'crm-dot');
        dot.style.background = row.color;
        line.appendChild(dot);
        line.appendChild(el('span', 'crm-legend-name', row.label));
        line.appendChild(
          el('span', 'crm-legend-val', row.count + ' · ' + Math.round((row.count / total) * 100) + '%')
        );
        legend.appendChild(line);
      });
    }
    wrap.appendChild(legend);
    box.appendChild(wrap);
    return box;
  }

  function renderAttention(people, now, summaryData) {
    var box = section('今日与关注', '逾期 → 今天 → 30 天未联系');
    var items = [];
    var staleCut = new Date(now.getTime() - 30 * 86400000);
    var neverCut = new Date(now.getTime() - 7 * 86400000);
    var endToday = summaryData
      ? summaryData.endToday
      : new Date(startOfDayShanghai(now).getTime() + 86400000);

    people.forEach(function (person) {
      var reminder = person.nextReminderAt ? new Date(person.nextReminderAt) : null;
      if (reminder && !person.reminderAcknowledged) {
        if (reminder.getTime() < now.getTime()) {
          items.push({
            person: person,
            type: 'overdue',
            severity: now.getTime() - reminder.getTime(),
            reminder: reminder
          });
          return;
        }
        if (reminder.getTime() < endToday.getTime()) {
          items.push({
            person: person,
            type: 'today',
            severity: reminder.getTime() - now.getTime(),
            reminder: reminder
          });
          return;
        }
      }

      var lastContact = person.lastContactAt ? new Date(person.lastContactAt) : null;
      var createdAt = person.createdAt ? new Date(person.createdAt) : null;
      if (
        (lastContact && lastContact.getTime() < staleCut.getTime()) ||
        (!lastContact && createdAt && createdAt.getTime() < neverCut.getTime())
      ) {
        items.push({
          person: person,
          type: 'stale',
          severity: now.getTime() - (lastContact || createdAt).getTime(),
          lastContact: lastContact
        });
      }
    });

    var typeOrder = { overdue: 0, today: 1, stale: 2 };
    items.sort(function (a, b) {
      if (a.type !== b.type) return typeOrder[a.type] - typeOrder[b.type];
      if (a.type === 'today') return a.severity - b.severity;
      return b.severity - a.severity;
    });

    var visible = items.slice(0, 5);
    if (!visible.length) {
      box.appendChild(el('div', 'crm-insights-empty', '今天没有待处理提醒'));
      return box;
    }

    var list = el('div', 'crm-attention');
    visible.forEach(function (item) {
      var person = item.person;
      var row = el('div', 'crm-att-row');
      var main = el('div', 'crm-att-main');

      var displayName = person.name
        ? ((person.name.firstName || '') + (person.name.lastName || '')).trim()
        : '';
      var name = el('a', 'crm-att-name', displayName || '未命名客户');
      name.href = '/object/person/' + person.id;
      main.appendChild(name);

      var metaText =
        labelOf('developer', person.developer, '未分配') +
        ' · ' +
        labelOf('customerStatus', person.customerStatus, '未设置');
      if (item.type === 'overdue' || item.type === 'today') {
        if (item.type === 'overdue') metaText += ' · 提醒 ' + fmtDateTime(item.reminder);
        if (person.reminderText) metaText += ' · ' + person.reminderText;
      } else if (item.lastContact) {
        metaText += ' · 最后沟通 ' + fmtDate(item.lastContact);
      } else {
        metaText += ' · 从未沟通';
      }
      var meta = el('div', 'crm-att-meta', metaText);
      meta.title = metaText;
      main.appendChild(meta);
      row.appendChild(main);

      var chip;
      if (item.type === 'overdue') {
        chip = el('span', 'crm-att-chip red', '逾期 ' + humanDuration(item.severity));
      } else if (item.type === 'today') {
        chip = el('span', 'crm-att-chip orange', '今天 ' + fmtTime(item.reminder));
      } else {
        chip = el(
          'span',
          'crm-att-chip orange',
          daysSince(item.lastContact || new Date(person.createdAt)) + ' 天未联系'
        );
      }
      row.appendChild(chip);
      list.appendChild(row);
    });

    box.appendChild(list);
    if (items.length > visible.length) {
      var more = el('a', 'crm-section-foot', '还有 ' + (items.length - visible.length) + ' 条，去待提醒查看 →');
      more.href = PENDING_VIEW_URL;
      box.appendChild(more);
    }
    return box;
  }

  function init() {
    ensureStyle();
    installMutationRefresh();
    var observer = new MutationObserver(function () {
      scheduleApply();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', scheduleApply);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && started) refresh(false).catch(function () {});
    });

    function boot() {
      if (started) return;
      pendingAnchor = findPendingAnchor();
      if (!pendingAnchor) return;
      started = true;
      applyAll();
      refresh(false).catch(function () {});
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }

    setInterval(function () {
      if (!document.hidden && started) refresh(false).catch(function () {});
    }, POLL_MS);

    window.crmInsights = {
      open: openDashboard,
      close: closeDashboard,
      refresh: function () {
        return refresh(true);
      },
      summary: function () {
        return cache.data ? computeSummary(cache.data, new Date()) : null;
      }
    };
  }

  init();
})();
