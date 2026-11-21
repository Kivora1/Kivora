// Cloudflare Pages Function : /api/vote (avis sur la demi-tasse)
// Nécessite un espace KV lié au projet sous le nom VOTES. Sans lui, le site fonctionne mais ne compte rien.
const K = { up: 'demi-tasse:up', down: 'demi-tasse:down' };
const json = (o) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const read = async (kv) => ({ ok: true, up: +(await kv.get(K.up)) || 0, down: +(await kv.get(K.down)) || 0 });
export async function onRequestGet({ env }) { return env.VOTES ? json(await read(env.VOTES)) : json({ ok: false }); }
export async function onRequestPost({ request, env }) {
  if (!env.VOTES) return json({ ok: false });
  try {
    const { vote, prev } = await request.json();
    const ok = (v) => v === 'up' || v === 'down';
    const d = { up: 0, down: 0 };
    if (ok(prev)) d[prev]--;
    if (ok(vote)) d[vote]++;
    const cur = await read(env.VOTES);
    await env.VOTES.put(K.up, String(Math.max(0, cur.up + d.up)));
    await env.VOTES.put(K.down, String(Math.max(0, cur.down + d.down)));
    return json(await read(env.VOTES));
  } catch (e) { return json({ ok: false }); }
}
