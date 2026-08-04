export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  if (url.searchParams.has('code')) {
    const code = url.searchParams.get('code');
    const clientId = context.env.GITHUB_CLIENT_ID;
    const clientSecret = context.env.GITHUB_CLIENT_SECRET;

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
      }),
    });

    const data = await response.json();

    if (data.access_token) {
      return new Response(
        `<script>
          window.opener.postMessage({
            type: 'authorization:github:success:${data.access_token}',
            payload: { token: '${data.access_token}' }
          }, '*');
          window.close();
        </script>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
  }

  return new Response('Authorization failed', { status: 401 });
}
