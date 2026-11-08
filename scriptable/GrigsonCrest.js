// GRIGSON CREST — iPhone widgets for Scriptable
// One script, every size: Home Screen small / medium / large, Lock Screen circular / rectangular / inline.
// Small widget "Parameter": leave blank = date + weather · type  family  = heads-ups + girls + next birthday.
// v2.1 · 2026-11-08 · fonts use new Font(...) (Scriptable has no Font.custom)

// ───────── SETTINGS ─────────
const HOME = { lat: 33.4418, lon: -94.0377 }   // Texarkana, used if GPS is off or slow
const USE_GPS = true
const GIRLS_ANCHOR = new Date(2026, 9, 26)      // a Monday that STARTS one of your weeks with the girls (week of Halloween 2026)
const GIRLS = "Zeppelyn and Jaxyn"
const FAMILY = [
  { name: "Joshua",   m: 4,  d: 15, y: 1989 },
  { name: "Randi",    m: 2,  d: 9,  y: 1992 },
  { name: "Zeppelyn", m: 5,  d: 20, y: 2013 },
  { name: "Jaxyn",    m: 12, d: 19, y: 2016 },
  { name: "Scarlet",  m: 11, d: 12, y: 2022 },
]
const MOTTO = "AUT VIAM INVENIAM AUT FACIAM"
const REFRESH_MIN = 15
const BG_VERSION = 1   // bump to redraw the stone background
const HEADS_UP_DAYS = 8          // how far ahead "Heads up:" events show
const HEADS_UP_CALENDAR = "Heads Up"   // any event on a calendar with this name counts too

// ───────── LOOK (pewter on black stone) ─────────
const C = {
  hi: new Color("#E9E9E9"),
  mid: new Color("#ABABAB"),
  low: new Color("#727272"),
  rule: new Color("#9A9A9A", 0.45),
  star: new Color("#C8C8C8", 0.95),
  shadow: new Color("#000000", 0.95),
}
const F = {
  num: s => new Font("Didot", s),
  cap: s => new Font("Baskerville-SemiBold", s),
  body: s => new Font("Baskerville", s),
  bold: s => new Font("Baskerville-SemiBold", s),
  it: s => new Font("Baskerville-Italic", s),
}

const now = new Date()
const DAY = 86400000

await main()
Script.complete()

// ───────── MAIN ─────────
async function main() {
  let fam = config.widgetFamily
  let param = (args.widgetParameter || "").trim().toLowerCase()

  if (!config.runsInWidget) {
    const a = new Alert()
    a.title = "Grigson Crest"
    a.message = "Preview which widget?"
    const opts = ["Small", "Small · family", "Medium", "Large", "Lock Screen"]
    opts.forEach(o => a.addAction(o))
    a.addCancelAction("Cancel")
    const i = await a.presentSheet()
    if (i < 0) return
    fam = ["small", "small", "medium", "large", "accessoryRectangular"][i]
    if (i === 1) param = "family"
  }
  fam = fam || "medium"
  if (fam === "extraLarge") fam = "large"

  const [wx, cal] = await Promise.all([getWeather(), getCalendar()])
  const d = { wx, events: cal.events, notices: cal.notices, girls: girlsStatus(now), bdays: nextBirthdays(now) }

  let w
  if (fam.startsWith("accessory")) {
    w = buildLock(fam, d)
  } else {
    w = new ListWidget()
    const size = widgetSize(fam)
    w.backgroundImage = background(fam, size)
    w.url = "calshow://"
    if (fam === "small") {
      if (param === "family") smallFamily(w, d)
      else smallDate(w, d)
    } else if (fam === "medium") medium(w, d, size)
    else large(w, d, size)
  }
  w.refreshAfterDate = new Date(Date.now() + REFRESH_MIN * 60000)

  if (config.runsInWidget) Script.setWidget(w)
  else if (fam === "small") await w.presentSmall()
  else if (fam === "medium") await w.presentMedium()
  else if (fam === "large") await w.presentLarge()
  else {
    try { await w.presentAccessoryRectangular() } catch (e) { await w.presentSmall() }
  }
}

