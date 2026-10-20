export async function verifyTurnstile(token: string, secret: string, ip?: string): Promise<boolean> {
  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  if (ip) {
    formData.append('remoteip', ip);
  }

  try {
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const outcome = await result.json() as { success: boolean; 'error-codes': string[] };
    if (!outcome.success) {
      console.warn('[turnstile] verification failed:', outcome['error-codes']);
    }
    return outcome.success;
  } catch (err) {
    console.error('[turnstile] verification request error:', err);
    return false;
  }
}
