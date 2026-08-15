// xiaomiwallet.js — 小米钱包"看视频得会员"每日任务（Loon 移植版）
// Build: 2026-08-15
// 版本 1.4.2：插件不支持 [Proxy Group]（官方示例确认），PROXY 策略组需在主配置定义（策略由 Loon 自身 UI 控制：长按节点/策略组触发 generic 时自动跟随）
// 移植自 https://github.com/gougedeyebaihe-hub/xiaomiwallet-auto（main.py）
// 触发方式：cron（自动）/ generic（手动：manual 模式提交，或立即执行一次）
// 注意：请求默认 DIRECT 直连（原项目明确警告服务器/机房 IP 会被风控）

// ==================== 常量（照抄 main.py） ====================

const API_HOST = 'm.jr.airstarfinance.net';
const ACTIVITY_CODE = '2211-videoWelfare';
const JRAIRSTAR_PH = '98lj8puDf9Tu/WwcyMpVyQ==';
const USER_EXTRA =
  '{"platformType":1,"com.miui.player":"4.27.0.4","com.miui.video":"v2024090290(MiVideo-UN)","com.mipay.wallet":"6.83.0.5175.2256"}';
const UA_MOBILE =
  'Mozilla/5.0 (Linux; U; Android 14; zh-CN; M2012K11AC Build/UKQ1.230804.001; ' +
  'AppBundle/com.mipay.wallet; AppVersionName/6.89.1.5275.2323; AppVersionCode/20577595; ' +
  'MiuiVersion/stable-V816.0.13.0.UMNCNXM; DeviceId/alioth; NetworkType/WIFI; ' +
  'mix_version; WebViewVersion/118.0.0.0) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Version/4.0 Mobile Safari/5.36 XiaoMi/MiuiBrowser/4.3';
const UA_DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0';
const LOGIN_URL =
  'https://account.xiaomi.com/pass/serviceLogin?callback=https%3A%2F%2Fapi.jr.airstarfinance.net%2Fsts' +
  '%3Fsign%3D1dbHuyAmee0NAZ2xsRw5vhdVQQ8%253D%26followup%3Dhttps%253A%252F%252Fm.jr.airstarfinance.net' +
  '%252Fmp%252Fapi%252Flogin%253Ffrom%253Dmipay_indexicon_TVcard%2526deepLinkEnable%253Dfalse' +
  '%2526requestUrl%253Dhttps%25253A%25252F%25252Fm.jr.airstarfinance.net%25252Fmp%25252Factivity' +
  '%25252FvideoActivity%25253Ffrom%25253Dmipay_indexicon_TVcard%252526_noDarkMode%25253Dtrue' +
  '%252526_transparentNaviBar%25253Dtrue%252526cUserId%25253Dusyxgr5xjumiQLUoAKTOgvi858Q' +
  '%252526_statusBarHeight%25253D137&sid=jrairstar&_group=DEFAULT&_snsNone=true&_loginType=ticket';

const PENDING_KEY = 'xiaomiwallet_pending'; // manual 模式"待提交"状态
const DEV_KEY_PREFIX = 'xiaomiwallet_dev_'; // 每账号固定设备参数
const PENDING_TTL = 12 * 3600 * 1000; // 待提交状态 12 小时内有效

// 请求策略：默认 DIRECT 直连（风控最安全）；从节点/策略组触发 generic 时自动用触发时的策略（官方机制）
let REQUEST_NODE = 'DIRECT';

// ==================== 工具函数 ====================

function log(msg) {
  console.log('[小米钱包] ' + msg);
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function loadJSON(key, def) {
  const raw = $persistentStore.read(key);
  if (!raw) return def;
  const val = parseJson(raw);
  return val === null ? def : val;
}

function saveJSON(key, val) {
  $persistentStore.write(JSON.stringify(val), key);
}

function buildQuery(params) {
  return Object.keys(params)
    .map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    })
    .join('&');
}

function request(method, params) {
  return new Promise(function (resolve) {
    $httpClient[method](params, function (error, response, data) {
      resolve({ error: error, response: response, data: data });
    });
  });
}