// ───────── LAYOUTS ─────────
function smallDate(w, { wx }) {
  w.setPadding(15, 16, 13, 16)
  const n = wxNow(wx)
  txt(w, spaced(dayName(now)), F.cap(9), C.mid, { lines: 1, scale: 0.6 })
  txt(w, String(now.getDate()), F.num(48), C.hi)
  txt(w, spaced(monthName(now)), F.cap(8.5), C.mid, { lines: 1, scale: 0.6 })
  w.addSpacer()
  if (n) {
    const r = w.addStack()
    r.centerAlignContent()
    icon(r, n.sym, 15, C.hi)
    r.addSpacer(5)
    txt(r, `${n.t}°`, F.num(22), C.hi)
    r.addSpacer()
    const col = r.addStack()
    col.layoutVertically()
    txt(col, `H ${n.hi}°`, F.body(10), C.mid)
    txt(col, `L ${n.lo}°`, F.body(10), C.low)
  } else {
    txt(w, "Weather offline", F.it(10), C.low)
  }
}

// Small · family = the heads-up widget: what's coming, the girls on swap days, the next birthday.
function smallFamily(w, { girls, bdays, notices }) {
  w.setPadding(15, 16, 13, 16)
  txt(w, spaced("Heads up"), F.cap(9), C.mid)
  w.addSpacer(6)
  const items = []
  if (girls) items.push(["figure.2.and.child.holdinghands", girls.short])
  notices.slice(0, 3 - items.length).forEach(n => items.push(["bell.fill", `${n.title} · ${n.when}`]))
  if (!items.length) txt(w, "Nothing coming up", F.it(11), C.low)
  items.forEach((it, i) => {
    if (i) w.addSpacer(4)
    const r = w.addStack()
    r.centerAlignContent()
    icon(r, it[0], 11, C.mid)
    r.addSpacer(5)
    txt(r, it[1], F.body(11), C.hi, { lines: 2, scale: 0.7 })
  })
  w.addSpacer()
  const b = bdays[0]
  const br = w.addStack()
  br.centerAlignContent()
  icon(br, "gift", 11, C.mid)
  br.addSpacer(5)
  txt(br, `${b.name} turns ${b.age}`, F.bold(11), C.hi, { lines: 1, scale: 0.7 })
  txt(w, whenText(b), F.body(10), C.low)
}

function medium(w, d, size) {
  w.setPadding(14, 16, 14, 16)
  const n = wxNow(d.wx)
  const row = w.addStack()
  row.centerAlignContent()

  const L = row.addStack()
  L.layoutVertically()
  L.size = new Size(88, 0)
  txt(L, spaced(dayName(now)), F.cap(8.5), C.mid, { lines: 1, scale: 0.6 })
  txt(L, String(now.getDate()), F.num(50), C.hi)
  txt(L, monthName(now).toUpperCase(), F.cap(9), C.mid, { lines: 1, scale: 0.7 })
  txt(L, roman(now.getFullYear()), F.body(8.5), C.low)

  row.addSpacer(10)
  const v = row.addImage(vrule(size.H - 40))
  v.imageSize = new Size(9, size.H - 40)
  row.addSpacer(12)

  const R = row.addStack()
  R.layoutVertically()
  R.spacing = 8
  if (n) {
    line(R, n.sym, [[`${n.t}°`, F.num(15), C.hi], [n.cond, F.body(12), C.mid], [`H${n.hi} L${n.lo}`, F.body(11), C.low]])
  } else {
    line(R, "cloud", [["Weather offline", F.it(12), C.low]])
  }
  const e = d.events[0]
  if (e) line(R, "calendar", [[evWhen(e), F.bold(11.5), C.mid], [e.title, F.body(12), C.hi]], calURL(e))
  else line(R, "calendar", [["Clear calendar", F.it(12), C.low]])
  // row 3: the girls on a swap day, otherwise the nearest heads-up
  const hn = d.notices[0]
  if (d.girls) line(R, "figure.2.and.child.holdinghands", [[d.girls.med, F.body(12), C.hi]])
  else if (hn) line(R, "bell.fill", [[hn.when, F.bold(11.5), C.mid], [hn.title, F.body(12), C.hi]], hn.url)
  else line(R, "bell", [["No heads-ups", F.it(12), C.low]])
  const b = d.bdays[0]
  line(R, "gift", [[`${b.name} turns ${b.age}`, F.body(12), C.hi], [whenText(b), F.body(11), C.low]])
}

