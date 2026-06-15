import { NextResponse } from 'next/server';
import { initWhatsApp } from '@/lib/whatsapp';

export async function POST() {
  try {
    await initWhatsApp();
    return NextResponse.json({ success: true, message: 'Initialization started' });
  } catch (error) {
    console.error('Error starting WhatsApp initialization:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
