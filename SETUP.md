# Getting this repo onto a server, first time

Written for someone who has committed locally but never pushed.

## What these words mean

**Commit** — a saved snapshot of every file, with a message. You made one. It
lives only on your Mac, inside the hidden `.git` folder in this directory.

**Remote** — a copy of the repo on a server, so other people can reach it. The
conventional name for the main one is `origin`. It is just a nickname for a URL.

**Push** — upload your commits to the remote. **Pull** — download theirs.

**Branch** — a line of commits. Yours is called `main`.

Nothing is uploaded anywhere until you explicitly push. Committing is private.

## What you already have

| | |
|---|---|
| Git installed | yes, 2.50.1 |
| Commit identity | Arsal Idrees, arsal.idrees@arbisoft.com |
| SSH key | yes, ed25519 |
| Key registered with GitHub | yes, as `arsalidrees-a11y` |
| Commits | 1 |
| Remote | none yet |

The SSH key is the part that usually takes people an afternoon. Yours works
already, which is why the steps below are short.

## Step 0, decide where it lives

This is client work for Uber, done by Arbisoft. `arsalidrees-a11y` is a
personal GitHub account. Before creating anything, ask whoever runs engineering
at Arbisoft whether this belongs in an Arbisoft organization instead.

Moving a repo later is possible but annoying, and client intellectual property
sitting in a personal account is the kind of thing that surfaces awkwardly in a
security review. Two minutes of asking now is worth it.

If the answer is "personal for now", that is fine. Carry on.

## Step 1, commit what is outstanding

    git status
    git add -A
    git commit -m "your message"

`git status` first, always. It tells you what is about to be included.

## Step 2, create an empty repo on GitHub

In the browser, go to https://github.com/new and set:

- **Repository name**: `uber`
- **Visibility**: **Private**. Not public. This carries Uber brand tokens.
- **Initialize with a README**: leave every one of these **unticked**. You
  already have files. Adding a README there creates a conflicting first commit
  and your first push gets rejected.

Click Create repository. You now have an empty repo and GitHub shows you a page
of setup commands. You can ignore that page; use the steps below.

## Step 3, connect your local repo to it

    git remote add origin git@github.com:arsalidrees-a11y/uber.git

Replace the account name if you created it under an organization. Use the
`git@github.com:` form, not `https://`. The SSH form uses the key you already
have. The HTTPS form would ask for a token you do not have.

Check it took:

    git remote -v

## Step 4, push

    git push -u origin main

`-u` links your local `main` to the remote `main`, so from then on plain
`git push` is enough. You only pass `-u` once.

## Step 5, confirm

Reload the repo page in the browser. You should see the files. Also:

    git status

"Your branch is up to date with 'origin/main'" means it worked.

## The everyday loop after this

    git status
    git add -A
    git commit -m "what changed"
    git push

That is the whole thing. Commit often with small messages; it costs nothing and
gives you points to go back to.

## If something goes wrong

**"Repository not found"** — the repo does not exist at that URL, or the name is
misspelled, or it is under a different account. Check `git remote -v` against the
browser URL.

**"Updates were rejected"** — the remote has a commit you do not (usually a
README added at creation). Run `git pull --rebase origin main`, then push again.

**"Permission denied (publickey)"** — the key is not registered with that
account. Test with `ssh -T git@github.com`; it should greet you by username.

**Wrong remote URL** — fix rather than delete:

    git remote set-url origin git@github.com:CORRECT/PATH.git

## Giving the engineers access

On the repo page: Settings, then Collaborators, then add them by GitHub
username. For an organization repo, add a team instead of individuals.

They then clone with:

    git clone git@github.com:arsalidrees-a11y/uber.git

and run `npm install` followed by `npm run check`. Everything else, including
the skills and the lint hook, comes with the repo.
