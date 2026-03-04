interface AdminRpcRequest {
  rpcId: string;
  payload: string;
}

interface AdminRpcResponse {
  success?: boolean;
  error?: string | { message?: string };
  data?: unknown;
  [key: string]: unknown;
}

/**
 * Call an admin RPC via Kalpsite API. Throws on HTTP error or when backend returns success: false.
 */
export async function callAdminRpc(rpcId: string, payload: string = '{}'): Promise<AdminRpcResponse> {
  const body: AdminRpcRequest = { rpcId, payload };
  const res = await fetch('/api/admin/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data: AdminRpcResponse = await res.json();
  if (!res.ok) throw new Error(data.error ? String(data.error) : 'Request failed');
  if (data.success === false && data.error) {
    const err = data.error;
    const msg =
      typeof err === 'object' && err !== null && 'message' in err
        ? err.message
        : String(err);
    throw new Error(msg || 'RPC failed');
  }
  return data;
}
