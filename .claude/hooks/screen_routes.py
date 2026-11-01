"""Which screens with an approved picture a branch changes, for pr_body.py (#947). Each folder in
docs/design/approved/ has a README whose `Route:` line names the route it shows in backticks
(Route: `/team`, …). A route is rendered by the files its route definition in src/routes/ hands it:
the page component that definition names, found through the path constant whose value is that
route (src/frame/menu.ts: MY_TEAM_PATH = "/team"), then every file under src/ that component
imports, however deep, and the stylesheets src/main.tsx loads for every screen (styles.css, and
what it @imports). The frame around a page (the menu, the top bar) isn't counted: it has no
approved picture of its own. A route that can't be traced to a file raises ValueError, never
passes as untouched. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import glob
import os
import re

from main_writes import MAIN
from tidy_branch import REMOTE, run

APPROVED = os.path.join("docs", "design", "approved")
ROUTE_LINE = re.compile(r"^Route:\s*`([^`]+)`", re.M)
SRC, ROUTES = "src", os.path.join("src", "routes")
CONSTANT_HOMES = (SRC, "convex")  # where a route's path constant may be defined (convex: JOIN_PATH)
ENTRY = os.path.join("src", "main.tsx")  # its stylesheets draw every screen
SOURCE_EXTS = (".ts", ".tsx")
CONSTANT = re.compile(r'^(?:export )?const ([A-Z][A-Z0-9_]*)\s*=\s*(?:"([^"]*)"|`([^`]*)`)\s*;', re.M)
PLACEHOLDER = re.compile(r"\$\{([A-Z][A-Z0-9_]*)\}")
# a value import (a type import draws nothing): its braced names, its default name, its path
IMPORT_FROM = re.compile(r'^import\s+(?!type\b)(?:\{([^}]*)\}|(\w+))?[^"\n]*?(?:from\s+)?"(\.[^"]+)"', re.M)
CSS_IMPORT = re.compile(r'@import\s+"(\.[^"]+)"')
STATEMENT = re.compile(r"^(?=const |export |function |let )", re.M)  # a top-level statement starts
IMPORT_STATEMENT = re.compile(r"^import\b[^;]*;", re.M)
WORD = r"(?<![\w$]){}(?![\w$])"
# a route definition names its path as createRoute's path: X, or as the first argument of a helper
# that makes one (leaguePage(MY_TEAM_PATH, …)); a redirect's to: X is not one
DEFINES = (r"\bpath:\s*{}(?![\w$])", r"\(\s*{}\s*,")


def approved_routes(folder):
    """{route: its folder in docs/design/approved}, from each README's Route: line."""
    out = {}
    for readme in sorted(glob.glob(os.path.join(folder, APPROVED, "*", "README.md"))):
        with open(readme, encoding="utf-8") as f:
            found = ROUTE_LINE.search(f.read())
        if found:
            out[found.group(1)] = os.path.basename(os.path.dirname(readme))
    return out


def _read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def _source_files(folder):
    patterns = (os.path.join(folder, home, "**", "*") for home in CONSTANT_HOMES)
    return [p for pattern in patterns for p in glob.glob(pattern, recursive=True) if p.endswith(SOURCE_EXTS)]


def path_constants(folder):
    """{constant name: its value}, for every top-level string constant under src/ and convex/, a template built
    from another (`${MY_TEAM_PATH}/squad`) filled in."""
    raw = {}
    for path in _source_files(folder):
        for name, plain, template in CONSTANT.findall(_read(path)):
            raw[name] = plain if plain or not template else template
    resolved = {}
    for _ in range(len(raw)):  # each round fills in one more layer of templates
        for name, value in raw.items():
            names = PLACEHOLDER.findall(value)
            if all(n in resolved for n in names):
                resolved[name] = PLACEHOLDER.sub(lambda m: resolved[m.group(1)], value)
    return resolved


def _imports(path):
    """{imported name: the file it comes from} and every file path imports, relative ones only."""
    names, files, text = {}, [], _read(path)
    here = os.path.dirname(path)
    if path.endswith(".css"):
        return names, [_resolve(here, spec) for spec in CSS_IMPORT.findall(text)]
    for braced, default, spec in IMPORT_FROM.findall(text):
        target = _resolve(here, spec)
        files.append(target)
        for part in braced.split(",") if braced else [default]:
            name = part.strip().removeprefix("type ").split(" as ")[-1].strip()
            if name:
                names[name] = target
    return names, files


def _resolve(here, spec):
    base = os.path.normpath(os.path.join(here, spec))
    for candidate in (base, *(base + ext for ext in SOURCE_EXTS),
                      *(os.path.join(base, "index" + ext) for ext in SOURCE_EXTS)):
        if os.path.isfile(candidate):
            return candidate
    return base  # not on disk (a package's file): dropped by the src/ filter


def _closure(starts, folder):
    """Every file under src/ the starts import, however deep, but the router's own (src/routes/:
    a route hangs from the root, which imports every page)."""
    src, routes = os.path.join(folder, SRC) + os.sep, os.path.join(folder, ROUTES) + os.sep
    seen, todo = set(), [p for p in starts if p.startswith(src) and not p.startswith(routes)]
    while todo:
        path = todo.pop()
        if path in seen or not os.path.isfile(path):
            continue
        seen.add(path)
        todo += [p for p in _imports(path)[1] if p.startswith(src) and not p.startswith(routes)]
    return {os.path.relpath(p, folder) for p in seen}


def files_rendering(route, folder, constants=None):
    """The files under src/ (repo paths) that render this route; ValueError if none can be found."""
    folder = os.path.abspath(folder)  # imports resolve to normalised paths, compared with it
    constants = path_constants(folder) if constants is None else constants
    names = [name for name, value in constants.items() if value == route]
    keys = [re.escape(n) for n in names] + [re.escape(f'"{route}"')]
    pages = []
    for path in glob.glob(os.path.join(folder, ROUTES, "*.tsx")):
        imported, _ = _imports(path)
        for statement in STATEMENT.split(IMPORT_STATEMENT.sub("", _read(path))):
            if any(re.search(form.format(key), statement) for form in DEFINES for key in keys):
                pages += [file for name, file in imported.items() if re.search(WORD.format(name), statement)]
    page_files = _closure(pages, folder)
    if not page_files:
        raise ValueError(f"the guard can't trace which files under src/ render {route} (its Route: line in "
                         f"{APPROVED}/): no route in {ROUTES}/ hands it a page")
    stylesheets = [p for p in _imports(os.path.join(folder, ENTRY))[1] if p.endswith(".css")]
    return page_files | _closure(stylesheets, folder)


def changed_files(folder):
    """The files this branch changes against origin/main; ValueError if git can't say."""
    ok, said = run(folder, "git", "diff", "--name-only", f"{REMOTE}/{MAIN}...HEAD")
    if not ok:
        raise ValueError(f"git diff against {REMOTE}/{MAIN} failed ({said}); git fetch {REMOTE} {MAIN}, then retry")
    return set(said.split())


def screens_changed(folder):
    """{route: the changed files that render it}, for each route with an approved picture this
    branch's diff reaches; ValueError if the diff or a route can't be read."""
    routes = approved_routes(folder)
    if not routes:
        return {}
    changed = {path for path in changed_files(folder) if path.startswith(SRC + "/")}
    if not changed:
        return {}
    constants, out = path_constants(folder), {}
    for route in routes:
        hit = sorted(changed & files_rendering(route, folder, constants))
        if hit:
            out[route] = hit
    return out