// 任务接口请求：移动端 UA + Host + Cookie + 指定节点（默认 DIRECT）
function apiRequest(method, url, params, cookie) {
  const opts = {
    url: url,
    headers: { 'Host': API_HOST, 'User-Agent': UA_MOBILE, 'Cookie': cookie },
    timeout: 15000,
    node: REQUEST_NODE
  };
  if (params) opts.url = url + '?' + buildQuery(params);
  return request(method, opts);
}

// ==================== 设备参数（device.py） ====================

function generateDeviceParams() {
  function hex(n) {
    let s = '';
    for (let i = 0; i < n; i++) s += '0123456789abcdef'[randInt(0, 15)];
    return s;
  }
  function digits(n) {
    let s = '';
    for (let i = 0; i < n; i++) s += String(randInt(0, 9));
    return s;
  }
  function alnum(n) {
    const cs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < n; i++) s += cs[randInt(0, cs.length - 1)];
    return s;
  }
  return {
    oaid: hex(32),
    imei: digits(15),
    device: 'M2012K11AC',
    model: 'M2012K11AC',
    androidId: hex(16),
    regId: alnum(24),
    versionCode: '20577595',
    versionName: '6.89.1.5275.2323',
    sdkVersionCode: '34',
    sdk: 'Android 14',
    release: '14',
    longitude: '116.397458',
    latitude: '39.909187',
    networkType: 'WIFI'
  };
}

// 每账号一套固定设备参数，持久化后复用
function ensureDeviceParams(accountIndex) {
  const key = DEV_KEY_PREFIX + accountIndex;
  const existing = loadJSON(key, null);
  if (existing && existing.oaid && existing.imei && existing.androidId && existing.regId) {
    return existing;
  }
  const params = generateDeviceParams();
  saveJSON(key, params);
  return params;
}

// ==================== 登录换取会话 Cookie ====================

