# 🔐 SECURITY — Actions de sécurité & configuration

## ⚠️ Incident du 2026 — À traiter immédiatement

Un fichier `.env` contenant `DATABASE_URL` (identifiants PostgreSQL Neon complets)
a été commité dans un dépôt **public**. Le fichier est désormais non suivi, mais
**l'historique git conserve les anciennes versions**.

### Checklist de remédiation

- [ ] **1. Rotation des identifiants Neon** (CRITIQUE) :
      console.neon.tech → Dashboard → Reset password → copier la nouvelle
      `DATABASE_URL` dans Vercel → Redeploy.
- [ ] **2. Définir `JWT_SECRET`** dans Vercel (32+ caractères) :
      `openssl rand -hex 32` → Vercel → Environment Variables → Redeploy.
- [ ] **3. Purger l'historique git** (après les rotations, quand les secrets
      sont morts) :

```bash
# Avec git-filter-repo (recommandé) :
pip install git-filter-repo
git clone --no-local . ../donciel-tm-clean
cd ../donciel-tm-clean
git filter-repo --invert-paths --path .env
# Puis force-push (coordination avec tous les contributeurs) :
git remote add origin <url> && git push origin --force --all
```

  Alternativement, l'outil BFG Repo-Cleaner fait la même chose.
  ⚠️ Le force-push réécrit tous les SHA — prévenir les collaborateurs.

- [ ] **4. Vérifier les captures d'écran commitées** (`*.png` à la racine) :
      elles peuvent contenir de vraies données de trading. À supprimer si
      sensibles :
      `git rm --cached *.png` + commit.
- [ ] **5. Activer la protection de branche** sur `main`
      (Settings → Branches → Require PR before merge).
- [ ] **6. Régénérer / révoquer les tokens GitHub** partagés temporairement.

## Configuration sécurité du SaaS

| Variable | Rôle | Notes |
|---|---|---|
| `JWT_SECRET` | Signature des sessions | **Obligatoire**, l'app refuse de démarrer sans |
| `DATABASE_URL` | Base PostgreSQL | Rotation régulière recommandée |
| `AUTO_APPROVE_REGISTRATIONS` | `false` pour revenir au mode « approbation admin » | Défaut : SaaS self-service |
| `STRIPE_WEBHOOK_SECRET` | Vérifie l'authenticité des webhooks Stripe | Ne jamais désactiver la vérification |

## Bonnes pratiques en vigueur dans ce dépôt

- Mots de passe hashés avec bcrypt (coût 12)
- Tokens de réinitialisation stockés **hachés** (SHA-256), usage unique, expiry 1 h
- Réponses « génériques » sur forgot-password (pas d'énumération d'emails)
- Isolation multi-tenant : chaque requête API filtre par `userId` de session
- Webhook Stripe vérifié par signature (raw body)
- Limites de plan appliquées **côté serveur** (jamais uniquement côté client)
