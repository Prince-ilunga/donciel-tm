"use client";

import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  MessageCircle,
  Copy,
  Download,
  Image as ImageIcon,
  FileText,
  Lightbulb,
  Send,
  QrCode,
} from "lucide-react";

const SITE = "https://donciel-trading.vercel.app";

interface KitMessage {
  id: string;
  titleFr: string;
  titleEn: string;
  descFr: string;
  descEn: string;
  text: string;
}

const MESSAGES: KitMessage[] = [
  {
    id: "lancement",
    titleFr: "Message de lancement",
    titleEn: "Launch message",
    descFr: "Pour annoncer l'app à tes contacts et dans tes groupes traders",
    descEn: "To announce the app to your contacts and trading groups",
    text: `🚀 *Traders, cette appli va vous parler !*

Je viens de lancer *DONCIEL TM* — un journal de trading 100% en ligne :

📊 Statistiques avancées de tes performances
🤖 Un *Coach IA* qui analyse tes captures TradingView
💰 Money management discipliné (ton capital te remerciera)
📱 Abonnement payable en *M-Pesa, Airtel Money, Orange Money*

🎁 Essai *GRATUIT* — 30 trades/mois, sans carte bancaire
👉 ${SITE}

Ta discipline devient ta force. 💪`,
  },
  {
    id: "complet",
    titleFr: "Présentation complète",
    titleEn: "Full pitch",
    descFr: "Pour un prospect intéressé qui demande des détails",
    descEn: "For an interested prospect asking for details",
    text: `Salut 👋

Tu trades sur XAUUSD, BTC, EURUSD... ?

Le vrai problème de 90% des traders, ce n'est pas la stratégie — c'est *la discipline et le suivi*.

C'est exactement ce que résout *DONCIEL TM*, le journal de trading nouvelle génération :

✅ Chaque trade documenté (setup, émotions, captures)
✅ Statistiques 360° : win rate, RR, distribution, timing
✅ *Coach IA* : tu lui envoies ta capture TradingView, il analyse ton graphique et te corrige
✅ Money management par paliers pour protéger ton capital
✅ Plan de trading écrit et réutilisable

🎁 Essai gratuit : 30 trades/mois, aucune carte requise
💳 Abonnement par Mobile Money (M-Pesa, Airtel, Orange)

Essaie ici 👉 ${SITE}`,
  },
  {
    id: "relance",
    titleFr: "Relance douce",
    titleEn: "Soft follow-up",
    descFr: "À envoyer ~1 semaine après à ceux qui n'ont pas répondu",
    descEn: "Send ~1 week later to those who didn't reply",
    text: `Salut 👋 petite nouvelle !

*DONCIEL TM* s'améliore chaque semaine : le Coach IA analyse maintenant les graphiques directement depuis une capture d'écran 🤖📊

Tu poses ton graphique, il te dit ce qu'il voit, tes points forts et ce qu'il faut corriger.

L'essai est toujours gratuit (aucune carte requise) :
👉 ${SITE}

Celui qui note ses trades progresse 2× plus vite. Ton futur toi te dira merci 🙏`,
  },
  {
    id: "statut",
    titleFr: "Statut WhatsApp",
    titleEn: "WhatsApp status",
    descFr: "Court et percutant — pour ton statut",
    descEn: "Short and punchy — for your status",
    text: `📈 Trader sans journal = navigation sans boussole.

J'ai lancé *DONCIEL TM* : ton journal de trading + un Coach IA qui analyse tes graphiques.

Essai gratuit 👉 ${SITE}`,
  },
];

const OBJECTIONS = [
  {
    q: "C'est vraiment gratuit ?",
    a: "Oui : 30 trades/mois offerts, sans carte bancaire. Si ça te plaît, l'abonnement se paie directement par Mobile Money (M-Pesa, Airtel, Orange) — 1 minute.",
  },
  {
    q: "Je suis débutant, c'est pour moi ?",
    a: "C'est même fait pour ça : la checklist t'accompagne étape par étape, et le Coach IA analyse tes captures et te corrige comme un mentor. Tu progresses sans prendre de mauvaises habitudes.",
  },
  {
    q: "Je note déjà mes trades sur Excel",
    a: "Excel note, mais ne calcule rien tout seul : DONCIEL calcule ton RR, ton win rate, ta discipline, ton timing — et le Coach IA commente tes graphiques. Tu vois enfin ce qui marche vraiment chez toi.",
  },
];