function resolveUrl(base, loc) {
  if (/^https?:\/\//i.test(loc)) return loc;
  if (loc.indexOf('//') === 0) return 'https:' + loc;
  const host = base.match(/^(https?:\/\/[^/]+)/)[1];
  if (loc.indexOf('/') === 0) return host + loc;
  const dir = base.replace(/[^/]*$/, '');
  return dir + loc;
}

// 从响应头提取需要的 Cookie（逐跳累积）
function collectCookies(headers, jar) {
  if (!headers) return;
  let raw = headers['set-cookie'] || headers['Set-Cookie'];
  if (!raw) return;
  const items = Array.isArray(raw) ? raw : [raw];
  const names = ['cUserId', 'serviceToken', 'jrairstar_serviceToken'];
  items.forEach(function (item) {
    names.forEach(function (n) {
      const m = item.match(new RegExp('(?:^|[;,\\s])' + n + '=([^;,]*)'));
      if (m) jar[n] = m[1].trim();
    });
  });
}

function serializeCookies(jar) {
  return Object.keys(jar)
    .map(function (k) {
      return k + '=' + jar[k];
    })
    .join('; ');
}

// passToken/userId -> "cUserId=..; jrairstar_serviceToken=.."
async function getSessionCookies(passToken, userId) {
  const jar = {};
  let url = LOGIN_URL;
  let headers = {
    'User-Agent': UA_DESKTOP,
    'Cookie': 'passToken=' + passToken + '; userId=' + userId + ';'
  };
  for (let i = 0; i < 10; i++) {
    const r = await request('get', {
      url: url,
      headers: headers,
      timeout: 15000,
      node: REQUEST_NODE,
      'auto-redirect': false
    });
    if (r.error) {
      log('登录请求失败: ' + r.error);
      return null;
    }
    collectCookies(r.response.headers, jar);
    const status = r.response.status;
    const location = (r.response.headers || {})['location'] || (r.response.headers || {})['Location'];
    if (status >= 300 && status < 400 && location) {
      url = resolveUrl(url, location);
      const s = serializeCookies(jar);
      if (s) headers['Cookie'] = s;
      continue;
    }
    break;
  }
  const cUserId = jar['cUserId'];
  const serviceToken = jar['serviceToken'] || jar['jrairstar_serviceToken'];
  if (cUserId && serviceToken) {
    return 'cUserId=' + cUserId + '; jrairstar_serviceToken=' + serviceToken;
  }
  log('未获取到完整 Cookie，已拿到: ' + JSON.stringify(Object.keys(jar)));
  return null;
}

// ==================== 业务逻辑（照抄 main.py RNL 类） ====================

function taskBaseParams(deviceParams) {
  const p = {
    activityCode: ACTIVITY_CODE,
    app: 'com.mipay.wallet',
    isNfcPhone: 'true',
    channel: 'mipay_indexicon_TVcard',
    deviceType: '2',
    system: '1',
    visitEnvironment: '2',
    userExtra: USER_EXTRA,
    jrairstar_ph: JRAIRSTAR_PH
  };
  // 设备参数展开（对应原版 _task_base_params 中的 **self.device_params）
  Object.keys(deviceParams || {}).forEach(function (k) {
    p[k] = deviceParams[k];
  });
  return p;
}

function mergeParams(base, extra) {
  const out = {};
  Object.keys(base).forEach(function (k) {
    out[k] = base[k];
  });
  Object.keys(extra || {}).forEach(function (k) {
    out[k] = extra[k];
  });
  return out;
}

// 查询总天数 + 今日记录
async function queryUserInfo(cookie) {
  const base = {
    activityCode: ACTIVITY_CODE,
    app: 'com.mipay.wallet',
    deviceType: '2',
    system: '1',
    visitEnvironment: '2',
    userExtra: USER_EXTRA
  };
  const totalRes = await apiRequest(
    'get',
    'https://' + API_HOST + '/mp/api/generalActivity/queryUserGoldRichSum',
    base,
    cookie
  );
  const totalJson = parseJson(totalRes.data);
  if (totalRes.error || !totalJson || totalJson.code !== 0) {
    return { ok: false, error: '获取兑换视频天数失败' };
  }
  const totalDays = (parseInt(totalJson.value, 10) || 0) / 100;

  const recordRes = await apiRequest(
    'get',
    'https://' + API_HOST + '/mp/api/generalActivity/queryUserJoinList',
    mergeParams(base, { pageNum: '1', pageSize: '20' }),
    cookie
  );
  const recordJson = parseJson(recordRes.data);
  if (recordRes.error || !recordJson || recordJson.code !== 0) {
    return { ok: false, error: '查询任务完成记录失败' };
  }
  const today = new Date();
  const todayStr =
    today.getFullYear() + '-' + pad2(today.getMonth() + 1) + '-' + pad2(today.getDate());
  const todayRecords = [];
  const recordList = (recordJson.value && recordJson.value.data) || [];
  recordList.forEach(function (item) {
    if (String(item.createTime || '').indexOf(todayStr) === 0) {
      todayRecords.push(item);
    }
  });
  return { ok: true, totalDays: totalDays, todayRecords: todayRecords };
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

// 获取任务列表（浏览组浏览任务）
async function getTaskList(cookie) {
  const r = await request('post', {
    url: 'https://' + API_HOST + '/mp/api/generalActivity/getTaskList',
    headers: {
      'Host': API_HOST,
      'User-Agent': UA_MOBILE,
      'Cookie': cookie,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'activityCode=' + ACTIVITY_CODE,
    timeout: 15000,
    node: REQUEST_NODE
  });
  const json = parseJson(r.data);
  if (r.error || !json || json.code !== 0) {
    log('获取任务列表失败: ' + (r.data || '').slice(0, 200));
    return null;
  }
  const list = ((json.value || {}).taskInfoList || []).filter(function (t) {
    return String(t.taskName || '').indexOf('浏览组浏览任务') >= 0;
  });
  return list.length ? list : null;
}

// 任务详情（返回 taskInfo）
async function getTaskInfo(cookie, deviceParams, taskCode) {
  const r = await apiRequest(
    'get',
    'https://' + API_HOST + '/mp/api/generalActivity/getTask',
    mergeParams(taskBaseParams(deviceParams), { taskCode: taskCode }),
    cookie
  );
  const json = parseJson(r.data);
  if (r.error || !json || json.code !== 0) return null;
  return json.value ? json.value.taskInfo : null;
}

// 完成任务，返回 userTaskId
async function completeTask(cookie, deviceParams, task, tId, browseTimeSeconds) {
  const params = mergeParams(taskBaseParams(deviceParams), {
    taskId: task.taskId,
    browsTaskId: tId,
    browsClickUrlId: task.generalActivityUrlInfo.browsClickUrlId,
    clickEntryType: 'undefined',
    festivalStatus: '0',
    completeTime: String(Date.now()),
    browseTime: String(browseTimeSeconds)
  });
  const r = await apiRequest(
    'get',
    'https://' + API_HOST + '/mp/api/generalActivity/completeTask',
    params,
    cookie
  );
  const json = parseJson(r.data);
  if (r.error || !json || json.code !== 0) {
    log('完成任务失败: ' + (r.data || '').slice(0, 200));
    return null;
  }
  return json.value;
}

// 领取奖励
async function receiveAward(cookie, deviceParams, userTaskId) {
  const r = await apiRequest(
    'get',
    'https://' + API_HOST + '/mp/api/generalActivity/luckDraw',
    mergeParams(taskBaseParams(deviceParams), { userTaskId: userTaskId }),
    cookie
  );
  const json = parseJson(r.data);
  if (r.error || !json || json.code !== 0) {
    log('领取奖励失败: ' + (r.data || '').slice(0, 200));
    return false;
  }
  return true;
}

// 组装报告（照抄 main.py generate_notification 格式）
function buildReport(us, userId, info) {
  const today = new Date();
  const todayStr =
    today.getFullYear() + '-' + pad2(today.getMonth() + 1) + '-' + pad2(today.getDate());
  let msg =
    '【小米钱包每日任务报告】\n' +
    '✨ 账号别名：' + us + '\n' +
    '✨ 小米ID：' + userId + '\n' +
    '📊 当前可兑换视频天数：' + info.totalDays.toFixed(2) + '天\n\n' +
    '📅 ' + todayStr + ' 任务记录\n' +
    '-------------------------';
  if (!info.todayRecords.length) {
    msg += '\n  今日暂无新增奖励记录';
  } else {
    info.todayRecords.forEach(function (record) {
      const days = (parseInt(record.value, 10) || 0) / 100;
      msg += '\n| ⏰ ' + (record.createTime || '未知时间') + '\n| 🎁 领到视频会员，+' + days.toFixed(2) + '天';
    });
  }
  if (info.error) msg += '\n\n⚠️ 执行异常：' + info.error;
  msg += '\n=========================';
  return msg;
}

// ==================== manual 模式状态 ====================

function savePending(accountIndex) {
  saveJSON(PENDING_KEY, { time: Date.now(), accountIndex: accountIndex });
}

function clearPending() {
  $persistentStore.write('', PENDING_KEY);
}

function readPending() {
  const p = loadJSON(PENDING_KEY, null);
  if (!p || typeof p.accountIndex !== 'number') return null;
  if (Date.now() - p.time > PENDING_TTL) {
    clearPending();
    return null;
  }
  return p;
}

// ==================== 账号执行 ====================

async function runAccount(us, userId, passToken, accountIndex, watchMode, browseSeconds) {
  const deviceParams = ensureDeviceParams(accountIndex);
  log('开始处理账号 ' + us + ' (ID: ' + userId + ')');

  const cookie = await getSessionCookies(passToken, userId);
  if (!cookie) {
    log('会话 Cookie 获取失败（passToken 可能已失效）');
    return { totalDays: 0, todayRecords: [], error: '获取会话 Cookie 失败，请重新获取 passToken 并更新插件参数' };
  }

  const info = await queryUserInfo(cookie);
  if (!info.ok) {
    log('查询用户信息失败: ' + info.error);
    return { totalDays: 0, todayRecords: [], error: info.error };
  }
  log('当前可兑换视频天数: ' + info.totalDays.toFixed(2) + '天');

  for (let round = 0; round < 2; round++) {
    log('开始第 ' + (round + 1) + ' 轮任务...');
    const tasks = await getTaskList(cookie);
    if (!tasks) {
      log('未找到可执行的任务列表，可能今日任务已完成');
      break;
    }
    const task = tasks[0];
    const tId = task.generalActivityUrlInfo ? task.generalActivityUrlInfo.id : null;
    if (!tId) {
      info.error = '无法获取任务 t_id，中断执行';
      break;
    }

    const taskState = await getTaskInfo(cookie, deviceParams, task.taskCode);
    if (
      taskState &&
      (taskState.periodCompleteCount || 0) >= (taskState.periodCount || 0)
    ) {
      log('浏览组浏览任务今日已完成');
      break;
    }

    if (watchMode === 'manual') {
      // Loon 两段式：先提醒，用户看完后手动触发 generic 提交
      savePending(accountIndex);
      $notification.post(
        '小米钱包每日任务',
        '请打开小米钱包观看视频任务广告',
        '看完后返回 Loon 手动触发一次「小米钱包手动提交」（账号：' + us + '）'
      );
      log('manual 模式：已发提醒并保存待提交状态，等待手动触发');
      info.manualReminder = true;
      return info;
    }

    // auto 模式：等待完整广告时长后提交
    const delay = randInt(Math.max(5, browseSeconds - 10), browseSeconds + 10);
    log('等待 ' + delay + ' 秒（完整广告时长，不跳过）...');
    await sleep(delay * 1000);

    let userTaskId = await completeTask(cookie, deviceParams, task, tId, delay);
    await sleep(randInt(2000, 4000));

    if (!userTaskId) {
      log('完成任务接口返回为空，尝试从获取任务接口重试...');
      await sleep(randInt(2000, 4000));
      const retryInfo = await getTaskInfo(cookie, deviceParams, task.taskCode);
      userTaskId = retryInfo ? retryInfo.userTaskId : null;
    }

    if (userTaskId) {
      await sleep(randInt(2000, 4000));
      const ok = await receiveAward(cookie, deviceParams, userTaskId);
      log(ok ? '奖励领取成功' : '领取奖励时可能出现问题');
    } else {
      log('未能获取 userTaskId，无法领取本轮奖励');
    }

    await sleep(randInt(2000, 4000));
  }

  // 刷新最终数据
  const finalInfo = await queryUserInfo(cookie);
  if (finalInfo.ok) return finalInfo;
  return info;
}

// manual 模式：用户看完后手动触发提交
async function runManualSubmit(accounts, pending, browseSeconds) {
  const acc = accounts[pending.accountIndex];
  if (!acc) {
    clearPending();
    return;
  }
  const deviceParams = ensureDeviceParams(acc.index);
  log('manual 提交：账号 ' + acc.us);

  const cookie = await getSessionCookies(acc.passToken, acc.userId);
  if (!cookie) {
    clearPending();
    $notification.post('小米钱包每日任务', '提交失败', '会话 Cookie 获取失败，passToken 可能已失效，请重新获取');
    return;
  }

  const tasks = await getTaskList(cookie);
  const taskState = tasks ? await getTaskInfo(cookie, deviceParams, tasks[0].taskCode) : null;
  const alreadyDone =
    !tasks || (taskState && (taskState.periodCompleteCount || 0) >= (taskState.periodCount || 0));

  if (alreadyDone) {
    clearPending();
    $notification.post('小米钱包每日任务', acc.us, '今日浏览任务已完成，无需提交');
    return;
  }

  const task = tasks[0];
  const tId = task.generalActivityUrlInfo ? task.generalActivityUrlInfo.id : null;
  if (!tId) {
    clearPending();
    $notification.post('小米钱包每日任务', acc.us, '无法获取任务信息，请稍后重试');
    return;
  }

  // 观看时长按"提醒时刻到提交时刻"估算，与原版 manual 模式一致（max(5, 实际时长)，无上限）
  const watchSeconds = Math.max(5, Math.round((Date.now() - pending.time) / 1000));
  let userTaskId = await completeTask(cookie, deviceParams, task, tId, watchSeconds);
  await sleep(randInt(2000, 4000));

  if (!userTaskId) {
    await sleep(randInt(2000, 4000));
    const retryInfo = await getTaskInfo(cookie, deviceParams, task.taskCode);
    userTaskId = retryInfo ? retryInfo.userTaskId : null;
  }

  let awardOk = false;
  if (userTaskId) {
    await sleep(randInt(2000, 4000));
    awardOk = await receiveAward(cookie, deviceParams, userTaskId);
  }

  // 检查是否还有下一轮（每天 2 次浏览任务）
  const nextState = await getTaskInfo(cookie, deviceParams, task.taskCode);
  const hasNext = nextState && (nextState.periodCompleteCount || 0) < (nextState.periodCount || 0);

  if (hasNext) {
    savePending(acc.index);
    const completedCount = taskState ? taskState.periodCompleteCount || 0 : 0;
    $notification.post(
      '小米钱包每日任务',
      acc.us + ' 第 ' + (completedCount + 1) + ' 轮已提交',
      '还有下一轮浏览任务：请再次观看视频后手动触发提交'
    );
  } else {
    clearPending();
    $notification.post(
      '小米钱包每日任务',
      acc.us,
      (awardOk ? '本轮已提交并领取奖励' : '本轮已提交，但领取奖励可能失败') + '，今日任务完成'
    );
  }
}

// ==================== 主流程 ====================

function getAccounts() {
  const arg = $argument || {};
  const passTokens = String(arg.pass_token || '')
    .split('|')
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
  const userIds = String(arg.user_id || '')
    .split('|')
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
  if (!passTokens.length || !userIds.length || passTokens.length !== userIds.length) {
    return null;
  }
  return passTokens.map(function (pt, i) {
    return { us: '账号' + (i + 1), userId: userIds[i], passToken: pt, index: i };
  });
}

(async function () {
  try {
    const arg = $argument || {};
    // 官方机制：generic 脚本从节点/策略组触发时，$environment.params.node 自动带入策略名
    // （见官方示例 generic_example.js：$environment.params.node -> $httpClient node）
    // cron 自动执行无触发上下文，默认 DIRECT 直连
    let contextNode = null;
    if (
      typeof $environment !== 'undefined' &&
      $environment &&
      $environment.params &&
      $environment.params.node
    ) {
      contextNode = $environment.params.node;
    }
    REQUEST_NODE = contextNode || 'DIRECT';
    log('请求策略: ' + REQUEST_NODE);
    const watchMode = arg.watch_mode === 'manual' ? 'manual' : 'auto';
    const browseSeconds = Math.max(5, Math.min(120, parseInt(arg.browse_seconds, 10) || 30));

    const accounts = getAccounts();
    if (!accounts) {
      $notification.post('小米钱包每日任务', '配置错误', '请在插件参数中填写 passToken 和 userId（数量需一致，多账号用 | 分隔）');
      $done();
      return;
    }

    // manual 模式：有待提交状态则走提交流程
    const pending = readPending();
    if (watchMode === 'manual' && pending) {
      await runManualSubmit(accounts, pending, browseSeconds);
      $done();
      return;
    }

    // 完整流程（auto 模式；manual 模式首次提醒）
    const reports = [];
    let anyReminder = false;
    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      const info = await runAccount(acc.us, acc.userId, acc.passToken, acc.index, watchMode, browseSeconds);
      if (info.manualReminder) {
        // manual 模式一次只提醒一个账号（pending 是全局单值，多账号同时提醒会互相覆盖导致漏任务）
        anyReminder = true;
        break;
      }
      reports.push(buildReport(acc.us, acc.userId, info));
      if (i < accounts.length - 1) await sleep(randInt(0, 15000)); // 随机延迟，避免集中请求
    }
    if (anyReminder) {
      // manual 模式的观看提醒已在 runAccount 中逐账号发送，这里不再重复通知
      $done();
    } else {
      const fullReport = reports.join('\n\n');
      log('执行完成，完整报告：\n' + fullReport); // 通知有字数限制，日志保留完整内容
      $notification.post('小米钱包每日任务', '执行完成（' + accounts.length + ' 个账号）', fullReport);
      $done();
    }
  } catch (e) {
    // 总兜底：任何未捕获异常都保证释放脚本资源并通知
    log('脚本异常: ' + (e && e.message ? e.message : e));
    try {
      $notification.post('小米钱包每日任务', '执行异常', String(e && e.message ? e.message : e));
    } catch (ignore) {}
    $done();
  }
})();
