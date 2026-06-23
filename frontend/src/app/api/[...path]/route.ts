import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_API_URL || '';
const BACKEND_TOKEN = process.env.BACKEND_API_TOKEN || '';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await context.params;
  const path = resolvedParams.path.join('/');
  const searchParams = req.nextUrl.searchParams.toString();

  const targetUrl = `${BACKEND_URL}/${path}${searchParams ? `?${searchParams}` : ''}`;

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': BACKEND_TOKEN,
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error('[API Proxy GET] Error:', err);
    return NextResponse.json(
      { status: 'error', message: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await context.params;
  const path = resolvedParams.path.join('/');
  const body = await req.json().catch(() => ({}));

  const targetUrl = `${BACKEND_URL}/${path}`;

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': BACKEND_TOKEN,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error('[API Proxy POST] Error:', err);
    return NextResponse.json(
      { status: 'error', message: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
