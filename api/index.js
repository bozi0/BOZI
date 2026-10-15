const kv = await Deno.openKv();

// ====== 管理员密码（你自己改） ======
const ADMIN_PASSWORD = 'bozi20111114';
const INTERNAL_KEY = Deno.env.get('INTERNAL_KEY') || 'bozi-fallback-key-2026';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
 'Access-Control-Allow-Headers': 'Content-Type, X-Bozi-Key',
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

  // ===== 注册订单 =====
    if (url.pathname === '/register' && req.method === 'POST') {
    try {
      const internalKey = req.headers.get('x-bozi-key');
      if (internalKey !== INTERNAL_KEY) {
        return json({ ok: false, error: 'forbidden' }, 403);
      }
      const { orderNo, device, version, color } = await req.json();
      if (!orderNo || typeof orderNo !== 'string' || orderNo.length !== 43) {
        return json({ ok: false, error: 'invalid' }, 400);
      }
      await kv.set(['orders', orderNo], {
        ts: Date.now(),
        device: device || '',
        version: version || '',
        color: color || '',
      });
      // 销量 +1
      if (device) {
        const soldKey = ['sold', device];
        const entry = await kv.get(soldKey);
        await kv.set(soldKey, (entry.value || 0) + 1);
      }
      return json({ ok: true });
    } catch (e) {
      return json({ ok: false, error: 'server' }, 500);
    }
  }

  // ===== 验证订单 =====
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
    const password = url.searchParams.get('pwd') || body.pwd;
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
        const iter = kv.list({ prefix: ['orders'] }, { reverse: true });
        for await (const entry of iter) {
          orders.push({ no: entry.key[1], ...entry.value });
          if (orders.length >= 500) break;
        }
        return json({ ok: true, orders });
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