function large(w, d, size) {
  w.setPadding(16, 18, 12, 18)
  const IW = size.W - 36
  const n = wxNow(d.wx)

  // header
  const h = w.addStack()
  h.bottomAlignContent()
  const hl = h.addStack()
  hl.layoutVertically()
  txt(hl, spaced(dayName(now)), F.cap(9), C.mid)
  txt(hl, `${monthName(now)} ${now.getDate()}`, F.num(27), C.hi, { lines: 1, scale: 0.7 })
  h.addSpacer()
  if (n) {
    const hr = h.addStack()
    hr.layoutVertically()
    const t = hr.addStack()
    t.addSpacer()
    t.centerAlignContent()
    icon(t, n.sym, 18, C.hi)
    t.addSpacer(6)
    txt(t, `${n.t}°`, F.num(30), C.hi)
    const c2 = hr.addStack()
    c2.addSpacer()
    txt(c2, `${n.cond} · H${n.hi} L${n.lo}`, F.body(10.5), C.mid, { lines: 1, scale: 0.7 })
  }

  // 4-day strip
  if (d.wx && d.wx.daily && d.wx.daily.time && d.wx.daily.time.length > 4) {
    w.addSpacer(10)
    const s = w.addStack()
    for (let i = 1; i <= 4; i++) {
      const [y, m, dd] = d.wx.daily.time[i].split("-").map(Number)
      const day = new Date(y, m - 1, dd)
      const col = s.addStack()
      col.layoutVertically()
      col.centerAlignContent()
      const a = col.addStack(); a.addSpacer(); txt(a, dayName(day).slice(0, 3).toUpperCase(), F.cap(8.5), C.mid); a.addSpacer()
      col.addSpacer(3)
      const b = col.addStack(); b.addSpacer(); icon(b, wxInfo(d.wx.daily.weather_code[i], 1)[0], 13, C.hi); b.addSpacer()
      col.addSpacer(3)
      const c = col.addStack(); c.addSpacer()
      txt(c, `${Math.round(d.wx.daily.temperature_2m_max[i])}°`, F.body(10.5), C.hi)
      txt(c, ` ${Math.round(d.wx.daily.temperature_2m_min[i])}°`, F.body(10.5), C.low)
      c.addSpacer()
      if (i < 4) s.addSpacer()
    }
  }

  w.addSpacer(8)
  rule(w, IW)

  // agenda (heads-ups are not repeated here)
  section(w, "Agenda")
  const evs = d.events.slice(0, 3)
  if (!evs.length) txt(w, "Nothing on the calendar", F.it(12), C.low)
  evs.forEach((e, i) => {
    const r = w.addStack()
    r.centerAlignContent()
    r.url = calURL(e)
    const wcol = r.addStack()
    wcol.size = new Size(72, 0)
    txt(wcol, evWhen(e), F.bold(11), C.mid, { lines: 1, scale: 0.7 })
    wcol.addSpacer()
    txt(r, e.title, F.body(12.5), C.hi, { lines: 1, scale: 0.8 })
    r.addSpacer()
    if (i < evs.length - 1) w.addSpacer(4)
  })

  w.addSpacer(6)
  rule(w, IW)

  // household: the girls on swap days, up to 2 heads-ups, birthdays to fill 3 rows
  section(w, "Household")
  const rows = []
  if (d.girls) rows.push(["figure.2.and.child.holdinghands", [[d.girls.long, F.body(12.5), C.hi]], null])
  d.notices.slice(0, 2).forEach(nt => rows.push(["bell.fill", [[nt.title, F.body(12.5), C.hi], [nt.when, F.body(11), C.low]], nt.url]))
  d.bdays.slice(0, Math.max(1, 3 - rows.length)).forEach(b =>
    rows.push(["gift", [[`${b.name} turns ${b.age}`, F.body(12.5), C.hi], [whenText(b), F.body(11), C.low]], null]))
  rows.slice(0, 3).forEach((r, i) => {
    if (i) w.addSpacer(4)
    line(w, r[0], r[1], r[2], true)
  })

  w.addSpacer()
  const f = w.addStack()
  f.centerAlignContent()
  f.addSpacer()
  const s1 = f.addImage(starImg(7)); s1.imageSize = new Size(7, 7)
  f.addSpacer(6)
  txt(f, spaced(MOTTO, " "), F.cap(7.5), C.low, { lines: 1, scale: 0.6 })
  f.addSpacer(6)
  const s2 = f.addImage(starImg(7)); s2.imageSize = new Size(7, 7)
  f.addSpacer()
}

