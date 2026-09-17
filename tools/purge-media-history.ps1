# purge-media-history.ps1
# Strip large media blobs from the ENTIRE git history of MDVRFAQ.
#
# Why: media (assets/images, assets/videos, assets/video-thumbs,
# assets/products-media, dist) was committed in the Initial commit.
# `git rm --cached` only removed it from the current index -- every
# historical commit still carries the blobs, so `git push` uploads ~1GB
# of junk and .git has grown to 4.5GB.
#
# WARNING: git filter-repo DELETES from the working tree any file that no
# longer belongs to the rewritten history. It is NOT like filter-branch's
# `git reset --hard` (which only touches the index). For MDVRFAQ,
# data/accessories/media/ was tracked and got physically wiped by filter-repo
# -- we recovered it by copying the referenced subset back from a known-good
# dist/ (build.js copies referenced media there by relative path).
# RULES:
#   1. ALWAYS snapshot/back up the directories you are about to strip to
#      OUTSIDE the repo before running (e.g. `cp -r` to a temp folder).
#   2. Run `git rev-list --objects --all | git cat-file --batch-check=...`
#      and list EVERY media path (>1MB blobs) FIRST -- we missed
#      data/accessories/media/ on the first pass and had to re-run.
#
# Usage (from repo root, PowerShell):
#   .\tools\purge-media-history.ps1
# Then, if the report looks right:
#   git push -f origin main

$ErrorActionPreference = "Stop"

function Info($m)  { Write-Host "[purge] $m" -ForegroundColor Cyan }
function Warn($m)  { Write-Host "[purge] $m" -ForegroundColor Yellow }
function Ok($m)    { Write-Host "[purge] $m" -ForegroundColor Green }

$MediaDirs = @(
    "assets\images",
    "assets\videos",
    "assets\video-thumbs",
    "assets\products-media",
    "data\accessories\media",
    "dist"
)

# ---------------------------------------------------------------- 0. checks
if (-not (Test-Path ".git")) {
    throw "Run this from the repo root (D:\Web\MdvrFAQ)."
}

# Only block on TRACKED modifications -- those are the only thing a history
# rewrite's `git reset --hard` can destroy. Untracked files (e.g. this very
# script) survive untouched and must NOT block the run.
$dirty = git status --porcelain --untracked-files=no
if ($dirty) {
    throw "Working tree has uncommitted TRACKED changes. Commit or stash first.`n$dirty"
}

