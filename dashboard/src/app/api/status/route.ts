import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        status: 'online',
        service: 'DRISHYAM Orchestration Engine',
        timestamp: new Date().toISOString(),
        region: 'Asia/Kolkata'
    });
}
