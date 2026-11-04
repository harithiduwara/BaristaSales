#!/usr/bin/env python3
"""Builds docs/design/index.html (prototype gallery + token sheet) from screens/*.html.

Also checks every text/background pair in tokens.css against WCAG 2.1 AA (NFR-A11Y-01)
and exits non-zero if one fails.

    python3 docs/design/build.py              # writes docs/design/index.html
    python3 docs/design/build.py --inline OUT # also writes a single-file copy (CSS and fonts inlined)
"""
import base64, re, sys
from pathlib import Path

HERE = Path(__file__).parent

ICONS = {
    "home": '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    "list": '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    "chart": '<path d="M3 3v18h18"/><path d="M8 17v-5M13 17V8M18 17v-8"/>',
    "settings": '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    "check": '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    "close": '<path d="M6 6l12 12M18 6L6 18"/>',
    "back": '<path d="M15 18l-6-6 6-6"/>',
    "chevron": '<path d="M9 6l6 6-6 6"/>',
    "alert": '<path d="M12 3.5L22 20H2z"/><path d="M12 10v4.5M12 17.5v.01"/>',
    "info": '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.01"/>',
    "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    "rain": '<path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 8.5 3.3 3.3 0 0 0 7 15z"/><path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5"/>',
    "share": '<path d="M4 13v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6"/><path d="M12 3v12M7.5 7.5L12 3l4.5 4.5"/>',
    "copy": '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    "backspace": '<path d="M21 5H9l-6 7 6 7h12a0 0 0 0 0 0 0z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/>',
    "refresh": '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/>',
    "calendar": '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    "lock": '<rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
}

NAV = [("home", "Home", "home"), ("history", "History", "list"), ("dashboard", "Dashboard", "chart"), ("settings", "Settings", "settings")]

SCREENS = [
    ("s02-pin", "S-02", "PIN sign-in", "FR-AUTH-02, NFR-A11Y-01",
     "Six-digit masked PIN pad with 64 px keys. Version shown per AND-05. No PIN hint or recovery in the app; PINs are reset by the Administrator (OPS-03)."),
    ("s02-pin-locked", "S-02", "PIN sign-in, locked out", "FR-AUTH-03, 10.6",
     "Shown after five wrong PINs in 15 minutes. Uses the exact SRS wording and reassures the user that drafts are safe."),
    ("s03-home", "S-03", "Home (Owner)", "S-03, FR-REP-09, FR-AUTH-05",
     "Sync chip and role badge are always visible. The Owner sees the month-to-date strip; the Manager's home is the same without it. Business date follows A-03 (after 12:00 it is today)."),
    ("s04-wizard-sales", "S-04", "Report wizard, step 1: Sales", "FR-REP-01, -04, -07, 8.1, 10.3 MoneyField",
     "Required fields carry an asterisk. PickMe is focused, so it shows the raw value (4400) while the others show the formatted value. The summary strip updates live. Draft restored banner per FR-REP-07."),
    ("s05-review", "S-05", "Review and submit", "FR-REP-05, -06, UAT-03",
     "The payment split is Rs 500 short of the total, so submitting needs the confirmation tick. Each section links back to its step. Blocking errors, when present, appear above the warnings with links to each field."),
    ("s06-success", "S-06", "Success and share", "FR-REP-11, FR-SHR-01, FR-SHR-02",
     "The preview shows the message exactly as FR-SHR-01 defines it. After sharing, the toast says “Share sheet opened”, never “Sent”."),
    ("s07-history", "S-07", "History (Owner)", "FR-HIS-01, FR-HIS-04",
     "Newest first. Each row has date, total, bills, average bill, sync state and rain once the weather is in. The month switcher and condition filter are Owner only."),
    ("s10-dashboard", "S-10", "Dashboard (Owner)", "FR-DSH-01 to -07",
     "Real seed data plus an example 4 Nov report. The monthly target is not set yet (OQ-01), so target cards show their empty state. Bars, average line and chain benchmark are drawn to one scale. Each chart has a “Show as table” alternative."),
]

# ---------------- colour contrast (WCAG 2.1) ----------------
def parse_tokens(css):
    light_block = re.search(r':root, \[data-theme="light"\] \{(.*?)\n\}', css, re.S).group(1)
    dark_block = re.search(r'\n\[data-theme="dark"\] \{(.*?)\n\}', css, re.S).group(1)
    get = lambda b: dict(re.findall(r'--([\w-]+):\s*(#[0-9A-Fa-f]{6})', b))
    light = get(light_block)
    dark = {**light, **get(dark_block)}
    return light, dark

