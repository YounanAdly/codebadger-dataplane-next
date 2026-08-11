import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

// ... هنا سنقوم باستيراد منطق المراجعة من `src/lib/`
import { handleWebhook } from '@/lib/webhook-handler';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256') || '';
    const event = req.headers.get('x-github-event') || '';

    // التحقق من التوقيع (إذا كان WEBHOOK_SECRET مضبوطاً)
    if (WEBHOOK_SECRET) {
      const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
      const digest = `sha256=${hmac.update(rawBody).digest('hex')}`;
      if (signature !== digest) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);

    // استدعاء معالج المراجعة
    const result = await handleWebhook({
      event,
      payload,
      headers: Object.fromEntries(req.headers),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[webhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}