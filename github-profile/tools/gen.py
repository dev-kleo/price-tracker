import os
A="assets"
FONT="font-family=\"'Segoe UI', -apple-system, Helvetica, Arial, sans-serif\""
BG1,BG2="#0B1020","#141B34"; C1,C2="#5EEAD4","#A78BFA"; INK="#F1F5F9"; MUTED="#94A3B8"
def w(n,s): open(os.path.join(A,n),"w",encoding="utf8").write(s)

# ---------- banner
pts=[(560,210),(640,190),(720,200),(800,150),(880,165),(960,110),(1040,125),(1120,70)]
path="M"+" L".join(f"{x},{y}" for x,y in pts)
fill=path+" L1120,260 L560,260 Z"
grid="".join(f'<line x1="540" x2="1160" y1="{y}" y2="{y}" stroke="#fff" stroke-opacity=".06"/>' for y in (80,130,180,230))
banner=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 300" width="1200" height="300" role="img" aria-label="Cleo. MSc Economics and International Business. South Ural State University.">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{BG1}"/><stop offset="1" stop-color="{BG2}"/></linearGradient>
<linearGradient id="ln" x1="0" x2="1"><stop offset="0" stop-color="{C1}"/><stop offset="1" stop-color="{C2}"/></linearGradient>
<linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{C2}" stop-opacity=".28"/><stop offset="1" stop-color="{C2}" stop-opacity="0"/></linearGradient>
<filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="60"/></filter>
<clipPath id="rev"><rect x="540" y="0" width="0" height="300"><animate attributeName="width" values="0;620;620;0" keyTimes="0;.35;.9;1" dur="9s" repeatCount="indefinite"/></rect></clipPath>
</defs>
<rect width="1200" height="300" rx="20" fill="url(#bg)"/>
<g filter="url(#blur)" opacity=".55">
<circle cx="260" cy="60" r="110" fill="{C1}" fill-opacity=".35"><animate attributeName="cx" values="260;420;260" dur="14s" repeatCount="indefinite"/><animate attributeName="cy" values="60;120;60" dur="14s" repeatCount="indefinite"/></circle>
<circle cx="980" cy="250" r="130" fill="{C2}" fill-opacity=".4"><animate attributeName="cx" values="980;820;980" dur="17s" repeatCount="indefinite"/></circle>
</g>
{grid}
<g clip-path="url(#rev)">
<path d="{fill}" fill="url(#fl)"/>
<path d="{path}" fill="none" stroke="url(#ln)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
</g>
<circle cx="1120" cy="70" r="6" fill="{C2}"><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;.34;.4;.9;1" dur="9s" repeatCount="indefinite"/></circle>
<circle cx="1120" cy="70" r="6" fill="none" stroke="{C2}"><animate attributeName="r" values="6;22" dur="2.2s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;0" dur="2.2s" repeatCount="indefinite"/></circle>
<g {FONT}>
<text x="64" y="128" fill="{INK}" font-size="68" font-weight="700" letter-spacing="-2">Cleo</text>
<text x="66" y="170" fill="{INK}" font-size="22" font-weight="600">MSc Economics &amp; International Business</text>
<text x="66" y="200" fill="{MUTED}" font-size="18">South Ural State University</text>
<g font-size="18" fill="{C1}">
<text x="66" y="248">Retrieval-augmented generation<animate attributeName="opacity" values="0;1;1;0;0;0;0;0" keyTimes="0;.05;.28;.33;1;1;1;1" dur="9s" repeatCount="indefinite"/></text>
<text x="66" y="248">Browser tools that keep data local<animate attributeName="opacity" values="0;0;0;1;1;0;0;0" keyTimes="0;.33;.38;.43;.61;.66;1;1" dur="9s" repeatCount="indefinite"/></text>
<text x="66" y="248">Software you can run and verify<animate attributeName="opacity" values="0;0;0;0;0;1;1;0" keyTimes="0;.66;.7;.72;.75;.78;.95;1" dur="9s" repeatCount="indefinite"/></text>
</g></g>
</svg>'''
w("banner.svg",banner)

# ---------- cards
def card(name,title,desc1,desc2,tags):
    chips="";x=28
    for t in tags:
        cw=len(t)*7.4+20
        chips+=f'<rect x="{x}" y="122" width="{cw:.0f}" height="26" rx="13" fill="#fff" fill-opacity=".07"/><text x="{x+10}" y="140" fill="{C1}" font-size="12.5" font-weight="600">{t}</text>'
        x+=cw+8
    s=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 170" width="440" height="170" role="img" aria-label="{title}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{BG1}"/><stop offset="1" stop-color="{BG2}"/></linearGradient>
<linearGradient id="ac" x1="0" x2="1"><stop offset="0" stop-color="{C1}"/><stop offset="1" stop-color="{C2}"/></linearGradient>
<linearGradient id="sw" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<clipPath id="c"><rect width="440" height="170" rx="18"/></clipPath></defs>
<rect width="440" height="170" rx="18" fill="url(#bg)"/>
<g clip-path="url(#c)"><rect x="0" y="0" width="440" height="4" fill="url(#ac)"/><rect x="-120" y="0" width="120" height="4" fill="url(#sw)" opacity=".7"><animate attributeName="x" values="-120;440" dur="4.5s" repeatCount="indefinite"/></rect></g>
<rect x=".5" y=".5" width="439" height="169" rx="17.5" fill="none" stroke="#fff" stroke-opacity=".08"/>
<g {FONT}>
<text x="28" y="48" fill="{INK}" font-size="21" font-weight="700">{title}</text>
<text x="28" y="78" fill="{MUTED}" font-size="14.5">{desc1}</text>
<text x="28" y="99" fill="{MUTED}" font-size="14.5">{desc2}</text>
{chips}</g></svg>'''
    w(f"card-{name}.svg",s)
