import { NextRequest, NextResponse } from 'next/server'
import { r2Client } from '../../../../../lib/cloudflare-r2'
import { PutBucketCorsCommand, GetBucketCorsCommand } from '@aws-sdk/client-s3'

export async function POST(request: NextRequest) {
  try {
    console.log('=== SETTING UP CORS FOR R2 BUCKET ===')
    
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME!
    
    // CORS-konfiguration som tillåter direktuppladdning från webbläsare
    const corsConfiguration = {
      CORSRules: [
        {
          ID: 'dk-leverans-cors',
          AllowedHeaders: ['*'],
          AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
          AllowedOrigins: [
            'http://localhost:3000',
            'https://dk-leverans.vercel.app',
            'https://dk-leverans-*.vercel.app',
            'https://*.vercel.app',
            'https://dk-leverans-hgawwdxbo-olivers-projects-c8f86ed6.vercel.app',
            '*' // Allow all origins temporarily for testing
          ],
          ExposeHeaders: ['ETag'],
          MaxAgeSeconds: 3000
        }
      ]
    }
    
    console.log('Setting CORS configuration for bucket:', bucketName)
    console.log('CORS rules:', JSON.stringify(corsConfiguration, null, 2))
    
    // Sätt CORS-konfiguration
    const putCorsCommand = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: corsConfiguration
    })
    
    await r2Client.send(putCorsCommand)
    console.log('✅ CORS configuration set successfully')
    
    // Hämta och verifiera CORS-konfiguration
    const getCorsCommand = new GetBucketCorsCommand({
      Bucket: bucketName
    })
    
    const corsResult = await r2Client.send(getCorsCommand)
    console.log('📋 Current CORS configuration:', JSON.stringify(corsResult.CORSRules, null, 2))
    
    return NextResponse.json({
      success: true,
      message: 'CORS configuration updated successfully',
      corsConfiguration: corsResult.CORSRules
    })
    
  } catch (error) {
    console.error('❌ Failed to set CORS configuration:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to set CORS configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('=== GETTING CORS CONFIGURATION ===')
    
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME!
    
    const getCorsCommand = new GetBucketCorsCommand({
      Bucket: bucketName
    })
    
    const corsResult = await r2Client.send(getCorsCommand)
    console.log('📋 Current CORS configuration:', JSON.stringify(corsResult.CORSRules, null, 2))
    
    return NextResponse.json({
      success: true,
      corsConfiguration: corsResult.CORSRules
    })
    
  } catch (error) {
    console.error('❌ Failed to get CORS configuration:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get CORS configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