function buildLock(fam, d) {
  const w = new ListWidget()
  const white = Color.white()
  const n = wxNow(d.wx)
  const e = d.events[0]
  const hn = d.notices[0]
  const second = d.girls ? d.girls.short : hn ? `${hn.title} · ${hn.when}` : null
  if (fam === "accessoryCircular") {
    w.addAccessoryWidgetBackground = true
    const a = w.addStack(); a.addSpacer(); icon(a, n ? n.sym : "cloud", 12, white); a.addSpacer()
    const b = w.addStack(); b.addSpacer(); txt(b, n ? `${n.t}°` : "--", F.num(19), white, { plain: true }); b.addSpacer()
  } else if (fam === "accessoryInline") {
    const tail = second || (e ? `${evWhen(e)} ${e.title}` : "Clear calendar")
    txt(w, `${n ? n.t + "° · " : ""}${tail}`, Font.systemFont(12), white, { plain: true })
  } else {
    txt(w, e ? `${evWhen(e)} · ${e.title}` : "Clear calendar", F.bold(13), white, { lines: 1, scale: 0.7, plain: true })
    const b = d.bdays[0]
    const bday = `${b.name} turns ${b.age} ${whenText(b)}`
    const wxline = n ? `${n.t}° ${n.cond} · H${n.hi} L${n.lo}` : ""
    txt(w, second || (b.days <= 7 ? bday : wxline), F.body(12.5), white, { lines: 1, scale: 0.7, plain: true })
    txt(w, second ? (b.days <= 7 ? bday : wxline) : wxline, F.body(12.5), white, { lines: 1, scale: 0.7, plain: true })
  }
  return w
}

// ───────── PIECES ─────────
function txt(stack, s, font, color, o = {}) {
  const t = stack.addText(String(s))
  t.font = font
  t.textColor = color
  if (!o.plain) {
    t.shadowColor = C.shadow
    t.shadowRadius = 1.5
    t.shadowOffset = new Point(0, 1)
  }
  if (o.lines) t.lineLimit = o.lines
  if (o.scale) t.minimumScaleFactor = o.scale
  return t
}

function icon(stack, name, size, color) {
  let s = SFSymbol.named(name) || SFSymbol.named("circle")
  s.applyFont(Font.systemFont(size))
  const i = stack.addImage(s.image)
  i.imageSize = new Size(size + 3, size + 3)
  i.applyFittingContentMode()
  i.tintColor = color
  return i
}

function line(stack, sym, parts, url, spread) {
  const r = stack.addStack()
  r.centerAlignContent()
  if (url) r.url = url
  icon(r, sym, 11, C.mid)
  r.addSpacer(7)
  parts.forEach((p, i) => {
    if (i > 0) { if (spread && i === parts.length - 1) r.addSpacer(); else r.addSpacer(5) }
    txt(r, p[0], p[1], p[2], { lines: 1, scale: 0.7 })
  })
  r.addSpacer()
  return r
}

function section(w, label) {
  w.addSpacer(6)
  txt(w, spaced(label), F.cap(8), C.low)
  w.addSpacer(5)
}

function rule(w, width) {
  const dc = ctx(width, 10)
  const y = 5
  dc.setFillColor(C.rule)
  dc.fillRect(new Rect(0, y - 0.25, width / 2 - 10, 0.5))
  dc.fillRect(new Rect(width / 2 + 10, y - 0.25, width / 2 - 10, 0.5))
  star(dc, width / 2, y, 4.5, C.star)
  const i = w.addImage(dc.getImage())
  i.imageSize = new Size(width, 10)
  i.centerAlignImage()
}

