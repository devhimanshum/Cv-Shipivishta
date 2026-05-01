import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  return NextResponse.json({
    NEXT_PUBLIC_FIREBASE_API_KEY: apiKey
      ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)} (length: ${apiKey.length})`
      : 'MISSING ❌',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'MISSING ❌',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'MISSING ❌',
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
      ? `set ✅ (length: ${process.env.NEXT_PUBLIC_FIREBASE_APP_ID.length})`
      : 'MISSING ❌',
    FIREBASE_ADMIN_PROJECT_ID: process.env.FIREBASE_ADMIN_PROJECT_ID || 'MISSING ❌',
    FIREBASE_ADMIN_CLIENT_EMAIL: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || 'MISSING ❌',
    FIREBASE_ADMIN_PRIVATE_KEY: process.env.FIREBASE_ADMIN_PRIVATE_KEY
      ? `set ✅ (length: ${process.env.FIREBASE_ADMIN_PRIVATE_KEY.length})`
      : 'MISSING ❌',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY
      ? `set ✅ (length: ${process.env.OPENAI_API_KEY.length})`
      : 'MISSING ❌',
    NODE_ENV: process.env.NODE_ENV,
  });
}
