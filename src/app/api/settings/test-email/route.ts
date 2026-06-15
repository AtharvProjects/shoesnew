import { NextResponse } from 'next/server';
import db from '@/lib/db';
import nodemailer from 'nodemailer';

export async function POST() {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const s: Record<string, string> = {};
    for (const r of rows) s[r.key] = r.value;

    if (!s.gmail_user || !s.gmail_app_password) {
      return NextResponse.json({ error: 'Please save Gmail Email and App Password first.' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: s.gmail_user, pass: s.gmail_app_password },
    });

    await transporter.sendMail({
      from: s.gmail_user,
      to: s.low_stock_email || s.gmail_user,
      subject: 'Gajraj Billing - SMTP Test Connection',
      html: `
        <h3>SMTP Connection Successful!</h3>
        <p>This is a test email from your Gajraj Billing Software.</p>
        <p>Your Google SMTP module is configured correctly and ready to send low-stock alerts.</p>
        <br/>
        <p>Sent at: ${new Date().toLocaleString()}</p>
      `,
    });

    return NextResponse.json({ message: 'Test email sent successfully! Check your inbox.' });
  } catch (error: any) {
    console.error('SMTP Test Error:', error);
    return NextResponse.json({ error: error.message || 'SMTP Authentication failed. Double check your App Password.' }, { status: 500 });
  }
}
