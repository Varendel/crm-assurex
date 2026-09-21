// Lecture des décomptes de commissions scannés (20.09.2026)
// La plupart des décomptes reçus sont des scans : aucun texte à extraire, il faut lire l'image.
// Cette fonction envoie le document à un modèle de vision et renvoie les lignes structurées
// (n° de police, client, produit, montants), prêtes à être rapprochées des contrats du CRM.
//
//   action "diagnostic" : indique quel fournisseur est configuré (aucune clé n'est renvoyée)
//   action "lire"       : { fichier_base64, type_mime } -> { compagnie, periode, lignes[], totaux }
//   action "classer"    : { fichier_base64, type_mime } -> { type, titulaire, ... } (21.09.2026)
//                         reconnaît une pièce déposée : identité, permis, police… pour la ranger
//                         sur la bonne fiche client. Rien n'est conservé côté serveur.
//
// Réservé au personnel Assurex : un compte client ne peut pas l'appeler.
// Copie versionnée de la fonction déployée (version 8) : déployer depuis ce fichier.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const entetes = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const CLE_ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLE_ANTHROPIC") || "";
const CLE_OPENAI = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("CLE_OPENAI") || "";
const CLE_GOOGLE = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY") || "";

function fournisseurs() {
  return {
    anthropic: !!CLE_ANTHROPIC,
    openai: !!CLE_OPENAI,
    google: !!CLE_GOOGLE,
  };
}

const CONSIGNE = `Tu lis un décompte de commissions d'assurance suisse (souvent un scan).
Extrais fidèlement ce que tu vois, sans rien inventer. Réponds UNIQUEMENT en JSON, sans texte autour :
{
  "compagnie": "nom de la compagnie qui émet le décompte",
  "periode": "AAAA-MM si identifiable, sinon ''",
  "reference": "numéro du décompte si présent",
  "lignes": [
    {
      "numero_police": "n° de police tel qu'imprimé (garde les points, espaces et tirets)",
      "client_nom": "nom du preneur d'assurance",
      "produit": "branche ou produit",
      "type_mouvement": "acquisition | gestion | extourne | autre",
      "prime": nombre ou null,
      "taux": nombre ou null,
      "credit": nombre ou null,
      "debit": nombre ou null,
      "date": "AAAA-MM-JJ ou ''"
    }
  ],
  "total_credit": nombre ou null,
  "total_debit": nombre ou null,
  "confiance": "haute | moyenne | basse",
  "remarques": "ce que tu n'as pas pu lire"
}
Règles : les montants suisses s'écrivent 1'234.50 ou 1 234,50 -> renvoie 1234.5 (nombre, point décimal).
Un montant entre parenthèses ou suivi d'un signe moins est un débit (extourne). Si une valeur est
illisible, mets null et signale-le dans "remarques". N'invente jamais un numéro de police.`;

const CONSIGNE_CLASSER = `Tu regardes UNE pièce déposée par un courtier en assurances suisse (scan ou photo).
Dis de quel document il s'agit et à qui il appartient. Ne recopie AUCUN numéro de document d'identité.
Réponds UNIQUEMENT en JSON, sans texte autour :
{
  "type": "identite | passeport | permis_conduire | permis_sejour | permis_circulation | police | facture | attestation | autre",
  "titulaire": "prénom et nom de la personne ou raison sociale, tels qu'imprimés",
  "compagnie": "compagnie d'assurance si c'est un document d'assurance, sinon ''",
  "numero_police": "n° de police si c'est un document d'assurance, sinon ''",
  "plaque": "n° de plaque si permis de circulation, sinon ''",
  "valable_jusqu": "AAAA-MM-JJ si une date d'expiration est visible, sinon ''",
  "confiance": "haute | moyenne | basse"
}
Repères : carte d'identité suisse = IDENTITÄTSKARTE / CARTE D'IDENTITÉ ; permis de conduire = FÜHRERAUSWEIS / PERMIS DE CONDUIRE ;
permis de séjour = AUSLÄNDERAUSWEIS / TITRE DE SÉJOUR (B, C, L, G) ; permis de circulation = FAHRZEUGAUSWEIS / PERMIS DE CIRCULATION.`;

function contenuVision(base64: string, mime: string, consigne: string) {
  return mime === "application/pdf"
    ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }, { type: "text", text: consigne }]
    : [{ type: "image", source: { type: "base64", media_type: mime, data: base64 } }, { type: "text", text: consigne }];
}

