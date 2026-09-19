// ═══ COMPTES DE CAUTION PAR COMPAGNIE (19.09.2026) ══════════════════════════════════════════
// Certaines compagnies (Groupe Mutuel, CSS) retiennent une part des commissions sur un compte de
// caution, qui sert à couvrir les contre-passations (contrats résiliés dans le délai) et dont elles
// annoncent le solde à chaque décompte. Les montants vivent sur les bordereaux :
// caution_retenue, caution_retrait, caution_solde (+ taux_caution pour une estimation à défaut).
const CAUTION_COMPAGNIES = ['Groupe Mutuel', 'CSS'];

function cauEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function cauCie(n) { return (typeof normaliserCompagnie === 'function' ? normaliserCompagnie(n || '') : n) || '—'; }
function cauDate(b) { return (b.date_reception || b.created_at || '').slice(0, 10); }

// Retenue connue, sinon estimée avec le taux de caution du bordereau
function cauRetenue(b) {
  if (b.caution_retenue != null) return { v: Number(b.caution_retenue), estimee: false };
  const t = Number(b.taux_caution || 0);
  return t ? { v: Math.round(Number(b.montant_brut || 0) * t) / 100, estimee: true } : { v: 0, estimee: false };
}

function viewComptesCaution() {
  const bds = allBordereaux.filter(b => CAUTION_COMPAGNIES.includes(cauCie(b.compagnie)) || b.caution_retenue != null || b.caution_solde != null || Number(b.taux_caution || 0) > 0);
  const cies = [...new Set([...CAUTION_COMPAGNIES, ...bds.map(b => cauCie(b.compagnie))])];
  const carte = cie => {
    const liste = bds.filter(b => cauCie(b.compagnie) === cie).sort((a, b) => cauDate(a).localeCompare(cauDate(b)));
    const annonce = liste.filter(b => b.caution_solde != null).pop();
    const annee = String(new Date().getFullYear());
    const deLAnnee = liste.filter(b => cauDate(b).startsWith(annee));
    const retenues = deLAnnee.reduce((s, b) => s + cauRetenue(b).v, 0);
    const retraits = deLAnnee.reduce((s, b) => s + Number(b.caution_retrait || 0), 0);
    return `<section class="dbx-carte cau-carte">
      <header class="dbx-carte-tete"><h2 style="display:flex;align-items:center;gap:10px">${typeof pictoCompagnie === 'function' ? pictoCompagnie(cie, 30) : ''}${cauEsc(cie)}</h2>
        <span class="dbx-carte-sous">${liste.length} bordereau${liste.length > 1 ? 'x' : ''}</span></header>
      <div class="cau-chiffres">
        <div><span>Solde annoncé</span><b>${annonce ? 'CHF ' + fmtCHF2(annonce.caution_solde) : '—'}</b><small>${annonce ? 'au ' + fmtDate(cauDate(annonce)) : 'à saisir depuis un décompte'}</small></div>
        <div><span>Retenu en ${annee}</span><b>CHF ${fmtCHF2(retenues)}</b><small>sur les commissions</small></div>
        <div><span>Retiré en ${annee}</span><b>CHF ${fmtCHF2(retraits)}</b><small>contre-passations couvertes</small></div>
      </div>
      ${liste.length ? `<div class="sfx-liste">${liste.slice().reverse().map(b => {
        const r = cauRetenue(b);
        return `<div class="sfx-ligne cau-ligne">
          <span class="sfx-corps"><b>${cauEsc(b.numero || b.mois || 'Bordereau')}</b><small>${fmtDate(cauDate(b))} · commissions CHF ${fmtCHF2(b.montant_brut)}${b.encaisse_par === 'oz' ? ' · encaissé par OZ' : ''}</small></span>
          <span class="cau-val">${r.v ? `−${fmtCHF2(r.v)}${r.estimee ? ' <em title="Estimée avec le taux de caution du bordereau">≈</em>' : ''}` : '—'}<small>retenue</small></span>
          <span class="cau-val">${b.caution_retrait ? '+' + fmtCHF2(b.caution_retrait) : '—'}<small>retrait</small></span>
          <span class="cau-val">${b.caution_solde != null ? fmtCHF2(b.caution_solde) : '—'}<small>solde</small></span>
          <button type="button" class="ck-ouvrir" onclick="cauEditer('${b.id}')">✎</button>
        </div>`;
      }).join('')}</div>` : '<div class="dbx-vide-petit">Aucun bordereau importé pour cette compagnie.</div>'}
    </section>`;
  };
  return `<div class="dbx">
    <header class="dx-tete"><div><div class="dx-surtitre">Finances</div><h2>Comptes de caution</h2></div>
      <div class="dx-tete-actions"><button type="button" class="btn-secondary" onclick="navigate('bordereaux')">🧾 Bordereaux</button></div></header>
    <div class="sfx-intro">Groupe Mutuel et CSS retiennent une part des commissions sur un compte de caution qui couvre les contre-passations. Les montants se saisissent à l’import du décompte (ou ici, ✎), avec le solde annoncé par la compagnie.</div>
    <div class="cau-grille">${cies.map(carte).join('')}</div>
  </div>`;
}

function cauEditer(id) {
  const b = allBordereaux.find(x => x.id === id);
  if (!b) return;
  const v = x => x == null ? '' : x;
  creerModale('modal-caution', `
    <div class="opx-modale" role="dialog" aria-labelledby="cau-titre">
      <h3 id="cau-titre">Compte de caution — ${cauEsc(b.numero || '')}</h3>
      <div class="form-grid">
        <div class="form-field"><label class="form-label" for="cau-retenue">Retenue (CHF)</label><input class="form-input" id="cau-retenue" inputmode="decimal" value="${v(b.caution_retenue)}"/></div>
        <div class="form-field"><label class="form-label" for="cau-retrait">Retrait (CHF)</label><input class="form-input" id="cau-retrait" inputmode="decimal" value="${v(b.caution_retrait)}"/></div>
        <div class="form-field"><label class="form-label" for="cau-solde">Solde annoncé (CHF)</label><input class="form-input" id="cau-solde" inputmode="decimal" value="${v(b.caution_solde)}"/></div>
        <div class="form-field"><label class="form-label" for="cau-taux">Taux de caution (%)</label><input class="form-input" id="cau-taux" inputmode="decimal" value="${v(b.taux_caution)}"/></div>
      </div>
      <div class="opx-modale-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-caution').remove()">Annuler</button>
        <button type="button" class="btn-save" onclick="cauEnregistrer('${id}')">✓ Enregistrer</button>
      </div>
    </div>`);
}

async function cauEnregistrer(id) {
  const lire = k => { const s = (document.getElementById(k)?.value || '').trim(); return s === '' ? null : nombreCH(s); };
  const body = { caution_retenue: lire('cau-retenue'), caution_retrait: lire('cau-retrait'), caution_solde: lire('cau-solde'), taux_caution: lire('cau-taux') || 0 };
  const r = await dbPatch('bordereaux', id, body);
  if (r && r.error) { showError('Non enregistré : ' + errMsg(r)); return; }
  const b = allBordereaux.find(x => x.id === id);
  if (b) Object.assign(b, body);
  document.getElementById('modal-caution')?.remove();
  showError('✓ Compte de caution mis à jour.');
  const main = document.getElementById('main-content');
  if (main && currentView === 'caution') main.innerHTML = viewComptesCaution();
}