def lum(hexc):
    r, g, b = (int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)

def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)

TEXT_PAIRS = [("text", "bg"), ("text", "surface"), ("text", "surface-raised"), ("text-muted", "bg"), ("text-muted", "surface"),
              ("text-muted", "surface-raised"), ("on-primary", "primary"), ("on-primary-soft", "primary-soft"), ("text", "primary-soft"),
              ("primary", "surface"), ("primary", "bg"), ("danger", "surface"), ("danger", "bg"), ("warning", "surface"),
              ("text", "success-soft"), ("text", "warning-soft"), ("text", "danger-soft"), ("text", "info-soft"), ("bg", "text")]
UI_PAIRS = [("border-strong", "surface"), ("border-strong", "bg"), ("primary", "primary-soft"), ("success", "success-soft"),
            ("warning", "warning-soft"), ("danger", "danger-soft"), ("info", "info-soft"), ("chart-bar", "surface"),
            ("chart-line", "surface"), ("chart-ref", "surface"), ("chart-dine", "surface"), ("chart-take", "surface"),
            ("chart-uber", "surface"), ("chart-pickme", "surface")]

def contrast_report(light, dark):
    rows, failures = [], []
    for kind, pairs, need in (("Text", TEXT_PAIRS, 4.5), ("UI / graphics", UI_PAIRS, 3.0)):
        for fg, bg in pairs:
            rl, rd = ratio(light[fg], light[bg]), ratio(dark[fg], dark[bg])
            for theme, r in (("light", rl), ("dark", rd)):
                if r < need:
                    failures.append(f"{theme}: --{fg} on --{bg} = {r:.2f} (needs {need})")
            rows.append((kind, fg, bg, need, rl, rd))
    return rows, failures

# ---------------- templating ----------------
def icon(name):
    small = name.endswith("-sm")
    base = name[:-3] if small else name
    cls = "icon icon-sm" if small else "icon"
    return f'<svg class="{cls}" aria-hidden="true" focusable="false"><use href="#i-{base}"/></svg>'

def nav(active):
    items = "".join(
        f'<a href="#"{" aria-current=\"page\"" if key == active else ""}><span class="pill">{icon(ic)}</span>{label}</a>'
        for key, label, ic in NAV)
    return f'<nav class="nav" aria-label="Main">{items}</nav>'

STATUS = '<div class="statusbar" aria-hidden="true"><span>21:42</span><span class="sys"><span>4G</span><i></i></span></div>'

def render(fragment, suffix):
    html = fragment.replace("{{status}}", STATUS)
    html = re.sub(r"\{\{nav:(\w+)\}\}", lambda m: nav(m.group(1)), html)
    html = re.sub(r"\{\{i:([\w-]+)\}\}", lambda m: icon(m.group(1)), html)
    # keep ids unique when the same screen appears twice on the page
    for id_ in set(re.findall(r'\bid="([^"]+)"', html)):
        html = re.sub(rf'\b(id|for|aria-labelledby)="{re.escape(id_)}"', rf'\1="{id_}-{suffix}"', html)
        html = html.replace(f"url(#{id_})", f"url(#{id_}-{suffix})")
    return html

def sprite():
    symbols = "".join(f'<symbol id="i-{k}" viewBox="0 0 24 24">{v}</symbol>' for k, v in ICONS.items())
    return f'<svg width="0" height="0" style="position:absolute" aria-hidden="true">{symbols}</svg>'

