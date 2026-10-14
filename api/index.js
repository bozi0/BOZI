const kv = await Deno.openKv();

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  if (url.pathname === '/register' && req.method === 'POST') {
    try {
      const { orderNo, device, version, color } = await req.json();
      if (!orderNo || typeof orderNo !== 'string' || orderNo.length !== 43) {
        return Response.json({ ok: false, error: 'invalid' }, { status: 400, headers: cors });
      }
      await kv.set(['orders', orderNo], {
        ts: Date.now(),
        device: device || '',
        version: version || '',
        color: color || '',
      });
      return Response.json({ ok: true }, { headers: cors });
    } catch (e) {
      return Response.json({ ok: false, error: 'server' }, { status: 500, headers: cors });
    }
  }

  if (url.pathname === '/verify' && req.method === 'POST') {
    try {
      const { orderNo } = await req.json();
      if (!orderNo || typeof orderNo !== 'string') {
        return Response.json({ ok: false, error: 'invalid' }, { status: 400, headers: cors });
      }
      const entry = await kv.get(['orders', orderNo]);
      if (entry.value) {
        return Response.json({ ok: true, registered: true, data: entry.value }, { headers: cors });
      }
      return Response.json({ ok: true, registered: false }, { headers: cors });
    } catch (e) {
      return Response.json({ ok: false, error: 'server' }, { status: 500, headers: cors });
    }
  }

  return new Response('Bozi API is running. 🚀', { headers: cors });
});
