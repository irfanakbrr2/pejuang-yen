export async function hasMxRecords(domain: string): Promise<boolean> {
  try {
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=MX`, {
      headers: { 'Accept': 'application/dns-json' }
    });
    
    if (!response.ok) {
      // If DNS check fails, assume true to not accidentally block users
      return true;
    }
    
    const data = await response.json() as { Answer?: unknown[] };
    return Array.isArray(data.Answer) && data.Answer.length > 0;
  } catch (error) {
    console.error('Error checking MX records:', error);
    // On error, let them pass to prevent blocking real users
    return true;
  }
}
