# 经销商地图（独立旗帜板）

> 2026-11-08 上线。中国 3D 地图 + 手动旗帜标记，**不关联客户数据**，不改客户对象。
> 入口：侧栏“经销商地图”；侧栏入口失效时右下角有悬浮按钮；也可直接打开 `/crm-map/standalone.html`（需登录）。

## 1. 它是什么

- 一张全屏中国 3D 地图，省份按“该省旗帜数量”做高度和颜色分层；缩放拉近后 3D 高度自动渐隐，方便看城市。
- **名称分四级**：低缩放（< 5.0）只显示省份名；5.0–6.4 显示省会；6.4 以上显示全部地级市；7.2 以上显示区县简称。右上角图钉按钮可统一开关这些名称。省份/城市名来自本地边界和 `china-cities.json`，只作定位参考，不是客户数据。
- **省份 hover 只显示信息浮层**，不再改变省份填充/描边颜色；这样不会出现 3D 顶面高亮和底部边界线错位。
- **行政边界（自托管）**：放大后自动出现更细的边界——城市级（zoom ≥ 5.2）显示地级市边界，区县级（zoom ≥ 6.8）按当前省份懒加载区县边界；zoom ≥ 7.2 再显示区县简称（如融水、环江、巴马）。全部是同源静态 GeoJSON，不请求在线瓦片；没有道路/水系/POI/村镇注记（这些需要在线底图或大体量 OSM 数据）。
- **同城聚合**：同一个城市有 2 面以上旗帜时，全国/省级视角不再把旗帜叠在一起，而是在城市名右侧显示数量（如“杭州 3”）；点数字会飞到该城市并把左侧列表筛选到这几面旗帜。缩放到城市级（zoom ≥ 6）后显示单面旗帜。
- **连续放置**：保存后保持放置模式，可以继续点地图放下一面；Esc 退出。会记住上次用的颜色和标签，适合一次标很多城市。
- **删除撤销**：删除后 6 秒内，底部提示条有“撤销”，误删可恢复。
- 每面旗帜是一条独立记录，可以放在任意经纬度，用来标记城市、经销商、渠道或任何你想记的点。
- 旗帜有：名称、标签、颜色、城市、备注、经纬度。颜色和标签都由你自己定，不限制分类。
- 地图上的重叠旗帜会自动收起（保留最新/选中的），左侧列表始终显示全部；点击列表行会飞到该旗帜。
- 地图完全自托管：MapLibre + 中国省份 GeoJSON + 城市中心点，全部同源加载，**不请求任何在线瓦片或第三方服务**。

## 2. 怎么用

### 放置旗帜

1. 点右上角 **放置旗帜**，进入放置模式（顶部出现提示条）。
2. 在地图上点一下目标位置；弹出“新增旗帜”表单。
3. 填名称（必填）、标签、城市、颜色、备注；城市会按点击位置自动填最近的城市，可以改。连续放置时会自动带出上次的颜色和标签。
4. 点 **保存并继续**。旗帜保存后仍保持放置模式，可以继续点地图放下一面；按 Esc 或点提示条里的“取消”退出。
5. 如果只想放一面，保存后按 Esc 即可；不会自动跳到详情，地图停留在当前位置。

### 调整 / 编辑 / 删除

- **拖动**旗帜：按住旗杆/旗面拖动，松开后自动保存经纬度；如果城市是自动填的，会随新位置更新最近城市。
- **点击**旗帜：右侧详情显示标签、城市、坐标、备注、更新时间。
- **编辑**：改名称、标签、城市、颜色、备注；保存后地图、列表、标签筛选同步更新。
- **删除**：详情里点“删除”，确认后删除；删除后 6 秒内底部提示条有“撤销”，可恢复（走 `restoreDealerFlag`）。超过 6 秒后不再提供撤销。
- **复制坐标**：复制 `经度, 纬度` 到剪贴板。
- **定位**：飞到该旗帜并保持详情打开。

### 筛选 / 搜索 / 定位

- **同城数字**：城市名右侧的蓝色/彩色数字 = 该城市当前筛选下的旗帜数；点数字会飞到城市，并把左侧列表筛选到该城市（底部提示条可点“清除”恢复全部）。
- **标签筛选**：顶部标签条按使用次数排序；点标签只看该标签的旗帜，3D 省份高度同步重算；点“全部”恢复。
- **搜索**：按名称、标签、城市、备注搜索；也会按旗帜坐标最近的城市的名字匹配，所以城市字段留空也能搜到。
- **定位城市**：左侧“定位城市”输入城市名（如“杭州”），选择结果后飞到城市中心；适合先定位再放旗。
- **名称开关**：右上角图钉按钮显示/隐藏省份名、城市名、同城数字、区县名；名称按缩放层级显示（省份 → 省会 → 全部地级市 → 区县），重叠时自动收起或上下错开，不会改变城市坐标。行政边界线不受开关影响。
- **自动旋转**：右上角旋转按钮开关；手动拖动/缩放会暂停，停手后恢复。
- **缩放/重置**：右下角 + / − / 回到全国视角。

