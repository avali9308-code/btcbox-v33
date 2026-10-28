#!/usr/bin/env python3
"""Source-level inventory of balance/frozen mutations in server.py (no code execution)."""
from __future__ import annotations
import ast
import json
import sys
from pathlib import Path

TARGET_NAMES = {"balances", "frozen"}

class WriterVisitor(ast.NodeVisitor):
    def __init__(self):
        self.stack = []
        self.writers = []

    def visit_FunctionDef(self, node):
        self.stack.append(node.name)
        self.generic_visit(node)
        self.stack.pop()

    visit_AsyncFunctionDef = visit_FunctionDef

    def visit_Assign(self, node):
        for target in node.targets:
            self._inspect_target(target, node)
        self.generic_visit(node)

    def visit_AugAssign(self, node):
        self._inspect_target(node.target, node)
        self.generic_visit(node)

    def visit_AnnAssign(self, node):
        self._inspect_target(node.target, node)
        self.generic_visit(node)

    def _inspect_target(self, target, node):
        names = {n.id for n in ast.walk(target) if isinstance(n, ast.Name)}
        attrs = {n.attr for n in ast.walk(target) if isinstance(n, ast.Attribute)}
        subs = {n.value.id for n in ast.walk(target) if isinstance(n, ast.Subscript) and isinstance(n.value, ast.Name)}
        # Match exact balance bucket identifiers, not similarly named fields such as
        # frozen_account/frozen_reason or a local variable named frozen_s.
        target_text = ast.unparse(target)
        exact_bucket = any(
            isinstance(n, ast.Name) and n.id in TARGET_NAMES
            or isinstance(n, ast.Attribute) and n.attr in TARGET_NAMES
            or isinstance(n, ast.Subscript) and isinstance(n.slice, ast.Constant)
               and n.slice.value in TARGET_NAMES
            for n in ast.walk(target)
        )
        if exact_bucket:
            self.writers.append({"line": node.lineno, "function": self.stack[-1] if self.stack else "<module>",
                                 "target": target_text, "kind": type(node).__name__})


def audit(source: Path):
    tree = ast.parse(source.read_text(encoding="utf-8"), filename=str(source))
    visitor = WriterVisitor()
    visitor.visit(tree)
    unique = {(w["line"], w["function"], w["target"], w["kind"]): w for w in visitor.writers}
    return sorted(unique.values(), key=lambda w: (w["line"], w["target"]))


def main(argv=None):
    args = list(sys.argv[1:] if argv is None else argv)
    source = Path(args[0]) if args else Path(__file__).resolve().parents[1] / "server.py"
    result = {"source": source.name, "audit_type": "static_ast_assignment_inventory", "database_test_performed": False,
              "writers": audit(source)}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
