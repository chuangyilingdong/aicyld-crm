(function () {
  'use strict';

  if (window.__crmInsightsLoaded) return;
  window.__crmInsightsLoaded = true;

  var PENDING_VIEW_ID = '309e9f72-29b4-4419-8b20-8e08d7e93056';
  var PENDING_VIEW_URL = '/objects/people?viewId=' + PENDING_VIEW_ID;
  var API_URL = '/graphql';
  var META_URL = '/metadata';
  var META_QUERY =
    'query CrmInsightsMeta {' +
    '  objects(paging: { first: 200 }) {' +
    '    edges { node {' +
    '      nameSingular' +
    '      fields(paging: { first: 200 }) { edges { node { name label type options } } }' +
    '    } }' +
    '  }' +
    '}';

  var COLOR_HEX = {
    red: '#e5484d',
    blue: '#3e63dd',
    green: '#30a46c',
    gray: '#8a8a8a',
    ruby: '#e54666',
    crimson: '#e93d82',
    tomato: '#f76b15',
    turquoise: '#12a594',
    purple: '#8e4ec6',
    orange: '#f76b15',
    sky: '#3e9dd8',
    yellow: '#f5a623',
    pink: '#e93d82',
    violet: '#8e4ec6'
  };
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
    },
    communicator: {
      STAFF_A: '刘羽驰',
      STAFF_B: '影子 11',
      STAFF_C: '张镇峰',
      STAFF_D: '员工D'
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
    },
    communicator: {
      STAFF_A: '#3e63dd',
      STAFF_B: '#30a46c',
      STAFF_C: '#8e4ec6',
      STAFF_D: '#f76b15'
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
    metaPromise: null,
    metaLoaded: false,
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
  var NOTIFY_KEY = 'crm-insights-notified-v1';
  var notified = loadNotified();
  var notifySupported = typeof window.Notification !== 'undefined';
  var ownerFilter = null;
  var panelView = 'dashboard';
  var commsOpen = false;
  var commsOwnerFilter = null;
  var commsSearch = '';
  var commsOnlyWith = false;
  var commsCache = { data: null, ts: 0, promise: null, unauthorized: false };
  var COMMS_ROUND_COLORS = ['#3e63dd', '#8e4ec6', '#12a594', '#f76b15', '#e5484d', '#3e9dd8', '#30a46c', '#e93d82'];

  var PEOPLE_QUERY =
    'query CrmInsightsPeople($after: String) {' +
    '  people(first: 100, after: $after) {' +
    '    pageInfo { hasNextPage endCursor }' +
    '    edges { node {' +
    '      id name { firstName lastName } createdAt developer customerStatus sourceChannel' +
    '      nextReminderAt reminderAcknowledged lastContactAt reminderText wechatId' +
    '      phones { primaryPhoneNumber primaryPhoneCallingCode primaryPhoneCountryCode }' +
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

  var COMMS_PEOPLE_QUERY =
    'query CrmCommsPeople($after: String) {' +
    '  people(first: 100, after: $after) {' +
    '    pageInfo { hasNextPage endCursor }' +
    '    edges { node { id name { firstName lastName } developer customerStatus lastContactAt } }' +
    '  }' +
    '}';

  var COMMS_RECORDS_QUERY =
    'query CrmCommsRecords($after: String) {' +
    '  communicationRecords(first: 100, after: $after) {' +
    '    pageInfo { hasNextPage endCursor }' +
    '    edges { node { id name round communicatedAt communicator content { markdown } customer { id } isImportant } }' +
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

  function request(url, query, variables, withBearer) {
    return fetch(url, {
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

  function requestWithAuth(url, query, variables) {
    return request(url, query, variables, false).catch(function (error) {
      if (error.unauthorized && getTokenPair()) {
        return request(url, query, variables, true);
      }
      throw error;
    });
  }

  function graphql(query, variables) {
    return requestWithAuth(API_URL, query, variables);
  }

  function metadataGraphql(query) {
    return requestWithAuth(META_URL, query, {});
  }

  function readFieldMap(objectNode) {
    var map = {};
    if (!objectNode || !objectNode.fields || !objectNode.fields.edges) return map;
    objectNode.fields.edges.forEach(function (edge) {
      if (edge && edge.node && edge.node.name) map[edge.node.name] = edge.node;
    });
    return map;
  }

  function applySelectField(field, name) {
    if (!field) return;
    var options = field.options;
    if (typeof options === 'string') {
      try { options = JSON.parse(options); } catch (e) { options = null; }
    }
    if (!Array.isArray(options)) return;

    options = options.slice().sort(function (a, b) {
      return Number(a.position || 0) - Number(b.position || 0);
    });

    var labels = {};
    var colors = {};
    var order = [];
    options.forEach(function (option) {
      if (!option || !option.value) return;
      labels[option.value] = option.label || option.value;
      colors[option.value] = COLOR_HEX[option.color] || '#6f6f6f';
      order.push(option.value);
    });

    if (!order.length) return;
    LABELS[name] = labels;
    COLORS[name] = colors;
    if (name === 'customerStatus') STAGE_ORDER = order;
    if (name === 'developer') OWNER_ORDER = order;
  }

  function applyMetadata(data) {
    var objects = data && data.objects && data.objects.edges;
    if (!objects) return;

    var person = null;
    var commRecord = null;
    objects.forEach(function (edge) {
      if (!edge || !edge.node) return;
      if (edge.node.nameSingular === 'person') person = edge.node;
      if (edge.node.nameSingular === 'communicationRecord') commRecord = edge.node;
    });

    if (person) {
      var personFields = readFieldMap(person);
      applySelectField(personFields.developer, 'developer');
      applySelectField(personFields.customerStatus, 'customerStatus');
      applySelectField(personFields.sourceChannel, 'sourceChannel');
    }

    if (commRecord) {
      var commFields = readFieldMap(commRecord);
      applySelectField(commFields.communicator, 'communicator');
    }

    cache.metaLoaded = true;
  }

  function fetchMetadata() {
    if (cache.metaLoaded) return Promise.resolve();
    if (cache.metaPromise) return cache.metaPromise;

    cache.metaPromise = metadataGraphql(META_QUERY)
      .then(function (data) {
        applyMetadata(data);
        cache.metaPromise = null;
      })
      .catch(function () {
        cache.metaPromise = null;
      });
    return cache.metaPromise;
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
      fetchAll('communicationRecords', COMMS_QUERY),
      fetchMetadata()
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
    var overdue3 = 0;
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
        if (reminder.getTime() < now.getTime()) {
          overdue += 1;
          if (now.getTime() - reminder.getTime() > 3 * 86400000) overdue3 += 1;
        } else if (reminder.getTime() < endToday.getTime()) today += 1;
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
      overdue3: overdue3,
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

  function ensureCommsNav(navColumn, card) {
    if (!navColumn) return;
    var existing = document.getElementById('crm-comms-nav');
    if (existing) {
      if (card && card.parentNode === navColumn && existing.parentNode === navColumn && existing.nextSibling !== card) {
        navColumn.insertBefore(existing, card);
      }
      return;
    }

    var link = document.createElement('a');
    link.id = 'crm-comms-nav';
    link.className = 'navigation-drawer-item crm-comms-nav';
    link.href = '#';
    link.title = '所有机构的沟通记录';
    link.style.cssText =
      'display:flex;align-items:center;gap:8px;height:28px;padding:0 10px;margin:2px 8px;border-radius:8px;color:#d6d6d6;text-decoration:none;font-size:13px;';
    link.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16M15 4v16"/></svg>' +
      '<span class="navigation-drawer-item-label">沟通总览</span>';
    link.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      openCommsOverview();
    });

    if (card && card.parentNode === navColumn) navColumn.insertBefore(link, card);
    else navColumn.appendChild(link);
  }

  function updateCommsNavLayout(collapsed) {
    var link = document.getElementById('crm-comms-nav');
    if (!link) return;
    var label = link.querySelector('.navigation-drawer-item-label');
    if (label) label.style.display = collapsed ? 'none' : '';
    link.style.width = collapsed ? '28px' : '';
    link.style.padding = collapsed ? '0' : '0 10px';
    link.style.margin = collapsed ? '2px auto' : '2px 8px';
    link.style.justifyContent = collapsed ? 'center' : '';
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
      ensureCommsNav(navColumn, card);
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
      var badgeTitle =
        '逾期 ' + summaryData.overdue + ' 条' +
        (summaryData.overdue3 > 0 ? '（超3天 ' + summaryData.overdue3 + '）' : '') +
        ' · 今天 ' + summaryData.today + ' 条';
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
    if (card && card.parentElement) ensureCommsNav(card.parentElement, card);
    updateCommsNavLayout(collapsed);
    if (card) {
      var cardDisplay = collapsed ? 'none' : 'block';
      if (card.style.display !== cardDisplay) card.style.display = cardDisplay;
    }

    applyBadge(pendingAnchor, lastSummary);
    applyCard(card, lastSummary);
    applyTitle(lastSummary);
    updateNotifyBell();
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
        checkNotifications(data);
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
      '.crm-insights-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex:none;flex-wrap:wrap;}',
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
      '.crm-legend-deposit{flex:none;padding:1px 5px;border-radius:6px;background:rgba(48,164,108,.14);border:1px solid rgba(48,164,108,.35);color:#7bd4a8;font-size:10px;line-height:1.5;}',
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
      '.crm-att-chip.critical{background:rgba(229,72,77,.3);border-color:#ff7b7f;color:#ffd1d2;}',
      '.crm-att-done{flex:none;margin-left:6px;padding:4px 9px;border:1px solid #3a3a3a;border-radius:7px;background:#202020;color:#d6d6d6;font-size:11px;line-height:1.2;cursor:pointer;}',
      '.crm-att-done:hover{background:#2a2a2a;color:#fff;}',
      '.crm-att-done[disabled]{opacity:.55;cursor:default;}',
      '.crm-insights-toast{position:fixed;left:50%;bottom:28px;z-index:2147483200;transform:translate(-50%,12px);padding:9px 14px;border-radius:9px;background:#242424;border:1px solid #3a3a3a;color:#f2f2f2;font-size:12px;box-shadow:0 10px 30px rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:opacity .18s,transform .18s;}',
      '.crm-insights-toast.show{opacity:1;transform:translate(-50%,0);}',
      '.crm-notify-bell{position:fixed;right:20px;bottom:76px;z-index:2147482000;display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;border:1px solid #3a3a3a;background:#1f1f1f;color:#e6e6e6;font-size:12px;line-height:1.2;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.4);}',
      '.crm-notify-bell:hover{background:#2a2a2a;color:#fff;}',
      '.crm-notify-banner{display:flex;align-items:center;gap:10px;padding:8px 12px;margin-bottom:10px;border-radius:9px;font-size:12px;line-height:1.45;}',
      '.crm-notify-banner.default{background:rgba(62,99,221,.12);border:1px solid rgba(62,99,221,.35);color:#c7d5ff;}',
      '.crm-notify-banner.denied{background:rgba(229,72,77,.12);border:1px solid rgba(229,72,77,.35);color:#ffc2c4;}',
      '.crm-notify-banner-text{flex:1;min-width:0;}',
      '.crm-notify-banner .crm-insights-btn{flex:none;}',
      '.crm-insights-filters{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;}',
      '.crm-filter-chip{padding:4px 9px;border:1px solid #333;border-radius:999px;background:#171717;color:#a8a8a8;font-size:11px;line-height:1.3;cursor:pointer;}',
      '.crm-filter-chip:hover{color:#fff;border-color:#555;}',
      '.crm-filter-chip.active{background:#2a3b66;border-color:#3e63dd;color:#dbe4ff;}',
      '.crm-kpi-clickable{cursor:pointer;}',
      '.crm-kpi-clickable:hover{background:#1b1b1b;border-color:#4a4a4a;}',
      '.crm-owner-active td{background:rgba(62,99,221,.12);}',
      '.crm-drill-head{display:flex;align-items:center;gap:12px;margin-bottom:12px;}',
      '.crm-drill-title{font-size:15px;font-weight:600;}',
      '.crm-drill-list{display:flex;flex-direction:column;}',
      '.crm-drill-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #232323;}',
      '.crm-drill-row:last-child{border-bottom:0;}',
      '.crm-drill-main{flex:1;min-width:0;}',
      '.crm-insights-loading,.crm-insights-empty{padding:64px 20px;text-align:center;color:#8a8a8a;font-size:13px;line-height:1.8;}',
      '.crm-insights-empty a{color:#7aa2ff;}',
      '.crm-comms-nav:hover{background:#1c1c1c;color:#fff;}',
      '#crm-comms-overlay{position:fixed;inset:0;z-index:2147483200;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.72);}',
      '.crm-comms-dialog{box-sizing:border-box;width:min(1460px,97vw);height:92vh;display:flex;flex-direction:column;overflow:hidden;background:#0f0f0f;color:#f2f2f2;border:1px solid #333;border-radius:16px;box-shadow:0 30px 90px rgba(0,0,0,.7);font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;}',
      '.crm-comms-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 22px;background:#151515;border-bottom:1px solid #2a2a2a;flex:none;}',
      '.crm-comms-title{font-size:18px;font-weight:700;letter-spacing:.2px;}',
      '.crm-comms-sub{margin-top:4px;font-size:12px;color:#8a8a8a;}',
      '.crm-comms-actions{display:flex;align-items:center;gap:8px;flex:none;flex-wrap:wrap;justify-content:flex-end;}',
      '.crm-comms-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 22px;background:#121212;border-bottom:1px solid #242424;flex:none;}',
      '.crm-comms-search{box-sizing:border-box;width:260px;max-width:100%;padding:7px 10px;border:1px solid #333;border-radius:8px;background:#171717;color:#f2f2f2;font-size:12px;outline:none;}',
      '.crm-comms-search:focus{border-color:#3e63dd;}',
      '.crm-comms-owners{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}',
      '.crm-comms-toggle{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#a8a8a8;cursor:pointer;user-select:none;}',
      '.crm-comms-count{margin-left:auto;font-size:11px;color:#7e7e7e;white-space:nowrap;}',
      '.crm-comms-table-wrap{flex:1;overflow:auto;position:relative;background:#0f0f0f;}',
      '.crm-comms-table{border-collapse:separate;border-spacing:0;table-layout:fixed;width:max-content;min-width:100%;font-size:12px;}',
      '.crm-comms-table th,.crm-comms-table td{box-sizing:border-box;vertical-align:top;}',
      '.crm-comms-table thead th{position:sticky;top:0;z-index:3;padding:10px 12px;background:#171717;border-bottom:1px solid #2f2f2f;border-left:1px solid #242424;text-align:left;font-weight:500;}',
      '.crm-comms-table thead th.crm-comms-customer-head{left:0;z-index:4;width:230px;min-width:230px;max-width:230px;border-left:0;border-right:1px solid #2f2f2f;}',
      '.crm-comms-round-head{width:240px;min-width:240px;max-width:240px;}',
      '.crm-comms-round-title{font-size:13px;font-weight:600;color:#f2f2f2;}',
      '.crm-comms-round-sub{margin-top:3px;font-size:10px;color:#7e7e7e;}',
      '.crm-comms-round-dot{display:inline-block;width:6px;height:6px;margin-right:6px;border-radius:50%;vertical-align:1px;}',
      '.crm-comms-row td{padding:10px 12px;border-bottom:1px solid #222;border-left:1px solid #1e1e1e;}',
      '.crm-comms-row:hover td{background:#171717;}',
      '.crm-comms-customer{position:sticky;left:0;z-index:2;width:230px;min-width:230px;max-width:230px;background:#0f0f0f;border-left:0!important;border-right:1px solid #2f2f2f;}',
      '.crm-comms-row:hover .crm-comms-customer{background:#171717;}',
      '.crm-comms-name-row{display:flex;align-items:center;gap:8px;min-width:0;}',
      '.crm-comms-avatar{flex:none;display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#24324f;color:#bcd0ff;font-size:11px;font-weight:600;}',
      '.crm-comms-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f2f2f2;font-size:13px;font-weight:600;text-decoration:none;}',
      '.crm-comms-name:hover{text-decoration:underline;}',
      '.crm-comms-meta{margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#8a8a8a;}',
      '.crm-comms-stage{display:inline-block;padding:1px 6px;border:1px solid #333;border-radius:5px;font-size:10px;line-height:1.5;}',
      '.crm-comms-last{margin-top:3px;font-size:10px;color:#6f6f6f;}',
      '.crm-comms-cell{width:240px;min-width:240px;max-width:240px;position:relative;cursor:pointer;}',
      '.crm-comms-cell:hover{background:#1a1a1a!important;}',
      '.crm-comms-cell.latest{box-shadow:inset 2px 0 0 #5b8cff;}',
      '.crm-comms-cell-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:11px;color:#8a8a8a;}',
      '.crm-comms-cell-date{color:#cfcfcf;font-variant-numeric:tabular-nums;}',
      '.crm-comms-cell-person{display:inline-flex;align-items:center;gap:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.crm-comms-person-dot{flex:none;width:6px;height:6px;border-radius:50%;}',
      '.crm-comms-cell-text{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:12px;line-height:1.65;color:#cfcfcf;word-break:break-word;}',
      '.crm-comms-cell-empty{color:#3f3f3f;text-align:center;padding-top:22px;font-size:16px;}',
      '.crm-comms-cell-add{cursor:pointer;}',
      '.crm-comms-cell-add .crm-comms-cell-empty{transition:color .15s;}',
      '.crm-comms-cell-add:hover .crm-comms-cell-empty{color:#7aa2ff;}',
      '.crm-comms-top-left{display:inline-flex;align-items:center;gap:5px;min-width:0;}',
      '.crm-comms-star{color:#f5a623;font-size:11px;line-height:1;flex:none;}',
      '.crm-comms-cell.important{background:rgba(245,166,35,.10)!important;box-shadow:inset 0 0 0 1px rgba(245,166,35,.45);}',
      '.crm-comms-cell.important:hover{background:rgba(245,166,35,.17)!important;}',
      '.crm-comms-cell.latest.important{box-shadow:inset 2px 0 0 #5b8cff, inset 0 0 0 1px rgba(245,166,35,.45);}',
      '.crm-comms-detail-star{color:#f5a623;}',
      '.crm-comms-legend{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#8a8a8a;white-space:nowrap;}',
      '.crm-comms-add-important{display:flex;align-items:center;gap:7px;margin:0 0 12px;font-size:12px;color:#f5c06a;cursor:pointer;user-select:none;}',
      '.crm-comms-add-important input{accent-color:#f5a623;}',
      '.crm-comms-cell-hover{position:absolute;right:10px;bottom:8px;font-size:10px;color:#7aa2ff;opacity:0;transition:opacity .15s;}',
      '.crm-comms-cell:hover .crm-comms-cell-hover{opacity:1;}',
      '.crm-comms-dupe{position:absolute;right:10px;top:9px;padding:0 4px;border-radius:5px;background:#2a2a2a;color:#9a9a9a;font-size:10px;}',
      '.crm-comms-empty{padding:60px 20px;text-align:center;color:#8a8a8a;font-size:13px;line-height:1.8;}',
      '#crm-comms-detail-overlay{position:fixed;inset:0;z-index:2147483300;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.62);}',
      '.crm-comms-detail{box-sizing:border-box;width:min(760px,92vw);max-height:84vh;display:flex;flex-direction:column;overflow:hidden;background:#151515;border:1px solid #333;border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,.65);font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;}',
      '.crm-comms-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 20px;border-bottom:1px solid #2a2a2a;}',
      '.crm-comms-detail-title{font-size:16px;font-weight:600;}',
      '.crm-comms-detail-sub{margin-top:4px;font-size:12px;color:#8a8a8a;}',
      '.crm-comms-detail-body{padding:18px 20px;overflow:auto;white-space:pre-wrap;font-size:14px;line-height:1.8;color:#d6d6d6;word-break:break-word;}',
      '.crm-comms-detail-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid #2a2a2a;}',
      '#crm-comms-add-overlay{position:fixed;inset:0;z-index:2147483300;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.62);}',
      '.crm-comms-add{box-sizing:border-box;width:min(560px,92vw);max-height:88vh;display:flex;flex-direction:column;overflow:hidden;background:#151515;border:1px solid #333;border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,.65);font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;}',
      '.crm-comms-add-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 20px;border-bottom:1px solid #2a2a2a;}',
      '.crm-comms-add-title{font-size:16px;font-weight:600;}',
      '.crm-comms-add-sub{margin-top:4px;font-size:12px;color:#8a8a8a;}',
      '.crm-comms-add-body{padding:16px 20px;overflow:auto;}',
      '.crm-comms-add-row{display:flex;gap:12px;}',
      '.crm-comms-add-field{flex:1;min-width:0;margin-bottom:12px;}',
      '.crm-comms-add-field label{display:block;margin-bottom:5px;font-size:11px;color:#8a8a8a;}',
      '.crm-comms-add-field input,.crm-comms-add-field select,.crm-comms-add-field textarea{box-sizing:border-box;width:100%;padding:8px 10px;border:1px solid #333;border-radius:8px;background:#1b1b1b;color:#f2f2f2;font-size:13px;outline:none;}',
      '.crm-comms-add-field input:focus,.crm-comms-add-field select:focus,.crm-comms-add-field textarea:focus{border-color:#3e63dd;}',
      '.crm-comms-add-field textarea{min-height:150px;resize:vertical;line-height:1.6;}',
      '.crm-comms-add-note{font-size:11px;color:#7e7e7e;line-height:1.5;}',
      '.crm-comms-add-error{display:none;margin-top:10px;padding:7px 9px;border-radius:7px;background:rgba(229,72,77,.12);border:1px solid rgba(229,72,77,.35);color:#ffb3b5;font-size:12px;}',
      '.crm-comms-add-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid #2a2a2a;}',
      '.crm-add-primary{background:#3e63dd!important;border-color:#3e63dd!important;color:#fff!important;}',
      '.crm-add-primary:hover{background:#4f74e8!important;}',
      '.crm-add-primary[disabled]{opacity:.6;cursor:default;}',
      '@media (max-width:900px){.crm-comms-dialog{width:97vw;height:94vh;}.crm-comms-search{width:100%;}.crm-comms-count{margin-left:0;}}',
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
    updateNotifyButton();
    panelView = 'dashboard';

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
    var notifyButton = el('button', 'crm-insights-btn', '开启桌面提醒');
    notifyButton.type = 'button';
    notifyButton.id = 'crm-insights-notify';
    notifyButton.addEventListener('click', function () {
      requestNotifications();
    });
    actions.appendChild(notifyButton);

    var refreshButton = el('button', 'crm-insights-btn', '刷新');
    refreshButton.type = 'button';
    refreshButton.id = 'crm-insights-refresh';
    refreshButton.addEventListener('click', function () {
      refreshDashboard();
    });
    actions.appendChild(refreshButton);

    var exportButton = el('button', 'crm-insights-btn', '导出');
    exportButton.type = 'button';
    exportButton.id = 'crm-insights-export';
    exportButton.title = '导出当前筛选客户为 CSV';
    exportButton.addEventListener('click', exportCsv);
    actions.appendChild(exportButton);

    var reportButton = el('button', 'crm-insights-btn', '周报');
    reportButton.type = 'button';
    reportButton.id = 'crm-insights-report';
    reportButton.title = '复制本周周报到剪贴板';
    reportButton.addEventListener('click', copyWeeklyReport);
    actions.appendChild(reportButton);

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

  function loadNotified() {
    try {
      var raw = window.localStorage.getItem(NOTIFY_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      var now = Date.now();
      var result = {};
      Object.keys(parsed).forEach(function (key) {
        if (now - Number(parsed[key] || 0) < 7 * 86400000) result[key] = parsed[key];
      });
      return result;
    } catch (e) {
      return {};
    }
  }

  function saveNotified() {
    try {
      window.localStorage.setItem(NOTIFY_KEY, JSON.stringify(notified));
    } catch (e) {
      // ignore storage errors
    }
  }

  function showToast(message) {
    ensureStyle();
    var toast = document.getElementById('crm-insights-toast');
    if (!toast) {
      toast = el('div', 'crm-insights-toast');
      toast.id = 'crm-insights-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    if (toast.__timer) window.clearTimeout(toast.__timer);
    toast.__timer = window.setTimeout(function () {
      toast.classList.remove('show');
    }, 2400);
  }

  function ensureNotifyBell() {
    var bell = document.getElementById('crm-insights-bell');
    if (bell) return bell;
    bell = el('button', 'crm-notify-bell', '🔔 开启提醒');
    bell.type = 'button';
    bell.id = 'crm-insights-bell';
    bell.addEventListener('click', function () {
      requestNotifications();
    });
    document.body.appendChild(bell);
    return bell;
  }

  function updateNotifyBell() {
    if (!notifySupported || !started || !findPendingAnchor()) {
      var existing = document.getElementById('crm-insights-bell');
      if (existing) existing.style.display = 'none';
      return;
    }
    if (window.Notification.permission === 'granted') {
      var grantedBell = document.getElementById('crm-insights-bell');
      if (grantedBell) grantedBell.style.display = 'none';
      return;
    }
    var bell = ensureNotifyBell();
    bell.style.display = 'inline-flex';
    if (window.Notification.permission === 'denied') {
      bell.textContent = '🔔 开启提醒';
      bell.title = '通知被浏览器禁用，点击查看如何允许';
    } else {
      bell.textContent = '🔔 开启提醒';
      bell.title = '开启浏览器桌面提醒';
    }
  }

  function renderNotifyBanner() {
    if (!notifySupported) return null;
    var permission = window.Notification.permission;
    if (permission === 'granted') return null;

    var banner = el('div', 'crm-notify-banner ' + (permission === 'denied' ? 'denied' : 'default'));
    var text = el('div', 'crm-notify-banner-text');
    if (permission === 'denied') {
      text.textContent =
        '🔔 桌面提醒被浏览器禁用：地址栏左侧锁/设置图标 → 网站设置 → 通知 → 允许，然后刷新页面。内嵌浏览器通常拿不到权限，请用 Chrome/Edge 打开。';
      var check = el('button', 'crm-insights-btn', '重新检查');
      check.type = 'button';
      check.addEventListener('click', function () {
        updateNotifyButton();
        updateNotifyBell();
        renderDashboard(cache.data);
        if (window.Notification.permission !== 'granted') {
          showToast('仍是禁用状态，请改完浏览器设置后刷新页面');
        }
      });
      banner.appendChild(text);
      banner.appendChild(check);
    } else {
      text.textContent = '🔔 到点提醒还没开启：开启后浏览器会在这台电脑上弹通知（只在这个标签页打开时生效）。';
      var open = el('button', 'crm-insights-btn', '开启桌面提醒');
      open.type = 'button';
      open.addEventListener('click', function () {
        requestNotifications();
      });
      banner.appendChild(text);
      banner.appendChild(open);
    }
    return banner;
  }

  function updateNotifyButton() {
    updateNotifyBell();
    var button = document.getElementById('crm-insights-notify');
    if (!button) return;
    if (!notifySupported) {
      button.style.display = 'none';
      return;
    }
    button.style.display = '';
    button.disabled = false;
    if (window.Notification.permission === 'granted') {
      button.textContent = '桌面提醒已开';
      button.title = '点击发送一条测试提醒';
      button.classList.add('notify-on');
    } else if (window.Notification.permission === 'denied') {
      button.textContent = '🔔 开启提醒';
      button.title = '通知被浏览器禁用，点击查看如何允许';
      button.disabled = false;
      button.classList.remove('notify-on');
    } else {
      button.textContent = '开启桌面提醒';
      button.title = '到点用浏览器桌面通知提醒你';
      button.classList.remove('notify-on');
    }
  }

  function showNotification(title, body, onClick, tag) {
    if (!notifySupported || window.Notification.permission !== 'granted') return;
    try {
      var notification = new window.Notification(title, {
        body: body,
        tag: tag || 'crm-insights',
        requireInteraction: false
      });
      notification.onclick = function () {
        try { window.focus(); } catch (e) {}
        if (typeof onClick === 'function') onClick();
        notification.close();
      };
      window.setTimeout(function () {
        try { notification.close(); } catch (e) {}
      }, 30000);
    } catch (e) {
      // notification may fail on some platforms; ignore
    }
  }

  function markDueNotified(data) {
    if (!data || !data.people) return;
    var now = Date.now();
    data.people.forEach(function (person) {
      if (!person.nextReminderAt || person.reminderAcknowledged) return;
      var reminder = new Date(person.nextReminderAt);
      if (reminder.getTime() <= now) {
        notified[person.id + '|' + reminder.toISOString()] = now;
      }
    });
    saveNotified();
  }

  function requestNotifications() {
    if (!notifySupported) {
      showToast('当前浏览器不支持桌面通知');
      return;
    }
    if (window.Notification.permission === 'granted') {
      showNotification('桌面提醒正常', '到点会在这里通知你。', null, 'crm-insights-test');
      showToast('测试提醒已发送');
      return;
    }
    if (window.Notification.permission === 'denied') {
      showToast('通知被禁用：地址栏锁图标 → 网站设置 → 通知 → 允许，然后刷新');
      updateNotifyButton();
      return;
    }
    Promise.resolve(window.Notification.requestPermission()).then(function (permission) {
      updateNotifyButton();
      updateNotifyBell();
      if (overlayOpen) renderDashboard(cache.data);
      if (permission === 'granted') {
        markDueNotified(cache.data);
        showNotification('桌面提醒已开启', '有新的待处理提醒时会在这里通知你。', null, 'crm-insights-welcome');
        showToast('桌面提醒已开启');
      } else if (permission === 'denied') {
        showToast('通知被拒绝，可在网站设置里修改');
      }
    });
  }

  function checkNotifications(data) {
    if (!notifySupported || window.Notification.permission !== 'granted' || !data) return;
    var now = new Date();
    var due = [];
    var changed = false;

    (data.people || []).forEach(function (person) {
      var reminder = person.nextReminderAt ? new Date(person.nextReminderAt) : null;
      if (!reminder || person.reminderAcknowledged) return;
      if (reminder.getTime() > now.getTime()) return;

      var key = person.id + '|' + reminder.toISOString();
      if (notified[key]) return;

      if (now.getTime() - reminder.getTime() > 24 * 60 * 60 * 1000) {
        notified[key] = now.getTime();
        changed = true;
        return;
      }
      due.push({ person: person, reminder: reminder, key: key });
    });

    if (!due.length) {
      if (changed) saveNotified();
      return;
    }

    due.sort(function (a, b) {
      return a.reminder.getTime() - b.reminder.getTime();
    });

    due.slice(0, 3).forEach(function (item) {
      var person = item.person;
      var displayName = person.name
        ? ((person.name.firstName || '') + (person.name.lastName || '')).trim()
        : '';
      var owner = labelOf('developer', person.developer, '未分配');
      var text = person.reminderText || '请及时联系客户';
      showNotification(
        '待提醒 · ' + fmtTime(item.reminder) + ' · ' + (displayName || '未命名客户'),
        owner + ' · ' + text,
        function () {
          window.location.href = '/object/person/' + person.id;
        },
        'crm-reminder-' + person.id
      );
      notified[item.key] = now.getTime();
    });

    due.slice(3).forEach(function (item) {
      notified[item.key] = now.getTime();
    });

    if (due.length > 3) {
      showNotification(
        '还有 ' + (due.length - 3) + ' 条待处理提醒',
        '点击打开业务总览查看',
        function () { openDashboard(); },
        'crm-insights-more'
      );
    }
    saveNotified();
  }

  function csvCell(value) {
    if (value === null || value === undefined) return '""';
    return '"' + String(value).replace(/"/g, '""') + '"';
  }

  function buildCsvText() {
    var view = getFilteredData(cache.data || { people: [], comms: [] });
    var rounds = {};
    view.comms.forEach(function (comm) {
      if (comm.customer && comm.customer.id) {
        rounds[comm.customer.id] = (rounds[comm.customer.id] || 0) + 1;
      }
    });

    var header = ['姓名', '手机', '微信号', '当前负责人', '当前阶段', '来源渠道', '下次提醒', '提醒内容', '已完成', '最后沟通', '沟通轮次', '创建时间'];
    var rows = view.people
      .slice()
      .sort(function (a, b) {
        var aOwner = labelOf('developer', a.developer, '未分配');
        var bOwner = labelOf('developer', b.developer, '未分配');
        if (aOwner !== bOwner) return aOwner.localeCompare(bOwner, 'zh');
        var aName = a.name ? (a.name.firstName || '') + (a.name.lastName || '') : '';
        var bName = b.name ? (b.name.firstName || '') + (b.name.lastName || '') : '';
        return aName.localeCompare(bName, 'zh');
      })
      .map(function (person) {
        var displayName = person.name
          ? ((person.name.firstName || '') + (person.name.lastName || '')).trim()
          : '';
        var phone = '';
        if (person.phones && person.phones.primaryPhoneNumber) {
          phone = [person.phones.primaryPhoneCallingCode, person.phones.primaryPhoneNumber]
            .filter(function (part) { return !!part; })
            .join(' ');
        }
        return [
          displayName,
          phone,
          person.wechatId || '',
          labelOf('developer', person.developer, '未分配'),
          labelOf('customerStatus', person.customerStatus, '未设置'),
          labelOf('sourceChannel', person.sourceChannel, '未填写'),
          person.nextReminderAt ? fmtDateTime(new Date(person.nextReminderAt)) : '',
          person.reminderText || '',
          person.reminderAcknowledged ? '是' : '否',
          person.lastContactAt ? fmtDateTime(new Date(person.lastContactAt)) : '',
          rounds[person.id] || 0,
          person.createdAt ? fmtDateTime(new Date(person.createdAt)) : ''
        ];
      });

    return '\uFEFF' + [header].concat(rows).map(function (line) {
      return line.map(csvCell).join(',');
    }).join('\r\n');
  }

  function exportCsv() {
    if (!cache.data) {
      showToast('数据还没加载好，请稍后再试');
      return;
    }
    var csv = buildCsvText();
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var now = shiftToShanghai(new Date());
    var stamp =
      now.getUTCFullYear() +
      pad2(now.getUTCMonth() + 1) +
      pad2(now.getUTCDate()) +
      '-' +
      pad2(now.getUTCHours()) +
      pad2(now.getUTCMinutes());
    var link = document.createElement('a');
    link.href = url;
    link.download = 'crm-customers-' + stamp + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    showToast('CSV 已导出');
  }

  function buildWeeklyReport() {
    var now = new Date();
    var view = getFilteredData(cache.data || { people: [], comms: [] });
    var summaryData = computeSummary(view, now);
    var lines = [];

    lines.push('AICYLD CRM 周报（' + fmtDate(summaryData.weekStart) + ' ~ ' + fmtDate(now) + '）');
    lines.push(
      '筛选：' +
        (ownerFilter
          ? (ownerFilter === '__none' ? '未分配' : labelOf('developer', ownerFilter))
          : '全部客户')
    );
    lines.push('');
    lines.push('客户总数：' + summaryData.total + '（本周新增 ' + summaryData.weekNew + '）');
    lines.push(
      '待处理提醒：' +
        summaryData.due +
        '（逾期 ' +
        summaryData.overdue +
        ' · 今天 ' +
        summaryData.today +
        ' · 未来 ' +
        summaryData.future +
        '）'
    );
    if (summaryData.overdue3 > 0) lines.push('其中超 3 天逾期：' + summaryData.overdue3);
    lines.push('本周沟通：' + summaryData.weekComms);
    lines.push('30 天未联系：' + summaryData.stale);
    lines.push('无下次提醒：' + summaryData.noReminder);
    lines.push('');

    var counts = {};
    view.people.forEach(function (person) {
      var key = person.customerStatus || '__empty';
      counts[key] = (counts[key] || 0) + 1;
    });
    var stageParts = STAGE_ORDER.map(function (value) {
      return labelOf('customerStatus', value) + ' ' + (counts[value] || 0);
    });
    if (counts.__empty) stageParts.push('未设置 ' + counts.__empty);
    lines.push('阶段分布：' + stageParts.join(' · '));

    var demoIndex = STAGE_ORDER.indexOf('WON');
    var depositIndex = STAGE_ORDER.indexOf('BAO_ZHENG_JIN_JIAO_NA');
    var demoPlus = 0;
    var depositPlus = 0;
    STAGE_ORDER.forEach(function (value, index) {
      if (demoIndex >= 0 && index >= demoIndex) demoPlus += counts[value] || 0;
      if (depositIndex >= 0 && index >= depositIndex) depositPlus += counts[value] || 0;
    });
    if (demoIndex >= 0) {
      lines.push('已演示及以上：' + demoPlus + ' 人（' + (summaryData.total ? Math.round((demoPlus / summaryData.total) * 100) : 0) + '%）');
    }
    if (depositIndex >= 0) {
      lines.push('保证金及以上：' + depositPlus + ' 人（' + (summaryData.total ? Math.round((depositPlus / summaryData.total) * 100) : 0) + '%）');
    }
    lines.push('');

    var ownerStats = computeOwnerStats(view.people, view.comms, summaryData, now);
    lines.push('负责人工作量：');
    ownerStats.order.forEach(function (key) {
      var stat = ownerStats.stats[key];
      if (!stat) return;
      if (!stat.total && !stat.weekComms) return;
      var name = key === '__none' ? '未分配' : labelOf('developer', key);
      lines.push(
        '- ' +
          name +
          '：' +
          stat.total +
          ' 人 / 待处理 ' +
          stat.due +
          ' / 逾期 ' +
          stat.overdue +
          ' / 本周沟通 ' +
          stat.weekComms +
          ' / 30天未联系 ' +
          stat.stale
      );
    });
    lines.push('');

    var attention = buildAttentionItems(view.people, now, summaryData).slice(0, 5);
    if (attention.length) {
      lines.push('今日与关注：');
      attention.forEach(function (item) {
        var person = item.person;
        var displayName = person.name
          ? ((person.name.firstName || '') + (person.name.lastName || '')).trim()
          : '未命名客户';
        var owner = labelOf('developer', person.developer, '未分配');
        if (item.type === 'overdue') {
          lines.push(
            '- 逾期 ' +
              humanDuration(item.severity) +
              '：' +
              displayName +
              '（' +
              owner +
              '）' +
              (person.reminderText ? ' — ' + person.reminderText : '')
          );
        } else if (item.type === 'today') {
          lines.push(
            '- 今天 ' +
              fmtTime(item.reminder) +
              '：' +
              displayName +
              '（' +
              owner +
              '）' +
              (person.reminderText ? ' — ' + person.reminderText : '')
          );
        } else {
          lines.push(
            '- ' +
              daysSince(item.lastContact || new Date(person.createdAt)) +
              ' 天未联系：' +
              displayName +
              '（' +
              owner +
              '）'
          );
        }
      });
    }

    return lines.join('\n');
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      try {
        if (document.execCommand('copy')) resolve();
        else reject(new Error('copy failed'));
      } catch (e) {
        reject(e);
      }
      document.body.removeChild(area);
    });
  }

  function copyWeeklyReport() {
    if (!cache.data) {
      showToast('数据还没加载好，请稍后再试');
      return;
    }
    var report = buildWeeklyReport();
    copyText(report)
      .then(function () {
        showToast('周报已复制，可直接粘贴到飞书/微信');
      })
      .catch(function () {
        showToast('复制失败，请重试');
      });
  }

  function completeReminder(person, button) {
    if (!person || !button || button.disabled) return;
    button.disabled = true;
    button.textContent = '完成中…';
    graphql(
      'mutation CrmInsightsAck($id: UUID!) { updatePerson(id: $id, data: { reminderAcknowledged: true }) { id reminderAcknowledged } }',
      { id: person.id }
    )
      .then(function () {
        showToast('已标记完成');
        cache.ts = 0;
        return refresh(true);
      })
      .catch(function () {
        button.disabled = false;
        button.textContent = '完成';
        showToast('操作失败，请重试');
      });
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

  function getFilteredData(data) {
    if (!ownerFilter) return data;
    var ids = {};
    var people = data.people.filter(function (person) {
      if (ownerKey(person) !== ownerFilter) return false;
      ids[person.id] = true;
      return true;
    });
    var comms = data.comms.filter(function (comm) {
      return comm.customer && ids[comm.customer.id];
    });
    return { people: people, comms: comms };
  }

  function renderFilters(people) {
    var box = el('div', 'crm-insights-filters');
    var chips = [{ value: null, label: '全部' }];
    OWNER_ORDER.forEach(function (value) {
      chips.push({ value: value, label: labelOf('developer', value) });
    });
    var hasUnassigned = people.some(function (person) {
      return !person.developer;
    });
    if (hasUnassigned) chips.push({ value: '__none', label: '未分配' });

    chips.forEach(function (chip) {
      var button = el(
        'button',
        'crm-filter-chip' + (ownerFilter === chip.value ? ' active' : ''),
        chip.label
      );
      button.type = 'button';
      button.addEventListener('click', function () {
        ownerFilter = chip.value;
        renderDashboard(cache.data);
      });
      box.appendChild(button);
    });
    return box;
  }

  function renderNoReminderView(people, now, summaryData) {
    var box = el('div', 'crm-drill');
    var items = people
      .filter(function (person) {
        return !person.nextReminderAt;
      })
      .sort(function (a, b) {
        var aDate = a.lastContactAt
          ? new Date(a.lastContactAt)
          : a.createdAt
            ? new Date(a.createdAt)
            : new Date(0);
        var bDate = b.lastContactAt
          ? new Date(b.lastContactAt)
          : b.createdAt
            ? new Date(b.createdAt)
            : new Date(0);
        return aDate.getTime() - bDate.getTime();
      });

    var head = el('div', 'crm-drill-head');
    var back = el('button', 'crm-insights-btn', '← 返回总览');
    back.type = 'button';
    back.addEventListener('click', function () {
      panelView = 'dashboard';
      renderDashboard(cache.data);
    });
    head.appendChild(back);

    var titleWrap = el('div');
    titleWrap.appendChild(el('div', 'crm-drill-title', '无下次提醒（' + items.length + '）'));
    titleWrap.appendChild(el('div', 'crm-section-note', '按最后沟通从久到近 · 点客户名可直接补提醒'));
    head.appendChild(titleWrap);
    box.appendChild(head);

    if (!items.length) {
      box.appendChild(el('div', 'crm-insights-empty', '当前筛选下没有无提醒客户'));
      return box;
    }

    var list = el('div', 'crm-drill-list');
    items.forEach(function (person) {
      var displayName = person.name
        ? ((person.name.firstName || '') + (person.name.lastName || '')).trim()
        : '';
      var row = el('div', 'crm-drill-row');
      var main = el('div', 'crm-drill-main');

      var name = el('a', 'crm-att-name', displayName || '未命名客户');
      name.href = '/object/person/' + person.id;
      main.appendChild(name);

      var metaText =
        labelOf('developer', person.developer, '未分配') +
        ' · ' +
        labelOf('customerStatus', person.customerStatus, '未设置') +
        (person.lastContactAt ? ' · 最后沟通 ' + fmtDate(new Date(person.lastContactAt)) : ' · 从未沟通');
      var meta = el('div', 'crm-att-meta', metaText);
      meta.title = metaText;
      main.appendChild(meta);
      row.appendChild(main);
      row.appendChild(el('span', 'crm-att-chip orange', '无提醒'));
      list.appendChild(row);
    });
    box.appendChild(list);
    return box;
  }

  function renderDashboard(data) {
    if (!overlayOpen) return;
    var body = document.getElementById('crm-insights-body');
    if (!body) return;

    var now = new Date();
    var allSummary = computeSummary(data, now);
    var view = getFilteredData(data);
    var summaryData = computeSummary(view, now);
    var previousScrollTop = body.scrollTop;
    var updated = document.getElementById('crm-insights-updated');
    if (updated) {
      updated.textContent = '客户数据 · 更新于 ' + fmtTime(new Date(cache.ts)) + ' · 北京时间';
    }

    body.innerHTML = '';
    var notifyBanner = renderNotifyBanner();
    if (notifyBanner) body.appendChild(notifyBanner);
    body.appendChild(renderFilters(data.people));

    if (panelView === 'noReminder') {
      body.appendChild(renderNoReminderView(view.people, now, summaryData));
      body.scrollTop = 0;
      return;
    }

    body.appendChild(renderKpis(summaryData, view));
    body.appendChild(
      renderGrid([
        renderStages(view.people, summaryData),
        renderOwners(data.people, data.comms, allSummary, now, ownerFilter),
        renderSources(view.people)
      ])
    );
    body.appendChild(
      renderGrid([
        renderTrend(view.comms, summaryData.weekStart),
        renderRounds(view.people, view.comms),
        renderAttention(view.people, now, summaryData)
      ])
    );
    body.scrollTop = previousScrollTop;
  }

  function renderKpis(summaryData, data) {
    var grid = el('div', 'crm-insights-kpis');
    grid.appendChild(kpi('客户总数', summaryData.total, '本周新增 ' + summaryData.weekNew));
    var noReminderCard = kpi(
      '无下次提醒',
      summaryData.noReminder,
      '没有提醒 = 没人管 · 点击查看',
      summaryData.noReminder > 0 ? 'orange' : ''
    );
    noReminderCard.classList.add('crm-kpi-clickable');
    noReminderCard.title = '点击查看无提醒客户名单';
    noReminderCard.addEventListener('click', function () {
      panelView = 'noReminder';
      renderDashboard(cache.data);
    });
    grid.appendChild(noReminderCard);
    var dueSub =
      '逾期 ' + summaryData.overdue + ' · 今天 ' + summaryData.today;
    if (summaryData.overdue3 > 0) dueSub += ' · 超3天 ' + summaryData.overdue3;
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
    var box = section('阶段分布', '全部客户 · 当前阶段（非历史漏斗）');
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

    var demoIndex = STAGE_ORDER.indexOf('WON');
    var depositIndex = STAGE_ORDER.indexOf('BAO_ZHENG_JIN_JIAO_NA');
    var demoPlus = 0;
    var depositPlus = 0;
    rows.forEach(function (row) {
      var index = STAGE_ORDER.indexOf(row.value);
      if (index < 0) return;
      if (demoIndex >= 0 && index >= demoIndex) demoPlus += row.count;
      if (depositIndex >= 0 && index >= depositIndex) depositPlus += row.count;
    });

    if (demoIndex >= 0) {
      var demoPercent = summaryData.total ? Math.round((demoPlus / summaryData.total) * 100) : 0;
      box.appendChild(
        el('div', 'crm-section-foot', '已演示及以上 ' + demoPlus + ' 人 · 占 ' + demoPercent + '%')
      );
    }
    if (depositIndex >= 0) {
      var depositPercent = summaryData.total ? Math.round((depositPlus / summaryData.total) * 100) : 0;
      box.appendChild(
        el('div', 'crm-section-foot', '保证金及以上 ' + depositPlus + ' 人 · 占 ' + depositPercent + '%')
      );
    }
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

  function computeOwnerStats(people, comms, summaryData, now) {
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
    });

    return { stats: stats, order: order, total: total };
  }

  function renderOwners(people, comms, summaryData, now, ownerFilter) {
    var box = section('负责人工作量', '客户归属 · 本周按周一算（全公司）');
    var result = computeOwnerStats(people, comms, summaryData, now);

    var table = el('table', 'crm-table');
    var thead = el('thead');
    var headRow = el('tr');
    ['负责人', '客户', '待处理', '逾期', '本周沟通', '30天未联系'].forEach(function (label) {
      headRow.appendChild(el('th', '', label));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = el('tbody');
    result.order.forEach(function (key) {
      var rowStats = result.stats[key];
      if (!rowStats) return;
      var row = el('tr');
      if (ownerFilter && key === ownerFilter) row.className = 'crm-owner-active';
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
    totalRow.appendChild(el('td', '', result.total.total));
    totalRow.appendChild(el('td', '', result.total.due));
    totalRow.appendChild(el('td', '', result.total.overdue));
    totalRow.appendChild(el('td', '', result.total.weekComms));
    totalRow.appendChild(el('td', '', result.total.stale));
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
    var box = section('来源渠道', '按客户来源 · 保=保证金及以上');
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

    var depositIndex = STAGE_ORDER.indexOf('BAO_ZHENG_JIN_JIAO_NA');
    var depositBySource = {};
    if (depositIndex >= 0) {
      people.forEach(function (person) {
        var index = STAGE_ORDER.indexOf(person.customerStatus);
        if (index < depositIndex) return;
        var key = person.sourceChannel || '__empty';
        depositBySource[key] = (depositBySource[key] || 0) + 1;
      });
    }

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
        var deposit = depositBySource[row.value] || 0;
        if (deposit > 0) {
          var depositBadge = el('span', 'crm-legend-deposit', '保 ' + deposit);
          depositBadge.title = '保证金及以上 ' + deposit + ' 人';
          line.appendChild(depositBadge);
        }
        legend.appendChild(line);
      });
    }
    wrap.appendChild(legend);
    box.appendChild(wrap);
    return box;
  }

  function buildAttentionItems(people, now, summaryData) {
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
    return items;
  }

  function renderAttention(people, now, summaryData) {
    var box = section('今日与关注', '逾期 → 今天 → 30 天未联系');
    var items = buildAttentionItems(people, now, summaryData);
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
        var critical = item.severity > 3 * 86400000;
        chip = el(
          'span',
          'crm-att-chip red' + (critical ? ' critical' : ''),
          (critical ? '⚠ ' : '') + '逾期 ' + humanDuration(item.severity)
        );
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

      if (item.type === 'overdue' || item.type === 'today') {
        var doneButton = el('button', 'crm-att-done', '完成');
        doneButton.type = 'button';
        doneButton.title = '标记这条提醒已完成';
        doneButton.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          completeReminder(person, doneButton);
        });
        row.appendChild(doneButton);
      }

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

  function markdownToText(markdown) {
    if (!markdown) return '';
    return String(markdown)
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[`*_~]/g, '')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s*[-+]\s+/gm, '• ')
      .replace(/^\s*>\s?/gm, '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function previewMarkdown(markdown) {
    var text = markdownToText(markdown).replace(/\s+/g, ' ').trim();
    if (!text) return '（无沟通内容）';
    return text.length > 220 ? text.slice(0, 220) + '…' : text;
  }

  function loadCommsData(force) {
    if (!force && commsCache.data && Date.now() - commsCache.ts < 60000) {
      return Promise.resolve(commsCache.data);
    }
    if (commsCache.promise) return commsCache.promise;

    commsCache.promise = Promise.all([
      fetchAll('people', COMMS_PEOPLE_QUERY),
      fetchAll('communicationRecords', COMMS_RECORDS_QUERY),
      fetchMetadata()
    ])
      .then(function (results) {
        commsCache.data = { people: results[0], records: results[1] };
        commsCache.ts = Date.now();
        commsCache.unauthorized = false;
        commsCache.promise = null;
        return commsCache.data;
      })
      .catch(function (error) {
        commsCache.unauthorized = !!error.unauthorized;
        commsCache.promise = null;
        throw error;
      });

    return commsCache.promise;
  }

  function buildCommsModel(data) {
    var people = data.people || [];
    var records = data.records || [];
    var personById = {};
    var cells = {};
    var maxRound = 0;
    var importantRecords = 0;

    people.forEach(function (person) {
      personById[person.id] = person;
    });

    records.forEach(function (record) {
      if (!record.customer || !record.customer.id) return;
      if (record.isImportant) importantRecords += 1;
      var customerId = record.customer.id;
      var round = Math.max(1, Math.round(Number(record.round) || 1));
      if (round > maxRound) maxRound = round;
      if (!cells[customerId]) cells[customerId] = {};
      var existing = cells[customerId][round];
      if (!existing) {
        cells[customerId][round] = { record: record, count: 1 };
      } else {
        existing.count += 1;
        if (new Date(record.communicatedAt) > new Date(existing.record.communicatedAt)) {
          existing.record = record;
        }
      }
    });

    maxRound = Math.min(maxRound, 20);
    var roundStats = {};
    for (var round = 1; round <= maxRound; round += 1) {
      roundStats[round] = { customers: 0, records: 0 };
    }
    Object.keys(cells).forEach(function (customerId) {
      Object.keys(cells[customerId]).forEach(function (roundKey) {
        var round = Number(roundKey);
        if (round < 1 || round > maxRound) return;
        roundStats[round].customers += 1;
        roundStats[round].records += cells[customerId][roundKey].count;
      });
    });

    var linkedRecords = 0;
    Object.keys(roundStats).forEach(function (round) {
      linkedRecords += roundStats[round].records;
    });

    return {
      people: people,
      records: records,
      linkedRecords: linkedRecords,
      personById: personById,
      cells: cells,
      maxRound: maxRound,
      roundStats: roundStats,
      importantRecords: importantRecords
    };
  }

  function getCommsRows(model) {
    var query = (commsSearch || '').trim().toLowerCase();
    var rows = [];

    model.people.forEach(function (person) {
      var rowCells = model.cells[person.id] || {};
      var hasRecords = Object.keys(rowCells).length > 0;
      if (commsOnlyWith && !hasRecords) return;
      if (commsOwnerFilter && ownerKey(person) !== commsOwnerFilter) return;

      var displayName = person.name
        ? ((person.name.firstName || '') + (person.name.lastName || '')).trim()
        : '';

      if (query) {
        var blob = displayName.toLowerCase();
        Object.keys(rowCells).forEach(function (round) {
          var markdown = rowCells[round].record.content && rowCells[round].record.content.markdown;
          if (markdown) blob += ' ' + markdownToText(markdown).toLowerCase();
        });
        if (blob.indexOf(query) === -1) return;
      }

      var maxRowRound = 0;
      var latest = person.lastContactAt ? new Date(person.lastContactAt).getTime() : 0;
      Object.keys(rowCells).forEach(function (round) {
        var number = Number(round);
        if (number > maxRowRound) maxRowRound = number;
        var at = rowCells[round].record.communicatedAt
          ? new Date(rowCells[round].record.communicatedAt).getTime()
          : 0;
        if (at > latest) latest = at;
      });

      rows.push({
        person: person,
        displayName: displayName,
        cells: rowCells,
        maxRound: maxRowRound,
        sortDate: latest
      });
    });

    rows.sort(function (a, b) {
      if (a.sortDate !== b.sortDate) return b.sortDate - a.sortDate;
      return a.displayName.localeCompare(b.displayName, 'zh');
    });
    return rows;
  }

  function buildCommsOverlay() {
    var overlay = el('div');
    overlay.id = 'crm-comms-overlay';
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeCommsOverview();
    });

    var dialog = el('div', 'crm-comms-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', '沟通总览');

    var head = el('div', 'crm-comms-head');
    var headMain = el('div');
    headMain.appendChild(el('div', 'crm-comms-title', '沟通总览'));
    var sub = el('div', 'crm-comms-sub', '正在加载…');
    sub.id = 'crm-comms-sub';
    headMain.appendChild(sub);
    head.appendChild(headMain);

    var actions = el('div', 'crm-comms-actions');
    var refreshButton = el('button', 'crm-insights-btn', '刷新');
    refreshButton.type = 'button';
    refreshButton.id = 'crm-comms-refresh';
    refreshButton.addEventListener('click', function () {
      refreshButton.disabled = true;
      refreshButton.textContent = '刷新中…';
      loadCommsData(true)
        .then(function (data) {
          renderCommsTable(data);
        })
        .catch(function (error) {
          if (!commsCache.data) renderCommsError(error);
        })
        .then(function () {
          refreshButton.disabled = false;
          refreshButton.textContent = '刷新';
        });
    });
    actions.appendChild(refreshButton);

    var closeButton = el('button', 'crm-insights-close', '×');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', '关闭');
    closeButton.addEventListener('click', closeCommsOverview);
    actions.appendChild(closeButton);
    head.appendChild(actions);
    dialog.appendChild(head);

    var toolbar = el('div', 'crm-comms-toolbar');
    var search = el('input', 'crm-comms-search');
    search.type = 'search';
    search.id = 'crm-comms-search';
    search.placeholder = '搜索机构 / 沟通内容';
    search.value = commsSearch;
    search.addEventListener('input', function () {
      commsSearch = search.value;
      if (commsCache.data) renderCommsTable(commsCache.data);
    });
    toolbar.appendChild(search);

    var owners = el('div', 'crm-comms-owners');
    owners.id = 'crm-comms-owners';
    toolbar.appendChild(owners);

    var toggle = el('label', 'crm-comms-toggle');
    var checkbox = el('input');
    checkbox.type = 'checkbox';
    checkbox.checked = commsOnlyWith;
    checkbox.addEventListener('change', function () {
      commsOnlyWith = checkbox.checked;
      if (commsCache.data) renderCommsTable(commsCache.data);
    });
    toggle.appendChild(checkbox);
    toggle.appendChild(document.createTextNode('只看有沟通'));
    toolbar.appendChild(toggle);

    var legend = el('span', 'crm-comms-legend');
    legend.appendChild(el('span', 'crm-comms-star', '★'));
    legend.appendChild(document.createTextNode(' 重点沟通'));
    toolbar.appendChild(legend);

    var count = el('span', 'crm-comms-count', '—');
    count.id = 'crm-comms-count';
    toolbar.appendChild(count);
    dialog.appendChild(toolbar);

    var tableWrap = el('div', 'crm-comms-table-wrap');
    tableWrap.id = 'crm-comms-table-wrap';
    dialog.appendChild(tableWrap);

    overlay.appendChild(dialog);
    return overlay;
  }

  function renderCommsOwners() {
    var box = document.getElementById('crm-comms-owners');
    if (!box) return;
    box.innerHTML = '';

    var chips = [{ value: null, label: '全部' }];
    OWNER_ORDER.forEach(function (value) {
      chips.push({ value: value, label: labelOf('developer', value) });
    });
    var people = commsCache.data ? commsCache.data.people : [];
    if (people.some(function (person) { return !person.developer; })) {
      chips.push({ value: '__none', label: '未分配' });
    }

    chips.forEach(function (chip) {
      var button = el(
        'button',
        'crm-filter-chip' + (commsOwnerFilter === chip.value ? ' active' : ''),
        chip.label
      );
      button.type = 'button';
      button.addEventListener('click', function () {
        commsOwnerFilter = chip.value;
        renderCommsOwners();
        if (commsCache.data) renderCommsTable(commsCache.data);
      });
      box.appendChild(button);
    });
  }

  function renderCommsLoading() {
    var wrap = document.getElementById('crm-comms-table-wrap');
    var count = document.getElementById('crm-comms-count');
    if (count) count.textContent = '加载中…';
    if (!wrap) return;
    wrap.innerHTML = '';
    wrap.appendChild(el('div', 'crm-comms-empty', '正在加载沟通记录…'));
  }

  function renderCommsError(error) {
    var wrap = document.getElementById('crm-comms-table-wrap');
    var count = document.getElementById('crm-comms-count');
    var sub = document.getElementById('crm-comms-sub');
    if (sub) sub.textContent = '加载失败';
    if (count) count.textContent = '—';
    if (!wrap) return;
    wrap.innerHTML = '';

    var empty = el('div', 'crm-comms-empty');
    if (error && error.unauthorized) {
      empty.appendChild(document.createTextNode('请先登录 CRM 后再查看沟通记录。'));
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
        renderCommsLoading();
        loadCommsData(true)
          .then(function (data) { renderCommsTable(data); })
          .catch(function (err) { renderCommsError(err); });
      });
      empty.appendChild(retry);
    }
    wrap.appendChild(empty);
  }

  function renderCommsTable(data) {
    if (!commsOpen) return;
    var wrap = document.getElementById('crm-comms-table-wrap');
    var sub = document.getElementById('crm-comms-sub');
    var count = document.getElementById('crm-comms-count');
    if (!wrap) return;

    var model = buildCommsModel(data);
    var rows = getCommsRows(model);
    if (sub) {
      var unlinked = model.records.length - model.linkedRecords;
      sub.textContent =
        model.people.length +
        ' 家机构 · ' +
        model.records.length +
        ' 条沟通' +
        (unlinked > 0 ? '（' + unlinked + ' 条未关联客户）' : '') +
        (model.importantRecords > 0 ? ' · 重点 ' + model.importantRecords + ' 条' : '') +
        (model.maxRound
          ? model.maxRound === 1
            ? ' · 轮次 1'
            : ' · 轮次 1–' + model.maxRound
          : '');
    }
    if (count) count.textContent = '显示 ' + rows.length + ' / ' + model.people.length + ' 家';
    renderCommsOwners();

    wrap.innerHTML = '';
    if (!model.maxRound) {
      wrap.appendChild(el('div', 'crm-comms-empty', '还没有沟通记录。'));
      return;
    }
    if (!rows.length) {
      wrap.appendChild(el('div', 'crm-comms-empty', '没有匹配的机构。'));
      return;
    }

    var table = el('table', 'crm-comms-table');
    var thead = el('thead');
    var headRow = el('tr');
    var firstHead = el('th', 'crm-comms-customer-head', '机构 / 负责人');
    headRow.appendChild(firstHead);

    for (var round = 1; round <= model.maxRound; round += 1) {
      var stats = model.roundStats[round] || { customers: 0, records: 0 };
      var th = el('th', 'crm-comms-round-head');
      var title = el('div', 'crm-comms-round-title');
      var dot = el('span', 'crm-comms-round-dot');
      dot.style.background = COMMS_ROUND_COLORS[(round - 1) % COMMS_ROUND_COLORS.length];
      title.appendChild(dot);
      title.appendChild(document.createTextNode('第' + round + '轮'));
      th.appendChild(title);
      th.appendChild(
        el('div', 'crm-comms-round-sub', stats.customers + ' 家 · ' + stats.records + ' 条')
      );
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = el('tbody');
    rows.forEach(function (row) {
      var person = row.person;
      var tr = el('tr', 'crm-comms-row');

      var customerCell = el('td', 'crm-comms-customer');
      var nameRow = el('div', 'crm-comms-name-row');
      var avatar = el('div', 'crm-comms-avatar', (row.displayName || '?').slice(0, 1));
      var nameLink = el('a', 'crm-comms-name', row.displayName || '未命名客户');
      nameLink.href = '/object/person/' + person.id;
      nameRow.appendChild(avatar);
      nameRow.appendChild(nameLink);
      customerCell.appendChild(nameRow);

      var meta = el('div', 'crm-comms-meta');
      meta.appendChild(document.createTextNode(labelOf('developer', person.developer, '未分配') + ' · '));
      var stage = el('span', 'crm-comms-stage', labelOf('customerStatus', person.customerStatus, '未设置'));
      stage.style.color = colorOf('customerStatus', person.customerStatus);
      stage.style.borderColor = colorOf('customerStatus', person.customerStatus);
      meta.appendChild(stage);
      customerCell.appendChild(meta);

      customerCell.appendChild(
        el(
          'div',
          'crm-comms-last',
          person.lastContactAt ? '最后沟通 ' + fmtDate(new Date(person.lastContactAt)) : '暂无沟通'
        )
      );
      tr.appendChild(customerCell);

      for (var r = 1; r <= model.maxRound; r += 1) {
        var cell = row.cells[r];
        if (!cell) {
          var empty = el('td', 'crm-comms-cell crm-comms-cell-add');
          empty.title = '添加第' + r + '轮沟通';
          empty.appendChild(el('div', 'crm-comms-cell-empty', '＋'));
          (function (personRef, roundRef) {
            empty.addEventListener('click', function () {
              openCommsAdd(personRef, roundRef);
            });
          })(person, r);
          tr.appendChild(empty);
          continue;
        }

        var important = !!cell.record.isImportant;
        var td = el(
          'td',
          'crm-comms-cell' +
            (r === row.maxRound ? ' latest' : '') +
            (important ? ' important' : '')
        );
        var top = el('div', 'crm-comms-cell-top');
        var topLeft = el('span', 'crm-comms-top-left');
        if (important) {
          var star = el('span', 'crm-comms-star', '★');
          star.title = '重点沟通';
          topLeft.appendChild(star);
        }
        topLeft.appendChild(
          el('span', 'crm-comms-cell-date', fmtMonthDay(new Date(cell.record.communicatedAt)))
        );
        top.appendChild(topLeft);
        var personSpan = el('span', 'crm-comms-cell-person');
        var personDot = el('span', 'crm-comms-person-dot');
        personDot.style.background = colorOf('communicator', cell.record.communicator);
        personSpan.appendChild(personDot);
        personSpan.appendChild(
          document.createTextNode(
            labelOf('communicator', cell.record.communicator, cell.record.communicator || '未填写')
          )
        );
        top.appendChild(personSpan);
        td.appendChild(top);
        td.appendChild(
          el(
            'div',
            'crm-comms-cell-text',
            previewMarkdown(cell.record.content && cell.record.content.markdown)
          )
        );
        if (cell.count > 1) td.appendChild(el('span', 'crm-comms-dupe', '×' + cell.count));
        td.appendChild(el('div', 'crm-comms-cell-hover', '查看全文'));

        (function (personRef, recordRef, roundRef, cellRef) {
          td.addEventListener('click', function () {
            openCommsDetail(personRef, recordRef, roundRef);
          });
        })(person, cell.record, r, td);

        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrap.appendChild(table);
  }

  function openCommsOverview() {
    ensureStyle();
    if (commsOpen) return;
    var overlay = document.getElementById('crm-comms-overlay');
    if (!overlay) {
      overlay = buildCommsOverlay();
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    commsOpen = true;
    overlay.__previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onCommsKeyDown, true);

    commsSearch = '';
    commsOwnerFilter = null;
    commsOnlyWith = false;
    var searchInput = document.getElementById('crm-comms-search');
    if (searchInput) searchInput.value = '';
    var onlyToggle = document.querySelector('.crm-comms-toggle input');
    if (onlyToggle) onlyToggle.checked = false;
    renderCommsOwners();

    if (commsCache.data) {
      renderCommsTable(commsCache.data);
    } else {
      renderCommsLoading();
    }
    loadCommsData(false)
      .then(function (data) {
        renderCommsTable(data);
      })
      .catch(function (error) {
        if (!commsCache.data) renderCommsError(error);
      });
  }

  function closeCommsOverview() {
    var overlay = document.getElementById('crm-comms-overlay');
    if (overlay) overlay.style.display = 'none';
    commsOpen = false;
    document.body.style.overflow = (overlay && overlay.__previousBodyOverflow) || '';
    document.removeEventListener('keydown', onCommsKeyDown, true);
    closeCommsDetail();
    closeCommsAdd();
  }

  function onCommsKeyDown(event) {
    if (event.key !== 'Escape') return;
    if (document.getElementById('crm-comms-detail-overlay')) return;
    if (document.getElementById('crm-comms-add-overlay')) return;
    closeCommsOverview();
  }

  function openCommsDetail(person, record, round) {
    closeCommsDetail();
    var displayName = person.name
      ? ((person.name.firstName || '') + (person.name.lastName || '')).trim()
      : '未命名客户';
    var communicator = labelOf(
      'communicator',
      record.communicator,
      record.communicator || '未填写'
    );
    var content = markdownToText(record.content && record.content.markdown) || '（无沟通内容）';

    var overlay = el('div');
    overlay.id = 'crm-comms-detail-overlay';
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeCommsDetail();
    });

    var dialog = el('div', 'crm-comms-detail');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    var head = el('div', 'crm-comms-detail-head');
    var headMain = el('div');
    var detailTitle = el('div', 'crm-comms-detail-title');
    if (record.isImportant) detailTitle.appendChild(el('span', 'crm-comms-detail-star', '★ '));
    detailTitle.appendChild(document.createTextNode(displayName + ' · 第' + round + '轮'));
    headMain.appendChild(detailTitle);
    headMain.appendChild(
      el(
        'div',
        'crm-comms-detail-sub',
        (record.name || '沟通记录') +
          ' · ' +
          fmtDateTime(new Date(record.communicatedAt)) +
          ' · ' +
          communicator
      )
    );
    head.appendChild(headMain);
    var closeButton = el('button', 'crm-insights-close', '×');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', '关闭');
    closeButton.addEventListener('click', closeCommsDetail);
    head.appendChild(closeButton);
    dialog.appendChild(head);

    var body = el('div', 'crm-comms-detail-body', content);
    dialog.appendChild(body);

    var foot = el('div', 'crm-comms-detail-foot');

    var maxRoundForPerson = 0;
    if (commsCache.data) {
      var model = buildCommsModel(commsCache.data);
      var rowCells = model.cells[person.id] || {};
      Object.keys(rowCells).forEach(function (roundKey) {
        var number = Number(roundKey);
        if (number > maxRoundForPerson) maxRoundForPerson = number;
      });
    }
    var editButton = el('button', 'crm-insights-btn', '编辑');
    editButton.type = 'button';
    editButton.addEventListener('click', function () {
      closeCommsDetail();
      openCommsAdd(person, round, record);
    });
    foot.appendChild(editButton);

    var nextRoundButton = el('button', 'crm-insights-btn', '新增下一轮');
    nextRoundButton.type = 'button';
    nextRoundButton.addEventListener('click', function () {
      closeCommsDetail();
      openCommsAdd(person, maxRoundForPerson + 1);
    });
    foot.appendChild(nextRoundButton);

    var copyButton = el('button', 'crm-insights-btn', '复制内容');
    copyButton.type = 'button';
    copyButton.addEventListener('click', function () {
      copyText(content)
        .then(function () { showToast('沟通内容已复制'); })
        .catch(function () { showToast('复制失败，请重试'); });
    });
    foot.appendChild(copyButton);

    var openLink = el('a', 'crm-insights-btn', '打开客户');
    openLink.href = '/object/person/' + person.id;
    foot.appendChild(openLink);

    var closeButton2 = el('button', 'crm-insights-btn', '关闭');
    closeButton2.type = 'button';
    closeButton2.addEventListener('click', closeCommsDetail);
    foot.appendChild(closeButton2);
    dialog.appendChild(foot);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onCommsDetailKeyDown, true);
  }

  function closeCommsDetail() {
    var overlay = document.getElementById('crm-comms-detail-overlay');
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', onCommsDetailKeyDown, true);
  }

  function onCommsDetailKeyDown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeCommsDetail();
    }
  }

  function toShanghaiInputValue(date) {
    var d = shiftToShanghai(date);
    return (
      d.getUTCFullYear() +
      '-' +
      pad2(d.getUTCMonth() + 1) +
      '-' +
      pad2(d.getUTCDate()) +
      'T' +
      pad2(d.getUTCHours()) +
      ':' +
      pad2(d.getUTCMinutes())
    );
  }

  function shanghaiInputToISO(value) {
    if (!value) return null;
    var date = new Date(value + ':00+08:00');
    return isNaN(date.getTime()) ? null : date.toISOString();
  }

  function autoTitleForRound(round, date) {
    var d = shiftToShanghai(date);
    return '第' + round + '轮-' + (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日';
  }

  function openCommsAdd(person, round, record) {
    closeCommsAdd();
    var isEdit = !!record;
    var displayName = person.name
      ? ((person.name.firstName || '') + (person.name.lastName || '')).trim()
      : '未命名客户';

    var overlay = el('div');
    overlay.id = 'crm-comms-add-overlay';
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeCommsAdd();
    });

    var dialog = el('div', 'crm-comms-add');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    var head = el('div', 'crm-comms-add-head');
    var headMain = el('div');
    headMain.appendChild(el('div', 'crm-comms-add-title', isEdit ? '编辑沟通' : '新增沟通'));
    headMain.appendChild(
      el(
        'div',
        'crm-comms-add-sub',
        displayName + ' · 第' + round + '轮' + (isEdit ? ' · 编辑' : '')
      )
    );
    head.appendChild(headMain);
    var closeButton = el('button', 'crm-insights-close', '×');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', '关闭');
    closeButton.addEventListener('click', closeCommsAdd);
    head.appendChild(closeButton);
    dialog.appendChild(head);

    var body = el('div', 'crm-comms-add-body');

    var row = el('div', 'crm-comms-add-row');

    var dateField = el('div', 'crm-comms-add-field');
    dateField.appendChild(el('label', '', '沟通时间（北京时间）'));
    var dateInput = el('input');
    dateInput.type = 'datetime-local';
    dateInput.value = isEdit && record.communicatedAt
      ? toShanghaiInputValue(new Date(record.communicatedAt))
      : toShanghaiInputValue(new Date());
    dateField.appendChild(dateInput);
    row.appendChild(dateField);

    var commField = el('div', 'crm-comms-add-field');
    commField.appendChild(el('label', '', '沟通人'));
    var commSelect = el('select');
    var options = Object.keys(LABELS.communicator || {});
    if (!options.length) options = OWNER_ORDER.slice();
    var defaultComm = isEdit && record.communicator
      ? record.communicator
      : person.developer && options.indexOf(person.developer) !== -1
        ? person.developer
        : '';
    var emptyOption = el('option', '', '未填写');
    emptyOption.value = '';
    if (!defaultComm) emptyOption.selected = true;
    commSelect.appendChild(emptyOption);
    options.forEach(function (value) {
      var option = el('option', '', labelOf('communicator', value, value));
      option.value = value;
      if (value === defaultComm) option.selected = true;
      commSelect.appendChild(option);
    });
    commField.appendChild(commSelect);
    row.appendChild(commField);
    body.appendChild(row);

    var contentField = el('div', 'crm-comms-add-field');
    contentField.appendChild(el('label', '', '沟通内容'));
    var contentInput = el('textarea');
    contentInput.placeholder = '客户说了什么、顾虑、下一步…';
    if (isEdit && record.content && record.content.markdown) {
      contentInput.value = record.content.markdown;
    }
    contentField.appendChild(contentInput);
    body.appendChild(contentField);

    var importantRow = el('label', 'crm-comms-add-important');
    var importantInput = el('input');
    importantInput.type = 'checkbox';
    importantInput.checked = isEdit && !!record.isImportant;
    importantRow.appendChild(importantInput);
    importantRow.appendChild(document.createTextNode('★ 重点沟通（需要特别注意）'));
    body.appendChild(importantRow);

    body.appendChild(
      el(
        'div',
        'crm-comms-add-note',
        isEdit
          ? '保存后会更新这一轮的日期、沟通人和内容；自动生成的标题会随日期更新。'
          : '标题会自动生成“第' + round + '轮-月日”；保存后会更新客户的最后沟通时间和轮次。'
      )
    );

    var errorBox = el('div', 'crm-comms-add-error');
    body.appendChild(errorBox);
    dialog.appendChild(body);

    var foot = el('div', 'crm-comms-add-foot');
    var cancelButton = el('button', 'crm-insights-btn', '取消');
    cancelButton.type = 'button';
    cancelButton.addEventListener('click', closeCommsAdd);
    foot.appendChild(cancelButton);

    var saveButton = el('button', 'crm-insights-btn crm-add-primary', isEdit ? '保存修改' : '保存');
    saveButton.type = 'button';
    foot.appendChild(saveButton);
    dialog.appendChild(foot);

    function showError(message) {
      errorBox.textContent = message;
      errorBox.style.display = 'block';
    }

    function submit() {
      var content = contentInput.value.trim();
      if (!content) {
        showError('请填写沟通内容');
        contentInput.focus();
        return;
      }
      var communicatedAt = shanghaiInputToISO(dateInput.value);
      if (!communicatedAt) {
        showError('请选择有效的沟通时间');
        return;
      }

      var data = {
        communicatedAt: communicatedAt,
        content: { markdown: content },
        isImportant: importantInput.checked
      };
      if (commSelect.value) data.communicator = commSelect.value;

      var mutation;
      var variables;
      if (isEdit) {
        if (record.name && /^第\d+轮-/.test(record.name)) {
          data.name = autoTitleForRound(round, new Date(communicatedAt));
        }
        mutation =
          'mutation CrmUpdateCommunication($id: UUID!, $data: CommunicationRecordUpdateInput!) {' +
          '  updateCommunicationRecord(id: $id, data: $data) { id name communicatedAt isImportant }' +
          '}';
        variables = { id: record.id, data: data };
      } else {
        data.customerId = person.id;
        data.round = round;
        mutation =
          'mutation CrmAddCommunication($data: CommunicationRecordCreateInput!) {' +
          '  createCommunicationRecord(data: $data) { id round communicatedAt }' +
          '}';
        variables = { data: data };
      }

      saveButton.disabled = true;
      saveButton.textContent = '保存中…';
      errorBox.style.display = 'none';

      graphql(mutation, variables)
        .then(function () {
          closeCommsAdd();
          showToast(isEdit ? '已保存修改' : '已添加沟通记录');
          commsCache.ts = 0;
          cache.ts = 0;
          loadCommsData(true)
            .then(function (fresh) {
              renderCommsTable(fresh);
            })
            .catch(function () {});
          refresh(true).catch(function () {});
        })
        .catch(function (error) {
          saveButton.disabled = false;
          saveButton.textContent = isEdit ? '保存修改' : '保存';
          showError('保存失败：' + (error && error.message ? error.message : '请重试'));
        });
    }

    saveButton.addEventListener('click', submit);
    contentInput.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        submit();
      }
    });

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onCommsAddKeyDown, true);
    contentInput.focus();
  }

  function closeCommsAdd() {
    var overlay = document.getElementById('crm-comms-add-overlay');
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', onCommsAddKeyDown, true);
  }

  function onCommsAddKeyDown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeCommsAdd();
    }
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
      },
      meta: function () {
        return {
          loaded: cache.metaLoaded,
          stageOrder: STAGE_ORDER.slice(),
          owners: OWNER_ORDER.slice(),
          labels: LABELS
        };
      },
      report: function () {
        return cache.data ? buildWeeklyReport() : '';
      },
      csv: function () {
        return cache.data ? buildCsvText() : '';
      },
      comms: openCommsOverview
    };
  }

  init();
})();
