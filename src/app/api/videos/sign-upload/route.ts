import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, isAdmin } from '@/lib/auth';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Generate a signed upload payload for client-side Cloudinary upload.
 * This allows the client to upload directly to Cloudinary without
 * sending the file through our server (avoids Vercel body size limits).
 */
export async function POST(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    if (!isAdmin(result.user)) {
      return NextResponse.json(
        { error: 'Accès réservé aux administrateurs' },
        { status: 403 }
      );
    }

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      return NextResponse.json(
        { error: 'Cloudinary non configuré' },
        { status: 503 }
      );
    }

    const { filename, category } = await request.json();

    if (!filename) {
      return NextResponse.json({ error: 'Filename requis' }, { status: 400 });
    }

    // Generate unique public_id
    const ext = filename.split('.').pop() || 'mp4';
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const folder = 'videos';
    const publicId = uniqueId;

    // Generate signature for unsigned upload
    const timestamp = Math.round(new Date().getTime() / 1000);

    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder,
        public_id: publicId,
      },
      CLOUDINARY_API_SECRET
    );

    return NextResponse.json({
      signature,
      timestamp,
      folder,
      publicId,
      apiKey: CLOUDINARY_API_KEY,
      cloudName: CLOUDINARY_CLOUD_NAME,
    });
  } catch (error) {
    console.error('Sign upload error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la signature' },
      { status: 500 }
    );
  }
}
