# Security Policy

## This is a local app

Unseen runs on your machine. It stores API keys in `auth.json`, optional
session cookies in `.auth/`, watch history in `data/`, and uploaded CSVs in
`data/uploads/`. Those paths are gitignored on purpose. Do not commit them.

## Supported versions

Security fixes land on `main`. There are no versioned release branches yet.

## Reporting a vulnerability

Please **do not** open a public issue for anything that could expose:

- API keys or tokens
- Netflix or Amazon session cookies
- watch-history files
- a way to read another user's local data if this app were ever deployed

Use [GitHub private vulnerability reporting](https://github.com/mikesterific/unwatched-movies/security/advisories/new)
if it is enabled, or contact [@mikesterific](https://github.com/mikesterific).

You should hear back within a week. If the report is accepted, we will fix it
on `main` and credit you unless you ask otherwise.

## What this project will not do

- Scrape Netflix, Prime Video, Disney+, or Max catalogs or hidden APIs
- Accept or store account passwords in the CLI or web UI
- Publish sample fixtures that contain real viewing history