async function lireAvecAnthropic(base64: string, mime: string, consigne = CONSIGNE, maxTokens = 8000) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": CLE_ANTHROPIC, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: maxTokens, messages: [{ role: "user", content: contenuVision(base64, mime, consigne) }] }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || `Anthropic ${r.status}`);
  return (d.content || []).map((c: { text?: string }) => c.text || "").join("");
}

async function lireAvecOpenai(base64: string, mime: string, consigne = CONSIGNE, maxTokens = 8000) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${CLE_OPENAI}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: [
        { type: "text", text: consigne },
        { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
      ] }],
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || `OpenAI ${r.status}`);
  return d.choices?.[0]?.message?.content || "";
}

function extraireJson(texte: string) {
  const t = String(texte || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const debut = t.indexOf("{"), fin = t.lastIndexOf("}");
  if (debut < 0 || fin <= debut) throw new Error("Réponse illisible du modèle");
  return JSON.parse(t.slice(debut, fin + 1));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: entetes });
  try {
    const jeton = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!jeton) return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: entetes });

    const appelantClient = createClient(URL_SUPABASE, CLE_ANON, { global: { headers: { Authorization: `Bearer ${jeton}` } } });
    const { data: { user: appelant }, error: errUser } = await appelantClient.auth.getUser();
    if (errUser || !appelant) return new Response(JSON.stringify({ error: "Session invalide" }), { status: 401, headers: entetes });

    const admin = createClient(URL_SUPABASE, CLE_SERVICE);
    const { data: estClient } = await admin.from("acces_clients").select("id").eq("auth_user_id", appelant.id).maybeSingle();
    if (estClient) return new Response(JSON.stringify({ error: "Réservé au personnel Assurex" }), { status: 403, headers: entetes });

    const corps = await req.json().catch(() => ({}));
    const action = String(corps.action || "diagnostic");
    const dispo = fournisseurs();

    if (action === "diagnostic") {
      const actif = dispo.anthropic ? "anthropic" : dispo.openai ? "openai" : dispo.google ? "google" : null;
      return new Response(JSON.stringify({
        ok: true, fournisseurs: dispo, fournisseur_actif: actif,
        message: actif
          ? `Lecture des décomptes opérationnelle (${actif}).`
          : "Aucune clé de modèle configurée. Ajoute ANTHROPIC_API_KEY (ou OPENAI_API_KEY) dans Supabase > Edge Functions > Secrets.",
      }), { headers: entetes });
    }

    if (action === "lire" || action === "classer") {
      const base64 = String(corps.fichier_base64 || "");
      const mime = String(corps.type_mime || "application/pdf");
      if (!base64) return new Response(JSON.stringify({ error: "fichier_base64 manquant" }), { status: 400, headers: entetes });
      if (base64.length > 26_000_000) return new Response(JSON.stringify({ error: "Document trop lourd (max ~18 Mo)" }), { status: 413, headers: entetes });
      if (!dispo.anthropic && !dispo.openai) {
        return new Response(JSON.stringify({ error: "Aucune clé de modèle configurée (ANTHROPIC_API_KEY ou OPENAI_API_KEY)" }), { status: 503, headers: entetes });
      }
      const debut = Date.now();

      if (action === "classer") {
        const brut = dispo.anthropic ? await lireAvecAnthropic(base64, mime, CONSIGNE_CLASSER, 600) : await lireAvecOpenai(base64, mime, CONSIGNE_CLASSER, 600);
        const r = extraireJson(brut);
        return new Response(JSON.stringify({
          ok: true, duree_ms: Date.now() - debut,
          type: r.type || "autre", titulaire: r.titulaire || "", compagnie: r.compagnie || "",
          numero_police: r.numero_police || "", plaque: r.plaque || "", valable_jusqu: r.valable_jusqu || "",
          confiance: r.confiance || "moyenne",
        }), { headers: entetes });
      }

      const brut = dispo.anthropic ? await lireAvecAnthropic(base64, mime) : await lireAvecOpenai(base64, mime);
      const resultat = extraireJson(brut);
      const lignes = Array.isArray(resultat.lignes) ? resultat.lignes : [];
      return new Response(JSON.stringify({
        ok: true,
        fournisseur: dispo.anthropic ? "anthropic" : "openai",
        duree_ms: Date.now() - debut,
        compagnie: resultat.compagnie || "",
        periode: resultat.periode || "",
        reference: resultat.reference || "",
        lignes,
        total_credit: resultat.total_credit ?? null,
        total_debit: resultat.total_debit ?? null,
        confiance: resultat.confiance || "moyenne",
        remarques: resultat.remarques || "",
      }), { headers: entetes });
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), { status: 400, headers: entetes });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers: entetes });
  }
});
