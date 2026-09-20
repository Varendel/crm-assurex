// ═══ CHIFFREMENT DES ÉCHANGES ECOHUB / SAF (20.09.2026) ═════════════════════════════════════════
// EcoHub impose un chiffrement de bout en bout : un message n'est jamais lisible par la plateforme,
// seulement par le destinataire. La chaîne est imposée par le standard SAF :
//
//   Envoi    : contenu → gzip → AES-GCM (clé 256 bits, IV 96 bits, tag 128 bits) → base64
//              la clé AES est elle-même chiffrée en RSA-OAEP / SHA-256 avec la clé PUBLIQUE du
//              destinataire, et l'ensemble est signé en ECDSA P-384 (secp384r1) / SHA-384.
//   Réception: vérifier la signature → déchiffrer la clé AES avec NOTRE clé privée → AES-GCM →
//              gunzip → contenu.
//
// Tout est fait avec WebCrypto, disponible à l'identique dans le navigateur et dans une fonction
// Deno côté Supabase : ce fichier sert de référence et de banc d'essai, le même code sera repris
// dans la fonction « ecohub-crypto ». Aucune clé privée ne doit jamais être stockée en base :
// elles vivent dans les secrets Supabase.

const EHK = {
  AES: { name: 'AES-GCM', length: 256 },
  IV_OCTETS: 12,        // 96 bits, imposé par le standard
  TAG_BITS: 128,
  RSA: { name: 'RSA-OAEP', hash: 'SHA-256' },
  ECDSA: { name: 'ECDSA', namedCurve: 'P-384' },   // secp384r1
  ECDSA_HASH: 'SHA-384',
};

function ehkB64(octets) {
  let s = '';
  const vue = new Uint8Array(octets);
  for (let i = 0; i < vue.length; i += 0x8000) s += String.fromCharCode.apply(null, vue.subarray(i, i + 0x8000));
  return btoa(s);
}
function ehkDeB64(texte) {
  const brut = atob(String(texte || ''));
  const out = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i++) out[i] = brut.charCodeAt(i);
  return out;
}

// gzip / gunzip — CompressionStream existe dans le navigateur comme dans Deno
async function ehkGzip(octets) {
  const flux = new Blob([octets]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(flux).arrayBuffer());
}
async function ehkGunzip(octets) {
  const flux = new Blob([octets]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(flux).arrayBuffer());
}

// ── Clés ────────────────────────────────────────────────────────────────────────────────────────
// Paire de chiffrement (RSA-OAEP) : la publique est publiée dans le Public Key Store d'EcoHub,
// la privée reste dans les secrets Supabase.
async function ehkGenererPaireChiffrement() {
  return crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['encrypt', 'decrypt']);
}
// Paire de signature (ECDSA P-384) : même principe, c'est elle qui prouve que le message vient de nous.
async function ehkGenererPaireSignature() {
  return crypto.subtle.generateKey(EHK.ECDSA, true, ['sign', 'verify']);
}
async function ehkExporterPubliqueSpkiB64(cle) {
  return ehkB64(await crypto.subtle.exportKey('spki', cle));
}
async function ehkImporterPubliqueChiffrement(spkiB64) {
  return crypto.subtle.importKey('spki', ehkDeB64(spkiB64), EHK.RSA, true, ['encrypt']);
}
async function ehkImporterPubliqueSignature(spkiB64) {
  return crypto.subtle.importKey('spki', ehkDeB64(spkiB64), EHK.ECDSA, true, ['verify']);
}

// ── Envoi ───────────────────────────────────────────────────────────────────────────────────────
async function ehkChiffrerPour(contenuTexte, clePubliqueDestinataire, clePriveeSignature) {
  const brut = new TextEncoder().encode(String(contenuTexte ?? ''));
  const compresse = await ehkGzip(brut);
  const cleAes = await crypto.subtle.generateKey(EHK.AES, true, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(EHK.IV_OCTETS));
  const chiffre = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: EHK.TAG_BITS }, cleAes, compresse));
  const cleAesBrute = await crypto.subtle.exportKey('raw', cleAes);
  const cleAesChiffree = new Uint8Array(await crypto.subtle.encrypt(EHK.RSA, clePubliqueDestinataire, cleAesBrute));
  const enveloppe = {
    algo: 'AES-GCM-256/RSA-OAEP-SHA256/GZIP',
    iv: ehkB64(iv),
    cle: ehkB64(cleAesChiffree),
    contenu: ehkB64(chiffre),
  };
  if (clePriveeSignature) {
    const aSigner = new TextEncoder().encode(enveloppe.iv + enveloppe.cle + enveloppe.contenu);
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: EHK.ECDSA_HASH }, clePriveeSignature, aSigner);
    enveloppe.signature = ehkB64(signature);
    enveloppe.signature_algo = 'ECDSA-P384-SHA384';
  }
  return enveloppe;
}

