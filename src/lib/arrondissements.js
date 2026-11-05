// Paris arrondissement boundaries (Paris Data, ODbL), shared by the map and Activities.
let loading = null;
let data = [];

/** [[number, label, [[lat, lng], ...]], ...], loaded once. */
export async function loadArrondissements() {
  if (!loading) {
    loading = fetch('/data/paris-arrondissements.json')
      .then((r) => r.json())
      .then((j) => (data = j.arrondissements))
      .catch(() => (data = []));
  }
  return loading;
}

function inside([lat, lng], ring) {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ai, bi] = ring[i];
    const [aj, bj] = ring[j];
    if (bi > lng !== bj > lng && lat < ((aj - ai) * (lng - bi)) / (bj - bi) + ai) yes = !yes;
  }
  return yes;
}

/** Arrondissement number of a point, or null outside Paris. Call loadArrondissements() first. */
export function arrondissementOf(lat, lng) {
  const hit = data.find(([, , ring]) => inside([lat, lng], ring));
  return hit ? hit[0] : null;
}