def token_sheet(light, dark, rows):
    groups = [
        ("Neutrals", ["bg", "surface", "surface-raised", "border", "border-strong", "text", "text-muted"]),
        ("Brand", ["primary", "primary-hover", "on-primary", "primary-soft", "on-primary-soft"]),
        ("Semantic", ["success", "success-soft", "warning", "warning-soft", "danger", "danger-soft", "info", "info-soft"]),
        ("Charts", ["chart-bar", "chart-line", "chart-ref", "chart-grid", "chart-dine", "chart-take", "chart-uber", "chart-pickme"]),
    ]
    out = []
    for title, keys in groups:
        cells = "".join(
            f'<li><span class="sw"><i style="background:{light[k]}"></i><i style="background:{dark[k]}"></i></span>'
            f'<code>--{k}</code><span class="hx">{light[k]} · {dark[k]}</span></li>' for k in keys)
        out.append(f'<div class="tok-group"><h3>{title}</h3><ul class="swatches">{cells}</ul></div>')
    body = "".join(
        f'<tr><td>{kind}</td><td><code>--{fg}</code> on <code>--{bg}</code></td><td class="n">{need:.1f}</td>'
        f'<td class="n">{rl:.2f}</td><td class="n">{rd:.2f}</td></tr>' for kind, fg, bg, need, rl, rd in rows)
    table = (f'<div class="tw"><table><thead><tr><th>Use</th><th>Pair</th><th class="n">Needs</th><th class="n">Light</th>'
             f'<th class="n">Dark</th></tr></thead><tbody>{body}</tbody></table></div>')
    type_scale = "".join(f'<li style="font-size:{px}px"><span class="tk">{px}</span>Rs 129,849.85 · Report for Tue 3 Nov</li>' for px in (28, 22, 18, 16, 14, 12))
    space = "".join(f'<li><i style="width:{s}px"></i><span class="tk">{s}</span></li>' for s in (4, 8, 12, 16, 24, 32, 48))
    return f'''
      {"".join(out)}
      <div class="tok-group"><h3>Type: IBM Plex Sans (UI) and IBM Plex Mono (figures)</h3><ul class="type-scale">{type_scale}</ul>
        <p class="note">Weights 400, 500, 600. Self-hosted WOFF2 (C-07); no network font requests.</p></div>
      <div class="tok-group"><h3>Spacing (4 px grid), radius, elevation, motion</h3><ul class="space">{space}</ul>
        <p class="note">Radius 8 for inputs and cards, 999 for chips. Elevation 0 / 1 (cards) / 2 (sheets and dialogs). Motion 180 ms ease-out, off under reduced motion. Touch targets at least 48 × 48.</p></div>
      <div class="tok-group"><h3>Contrast checks (WCAG 2.1 AA)</h3><p class="note">Computed by <code>build.py</code> from <code>tokens.css</code>. The build fails if any pair drops below its minimum.</p>{table}</div>'''

GALLERY_CSS = """
:root { --gal-max: 880px; }
body { margin: 0; background: var(--bg); color: var(--text); font: 400 16px/1.55 var(--font-sans); }
.gal { max-width: var(--gal-max); margin: 0 auto; padding-block: 32px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: flex; flex-direction: column; gap: 48px; }
.gal > header { display: flex; flex-direction: column; gap: 12px; max-width: 64ch; }
.gal .eyebrow { font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--primary); }
.gal > header h1 { margin: 0; font-size: 28px; line-height: 1.2; font-weight: 600; text-wrap: balance; }
.scr-head h2 { margin: 0; font-size: 22px; font-weight: 600; text-wrap: balance; }
.tok-group h3 { margin: 0; font-size: 16px; font-weight: 600; }
.scr-head p, .gal > header p, .tok-group p { margin: 0; }
.gal .lede { color: var(--text-muted); }
.gal .toc { display: flex; flex-wrap: wrap; gap: 8px; padding: 0; margin: 0; list-style: none; }
.gal .toc a { display: inline-flex; min-height: 40px; align-items: center; gap: 8px; padding: 0 14px; border: 1px solid var(--border-strong); border-radius: 999px; color: var(--text); text-decoration: none; font-size: 14px; }
.gal .toc a b { font-family: var(--font-mono); font-weight: 500; color: var(--primary); }
.gal .toc a:focus-visible, .gal a:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.scr { display: flex; flex-direction: column; gap: 16px; scroll-margin-top: 16px; }
.scr-head { display: flex; flex-direction: column; gap: 6px; max-width: 64ch; }
.scr-head .id { font-family: var(--font-mono); font-size: 14px; color: var(--primary); font-weight: 500; }
.scr-head .reqs { font-size: 13px; color: var(--text-muted); font-family: var(--font-mono); }
.pair-ph { display: flex; flex-wrap: wrap; gap: 24px; }
.pair-ph .phone { height: auto; min-height: 844px; }
.pair-ph .phone .body { overflow: visible; flex: 1 0 auto; }
.pair-ph figure { margin: 0; display: flex; flex-direction: column; gap: 8px; width: min(390px, 100%); }
.pair-ph figcaption { font-size: 13px; color: var(--text-muted); }
.tok-group { display: flex; flex-direction: column; gap: 12px; }
.swatches { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.swatches li { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 10px; align-items: center; font-size: 13px; min-width: 0; }
.swatches .sw { grid-row: span 2; display: flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.swatches .sw i { width: 24px; height: 40px; display: block; }
.swatches code, .gal code { font-family: var(--font-mono); font-size: 13px; }
.swatches .hx { color: var(--text-muted); font-family: var(--font-mono); font-size: 12px; overflow-wrap: anywhere; }
.type-scale, .space { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.type-scale li { display: flex; gap: 12px; align-items: baseline; overflow-wrap: anywhere; min-width: 0; }
.tk { font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); width: 2.5em; flex: none; }
.space li { display: flex; gap: 12px; align-items: center; }
.space i { display: block; height: 12px; background: var(--primary); border-radius: 2px; }
.note { font-size: 14px; color: var(--text-muted); max-width: 64ch; }
.tw { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
.tw table { border-collapse: collapse; width: 100%; font-size: 13px; font-variant-numeric: tabular-nums; }
.tw th, .tw td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; }
.tw th { font-size: 12px; color: var(--text-muted); font-weight: 600; background: var(--surface); }
.tw .n { text-align: right; font-family: var(--font-mono); }
.gal footer { font-size: 14px; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 16px; }
"""

