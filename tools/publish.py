# -*- coding: utf-8 -*-
"""
Baut die komplette Website nach docs/ - bereit für GitHub Pages
(Einstellung: Deploy from a branch -> main -> /docs).

  python tools/publish.py
"""
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")
TOOLS = os.path.join(ROOT, "tools")


def run(args):
    print("$ " + " ".join(args))
    r = subprocess.run(args, cwd=ROOT)
    if r.returncode != 0:
        sys.exit("Fehlgeschlagen: %s" % " ".join(args))


def main():
    if os.path.isdir(DOCS):
        shutil.rmtree(DOCS)
    os.makedirs(DOCS)

    run([sys.executable, os.path.join(TOOLS, "prepare_data.py")])
    run([sys.executable, os.path.join(TOOLS, "build.py"), DOCS])
    run([sys.executable, os.path.join(TOOLS, "export_data.py"), DOCS])

    # GitHub Pages soll die Dateien unverändert ausliefern (kein Jekyll).
    open(os.path.join(DOCS, ".nojekyll"), "w").close()

    readme = os.path.join(ROOT, "README.md")
    if os.path.exists(readme):
        shutil.copy2(readme, os.path.join(DOCS, "README.md"))

    total = 0
    for base, _dirs, files in os.walk(DOCS):
        for f in files:
            total += os.path.getsize(os.path.join(base, f))
    print("\ndocs/ fertig - %d Dateien, %.1f KB" % (
        sum(len(f) for _, _, f in os.walk(DOCS)), total / 1024))


if __name__ == "__main__":
    main()
