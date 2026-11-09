#!/usr/bin/env node
/*
 * 初始化“经销商地图”使用的独立对象 dealerFlag（经销商旗帜）。
 *
 * 这个脚本是幂等的：对象/字段存在时只校正标签，不会删除任何数据。
 * 用法：
 *   TWENTY_METADATA_TOKEN=xxx node scripts/setup-dealer-map.js
 *   TWENTY_URL=https://crm.aicyld.com TWENTY_METADATA_TOKEN=xxx node scripts/setup-dealer-map.js
 *
 * Token 需要是 Admin 角色的 API key；脚本不会把 token 写入任何文件。
 */

'use strict';

const https = require('https');
const { URL } = require('url');

const BASE_URL = process.env.TWENTY_URL || 'https://crm.aicyld.com';
const TOKEN = process.env.TWENTY_METADATA_TOKEN || '';
const METADATA_URL = BASE_URL.replace(/\/+$/, '') + '/metadata';

const OBJECT = {
  nameSingular: 'dealerFlag',
  namePlural: 'dealerFlags',
  labelSingular: '经销商旗帜',
  labelPlural: '经销商旗帜',
  description: '经销商地图上的手动旗帜标记，不关联客户数据',
  icon: 'IconFlag',
  isLabelSyncedWithName: false
};

const NAME_FIELD_LABEL = '名称';

const FIELDS = [
  {
    name: 'tag',
    label: '标签',
    type: 'TEXT',
    isNullable: true,
    isSearchable: true,
    isLabelSyncedWithName: false
  },
  {
    name: 'color',
    label: '颜色',
    type: 'TEXT',
    isNullable: false,
    defaultValue: "'#3e63dd'",
    isLabelSyncedWithName: false
  },
  {
    name: 'city',
    label: '城市',
    type: 'TEXT',
    isNullable: true,
    isSearchable: true,
    isLabelSyncedWithName: false
  },
  {
    name: 'longitude',
    label: '经度',
    type: 'NUMBER',
    isNullable: true,
    isLabelSyncedWithName: false
  },
  {
    name: 'latitude',
    label: '纬度',
    type: 'NUMBER',
    isNullable: true,
    isLabelSyncedWithName: false
  },
  {
    name: 'note',
    label: '备注',
    type: 'TEXT',
    isNullable: true,
    isLabelSyncedWithName: false
  }
];

