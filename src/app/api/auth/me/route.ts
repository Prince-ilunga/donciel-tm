import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    const result = await getAuthUser();

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        language: result.user.language,
        status: result.user.status,
      },
    });
  } catch (error) {
    console.error('Me error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'utilisateur' },
      { status: 500 }
    );
  }
}
