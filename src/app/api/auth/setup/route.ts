import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, ADMIN_EMAIL } from '@/lib/auth';

/**
 * POST /api/auth/setup
 * Crée ou réinitialise le compte administrateur désigné (ADMIN_EMAIL).
 *
 * 🔒 VERROU DE SÉCURITÉ (fail-closed) :
 *   - Cette route est DÉSACTIVÉE tant que la variable d'environnement
 *     ADMIN_SETUP_KEY n'est pas définie sur le serveur.
 *   - L'appelant doit fournir { setupKey } strictement égal à ADMIN_SETUP_KEY.
 *   - Aucun mot de passe par défaut : le mot de passe doit être fourni
 *     explicitement dans la requête (jamais codé en dur dans le repo).
 *
 * Procédure officielle de récupération (mot de passe admin oublié) :
 *   1. Vercel → Settings → Environment Variables → ajouter ADMIN_SETUP_KEY
 *      (valeur aléatoire, ex: `openssl rand -hex 16`) → Redeploy.
 *   2. POST /api/auth/setup { email, password, setupKey }.
 *   3. SUPPRIMER ADMIN_SETUP_KEY → Redeploy (la route redevient désactivée).
 *
 * Body: { email?, password, name?, setupKey }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, setupKey } = body;

    // ─── Verrou : clé de configuration obligatoire (fail-closed) ───
    const expectedKey = process.env.ADMIN_SETUP_KEY;
    if (
      !expectedKey ||
      typeof setupKey !== 'string' ||
      setupKey !== expectedKey
    ) {
      return NextResponse.json(
        {
          error:
            'Route désactivée : clé de configuration (ADMIN_SETUP_KEY) manquante ou invalide',
        },
        { status: 403 }
      );
    }

    // Seul l'email administrateur désigné peut être configuré
    const targetEmail = email || ADMIN_EMAIL;
    const targetPassword = password;
    const targetName = name || 'Donciel';

    if (!targetPassword) {
      return NextResponse.json(
        { error: 'Mot de passe requis' },
        { status: 400 }
      );
    }

    if (targetPassword.length < 8) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 8 caractères' },
        { status: 400 }
      );
    }

    // Vérifie s'il existe déjà un administrateur
    const adminCount = await db.user.count({
      where: { role: 'admin' },
    });

    // Si des admins existent déjà, on autorise uniquement l'email admin désigné
    if (adminCount > 0 && targetEmail !== ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Un administrateur existe déjà' },
        { status: 403 }
      );
    }

    const existingUser = await db.user.findUnique({
      where: { email: targetEmail },
    });

    const hashedPassword = await hashPassword(targetPassword);

    if (existingUser) {
      // Met à jour l'utilisateur existant : admin + approuvé + nouveau mot de passe
      const updatedUser = await db.user.update({
        where: { id: existingUser.id },
        data: {
          password: hashedPassword,
          role: 'admin',
          status: 'approved',
          name: targetName,
        },
      });

      return NextResponse.json({
        message: 'Administrateur mis à jour avec succès',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          status: updatedUser.status,
        },
      });
    } else {
      // Crée un nouveau compte administrateur
      const newUser = await db.user.create({
        data: {
          email: targetEmail,
          password: hashedPassword,
          name: targetName,
          role: 'admin',
          status: 'approved',
        },
      });

      return NextResponse.json(
        {
          message: 'Administrateur créé avec succès',
          user: {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            role: newUser.role,
            status: newUser.status,
          },
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la configuration' },
      { status: 500 }
    );
  }
}
