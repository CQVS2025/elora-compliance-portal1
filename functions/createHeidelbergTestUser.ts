import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin access
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Invite test user with Heidelberg email
    await base44.users.inviteUser('test@heidelberg.com.au', 'user');

    return Response.json({ 
      success: true, 
      message: 'Test user invited! Check test@heidelberg.com.au inbox for invitation link.'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});