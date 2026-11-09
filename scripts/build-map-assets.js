#!/usr/bin/env node
/*
 * 生成“经销商地图”的本地静态资源：
 *   nginx/crm-map/maplibre-gl-5.9.0.js
 *   nginx/crm-map/maplibre-gl-5.9.0.css
 *   nginx/crm-map/LICENSE-maplibre.txt
 *   nginx/crm-map/china-provinces.geojson
 *   nginx/crm-map/china-city-boundaries.geojson
 *   nginx/crm-map/china-cities.json
 *
 * 数据源：
 *   - MapLibre GL JS（BSD-3-Clause）: https://unpkg.com/maplibre-gl@5.9.0/
 *   - 中国行政区划边界（仅供内部使用）: https://geo.datav.aliyun.com/areas_v3/bound/
 *
 * 用法：node scripts/build-map-assets.js
 * 只使用 Node 内置模块，不需要 npm install。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const MAPLIBRE_VERSION = '5.9.0';
const OUT_DIR = path.join(__dirname, '..', 'nginx', 'crm-map');
const PROVINCE_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json';
const PROVINCE_PATTERN = 'https://geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json';
const MAPLIBRE_BASE = 'https://unpkg.com/maplibre-gl@' + MAPLIBRE_VERSION + '/';

const MUNICIPALITIES = {
  110000: '北京市',
  120000: '天津市',
  310000: '上海市',
  500000: '重庆市'
};

const SPECIAL_REGIONS = {
  810000: '香港特别行政区',
  820000: '澳门特别行政区',
  710000: '台湾省'
};

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function fetchBuffer(url, redirects) {
  const left = typeof redirects === 'number' ? redirects : 5;
  return new Promise(function (resolve, reject) {
    const target = new URL(url);
    const req = https.get(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 443,
        path: target.pathname + target.search,
        headers: {
          'User-Agent': 'aicyld-crm-map-assets/1.0',
          Accept: '*/*'
        },
        timeout: 90000
      },
      function (res) {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && left > 0) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          fetchBuffer(next, left - 1).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error('HTTP ' + res.statusCode + ' ' + url));
          return;
        }
        const chunks = [];
        res.on('data', function (chunk) { chunks.push(chunk); });
        res.on('end', function () { resolve(Buffer.concat(chunks)); });
      }
    );
    req.on('timeout', function () { req.destroy(new Error('timeout ' + url)); });
    req.on('error', reject);
  });
}

async function fetchJson(url) {
  const buffer = await fetchBuffer(url);
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  return JSON.parse(text);
}

function round(value, digits) {
  const factor = Math.pow(10, digits);
  return Math.round(Number(value) * factor) / factor;
}

function roundCoordinates(node, digits) {
  if (!Array.isArray(node)) return node;
  if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
    return [round(node[0], digits), round(node[1], digits)];
  }
  return node.map(function (child) { return roundCoordinates(child, digits); });
}

function stripProvinceFeature(feature) {
  const props = feature.properties || {};
  const center = Array.isArray(props.center)
    ? [round(props.center[0], 6), round(props.center[1], 6)]
    : null;
  const centroid = Array.isArray(props.centroid)
    ? [round(props.centroid[0], 6), round(props.centroid[1], 6)]
    : null;
  return {
    type: 'Feature',
    id: props.adcode,
    properties: {
      adcode: props.adcode,
      name: props.name,
      center: center,
      centroid: centroid
    },
    geometry: {
      type: feature.geometry && feature.geometry.type,
      coordinates: feature.geometry ? roundCoordinates(feature.geometry.coordinates, 4) : null
    }
  };
}

function shortLabel(name) {
  return String(name || '')
    .replace(/特别行政区$/, '')
    .replace(/维吾尔自治区$/, '')
    .replace(/壮族自治区$/, '')
    .replace(/回族自治区$/, '')
    .replace(/自治区$/, '')
    .replace(/[省市]$/, '');
}

function stripCityBoundary(feature, provinceName, level) {
  const props = feature.properties || {};
  if (!feature.geometry || !props.adcode || !props.name) return null;
  return {
    type: 'Feature',
    id: props.adcode,
    properties: {
      adcode: props.adcode,
      name: props.name,
      province: provinceName,
      level: level || 'city'
    },
    geometry: {
      type: feature.geometry.type,
      coordinates: roundCoordinates(feature.geometry.coordinates, 3)
    }
  };
}

function normalizeCity(feature, provinceName) {
  const props = feature.properties || {};
  const center = Array.isArray(props.center) ? props.center : props.centroid;
  if (!Array.isArray(center) || center.length < 2) return null;
  const name = props.name;
  if (!name || !props.adcode) return null;
  return {
    name: name,
    label: shortLabel(name),
    province: provinceName,
    lng: round(center[0], 6),
    lat: round(center[1], 6),
    adcode: props.adcode,
    level: props.level === 'province' ? 'province' : 'city'
  };
}