export function WhatsappKit() {
  const { language } = useAppStore();
  const fr = language === "fr";

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(fr ? "Message copié ! Colle-le dans WhatsApp 📋" : "Message copied! Paste it in WhatsApp 📋");
    } catch {
      toast.error(fr ? "Impossible de copier — sélectionne le texte manuellement" : "Copy failed — select the text manually");
    }
  };

  const share = (text: string) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  const download = (name: string) => {
    const a = document.createElement("a");
    a.href = `/downloads/${name}`;
    a.download = name;
    a.click();
    toast.success(fr ? "Téléchargement lancé 📥" : "Download started 📥");
  };

  return (
    <div className="space-y-6">
      {/* Intro */}
      <Card className="p-4 md:p-5 border-gold/30 bg-gold/[0.04]">
        <div className="flex items-start gap-3">
          <MessageCircle className="w-5 h-5 text-gold shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-sm md:text-base">
              {fr ? "Kit de partage WhatsApp — ta boîte à outils marketing" : "WhatsApp sharing kit — your marketing toolbox"}
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground mt-1 leading-relaxed">
              {fr
                ? "Tout est prêt : copie un message, partage l'image, envoie le flyer. Objectif : tes 10 premiers clients actifs. Conseil : commence par 5 amis proches qui tradent, demande-leur un retour honnête, puis élargis aux groupes."
                : "Everything is ready: copy a message, share the image, send the flyer. Goal: your first 10 active customers. Tip: start with 5 close friends who trade, ask for honest feedback, then expand to groups."}
            </p>
          </div>
        </div>
      </Card>

      {/* Messages */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <Send className="w-4 h-4" />
          {fr ? "1. Messages prêts à envoyer" : "1. Ready-to-send messages"}
        </h4>
        <div className="grid gap-4 md:grid-cols-2">
          {MESSAGES.map((m) => (
            <Card key={m.id} className="p-4 flex flex-col gap-3">
              <div>
                <div className="font-semibold text-sm">{fr ? m.titleFr : m.titleEn}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{fr ? m.descFr : m.descEn}</div>
              </div>
              <div className="rounded-lg bg-muted/50 border p-3 text-xs leading-relaxed whitespace-pre-wrap flex-1 max-h-72 overflow-y-auto">
                {m.text}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => copy(m.text)}>
                  <Copy className="w-3.5 h-3.5" />
                  {fr ? "Copier" : "Copy"}
                </Button>
                <Button size="sm" className="flex-1 gap-1.5" onClick={() => share(m.text)}>
                  <MessageCircle className="w-3.5 h-3.5" />
                  {fr ? "WhatsApp" : "WhatsApp"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Images */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <ImageIcon className="w-4 h-4" />
          {fr ? "2. Images à partager" : "2. Images to share"}
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-4">
            <div className="font-semibold text-sm mb-1">{fr ? "Statut WhatsApp (9:16)" : "WhatsApp status (9:16)"}</div>
            <div className="text-xs text-muted-foreground mb-3">
              {fr ? "Parfait pour ton statut et les groupes" : "Perfect for your status and groups"}
            </div>
            <div className="rounded-lg overflow-hidden border mb-3 bg-background max-h-72 overflow-y-hidden flex items-start justify-center">
              <img src="/downloads/whatsapp-statut.png" alt="Visuel statut WhatsApp DONCIEL TM" className="w-full object-cover object-top" />
            </div>
            <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => download("whatsapp-statut.png")}>
              <Download className="w-3.5 h-3.5" />
              {fr ? "Télécharger le statut" : "Download status image"}
            </Button>
          </Card>
          <Card className="p-4">
            <div className="font-semibold text-sm mb-1">{fr ? "Post carré (1:1)" : "Square post (1:1)"}</div>
            <div className="text-xs text-muted-foreground mb-3">
              {fr ? "Idéal pour les groupes et les pages" : "Ideal for groups and pages"}
            </div>
            <div className="rounded-lg overflow-hidden border mb-3 bg-background max-h-72 overflow-y-hidden flex items-start justify-center">
              <img src="/downloads/whatsapp-post.png" alt="Visuel post WhatsApp DONCIEL TM" className="w-full object-cover object-top" />
            </div>
            <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => download("whatsapp-post.png")}>
              <Download className="w-3.5 h-3.5" />
              {fr ? "Télécharger le post" : "Download post image"}
            </Button>
          </Card>
        </div>
      </div>

      {/* Objections */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          {fr ? "3. Réponses aux questions fréquentes" : "3. Answers to common questions"}
        </h4>
        <div className="grid gap-3 md:grid-cols-3">
          {OBJECTIONS.map((o) => (
            <Card key={o.q} className="p-4 flex flex-col gap-2">
              <div className="text-sm font-semibold">&laquo;&nbsp;{o.q}&nbsp;&raquo;</div>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1">{o.a}</p>
              <Button size="sm" variant="ghost" className="justify-start gap-1.5 h-8 text-xs px-2" onClick={() => copy(o.a)}>
                <Copy className="w-3 h-3" />
                {fr ? "Copier la réponse" : "Copy answer"}
              </Button>
            </Card>
          ))}
        </div>
      </div>

      {/* Documents */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          {fr ? "4. Documents complémentaires" : "4. Additional documents"}
        </h4>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4 flex items-center gap-3">
            <FileText className="w-8 h-8 text-gold shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{fr ? "Flyer PDF" : "PDF flyer"}</div>
              <div className="text-xs text-muted-foreground">{fr ? "À imprimer ou envoyer" : "Print or send it"}</div>
            </div>
            <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => download("donciel-flyer.pdf")}>
              <Download className="w-3.5 h-3.5" />
            </Button>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <QrCode className="w-8 h-8 text-gold shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{fr ? "QR code" : "QR code"}</div>
              <div className="text-xs text-muted-foreground">{SITE.replace("https://", "")}</div>
            </div>
            <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => download("qr-code.png")}>
              <Download className="w-3.5 h-3.5" />
            </Button>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <FileText className="w-8 h-8 text-gold shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{fr ? "Guide utilisateur" : "User guide"}</div>
              <div className="text-xs text-muted-foreground">{fr ? "Pour accompagner tes prospects" : "To support your prospects"}</div>
            </div>
            <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => download("donciel-guide-utilisateur.pdf")}>
              <Download className="w-3.5 h-3.5" />
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