card("ragbot","ragbot","RAG platform for university documents.","Page-level citations, local LLM.",["FastAPI","pgvector","Ollama","Next.js"])
card("uniassist","Uniassist","Academics, resources and campus needs","for students in one place.",["Python","Platform"])
card("price-tracker","price-tracker","Chrome extension: prices on Ozon, WB and","Yandex Market. Data stays local.",["MV3","IndexedDB","Playwright"])
card("openhighlights","OpenHighlights","Chrome extension for highlighting","web pages.",["TypeScript","Chrome MV3"])

# ---------- stack strip
items=["Python","FastAPI","PostgreSQL","pgvector","TypeScript","Next.js","Docker","Playwright"]
x=0;g=""
for i,t in enumerate(items):
    cw=len(t)*9+30
    g+=f'<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="3.6s" begin="{i*0.35:.2f}s" repeatCount="indefinite"/><rect x="{x}" y="4" width="{cw:.0f}" height="38" rx="19" fill="{BG2}" stroke="#fff" stroke-opacity=".1"/><text x="{x+cw/2:.0f}" y="28" text-anchor="middle" fill="{INK}" font-size="15" font-weight="600" {FONT}>{t}</text></g>'
    x+=cw+10
w("stack.svg",f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {x:.0f} 46" width="{x:.0f}" height="46" role="img" aria-label="Stack: {", ".join(items)}">{g}</svg>')

# ---------- divider
w("divider.svg",f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 6" width="1200" height="6" aria-hidden="true"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="{C1}" stop-opacity="0"/><stop offset=".5" stop-color="{C2}"/><stop offset="1" stop-color="{C1}" stop-opacity="0"/></linearGradient></defs><rect y="2" width="1200" height="2" rx="1" fill="url(#g)"><animate attributeName="opacity" values=".35;1;.35" dur="4s" repeatCount="indefinite"/></rect></svg>''')