function vrule(h) {
  const dc = ctx(9, h)
  dc.setFillColor(C.rule)
  dc.fillRect(new Rect(4.25, 0, 0.5, h / 2 - 9))
  dc.fillRect(new Rect(4.25, h / 2 + 9, 0.5, h / 2 - 9))
  star(dc, 4.5, h / 2, 4.5, C.star)
  return dc.getImage()
}

function starImg(s) {
  const dc = ctx(s, s)
  star(dc, s / 2, s / 2, s / 2, C.low)
  return dc.getImage()
}

function star(dc, cx, cy, r, col) {
  const q = r * 0.28
  const p = new Path()
  p.move(new Point(cx, cy - r))
  p.addLine(new Point(cx + q, cy - q))
  p.addLine(new Point(cx + r, cy))
  p.addLine(new Point(cx + q, cy + q))
  p.addLine(new Point(cx, cy + r))
  p.addLine(new Point(cx - q, cy + q))
  p.addLine(new Point(cx - r, cy))
  p.addLine(new Point(cx - q, cy - q))
  p.closeSubpath()
  dc.addPath(p)
  dc.setFillColor(col)
  dc.fillPath()
}

function ctx(w, h) {
  const dc = new DrawContext()
  dc.size = new Size(w, h)
  dc.opaque = false
  dc.respectScreenScale = true
  return dc
}

// ───────── BACKGROUND: black stone + engraved frame ─────────
function widgetSize(fam) {
  const s = Device.screenSize()
  const k = Math.round(Math.min(s.width, s.height))
  const T = {
    440: [170, 364, 382], 430: [170, 364, 382], 428: [170, 364, 382], 414: [169, 360, 379],
    402: [164, 348, 364], 393: [158, 338, 354], 390: [158, 338, 354], 375: [155, 329, 345],
    360: [155, 329, 345], 320: [141, 292, 311],
  }
  let r = T[k] || [Math.round(k * 0.405), Math.round(k * 0.865), Math.round(k * 0.91)]
  if (k === 375 && Math.max(s.width, s.height) < 700) r = [148, 321, 324]
  return { W: fam === "small" ? r[0] : r[1], H: fam === "large" ? r[2] : r[0] }
}

function background(fam, { W, H }) {
  const fm = FileManager.local()
  const p = fm.joinPath(fm.documentsDirectory(), `grigson-bg-v${BG_VERSION}-${fam}-${W}x${H}.png`)
  if (fm.fileExists(p)) return fm.readImage(p)

  let seed = 1337 + W * 7 + H
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647

  const dc = new DrawContext()
  dc.size = new Size(W, H)
  dc.opaque = true
  dc.respectScreenScale = true
  dc.setFillColor(new Color("#0B0B0B"))
  dc.fillRect(new Rect(0, 0, W, H))

  // soft light from above, like the crest
  for (let i = 0; i < 14; i++) {
    const rw = W * (1.3 - i * 0.07), rh = H * (0.9 - i * 0.05)
    dc.setFillColor(new Color("#FFFFFF", 0.012))
    dc.fillEllipse(new Rect(W / 2 - rw / 2, -rh * 0.45, rw, rh))
  }
  // stone mottling
  for (let i = 0; i < 70; i++) {
    const r = 8 + rnd() * 40, x = rnd() * W, y = rnd() * H
    dc.setFillColor(rnd() > 0.5 ? new Color("#FFFFFF", 0.012) : new Color("#000000", 0.07))
    dc.fillEllipse(new Rect(x - r, y - r * 0.6, r * 2, r * 1.2))
  }
  // grain
  const grains = Math.round((W * H) / 22)
  for (let i = 0; i < grains; i++) {
    const g = rnd() > 0.5 ? "#FFFFFF" : "#000000"
    dc.setFillColor(new Color(g, 0.03 + rnd() * 0.07))
    dc.fillRect(new Rect(rnd() * W, rnd() * H, 0.6 + rnd() * 0.8, 0.6 + rnd() * 0.6))
  }
  // vignette
  for (let i = 0; i < 16; i++) {
    const inset = i * 1.6
    const p2 = new Path()
    p2.addRoundedRect(new Rect(inset, inset, W - inset * 2, H - inset * 2), 22, 22)
    dc.addPath(p2)
    dc.setStrokeColor(new Color("#000000", 0.08 * (1 - i / 16)))
    dc.setLineWidth(2.2)
    dc.strokePath()
  }
  // engraved double frame
  const frame = (inset, rad, col, lw) => {
    const f = new Path()
    f.addRoundedRect(new Rect(inset, inset, W - inset * 2, H - inset * 2), rad, rad)
    dc.addPath(f)
    dc.setStrokeColor(col)
    dc.setLineWidth(lw)
    dc.strokePath()
  }
  frame(6.5, 16, new Color("#A8A8A8", 0.32), 0.8)
  frame(9.5, 13, new Color("#A8A8A8", 0.12), 0.6)
  // stars breaking the frame, top and bottom center
  ;[7.5, H - 7.5].forEach(y => {
    dc.setFillColor(new Color("#0B0B0B"))
    dc.fillRect(new Rect(W / 2 - 9, y - 3.5, 18, 7))
    star(dc, W / 2, y, 5, new Color("#BDBDBD", 0.85))
  })

  const img = dc.getImage()
  try { fm.writeImage(p, img) } catch (e) {}
  return img
}

