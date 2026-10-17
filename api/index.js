const kv = await Deno.openKv();

// ===== 管理员密码 =====
const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD');
if (!ADMIN_PASSWORD) throw new Error('ADMIN_PASSWORD is not set');

const cors = {
  'Access-Control-Allow-Origin': 'https://bozi0.github.io',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Pwd',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

// ===== 防刷单系统（带原子性 CAS 机制） =====
async function checkRateLimit(ip, action, limit, windowSec) {
  const key = ['ratelimit', action, ip, Math.floor(Date.now() / (windowSec * 1000))];
  for (let i = 0; i < 5; i++) {
    const entry = await kv.get(key);
    const count = entry.value || 0;
    if (count >= limit) return false;
    const res = await kv.atomic()
      .check({ key, versionstamp: entry.versionstamp })
      .set(key, count + 1, { expireIn: windowSec * 1000 })
      .commit();
    if (res.ok) return true;
  }
  return false;
}

/* ========== 订单号生成系统 ========== */
const _BOOT_ = ['Zm9', 'Kq7', 'X'];
const _BOOT_KEY = _BOOT_.join('');
const _BOOT_KEY_REV = _BOOT_.slice().reverse().join('');
const MIX_CHARS = 'XZQWMKPRYHNTVS';

const DEVICE_CODES = {
  'Bozi Neo8':'N08','Bozi Neo7':'N07','Bozi Neo6':'N06',
  'Bozi Pad 2':'P02','Bozi Pad 1':'P01','Bozi Book 1':'B01',
  'Bozi Buds 1':'D01','Bozi Watch 1':'W01','Bozi TV 1':'TV1'
};
const VERSION_CODES = {
  '8GB + 128GB':'0812','8GB + 256GB':'0825','12GB + 256GB':'1225','12GB + 512GB':'1251',
  '16GB + 256GB':'1625','16GB + 512GB':'1651','16GB + 1TB':'161T','32GB + 1TB':'321T',
  '标准版':'0000','65英寸':'65IN','75英寸':'75IN','85英寸':'85IN'
};
const COLOR_CODES = {
  '破晓金':'GLD','雾海蓝':'BLU','钛空灰':'GRY','墨玉黑':'BLK','星云灰':'NEB','苍岭绿':'GRN',
  '曜夜黑':'BLK','流光银':'SLV','晴空蓝':'SKY','陨石灰':'MET','薄荷绿':'MNT','霞光紫':'PUR',
  '星辰白':'WHT','午夜灰':'MID','皓月白':'MWH','天青蓝':'AZR','玄铁灰':'IRN','月岩银':'MRS',
  '幻夜黑':'NBL','云水白':'CWD','极光紫':'AUR','松霜绿':'PGR','月光银':'MSV','晨雾金':'MGD','星霜灰':'FST'
};

function mixOne(){
  const arr = new Uint8Array(1);
  crypto.getRandomValues(arr);
  return MIX_CHARS[arr[0] % MIX_CHARS.length];
}

function calcChecksum(str){
  let s = 0;
  const mix = _BOOT_KEY + str + _BOOT_KEY_REV;
  for(let i=0;i<mix.length;i++){
    s = (s * 31 + mix.charCodeAt(i)) % 1296;
  }
  const c1 = String.fromCharCode(65 + (s % 26));
  const c2 = String.fromCharCode(65 + Math.floor(s / 26) % 26);
  return c1 + c2;
}

function getVersionCode(v){
  if(!v) return '0000';
  v = v.replace(/\s/g,'');
  if(VERSION_CODES[v]) return VERSION_CODES[v];
  const m = v.match(/^(\d+)GB\+(\d+)(GB|TB)$/);
  if(m){
    const mem = String(m[1]).padStart(2,'0');
    const sto = m[3]==='TB' ? 'T' + m[2] : String(m[2]).slice(0,2);
    return mem + sto;
  }
  return '0000';
}

function generateOrderNo(deviceName, versionStr, colorName){
  // 使用 Intl 彻底解耦服务器时区依赖
  const parts = new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', 
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' 
  }).formatToParts(new Date());
  const get = (type) => parts.find(p => p.type === type).value;
  
  const pad = n => String(n).padStart(2,'0');
  const dCode = DEVICE_CODES[deviceName] || 'X00';
  const vCode = getVersionCode(versionStr);
  const cCode = COLOR_CODES[colorName] || 'CLR';
  
  const dateStr = get('year').slice(-2) + get('month') + get('day');
  const timeStr = get('hour') + get('minute') + get('second');
  
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randArr = new Uint8Array(8);
  crypto.getRandomValues(randArr);
  let rand8 = '';
  for(let i=0;i<8;i++) rand8 += chars[randArr[i] % chars.length];
  
  const core = dCode + vCode + cCode + dateStr + timeStr + rand8;
  const checksum = calcChecksum(core);

  const arr = new Array(43);
  arr[0] = 'B';
  const data = [
    { pos: [3, 12, 24], perm: [2, 1, 0], str: dCode },
    { pos: [5, 14, 26, 35], perm: [1, 3, 0, 2], str: vCode },
    { pos: [7, 16, 28], perm: [1, 2, 0], str: cCode },
    { pos: [9, 18, 30, 37, 39, 41], perm: [3, 0, 5, 1, 4, 2], str: dateStr },
    { pos: [10, 19, 31, 38, 40, 42], perm: [5, 2, 0, 4, 1, 3], str: timeStr },
    { pos: [2, 13, 21, 25, 29, 33, 34, 36], perm: [7, 0, 6, 1, 5, 2, 4, 3], str: rand8 },
    { pos: [4, 22], perm: [0, 1], str: checksum }
  ];
  for(let i=0;i<data.length;i++){
    const d = data[i];
    for(let j=0;j<d.pos.length;j++){
      arr[d.pos[j]] = d.str[d.perm[j]];
    }
  }
  for(let k=1;k<=42;k++){
    if(!arr[k]) arr[k] = mixOne();
  }
  return arr.join('');
}

