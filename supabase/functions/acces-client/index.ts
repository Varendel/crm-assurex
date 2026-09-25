// Espace client — gestion des accès (20.09.2026, refondu le 25.09.2026)
//
// Crée / réinitialise / désactive le compte d'un client.
//
// CE QUI A CHANGÉ LE 25.09.2026, ET POURQUOI (incident n° 6 du registre)
// La fonction générait un mot de passe et le renvoyait au courtier, qui le transmettait au client
// par e-mail. Trois conséquences, toutes mauvaises :
//   1. le mot de passe voyageait en clair et restait indéfiniment dans deux boîtes mail ;
//   2. le courtier le connaissait — il pouvait donc se connecter à l'espace de son client, et rien
//      dans les traces n'aurait distingué l'un de l'autre ;
//   3. un mot de passe choisi par la machine et envoyé par écrit finit recopié sur un papier.
//
// Désormais : le compte naît avec un mot de passe aléatoire que PERSONNE ne voit — ni le client,
// ni le courtier, ni le CRM. Il est inutilisable tel quel. La fonction renvoie à la place un LIEN
// D'ACTIVATION à usage unique, que le client suit pour choisir lui-même son mot de passe.
// Le secret n'existe donc jamais ailleurs que dans la tête du client.
//
// La réinitialisation applique la même règle : un nouveau mot de passe aléatoire invisible coupe
// l'ancien immédiatement, puis un nouveau lien est émis. Un lien perdu ne laisse donc pas un
// compte ouvert derrière lui.
//
// PRÉ-REQUIS DE CONFIGURATION : l'URL de retour doit figurer dans Supabase > Authentication >
// URL Configuration > Redirect URLs. Sans cela, Supabase renvoie vers le Site URL du projet et le
// client atterrit sur la mauvaise page. C'est contrôlé au § 5 de test/PROTOCOLE-REX-CLOUD.md.
//
// Seul le personnel Assurex peut appeler cette fonction : on vérifie le JWT de l'appelant, et on
// refuse si ce compte est lui-même un accès client.
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

// Un mot de passe que personne ne lira jamais : il n'a qu'un rôle, rendre le compte inutilisable
// tant que le client n'a pas suivi son lien. D'où 48 caractères plutôt que 14 — il n'a pas à être
// prononçable au téléphone, et il ne doit surtout pas être devinable.
function secretJetable(): string {
  const octets = new Uint8Array(48);
  crypto.getRandomValues(octets);
  return Array.from(octets, (o) => o.toString(16).padStart(2, "0")).join("").slice(0, 48);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: entetes });
  try {
    const jeton = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!jeton) return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: entetes });

    // Qui appelle ?
    const appelantClient = createClient(URL_SUPABASE, CLE_ANON, { global: { headers: { Authorization: `Bearer ${jeton}` } } });
    const { data: { user: appelant }, error: errUser } = await appelantClient.auth.getUser();
    if (errUser || !appelant) return new Response(JSON.stringify({ error: "Session invalide" }), { status: 401, headers: entetes });

    const admin = createClient(URL_SUPABASE, CLE_SERVICE);

    // Refus si l'appelant est lui-même un accès client
    const { data: estClient } = await admin.from("acces_clients").select("id").eq("auth_user_id", appelant.id).maybeSingle();
    if (estClient) return new Response(JSON.stringify({ error: "Réservé au personnel Assurex" }), { status: 403, headers: entetes });

    const corps = await req.json();
    const action = String(corps.action || "creer");
    const clientId = String(corps.client_id || "");
    if (!clientId) return new Response(JSON.stringify({ error: "client_id manquant" }), { status: 400, headers: entetes });

    const { data: client } = await admin.from("clients").select("id, prenom, nom, email").eq("id", clientId).maybeSingle();
    if (!client) return new Response(JSON.stringify({ error: "Client introuvable" }), { status: 404, headers: entetes });

    const { data: acces } = await admin.from("acces_clients").select("*").eq("client_id", clientId).maybeSingle();

    if (action === "desactiver") {
      if (!acces) return new Response(JSON.stringify({ error: "Aucun accès à désactiver" }), { status: 404, headers: entetes });
      await admin.from("acces_clients").update({ actif: false }).eq("id", acces.id);
      if (acces.auth_user_id) await admin.auth.admin.updateUserById(acces.auth_user_id, { ban_duration: "876000h" });
      return new Response(JSON.stringify({ ok: true, actif: false }), { headers: entetes });
    }

    if (action === "reactiver") {
      if (!acces) return new Response(JSON.stringify({ error: "Aucun accès à réactiver" }), { status: 404, headers: entetes });
      await admin.from("acces_clients").update({ actif: true }).eq("id", acces.id);
      if (acces.auth_user_id) await admin.auth.admin.updateUserById(acces.auth_user_id, { ban_duration: "none" });
      return new Response(JSON.stringify({ ok: true, actif: true }), { headers: entetes });
    }

    // creer | reinitialiser : un lien d'activation à usage unique, jamais un mot de passe.
    const email = String(corps.email || acces?.email || client.email || "").trim().toLowerCase();
    if (!email) return new Response(JSON.stringify({ error: "Ce client n'a pas d'adresse e-mail — ajoute-la sur sa fiche" }), { status: 400, headers: entetes });
    const retour = String(corps.retour || "").trim();

    if (acces?.auth_user_id) {
      // Le secret jetable coupe l'ancien mot de passe sur-le-champ : le client qui l'avait ne peut
      // plus entrer, même si le nouveau lien se perd en route.
      const { error } = await admin.auth.admin.updateUserById(acces.auth_user_id, {
        password: secretJetable(), email, ban_duration: "none",
      });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: entetes });
      await admin.from("acces_clients").update({ email, actif: true }).eq("id", acces.id);
    } else {
      const { data: cree, error: errCreate } = await admin.auth.admin.createUser({
        email, password: secretJetable(), email_confirm: true,
        user_metadata: { role: "client", client_id: clientId, nom: `${client.prenom || ""} ${client.nom || ""}`.trim() },
      });
      if (errCreate || !cree?.user) return new Response(JSON.stringify({ error: errCreate?.message || "Création impossible" }), { status: 400, headers: entetes });

      const { error: errLien } = await admin.from("acces_clients").insert({
        client_id: clientId, auth_user_id: cree.user.id, email, actif: true, cree_par: appelant.email,
      });
      if (errLien) {
        await admin.auth.admin.deleteUser(cree.user.id); // pas de compte orphelin
        return new Response(JSON.stringify({ error: errLien.message }), { status: 400, headers: entetes });
      }
    }

    // Le lien d'activation. Type « recovery » : à usage unique, il expire, et il donne au client
    // le droit de poser SON mot de passe — jamais celui de lire quoi que ce soit avant.
    const { data: lien, error: errGen } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: retour ? { redirectTo: retour } : undefined,
    });
    if (errGen || !lien?.properties?.action_link) {
      // Le compte existe mais sans lien : on le dit franchement plutôt que de laisser croire
      // que l'accès est prêt.
      return new Response(JSON.stringify({
        error: "Compte créé, mais le lien d'activation n'a pas pu être émis : " + (errGen?.message || "réponse vide"),
      }), { status: 500, headers: entetes });
    }

    return new Response(JSON.stringify({
      ok: true, email,
      lien_activation: lien.properties.action_link,
      reinitialise: !!acces?.auth_user_id,
    }), { headers: entetes });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers: entetes });
  }
});