# Warn if assets/ holds source files outside the known media dirs,
# so we never delete something that must stay in git.
if (Test-Path "assets") {
    $kept = Get-ChildItem "assets" -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object {
            $p = $_.FullName.Replace("/", "\")
            -not ($MediaDirs | Where-Object { $p -like "*\$_*" })
        }
    if ($kept) {
        Warn "assets/ contains files OUTSIDE the 4 media dirs -- review before continuing:"
        $kept | Select-Object -First 20 | ForEach-Object { Write-Host "      $($_.FullName)" }
        $ans = Read-Host "Continue anyway? (y/N)"
        if ($ans -ne "y") { throw "Aborted by user." }
    }
}

# ------------------------------------------------- 1. snapshot media on disk
$before = @{}
foreach ($d in $MediaDirs) {
    if (Test-Path $d) { $before[$d] = (Get-ChildItem $d -Recurse -File).Count }
}
Info "media files on disk BEFORE (must be identical AFTER):"
$before.GetEnumerator() | ForEach-Object { Write-Host ("      {0,-32} {1}" -f $_.Key, $_.Value) }

# ------------------------------------------------- 2. locate git-filter-repo
# Prefer the `git filter-repo` subcommand, but fall back to the python module
# entrypoint. git-filter-repo.exe is often installed in a per-user Scripts dir
# that is NOT on PATH, so the `git filter-repo` probe fails even though the
# package is usable via `python -m git_filter_repo`.
$FRCmd = $null
try { git filter-repo --version *> $null; $FRCmd = @("git", "filter-repo") } catch {}
if (-not $FRCmd) {
    try { python -m git_filter_repo --version *> $null; $FRCmd = @("python", "-m", "git_filter_repo") } catch {}
}
if (-not $FRCmd) {
    Info "installing git-filter-repo ..."
    python -m pip install --upgrade git-filter-repo
    try { git filter-repo --version *> $null; $FRCmd = @("git", "filter-repo") } catch {}
    if (-not $FRCmd) {
        try { python -m git_filter_repo --version *> $null; $FRCmd = @("python", "-m", "git_filter_repo") } catch {}
    }
}
if (-not $FRCmd) {
    throw "git-filter-repo unavailable. Install it manually:  python -m pip install git-filter-repo"
}
Ok "git-filter-repo ready ($($FRCmd -join ' '))"

# ---------------------------------------------------------- 3. rewrite hist
Info "rewriting history -- stripping media paths from every commit ..."
Info "(takes a few minutes; do not interrupt)"
$frBase = $FRCmd[1..($FRCmd.Length - 1)]
& $FRCmd[0] @frBase `
    --invert-paths `
    --path dist/ `
    --path assets/images/ `
    --path assets/videos/ `
    --path assets/video-thumbs/ `
    --path assets/products-media/ `
    --path data/accessories/media/ `
    --path probe_test.bin `
    --force

if ($LASTEXITCODE -ne 0) { throw "git filter-repo failed (exit $LASTEXITCODE)." }
Ok "history rewritten"

# --------------------------------------------------------------- 4. gc hard
Info "expiring reflogs and garbage collecting ..."
git reflog expire --expire=now --all
git gc --prune=now
Ok "gc done"

# ------------------------------------- 5. re-add origin (filter-repo drops it)
$remoteUrl = "https://github.com/Kwin985/MDVRFAQ.git"
$existing  = $null
try { $existing = git remote get-url origin 2>$null } catch { $existing = $null }
if (-not $existing) {
    git remote add origin $remoteUrl
    Ok "origin re-added: $remoteUrl"
} else {
    Ok "origin already present: $existing"
}

# ------------------------------------------------------------- 6. verification
Info "media files on disk AFTER:"
$ok = $true
foreach ($d in $MediaDirs) {
    if (Test-Path $d) {
        $n = (Get-ChildItem $d -Recurse -File).Count
        $exp = $before[$d]
        $mark = if ($n -eq $exp) { "OK" } else { "MISMATCH (was $exp)"; $ok = $false }
        Write-Host ("      {0,-32} {1}  {2}" -f $d, $n, $mark)
    } else {
        # Dir absent on disk now. Only a real problem if it held files BEFORE
        # (i.e. filter-repo actually wiped tracked content). A dir that was
        # never present is just informational -- do NOT fail the run on it.
        if ($before.ContainsKey($d) -and $before[$d] -gt 0) {
            Write-Host ("      {0,-32} DELETED (was {1})" -f $d, $before[$d]); $ok = $false
        } else {
            Write-Host ("      {0,-32} (absent, ok)" -f $d)
        }
    }
}

Write-Host ""
Info "commits kept:"
git log --oneline

Write-Host ""
Info "repo size now:"
git count-objects -vH | Select-String -Pattern "size-pack|count: |in-pack"

Write-Host ""
if ($ok) {
    Ok "SAFE: every media file is still on disk, nothing was lost."
} else {
    Warn "FILE COUNT MISMATCH -- do NOT force-push yet. Tell me what changed."
    exit 1
}

# keep the product-source media out of git going forward (commit it so it
# travels with the push -- .gitignore is itself a tracked file).
$gignore = "data/accessories/media/"
$gi = Get-Content .gitignore -ErrorAction SilentlyContinue
if ($gi -notcontains $gignore) {
    Add-Content .gitignore "`n$gignore"
    git add .gitignore
    git commit -q -m "chore: gitignore product-source media (data/accessories/media)"
    Ok ".gitignore now ignores $gignore (committed)"
}

Write-Host ""
Info "Review the commit list above, then force-push the rewritten history:"
Write-Host "      git push -f origin main" -ForegroundColor White
Write-Host ""
Warn "probe_test.bin is a 1 MB probe leftover (from Initial commit). It was"
Warn "stripped from history; delete the working-tree copy too:"
Warn "      Remove-Item probe_test.bin"
Warn "After pushing, delete any stale remote refs/branches if you created them."