def build(inline=False):
    tokens = (HERE / "tokens.css").read_text()
    components = (HERE / "components.css").read_text()
    light, dark = parse_tokens(tokens)
    rows, failures = contrast_report(light, dark)
    if failures:
        sys.exit("Contrast check failed:\n  " + "\n  ".join(failures))

    sections = []
    for slug, sid, name, reqs, note in SCREENS:
        frag = (HERE / "screens" / f"{slug}.html").read_text()
        phones = "".join(
            f'<figure><figcaption>{t.title()} · full length (scrolls on the phone)</figcaption><div class="phone" data-theme="{t}">{render(frag, f"{slug}-{t}")}</div></figure>'
            for t in ("light", "dark"))
        sections.append(f'''<section class="scr" id="{slug}" aria-labelledby="{slug}-h">
  <div class="scr-head"><span class="id">{sid}</span><h2 id="{slug}-h">{name}</h2><p>{note}</p><p class="reqs">{reqs}</p></div>
  <div class="pair-ph">{phones}</div></section>''')
    toc = "".join(f'<li><a href="#{slug}"><b>{sid}</b>{name}</a></li>' for slug, sid, name, *_ in SCREENS)

    main = f'''{sprite()}
<div class="gal">
  <header>
    <span class="eyebrow">Phase 1 design · for Owner approval</span>
    <h1>Aluthgama Daily Report: screen prototypes</h1>
    <p class="lede">Static prototypes at 390 px in light and dark, the design tokens and their contrast checks. Figures are the two real reports (2 and 3 Nov) plus an example report for Wed 4 Nov. The approved design is the basis for Phase 2.</p>
    <ul class="toc">{toc}<li><a href="#tokens"><b>10.2</b>Design tokens</a></li></ul>
  </header>
  {"".join(sections)}
  <section class="scr" id="tokens" aria-labelledby="tokens-h">
    <div class="scr-head"><span class="id">10.2</span><h2 id="tokens-h">Design tokens</h2><p>Each swatch shows the light value, then the dark value.</p></div>
    {token_sheet(light, dark, rows)}
  </section>
  <footer>Source: <code>docs/design/</code> (tokens.css, components.css, screens/, build.py). Component inventory: <code>docs/design/components.md</code>.</footer>
</div>'''

    if not inline:
        return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Aluthgama Daily Prototypes</title>
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="components.css">
<style>{GALLERY_CSS}</style>
</head>
<body>
{main}
</body>
</html>
'''
    def font_uri(m):
        data = base64.b64encode((HERE / m.group(1)).read_bytes()).decode()
        return f'url("data:font/woff2;base64,{data}")'
    tokens_inline = re.sub(r'url\("(fonts/[^"]+)"\)', font_uri, tokens)
    return f'''<title>Aluthgama Daily Prototypes</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>{tokens_inline}
{components}
{GALLERY_CSS}</style>
{main}
'''

if __name__ == "__main__":
    (HERE / "index.html").write_text(build())
    print("wrote", HERE / "index.html")
    if "--inline" in sys.argv:
        out = Path(sys.argv[sys.argv.index("--inline") + 1])
        out.write_text(build(inline=True))
        print("wrote", out, f"{out.stat().st_size // 1024} KB")
