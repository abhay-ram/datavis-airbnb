# -*- coding: utf-8 -*-
"""
Ein Befehl für die Veröffentlichung.

  1. baut die Website nach docs/          (tools/publish.py)
  2. committet und pusht main
  3. spiegelt docs/ in den Branch gh-pages und pusht ihn
     - daraus liefert GitHub Pages die Seite aus

  python tools/deploy.py ["Commit-Nachricht"]
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(ROOT, "tools")
DOCS = os.path.join(ROOT, "docs")
MESSAGE = sys.argv[1] if len(sys.argv) > 1 else "Website aktualisiert"


def git(*args, capture=True, check=True):
    """capture=False für Befehle, deren Ausgabe live mitlaufen soll (push)."""
    r = subprocess.run(["git"] + list(args), cwd=ROOT,
                       capture_output=capture, text=True)
    if check and r.returncode != 0:
        sys.exit("git %s fehlgeschlagen\n%s" % (" ".join(args), (r.stderr or "").strip()))
    return (r.stdout or "").strip()


def main():
    # 1 · bauen
    r = subprocess.run([sys.executable, os.path.join(TOOLS, "publish.py")], cwd=ROOT)
    if r.returncode != 0:
        sys.exit("publish.py fehlgeschlagen")

    # 2 · main
    if git("status", "--porcelain"):
        git("add", "-A")
        git("commit", "-q", "-m", MESSAGE)
        print("commit: %s" % git("log", "--oneline", "-1"))
    else:
        print("keine Änderungen im Arbeitsverzeichnis")
    git("push", "origin", "main", capture=False)
    print("main gepusht")

    # 3 · gh-pages aus dem docs/-Baum
    tree = git("rev-parse", "main:docs")
    parent = git("rev-parse", "-q", "--verify", "gh-pages", check=False)
    args = ["commit-tree", tree]
    if parent:
        args += ["-p", parent]
    args += ["-m", "GitHub Pages: gebaute Website"]
    commit = git(*args)
    git("branch", "-f", "gh-pages", commit)
    git("push", "--force", "origin", "gh-pages", capture=False)
    print("gh-pages gepusht (%s)" % commit[:8])

    print("\nFertig. GitHub Pages baut in etwa einer Minute:")
    print("  https://abhay-ram.github.io/datavis-airbnb/")


if __name__ == "__main__":
    main()
