import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    // Admin auth check
    const adminPassword = request.headers.get('x-admin-password');
    if (adminPassword !== 'DronarkompanietAdmin2025!') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    
    if (!customerId) {
      return NextResponse.json({ error: 'customerId required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check for active background jobs (using prebuilt_zips for tracking)
    const { data: jobData, error: jobError } = await supabase
      .from('prebuilt_zips')
      .select('*')
      .eq('customer_id', customerId)
      .ilike('zip_path', 'jobs/%')
      .order('created_at', { ascending: false })
      .limit(1);

    if (jobError) {
      console.error('Error checking background jobs:', jobError);
    }

    // Check for existing prebuilt ZIP (actual ZIPs, not job tracking)
    const { data: zipData, error: zipError } = await supabase
      .from('prebuilt_zips')
      .select('*')
      .eq('customer_id', customerId)
      .not('zip_path', 'ilike', 'jobs/%')
      .order('created_at', { ascending: false })
      .limit(1);

    if (zipError) {
      console.error('Error checking prebuilt zips:', zipError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Get customer info
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .select('company_name, total_files, total_size')
      .eq('id', customerId)
      .single();

    if (customerError) {
      console.error('Error fetching customer:', customerError);
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const latestJob = jobData?.[0];
    const latestZip = zipData?.[0];

    // Check if we have a recent successful ZIP
    const now = new Date();
    const zipAge = latestZip ? (now.getTime() - new Date(latestZip.created_at).getTime()) / (1000 * 60 * 60) : null; // hours

    let status = 'no_zip';
    let message = 'No ZIP available';
    let jobStatus = null;

    if (latestJob) {
      const jobAge = (now.getTime() - new Date(latestJob.created_at).getTime()) / (1000 * 60); // minutes
      
      if (jobAge < 60) { // Job is less than 1 hour old
        if (latestJob.file_count > 0 && latestJob.zip_size > 0) {
          jobStatus = 'completed';
          status = 'job_completed';
          message = `Background job completed! ZIP should be ready.`;
        } else {
          jobStatus = 'running';
          status = 'job_running';
          const elapsed = Math.round(jobAge);
          message = `Background job still running... (${elapsed} minutes elapsed)`;
        }
      }
    }

    if (latestZip && zipAge !== null && zipAge < (7 * 24)) { // Less than 7 days old
      if (status === 'no_zip' || status === 'job_completed') {
        status = 'zip_available';
        message = `ZIP available! Created ${Math.round(zipAge * 10) / 10} hours ago`;
      }
    }

    return NextResponse.json({
      success: true,
      customerId,
      customer: customerData.company_name,
      totalFiles: customerData.total_files,
      totalSize: customerData.total_size,
      status,
      message,
      jobStatus,
      latestJob: latestJob ? {
        id: latestJob.id,
        zipPath: latestJob.zip_path,
        fileCount: latestJob.file_count,
        zipSize: latestJob.zip_size,
        createdAt: latestJob.created_at,
        builtAt: latestJob.built_at
      } : null,
      latestZip: latestZip ? {
        id: latestZip.id,
        fileCount: latestZip.file_count,
        zipSize: latestZip.zip_size,
        downloadUrl: latestZip.download_url,
        createdAt: latestZip.created_at,
        expiresAt: latestZip.expires_at
      } : null,
      zipAge: zipAge ? `${Math.round(zipAge * 10) / 10} hours` : null
    });

  } catch (error) {
    console.error('ZIP status check error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
