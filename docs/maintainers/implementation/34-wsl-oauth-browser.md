# 34 – OAuth Browser Handshake from WSL2

## Overview

This note documents the recommended pattern for interactive OAuth/OIDC flows initiated from the mcpcontract CLI when it runs inside Windows Subsystem for Linux 2 (WSL2). The goal is to mirror the behaviour of tools such as `az`, `gh`, and `gcloud`: launch the native Windows default browser, wait for the redirect, and resume the CLI execution once authorization completes.

## Design Goals

- Always open the Windows default browser from WSL2.
- Listen for the authorization response on a loopback HTTP listener running inside the CLI.
- Preserve PKCE, state, and other OAuth best practices already implemented in the CLI.
- Keep the solution cross-platform with minimal WSL-specific branches.

## Browser Launch Strategy

Use `explorer.exe` as the launcher whenever the CLI detects that it is running under WSL2.

```ts
import { spawn } from 'node:child_process';

export function openBrowser(url: string): void {
  spawn('explorer.exe', [url], {
    stdio: 'ignore',
    detached: true,
  }).unref();
}
```

Key properties:

- Delegates to Windows, ensuring the user’s default browser handles the URL.
- Runs detached and unreferenced so the CLI process continues without blocking.
- Works reliably for all Chromium/Edge/Firefox variants installed on the host OS.

## OAuth Callback Listener

Run a loopback HTTP listener inside the CLI. Windows browsers can reach `127.0.0.1:<port>` thanks to the WSL network bridge, so no additional routing is required.

```ts
import { createServer } from 'node:http';

export function waitForAuth({ port = 0, path = '/callback' } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (!req.url?.startsWith(path)) {
        res.writeHead(404).end();
        return;
      }

      const url = new URL(req.url, `http://127.0.0.1:${address.port}`);
      const code = url.searchParams.get('code');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Authentication successful</h1>You can close this window.');

      server.close();
      resolve(code ?? '');
    });

    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Authentication timed out'));
    }, 2 * 60 * 1000);

    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        clearTimeout(timeout);
        reject(new Error('Failed to bind loopback listener'));
      }
    });

    server.on('close', () => clearTimeout(timeout));
    server.on('error', reject);
  });
}
```

Notes:

- Binding to `127.0.0.1` allows Windows browsers to reach the listener.
- Using port `0` requests an ephemeral port; capture `server.address().port` and feed it into the authorization URL’s redirect URI.
- Implement a short timeout (2–5 minutes) to avoid orphaned listeners.

## Complete Flow Skeleton

```ts
const redirectHost = '127.0.0.1';
const redirectPort = await pickPort(); // optional helper wrapping the listener
const redirectUri = `http://${redirectHost}:${redirectPort}/callback`;

const authorizationUrl = buildAuthorizationUrl(configuration, {
  scope,
  resource,
  code_challenge,
  code_challenge_method: 'S256',
  redirect_uri: redirectUri,
  state,
});

overrideBrowserLaunchIfWSL(authorizationUrl); // uses explorer.exe
const authorizationCode = await waitForAuth({ port: redirectPort });

await exchangeCodeForTokens({ authorizationCode, redirectUri, resource });
```

`overrideBrowserLaunchIfWSL` should delegate to `explorer.exe` when:

- `process.platform === 'linux'`, **and**
- `process.env.WSL_DISTRO_NAME` or `process.env.WSL_INTEROP` is present, or `/proc/version` contains `Microsoft`.

Outside WSL2 keep the existing macOS (`open`), Windows (`start`), and Linux (`xdg-open`) branches.

## Security Considerations

- Continue using PKCE (`code_challenge_method=S256`) and random `state` values.
- Use masked logging for received tokens when verbose logging is enabled.
- Persist encrypted tokens via the existing AES-256-GCM storage.

## Roll-out Checklist

1. Add WSL detection helper and launch `explorer.exe` when true.
2. Keep `--no-browser` support for headless environments.
3. Document the WSL behaviour in the CLI help and tutorials.
4. Add integration verification in manual test script (`tests/run-manual-tests.sh`).

## References

- Microsoft: *WSL Interop Guidelines* – confirms `explorer.exe` access from WSL.
- OAuth 2.0 for Native Apps (RFC 8252) – recommends loopback interface listeners.
- Examples: Azure CLI, GitHub CLI, Google Cloud CLI.
