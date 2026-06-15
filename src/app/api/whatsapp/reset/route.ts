import { NextResponse } from 'next/server';
import { resetWhatsApp } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await resetWhatsApp();
    return NextResponse.json({ success: true, message: 'WhatsApp forcibly reset' });
  } catch (error) {
    console.error('Error resetting WhatsApp:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
