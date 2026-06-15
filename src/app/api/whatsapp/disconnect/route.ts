import { NextResponse } from 'next/server';
import { logoutWhatsApp } from '@/lib/whatsapp';

export async function POST() {
  try {
    await logoutWhatsApp();
    return NextResponse.json({ success: true, message: 'Disconnected' });
  } catch (error) {
    console.error('Error disconnecting WhatsApp:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