function request(query, variables) {
  return new Promise(function (resolve, reject) {
    const body = JSON.stringify({ query: query, variables: variables || {} });
    const url = new URL(METADATA_URL);
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(body),
          Authorization: 'Bearer ' + TOKEN,
          'apollo-require-preflight': 'true'
        }
      },
      function (res) {
        const chunks = [];
        res.on('data', function (chunk) { chunks.push(chunk); });
        res.on('end', function () {
          const text = Buffer.concat(chunks).toString('utf8');
          let json;
          try {
            json = JSON.parse(text);
          } catch (error) {
            reject(new Error('接口返回非 JSON（HTTP ' + res.statusCode + '）：' + text.slice(0, 300)));
            return;
          }
          if (res.statusCode === 401 || res.statusCode === 403) {
            reject(new Error('认证失败（HTTP ' + res.statusCode + '），请检查 TWENTY_METADATA_TOKEN'));
            return;
          }
          if (json.errors && json.errors.length) {
            reject(new Error(json.errors.map(function (e) { return e.message; }).join('; ')));
            return;
          }
          resolve(json.data);
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function loadObjects() {
  const data = await request(
    'query DealerMapObjects {' +
      '  objects(paging: { first: 300 }) {' +
      '    edges { node {' +
      '      id nameSingular labelSingular labelPlural description icon' +
      '      fields(paging: { first: 200 }) { edges { node { id name label type } } }' +
      '    } }' +
      '  }' +
      '}'
  );
  return (data.objects.edges || []).map(function (edge) { return edge.node; });
}

async function createObject() {
  const data = await request(
    'mutation DealerMapCreateObject($object: CreateObjectInput!) {' +
      '  createOneObject(input: { object: $object }) { id nameSingular labelSingular }' +
      '}',
    { object: OBJECT }
  );
  return data.createOneObject;
}

async function updateObject(id) {
  const data = await request(
    'mutation DealerMapUpdateObject($id: UUID!, $update: UpdateObjectPayload!) {' +
      '  updateOneObject(input: { id: $id, update: $update }) { id nameSingular labelSingular labelPlural icon }' +
      '}',
    {
      id: id,
      update: {
        labelSingular: OBJECT.labelSingular,
        labelPlural: OBJECT.labelPlural,
        description: OBJECT.description,
        icon: OBJECT.icon,
        isLabelSyncedWithName: false
      }
    }
  );
  return data.updateOneObject;
}

async function createField(objectMetadataId, field) {
  const payload = Object.assign({ objectMetadataId: objectMetadataId }, field);
  const data = await request(
    'mutation DealerMapCreateField($field: CreateFieldInput!) {' +
      '  createOneField(input: { field: $field }) { id name label type }' +
      '}',
    { field: payload }
  );
  return data.createOneField;
}

async function updateField(id, patch) {
  const data = await request(
    'mutation DealerMapUpdateField($id: UUID!, $update: UpdateFieldInput!) {' +
      '  updateOneField(input: { id: $id, update: $update }) { id name label }' +
      '}',
    { id: id, update: patch }
  );
  return data.updateOneField;
}

async function main() {
  if (!TOKEN) {
    throw new Error('缺少 TWENTY_METADATA_TOKEN');
  }
  if (!/^https?:\/\//.test(BASE_URL)) {
    throw new Error('TWENTY_URL 需要以 http:// 或 https:// 开头');
  }

  console.log('目标：' + BASE_URL);
  let objects = await loadObjects();
  let objectNode = objects.find(function (node) { return node.nameSingular === OBJECT.nameSingular; });

  if (!objectNode) {
    console.log('创建对象 ' + OBJECT.nameSingular + '…');
    objectNode = await createObject();
    objects = await loadObjects();
    objectNode = objects.find(function (node) { return node.nameSingular === OBJECT.nameSingular; });
  } else {
    console.log('对象已存在：' + objectNode.id + '，校正标签…');
    await updateObject(objectNode.id);
  }

  if (!objectNode) {
    throw new Error('对象创建后未找到 ' + OBJECT.nameSingular);
  }

  const fieldMap = {};
  (objectNode.fields.edges || []).forEach(function (edge) {
    if (edge && edge.node && edge.node.name) fieldMap[edge.node.name] = edge.node;
  });

  const nameField = fieldMap.name;
  if (!nameField) {
    console.warn('警告：对象没有 name 字段，地图将无法保存名称。');
  } else if (nameField.label !== NAME_FIELD_LABEL) {
    console.log('校正 name 字段标签：' + nameField.label + ' → ' + NAME_FIELD_LABEL);
    await updateField(nameField.id, { label: NAME_FIELD_LABEL });
  }

  for (const spec of FIELDS) {
    const existing = fieldMap[spec.name];
    if (!existing) {
      console.log('创建字段 ' + spec.name + '（' + spec.label + '）…');
      await createField(objectNode.id, spec);
      continue;
    }
    if (existing.type !== spec.type) {
      console.warn('跳过字段 ' + spec.name + '：已存在但类型是 ' + existing.type + '，期望 ' + spec.type);
      continue;
    }
    if (existing.label !== spec.label) {
      console.log('校正字段 ' + spec.name + ' 标签：' + existing.label + ' → ' + spec.label);
      await updateField(existing.id, { label: spec.label });
    }
  }

  const finalObjects = await loadObjects();
  const finalObject = finalObjects.find(function (node) { return node.nameSingular === OBJECT.nameSingular; });
  const summary = {
    objectId: finalObject.id,
    nameSingular: finalObject.nameSingular,
    namePlural: finalObject.namePlural,
    labelSingular: finalObject.labelSingular,
    labelPlural: finalObject.labelPlural,
    icon: finalObject.icon,
    fields: (finalObject.fields.edges || []).map(function (edge) {
      return { name: edge.node.name, label: edge.node.label, type: edge.node.type };
    }).filter(function (field) {
      return ['name', 'tag', 'color', 'city', 'longitude', 'latitude', 'note'].indexOf(field.name) !== -1;
    })
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(function (error) {
  console.error('失败：' + error.message);
  process.exit(1);
});
