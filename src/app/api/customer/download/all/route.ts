import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { autoZipGenerator } from '../../../../../../lib/auto-zip-generator'

/**
 * 🎯 DOWNLOAD ALL FILES API
 * 
 * Enligt din specifikation:
 * 1. Returnera befintlig bundle ZIP om den finns
 * 2. Skapa ny bundle ZIP om den inte finns eller är expired
 * 3. Returnera signed URL för direkt nedladdning
 * 4. Kunden får alltid en ren nedladdning, aldrig JSON i browsern
 */

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 === DOWNLOAD ALL FILES REQUEST ===')

    // Parse request
    const { customerId, customerToken } = await request.json()
    
    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verifiera kund (med token eller admin auth)
    const adminPassword = request.headers.get('x-admin-password')
    let isAdmin = adminPassword === 'DronarkompanietAdmin2025!'
    
    if (!isAdmin && !customerToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Hämta kundinformation
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, email, company_name')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    console.log(`📥 Download all request for: ${customer.company_name}`)

    // Kolla om vi har en befintlig bundle
    const existingBundle = await autoZipGenerator.getBundleForCustomer(customerId)
    
    if (existingBundle.exists && existingBundle.bundleUrl) {
      console.log(`♻️ Using existing bundle: ${existingBundle.fileCount} files`)
      
      return NextResponse.json({
        success: true,
        action: 'existing_bundle',
        downloadUrl: existingBundle.bundleUrl,
        customer: customer.company_name,
        fileCount: existingBundle.fileCount,
        bundleSize: existingBundle.bundleSize,
        createdAt: existingBundle.createdAt,
        message: 'Using existing bundle ZIP'
      })
    }

    // Ingen befintlig bundle - skapa ny
    console.log(`🔧 No existing bundle found - creating new one`)
    
    const bundleResult = await autoZipGenerator.createOrUpdateBundleZip(customerId)
    
    if (!bundleResult.success) {
      return NextResponse.json({
        error: 'Failed to create bundle ZIP',
        details: bundleResult.error
      }, { status: 500 })
    }

    console.log(`✅ New bundle created: ${bundleResult.fileCount} files, ${bundleResult.zipSize} bytes`)

    return NextResponse.json({
      success: true,
      action: 'new_bundle_created',
      downloadUrl: bundleResult.bundleUrl,
      customer: customer.company_name,
      fileCount: bundleResult.fileCount,
      bundleSize: bundleResult.zipSize,
      zipSizeMB: Math.round((bundleResult.zipSize || 0) / 1024 / 1024 * 100) / 100,
      message: 'New bundle ZIP created and ready for download'
    })

  } catch (error) {
    console.error('❌ Download all error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * 🎯 GET METHOD - Direkt nedladdning
 * 
 * För att användas med window.location.href = '/api/customer/download/all?customerId=xxx'
 * Redirectar direkt till signed URL för ren nedladdning
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')
    const customerToken = searchParams.get('token')
    
    if (!customerId) {
      return new Response('Customer ID required', { status: 400 })
    }

    console.log(`🎯 Direct download request for customer: ${customerId}`)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verifiera kund
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, company_name')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return new Response('Customer not found', { status: 404 })
    }

    // Kolla om vi har en befintlig bundle
    const existingBundle = await autoZipGenerator.getBundleForCustomer(customerId)
    
    if (existingBundle.exists && existingBundle.bundleUrl) {
      console.log(`♻️ Redirecting to existing bundle for ${customer.company_name}`)
      
      // Redirect direkt till R2 signed URL för ren nedladdning
      return NextResponse.redirect(existingBundle.bundleUrl, 302)
    }

    // Ingen bundle finns - skapa ny i bakgrunden och visa loading page
    console.log(`🔧 No bundle found - creating new one for ${customer.company_name}`)
    
    // Starta bundle creation i bakgrunden
    autoZipGenerator.createOrUpdateBundleZip(customerId).catch((error: Error) => {
      console.error('❌ Background bundle creation failed:', error)
    })

    // Returnera en loading page som refreshar efter några sekunder
    const loadingHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Förbereder nedladdning...</title>
        <meta http-equiv="refresh" content="10">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .loading { color: #007cba; font-size: 18px; }
          .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #007cba; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="spinner"></div>
        <div class="loading">
          🎁 Förbereder din nedladdning...<br>
          Samlar ihop alla filer för ${customer.company_name}<br>
          <small>Sidan uppdateras automatiskt när ZIP:en är klar</small>
        </div>
      </body>
      </html>
    `

    return new Response(loadingHtml, {
      headers: { 'Content-Type': 'text/html' }
    })

  } catch (error) {
    console.error('❌ Direct download error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
