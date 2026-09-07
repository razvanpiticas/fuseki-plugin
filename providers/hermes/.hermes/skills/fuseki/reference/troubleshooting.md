# When it does not work

Run the checks in order. The first two are cheap and settle most cases.

| # | Check | Proves |
| --- | --- | --- |
| 1 | Call `server_info` | Separates "unreachable or not signed in" from "signed in, call refused" |
| 2 | Open `https://mcp.fuseki.dev/health` in a browser | The deployment is up. It answers `{"status":"healthy"}` anonymously |
| 3 | Call `project_management_health` | This server can reach ProjectManagement and be accepted by it |
| 4 | Call `demonstrate_refusal` with `forbidden` | The refusal path renders correctly in this harness |

## Symptom index

| Symptom | Cause | Fix |
| --- | --- | --- |
| Browser shows a redirect-uri mismatch during sign-in | The callback port in this harness's config is not one the realm registers | Use port `8123`, or register the port you used on `fuseki-public-client` |
| Sign-in never opens a browser, or fails naming client registration | The harness is trying dynamic client registration, which this realm refuses | The harness must be told to use client id `fuseki-public-client`. A harness with no field for it cannot sign in to this server |
| Every tool answers 401 | No token, or an expired one | Sign in again. If it recurs immediately, the token's audience does not name this server |
| Every tool answers 403 | The account belongs to no tenant, or has neither permission | Grant a role carrying `mcp:tools.read` on the roles screen, then sign in again |
| Reads work, `create_item` answers 403 | The account has `mcp:tools.read` but not `mcp:tools.write` | Grant the write permission, then sign in again — the old token does not gain it |
| A permission was granted but the call still answers 403 | The token was minted before the grant | Sign out fully and back in. Refreshing is not enough |
| `list_items` returns an empty list | The pod restarted. The sample list lives in memory | Working as designed. It is scaffolding, not a catalogue |
| `project_management_health` refuses, naming an address | ProjectManagement holds nothing at that path | A server-side routing fault. Report the address it named |
| `server_info` answers but names a different deployment | The harness is pointed at another host | Check the URL in this harness's MCP config |
| Tools are missing entirely from the session | The MCP server is configured but not loaded | Reload the harness. Most do not pick up a new server mid-session |

## The one that is not a fault

A caller who belongs to no tenant gets 403 on every tool, including `server_info`. That is the
tenant isolation working, not a broken deployment. The fix is joining a tenant, not changing
anything about the server or the client.

## What this cannot tell you

If `/health` answers and `server_info` still fails for every account in every harness, the problem
is in the deployment rather than in any client — the realm, the ingress route, or the token
audience. That is a change in `src/services/Mcp/`, not here.