### 关闭规则

- 主地图面板**只点右上角 × 关闭**；点地图空白、点遮罩都不会关。
- 新增/编辑/删除确认表单也**只点右上角 × 关闭**；点空白、按 Esc 不会关，避免丢输入。
- Esc 只做两件事：放置模式下取消放置；详情打开时关闭详情。不会关闭主面板或表单。
- 保存成功后表单自动关闭。

## 3. 数据模型

独立自定义对象 `dealerFlag`（标签“经销商旗帜”），对象 ID：

```
52931894-34bd-41b7-b8e8-6e099accf7af
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | TEXT | 名称（城市/经销商/渠道），必填（表单校验） |
| `tag` | TEXT | 自由标签，如“旗舰店”“待签约” |
| `color` | TEXT | 旗帜颜色 hex，如 `#3e63dd`；默认 `#3e63dd` |
| `city` | TEXT | 城市/地区，可空；放置时按最近城市自动填 |
| `longitude` | NUMBER | 经度，存 double，地图显示 6 位小数 |
| `latitude` | NUMBER | 纬度，存 double，地图显示 6 位小数 |
| `note` | TEXT | 备注，可空 |

标准字段（id、createdAt、updatedAt 等）由 Twenty 自动生成。GraphQL 名称：

- 查询：`dealerFlags`、`dealerFlag`
- 新增：`createDealerFlag(data: DealerFlagCreateInput!)`
- 修改：`updateDealerFlag(id: UUID!, data: DealerFlagUpdateInput!)`
- 删除（软删）：`deleteDealerFlag(id: UUID!)`
- 恢复（撤销删除）：`restoreDealerFlag(id: UUID!)`
- 彻底删除（清理测试数据用）：`destroyDealerFlag(id: UUID!)`

初始化脚本（幂等，可重复跑）：

```bash
cd /opt/twenty
TWENTY_METADATA_TOKEN='<Admin API key>' \
  TWENTY_URL=https://crm.aicyld.com \
  node scripts/setup-dealer-map.js
```

- 脚本会创建/校正对象和 7 个字段；已有对象不会被删除。
- 如果从旧备份恢复、对象不存在，重跑即可；地图会提示“经销商旗帜对象尚未初始化，请运行 scripts/setup-dealer-map.js”。
- **不要把 API key 写进仓库或文档。** 本次部署用的临时 key `map-temp-20261108` 已撤销。

### 权限

- 当前三位成员都是 Admin，可直接读写。
- 以后新增 Member：需要在“设置 → 角色”里给 `经销商旗帜` 对象读写权限；如果系统角色不可编辑，就建一个自定义角色，或继续用 Admin。地图脚本以当前登录用户身份读写，不会在浏览器里放 API key。
- 通过 metadata API 创建对象时 Twenty 会自动生成一个原生侧栏入口；本次已删除，只保留“经销商地图”。如果以后从旧备份重建对象又出现“经销商旗帜”入口，可在设置里隐藏，或用 metadata API 删除对应的 `navigationMenuItem`。对象本身仍在“设置 → 数据模型”里，可用于表格查看/导出。

## 4. 资产与部署

### 仓库文件

```
nginx/
├─ crm-map.js                       # 地图 UI / GraphQL / 3D / 旗帜
└─ crm-map/
   ├─ crm-map.css                   # 地图 UI 样式
   ├─ maplibre-gl-5.9.0.js          # MapLibre GL JS（BSD-3-Clause）
   ├─ maplibre-gl-5.9.0.css
   ├─ LICENSE-maplibre.txt
   ├─ china-provinces.geojson       # 阿里云 DataV 中国省份边界
   ├─ china-city-boundaries.geojson # 370 个地级市边界（约 2.4 MB，懒加载）
   ├─ counties/<省adcode>.geojson    # 31 个省的区县边界（合计约 16 MB，按省懒加载）
   ├─ china-cities.json             # 397 个城市/省级定位点（367 个地级市用于城市名）
   ├─ preview.html                  # 演示数据，无需登录
   └─ standalone.html               # 真实数据直连页，需登录
scripts/
├─ build-map-assets.js              # 重新生成 MapLibre/省份/城市边界/城市点
├─ build-county-assets.js           # 重新生成 31 个省的区县边界
└─ setup-dealer-map.js              # 幂等创建对象/字段
```

### 服务器路径

