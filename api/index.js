const kv = await Deno.openKv();

// ====== 管理员密码（你自己改） ======
const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD') || 'fallback-change-me';
const INTERNAL_KEY = Deno.env.get('INTERNAL_KEY') || 'bozi-fallback-key-2026';
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
  '8GB + 128GB':'0812','8GB + 256GB':'0825',
  '12GB + 256GB':'1225','12GB + 512GB':'1251',
  '16GB + 256GB':'1625','16GB + 512GB':'1651',
  '16GB + 1TB':'161T','32GB + 1TB':'321T',
  '标准版':'0000',
  '65英寸':'65IN','75英寸':'75IN','85英寸':'85IN'
};
const COLOR_CODES = {
  '破晓金':'GLD','雾海蓝':'BLU','钛空灰':'GRY',
  '墨玉黑':'BLK','星云灰':'NEB','苍岭绿':'GRN',
  '曜夜黑':'BLK','流光银':'SLV','晴空蓝':'SKY',
  '陨石灰':'MET','薄荷绿':'MNT','霞光紫':'PUR','星辰白':'WHT',
  '午夜灰':'MID','皓月白':'MWH','天青蓝':'AZR',
  '玄铁灰':'IRN','月岩银':'MRS',
  '幻夜黑':'NBL','云水白':'CWD','极光紫':'AUR','松霜绿':'PGR',
  '月光银':'MSV','晨雾金':'MGD',
  '星霜灰':'FST'
};

