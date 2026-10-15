// Google reviews: live from the Places API (New) when GOOGLE_PLACES_KEY and a
// Place ID are set, otherwise the reviews entered in the admin panel.
// Live results are cached for six hours and refreshed in the background.
const store = require('./store');

let cache = { at: 0, placeId: '', data: null };

async function refresh(placeId) {
  const key = process.env.GOOGLE_PLACES_KEY;
  try {
    const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'rating,userRatingCount,reviews,googleMapsUri' },
    });
    if (!r.ok) throw new Error(`Places API ${r.status}`);
    const j = await r.json();
    cache = {
      at: Date.now(),
      placeId,
      data: {
        live: true,
        rating: j.rating,
        count: j.userRatingCount,
        url: j.googleMapsUri,
        items: (j.reviews || []).slice(0, 6).map((v) => ({
          name: (v.authorAttribution && v.authorAttribution.displayName) || 'Google user',
          rating: v.rating,
          text: (v.text && v.text.text) || (v.originalText && v.originalText.text) || '',
          when: v.relativePublishTimeDescription || '',
        })),
      },
    };
  } catch (e) {
    console.error('reviews', e.message);
    cache.at = Date.now(); // back off; keep the last good data
  }
}

function manual() {
  const db = store.get();
  const items = (db.reviews || []).filter((r) => r.published !== false).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (!items.length) return null;
  const rating = items.reduce((n, r) => n + Number(r.rating || 0), 0) / items.length;
  return { live: false, rating: Math.round(rating * 10) / 10, count: items.length, url: db.settings.googleReviewsUrl || '', items: items.slice(0, 6).map((r) => ({ name: r.name, rating: Number(r.rating), text: r.text, when: r.date })) };
}

function get() {
  const db = store.get();
  const placeId = db.settings.googlePlaceId;
  if (process.env.GOOGLE_PLACES_KEY && placeId) {
    if (cache.placeId !== placeId || Date.now() - cache.at > 6 * 3600e3) refresh(placeId);
    if (cache.data && cache.placeId === placeId) return { ...cache.data, url: db.settings.googleReviewsUrl || cache.data.url };
  }
  return manual();
}

module.exports = { get };