- `/opt/twenty/nginx/crm-map.js`
- `/opt/twenty/nginx/crm-map/`（上面 `crm-map/` 目录的全部文件）

### Nginx

线上配置 `/etc/nginx/sites-available/crm.aicyld.com` 增加了：

```nginx
location = /crm-map.js { ... no-cache ... }
location = /crm-map/crm-map.css { ... no-cache ... }
location = /crm-map/maplibre-gl-5.9.0.js { ... max-age=31536000, immutable ... }
location = /crm-map/maplibre-gl-5.9.0.css { ... max-age=31536000, immutable ... }
location /crm-map/ { ... max-age=86400 ... }
```

并在 `location /` 的 `sub_filter` 末尾追加：

```html
<script src="/crm-map.js" defer></script>
```

改完必须 `nginx -t` 再 `systemctl reload nginx`。配置备份：

- `/etc/nginx/sites-available/crm.aicyld.com.bak-20261108-map`
- `/etc/nginx/sites-available/crm.aicyld.com.bak-20261108-map-deploy`

### 更新地图资源

```bash
# 本地
cd E:\crm
node scripts/build-map-assets.js
node scripts/build-county-assets.js

# 上传
tar -C nginx -czf - crm-map.js crm-map | ssh ai-kids-prod "tar -xzf - -C /opt/twenty/nginx"
scp nginx/crm-insights.js ai-kids-prod:/opt/twenty/nginx/crm-insights.js
```

`build-county-assets.js` 会请求约 367 个城市的 `_full.json`，生成 31 个省的区县边界文件；东莞、中山、嘉峪关等没有下级区县的城市只有市界，没有区县文件。区县文件按当前地图中心的省份懒加载，切到邻省会再拉对应文件。

`build-map-assets.js` 会重新下载：

- `https://unpkg.com/maplibre-gl@5.9.0/`
- `https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json` 及各省 `_full.json`

下载后写入 `nginx/crm-map/`，覆盖同名文件。数据源仅用于内部展示，页面已标注“3D 高度 = 该省旗帜数”，不用于公开发布。

## 5. 侧栏入口

`crm-insights.js` 负责：

- 在“沟通总览”和业务概览卡片之前插入 **经销商地图**（旗帜图标）。
- 折叠侧栏时只留图标，宽度 28px。
- 每 10 秒自检补回入口；侧栏入口和卡片都不可见超过 2 秒时，右下角出现“经销商地图 / 业务概览 / 沟通总览”悬浮按钮。
- 点击入口调用 `window.__crmMapOpen()`；如果地图脚本还没加载，会提示“正在加载”并 900ms 后重试。

直接访问：

- 演示数据：`https://crm.aicyld.com/crm-map/preview.html`（无需登录，15 面样例旗帜）
- 真实数据：`https://crm.aicyld.com/crm-map/standalone.html`（需要先登录 CRM；关闭地图后页面有“返回 CRM”）

## 6. 验收 / 排障

### 快速检查

```bash
for p in /crm-map.js /crm-map/crm-map.css /crm-map/maplibre-gl-5.9.0.js \
         /crm-map/maplibre-gl-5.9.0.css /crm-map/china-provinces.geojson \
         /crm-map/china-city-boundaries.geojson /crm-map/counties/450000.geojson \
         /crm-map/china-cities.json /crm-map/preview.html /crm-map/standalone.html; do
  curl -s -o /dev/null -w "$p %{http_code}\n" "https://crm.aicyld.com$p"
done
```

浏览器打开 `preview.html`，应看到：

- 3D 中国省份（有高度、有侧面、有边界发光）
- 默认 3.6 全国视角：34 个省份名，没有普通地级市名；示例旗帜的同城数字（北京 2、广州 2、杭州 3）仍显示
- 放大到 5.5：省份名隐藏，显示省会
- 放大到 6.6：显示全部地级市
- 放大到 7.2（例如广西 `center:[108.3,23.8]`）：出现地级市边界、区县边界和区县简称；如果只看到边界没有名称，检查右上角图钉按钮是否处于关闭状态
- 左侧列表、标签筛选、顶部 KPI、右侧详情（点列表行）
- 控制台无报错；`window.__crmMapLastError` 为空

### 常见问题

