(function () {
  'use strict';

  if (window.__crmMapLoaded) return;
  window.__crmMapLoaded = true;

  var API_URL = '/graphql';
  var OVERLAY_ID = 'crm-map-overlay';
  var MODAL_ROOT_ID = 'crm-map-modal-root';
  var MAP_JS_URL = '/crm-map/maplibre-gl-5.9.0.js';
  var MAP_CSS_URL = '/crm-map/maplibre-gl-5.9.0.css';
  var MAP_UI_CSS_URL = '/crm-map/crm-map.css';
  var PROVINCE_URL = '/crm-map/china-provinces.geojson';
  var CITY_BOUNDARY_URL = '/crm-map/china-city-boundaries.geojson';
  var COUNTY_BOUNDARY_DIR = '/crm-map/counties/';
  var CITIES_URL = '/crm-map/china-cities.json';
  var POLL_MS = 60 * 1000;
  var CACHE_MS = 30 * 1000;
  var DEFAULT_CENTER = [104.2, 35.7];
  var DEFAULT_ZOOM = 3.6;
  var DEFAULT_PITCH = 52;
  var DEFAULT_BEARING = -9;
  var CLUSTER_ZOOM = 6.0;
  var STORAGE_ROTATE = 'crm-map-auto-rotate-v1';
  var STORAGE_CITIES = 'crm-map-show-cities-v1';
  var STORAGE_LAST_STYLE = 'crm-map-last-style-v1';
  var DEMO = !!window.__CRM_MAP_DEMO__;
  var PALETTE = ['#e5484d', '#f76b15', '#f5a623', '#30a46c', '#12a594', '#3e63dd', '#8e4ec6', '#e93d82', '#38d6ff'];
  var MAJOR_CITIES = {
    '北京': 1, '天津': 1, '上海': 1, '重庆': 1,
    '石家庄': 1, '太原': 1, '呼和浩特': 1, '沈阳': 1, '长春': 1, '哈尔滨': 1,
    '南京': 1, '杭州': 1, '合肥': 1, '福州': 1, '南昌': 1, '济南': 1, '郑州': 1,
    '武汉': 1, '长沙': 1, '广州': 1, '南宁': 1, '海口': 1, '成都': 1, '贵阳': 1,
    '昆明': 1, '拉萨': 1, '西安': 1, '兰州': 1, '西宁': 1, '银川': 1, '乌鲁木齐': 1,
    '香港': 1, '澳门': 1, '台北': 1, '深圳': 1, '苏州': 1, '宁波': 1, '青岛': 1,
    '厦门': 1, '大连': 1, '东莞': 1, '佛山': 1, '无锡': 1, '温州': 1, '泉州': 1,
    '烟台': 1, '常州': 1, '徐州': 1, '唐山': 1, '保定': 1
  };
  var MAJOR_CITY_ORDER = [
    '北京', '上海', '广州', '深圳', '杭州', '成都', '重庆', '武汉', '西安', '南京',
    '天津', '苏州', '郑州', '长沙', '青岛', '厦门', '宁波', '昆明', '合肥', '福州',
    '济南', '沈阳', '大连', '哈尔滨', '长春', '石家庄', '太原', '南昌', '贵阳', '南宁',
    '海口', '兰州', '西宁', '银川', '乌鲁木齐', '拉萨', '呼和浩特', '香港', '澳门', '台北'
  ];
  var MAJOR_CITY_RANK = {};
  MAJOR_CITY_ORDER.forEach(function (name, index) { MAJOR_CITY_RANK[name] = index; });
  var ETHNIC_GROUPS = '蒙古族|回族|藏族|维吾尔族|苗族|彝族|壮族|布依族|朝鲜族|满族|侗族|瑶族|白族|土家族|哈尼族|哈萨克族|傣族|黎族|傈僳族|佤族|畲族|高山族|拉祜族|水族|东乡族|纳西族|景颇族|柯尔克孜族|土族|达斡尔族|仫佬族|羌族|布朗族|撒拉族|毛南族|仡佬族|锡伯族|阿昌族|普米族|塔吉克族|怒族|乌孜别克族|俄罗斯族|鄂温克族|德昂族|保安族|裕固族|京族|塔塔尔族|独龙族|鄂伦春族|赫哲族|门巴族|珞巴族|基诺族|各族';
  var AUTONOMOUS_COUNTY_RE = new RegExp('^(.+?)(?:(?:' + ETHNIC_GROUPS + ')+)自治县$');
  var AUTONOMOUS_BANNER_RE = new RegExp('^(.+?)(?:(?:' + ETHNIC_GROUPS + ')+)自治旗$');
  var PROVINCE_LABEL_MAX_ZOOM = 5.0;
  var CAPITAL_MAX_ZOOM = 6.4;
  var PROVINCE_CAPITALS = {
    '北京': 1, '天津': 1, '上海': 1, '重庆': 1,
    '石家庄': 1, '太原': 1, '呼和浩特': 1, '沈阳': 1, '长春': 1, '哈尔滨': 1,
    '南京': 1, '杭州': 1, '合肥': 1, '福州': 1, '南昌': 1, '济南': 1, '郑州': 1,
    '武汉': 1, '长沙': 1, '广州': 1, '南宁': 1, '海口': 1, '成都': 1, '贵阳': 1,
    '昆明': 1, '拉萨': 1, '西安': 1, '兰州': 1, '西宁': 1, '银川': 1, '乌鲁木齐': 1,
    '香港': 1, '澳门': 1, '台北': 1
  };
  var FLAGS_QUERY =
    'query CrmMapFlags($after: String) {' +
    '  dealerFlags(first: 100, after: $after) {' +
    '    pageInfo { hasNextPage endCursor }' +
    '    edges { node {' +
    '      id name tag color city longitude latitude note createdAt updatedAt' +
    '    } }' +
    '  }' +
    '}';

  var state = {
    flags: [],
    selectedId: null,
    search: '',
    tag: null,
    placing: false,
    continuousPlacement: false,
    modalOpen: false,
    autoRotate: true,
    showCities: true,
    interacting: false,
    mapReady: false,
    cityResults: [],
    loadingFlags: false
  };

  var cache = {
    flags: null,
    ts: 0,
    promise: null,
    loaded: false,
    error: null,
    unauthorized: false
  };

  var overlay = null;
  var ui = {};
  var map = null;
  var mapReady = false;
  var mapLibPromise = null;
  var mapCssPromise = null;
  var mapUiCssPromise = null;
  var provinceGeo = null;
  var provinceIndex = [];
  var provinceStats = {};
  var cityBoundaryPromise = null;
  var cityBoundaryAdded = false;
  var cityBoundaryData = null;
  var countyCache = {};
  var countyLoading = {};
  var countyFailed = {};
  var countyProvinceAdcode = null;
  var countyLabelData = [];
  var countyLabelMarkers = {};
  var countyLabelTimer = null;
  var provinceLabelData = [];
  var provinceLabelMarkers = {};
  var provinceLabelTimer = null;
  var cities = [];
  var markers = {};
  var cityMarkers = {};
  var cityGroups = {};
  var cityLabelTimer = null;
  var rotateRAF = null;
  var rotateLast = 0;
  var interactTimer = null;
  var pollTimer = null;
  var searchTimer = null;
  var cityTimer = null;
  var collisionRAF = null;
  var toastTimer = null;
  var overlayPrevOverflow = '';
  var formState = null;
  var mapLoadTimer = null;
  var demoStore = null;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function setText(node, value) {
    if (node) node.textContent = value === undefined || value === null ? '' : String(value);
  }

  function icon(name) {
    var paths = {
      flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 3 2 3H5"/>',
      refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
      rotate: '<path d="M21 12a9 9 0 1 1-3.1-6.76"/><path d="M21 3v6h-6"/>',
      list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
      pin: '<path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
      home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>',
      close: '<path d="m6 6 12 12M18 6 6 18"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || '') + '</svg>';
  }

  function ensureUiCss() {
    if (document.getElementById('crm-map-ui-style')) return Promise.resolve();
    if (mapUiCssPromise) return mapUiCssPromise;
    mapUiCssPromise = new Promise(function (resolve, reject) {
      var link = document.createElement('link');
      link.id = 'crm-map-ui-style';
      link.rel = 'stylesheet';
      link.href = MAP_UI_CSS_URL;
      link.onload = function () { resolve(); };
      link.onerror = function () { reject(new Error('样式加载失败')); };
      document.head.appendChild(link);
    });
    return mapUiCssPromise;
  }

  function ensureLibs() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    if (mapLibPromise) return mapLibPromise;
    mapLibPromise = new Promise(function (resolve, reject) {
      var css = document.getElementById('crm-map-maplibre-style');
      if (!css) {
        css = document.createElement('link');
        css.id = 'crm-map-maplibre-style';
        css.rel = 'stylesheet';
        css.href = MAP_CSS_URL;
        document.head.appendChild(css);
      }

      var existing = document.getElementById('crm-map-maplibre-script');
      if (existing && window.maplibregl) {
        resolve(window.maplibregl);
        return;
      }

      var timer = window.setTimeout(function () {
        reject(new Error('地图库加载超时'));
      }, 25000);

      var script = document.createElement('script');
      script.id = 'crm-map-maplibre-script';
      script.src = MAP_JS_URL;
      script.async = true;
      script.onload = function () {
        window.clearTimeout(timer);
        if (window.maplibregl) resolve(window.maplibregl);
        else reject(new Error('地图库未初始化'));
      };
      script.onerror = function () {
        window.clearTimeout(timer);
        reject(new Error('地图库加载失败'));
      };
      document.body.appendChild(script);
    });
    mapLibPromise.catch(function () { mapLibPromise = null; });
    return mapLibPromise;
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
    } catch (error) {
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
        var typeError = new Error('unauthorized');
        typeError.unauthorized = true;
        throw typeError;
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

  function requestWithAuth(query, variables) {
    return request(API_URL, query, variables, false).catch(function (error) {
      if (error.unauthorized && getTokenPair()) {
        return request(API_URL, query, variables, true);
      }
      throw error;
    });
  }

  function graphql(query, variables) {
    return requestWithAuth(query, variables);
  }

  function formatError(error) {
    var message = (error && error.message) || '请求失败';
    if (error && error.unauthorized) return '登录状态已失效，请刷新页面后重试';
    if (/Cannot query field|Unknown field|dealerFlags.*not/i.test(message)) {
      return '经销商旗帜对象尚未初始化，请运行 scripts/setup-dealer-map.js';
    }
    return message;
  }

  function normalizeColor(value) {
    var text = String(value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(text)) return text.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(text)) {
      return ('#' + text[1] + text[1] + text[2] + text[2] + text[3] + text[3]).toLowerCase();
    }
    return PALETTE[0];
  }

  function truncate(value, max) {
    var text = String(value || '');
    var chars = Array.prototype.slice.call(text);
    if (chars.length <= max) return text;
    return chars.slice(0, max).join('') + '…';
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function fmtDateTime(value) {
    if (!value) return '—';
    var date = new Date(value);
    if (isNaN(date.getTime())) return '—';
    try {
      var parts = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).formatToParts(date);
      var mapParts = {};
      parts.forEach(function (part) { if (part.type !== 'literal') mapParts[part.type] = part.value; });
      return mapParts.year + '-' + mapParts.month + '-' + mapParts.day + ' ' + mapParts.hour + ':' + mapParts.minute;
    } catch (error) {
      return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate()) + ' ' + pad2(date.getHours()) + ':' + pad2(date.getMinutes());
    }
  }

  function fmtTimeShort(value) {
    if (!value) return '--:--';
    var date = new Date(value);
    if (isNaN(date.getTime())) return '--:--';
    try {
      return new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(date);
    } catch (error) {
      return pad2(date.getHours()) + ':' + pad2(date.getMinutes());
    }
  }

  function fmtCoord(value) {
    var number = Number(value);
    return isFinite(number) ? number.toFixed(6) : '—';
  }

  function haversine(lng1, lat1, lng2, lat2) {
    var toRad = Math.PI / 180;
    var dLat = (lat2 - lat1) * toRad;
    var dLng = (lng2 - lng1) * toRad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function nearestCityLabel(lng, lat) {
    var best = null;
    var bestDistance = Infinity;
    cities.forEach(function (city) {
      if (city.level !== 'city') return;
      var distance = haversine(lng, lat, city.lng, city.lat);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = city;
      }
    });
    return best && bestDistance <= 120 ? best.label : '';
  }

  function nearestCityForFlag(flag) {
    if (!flag) return '';
    if (cities.length && typeof flag.__nearestCity === 'string') return flag.__nearestCity;
    var nearest = nearestCityLabel(flag.longitude, flag.latitude) || '';
    if (cities.length) flag.__nearestCity = nearest;
    return nearest;
  }

  function sortTime(flag) {
    var value = flag.updatedAt || flag.createdAt;
    var time = value ? new Date(value).getTime() : 0;
    return isFinite(time) ? time : 0;
  }

  function validFlag(flag) {
    return flag && flag.id && isFinite(Number(flag.longitude)) && isFinite(Number(flag.latitude));
  }

  function matchesFilters(flag) {
    if (state.tag && (flag.tag || '').trim() !== state.tag) return false;
    var query = state.search.trim().toLowerCase();
    if (!query) return true;
    var text = [flag.name, flag.tag, flag.city, flag.note].join(' ');
    var nearest = nearestCityForFlag(flag);
    if (nearest) text += ' ' + nearest;
    return text.toLowerCase().indexOf(query) !== -1;
  }

  function filteredFlags() {
    return state.flags.filter(matchesFilters);
  }

  function tagColor(flag) {
    return normalizeColor(flag.color);
  }

  function buildTagChip(tag, color) {
    var chip = el('span', 'crm-map-tag-chip');
    var dot = el('span', 'crm-map-tag-dot');
    dot.style.setProperty('--dot-color', color || '#5b8cff');
    chip.appendChild(dot);
    chip.appendChild(document.createTextNode(tag));
    return chip;
  }

  function buildMiniFlag(color) {
    var node = el('span', 'crm-map-mini-flag');
    node.style.setProperty('--flag-color', normalizeColor(color));
    return node;
  }

  function defaultRotate() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    try {
      var stored = window.localStorage.getItem(STORAGE_ROTATE);
      if (stored === '0') return false;
      if (stored === '1') return true;
    } catch (error) {}
    return true;
  }

  function saveRotate(value) {
    try { window.localStorage.setItem(STORAGE_ROTATE, value ? '1' : '0'); } catch (error) {}
  }

  function defaultShowCities() {
    try {
      var stored = window.localStorage.getItem(STORAGE_CITIES);
      if (stored === '0') return false;
      if (stored === '1') return true;
    } catch (error) {}
    return true;
  }

  function saveShowCities(value) {
    try { window.localStorage.setItem(STORAGE_CITIES, value ? '1' : '0'); } catch (error) {}
  }

  function loadLastStyle() {
    try {
      var raw = window.localStorage.getItem(STORAGE_LAST_STYLE);
      if (!raw) return { color: '', tag: '' };
      var parsed = JSON.parse(raw);
      return {
        color: parsed && typeof parsed.color === 'string' ? parsed.color : '',
        tag: parsed && typeof parsed.tag === 'string' ? parsed.tag : ''
      };
    } catch (error) {
      return { color: '', tag: '' };
    }
  }

  function saveLastStyle(style) {
    try {
      window.localStorage.setItem(STORAGE_LAST_STYLE, JSON.stringify({
        color: style.color || '',
        tag: style.tag || ''
      }));
    } catch (error) {}
  }

  function showToast(message, actionLabel, actionFn, duration) {
    if (!ui.toast) return;
    ui.toast.innerHTML = '';
    ui.toast.classList.remove('has-action');
    ui.toast.appendChild(el('span', 'crm-map-toast-text', message));
    if (actionLabel && typeof actionFn === 'function') {
      var action = el('button', 'crm-map-toast-action', actionLabel);
      action.type = 'button';
      action.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        hideToast();
        actionFn();
      });
      ui.toast.appendChild(action);
      ui.toast.classList.add('has-action');
    }
    ui.toast.classList.add('show');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastTimer = null;
      ui.toast.classList.remove('show');
    }, duration || (actionLabel ? 6500 : 2800));
  }

  function hideToast() {
    if (!ui.toast) return;
    if (toastTimer) {
      window.clearTimeout(toastTimer);
      toastTimer = null;
    }
    ui.toast.classList.remove('show');
  }

  function showLoading(title, text) {
    if (!ui.loading) return;
    ui.loading.classList.remove('hidden');
    if (ui.loadingSpinner) ui.loadingSpinner.style.display = '';
    setText(ui.loadingTitle, title || '正在加载 3D 地图…');
    setText(ui.loadingText, text || '');
    if (ui.loadingRetry) ui.loadingRetry.style.display = 'none';
    if (ui.loadingError) ui.loadingError.textContent = '';
  }

  function hideLoading() {
    if (ui.loading) ui.loading.classList.add('hidden');
  }

  function showFatal(title, message, retry) {
    if (!ui.loading) return;
    ui.loading.classList.remove('hidden');
    if (ui.loadingSpinner) ui.loadingSpinner.style.display = 'none';
    setText(ui.loadingTitle, title || '地图加载失败');
    setText(ui.loadingText, '');
    if (ui.loadingError) ui.loadingError.textContent = message || '';
    if (ui.loadingRetry) {
      ui.loadingRetry.style.display = '';
      ui.loadingRetry.onclick = function () {
        if (typeof retry === 'function') retry();
      };
    }
  }

  function buildOverlay() {
    if (overlay) return overlay;

    overlay = el('div');
    overlay.id = OVERLAY_ID;
    overlay.style.display = 'none';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '经销商地图');

    ui.canvas = el('div');
    ui.canvas.id = 'crm-map-canvas';
    overlay.appendChild(ui.canvas);
    overlay.appendChild(el('div', 'crm-map-vignette'));

    var topbar = el('div', 'crm-map-topbar');
    var brand = el('div', 'crm-map-brand');
    var logo = el('div', 'crm-map-logo');
    logo.innerHTML = icon('flag');
    brand.appendChild(logo);
    var brandText = el('div');
    brandText.appendChild(el('div', 'crm-map-title', '经销商地图'));
    ui.sub = el('div', 'crm-map-sub', DEMO ? '演示数据' : '全国经销商旗帜');
    brandText.appendChild(ui.sub);
    brand.appendChild(brandText);
    topbar.appendChild(brand);

    var actions = el('div', 'crm-map-top-actions');
    var kpis = el('div', 'crm-map-kpis');
    function kpi(label, key) {
      var box = el('div', 'crm-map-kpi');
      box.appendChild(el('div', 'crm-map-kpi-label', label));
      var value = el('div', 'crm-map-kpi-value', '—');
      value.setAttribute('data-kpi', key);
      box.appendChild(value);
      return box;
    }
    kpis.appendChild(kpi('旗帜', 'flags'));
    kpis.appendChild(kpi('省份', 'provinces'));
    kpis.appendChild(kpi('城市', 'cities'));
    kpis.appendChild(kpi('近7天', 'week'));
    actions.appendChild(kpis);

    ui.placeButton = el('button', 'crm-map-btn primary');
    ui.placeButton.type = 'button';
    ui.placeButton.innerHTML = icon('flag') + '<span class="crm-map-btn-label">放置旗帜</span>';
    ui.placeButton.title = '进入放置模式，然后点击地图';
    ui.placeButton.setAttribute('aria-label', '放置旗帜');
    ui.placeButton.addEventListener('click', function () {
      if (state.placing) cancelPlacement();
      else enterPlacement();
    });
    actions.appendChild(ui.placeButton);

    ui.refreshButton = el('button', 'crm-map-icon-btn');
    ui.refreshButton.type = 'button';
    ui.refreshButton.innerHTML = icon('refresh');
    ui.refreshButton.title = '刷新旗帜';
    ui.refreshButton.setAttribute('aria-label', '刷新旗帜');
    ui.refreshButton.addEventListener('click', function () {
      loadFlags(true).catch(function (error) {
        showToast(formatError(error));
      });
    });
    actions.appendChild(ui.refreshButton);

    ui.rotateButton = el('button', 'crm-map-icon-btn');
    ui.rotateButton.type = 'button';
    ui.rotateButton.innerHTML = icon('rotate');
    ui.rotateButton.title = '自动旋转';
    ui.rotateButton.setAttribute('aria-label', '自动旋转');
    ui.rotateButton.addEventListener('click', toggleRotate);
    actions.appendChild(ui.rotateButton);

    ui.cityButton = el('button', 'crm-map-icon-btn');
    ui.cityButton.type = 'button';
    ui.cityButton.innerHTML = icon('pin');
    ui.cityButton.title = '城市名称';
    ui.cityButton.setAttribute('aria-label', '城市名称');
    ui.cityButton.classList.toggle('active', state.showCities);
    ui.cityButton.addEventListener('click', toggleCityLabels);
    actions.appendChild(ui.cityButton);

    ui.mobileListButton = el('button', 'crm-map-icon-btn crm-map-mobile-list');
    ui.mobileListButton.type = 'button';
    ui.mobileListButton.innerHTML = icon('list');
    ui.mobileListButton.title = '旗帜列表';
    ui.mobileListButton.setAttribute('aria-label', '旗帜列表');
    ui.mobileListButton.addEventListener('click', function () {
      if (ui.sidebar) ui.sidebar.classList.toggle('mobile-open');
    });
    actions.appendChild(ui.mobileListButton);

    ui.closeButton = el('button', 'crm-map-close', '×');
    ui.closeButton.type = 'button';
    ui.closeButton.setAttribute('aria-label', '关闭经销商地图');
    ui.closeButton.addEventListener('click', closeMap);
    actions.appendChild(ui.closeButton);

    topbar.appendChild(actions);
    overlay.appendChild(topbar);

    ui.sidebar = el('aside', 'crm-map-sidebar');
    var sideHead = el('div', 'crm-map-sidebar-head');
    var sideHeadText = el('div');
    sideHeadText.appendChild(el('div', 'crm-map-sidebar-title', '旗帜列表'));
    ui.count = el('div', 'crm-map-sidebar-count', '正在加载…');
    sideHeadText.appendChild(ui.count);
    sideHead.appendChild(sideHeadText);
    ui.sidebar.appendChild(sideHead);

    var cityWrap = el('div', 'crm-map-input-wrap crm-map-city-wrap');
    var cityIcon = el('span');
    cityIcon.innerHTML = icon('search');
    cityWrap.appendChild(cityIcon.firstChild);
    ui.cityInput = el('input', 'crm-map-input');
    ui.cityInput.type = 'text';
    ui.cityInput.placeholder = '定位城市，如 杭州';
    ui.cityInput.autocomplete = 'off';
    cityWrap.appendChild(ui.cityInput);
    ui.cityResults = el('div', 'crm-map-city-results');
    cityWrap.appendChild(ui.cityResults);
    ui.sidebar.appendChild(cityWrap);

    var searchWrap = el('div', 'crm-map-input-wrap');
    var searchIcon = el('span');
    searchIcon.innerHTML = icon('search');
    searchWrap.appendChild(searchIcon.firstChild);
    ui.searchInput = el('input', 'crm-map-input');
    ui.searchInput.type = 'text';
    ui.searchInput.placeholder = '搜索旗帜 / 标签 / 城市';
    ui.searchInput.autocomplete = 'off';
    searchWrap.appendChild(ui.searchInput);
    ui.sidebar.appendChild(searchWrap);

    ui.tags = el('div', 'crm-map-tags');
    ui.sidebar.appendChild(ui.tags);

    ui.list = el('div', 'crm-map-list');
    ui.sidebar.appendChild(ui.list);

    var sideFoot = el('div', 'crm-map-sidebar-foot', '拖动调整位置 · 城市数字 = 该市旗帜数 · 点击查看详情');
    ui.sidebar.appendChild(sideFoot);
    overlay.appendChild(ui.sidebar);

    ui.detail = el('aside', 'crm-map-detail');
    var detailHead = el('div', 'crm-map-detail-head');
    ui.detailFlag = el('span', 'crm-map-mini-flag');
    detailHead.appendChild(ui.detailFlag);
    var detailTitleWrap = el('div', 'crm-map-detail-title-wrap');
    ui.detailTitle = el('div', 'crm-map-detail-title', '旗帜');
    detailTitleWrap.appendChild(ui.detailTitle);
    ui.detailSub = el('div', 'crm-map-detail-sub');
    detailTitleWrap.appendChild(ui.detailSub);
    detailHead.appendChild(detailTitleWrap);
    var detailClose = el('button', 'crm-map-close small', '×');
    detailClose.type = 'button';
    detailClose.setAttribute('aria-label', '关闭旗帜详情');
    detailClose.addEventListener('click', closeDetail);
    detailHead.appendChild(detailClose);
    ui.detail.appendChild(detailHead);

    ui.detailBody = el('div', 'crm-map-detail-body');
    ui.detail.appendChild(ui.detailBody);

    var detailActions = el('div', 'crm-map-detail-actions');
    ui.editButton = el('button', 'crm-map-btn', '编辑');
    ui.editButton.type = 'button';
    ui.editButton.addEventListener('click', function () {
      var flag = findFlag(state.selectedId);
      if (flag) openForm('edit', flag);
    });
    detailActions.appendChild(ui.editButton);

    ui.flyButton = el('button', 'crm-map-btn', '定位');
    ui.flyButton.type = 'button';
    ui.flyButton.addEventListener('click', function () {
      var flag = findFlag(state.selectedId);
      if (flag) flyToFlag(flag);
    });
    detailActions.appendChild(ui.flyButton);

    ui.copyButton = el('button', 'crm-map-btn', '复制坐标');
    ui.copyButton.type = 'button';
    ui.copyButton.addEventListener('click', function () {
      var flag = findFlag(state.selectedId);
      if (flag) copyCoordinates(flag);
    });
    detailActions.appendChild(ui.copyButton);

    ui.deleteButton = el('button', 'crm-map-btn danger', '删除');
    ui.deleteButton.type = 'button';
    ui.deleteButton.addEventListener('click', function () {
      var flag = findFlag(state.selectedId);
      if (flag) openDeleteConfirm(flag);
    });
    detailActions.appendChild(ui.deleteButton);
    ui.detail.appendChild(detailActions);
    overlay.appendChild(ui.detail);

    var controls = el('div', 'crm-map-controls');
    var zoomIn = el('button', 'crm-map-control', '+');
    zoomIn.type = 'button';
    zoomIn.title = '放大';
    zoomIn.setAttribute('aria-label', '放大');
    zoomIn.addEventListener('click', function () { if (map) map.zoomIn(); });
    controls.appendChild(zoomIn);
    var zoomOut = el('button', 'crm-map-control', '−');
    zoomOut.type = 'button';
    zoomOut.title = '缩小';
    zoomOut.setAttribute('aria-label', '缩小');
    zoomOut.addEventListener('click', function () { if (map) map.zoomOut(); });
    controls.appendChild(zoomOut);
    var reset = el('button', 'crm-map-control');
    reset.type = 'button';
    reset.title = '重置视角';
    reset.setAttribute('aria-label', '重置视角');
    reset.innerHTML = icon('home');
    reset.addEventListener('click', resetView);
    controls.appendChild(reset);
    overlay.appendChild(controls);

    var legend = el('div', 'crm-map-legend');
    legend.appendChild(el('span', 'crm-map-legend-bar'));
    legend.appendChild(el('span', '', '3D 高度 = 省旗数 · 城市数字 = 市旗数'));
    overlay.appendChild(legend);

    ui.tooltip = el('div', 'crm-map-tooltip');
    overlay.appendChild(ui.tooltip);

    ui.placement = el('div', 'crm-map-placement');
    ui.placement.appendChild(el('span', '', '点击地图放置旗帜'));
    var cancelPlacementButton = el('button', 'crm-map-btn', '取消');
    cancelPlacementButton.type = 'button';
    cancelPlacementButton.addEventListener('click', cancelPlacement);
    ui.placement.appendChild(cancelPlacementButton);
    overlay.appendChild(ui.placement);

    ui.ghost = el('div', 'crm-map-ghost');
    var ghostFlag = el('div', 'crm-map-ghost-flag');
    ui.ghost.appendChild(ghostFlag);
    ui.ghost.appendChild(el('span', 'crm-map-ghost-dot'));
    overlay.appendChild(ui.ghost);

    ui.loading = el('div', 'crm-map-loading');
    ui.loadingSpinner = el('div', 'crm-map-spinner');
    ui.loading.appendChild(ui.loadingSpinner);
    ui.loadingTitle = el('div', 'crm-map-loading-title', '正在加载 3D 地图…');
    ui.loading.appendChild(ui.loadingTitle);
    ui.loadingText = el('div', 'crm-map-loading-text', '');
    ui.loading.appendChild(ui.loadingText);
    ui.loadingError = el('div', 'crm-map-loading-error');
    ui.loading.appendChild(ui.loadingError);
    ui.loadingRetry = el('button', 'crm-map-btn primary', '重试');
    ui.loadingRetry.type = 'button';
    ui.loadingRetry.style.display = 'none';
    ui.loading.appendChild(ui.loadingRetry);
    overlay.appendChild(ui.loading);

    ui.modalRoot = el('div');
    ui.modalRoot.id = MODAL_ROOT_ID;
    ui.modalRoot.addEventListener('click', function (event) {
      event.stopPropagation();
    });
    overlay.appendChild(ui.modalRoot);

    ui.toast = el('div', 'crm-map-toast');
    overlay.appendChild(ui.toast);

    var datalist = document.createElement('datalist');
    datalist.id = 'crm-map-city-datalist';
    overlay.appendChild(datalist);
    ui.cityDatalist = datalist;

    document.body.appendChild(overlay);

    ui.rotateButton.classList.toggle('active', state.autoRotate);

    ui.searchInput.addEventListener('input', function () {
      if (searchTimer) window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(function () {
        searchTimer = null;
        state.search = ui.searchInput.value || '';
        renderList();
        applyFiltersAndCollision();
        updateProvinceData();
      }, 140);
    });
    ui.cityInput.addEventListener('input', function () {
      if (cityTimer) window.clearTimeout(cityTimer);
      cityTimer = window.setTimeout(function () {
        cityTimer = null;
        renderCityResults(ui.cityInput.value || '');
      }, 120);
    });
    ui.cityInput.addEventListener('focus', function () {
      if ((ui.cityInput.value || '').trim()) renderCityResults(ui.cityInput.value);
    });
    ui.cityInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        var first = ui.cityResults.querySelector('.crm-map-city-result');
        if (first) {
          event.preventDefault();
          first.click();
        }
      } else if (event.key === 'Escape') {
        event.stopPropagation();
        hideCityResults();
      }
    });
    ui.cityInput.addEventListener('blur', function () {
      window.setTimeout(hideCityResults, 160);
    });

    document.addEventListener('click', function (event) {
      if (ui.cityResults && ui.cityResults.classList.contains('show')) {
        if (ui.cityInput && event.target !== ui.cityInput && !ui.cityResults.contains(event.target)) {
          hideCityResults();
        }
      }
    });

    document.addEventListener('keydown', function (event) {
      if (!overlay || overlay.style.display === 'none') return;
      if (event.key !== 'Escape') return;
      if (state.modalOpen) return;
      if (state.placing) {
        event.preventDefault();
        cancelPlacement();
        return;
      }
      if (state.selectedId) {
        event.preventDefault();
        closeDetail();
      }
    });

    window.addEventListener('resize', function () {
      if (map && overlay && overlay.style.display !== 'none') {
        map.resize();
        scheduleCollision();
      }
    });

    return overlay;
  }

  function openMap() {
    ensureUiCss().catch(function () {});
    state.autoRotate = defaultRotate();
    state.showCities = defaultShowCities();
    buildOverlay();
    if (ui.rotateButton) ui.rotateButton.classList.toggle('active', state.autoRotate);
    if (ui.cityButton) ui.cityButton.classList.toggle('active', state.showCities);
    overlay.style.display = 'block';
    overlayPrevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    startPoll();
    startRotate();

    window.requestAnimationFrame(function () {
      if (map) {
        map.resize();
        scheduleCollision();
        scheduleCityLabels();
        scheduleCountyLabels();
        scheduleProvinceLabels();
        maybeLoadCityBoundaries();
        updateCountyBoundaries();
      }
    });

    if (map) {
      if (cache.loaded && Date.now() - cache.ts >= CACHE_MS) {
        loadFlags(true).catch(function () {});
      }
      return;
    }

    bootstrap();
  }

  function closeMap() {
    if (!overlay) return;
    cancelPlacement();
    closeModal(true);
    closeDetail();
    stopRotate();
    stopPoll();
    overlay.style.display = 'none';
    document.body.style.overflow = overlayPrevOverflow || '';
  }

  function bootstrap() {
    if (map) {
      try { map.remove(); } catch (error) {}
      map = null;
      mapReady = false;
      state.mapReady = false;
      markers = {};
    }
    showLoading('正在加载 3D 地图…', '首次打开会加载本地地图资源，不依赖任何在线瓦片');
    if (mapLoadTimer) window.clearTimeout(mapLoadTimer);
    mapLoadTimer = window.setTimeout(function () {
      if (!mapReady) {
        showFatal('地图加载超时', '请检查 /crm-map/ 静态资源是否可访问，或换用 Chrome / Edge 重试。', bootstrap);
      }
    }, 22000);

    ensureLibs()
      .then(function () {
        return loadProvinceGeo();
      })
      .then(function (geo) {
        prepareProvinceIndex(geo);
        initMap();
      })
      .catch(function (error) {
        if (mapLoadTimer) window.clearTimeout(mapLoadTimer);
        showFatal('地图加载失败', (error && error.message) || '未知错误', bootstrap);
      });

    loadCities().catch(function () {});
    loadFlags(false).catch(function () {});
  }

  function initMap() {
    if (!window.maplibregl) return;
    var style = {
      version: 8,
      name: 'crm-dealer-map',
      sources: {
        provinces: {
          type: 'geojson',
          data: provinceGeo,
          promoteId: 'adcode'
        }
      },
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: { 'background-color': '#05070d' }
        },
        {
          id: 'province-base',
          type: 'fill',
          source: 'provinces',
          paint: { 'fill-color': '#0d1830', 'fill-opacity': 0.96 }
        },
        {
          id: 'province-fill',
          type: 'fill-extrusion',
          source: 'provinces',
          paint: {
            'fill-extrusion-color': [
              'step',
              ['get', 'count'],
              '#1b2d4f',
              1, '#2457a8',
              2, '#2f6fed',
              4, '#1fb6d8',
              7, '#8b5cf6',
              12, '#ff5c8a'
            ],
            'fill-extrusion-height': [
              'interpolate',
              ['exponential', 2],
              ['zoom'],
              3,
              ['+', 260000, ['*', ['min', ['get', 'count'], 12], 85000]],
              5,
              ['+', 65000, ['*', ['min', ['get', 'count'], 12], 21250]],
              7,
              ['+', 8000, ['*', ['min', ['get', 'count'], 12], 2600]],
              10,
              ['+', 500, ['*', ['min', ['get', 'count'], 12], 162.5]]
            ],
            'fill-extrusion-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              3,
              0.95,
              4.5,
              0.92,
              5.2,
              0.65,
              5.9,
              0.2,
              6.4,
              0
            ],
            'fill-extrusion-vertical-gradient': true
          }
        },
        {
          id: 'province-glow',
          type: 'line',
          source: 'provinces',
          paint: {
            'line-color': '#2f6fed',
            'line-opacity': 0.22,
            'line-width': 4,
            'line-blur': 3
          }
        },
        {
          id: 'province-line',
          type: 'line',
          source: 'provinces',
          paint: {
            'line-color': '#5b8cff',
            'line-opacity': 0.5,
            'line-width': 1.1
          }
        }
      ],
      light: {
        anchor: 'viewport',
        color: '#ffffff',
        intensity: 0.5,
        position: [1.4, 90, 48]
      }
    };

    try {
      map = new window.maplibregl.Map({
        container: ui.canvas,
        style: style,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: DEFAULT_PITCH,
        bearing: DEFAULT_BEARING,
        attributionControl: false,
        maxZoom: 11,
        minZoom: 2.2,
        dragRotate: true,
        pitchWithRotate: true,
        touchZoomRotate: true,
        renderWorldCopies: false
      });
    } catch (error) {
      showFatal('无法创建 3D 地图', '当前浏览器可能不支持 WebGL，请使用 Chrome / Edge 打开。', bootstrap);
      return;
    }

    map.on('load', function () {
      mapReady = true;
      state.mapReady = true;
      if (mapLoadTimer) window.clearTimeout(mapLoadTimer);
      hideLoading();
      map.resize();
      map.easeTo({ padding: mapPadding(false), duration: 0 });
      bindMapEvents();
      syncMarkers();
      updateProvinceData();
      updateKpis();
      ensureCityMarkers();
      updateCityLabels();
      ensureProvinceLabelMarkers();
      updateProvinceLabels();
      scheduleCollision();
      maybeLoadCityBoundaries();
      updateCountyBoundaries();
      startRotate();
    });

    map.on('error', function (event) {
      if (event && event.error) {
        window.__crmMapLastError = String(event.error.message || event.error);
      }
      if (event && event.error && /webgl/i.test(event.error.message || '')) {
        showFatal('WebGL 初始化失败', '请使用 Chrome / Edge，并确认浏览器已开启硬件加速。', bootstrap);
      }
    });
  }

  function bindMapEvents() {
    if (!map) return;

    map.on('mousemove', function (event) {
      if (state.placing) {
        ui.ghost.style.left = event.point.x + 'px';
        ui.ghost.style.top = event.point.y + 'px';
        ui.ghost.classList.add('show');
      }
    });
    map.on('mouseout', function () {
      if (state.placing) ui.ghost.classList.remove('show');
    });
    map.on('click', function (event) {
      if (state.modalOpen) return;
      if (state.placing) {
        var lngLat = { lng: event.lngLat.lng, lat: event.lngLat.lat };
        var continuous = state.continuousPlacement;
        cancelPlacement();
        openForm('create', null, lngLat, continuous);
        return;
      }
      closeDetail();
    });
    map.on('mousemove', 'province-fill', function (event) {
      if (state.placing) return;
      var feature = event.features && event.features[0];
      if (!feature) return;
      showProvinceTooltip(event, feature);
    });
    map.on('mouseleave', 'province-fill', function () {
      hideTooltip();
    });
    map.on('dragstart', function () {
      pauseAutoRotate();
      hideTooltip();
    });
    map.on('zoomstart', function () {
      pauseAutoRotate();
      hideTooltip();
    });
    map.on('rotatestart', function () {
      pauseAutoRotate();
    });
    map.on('pitchstart', function () {
      pauseAutoRotate();
    });
    map.on('wheel', pauseAutoRotate);
    map.on('touchstart', pauseAutoRotate);
    map.on('moveend', scheduleCollision);
    map.on('moveend', updateCountyBoundaries);
    map.on('zoomend', scheduleCollision);
    map.on('zoomend', updateCityLabels);
    map.on('zoomend', maybeLoadCityBoundaries);
    map.on('zoomend', updateCountyBoundaries);
    map.on('rotateend', scheduleCollision);
    map.on('pitchend', scheduleCollision);
    map.on('resize', scheduleCollision);
    map.on('moveend', scheduleCityLabels);
    map.on('resize', scheduleCityLabels);
    map.on('moveend', scheduleCountyLabels);
    map.on('zoomend', scheduleCountyLabels);
    map.on('resize', scheduleCountyLabels);
    map.on('moveend', scheduleProvinceLabels);
    map.on('zoomend', scheduleProvinceLabels);
    map.on('resize', scheduleProvinceLabels);
  }

  function pauseAutoRotate() {
    state.interacting = true;
    if (interactTimer) window.clearTimeout(interactTimer);
    interactTimer = window.setTimeout(function () {
      interactTimer = null;
      state.interacting = false;
    }, 8000);
  }

  function startRotate() {
    if (!state.autoRotate || rotateRAF) return;
    rotateLast = 0;
    rotateRAF = window.requestAnimationFrame(rotateTick);
  }

  function stopRotate() {
    if (rotateRAF) window.cancelAnimationFrame(rotateRAF);
    rotateRAF = null;
  }

  function rotateTick(ts) {
    rotateRAF = null;
    if (!overlay || overlay.style.display === 'none' || !mapReady || !state.autoRotate) return;
    if (!state.interacting && !state.modalOpen && !state.selectedId) {
      if (!rotateLast) rotateLast = ts;
      if (ts - rotateLast > 50) {
        map.setBearing(map.getBearing() + 0.035);
        rotateLast = ts;
      }
    } else {
      rotateLast = ts;
    }
    rotateRAF = window.requestAnimationFrame(rotateTick);
  }

  function toggleRotate() {
    state.autoRotate = !state.autoRotate;
    saveRotate(state.autoRotate);
    if (ui.rotateButton) ui.rotateButton.classList.toggle('active', state.autoRotate);
    if (state.autoRotate) startRotate();
    else stopRotate();
  }

  function toggleCityLabels() {
    state.showCities = !state.showCities;
    saveShowCities(state.showCities);
    if (ui.cityButton) ui.cityButton.classList.toggle('active', state.showCities);
    updateCityLabels();
    updateCountyLabels();
    updateProvinceLabels();
  }

  function mapPadding(withDetail) {
    var width = overlay ? overlay.clientWidth : window.innerWidth;
    if (width <= 820) {
      return { top: 82, right: 40, bottom: withDetail ? 320 : 30, left: 10 };
    }
    return { top: 92, right: withDetail ? 370 : 80, bottom: 46, left: 330 };
  }

  function resetView() {
    if (!map) return;
    state.interacting = true;
    map.flyTo({
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: DEFAULT_PITCH,
      bearing: DEFAULT_BEARING,
      padding: mapPadding(false),
      duration: 1000
    });
    window.setTimeout(function () { state.interacting = false; }, 1300);
  }

  function loadProvinceGeo() {
    if (provinceGeo) return Promise.resolve(provinceGeo);
    return fetch(PROVINCE_URL, { cache: 'force-cache' }).then(function (response) {
      if (!response.ok) throw new Error('省份边界加载失败（HTTP ' + response.status + '）');
      return response.json();
    }).then(function (json) {
      if (!json || !Array.isArray(json.features)) throw new Error('省份边界格式不正确');
      provinceGeo = json;
      return json;
    });
  }

  function addCityBoundaryLayer(geo) {
    if (!map || !mapReady || cityBoundaryAdded) return;
    if (!map.getSource('city-boundaries')) {
      map.addSource('city-boundaries', { type: 'geojson', data: geo });
    }
    if (!map.getLayer('city-boundary-line')) {
      var layer = {
        id: 'city-boundary-line',
        type: 'line',
        source: 'city-boundaries',
        minzoom: 5.2,
        paint: {
          'line-color': '#6f9bdd',
          'line-width': ['interpolate', ['linear'], ['zoom'], 5.2, 0.4, 6.5, 0.75, 9, 1.1, 12, 1.5],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 5.2, 0, 5.8, 0.32, 7, 0.58, 10, 0.72]
        }
      };
      try {
        map.addLayer(layer, 'province-line');
      } catch (error) {
        map.addLayer(layer);
      }
    }
    cityBoundaryAdded = true;
  }

  function loadCityBoundaries() {
    if (cityBoundaryAdded) return Promise.resolve();
    if (cityBoundaryPromise) return cityBoundaryPromise;
    cityBoundaryPromise = fetch(CITY_BOUNDARY_URL, { cache: 'force-cache' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (geo) {
        if (!geo || !Array.isArray(geo.features)) throw new Error('城市边界格式不正确');
        cityBoundaryData = geo;
        if (map && mapReady) addCityBoundaryLayer(geo);
      })
      .catch(function (error) {
        cityBoundaryPromise = null;
        showToast('城市边界加载失败，请稍后重试');
        throw error;
      });
    return cityBoundaryPromise;
  }

  function maybeLoadCityBoundaries() {
    if (!map || !mapReady || cityBoundaryAdded) return;
    if (map.getZoom() < 5.2) return;
    if (cityBoundaryData) {
      addCityBoundaryLayer(cityBoundaryData);
      return;
    }
    loadCityBoundaries().catch(function () {});
  }

  function addCountyBoundaryLayer(geo) {
    if (!map || !mapReady) return;
    if (!map.getSource('county-boundaries')) {
      map.addSource('county-boundaries', { type: 'geojson', data: geo });
      var layer = {
        id: 'county-boundary-line',
        type: 'line',
        source: 'county-boundaries',
        minzoom: 6.8,
        paint: {
          'line-color': '#4c78b8',
          'line-width': ['interpolate', ['linear'], ['zoom'], 6.8, 0.35, 8, 0.7, 10, 1, 12, 1.25],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 6.8, 0, 7.4, 0.3, 9, 0.45, 12, 0.58]
        }
      };
      var before = map.getLayer('city-boundary-line') ? 'city-boundary-line' : 'province-line';
      try {
        map.addLayer(layer, before);
      } catch (error) {
        map.addLayer(layer);
      }
    } else {
      map.getSource('county-boundaries').setData(geo);
    }

    countyLabelData = (geo.features || []).map(function (feature) {
      var point = countyLabelPoint(feature);
      var props = feature.properties || {};
      if (!point || !props.adcode || !props.name) return null;
      return {
        adcode: String(props.adcode),
        name: props.name,
        short: countyShortName(props.name),
        province: props.province || '',
        city: props.city || '',
        lng: point[0],
        lat: point[1]
      };
    }).filter(Boolean);
    removeCountyLabelMarkers();
    updateCountyLabels();
  }

  function updateCountyBoundaries() {
    if (!map || !mapReady) return;
    if (map.getZoom() < 6.8) return;
    var center = map.getCenter();
    var province = provinceForPoint(center.lng, center.lat);
    if (!province) return;
    var adcode = String(province.adcode);
    if (countyProvinceAdcode === adcode) return;
    if (countyCache[adcode]) {
      addCountyBoundaryLayer(countyCache[adcode]);
      countyProvinceAdcode = adcode;
      return;
    }
    if (countyFailed[adcode] || countyLoading[adcode]) return;

    if (map.getSource('county-boundaries')) {
      map.getSource('county-boundaries').setData({ type: 'FeatureCollection', features: [] });
    }
    countyLabelData = [];
    removeCountyLabelMarkers();
    countyProvinceAdcode = null;
    countyLoading[adcode] = true;
    fetch(COUNTY_BOUNDARY_DIR + adcode + '.geojson', { cache: 'force-cache' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (geo) {
        if (!geo || !Array.isArray(geo.features)) throw new Error('区县边界格式不正确');
        countyCache[adcode] = geo;
        if (!map || !mapReady) return;
        var current = provinceForPoint(map.getCenter().lng, map.getCenter().lat);
        if (current && String(current.adcode) === adcode) {
          addCountyBoundaryLayer(geo);
          countyProvinceAdcode = adcode;
        }
      })
      .catch(function (error) {
        countyFailed[adcode] = true;
        console.warn('区县边界加载失败', adcode, error && error.message);
      })
      .then(function () {
        delete countyLoading[adcode];
      });
  }

  function ringSignedArea(ring) {
    var area = 0;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    }
    return area / 2;
  }

  function ringCentroid(ring) {
    var area = ringSignedArea(ring);
    if (!area) {
      var sx = 0;
      var sy = 0;
      ring.forEach(function (point) { sx += point[0]; sy += point[1]; });
      return [sx / ring.length, sy / ring.length];
    }
    var cx = 0;
    var cy = 0;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      cx += (ring[j][0] + ring[i][0]) * cross;
      cy += (ring[j][1] + ring[i][1]) * cross;
    }
    return [cx / (6 * area), cy / (6 * area)];
  }

  function countyLabelPoint(feature) {
    var geometry = feature && feature.geometry;
    if (!geometry) return null;
    var polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
    var bestRing = null;
    var bestArea = 0;
    polygons.forEach(function (polygon) {
      var ring = polygon && polygon[0];
      if (!ring || ring.length < 3) return;
      var area = Math.abs(ringSignedArea(ring));
      if (area > bestArea) {
        bestArea = area;
        bestRing = ring;
      }
    });
    return bestRing ? ringCentroid(bestRing) : null;
  }

  function countyShortName(name) {
    var text = String(name || '');
    var matched = text.match(AUTONOMOUS_COUNTY_RE) || text.match(AUTONOMOUS_BANNER_RE);
    if (matched && matched[1]) return matched[1];
    return text
      .replace(/(?:自治县|自治旗)$/, '')
      .replace(/族$/, '')
      .replace(/林区$/, '')
      .replace(/[区县市旗]$/, '') || text;
  }

  function removeCountyLabelMarkers() {
    Object.keys(countyLabelMarkers).forEach(function (key) {
      try { countyLabelMarkers[key].marker.remove(); } catch (error) {}
      delete countyLabelMarkers[key];
    });
  }

  function ensureCountyLabelMarker(item) {
    var markerEl = document.createElement('div');
    markerEl.className = 'crm-map-county-marker';
    var dot = document.createElement('span');
    dot.className = 'crm-map-county-dot';
    var name = document.createElement('span');
    name.className = 'crm-map-county-name';
    name.textContent = item.short;
    var anchorRight = Number(item.lng) > 122;
    if (anchorRight) {
      markerEl.appendChild(name);
      markerEl.appendChild(dot);
    } else {
      markerEl.appendChild(dot);
      markerEl.appendChild(name);
    }
    markerEl.style.display = 'none';
    markerEl.title = item.name + (item.city ? ' · ' + item.city : '');
    var marker = new window.maplibregl.Marker({
      element: markerEl,
      anchor: anchorRight ? 'right' : 'left',
      pitchAlignment: 'viewport',
      rotationAlignment: 'viewport'
    })
      .setLngLat([item.lng, item.lat])
      .addTo(map);
    return { marker: marker, el: markerEl, nameEl: name, item: item, anchorRight: anchorRight };
  }

  function updateCountyLabels() {
    if (!map || !mapReady) return;
    if (!state.showCities || map.getZoom() < 7.2 || !countyLabelData.length) {
      Object.keys(countyLabelMarkers).forEach(function (key) {
        countyLabelMarkers[key].el.style.display = 'none';
      });
      return;
    }

    var bounds = map.getBounds();
    var center = map.getCenter();
    var list = countyLabelData.filter(function (item) {
      return bounds.contains([item.lng, item.lat]);
    });
    list.sort(function (a, b) {
      var ad = Math.pow(a.lng - center.lng, 2) + Math.pow(a.lat - center.lat, 2);
      var bd = Math.pow(b.lng - center.lng, 2) + Math.pow(b.lat - center.lat, 2);
      return ad - bd;
    });
    if (list.length > 55) list = list.slice(0, 55);

    var blockers = [];
    Object.keys(cityMarkers).forEach(function (key) {
      var entry = cityMarkers[key];
      if (entry.el.style.display === 'none') return;
      blockers.push(map.project([entry.city.lng, entry.city.lat]));
    });
    Object.keys(markers).forEach(function (id) {
      var entry = markers[id];
      if (!entry) return;
      if (entry.el.classList.contains('crm-map-flag-filtered') ||
        entry.el.classList.contains('crm-map-flag-clustered') ||
        entry.el.classList.contains('crm-map-flag-collided')) return;
      var flag = findFlag(id);
      if (!flag || !validFlag(flag)) return;
      blockers.push(map.project([Number(flag.longitude), Number(flag.latitude)]));
    });

    Object.keys(countyLabelMarkers).forEach(function (key) {
      countyLabelMarkers[key].el.style.display = 'none';
    });

    var kept = [];
    list.forEach(function (item) {
      var entry = countyLabelMarkers[item.adcode];
      if (!entry) {
        entry = ensureCountyLabelMarker(item);
        countyLabelMarkers[item.adcode] = entry;
      }
      var point = map.project([item.lng, item.lat]);
      var nearBlocker = blockers.some(function (blocker) {
        return Math.abs(blocker.x - point.x) < 24 && Math.abs(blocker.y - point.y) < 24;
      });
      var width = Math.max(2, item.short.length) * 9.5 + 8;
      var offsets = [0, -12, 12, -24, 24];
      var placed = false;
      for (var i = 0; i < offsets.length; i += 1) {
        var dy = offsets[i];
        var rect = entry.anchorRight
          ? { left: point.x - width - 3, right: point.x + 3, top: point.y - 9 + dy, bottom: point.y + 9 + dy }
          : { left: point.x - 3, right: point.x + width + 3, top: point.y - 9 + dy, bottom: point.y + 9 + dy };
        var overlap = kept.some(function (other) {
          return !(rect.right < other.left || rect.left > other.right || rect.bottom < other.top || rect.top > other.bottom);
        });
        if (!nearBlocker && !overlap) {
          entry.nameEl.style.transform = dy ? 'translateY(' + dy + 'px)' : '';
          entry.el.style.display = '';
          kept.push(rect);
          placed = true;
          break;
        }
      }
      if (!placed) {
        entry.nameEl.style.transform = '';
        entry.el.style.display = 'none';
      }
    });
  }

  function scheduleCountyLabels() {
    if (countyLabelTimer) window.clearTimeout(countyLabelTimer);
    countyLabelTimer = window.setTimeout(function () {
      countyLabelTimer = null;
      updateCountyLabels();
    }, 140);
  }

  function provinceShortName(name) {
    return String(name || '')
      .replace(/特别行政区$/, '')
      .replace(/维吾尔自治区$/, '')
      .replace(/壮族自治区$/, '')
      .replace(/回族自治区$/, '')
      .replace(/自治区$/, '')
      .replace(/[省市]$/, '');
  }

  function prepareProvinceLabels(geo) {
    provinceLabelData = (geo.features || []).map(function (feature) {
      var props = feature.properties || {};
      var center = Array.isArray(props.centroid) ? props.centroid : (Array.isArray(props.center) ? props.center : null);
      if (!center || !props.adcode || !props.name) return null;
      return {
        adcode: String(props.adcode),
        name: props.name,
        label: provinceShortName(props.name),
        lng: center[0],
        lat: center[1]
      };
    }).filter(Boolean);
  }

  function ensureProvinceLabelMarkers() {
    if (!map || !mapReady || !provinceLabelData.length) return;
    provinceLabelData.forEach(function (item) {
      if (provinceLabelMarkers[item.adcode]) return;
      var markerEl = document.createElement('div');
      markerEl.className = 'crm-map-province-marker';
      var dot = document.createElement('span');
      dot.className = 'crm-map-province-dot';
      var name = document.createElement('span');
      name.className = 'crm-map-province-name';
      name.textContent = item.label;
      markerEl.appendChild(dot);
      markerEl.appendChild(name);
      markerEl.style.display = 'none';
      var marker = new window.maplibregl.Marker({
        element: markerEl,
        anchor: 'center',
        pitchAlignment: 'viewport',
        rotationAlignment: 'viewport'
      })
        .setLngLat([item.lng, item.lat])
        .addTo(map);
      provinceLabelMarkers[item.adcode] = {
        marker: marker,
        el: markerEl,
        nameEl: name,
        item: item
      };
    });
  }

  function updateProvinceLabels() {
    if (!map || !mapReady) return;
    var keys = Object.keys(provinceLabelMarkers);
    if (!keys.length) return;
    if (!state.showCities || map.getZoom() >= PROVINCE_LABEL_MAX_ZOOM) {
      keys.forEach(function (key) {
        provinceLabelMarkers[key].el.style.display = 'none';
      });
      return;
    }

    var bounds = map.getBounds();
    var list = provinceLabelData.filter(function (item) {
      return bounds.contains([item.lng, item.lat]);
    });

    var blockers = [];
    Object.keys(cityMarkers).forEach(function (key) {
      var entry = cityMarkers[key];
      if (entry.el.style.display === 'none') return;
      if (!entry.el.classList.contains('clustered')) return;
      blockers.push(map.project([entry.city.lng, entry.city.lat]));
    });
    Object.keys(markers).forEach(function (id) {
      var entry = markers[id];
      if (!entry) return;
      if (entry.el.classList.contains('crm-map-flag-filtered') ||
        entry.el.classList.contains('crm-map-flag-clustered') ||
        entry.el.classList.contains('crm-map-flag-collided')) return;
      var flag = findFlag(id);
      if (!flag || !validFlag(flag)) return;
      blockers.push(map.project([Number(flag.longitude), Number(flag.latitude)]));
    });

    keys.forEach(function (key) {
      provinceLabelMarkers[key].el.style.display = 'none';
    });

    var kept = [];
    list.forEach(function (item) {
      var entry = provinceLabelMarkers[item.adcode];
      if (!entry) return;
      var point = map.project([item.lng, item.lat]);
      var width = item.label.length * 13 + 20;
      var nearBlocker = blockers.some(function (blocker) {
        return Math.abs(blocker.x - point.x) < 30 && Math.abs(blocker.y - point.y) < 30;
      });
      var offsets = [0, -18, 18, -36, 36];
      var placed = false;
      for (var i = 0; i < offsets.length; i += 1) {
        var dy = offsets[i];
        var rect = {
          left: point.x - width / 2,
          right: point.x + width / 2,
          top: point.y - 9 + dy,
          bottom: point.y + 9 + dy
        };
        var overlap = kept.some(function (other) {
          return !(rect.right < other.left || rect.left > other.right || rect.bottom < other.top || rect.top > other.bottom);
        });
        if (!nearBlocker && !overlap) {
          entry.nameEl.style.transform = dy ? 'translateY(' + dy + 'px)' : '';
          entry.el.style.display = '';
          kept.push(rect);
          placed = true;
          break;
        }
      }
      if (!placed) {
        entry.nameEl.style.transform = '';
        entry.el.style.display = 'none';
      }
    });
  }

  function scheduleProvinceLabels() {
    if (provinceLabelTimer) window.clearTimeout(provinceLabelTimer);
    provinceLabelTimer = window.setTimeout(function () {
      provinceLabelTimer = null;
      updateProvinceLabels();
    }, 140);
  }

  function prepareProvinceIndex(geo) {
    provinceIndex = geo.features.map(function (feature) {
      var geometry = feature.geometry;
      var polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
      var bbox = [Infinity, Infinity, -Infinity, -Infinity];
      function walk(node) {
        if (!Array.isArray(node)) return;
        if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
          if (node[0] < bbox[0]) bbox[0] = node[0];
          if (node[1] < bbox[1]) bbox[1] = node[1];
          if (node[0] > bbox[2]) bbox[2] = node[0];
          if (node[1] > bbox[3]) bbox[3] = node[1];
          return;
        }
        node.forEach(walk);
      }
      walk(geometry.coordinates);
      return {
        adcode: feature.properties.adcode,
        name: feature.properties.name,
        bbox: bbox,
        polygons: polygons
      };
    });
    prepareProvinceLabels(geo);
  }

  function pointInRing(lng, lat, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0];
      var yi = ring[i][1];
      var xj = ring[j][0];
      var yj = ring[j][1];
      var intersect = ((yi > lat) !== (yj > lat)) &&
        (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function pointInPolygon(lng, lat, polygon) {
    if (!polygon.length || !pointInRing(lng, lat, polygon[0])) return false;
    for (var i = 1; i < polygon.length; i += 1) {
      if (pointInRing(lng, lat, polygon[i])) return false;
    }
    return true;
  }

  function provinceForPoint(lng, lat) {
    var x = Number(lng);
    var y = Number(lat);
    if (!isFinite(x) || !isFinite(y)) return null;
    for (var i = 0; i < provinceIndex.length; i += 1) {
      var item = provinceIndex[i];
      if (x < item.bbox[0] || x > item.bbox[2] || y < item.bbox[1] || y > item.bbox[3]) continue;
      for (var p = 0; p < item.polygons.length; p += 1) {
        if (pointInPolygon(x, y, item.polygons[p])) return item;
      }
    }
    return null;
  }

  function computeProvinceStats(flags) {
    var stats = {};
    flags.forEach(function (flag) {
      if (!validFlag(flag)) return;
      var province = provinceForPoint(flag.longitude, flag.latitude);
      if (!province) return;
      var key = String(province.adcode);
      var item = stats[key];
      if (!item) {
        item = stats[key] = {
          adcode: province.adcode,
          name: province.name,
          count: 0,
          tags: {},
          tagColors: {},
          colors: {}
        };
      }
      item.count += 1;
      var color = normalizeColor(flag.color);
      item.colors[color] = (item.colors[color] || 0) + 1;
      var tag = (flag.tag || '').trim();
      if (tag) {
        item.tags[tag] = (item.tags[tag] || 0) + 1;
        if (!item.tagColors[tag]) item.tagColors[tag] = color;
      }
    });
    return stats;
  }

  function updateProvinceData() {
    if (!provinceGeo) return;
    var list = filteredFlags();
    provinceStats = computeProvinceStats(list);
    if (!map || !mapReady) return;
    var source = map.getSource('provinces');
    if (!source) return;
    var features = provinceGeo.features.map(function (feature) {
      var props = feature.properties;
      var stat = provinceStats[String(props.adcode)];
      var count = stat ? stat.count : 0;
      var copyProps = {
        adcode: props.adcode,
        name: props.name,
        center: props.center,
        centroid: props.centroid,
        count: count
      };
      return {
        type: 'Feature',
        id: feature.id,
        properties: copyProps,
        geometry: feature.geometry
      };
    });
    source.setData({ type: 'FeatureCollection', features: features });
    updateKpis();
  }

  function updateKpis() {
    var provinceSet = {};
    var values = {
      flags: state.flags.length,
      provinces: 0,
      cities: {},
      week: 0
    };
    var weekAgo = Date.now() - 7 * 86400000;
    state.flags.forEach(function (flag) {
      if (validFlag(flag)) {
        var province = provinceForPoint(flag.longitude, flag.latitude);
        if (province) provinceSet[String(province.adcode)] = true;
      }
      var city = (flag.city || '').trim();
      if (city) values.cities[city] = true;
      var created = flag.createdAt ? new Date(flag.createdAt).getTime() : 0;
      if (created && created >= weekAgo) values.week += 1;
    });
    values.provinces = Object.keys(provinceSet).length;
    values.cities = Object.keys(values.cities).length;
    if (!overlay) return;
    overlay.querySelectorAll('[data-kpi]').forEach(function (node) {
      var key = node.getAttribute('data-kpi');
      var value = values[key];
      setText(node, typeof value === 'number' ? value : '—');
    });
    var text = DEMO ? '演示数据 · ' + state.flags.length + ' 面旗帜' : '全国经销商旗帜 · ' + state.flags.length + ' 面';
    if (cache.ts) text += ' · 更新于 ' + fmtTimeShort(cache.ts);
    setText(ui.sub, text);
  }

  function buildProvinceDataForTooltip(adcode) {
    return provinceStats[String(adcode)] || null;
  }

  function showProvinceTooltip(event, feature) {
    var adcode = feature.properties.adcode;
    var stat = buildProvinceDataForTooltip(adcode);
    var name = feature.properties.name || '未知省份';
    var count = stat ? stat.count : 0;
    ui.tooltip.innerHTML = '';
    var title = el('div', 'crm-map-tooltip-title');
    title.appendChild(el('span', '', name));
    title.appendChild(el('small', '', count + ' 面旗帜'));
    ui.tooltip.appendChild(title);

    if (stat && count > 0) {
      var tags = Object.keys(stat.tags).map(function (tag) {
        return { tag: tag, count: stat.tags[tag], color: stat.tagColors[tag] || '#5b8cff' };
      }).sort(function (a, b) { return b.count - a.count; }).slice(0, 4);
      if (tags.length) {
        var tagBox = el('div', 'crm-map-tooltip-tags');
        tags.forEach(function (item) {
          var row = el('div', 'crm-map-tooltip-tag');
          var dot = el('span', 'crm-map-tag-dot');
          dot.style.setProperty('--dot-color', item.color);
          row.appendChild(dot);
          row.appendChild(el('span', '', item.tag));
          row.appendChild(el('b', '', String(item.count)));
          tagBox.appendChild(row);
        });
        ui.tooltip.appendChild(tagBox);
      } else {
        ui.tooltip.appendChild(el('div', 'crm-map-tooltip-empty', '未设置标签'));
      }
    } else {
      ui.tooltip.appendChild(el('div', 'crm-map-tooltip-empty', '暂无旗帜'));
    }

    ui.tooltip.classList.add('show');
    var rect = overlay.getBoundingClientRect();
    var width = ui.tooltip.offsetWidth;
    var height = ui.tooltip.offsetHeight;
    var x = event.point.x + 16;
    var y = event.point.y + 16;
    if (x + width > rect.width - 14) x = event.point.x - width - 16;
    if (y + height > rect.height - 14) y = event.point.y - height - 16;
    if (x < 10) x = 10;
    if (y < 10) y = 10;
    ui.tooltip.style.left = x + 'px';
    ui.tooltip.style.top = y + 'px';
  }

  function hideTooltip() {
    if (ui.tooltip) ui.tooltip.classList.remove('show');
  }

  function findFlag(id) {
    if (!id) return null;
    for (var i = 0; i < state.flags.length; i += 1) {
      if (state.flags[i].id === id) return state.flags[i];
    }
    return null;
  }

  function applyFlagsData() {
    if (!overlay) return;
    if (state.selectedId && !findFlag(state.selectedId)) {
      closeDetail();
    }
    renderTags();
    renderList();
    syncMarkers();
    updateProvinceData();
    updateKpis();
  }

  function renderTags() {
    if (!ui.tags) return;
    var tags = {};
    state.flags.forEach(function (flag) {
      var tag = (flag.tag || '').trim();
      if (!tag) return;
      if (!tags[tag]) tags[tag] = { count: 0, colors: {} };
      tags[tag].count += 1;
      var color = normalizeColor(flag.color);
      tags[tag].colors[color] = (tags[tag].colors[color] || 0) + 1;
    });
    var keys = Object.keys(tags);
    if (state.tag && keys.indexOf(state.tag) === -1) state.tag = null;
    ui.tags.innerHTML = '';
    if (!keys.length) {
      ui.tags.style.display = 'none';
      return;
    }
    ui.tags.style.display = '';
    var all = el('button', 'crm-map-tag-filter' + (state.tag ? '' : ' active'), '全部');
    all.type = 'button';
    all.addEventListener('click', function () {
      state.tag = null;
      renderTags();
      renderList();
      applyFiltersAndCollision();
      updateProvinceData();
    });
    ui.tags.appendChild(all);
    keys.sort(function (a, b) { return tags[b].count - tags[a].count; }).forEach(function (tag) {
      var info = tags[tag];
      var color = Object.keys(info.colors).sort(function (a, b) { return info.colors[b] - info.colors[a]; })[0] || '#5b8cff';
      var chip = el('button', 'crm-map-tag-filter' + (state.tag === tag ? ' active' : ''));
      chip.type = 'button';
      var dot = el('span', 'crm-map-tag-dot');
      dot.style.setProperty('--dot-color', color);
      chip.appendChild(dot);
      chip.appendChild(document.createTextNode(tag + ' ' + info.count));
      chip.addEventListener('click', function () {
        state.tag = state.tag === tag ? null : tag;
        renderTags();
        renderList();
        applyFiltersAndCollision();
        updateProvinceData();
      });
      ui.tags.appendChild(chip);
    });
  }

  function renderList() {
    if (!ui.list) return;
    var scrollTop = ui.list.scrollTop;
    ui.list.innerHTML = '';
    var list = filteredFlags().slice().sort(function (a, b) { return sortTime(b) - sortTime(a); });
    var total = state.flags.length;
    if (!cache.loaded && !cache.error) {
      setText(ui.count, '正在加载…');
      ui.list.appendChild(el('div', 'crm-map-empty', '正在读取旗帜…'));
      return;
    }
    setText(ui.count, list.length === total ? total + ' 面' : list.length + ' / ' + total + ' 面');

    if (!total) {
      var empty = el('div', 'crm-map-empty');
      var flagIcon = el('div');
      flagIcon.innerHTML = icon('flag');
      empty.appendChild(flagIcon);
      empty.appendChild(el('div', '', '还没有旗帜'));
      empty.appendChild(el('div', '', '点击右上角“放置旗帜”，再点地图选择位置。'));
      var first = el('button', 'crm-map-btn primary', '放置第一面旗帜');
      first.type = 'button';
      first.addEventListener('click', function () { enterPlacement(true); });
      empty.appendChild(first);
      ui.list.appendChild(empty);
      return;
    }

    if (!list.length) {
      var noMatch = el('div', 'crm-map-empty');
      noMatch.appendChild(el('div', '', '没有匹配的旗帜'));
      var clear = el('button', 'crm-map-btn', '清除筛选');
      clear.type = 'button';
      clear.addEventListener('click', function () {
        state.search = '';
        state.tag = null;
        if (ui.searchInput) ui.searchInput.value = '';
        renderTags();
        renderList();
        applyFiltersAndCollision();
        updateProvinceData();
      });
      noMatch.appendChild(clear);
      ui.list.appendChild(noMatch);
      return;
    }

    list.forEach(function (flag) {
      var row = el('button', 'crm-map-list-row' + (state.selectedId === flag.id ? ' active' : ''));
      row.type = 'button';
      row.setAttribute('aria-label', flag.name || '未命名旗帜');
      row.appendChild(buildMiniFlag(flag.color));
      var main = el('span', 'crm-map-list-main');
      var nameRow = el('span', 'crm-map-list-name');
      nameRow.appendChild(el('span', '', flag.name || '未命名'));
      var tag = (flag.tag || '').trim();
      if (tag) nameRow.appendChild(buildTagChip(tag, tagColor(flag)));
      main.appendChild(nameRow);
      var meta = el('span', 'crm-map-list-meta');
      meta.appendChild(el('span', '', (flag.city || '').trim() || '未填写城市'));
      main.appendChild(meta);
      if (flag.note) main.appendChild(el('span', 'crm-map-list-note', flag.note));
      row.appendChild(main);
      row.addEventListener('click', function () {
        selectFlag(flag.id, true);
      });
      row.addEventListener('mouseenter', function () {
        var entry = markers[flag.id];
        if (entry) entry.el.classList.add('hover-linked');
      });
      row.addEventListener('mouseleave', function () {
        var entry = markers[flag.id];
        if (entry) entry.el.classList.remove('hover-linked');
      });
      ui.list.appendChild(row);
    });
    ui.list.scrollTop = scrollTop;
  }

  function renderDataError(error) {
    if (!ui.list) return;
    ui.list.innerHTML = '';
    setText(ui.count, '加载失败');
    var box = el('div', 'crm-map-empty');
    box.appendChild(el('div', '', '旗帜加载失败'));
    box.appendChild(el('div', '', formatError(error)));
    var retry = el('button', 'crm-map-btn', '重试');
    retry.type = 'button';
    retry.addEventListener('click', function () {
      loadFlags(true).catch(function (err) { renderDataError(err); });
    });
    box.appendChild(retry);
    ui.list.appendChild(box);
  }

  function fetchAllFlags() {
    var all = [];
    var after = null;
    var page = 0;
    function next() {
      return graphql(FLAGS_QUERY, { after: after }).then(function (data) {
        var connection = data && data.dealerFlags;
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

  function loadFlags(force) {
    if (!force && cache.loaded && Date.now() - cache.ts < CACHE_MS) {
      return Promise.resolve(cache.flags || []);
    }
    if (cache.promise) return cache.promise;
    state.loadingFlags = true;
    cache.promise = (DEMO ? Promise.resolve(demoFlags()) : fetchAllFlags())
      .then(function (flags) {
        cache.flags = flags || [];
        state.flags = cache.flags;
        cache.ts = Date.now();
        cache.loaded = true;
        cache.error = null;
        cache.unauthorized = false;
        cache.promise = null;
        state.loadingFlags = false;
        applyFlagsData();
        return state.flags;
      })
      .catch(function (error) {
        cache.promise = null;
        state.loadingFlags = false;
        cache.loaded = true;
        cache.error = error;
        cache.unauthorized = !!error.unauthorized;
        renderDataError(error);
        throw error;
      });
    return cache.promise;
  }

  function demoFlags() {
    if (demoStore) return demoStore.slice();
    var now = Date.now();
    var samples = [
      ['杭州旗舰店', '旗舰店', '#3e63dd', '杭州', 120.153576, 30.287459, '样本：重点跟进'],
      ['杭州西湖校区', '旗舰店', '#3e63dd', '杭州', 120.13, 30.27, '样本：西湖区'],
      ['杭州滨江校区', '已合作', '#12a594', '杭州', 120.21, 30.21, '样本：滨江区'],
      ['广州合作方', '已合作', '#30a46c', '广州', 113.264385, 23.129112, '样本：已签约'],
      ['广州天河校区', '已合作', '#30a46c', '广州', 113.36, 23.12, '样本：天河区'],
      ['深圳合作方', '待开发', '#38d6ff', '深圳', 114.057868, 22.543099, '样本：待联系'],
      ['北京渠道', '重点', '#e5484d', '北京', 116.405285, 39.904989, '样本：本周拜访'],
      ['北京海淀校区', '重点', '#e5484d', '北京', 116.31, 39.98, '样本：海淀区'],
      ['上海渠道', '重点', '#e93d82', '上海', 121.472644, 31.231706, '样本：重点城市'],
      ['成都新客户', '待开发', '#8e4ec6', '成都', 104.065735, 30.659462, '样本：待首次沟通'],
      ['西安洽谈', '洽谈中', '#f5a623', '西安', 108.948024, 34.263161, '样本：报价阶段'],
      ['厦门合作方', '已合作', '#12a594', '厦门', 118.11022, 24.490474, '样本：老客户'],
      ['武汉洽谈', '洽谈中', '#f76b15', '武汉', 114.298572, 30.584355, '样本：方案沟通'],
      ['青岛合作方', '已合作', '#30a46c', '青岛', 120.355173, 36.082982, '样本：已开课'],
      ['重庆新客户', '待开发', '#38d6ff', '重庆', 106.504962, 29.533155, '样本：待联系']
    ];
    demoStore = samples.map(function (item, index) {
      return {
        id: 'demo-' + (index + 1),
        name: item[0],
        tag: item[1],
        color: item[2],
        city: item[3],
        longitude: item[4],
        latitude: item[5],
        note: item[6],
        createdAt: new Date(now - index * 86400000).toISOString(),
        updatedAt: new Date(now - index * 3600000).toISOString()
      };
    });
    return demoStore.slice();
  }

  function createFlag(data) {
    if (DEMO) {
      if (!demoStore) demoFlags();
      var flag = {
        id: 'demo-' + Date.now(),
        name: data.name,
        tag: data.tag || '',
        color: data.color,
        city: data.city || '',
        longitude: data.longitude,
        latitude: data.latitude,
        note: data.note || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      demoStore.unshift(flag);
      return Promise.resolve(flag);
    }
    return graphql(
      'mutation CrmMapCreateFlag($data: DealerFlagCreateInput!) {' +
        '  createDealerFlag(data: $data) {' +
        '    id name tag color city longitude latitude note createdAt updatedAt' +
        '  }' +
        '}',
      { data: data }
    ).then(function (result) { return result.createDealerFlag; });
  }

  function updateFlag(id, data) {
    if (DEMO) {
      if (!demoStore) demoFlags();
      var current = findFlag(id);
      var next = Object.assign({}, current || {}, data, { updatedAt: new Date().toISOString() });
      for (var i = 0; i < demoStore.length; i += 1) {
        if (demoStore[i].id === id) {
          demoStore[i] = next;
          break;
        }
      }
      return Promise.resolve(next);
    }
    return graphql(
      'mutation CrmMapUpdateFlag($id: UUID!, $data: DealerFlagUpdateInput!) {' +
        '  updateDealerFlag(id: $id, data: $data) {' +
        '    id name tag color city longitude latitude note createdAt updatedAt' +
        '  }' +
        '}',
      { id: id, data: data }
    ).then(function (result) { return result.updateDealerFlag; });
  }

  function deleteFlag(id) {
    if (DEMO) {
      if (demoStore) {
        demoStore = demoStore.filter(function (flag) { return flag.id !== id; });
      }
      return Promise.resolve({ id: id });
    }
    return graphql(
      'mutation CrmMapDeleteFlag($id: UUID!) {' +
        '  deleteDealerFlag(id: $id) { id }' +
        '}',
      { id: id }
    ).then(function (result) { return result.deleteDealerFlag; });
  }

  function restoreFlag(flag) {
    if (DEMO) {
      if (!demoStore) demoFlags();
      var exists = demoStore.some(function (item) { return item.id === flag.id; });
      if (!exists) demoStore.unshift(flag);
      return Promise.resolve(flag);
    }
    return graphql(
      'mutation CrmMapRestoreFlag($id: UUID!) {' +
        '  restoreDealerFlag(id: $id) {' +
        '    id name tag color city longitude latitude note createdAt updatedAt' +
        '  }' +
        '}',
      { id: flag.id }
    ).then(function (result) { return result.restoreDealerFlag; });
  }

  function undoDelete(flag, index) {
    if (!flag) return;
    restoreFlag(flag).then(function (node) {
      var exists = state.flags.some(function (item) { return item.id === node.id; });
      if (!exists) {
        if (index >= 0 && index <= state.flags.length) state.flags.splice(index, 0, node);
        else state.flags.unshift(node);
      }
      cache.flags = state.flags;
      cache.ts = Date.now();
      cache.loaded = true;
      applyFlagsData();
      selectFlag(node.id, true);
      showToast('已撤销删除');
    }).catch(function (error) {
      showToast('撤销失败：' + formatError(error));
    });
  }

  function syncMarkers() {
    if (!map || !mapReady) return;
    var byId = {};
    state.flags.forEach(function (flag) {
      if (validFlag(flag)) byId[flag.id] = flag;
    });

    Object.keys(markers).forEach(function (id) {
      if (!byId[id]) {
        try { markers[id].marker.remove(); } catch (error) {}
        delete markers[id];
      }
    });

    state.flags.forEach(function (flag) {
      if (!validFlag(flag)) return;
      var entry = markers[flag.id];
      if (!entry) {
        entry = createMarker(flag);
        markers[flag.id] = entry;
      } else {
        entry.flag = flag;
        updateMarkerElement(entry, flag);
        entry.marker.setLngLat([Number(flag.longitude), Number(flag.latitude)]);
      }
    });

    applyFiltersAndCollision();
  }

  function createMarker(flag) {
    var element = el('div', 'crm-map-flag');
    var pole = el('span', 'crm-map-flag-pole');
    var base = el('span', 'crm-map-flag-base');
    var cloth = el('span', 'crm-map-flag-cloth');
    var name = el('span', 'crm-map-flag-name', truncate(flag.name, 9));
    cloth.appendChild(name);
    var tag = el('span', 'crm-map-flag-tag');
    element.appendChild(pole);
    element.appendChild(base);
    element.appendChild(cloth);
    element.appendChild(tag);

    updateMarkerElement({ el: element, nameNode: name, tagNode: tag, flag: flag }, flag);

    var marker = new window.maplibregl.Marker({
      element: element,
      anchor: 'bottom',
      draggable: true,
      pitchAlignment: 'viewport',
      rotationAlignment: 'viewport'
    })
      .setLngLat([Number(flag.longitude), Number(flag.latitude)])
      .addTo(map);

    marker.on('dragstart', function () {
      element.classList.add('dragging');
      element.__suppressClick = true;
      pauseAutoRotate();
    });
    marker.on('dragend', function () {
      element.classList.remove('dragging');
      var lngLat = marker.getLngLat();
      window.setTimeout(function () { element.__suppressClick = false; }, 320);
      handleDragEnd(flag.id, lngLat.lng, lngLat.lat, marker);
    });

    element.addEventListener('click', function (event) {
      event.stopPropagation();
      if (element.__suppressClick) return;
      if (state.placing) return;
      selectFlag(flag.id, false);
    });

    return { marker: marker, el: element, nameNode: name, tagNode: tag, flag: flag };
  }

  function updateMarkerElement(entry, flag) {
    var color = normalizeColor(flag.color);
    entry.el.style.setProperty('--flag-color', color);
    entry.el.title = (flag.name || '未命名') + (flag.tag ? ' · ' + flag.tag : '');
    setText(entry.nameNode, truncate(flag.name || '未命名', 9));
    setText(entry.tagNode, (flag.tag || '').trim());
    entry.el.classList.toggle('selected', state.selectedId === flag.id);
  }

  function applyFiltersAndCollision() {
    Object.keys(markers).forEach(function (id) {
      var entry = markers[id];
      var flag = findFlag(id);
      var visible = flag ? matchesFilters(flag) : false;
      entry.el.classList.toggle('crm-map-flag-filtered', !visible);
      entry.el.classList.remove('crm-map-flag-collided');
      entry.el.classList.toggle('selected', state.selectedId === id);
    });
    updateCityLabels();
    scheduleCollision();
  }

  function scheduleCollision() {
    if (collisionRAF) return;
    collisionRAF = window.requestAnimationFrame(function () {
      collisionRAF = null;
      updateCollision();
    });
  }

  function updateCollision() {
    if (!map || !mapReady) return;
    var candidates = [];
    Object.keys(markers).forEach(function (id) {
      var entry = markers[id];
      var flag = findFlag(id);
      if (!flag || !matchesFilters(flag)) return;
      if (entry.el.classList.contains('crm-map-flag-clustered')) return;
      candidates.push({
        id: id,
        entry: entry,
        flag: flag,
        selected: state.selectedId === id,
        time: sortTime(flag)
      });
    });
    candidates.sort(function (a, b) {
      if (a.selected !== b.selected) return a.selected ? -1 : 1;
      return b.time - a.time;
    });

    var zoom = map.getZoom();
    var cellWidth = zoom < 4 ? 66 : zoom > 7 ? 46 : 56;
    var cellHeight = cellWidth * 1.2;
    var kept = [];
    candidates.forEach(function (item) {
      item.entry.el.classList.remove('crm-map-flag-collided');
      if (item.selected) {
        kept.push(projectRect(item.flag, cellWidth, cellHeight));
        return;
      }
      var point = map.project([Number(item.flag.longitude), Number(item.flag.latitude)]);
      var rect = {
        left: point.x - cellWidth / 2,
        right: point.x + cellWidth / 2,
        top: point.y - cellHeight,
        bottom: point.y
      };
      var overlaps = kept.some(function (other) {
        return !(rect.right < other.left || rect.left > other.right || rect.bottom < other.top || rect.top > other.bottom);
      });
      if (overlaps) {
        item.entry.el.classList.add('crm-map-flag-collided');
      } else {
        kept.push(rect);
      }
    });
  }

  function projectRect(flag, width, height) {
    var point = map.project([Number(flag.longitude), Number(flag.latitude)]);
    return {
      left: point.x - width / 2,
      right: point.x + width / 2,
      top: point.y - height,
      bottom: point.y
    };
  }

  function handleDragEnd(id, lng, lat, marker) {
    var flag = findFlag(id);
    if (!flag) return;
    var oldLng = Number(flag.longitude);
    var oldLat = Number(flag.latitude);
    if (!isFinite(lng) || !isFinite(lat)) return;
    if (Math.abs(oldLng - lng) < 1e-7 && Math.abs(oldLat - lat) < 1e-7) return;

    var currentCity = (flag.city || '').trim();
    var oldNearest = nearestCityLabel(oldLng, oldLat);
    var newNearest = nearestCityLabel(lng, lat);
    flag.longitude = lng;
    flag.latitude = lat;
    flag.__nearestCity = undefined;
    if (!currentCity || currentCity === oldNearest) {
      flag.city = newNearest || currentCity;
    }
    cache.ts = Date.now();
    updateProvinceData();
    updateKpis();
    renderList();

    updateFlag(id, { longitude: lng, latitude: lat, city: flag.city })
      .then(function (updated) {
        var index = state.flags.map(function (item) { return item.id; }).indexOf(id);
        if (index !== -1) state.flags[index] = updated;
        cache.flags = state.flags;
        cache.ts = Date.now();
        applyFlagsData();
        if (state.selectedId === id) renderDetail(updated);
        showToast('位置已保存');
      })
      .catch(function (error) {
        flag.longitude = oldLng;
        flag.latitude = oldLat;
        marker.setLngLat([oldLng, oldLat]);
        updateProvinceData();
        renderList();
        showToast('位置保存失败：' + formatError(error));
      });
  }

  function selectFlag(id, fly) {
    var flag = findFlag(id);
    if (!flag) return;
    state.selectedId = id;
    Object.keys(markers).forEach(function (key) {
      markers[key].el.classList.toggle('selected', key === id);
    });
    renderList();
    renderDetail(flag);
    ui.detail.classList.add('open');
    if (fly) {
      flyToFlag(flag);
    } else if (map && mapReady) {
      map.easeTo({ padding: mapPadding(true), duration: 350 });
    }
    scheduleCollision();
    pauseAutoRotate();
  }

  function closeDetail() {
    state.selectedId = null;
    if (ui.detail) ui.detail.classList.remove('open');
    Object.keys(markers).forEach(function (key) {
      markers[key].el.classList.remove('selected');
    });
    if (map && mapReady) {
      map.easeTo({ padding: mapPadding(false), duration: 300 });
    }
    renderList();
    scheduleCollision();
    startRotate();
  }

  function flyToFlag(flag) {
    if (!map || !isFinite(Number(flag.longitude)) || !isFinite(Number(flag.latitude))) return;
    state.interacting = true;
    map.flyTo({
      center: [Number(flag.longitude), Number(flag.latitude)],
      zoom: Math.max(map.getZoom(), 6.2),
      pitch: 55,
      bearing: map.getBearing(),
      padding: mapPadding(true),
      duration: 1000
    });
    window.setTimeout(function () { state.interacting = false; }, 1200);
  }

  function renderDetail(flag) {
    if (!ui.detail || !flag) return;
    ui.detailFlag.style.setProperty('--flag-color', normalizeColor(flag.color));
    setText(ui.detailTitle, flag.name || '未命名旗帜');
    ui.detailSub.innerHTML = '';
    var tag = (flag.tag || '').trim();
    if (tag) ui.detailSub.appendChild(buildTagChip(tag, tagColor(flag)));
    if (flag.city) ui.detailSub.appendChild(el('span', '', flag.city));
    if (!tag && !flag.city) ui.detailSub.appendChild(el('span', '', '未设置标签/城市'));

    ui.detailBody.innerHTML = '';
    var tagRow = el('div', 'crm-map-detail-row');
    tagRow.appendChild(el('div', 'crm-map-detail-label', '标签'));
    var tagValue = el('div', 'crm-map-detail-value');
    if (tag) tagValue.appendChild(buildTagChip(tag, tagColor(flag)));
    else tagValue.textContent = '—';
    tagRow.appendChild(tagValue);
    ui.detailBody.appendChild(tagRow);

    var cityRow = el('div', 'crm-map-detail-row');
    cityRow.appendChild(el('div', 'crm-map-detail-label', '城市'));
    cityRow.appendChild(el('div', 'crm-map-detail-value', (flag.city || '').trim() || '—'));
    ui.detailBody.appendChild(cityRow);

    var coordRow = el('div', 'crm-map-detail-row');
    coordRow.appendChild(el('div', 'crm-map-detail-label', '坐标'));
    coordRow.appendChild(el('div', 'crm-map-detail-value mono', fmtCoord(flag.longitude) + ', ' + fmtCoord(flag.latitude)));
    ui.detailBody.appendChild(coordRow);

    var noteRow = el('div', 'crm-map-detail-row');
    noteRow.appendChild(el('div', 'crm-map-detail-label', '备注'));
    noteRow.appendChild(el('div', 'crm-map-detail-value note', (flag.note || '').trim() || '—'));
    ui.detailBody.appendChild(noteRow);

    var timeRow = el('div', 'crm-map-detail-row');
    timeRow.appendChild(el('div', 'crm-map-detail-label', '更新'));
    timeRow.appendChild(el('div', 'crm-map-detail-value', fmtDateTime(flag.updatedAt)));
    ui.detailBody.appendChild(timeRow);
  }

  function copyCoordinates(flag) {
    var text = fmtCoord(flag.longitude) + ', ' + fmtCoord(flag.latitude);
    function done() { showToast('坐标已复制'); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    try {
      var area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      done();
    } catch (error) {
      showToast('复制失败，请手动选择坐标');
    }
  }

  function enterPlacement(continuous) {
    if (!map || !mapReady) {
      showToast('地图还在加载，请稍候');
      return;
    }
    if (state.modalOpen) return;
    state.placing = true;
    state.continuousPlacement = continuous !== false;
    if (overlay) overlay.classList.add('crm-map-placing');
    if (ui.placement) ui.placement.classList.add('show');
    if (ui.placeButton) ui.placeButton.classList.add('active');
    if (ui.ghost) ui.ghost.classList.add('show');
    if (ui.canvas) ui.canvas.style.cursor = 'crosshair';
    if (ui.sidebar) ui.sidebar.classList.remove('mobile-open');
    closeDetail();
    pauseAutoRotate();
  }

  function cancelPlacement() {
    state.placing = false;
    state.continuousPlacement = false;
    if (overlay) overlay.classList.remove('crm-map-placing');
    if (ui.placement) ui.placement.classList.remove('show');
    if (ui.placeButton) ui.placeButton.classList.remove('active');
    if (ui.ghost) ui.ghost.classList.remove('show');
    if (ui.canvas) ui.canvas.style.cursor = '';
  }

  function openForm(mode, flag, lngLat, continuous) {
    if (!ui.modalRoot) return;
    state.modalOpen = true;
    pauseAutoRotate();
    var isEdit = mode === 'edit';
    var wasContinuous = !isEdit && continuous !== false;
    var lastStyle = loadLastStyle();
    var longitude = isEdit ? Number(flag.longitude) : Number(lngLat.lng);
    var latitude = isEdit ? Number(flag.latitude) : Number(lngLat.lat);
    var initialColor = isEdit
      ? normalizeColor(flag.color)
      : (lastStyle.color ? normalizeColor(lastStyle.color) : PALETTE[state.flags.length % PALETTE.length]);

    ui.modalRoot.innerHTML = '';
    ui.modalRoot.classList.add('show');

    var modal = el('div', 'crm-map-modal');
    var head = el('div', 'crm-map-modal-head');
    var preview = el('div', 'crm-map-preview');
    var previewFlag = buildMiniFlag(initialColor);
    preview.appendChild(previewFlag);
    head.appendChild(preview);
    var headText = el('div', 'crm-map-modal-title-wrap');
    headText.appendChild(el('div', 'crm-map-modal-title', isEdit ? '编辑旗帜' : '新增旗帜'));
    headText.appendChild(el('div', 'crm-map-modal-sub', isEdit
      ? '修改名称、标签、颜色和备注'
      : (wasContinuous ? '保存后继续放置；按 Esc 退出放置模式' : '选择颜色与标签，保存后即可在地图上拖动调整')));
    head.appendChild(headText);
    var close = el('button', 'crm-map-close small', '×');
    close.type = 'button';
    close.setAttribute('aria-label', '关闭');
    head.appendChild(close);
    modal.appendChild(head);

    var body = el('div', 'crm-map-modal-body');
    var errorBox = el('div', 'crm-map-form-error');
    body.appendChild(errorBox);

    var nameField = el('div', 'crm-map-field');
    var nameLabel = el('label');
    nameLabel.appendChild(document.createTextNode('名称 '));
    var required = el('em', '', '*');
    nameLabel.appendChild(required);
    nameField.appendChild(nameLabel);
    var nameInput = el('input');
    nameInput.type = 'text';
    nameInput.maxLength = 40;
    nameInput.placeholder = '如：杭州旗舰店 / 某某教育';
    nameInput.value = isEdit ? (flag.name || '') : '';
    nameField.appendChild(nameInput);
    body.appendChild(nameField);

    var row = el('div', 'crm-map-field-row');
    var tagField = el('div', 'crm-map-field');
    tagField.appendChild(el('label', '', '标签'));
    var tagInput = el('input');
    tagInput.type = 'text';
    tagInput.maxLength = 20;
    tagInput.placeholder = '如：旗舰店 / 待签约';
    tagInput.value = isEdit ? (flag.tag || '') : (lastStyle.tag || '');
    tagField.appendChild(tagInput);
    row.appendChild(tagField);

    var cityField = el('div', 'crm-map-field');
    cityField.appendChild(el('label', '', '城市'));
    var cityInput = el('input');
    cityInput.type = 'text';
    cityInput.maxLength = 30;
    cityInput.setAttribute('list', 'crm-map-city-datalist');
    cityInput.placeholder = '如：杭州';
    cityInput.value = isEdit ? (flag.city || '') : nearestCityLabel(longitude, latitude);
    cityField.appendChild(cityInput);
    row.appendChild(cityField);
    body.appendChild(row);

    var colorField = el('div', 'crm-map-field');
    colorField.appendChild(el('label', '', '颜色'));
    var colorRow = el('div', 'crm-map-color-row');
    var swatches = [];
    function markSwatches() {
      swatches.forEach(function (swatch) {
        swatch.classList.toggle('active', normalizeColor(swatch.getAttribute('data-color')) === initialColor);
      });
    }
    PALETTE.forEach(function (color) {
      var swatch = el('button', 'crm-map-swatch');
      swatch.type = 'button';
      swatch.style.setProperty('--swatch-color', color);
      swatch.setAttribute('data-color', color);
      swatch.title = color;
      swatch.addEventListener('click', function () {
        initialColor = color;
        setFormColor(color);
        markSwatches();
      });
      swatches.push(swatch);
      colorRow.appendChild(swatch);
    });
    var custom = el('label', 'crm-map-swatch custom');
    custom.title = '自定义颜色';
    var customInput = el('input');
    customInput.type = 'color';
    customInput.value = initialColor;
    custom.appendChild(customInput);
    colorRow.appendChild(custom);
    var hex = el('span', 'crm-map-color-hex', initialColor);
    colorRow.appendChild(hex);
    colorField.appendChild(colorRow);
    body.appendChild(colorField);

    var noteField = el('div', 'crm-map-field');
    noteField.appendChild(el('label', '', '备注'));
    var noteInput = el('textarea');
    noteInput.placeholder = '可选：负责人、跟进情况、下次动作…';
    noteInput.value = isEdit ? (flag.note || '') : '';
    noteField.appendChild(noteInput);
    body.appendChild(noteField);

    var hint = el('div', 'crm-map-field-hint', '坐标：' + fmtCoord(longitude) + ', ' + fmtCoord(latitude) + ' · 保存后可在地图上拖动调整位置');
    body.appendChild(hint);
    modal.appendChild(body);

    var foot = el('div', 'crm-map-modal-foot');
    var saveIdleLabel = isEdit ? '保存修改' : (wasContinuous ? '保存并继续' : '保存旗帜');
    var save = el('button', 'crm-map-btn primary', saveIdleLabel);
    save.type = 'button';
    foot.appendChild(save);
    modal.appendChild(foot);
    ui.modalRoot.appendChild(modal);

    function setFormColor(color) {
      var normalized = normalizeColor(color);
      initialColor = normalized;
      previewFlag.style.setProperty('--flag-color', normalized);
      hex.textContent = normalized;
      customInput.value = normalized;
    }

    function showError(message) {
      errorBox.textContent = message;
      errorBox.classList.add('show');
    }

    markSwatches();
    setFormColor(initialColor);

    close.addEventListener('click', function () {
      if (formState && formState.saving) return;
      closeModal();
    });

    customInput.addEventListener('input', function () {
      setFormColor(customInput.value);
      markSwatches();
    });

    save.addEventListener('click', function () {
      if (formState && formState.saving) return;
      errorBox.classList.remove('show');
      errorBox.textContent = '';
      var name = (nameInput.value || '').trim();
      if (!name) {
        showError('请填写名称');
        nameInput.focus();
        return;
      }
      var lng = Number(longitude);
      var lat = Number(latitude);
      if (!isFinite(lng) || !isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        showError('坐标无效，请重新选择地图位置');
        return;
      }
      var data = {
        name: name,
        tag: (tagInput.value || '').trim(),
        color: normalizeColor(initialColor),
        city: (cityInput.value || '').trim(),
        longitude: lng,
        latitude: lat,
        note: (noteInput.value || '').trim()
      };

      formState = formState || {};
      formState.saving = true;
      save.disabled = true;
      save.textContent = '保存中…';

      var operation = isEdit ? updateFlag(flag.id, data) : createFlag(data);
      operation.then(function (node) {
        formState.saving = false;
        if (isEdit) {
          var index = state.flags.map(function (item) { return item.id; }).indexOf(flag.id);
          if (index !== -1) state.flags[index] = node;
        } else {
          state.flags.unshift(node);
          saveLastStyle({ color: data.color, tag: data.tag });
        }
        cache.flags = state.flags;
        cache.ts = Date.now();
        cache.loaded = true;
        closeModal();
        applyFlagsData();
        if (isEdit) {
          selectFlag(node.id, false);
          showToast('旗帜已更新');
        } else if (wasContinuous) {
          enterPlacement(true);
          showToast('已保存，继续点击地图放置（Esc 退出）');
        } else {
          selectFlag(node.id, true);
          showToast('旗帜已保存');
        }
      }).catch(function (error) {
        formState.saving = false;
        save.disabled = false;
        save.textContent = saveIdleLabel;
        showError(formatError(error));
      });
    });

    formState = {
      saving: false,
      mode: mode,
      continuous: wasContinuous,
      lngLat: { lng: longitude, lat: latitude }
    };

    window.setTimeout(function () { nameInput.focus(); }, 80);
  }

  function closeModal(force) {
    if (!ui.modalRoot) return;
    if (!force && formState && formState.saving) return;
    ui.modalRoot.classList.remove('show');
    ui.modalRoot.innerHTML = '';
    formState = null;
    state.modalOpen = false;
    startRotate();
  }

  function openDeleteConfirm(flag) {
    if (!ui.modalRoot) return;
    state.modalOpen = true;
    pauseAutoRotate();
    ui.modalRoot.innerHTML = '';
    ui.modalRoot.classList.add('show');

    var modal = el('div', 'crm-map-modal small');
    var head = el('div', 'crm-map-modal-head');
    var headText = el('div', 'crm-map-modal-title-wrap');
    headText.appendChild(el('div', 'crm-map-modal-title', '删除旗帜'));
    headText.appendChild(el('div', 'crm-map-modal-sub', '删除后 6 秒内可在提示条撤销'));
    head.appendChild(headText);
    var close = el('button', 'crm-map-close small', '×');
    close.type = 'button';
    close.setAttribute('aria-label', '关闭');
    head.appendChild(close);
    modal.appendChild(head);

    var body = el('div', 'crm-map-modal-body');
    var copy = el('div', 'crm-map-modal-copy');
    copy.appendChild(document.createTextNode('确定删除「'));
    copy.appendChild(el('b', 'crm-map-delete-name', flag.name || '未命名旗帜'));
    copy.appendChild(document.createTextNode('」？'));
    body.appendChild(copy);
    var errorBox = el('div', 'crm-map-form-error');
    body.appendChild(errorBox);
    modal.appendChild(body);

    var foot = el('div', 'crm-map-modal-foot');
    var remove = el('button', 'crm-map-btn danger', '删除');
    remove.type = 'button';
    foot.appendChild(remove);
    modal.appendChild(foot);
    ui.modalRoot.appendChild(modal);

    close.addEventListener('click', function () {
      if (remove.disabled) return;
      closeModal();
    });

    remove.addEventListener('click', function () {
      remove.disabled = true;
      remove.textContent = '删除中…';
      var removedIndex = -1;
      for (var i = 0; i < state.flags.length; i += 1) {
        if (state.flags[i].id === flag.id) {
          removedIndex = i;
          break;
        }
      }
      deleteFlag(flag.id).then(function () {
        state.flags = state.flags.filter(function (item) { return item.id !== flag.id; });
        cache.flags = state.flags;
        cache.ts = Date.now();
        closeModal(true);
        if (state.selectedId === flag.id) closeDetail();
        applyFlagsData();
        showToast('旗帜已删除', '撤销', function () {
          undoDelete(flag, removedIndex);
        });
      }).catch(function (error) {
        remove.disabled = false;
        remove.textContent = '删除';
        errorBox.textContent = formatError(error);
        errorBox.classList.add('show');
      });
    });
  }

  function loadCities() {
    if (cities.length) return Promise.resolve(cities);
    return fetch(CITIES_URL, { cache: 'force-cache' }).then(function (response) {
      if (!response.ok) throw new Error('城市数据加载失败');
      return response.json();
    }).then(function (json) {
      cities = (json && json.cities) || [];
      if (ui.cityDatalist) {
        ui.cityDatalist.innerHTML = '';
        cities.forEach(function (city) {
          if (city.level !== 'city') return;
          var option = document.createElement('option');
          option.value = city.label;
          option.label = city.province;
          ui.cityDatalist.appendChild(option);
        });
      }
      ensureCityMarkers();
      updateCityLabels();
      return cities;
    });
  }

  function ensureCityMarkers() {
    if (!map || !mapReady || !cities.length) return;
    if (Object.keys(cityMarkers).length) return;
    cities.forEach(function (city) {
      if (city.level !== 'city') return;
      var major = !!MAJOR_CITIES[city.label];
      var anchorRight = Number(city.lng) > 122;
      var markerEl = document.createElement('div');
      markerEl.className = 'crm-map-city-marker' + (major ? ' major' : '') + (anchorRight ? ' right' : '');
      var dot = document.createElement('span');
      dot.className = 'crm-map-city-dot';
      var name = document.createElement('span');
      name.className = 'crm-map-city-name';
      name.textContent = city.label;
      var count = document.createElement('span');
      count.className = 'crm-map-city-count';
      if (anchorRight) {
        markerEl.appendChild(name);
        markerEl.appendChild(count);
        markerEl.appendChild(dot);
      } else {
        markerEl.appendChild(dot);
        markerEl.appendChild(name);
        markerEl.appendChild(count);
      }
      markerEl.setAttribute('aria-label', city.label);
      markerEl.addEventListener('click', function (event) {
        handleCityLabelClick(city, event);
      });
      markerEl.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleCityLabelClick(city, event);
        }
      });
      markerEl.style.display = 'none';
      var marker = new window.maplibregl.Marker({
        element: markerEl,
        anchor: anchorRight ? 'right' : 'left',
        pitchAlignment: 'viewport',
        rotationAlignment: 'viewport'
      })
        .setLngLat([Number(city.lng), Number(city.lat)])
        .addTo(map);
      cityMarkers[city.adcode] = {
        marker: marker,
        el: markerEl,
        nameEl: name,
        countEl: count,
        city: city,
        major: major,
        anchorRight: anchorRight
      };
    });
  }

  function dominantColor(group) {
    var counts = {};
    var best = '#5b8cff';
    var bestCount = 0;
    group.forEach(function (flag) {
      var color = normalizeColor(flag.color);
      counts[color] = (counts[color] || 0) + 1;
    });
    Object.keys(counts).forEach(function (color) {
      if (counts[color] > bestCount) {
        best = color;
        bestCount = counts[color];
      }
    });
    return best;
  }

  function updateCityLabels() {
    if (!map || !mapReady) return;
    var keys = Object.keys(cityMarkers);
    if (!keys.length) return;

    Object.keys(markers).forEach(function (id) {
      markers[id].el.classList.remove('crm-map-flag-clustered');
    });

    if (!state.showCities) {
      keys.forEach(function (key) {
        var entry = cityMarkers[key];
        entry.el.style.display = 'none';
        entry.el.classList.remove('clustered');
        entry.countEl.textContent = '';
        entry.el.removeAttribute('role');
        entry.el.removeAttribute('tabindex');
        entry.el.setAttribute('aria-label', entry.city.label);
        entry.nameEl.style.transform = '';
      });
      scheduleCollision();
      return;
    }

    var zoom = map.getZoom();
    var clusterMode = zoom < CLUSTER_ZOOM;
    var bounds = map.getBounds();
    var groups = {};
    filteredFlags().forEach(function (flag) {
      if (!validFlag(flag)) return;
      var nearest = nearestCityForFlag(flag);
      if (!nearest) return;
      var key = 'city:' + nearest;
      if (!groups[key]) groups[key] = [];
      groups[key].push(flag);
    });
    cityGroups = groups;

    Object.keys(groups).forEach(function (key) {
      var group = groups[key];
      if (!clusterMode || group.length < 2) return;
      group.forEach(function (flag) {
        var markerEntry = markers[flag.id];
        if (markerEntry) markerEntry.el.classList.add('crm-map-flag-clustered');
      });
    });

    var visible = [];
    keys.forEach(function (key) {
      var entry = cityMarkers[key];
      entry.el.style.display = 'none';
      entry.el.classList.remove('clustered');
      entry.countEl.textContent = '';
      entry.el.removeAttribute('role');
      entry.el.removeAttribute('tabindex');
      entry.el.setAttribute('aria-label', entry.city.label);
      entry.nameEl.style.transform = '';

      var group = groups['city:' + entry.city.label];
      var clusterCount = clusterMode && group ? group.length : 0;
      entry.clusterCount = clusterCount >= 2 ? clusterCount : 0;
      if (entry.clusterCount) {
        entry.el.classList.add('clustered');
        entry.countEl.textContent = String(entry.clusterCount);
        entry.countEl.style.setProperty('--cluster-color', dominantColor(group));
        entry.el.setAttribute('role', 'button');
        entry.el.setAttribute('tabindex', '0');
        entry.el.setAttribute('aria-label', entry.city.label + ' ' + entry.clusterCount + ' 面旗帜，点击展开');
        entry.el.title = entry.city.label + ' · ' + entry.clusterCount + ' 面旗帜，点击展开';
      } else {
        entry.el.title = entry.city.label + ' · ' + entry.city.province;
      }

      // 标签层级：低缩放只显示省份；中等缩放显示省会；更高缩放显示全部地级市。
      if (zoom < PROVINCE_LABEL_MAX_ZOOM && !entry.clusterCount) return;
      if (zoom < CAPITAL_MAX_ZOOM && !PROVINCE_CAPITALS[entry.city.label] && !entry.clusterCount) return;
      if (!bounds.contains([entry.city.lng, entry.city.lat])) return;
      visible.push(entry);
    });

    visible.sort(function (a, b) {
      if (a.clusterCount !== b.clusterCount) return b.clusterCount - a.clusterCount;
      if (a.major !== b.major) return a.major ? -1 : 1;
      var aRank = MAJOR_CITY_RANK[a.city.label];
      var bRank = MAJOR_CITY_RANK[b.city.label];
      if (aRank === undefined) aRank = 999;
      if (bRank === undefined) bRank = 999;
      if (aRank !== bRank) return aRank - bRank;
      return a.city.label.length - b.city.label.length;
    });
    if (visible.length > 90) visible = visible.slice(0, 90);

    var flagPoints = [];
    Object.keys(markers).forEach(function (id) {
      var entry = markers[id];
      if (!entry) return;
      if (entry.el.classList.contains('crm-map-flag-filtered') ||
        entry.el.classList.contains('crm-map-flag-collided') ||
        entry.el.classList.contains('crm-map-flag-clustered')) return;
      var flag = findFlag(id);
      if (!flag || !validFlag(flag)) return;
      flagPoints.push(map.project([Number(flag.longitude), Number(flag.latitude)]));
    });

    var kept = [];
    visible.forEach(function (entry) {
      var point = map.project([entry.city.lng, entry.city.lat]);
      var width = entry.city.label.length * 11.5 + 12 + (entry.clusterCount ? 20 : 0);
      var nearFlag = !entry.clusterCount && flagPoints.some(function (flagPoint) {
        return Math.abs(flagPoint.x - point.x) < 42 && Math.abs(flagPoint.y - point.y) < 42;
      });
      var offsets = (entry.major || entry.clusterCount) ? [0, -14, 14, -28, 28] : [0, -14, 14];
      var placed = false;
      for (var i = 0; i < offsets.length; i += 1) {
        var dy = offsets[i];
        var rect = entry.anchorRight
          ? { left: point.x - width, right: point.x, top: point.y - 8 + dy, bottom: point.y + 8 + dy }
          : { left: point.x, right: point.x + width, top: point.y - 8 + dy, bottom: point.y + 8 + dy };
        var overlap = kept.some(function (other) {
          return !(rect.right < other.left || rect.left > other.right || rect.bottom < other.top || rect.top > other.bottom);
        });
        if (!nearFlag && !overlap) {
          entry.nameEl.style.transform = dy ? 'translateY(' + dy + 'px)' : '';
          entry.el.style.display = '';
          kept.push(rect);
          placed = true;
          break;
        }
      }
      if (!placed) {
        entry.nameEl.style.transform = '';
        entry.el.style.display = 'none';
      }
    });
    scheduleCollision();
    scheduleCountyLabels();
    scheduleProvinceLabels();
  }

  function handleCityLabelClick(city, event) {
    if (state.placing) return;
    var group = cityGroups['city:' + city.label];
    if (!group || group.length < 2 || !map || map.getZoom() >= CLUSTER_ZOOM) return;
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    flyToCluster(city, group);
  }

  function flyToCluster(city, group) {
    if (!map || !mapReady) return;
    closeDetail();
    state.search = city.label;
    if (ui.searchInput) ui.searchInput.value = city.label;
    renderList();
    applyFiltersAndCollision();
    updateProvinceData();
    state.interacting = true;
    map.flyTo({
      center: [city.lng, city.lat],
      zoom: CLUSTER_ZOOM + 0.4,
      pitch: 55,
      bearing: map.getBearing(),
      padding: mapPadding(false),
      duration: 1000
    });
    window.setTimeout(function () { state.interacting = false; }, 1300);
    showToast('已展开 ' + city.label + ' 的 ' + group.length + ' 面旗帜，左侧已筛选', '清除', function () {
      state.search = '';
      if (ui.searchInput) ui.searchInput.value = '';
      renderList();
      applyFiltersAndCollision();
      updateProvinceData();
    }, 6500);
  }

  function scheduleCityLabels() {
    if (cityLabelTimer) window.clearTimeout(cityLabelTimer);
    cityLabelTimer = window.setTimeout(function () {
      cityLabelTimer = null;
      updateCityLabels();
    }, 140);
  }

  function renderCityResults(query) {
    if (!ui.cityResults) return;
    var text = String(query || '').trim().toLowerCase();
    ui.cityResults.innerHTML = '';
    if (!text) {
      ui.cityResults.classList.remove('show');
      return;
    }
    if (!cities.length) {
      ui.cityResults.appendChild(el('div', 'crm-map-city-empty', '城市数据未加载'));
      ui.cityResults.classList.add('show');
      return;
    }
    var matches = cities.filter(function (city) {
      return city.label.toLowerCase().indexOf(text) !== -1 ||
        city.name.toLowerCase().indexOf(text) !== -1 ||
        city.province.toLowerCase().indexOf(text) !== -1;
    }).sort(function (a, b) {
      var aStart = a.label.toLowerCase().indexOf(text) === 0 ? 0 : 1;
      var bStart = b.label.toLowerCase().indexOf(text) === 0 ? 0 : 1;
      if (aStart !== bStart) return aStart - bStart;
      return a.label.length - b.label.length;
    }).slice(0, 8);

    if (!matches.length) {
      ui.cityResults.appendChild(el('div', 'crm-map-city-empty', '未找到城市'));
      ui.cityResults.classList.add('show');
      return;
    }
    matches.forEach(function (city) {
      var button = el('button', 'crm-map-city-result');
      button.type = 'button';
      button.appendChild(el('span', '', city.label));
      button.appendChild(el('small', '', city.province));
      button.addEventListener('click', function () {
        flyToCity(city);
      });
      ui.cityResults.appendChild(button);
    });
    ui.cityResults.classList.add('show');
  }

  function hideCityResults() {
    if (ui.cityResults) ui.cityResults.classList.remove('show');
  }

  function flyToCity(city) {
    if (!map || !mapReady) {
      showToast('地图还在加载，请稍候');
      return;
    }
    if (ui.cityInput) ui.cityInput.value = city.label;
    hideCityResults();
    closeDetail();
    state.interacting = true;
    map.flyTo({
      center: [city.lng, city.lat],
      zoom: city.level === 'province' ? 5.7 : 7.2,
      pitch: 55,
      bearing: map.getBearing(),
      padding: mapPadding(false),
      duration: 1100
    });
    window.setTimeout(function () { state.interacting = false; }, 1300);
  }

  function startPoll() {
    stopPoll();
    pollTimer = window.setInterval(function () {
      if (!overlay || overlay.style.display === 'none') return;
      if (state.modalOpen || state.placing || state.loadingFlags) return;
      if (Date.now() - cache.ts >= POLL_MS) {
        loadFlags(true).catch(function () {});
      }
    }, POLL_MS);
  }

  function stopPoll() {
    if (pollTimer) window.clearInterval(pollTimer);
    pollTimer = null;
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    if (!overlay || overlay.style.display === 'none') return;
    if (cache.loaded && Date.now() - cache.ts >= POLL_MS) {
      loadFlags(true).catch(function () {});
    }
  });

  window.__crmMapDebug = {
    getMap: function () { return map; },
    getState: function () {
      return {
        mapReady: mapReady,
        flags: state.flags.length,
        markers: Object.keys(markers).length,
        provinceStats: provinceStats
      };
    }
  };

  window.__crmMapOpen = openMap;

  ensureUiCss().catch(function () {});
})();
