import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    env: {
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'not set',
      VERCEL_URL: process.env.VERCEL_URL || 'not set',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'configured' : 'not set',
      AUTH_SECRET: process.env.AUTH_SECRET ? 'configured' : 'not set',
      DATABASE_URL_SET: process.env.DATABASE_URL ? 'configured' : 'not set',
    }
  }

  try {
    const session = await auth()
    diagnostics.session = session ? {
      authenticated: true,
      user: session.user,
    } : {
      authenticated: false,
    }
  } catch (err: any) {
    diagnostics.sessionError = err.message || err
  }

  try {
    const tenantsCount = await prisma.tenant.count()
    diagnostics.database = {
      connected: true,
      tenantsCount,
    }
  } catch (err: any) {
    diagnostics.databaseError = err.message || err
  }

  return NextResponse.json(diagnostics)
}
