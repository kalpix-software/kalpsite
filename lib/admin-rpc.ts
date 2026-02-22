/**
 * Call an admin RPC via Kalpsite API. Throws on HTTP error or when backend returns success: false.
 */
export async function callAdminRpc(rpcId: string, payload: string = '{}'): Promise<unknown> {
  const res = await fetch('/api/admin/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rpcId, payload }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Request failed');
  if (data && (data as { success?: boolean }).success === false && (data as { error?: unknown }).error) {
    const err = (data as { error: unknown }).error;
    const msg =
      typeof err === 'object' && err !== null && 'message' in err
        ? (err as { message?: string }).message
        : String(err);
    throw new Error(msg || 'RPC failed');
  }
  return data;
}
