import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Scale, Lock, AlertTriangle, Cookie } from "lucide-react";

function Section({ id, icon: Icon, title, children }: { id: string; icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-lg bg-amber-400/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold text-white">{title}</h2>
      </div>
      <div className="space-y-4 text-sm leading-relaxed text-neutral-300 [&_h3]:text-white [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-neutral-100">
        {children}
      </div>
    </section>
  );
}

export const metadata = {
  title: "Mentions légales, CGU & Confidentialité — DONCIEL TM",
  description: "Conditions d'utilisation, politique de confidentialité et avertissement sur les risques de DONCIEL TM.",
};

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-200 flex flex-col">
      <header className="border-b border-white/10 bg-[#0a0a0a]/90 sticky top-0 z-40 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="text-neutral-400 hover:text-white hover:bg-white/5">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Accueil
            </Link>
          </Button>
          <span className="font-bold text-white">
            DONCIEL<span className="text-amber-400">™</span>
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-12 space-y-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white">Informations légales</h1>
          <p className="text-neutral-400 mt-3">
            Dernière mise à jour : {new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
          </p>
          <nav className="mt-6 flex flex-wrap justify-center gap-2 text-sm">
            <a href="#cgu" className="rounded-full border border-white/10 px-4 py-1.5 text-neutral-300 hover:border-amber-400/40 hover:text-amber-400 transition-colors">CGU</a>
            <a href="#confidentialite" className="rounded-full border border-white/10 px-4 py-1.5 text-neutral-300 hover:border-amber-400/40 hover:text-amber-400 transition-colors">Confidentialité</a>
            <a href="#risques" className="rounded-full border border-white/10 px-4 py-1.5 text-neutral-300 hover:border-amber-400/40 hover:text-amber-400 transition-colors">Avertissement risques</a>
          </nav>
        </div>

        <Section id="cgu" icon={Scale} title="Conditions Générales d'Utilisation">
          <h3>1. Objet</h3>
          <p>
            DONCIEL TM (« le Service ») est une application web de journalisation et d&apos;analyse de
            trading accessible par abonnement. Le Service fournit des outils de suivi, de statistiques
            et d&apos;assistance analytique. Il <strong>ne fournit aucun conseil en investissement</strong>,
            aucune recommandation d&apos;achat ou de vente, et aucune gestion de portefeuille.
          </p>
          <h3>2. Accès au Service</h3>
          <ul>
            <li>Le plan « Découverte » est gratuit, avec des limites d&apos;usage (30 trades/mois, 2 playbooks, 5 analyses IA/mois).</li>
            <li>Les plans payants (Pro, Elite) sont proposés par abonnement mensuel ou annuel, payable via notre prestataire de paiement Stripe.</li>
            <li>L&apos;abonnement est reconduit tacitement jusqu&apos;à résiliation. Tu peux annuler à tout moment depuis ton espace ; l&apos;accès au plan reste actif jusqu&apos;à la fin de la période payée.</li>
          </ul>
          <h3>3. Compte utilisateur</h3>
          <p>
            Tu es responsable de la confidentialité de tes identifiants. Toute activité réalisée via ton
            compte est réputée effectuée par toi. Tu t&apos;engages à fournir des informations exactes et à
            ne pas partager ton compte.
          </p>
          <h3>4. Utilisation acceptable</h3>
          <ul>
            <li>Il est interdit d&apos;utiliser le Service pour des activités illégales, de tenter de contourner les limites de plan, ou d&apos;accéder aux données d&apos;autres utilisateurs.</li>
            <li>Une utilisation abusive (scraping, reverse engineering, revente d&apos;accès) entraîne la suspension immédiate du compte sans remboursement.</li>
          </ul>
          <h3>5. Disponibilité et support</h3>
          <p>
            Nous nous efforçons d&apos;assurer une disponibilité maximale du Service, sans garantie
            d&apos;absence d&apos;interruption (maintenance, dépendances tierces). Le support prioritaire
            est réservé au plan Elite.
          </p>
          <h3>6. Résiliation</h3>
          <p>
            Tu peux supprimer ton compte à tout moment. Nous pouvons suspendre un compte en cas de
            violation des présentes CGU, après notification quand cela est possible.
          </p>
          <h3>7. Droit applicable</h3>
          <p>
            Les présentes CGU sont soumises au droit applicable dans le pays d&apos;établissement de
            l&apos;éditeur. Pour toute question : <strong>doncielkabwe@gmail.com</strong>.
          </p>
        </Section>

        <Section id="confidentialite" icon={Lock} title="Politique de confidentialité">
          <h3>1. Données collectées</h3>
          <ul>
            <li><strong>Données de compte :</strong> email, nom (optionnel), mot de passe (haché avec bcrypt, jamais stocké en clair).</li>
            <li><strong>Données de trading :</strong> les trades, notes, playbooks et captures d&apos;écran que tu saisis — utilisés uniquement pour te fournir le Service.</li>
            <li><strong>Données de facturation :</strong> traitées exclusivement par Stripe. Nous ne voyons ni ne stockons jamais tes coordonnées bancaires complètes.</li>
            <li><strong>Données techniques :</strong> journaux de connexion nécessaires à la sécurité du Service.</li>
          </ul>
          <h3>2. Utilisation</h3>
          <p>
            Tes données servent uniquement à faire fonctionner le Service (affichage de ton journal,
            calcul de tes statistiques, analyses du Coach IA sur TES données). Nous ne vendons
            <strong> jamais</strong> tes données à des tiers.
          </p>
          <h3>3. Hébergement & sécurité</h3>
          <ul>
            <li>Chiffrement en transit (TLS) et au repos sur notre base de données managée.</li>
            <li>Isolation stricte des données par compte utilisateur au niveau applicatif.</li>
            <li>Tokens de session signés (JWT) avec expiration, cookies HttpOnly.</li>
          </ul>
          <h3>4. Tes droits (RGPD)</h3>
          <p>
            Tu peux à tout moment exporter tes données (fonction d&apos;export PDF) ou demander la
            suppression complète de ton compte et de ses données en écrivant à{" "}
            <strong>doncielkabwe@gmail.com</strong>.
          </p>
          <h3>5. Cookies</h3>
          <p>
            Nous utilisons uniquement le cookie de session strictement nécessaire à l&apos;authentification.
            Aucun cookie publicitaire ou de tracking tiers.
          </p>
        </Section>

        <Section id="risques" icon={AlertTriangle} title="Avertissement sur les risques">
          <p className="rounded-xl border border-red-500/30 bg-red-500/[0.06] p-4 text-neutral-200">
            <strong>Le trading comporte un risque élevé de perte en capital.</strong> Les instruments
            financiers (Forex, indices, métaux, CFD, crypto-actifs) sont volatils et peuvent entraîner
            la perte totale des fonds investis. N&apos;investis jamais plus que ce que tu peux te permettre
            de perdre.
          </p>
          <ul>
            <li>DONCIEL TM est un <strong>outil de journalisation et d&apos;analyse</strong>. Il ne constitue ni un conseil en investissement, ni une recommandation personnalisée, ni un service de gestion de portefeuille au sens de la réglementation financière.</li>
            <li>Les statistiques, projections et analyses (y compris celles générées par le Coach IA) sont fournies à titre informatif et <strong>ne garantissent aucune performance future</strong>.</li>
            <li>Les performances passées ne préjugent pas des performances futures. Tes résultats dépendent de tes décisions, de ta discipline et des conditions de marché.</li>
            <li>Tu restes <strong>seul(e) responsable</strong> de tes décisions de trading et de leur conformité avec la réglementation de ton pays de résidence.</li>
          </ul>
        </Section>

        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-neutral-500">
          <Cookie className="w-4 h-4 shrink-0" />
          Ce site n&apos;utilise aucun cookie tiers de tracking. Un seul cookie de session (authentification) est déposé.
        </div>
      </main>

      <footer className="border-t border-white/10 bg-[#070707] mt-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 text-center">
          <p className="text-xs text-neutral-600">© {new Date().getFullYear()} DONCIEL TM. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