// 获取真实的 IP
function getIp(conn) {
  return (conn && conn.remoteAddr && conn.remoteAddr.hostname) ? conn.remoteAddr.hostname : 'unknown';
}

Deno.serve(async (req, conn) => {
  const url = new URL(req.url);
  const ip = getIp(conn);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  // ===== 健康检查 =====
  if (url.pathname === '/' && req.method === 'GET') {
    const allowed = await checkRateLimit(ip, 'root', 30, 60);
    if (!allowed) return json({ ok: false, error: 'too many requests' }, 429);
    return new Response('Bozi API is running. 🚀', { headers: cors });
  }

  // ===== 获取公告 =====
  if (url.pathname === '/announcement' && req.method === 'GET') {
    const allowed = await checkRateLimit(ip, 'ann', 60, 60);
    if (!allowed) return json({ ok: false, error: 'too many requests' }, 429);
    try {
      const entry = await kv.get(['announcement', 'current']);
      if (entry.value && entry.value.active) {
        return json({ ok: true, data: entry.value });
      }
      return json({ ok: true, data: null });
    } catch (e) {
      return json({ ok: false, error: 'server' }, 500);
    }
  }

  // ===== 验证订单（带长度限制与限流） =====
  if (url.pathname === '/verify' && req.method === 'POST') {
    const allowed = await checkRateLimit(ip, 'verify', 60, 60);
    if (!allowed) return json({ ok: false, error: 'too many requests' }, 429);
    try {
      const body = await req.json();
      const orderNo = body.orderNo;
      if (!orderNo || typeof orderNo !== 'string' || orderNo.length > 128) {
        return json({ ok: false, error: 'invalid' }, 400);
      }
      const entry = await kv.get(['orders', orderNo]);
      if (entry.value) return json({ ok: true, registered: true });
      return json({ ok: true, registered: false });
    } catch (e) {
      return json({ ok: false, error: 'server' }, 500);
    }
  }

  // ===== 生成订单号（限流放宽到 20，防 NAT 误伤） =====
  if (url.pathname === '/generate-order' && req.method === 'POST') {
    const allowed = await checkRateLimit(ip, 'order', 20, 60);
    if (!allowed) return json({ ok: false, error: 'too many requests' }, 429);
    try {
      const body = await req.json();
      const { device, version, color, hp } = body;
      
      if (hp) return json({ ok: false, error: 'bot detected' }, 403);
      if (!device || !version || !color) return json({ ok: false, error: 'missing fields' }, 400);
      if (!DEVICE_CODES[device] || !VERSION_CODES[version] || !COLOR_CODES[color]) {
        return json({ ok: false, error: 'invalid params' }, 400);
      }

      const orderNo = generateOrderNo(device, version, color);

      // 订单落库 + 销量原子自增
      await kv.set(['orders', orderNo], { ts: Date.now(), device, version, color });
      await kv.atomic().mutate({ key: ['sold', device], type: 'sum', value: new Deno.KvU64(1n) }).commit();

      return json({ ok: true, orderNo });
    } catch (e) {
      return json({ ok: false, error: 'server' }, 500);
    }
  }

  // ===== 记录访问 =====
  if (url.pathname === '/track/visit' && req.method === 'POST') {
    const allowed = await checkRateLimit(ip, 'visit', 30, 60);
    if (!allowed) return json({ ok: false, error: 'too many requests' }, 429);
    try {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
      const today = parts.find(p => p.type === 'year').value + '-' + parts.find(p => p.type === 'month').value + '-' + parts.find(p => p.type === 'day').value;
      
      await kv.atomic().mutate({ key: ['visits', today], type: 'sum', value: new Deno.KvU64(1n) }).commit();
      await kv.atomic().mutate({ key: ['visits', 'total'], type: 'sum', value: new Deno.KvU64(1n) }).commit();
      
      return json({ ok: true });
    } catch (e) {
      return json({ ok: false, error: 'server' }, 500);
    }
  }

  // ===== 管理接口 =====
  if (url.pathname.startsWith('/admin/')) {
    // 1. 统一限流，防爆破
    const allowed = await checkRateLimit(ip, 'admin', 10, 60);
    if (!allowed) return json({ ok: false, error: 'not found' }, 404);

    let body = {};
    if (req.method === 'POST') {
      try { body = await req.json(); } catch (e) {}
    }

    const password = req.headers.get('x-admin-pwd') || body.pwd;
    const validAdminRoutes = ['/admin/stats', '/admin/orders', '/admin/publish', '/admin/close-announcement', '/admin/delete-order', '/admin/delete-all-orders'];

    // 2. 统一返回 404，彻底隐藏接口是否存在
    if (!validAdminRoutes.includes(url.pathname) || password !== ADMIN_PASSWORD) {
      return json({ ok: false, error: 'not found' }, 404);
    }

    if (url.pathname === '/admin/stats' && req.method === 'GET') {
      try {
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
        const today = parts.find(p => p.type === 'year').value + '-' + parts.find(p => p.type === 'month').value + '-' + parts.find(p => p.type === 'day').value;

        const visitsToday = ((await kv.get(['visits', today])).value || 0n).toString();
        const visitsTotal = ((await kv.get(['visits', 'total'])).value || 0n).toString();

        const sold = {};
        const devices = ['Bozi Neo8','Bozi Neo7','Bozi Neo6','Bozi Pad 2','Bozi Pad 1','Bozi Book 1','Bozi Buds 1','Bozi Watch 1','Bozi TV 1'];
        for (const d of devices) {
          sold[d] = ((await kv.get(['sold', d])).value || 0n).toString();
        }

        let orderCount = 0;
        const iter = kv.list({ prefix: ['orders'] });
        for await (const _ of iter) orderCount++;

        const annEntry = await kv.get(['announcement', 'current']);
        const announcement = (annEntry.value && annEntry.value.active) ? annEntry.value : null;

        return json({ ok: true, visitsToday, visitsTotal, orderCount, sold, announcement });
      } catch (e) { return json({ ok: false, error: 'server' }, 500); }
    }

    if (url.pathname === '/admin/orders' && req.method === 'GET') {
      try {
        const orders = [];
        const iter = kv.list({ prefix: ['orders'] });
        for await (const entry of iter) {
          orders.push({ no: entry.key[1], ...entry.value });
        }
        orders.sort(function(a, b){ return (b.ts || 0) - (a.ts || 0); });
        return json({ ok: true, orders: orders.slice(0, 500) });
      } catch (e) { return json({ ok: false, error: 'server' }, 500); }
    }

    if (url.pathname === '/admin/publish' && req.method === 'POST') {
      try {
        const { title, desc, link } = body;
        if (!title) return json({ ok: false, error: 'title required' }, 400);
        const announcement = { id: Date.now().toString(), title, desc: desc || '', link: link || '', active: true, ts: Date.now() };
        await kv.set(['announcement', 'current'], announcement);
        return json({ ok: true, data: announcement });
      } catch (e) { return json({ ok: false, error: 'server' }, 500); }
    }

    if (url.pathname === '/admin/close-announcement' && req.method === 'POST') {
      try {
        const entry = await kv.get(['announcement', 'current']);
        if (entry.value) {
          entry.value.active = false;
          await kv.set(['announcement', 'current'], entry.value);
        }
        return json({ ok: true });
      } catch (e) { return json({ ok: false, error: 'server' }, 500); }
    }

    if (url.pathname === '/admin/delete-order' && req.method === 'POST') {
      try {
        const { orderNo } = body;
        if (!orderNo) return json({ ok: false, error: 'missing orderNo' }, 400);
        const entry = await kv.get(['orders', orderNo]);
        if (!entry.value) return json({ ok: false, error: 'not found' }, 404);
        const device = entry.value.device;
        await kv.delete(['orders', orderNo]);
        if (device) {
          await kv.atomic().mutate({ key: ['sold', device], type: 'sum', value: new Deno.KvU64(-1n) }).commit();
        }
        return json({ ok: true });
      } catch (e) { return json({ ok: false, error: 'server' }, 500); }
    }

    if (url.pathname === '/admin/delete-all-orders' && req.method === 'POST') {
      try {
        let count = 0;
        const cutoff = Date.now(); // 防并发误删新单
        const iter = kv.list({ prefix: ['orders'] });
        for await (const entry of iter) {
          if (entry.value.ts < cutoff) {
            await kv.delete(entry.key);
            count++;
          }
        }
        const devices = ['Bozi Neo8','Bozi Neo7','Bozi Neo6','Bozi Pad 2','Bozi Pad 1','Bozi Book 1','Bozi Buds 1','Bozi Watch 1','Bozi TV 1'];
        for (const d of devices) {
          await kv.delete(['sold', d]);
        }
        return json({ ok: true, deleted: count });
      } catch (e) { return json({ ok: false, error: 'server' }, 500); }
    }
  }

  return new Response('Not found', { status: 404, headers: cors });
});
