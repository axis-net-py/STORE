import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

// Diagnóstico restrito: exige sessão SOVEREIGN e não expõe detalhes de ambiente
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if ((session.user as any).role !== 'SOVEREIGN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    env: {
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET ? 'configured' : 'not set',
      DATABASE_URL: process.env.DATABASE_URL ? 'configured' : 'not set',
    },
    session: { authenticated: true, email: session.user.email },
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    diagnostics.database = { connected: true }
  } catch (err: any) {
    diagnostics.database = { connected: false, error: err.message || String(err) }
  }

  return NextResponse.json(diagnostics)
}