// ───────── DATA ─────────
async function getWeather() {
  const fm = FileManager.local()
  const cache = fm.joinPath(fm.documentsDirectory(), "grigson-crest-wx.json")
  let loc = { lat: HOME.lat, lon: HOME.lon }
  if (USE_GPS) {
    try {
      Location.setAccuracyToThreeKilometers()
      const l = await Location.current()
      loc = { lat: l.latitude, lon: l.longitude }
    } catch (e) {}
  }
  const url = "https://api.open-meteo.com/v1/forecast"
    + `?latitude=${loc.lat.toFixed(3)}&longitude=${loc.lon.toFixed(3)}`
    + "&current=temperature_2m,apparent_temperature,weather_code,is_day"
    + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
    + "&temperature_unit=fahrenheit&timezone=auto&forecast_days=6"
  try {
    const r = new Request(url)
    r.timeoutInterval = 10
    const j = await r.loadJSON()
    if (!j.current) throw new Error("no data")
    fm.writeString(cache, JSON.stringify(j))
    return j
  } catch (e) {
    return fm.fileExists(cache) ? JSON.parse(fm.readString(cache)) : null
  }
}

function wxNow(wx) {
  if (!wx || !wx.current || !wx.daily) return null
  const c = wx.current, d = wx.daily
  const [sym, cond] = wxInfo(c.weather_code, c.is_day)
  return {
    t: Math.round(c.temperature_2m), sym, cond,
    hi: Math.round(d.temperature_2m_max[0]), lo: Math.round(d.temperature_2m_min[0]),
  }
}

function wxInfo(code, isDay) {
  const day = isDay !== 0
  if (code === 0) return [day ? "sun.max.fill" : "moon.stars.fill", "Clear"]
  if (code === 1) return [day ? "sun.max.fill" : "moon.stars.fill", "Mostly clear"]
  if (code === 2) return [day ? "cloud.sun.fill" : "cloud.moon.fill", "Partly cloudy"]
  if (code === 3) return ["cloud.fill", "Overcast"]
  if (code <= 48) return ["cloud.fog.fill", "Fog"]
  if (code <= 57) return ["cloud.drizzle.fill", "Drizzle"]
  if (code <= 67) return ["cloud.rain.fill", code >= 65 ? "Heavy rain" : "Rain"]
  if (code <= 77) return ["cloud.snow.fill", "Snow"]
  if (code <= 82) return ["cloud.heavyrain.fill", "Showers"]
  if (code <= 86) return ["cloud.snow.fill", "Snow showers"]
  return ["cloud.bolt.rain.fill", "Storms"]
}

