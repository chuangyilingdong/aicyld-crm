#!/usr/bin/env node
/*
 * 生成区县行政边界（自托管，按省拆文件）：
 *   nginx/crm-map/counties/<provinceAdcode>.geojson
 *
 * 数据源：阿里云 DataV.GeoAtlas（仅供内部展示）。
 * 依赖已生成的：
 *   nginx/crm-map/china-provinces.geojson
 *   nginx/crm-map/china-cities.json
 *
 * 用法：node scripts/build-county-assets.js
 * 说明：会请求约 367 个城市/直辖市的 _full.json，约 1–3 分钟。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const OUT_DIR = path.join(__dirname, '..', 'nginx', 'crm-map');
const COUNTY_DIR = path.join(OUT_DIR, 'counties');
const CITY_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json';

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function fetchBuffer(url, redirects) {
  const left = typeof redirects === 'number' ? redirects : 5;
  return new Promise(function (resolve, reject) {
    const target = new URL(url);
    const req = https.get({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 443,
      path: target.pathname + target.search,
      headers: { 'User-Agent': 'aicyld-crm-county-assets/1.0', Accept: '*/*' },
      timeout: 90000
    }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && left > 0) {
        res.resume();
        fetchBuffer(new URL(res.headers.location, url).toString(), left - 1).then(resolve, reject);
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
    });
    req.on('timeout', function () { req.destroy(new Error('timeout ' + url)); });
    req.on('error', reject);
  });
}

async function fetchJson(url) {
  const buffer = await fetchBuffer(url);
  return JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, ''));
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

function stripBoundary(feature, provinceName, cityName) {
  const props = feature.properties || {};
  if (!feature.geometry || !props.adcode || !props.name) return null;
  return {
    type: 'Feature',
    id: props.adcode,
    properties: {
      adcode: props.adcode,
      name: props.name,
      province: provinceName,
      city: cityName,
      level: 'district'
    },
    geometry: {
      type: feature.geometry.type,
      coordinates: roundCoordinates(feature.geometry.coordinates, 3)
    }
  };
}

async function main() {
  const provinces = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'china-provinces.geojson'), 'utf8'));
  const cityData = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'china-cities.json'), 'utf8'));
  const provinceAdcode = {};
  (provinces.features || []).forEach(function (feature) {
    const props = feature.properties || {};
    if (props.name && props.adcode) provinceAdcode[props.name] = props.adcode;
  });

  const buckets = {};
  const seen = {};
  const cities = (cityData.cities || []).filter(function (city) { return city.level === 'city'; });
  let failed = 0;
  let fetched = 0;

  fs.mkdirSync(COUNTY_DIR, { recursive: true });

  for (const city of cities) {
    const province = city.province;
    const pAdcode = provinceAdcode[province];
    if (!pAdcode) {
      failed += 1;
      continue;
    }
    const url = CITY_URL.replace('{adcode}', String(city.adcode));
    let detail;
    try {
      detail = await fetchJson(url);
    } catch (error) {
      failed += 1;
      console.warn('警告：' + province + ' / ' + city.label + ' 区县获取失败：' + error.message);
      continue;
    }
    if (!buckets[pAdcode]) buckets[pAdcode] = [];
    (detail.features || []).forEach(function (feature) {
      const boundary = stripBoundary(feature, province, city.label);
      if (!boundary) return;
      const key = String(boundary.properties.adcode);
      if (seen[key]) return;
      seen[key] = true;
      buckets[pAdcode].push(boundary);
    });
    fetched += 1;
    if (fetched % 25 === 0) console.log('已抓取 ' + fetched + ' / ' + cities.length + ' 个城市…');
    await sleep(80);
  }

  let totalBytes = 0;
  let totalFeatures = 0;
  const files = Object.keys(buckets).sort();
  files.forEach(function (adcode) {
    const features = buckets[adcode];
    if (!features.length) return;
    features.sort(function (a, b) { return String(a.properties.adcode).localeCompare(String(b.properties.adcode)); });
    const content = JSON.stringify({ type: 'FeatureCollection', features: features });
    fs.writeFileSync(path.join(COUNTY_DIR, adcode + '.geojson'), content);
    totalBytes += Buffer.byteLength(content);
    totalFeatures += features.length;
  });

  console.log('');
  console.log('完成：');
  console.log('  省份文件：' + files.length + ' 个');
  console.log('  区县要素：' + totalFeatures + ' 个');
  console.log('  总大小：' + (totalBytes / 1024 / 1024).toFixed(1) + ' MB');
  if (failed) console.log('  跳过/失败：' + failed + ' 个城市');
}

main().catch(function (error) {
  console.error('失败：' + error.message);
  process.exit(1);
});