| 现象 | 处理 |
|---|---|
| 地图一直“正在加载 3D 地图…”或“地图加载超时” | 先确认 `/crm-map/` 资源 200；在控制台看 `window.__crmMapLastError`。改过 style 表达式时，注意 MapLibre 限制：`zoom` 只能作为顶层 `interpolate`/`step` 的输入，不能嵌套在算术表达式里。 |
| “经销商旗帜对象尚未初始化” | 跑 `scripts/setup-dealer-map.js`；确认对象 `dealerFlag` 和 7 个字段存在。 |
| “登录状态已失效” | 重新登录 CRM 后刷新；`standalone.html` 依赖当前站点 cookie。 |
| 侧栏没有“经销商地图” | 检查 `crm-insights.js` 是否加载、`.navigation-drawer-item` 是否存在；右下角悬浮按钮可兜底；也可直接用 `standalone.html`。 |
| 地图上看不到某面旗帜 | 可能与其他旗帜重叠被自动收起；左侧列表能看到全部，点列表行会飞过去；放大后会自动展开更多。 |
| 城市名太密/看不到某个城市 | 名称按层级显示：< 5.0 只显示省份，5.0–6.4 显示省会，6.4 以上显示全部地级市。右上角图钉按钮可统一开关名称；重叠标签会自动收起或上下错开。 |
| 城市数字（聚合）不出现 | 只有同一城市 **2 面以上**旗帜才会显示；城市名开关关闭时不聚合；标签/搜索筛选后如果只剩 1 面也会恢复单旗。 |
| 连续放置停不下来 | 按 Esc，或点顶部放置提示条里的“取消”。 |
| 删除后没看到撤销 | 撤销只在删除后 6 秒内显示；超时后无法在界面恢复。 |
| 放大后没有城市/区县边界 | 城市边界在 zoom ≥ 5.2 才加载，区县边界在 zoom ≥ 6.8 才加载；区县只加载地图中心所在省，切到邻省会再拉。确认 `/crm-map/china-city-boundaries.geojson`、`/crm-map/counties/<省adcode>.geojson` 为 200。 |
| 有边界但没有道路/水系/村镇名 | 自托管行政边界只包含城市/区县轮廓；图 2 的道路、水系、POI、村镇注记需要在线底图或大体量 OSM 数据，不在当前方案内。 |
| 城市为空 | 点击位置离最近城市超过 120km；在详情里编辑城市即可。 |
| 浏览器不支持 | 需要 WebGL；用 Chrome / Edge，并确认硬件加速开启。内嵌浏览器/预览窗可能不支持通知，但地图本身通常可用。 |
| 地图数据合规 | 中国边界来自阿里云 DataV，仅内部展示使用；页面未做公开发布。 |

## 7. 备份与恢复

- 每天 02:00 自动备份（见 `scripts/backup.sh`）。
- 建对象前手动备份：
  `/opt/twenty/backups/manual-20261108-before-dealer-flag.sql.gz`（已 `gzip -t` 校验）
- 对象元数据在 `core` schema，旗帜记录在 `workspace_f1qkwobjtzhjvn7qm63b53cu8."_dealerFlag"`。
- 从旧备份恢复会丢对象和旗帜；恢复后重跑 `scripts/setup-dealer-map.js`，再重新放旗。
- 当前可见旗帜 0 条；数据库里可能保留少量**软删除**记录（不在地图/列表中显示，不影响使用）。需要彻底清理时用 `destroyDealerFlag(id: UUID!)`。

## 8. 已知边界

- 旗帜是共享数据，多人同时改同一条是“后写覆盖”；当前只有少数管理员，先接受。
- 所有 Admin 都能改/删旗帜；没有按人锁定。
- 3D 省份高度是“该省旗帜数”的视觉聚合，不是客户数据。
- 同城多面旗帜会聚合为城市数字；缩放到城市级后如果两面旗帜坐标仍然非常接近，屏幕碰撞仍可能只显示其中一面，左侧列表是完整清单（聚合数字点进去会自动筛选该城市）。
- 删除撤销窗口是 6 秒；超过后记录仍是软删除状态，不会再出现在界面，也不会自动清理。
- 自托管边界只做到**城市/区县行政轮廓**：没有道路、水系、POI、村镇注记；区县边界按地图中心省份懒加载，同一视野跨省时边缘省份可能暂时没有区县线；东莞、中山、嘉峪关等无下级区县的城市只有市界。
- 区县名称在 zoom ≥ 7.2 才显示，只显示当前已加载省份的区县；最多同时显示约 55 个，过密会自动收起或上下错开。自治县/旗的名称会去掉民族后缀，例如“融水苗族自治县”显示为“融水”。
- 右上角图钉按钮同时开关**省份名 + 城市名 + 同城数字 + 区县名**；行政边界线不受该开关影响。名称层级：< 5.0 省份、5.0–6.4 省会、≥ 6.4 全部地级市、≥ 7.2 区县。
- 区县边界数据合计约 16 MB，城市边界约 2.4 MB；都是静态文件，按需加载，不请求外部瓦片。
- MapLibre 版本升级时，更新 `build-map-assets.js` 里的版本号，重新生成并同步 nginx 的版本化文件名/location。
- Twenty 升级/改布局后，侧栏入口可能失效；已有 10 秒自检 + 悬浮兜底。