// ── Réception ───────────────────────────────────────────────────────────────────────────────────
// La signature est vérifiée AVANT tout déchiffrement : on ne déballe jamais un message dont on n'a
// pas confirmé l'origine.
async function ehkDechiffrer(enveloppe, clePriveeChiffrement, clePubliqueExpediteur) {
  if (!enveloppe || !enveloppe.contenu || !enveloppe.cle || !enveloppe.iv) throw new Error('Enveloppe incomplète');
  if (clePubliqueExpediteur) {
    if (!enveloppe.signature) throw new Error('Signature absente alors qu’une clé de vérification est fournie');
    const aVerifier = new TextEncoder().encode(enveloppe.iv + enveloppe.cle + enveloppe.contenu);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: EHK.ECDSA_HASH },
      clePubliqueExpediteur, ehkDeB64(enveloppe.signature), aVerifier);
    if (!ok) throw new Error('Signature invalide — message rejeté');
  }
  const cleAesBrute = await crypto.subtle.decrypt(EHK.RSA, clePriveeChiffrement, ehkDeB64(enveloppe.cle));
  const cleAes = await crypto.subtle.importKey('raw', cleAesBrute, EHK.AES, false, ['decrypt']);
  const compresse = new Uint8Array(await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ehkDeB64(enveloppe.iv), tagLength: EHK.TAG_BITS }, cleAes, ehkDeB64(enveloppe.contenu)));
  return new TextDecoder().decode(await ehkGunzip(compresse));
}

// ── Banc d'essai : à lancer depuis la console du CRM, ehkAutotest() ────────────────────────────
// Vérifie la chaîne complète, et surtout qu'un message altéré est bien REJETÉ.
async function ehkAutotest(contenu) {
  const message = contenu || '<commission><test>Décompte accentué — 1’234.50 CHF</test></commission>';
  const resultats = [];
  const paireC = await ehkGenererPaireChiffrement();
  const paireS = await ehkGenererPaireSignature();
  const pubC = await ehkImporterPubliqueChiffrement(await ehkExporterPubliqueSpkiB64(paireC.publicKey));
  const pubS = await ehkImporterPubliqueSignature(await ehkExporterPubliqueSpkiB64(paireS.publicKey));

  const env = await ehkChiffrerPour(message, pubC, paireS.privateKey);
  resultats.push(['enveloppe complète', !!(env.iv && env.cle && env.contenu && env.signature)]);
  resultats.push(['IV de 96 bits', ehkDeB64(env.iv).length === 12]);
  resultats.push(['contenu illisible en clair', !atob(env.contenu).includes('commission')]);

  const clair = await ehkDechiffrer(env, paireC.privateKey, pubS);
  resultats.push(['aller-retour fidèle (accents compris)', clair === message]);

  // Message altéré : doit être refusé
  let refuse = false;
  try {
    const falsifie = { ...env, contenu: ehkB64(((o) => { o[10] ^= 0xff; return o; })(ehkDeB64(env.contenu))) };
    await ehkDechiffrer(falsifie, paireC.privateKey, pubS);
  } catch (e) { refuse = true; }
  resultats.push(['message altéré rejeté', refuse]);

  // Signature d'un autre émetteur : doit être refusée
  let refuseAutre = false;
  try {
    const autre = await ehkGenererPaireSignature();
    const pubAutre = await ehkImporterPubliqueSignature(await ehkExporterPubliqueSpkiB64(autre.publicKey));
    await ehkDechiffrer(env, paireC.privateKey, pubAutre);
  } catch (e) { refuseAutre = true; }
  resultats.push(['signature étrangère rejetée', refuseAutre]);

  const echecs = resultats.filter(r => !r[1]).map(r => r[0]);
  return { ok: echecs.length === 0, echecs, controles: resultats.map(r => `${r[1] ? '✓' : '✗'} ${r[0]}`), taille_enveloppe: env.contenu.length };
}
