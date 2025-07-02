import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// === GET: Return all restaurants from user's institute ===
export async function GET(req) {
    try {

        const db = (await clientPromise).db();

        const institutes = await db.collection('institutes').find({}).toArray();
        const cuisines = await db.collection('cuisines').find({}).toArray();

        return NextResponse.json({ institutes, cuisines }, { status: 200 });

    } catch (err) {
        console.error(err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}


// === CORS ===
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