function mixOne(){
  return MIX_CHARS[Math.floor(Math.random()*MIX_CHARS.length)];
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
  const pad = n => String(n).padStart(2,'0');
  const now = new Date();
  const dCode = DEVICE_CODES[deviceName] || 'X00';
  const vCode = getVersionCode(versionStr);
  const cCode = COLOR_CODES[colorName] || 'CLR';
  const dateStr = String(now.getFullYear()).slice(-2) + pad(now.getMonth()+1) + pad(now.getDate());
  const timeStr = pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
  const rand4 = String(Math.floor(Math.random()*10000)).padStart(4,'0');
  const core = dCode + vCode + cCode + dateStr + timeStr + rand4;
  const checksum = calcChecksum(core);

  const arr = new Array(43);
  arr[0] = 'B';
  const data = [
    { pos: [3, 12, 24], perm: [2, 1, 0], str: dCode },
    { pos: [5, 14, 26, 35], perm: [1, 3, 0, 2], str: vCode },
    { pos: [7, 16, 28], perm: [1, 2, 0], str: cCode },
    { pos: [9, 18, 30, 37, 39, 41], perm: [3, 0, 5, 1, 4, 2], str: dateStr },
    { pos: [10, 19, 31, 38, 40, 42], perm: [5, 2, 0, 4, 1, 3], str: timeStr },
    { pos: [11, 20, 32, 36], perm: [2, 0, 3, 1], str: rand4 },
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
/* ========== 订单号生成系统结束 ========== */
/* ========== 防刷单 ========== */
async function checkRateLimit(ip, action, limit, windowSec) {
  const now = Date.now();
  const windowKey = Math.floor(now / (windowSec * 1000));
  const key = ['ratelimit', action, ip, windowKey];
  const entry = await kv.get(key);
  const count = entry.value || 0;
  if (count >= limit) return false;
  await kv.set(key, count + 1, { expireIn: windowSec * 1000 });
  return true;
}
/* ========== 防刷单结束 ========== */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
 'Access-Control-Allow-Headers': 'Content-Type, X-Bozi-Key, X-Admin-Pwd',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  // ===== 健康检查 =====
  if (url.pathname === '/' && req.method === 'GET') {
    return new Response('Bozi API is running. 🚀', { headers: cors });
  }

 

  // ===== 验证订单 =====
    // ===== 生成订单号（由服务端签发） =====
   if (url.pathname === '/generate-order' && req.method === 'POST') {
    try {
            const xff = req.headers.get('x-forwarded-for') || '';
      const parts = xff.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
      const ip = parts.length > 0 ? parts[parts.length - 1] : 'unknown';

      const allowed = await checkRateLimit(ip, 'order', 5, 60);
      if (!allowed) {
        return json({ ok: false, error: 'too many requests' }, 429);
      }

      const { device, version, color, hp } = await req.json();

      if (hp) {
        return json({ ok: false, error: 'bot detected' }, 403);
      }
      if (!device || !version || !color) {
        return json({ ok: false, error: 'missing fields' }, 400);
      }
      if (!DEVICE_CODES[device]) {
        return json({ ok: false, error: 'unknown device' }, 400);
      }
      const orderNo = generateOrderNo(device, version, color);

      await kv.set(['orders', orderNo], {
        ts: Date.now(),
        device: device,
        version: version,
        color: color,
      });
      const soldKey = ['sold', device];
      const entry = await kv.get(soldKey);
      await kv.set(soldKey, (entry.value || 0) + 1);

      return json({ ok: true, orderNo: orderNo });
    } catch (e) {
      return json({ ok: false, error: 'server' }, 500);
    }
  }

  if (url.pathname === '/verify' && req.method === 'POST') {
    try {
      const { orderNo } = await req.json();
      if (!orderNo || typeof orderNo !== 'string') {
        return json({ ok: false, error: 'invalid' }, 400);
      }
      const entry = await kv.get(['orders', orderNo]);
      if (entry.value) {
        return json({ ok: true, registered: true, data: entry.value });
      }
      return json({ ok: true, registered: false });
    } catch (e) {
      return json({ ok: false, error: 'server' }, 500);
    }
  }

  // ===== 记录访问 =====
  if (url.pathname === '/track/visit' && req.method === 'POST') {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const visitKey = ['visits', today];
      const entry = await kv.get(visitKey);
      await kv.set(visitKey, (entry.value || 0) + 1);

      const totalKey = ['visits', 'total'];
      const totalEntry = await kv.get(totalKey);
      await kv.set(totalKey, (totalEntry.value || 0) + 1);

      return json({ ok: true });
    } catch (e) {
      return json({ ok: false, error: 'server' }, 500);
    }
  }

  // ===== 获取公告（公开） =====
  if (url.pathname === '/announcement' && req.method === 'GET') {
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

  // ===== 管理接口（需密码） =====
  if (url.pathname.startsWith('/admin/')) {
    let body = {};
    if (req.method === 'POST') {
      try { body = await req.json(); } catch (e) {}
    }
       const password = req.headers.get('x-admin-pwd') || body.pwd;
    if (password !== ADMIN_PASSWORD) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }

    // 获取统计
    if (url.pathname === '/admin/stats' && req.method === 'GET') {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const visitsToday = (await kv.get(['visits', today])).value || 0;
        const visitsTotal = (await kv.get(['visits', 'total'])).value || 0;

        const sold = {};
        const devices = ['Bozi Neo8','Bozi Neo7','Bozi Neo6','Bozi Pad 2','Bozi Pad 1','Bozi Book 1','Bozi Buds 1','Bozi Watch 1','Bozi TV 1'];
        for (const d of devices) {
          sold[d] = (await kv.get(['sold', d])).value || 0;
        }

        let orderCount = 0;
        const iter = kv.list({ prefix: ['orders'] });
        for await (const _ of iter) orderCount++;

                const annEntry = await kv.get(['announcement', 'current']);
        const announcement = (annEntry.value && annEntry.value.active) ? annEntry.value : null;

        return json({ ok: true, visitsToday, visitsTotal, orderCount, sold, announcement });
      } catch (e) {
        return json({ ok: false, error: 'server' }, 500);
      }
    }

    // 获取所有订单
        if (url.pathname === '/admin/orders' && req.method === 'GET') {
      try {
        const orders = [];
        const iter = kv.list({ prefix: ['orders'] });
        for await (const entry of iter) {
          orders.push({ no: entry.key[1], ...entry.value });
        }
        orders.sort(function(a, b){ return (b.ts || 0) - (a.ts || 0); });
        return json({ ok: true, orders: orders.slice(0, 500) });
      } catch (e) {
        return json({ ok: false, error: 'server' }, 500);
      }
    }

    // 发布公告
    if (url.pathname === '/admin/publish' && req.method === 'POST') {
      try {
        const { title, desc, link } = body;
        if (!title) return json({ ok: false, error: 'title required' }, 400);
        const announcement = {
          id: Date.now().toString(),
          title,
          desc: desc || '',
          link: link || '',
          active: true,
          ts: Date.now(),
        };
        await kv.set(['announcement', 'current'], announcement);
        return json({ ok: true, data: announcement });
      } catch (e) {
        return json({ ok: false, error: 'server' }, 500);
      }
    }

    // 关闭公告
        // ===== 删除订单（管理员） =====
    if (url.pathname === '/admin/delete-order' && req.method === 'POST') {
      try {
        const { orderNo } = body;
        if (!orderNo) return json({ ok: false, error: 'missing orderNo' }, 400);
        const entry = await kv.get(['orders', orderNo]);
        if (!entry.value) return json({ ok: false, error: 'not found' }, 404);
        const device = entry.value.device;
        await kv.delete(['orders', orderNo]);
        if (device) {
          const soldKey = ['sold', device];
          const se = await kv.get(soldKey);
          const newVal = Math.max(0, (se.value || 0) - 1);
          await kv.set(soldKey, newVal);
        }
        return json({ ok: true });
      } catch (e) {
        return json({ ok: false, error: 'server' }, 500);
      }
    }

    if (url.pathname === '/admin/close-announcement' && req.method === 'POST') {
      try {
        const entry = await kv.get(['announcement', 'current']);
        if (entry.value) {
          entry.value.active = false;
          await kv.set(['announcement', 'current'], entry.value);
        }
        return json({ ok: true });
      } catch (e) {
        return json({ ok: false, error: 'server' }, 500);
      }
    }
  }

  return new Response('Not found', { status: 404, headers: cors });
});
