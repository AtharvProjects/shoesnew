import { NextResponse } from 'next/server';
import { getWhatsAppStatus } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = getWhatsAppStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Error fetching WhatsApp status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