async function buildCities(provinces) {
  const cities = [];
  const boundaries = [];
  const seen = {};
  const boundarySeen = {};

  function add(entry) {
    if (!entry) return;
    const key = String(entry.adcode || entry.name);
    if (seen[key]) return;
    seen[key] = true;
    cities.push(entry);
  }

  function addBoundary(feature, provinceName, level) {
    const boundary = stripCityBoundary(feature, provinceName, level);
    if (!boundary) return;
    const key = String(boundary.properties.adcode);
    if (boundarySeen[key]) return;
    boundarySeen[key] = true;
    boundaries.push(boundary);
  }

  for (const feature of provinces.features) {
    const props = feature.properties || {};
    const adcode = props.adcode;
    const name = props.name;
    if (!adcode || !name) continue;

    // 省/自治区本身也加入搜索，便于直接飞到省中心。
    if (Array.isArray(props.center)) {
      add({
        name: name,
        label: shortLabel(name),
        province: name,
        lng: round(props.center[0], 6),
        lat: round(props.center[1], 6),
        adcode: adcode,
        level: 'province'
      });
    }

    // 直辖市：只保留市本身，不把区当成“城市”。
    if (MUNICIPALITIES[adcode]) {
      add({
        name: name,
        label: shortLabel(name),
        province: name,
        lng: round(props.center[0], 6),
        lat: round(props.center[1], 6),
        adcode: adcode,
        level: 'city'
      });
      // 直辖市的市界用省级面；区县界留给后续“区县边界”数据。
      addBoundary(feature, name, 'city');
      continue;
    }

    // 港澳台：保留省级中心点，不再请求下级。
    if (SPECIAL_REGIONS[adcode]) {
      addBoundary(feature, name, 'city');
      continue;
    }

    const url = PROVINCE_PATTERN.replace('{adcode}', String(adcode));
    let detail;
    try {
      detail = await fetchJson(url);
    } catch (error) {
      console.warn('警告：' + name + ' 城市数据获取失败：' + error.message);
      continue;
    }
    await sleep(120);

    (detail.features || []).forEach(function (cityFeature) {
      const cityProps = cityFeature.properties || {};
      if (!cityProps.adcode || !cityProps.name) return;
      // 只取地级市/直辖县级单位，跳过区县（不同省份的 level 命名不完全一致）。
      if (cityProps.level && cityProps.level !== 'city') return;
      add(normalizeCity(cityFeature, name));
      addBoundary(cityFeature, name, 'city');
    });
  }

  // 直辖市的省级中心点同时就是城市中心点，标记为 city 供“最近城市”使用。
  cities.forEach(function (city) {
    if (MUNICIPALITIES[city.adcode]) city.level = 'city';
  });

  cities.sort(function (a, b) {
    if (a.province !== b.province) return a.province.localeCompare(b.province, 'zh-CN');
    if (a.level !== b.level) return a.level === 'province' ? -1 : 1;
    return a.label.localeCompare(b.label, 'zh-CN');
  });

  return { cities: cities, boundaries: boundaries };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('下载 MapLibre GL JS ' + MAPLIBRE_VERSION + '…');
  const js = await fetchBuffer(MAPLIBRE_BASE + 'dist/maplibre-gl.js');
  fs.writeFileSync(path.join(OUT_DIR, 'maplibre-gl-' + MAPLIBRE_VERSION + '.js'), js);

  const css = await fetchBuffer(MAPLIBRE_BASE + 'dist/maplibre-gl.css');
  fs.writeFileSync(path.join(OUT_DIR, 'maplibre-gl-' + MAPLIBRE_VERSION + '.css'), css);

  let license = null;
  for (const candidate of ['LICENSE.txt', 'LICENSE']) {
    try {
      license = await fetchBuffer(MAPLIBRE_BASE + candidate);
      break;
    } catch (error) {
      // try next
    }
  }
  if (license) {
    fs.writeFileSync(path.join(OUT_DIR, 'LICENSE-maplibre.txt'), license);
  } else {
    console.warn('警告：MapLibre LICENSE 下载失败，请手动补充。');
  }

  console.log('下载中国省份边界…');
  const china = await fetchJson(PROVINCE_URL);
  if (!china || !Array.isArray(china.features)) {
    throw new Error('省份 GeoJSON 格式不正确');
  }

  const provinces = {
    type: 'FeatureCollection',
    features: china.features
      .filter(function (f) { return f && f.geometry && f.properties && f.properties.adcode; })
      .map(stripProvinceFeature)
  };
  fs.writeFileSync(
    path.join(OUT_DIR, 'china-provinces.geojson'),
    JSON.stringify(provinces)
  );

  console.log('抓取地级市中心点（' + provinces.features.length + ' 个省级单元）…');
  const cityResult = await buildCities(provinces);
  const cities = cityResult.cities;
  fs.writeFileSync(
    path.join(OUT_DIR, 'china-city-boundaries.geojson'),
    JSON.stringify({
      type: 'FeatureCollection',
      features: cityResult.boundaries
    })
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'china-cities.json'),
    JSON.stringify({
      version: 1,
      source: 'DataV.GeoAtlas',
      generatedAt: new Date().toISOString(),
      cities: cities
    })
  );

  function size(name) {
    try {
      return (fs.statSync(path.join(OUT_DIR, name)).size / 1024).toFixed(1) + ' KB';
    } catch (error) {
      return 'missing';
    }
  }

  console.log('');
  console.log('完成：');
  ['maplibre-gl-' + MAPLIBRE_VERSION + '.js', 'maplibre-gl-' + MAPLIBRE_VERSION + '.css',
    'china-provinces.geojson', 'china-city-boundaries.geojson', 'china-cities.json', 'LICENSE-maplibre.txt'].forEach(function (name) {
    console.log('  ' + name + '  ' + size(name));
  });
  console.log('  城市/省级定位点：' + cities.length + ' 个');
}

main().catch(function (error) {
  console.error('失败：' + error.message);
  process.exit(1);
});
