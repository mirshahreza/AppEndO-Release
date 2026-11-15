# Server deploy config (RCUT-9)

Copy **deploy.target.example.json** to **deploy.target.local.json** in **this publish repo** (AppEndO-Release or AppEndO-Hawiety).

- `deployRoot` — production filesystem root (UNC or local path on the server)
- `publicUrl` — optional public URL for smoke checks

`deploy.target.local.json` is preserved across release pushes and must not be committed.