// Agenda = the next 3 days of real events. Heads-ups = "Heads up: ..." titles (any calendar) or
// anything on the "Heads Up" calendar, next 8 days; they are kept out of the agenda.
async function getCalendar() {
  try {
    const list = await CalendarEvent.between(now, new Date(now.getTime() + HEADS_UP_DAYS * DAY), [])
    const isNotice = e => /^\s*heads\s*up\s*[:\-–—]/i.test(e.title || "")
      || ((e.calendar && e.calendar.title) || "").toLowerCase() === HEADS_UP_CALENDAR.toLowerCase()
    const live = list.filter(e => e.endDate > now).sort((a, b) => a.startDate - b.startDate)
    const notices = live.filter(isNotice).map(e => ({
      title: (e.title || "").replace(/^\s*heads\s*up\s*[:\-–—]\s*/i, "").trim() || "Heads up",
      when: noticeWhen(e.startDate), url: calURL(e),
    }))
    const events = live.filter(e => !isNotice(e) && e.startDate < new Date(now.getTime() + 3 * DAY))
    return { events, notices }
  } catch (e) {
    return { events: [], notices: [] }
  }
}

function noticeWhen(d) {
  const days = Math.round((midnight(d) - midnight(now)) / DAY)
  if (days <= 0) return "today"
  if (days === 1) return "tomorrow"
  if (days < 7) return dayName(d)
  return `${days} days`
}

// Only the night before and the day of a swap: Sunday says "tomorrow", Monday says "today".
// Every other day returns null and the line is left out; everyone already knows the schedule.
function girlsStatus(d) {
  const dow = d.getDay()
  if (dow !== 0 && dow !== 1) return null
  const monday = dow === 1 ? midnight(d) : new Date(midnight(d).getTime() + DAY)
  const idx = Math.floor(Math.round((monday - GIRLS_ANCHOR) / DAY) / 7)
  const mineNext = ((idx % 2) + 2) % 2 === 0          // the week that starts Monday is one of yours
  const when = dow === 0 ? "tomorrow" : "today"
  return mineNext
    ? { med: `${GIRLS} home ${when}`, long: `${GIRLS} home ${when}`, short: `Girls home ${when}` }
    : { med: `${GIRLS} to Mom's ${when}`, long: `${GIRLS} to Mom's ${when}`, short: `Girls to Mom's ${when}` }
}

function nextBirthdays(d) {
  const day0 = midnight(d)
  return FAMILY.map(p => {
    let next = new Date(day0.getFullYear(), p.m - 1, p.d)
    if (next < day0) next = new Date(day0.getFullYear() + 1, p.m - 1, p.d)
    return { name: p.name, next, days: Math.round((next - day0) / DAY), age: next.getFullYear() - p.y }
  }).sort((a, b) => a.days - b.days)
}

// ───────── HELPERS ─────────
function whenText(b) {
  if (b.days === 0) return "today"
  if (b.days === 1) return "tomorrow"
  if (b.days < 7) return dayName(b.next)
  return `${b.days} days`
}

function evWhen(e) {
  const same = (a, b) => a.toDateString() === b.toDateString()
  const tmr = new Date(now.getTime() + DAY)
  const day = same(e.startDate, now) ? "" : same(e.startDate, tmr) ? "Tmrw " : dayName(e.startDate).slice(0, 3) + " "
  if (e.isAllDay) return day ? day.trim() : "Today"
  if (e.startDate <= now) return "Now"
  const t = new DateFormatter()
  t.useNoDateStyle()
  t.useShortTimeStyle()
  return day + t.string(e.startDate)
}

function calURL(e) {
  return "calshow:" + Math.floor(e.startDate.getTime() / 1000 - 978307200)
}

function midnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function fmt(d, f) { const x = new DateFormatter(); x.dateFormat = f; return x.string(d) }
function dayName(d) { return fmt(d, "EEEE") }
function monthName(d) { return fmt(d, "MMMM") }
function spaced(s, gap = " ") { return s.toUpperCase().split("").join(gap) }
function roman(n) {
  const m = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]
  let s = ""
  for (const [v, r] of m) while (n >= v) { s += r; n -= v }
  return s
}
