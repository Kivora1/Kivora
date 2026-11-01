// Cloudflare Pages Function : POST /api/checkout
// Les prix sont relus côté serveur (products.json) : le client ne peut pas les modifier.
const parisDn = () => { const o = {}; new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).forEach(x => { o[x.type] = +x.value; }); return Math.floor(Date.UTC(o.year, o.month - 1, o.day) / 864e5); };
const weekIdx = () => Math.floor((parisDn() + 3) / 7);
const dealOf = (products) => { const ds = products.filter(x => x.deal && x.deal < x.price); return ds.length ? ds[weekIdx() % ds.length] : null; };

// GET /api/checkout : indique au site que ce serveur gère l'offre de la semaine
export async function onRequestGet() { return new Response(JSON.stringify({ deals: 1 }), { headers: { 'Content-Type': 'application/json' } }); }

export async function onRequestPost({ request, env }) {
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
  try {
    if (!env.STRIPE_SECRET_KEY) return json({ error: 'Clé Stripe manquante' }, 500);
    const { items } = await request.json();
    if (!Array.isArray(items) || !items.length) return json({ error: 'Panier vide' }, 400);
    const origin = new URL(request.url).origin;
    const products = await (await fetch(origin + '/products.json')).json();

    const p = new URLSearchParams();
    p.set('mode', 'payment');
    p.set('success_url', origin + '/success.html');
    p.set('cancel_url', origin + '/');
    ['FR', 'BE', 'CH', 'LU', 'DE', 'ES', 'IT'].forEach((c, i) => p.set(`shipping_address_collection[allowed_countries][${i}]`, c));
    p.set('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
    p.set('shipping_options[0][shipping_rate_data][display_name]', 'Livraison standard');
    p.set('shipping_options[0][shipping_rate_data][fixed_amount][amount]', '490');
    p.set('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'eur');

    const deal = dealOf(products);
    items.forEach((it, i) => {
      const prod = products.find(x => x.id === it.id);
      const qty = Number(it.qty);
      if (!prod || !Number.isInteger(qty) || qty < 1 || qty > 10) throw new Error('Article invalide');
      p.set(`line_items[${i}][quantity]`, String(qty));
      p.set(`line_items[${i}][price_data][currency]`, 'eur');
      p.set(`line_items[${i}][price_data][unit_amount]`, String(deal && deal.id === prod.id ? prod.deal : prod.price));
      p.set(`line_items[${i}][price_data][product_data][name]`, prod.name + (deal && deal.id === prod.id ? " – offre de la semaine" : ""));
    });

    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: p
    });
    const d = await r.json();
    if (!r.ok) return json({ error: d.error?.message || 'Erreur Stripe' }, 502);
    return json({ url: d.url });
  } catch (e) {
    return json({ error: e.message }, 400);
  }
}
