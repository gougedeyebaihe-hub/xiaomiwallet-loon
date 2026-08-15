// xiaomiwallet_status.js — 查看当前配置的账号状态（Loon generic 手动触发）
// 输出到 Loon 日志（console.log），不弹通知——避免通知字数限制导致显示不全

function splitList(s) {
  return String(s || '')
    .split('|')
    .map(function (x) {
      return x.trim();
    })
    .filter(Boolean);
}

(function () {
  const arg = $argument || {};
  const tokens = splitList(arg.pass_token);
  const userIds = splitList(arg.user_id);
  const watchMode = arg.watch_mode === 'manual' ? 'manual（手动确认）' : 'auto（自动）';
  const requestNode = String(arg.node || '').trim() || 'DIRECT';

  const line = '=========================';
  let msg;
  if (!tokens.length || !userIds.length) {
    msg = '当前未配置账号。\n请在插件参数中填写 pass_token 和 user_id（多账号用 | 分隔）。';
  } else if (tokens.length !== userIds.length) {
    msg =
      '配置错误：pass_token 与 user_id 数量不一致（' +
      tokens.length +
      ' 个 token，' +
      userIds.length +
      ' 个 ID）。\n请检查参数，两组需一一对应。';
  } else {
    msg = '当前已接入 ' + tokens.length + ' 个账号：\n';
    userIds.forEach(function (u, i) {
      msg += (i + 1) + '. 账号' + (i + 1) + '（ID ' + u + '）\n';
    });
    msg += '观看模式：' + watchMode + '\n';
  }
  msg += '请求策略：' + requestNode;

  console.log('[小米钱包] 账号状态查询\n' + line + '\n' + msg + '\n' + line);
  $done();
})();
