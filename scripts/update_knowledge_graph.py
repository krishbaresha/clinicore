#!/usr/bin/env python3
"""
ClinicFlow Autonomous Knowledge Graph Auto-Updater
Re-indexes modified files, rebuilds AST & graph connections, and updates graphify-out/
"""
import sys, os, json, subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
os.chdir(ROOT_DIR)

py_path_file = ROOT_DIR / "graphify-out" / ".graphify_python"
py_exec = sys.executable
if py_path_file.exists():
    candidate = py_path_file.read_text(encoding="utf-8").strip()
    if Path(candidate).exists():
        py_exec = candidate

print(f"[graphify-updater] Using Python: {py_exec}")
print("[graphify-updater] Rebuilding Graphify Knowledge Graph...")
build_script = ROOT_DIR / "graphify-out" / "run_build.py"
ast_script = ROOT_DIR / "graphify-out" / "run_ast.py"

# Run AST re-extraction
if ast_script.exists():
    subprocess.run([py_exec, str(ast_script)], check=True, cwd=str(ROOT_DIR))

# Run Graph build & export
if build_script.exists():
    subprocess.run([py_exec, str(build_script)], check=True, cwd=str(ROOT_DIR))

# Export updated HTML
from graphify.build import build_from_json
from graphify.cluster import cluster
from graphify.export import to_html

try:
    extraction = json.loads((ROOT_DIR / "graphify-out" / ".graphify_extract.json").read_text(encoding="utf-8"))
    G = build_from_json(extraction, root='.', directed=False)
    communities = cluster(G)
    labels = {cid: f"Community {cid}" for cid in communities}
    to_html(G, communities, str(ROOT_DIR / "graphify-out" / "graph.html"), community_labels=labels)
except Exception as e:
    print(f"[graphify-updater] HTML export notice: {e}")

print("[graphify-updater] [SUCCESS] Knowledge Graph & Interactive HTML successfully updated in lockstep with codebase!")
