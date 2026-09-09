# When it does not work

Run the checks in order. The first two are cheap and settle most cases.

| # | Check | Proves |
| --- | --- | --- |
| 1 | Call `server_info` | Separates "unreachable or not signed in" from "signed in, call refused" |
| 2 | Open `https://mcp.fuseki.dev/health` in a browser | The deployment is up. It answers `{"status":"healthy"}` anonymously |
| 3 | Call `list_projects` | This server can reach ProjectManagement, is accepted by it, and the caller can see something |
| 4 | Call `get_project` with a key nobody has, such as `ZZZZ` | The refusal path renders in this harness. It answers `CONFLICT`, not a not-found — see below |

## Symptom index

| Symptom | Cause | Fix |
| --- | --- | --- |
| Browser shows a redirect-uri mismatch during sign-in | The callback port in this harness's config is not one the realm registers | Use port `8123`, or register the port you used on `fuseki-agent-client` |
| Sign-in never opens a browser, or fails naming client registration | The harness is trying dynamic client registration, which this realm refuses | The harness must be told to use client id `fuseki-agent-client`. A harness with no field for it cannot sign in to this server |
| Every tool answers 401 | No token, or an expired one | Sign in again. If it recurs immediately, the token's audience does not name this server |
| Every tool answers 403 | The account belongs to no tenant, or has neither permission | Grant a role carrying `mcp:tools.read` on the roles screen, then sign in again |
| Reads work, every write answers `FORBIDDEN` | The account has `mcp:tools.read` but not `mcp:tools.write` | Grant the write permission, then sign in again — the old token does not gain it |
| A write answers `FORBIDDEN` naming a `project-management:` permission | The MCP write permission is held and the product one is not. They are separate grants | Grant the permission the tool's description names, then sign in again |
| Every write answers `FORBIDDEN` saying the organisation is in read-only mode | The subscription lapsed. Reads still work | Start or renew a plan on the billing screen. Nothing is deleted and nothing is hidden |
| A permission was granted but the call still answers 403 | The token was minted before the grant | Sign out fully and back in. Refreshing is not enough |
| `list_projects` answers an empty list on an organisation that has projects | The caller is on none of them and does not hold the permission that sees every one | Working as designed. Add them to a project, or grant `project-management:projects.read-all` |
| A named project, item or sprint answers `CONFLICT` rather than a not-found | Fuseki never answers 404. A thing that is missing and a thing the caller may not see answer identically, on purpose | Check the key or code. If it is right, the caller cannot see it — the two are not distinguishable by design |
| A write answers `CONFLICT` naming a version | Somebody changed the item between the read and the write | Read the item as the refusal carries it, decide again from that, and write against the version the refusal names |
| `server_info` answers but names a different deployment | The harness is pointed at another host | Check the URL in this harness's MCP config |
| Tools are missing entirely from the session | The MCP server is configured but not loaded | Reload the harness. Most do not pick up a new server mid-session |

## The one that is not a fault

A caller who belongs to no tenant gets 403 on every tool, including `server_info`. That is the
tenant isolation working, not a broken deployment. The fix is joining a tenant, not changing
anything about the server or the client.

A refusal that says nothing answers to a name is also not a fault. Fuseki gives one answer for "no
such project" and "not your project", deliberately, so that being refused cannot be used to map an
organisation. There is no way to tell them apart from the client, and looking for one is looking for
something the product will not give.

## What this cannot tell you

If `/health` answers and `server_info` still fails for every account in every harness, the problem
is in the deployment rather than in any client — the realm, the ingress route, or the token
audience. That is a change in `src/services/Mcp/`, not here.
