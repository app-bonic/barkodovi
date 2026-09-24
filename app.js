'use strict';
const { $, $$, esc, ikona, obavijest, spremi } = AB;

// ---------------- arci naljepnica (mm) ----------------
const ARCI = {
  '3x7': { s: 3, r: 7, w: 70, h: 42.3, gx: 0, gy: 0 },
  '3x8': { s: 3, r: 8, w: 70, h: 37, gx: 0, gy: 0 },
  '2x7': { s: 2, r: 7, w: 99.1, h: 38.1, gx: 2.5, gy: 0 },
  '4x10': { s: 4, r: 10, w: 48.5, h: 25.4, gx: 0, gy: 0 },
  '5x13': { s: 5, r: 13, w: 38.1, h: 21.2, gx: 2.5, gy: 0 },
  '1x1': { s: 1, r: 1, w: 210, h: 297, gx: 0, gy: 0 },
};
function arak() {
  const v = $('#arak').value;
  const a = v === 'vlastito'
    ? { s: +$('#stupci').value || 1, r: +$('#redovi').value || 1, w: +$('#sirina').value || 50, h: +$('#visina').value || 30, gx: +$('#razmakX').value || 0, gy: +$('#razmakY').value || 0 }
    : ARCI[v];
  const sirina = a.s * a.w + (a.s - 1) * a.gx, visina = a.r * a.h + (a.r - 1) * a.gy;
  return { ...a, mx: (210 - sirina) / 2, my: (297 - visina) / 2, preveliko: sirina > 210.5 || visina > 297.5 };
}

// ---------------- provjera kodova ----------------
const DULJINE = { ean13: 12, ean8: 7, upca: 11, itf14: 13 };
function kontrolna(znam) {
  let z = 0;
  [...znam].reverse().forEach((c, i) => { z += +c * (i % 2 === 0 ? 3 : 1); });
  return (10 - z % 10) % 10;
}
function pripremi(vrsta, kod) {
  let k = kod.trim();
  if (!k) return { greska: 'prazno' };
  if (DULJINE[vrsta]) {
    k = k.replace(/[\s-]/g, '');
    const n = DULJINE[vrsta];
    if (!/^\d+$/.test(k)) return { greska: `„${kod}” — smije sadržavati samo znamenke.` };
    if (k.length === n) return { kod: k + kontrolna(k), dodano: true };
    if (k.length === n + 1) {
      const kk = kontrolna(k.slice(0, n));
      if (kk !== +k[n]) return { greska: `„${k}” — kontrolna znamenka treba biti ${kk}.` };
      return { kod: k };
    }
    return { greska: `„${kod}” — treba ${n} ili ${n + 1} znamenki.` };
  }
  if (vrsta === 'code39') {
    k = k.toUpperCase();
    if (!/^[0-9A-Z \-.$/+%]+$/.test(k)) return { greska: `„${kod}” — Code 39 podržava samo A–Z, 0–9 i - . $ / + % razmak.` };
  }
  if (vrsta === 'code128' && !/^[\x20-\x7e]+$/.test(k)) return { greska: `„${kod}” — Code 128 ne podržava č, ć, ž, š, đ ni posebne znakove. Koristi QR ili DataMatrix.` };
  return { kod: k };
}

const predmemorija = new Map();
function svg(vrsta, kod) {
  const kljuc = vrsta + '|' + kod + '|' + $('#tekstKoda').checked;
  if (predmemorija.has(kljuc)) return predmemorija.get(kljuc);
  const dvod = vrsta === 'qrcode' || vrsta === 'datamatrix';
  const opcije = { bcid: vrsta, text: kod, scale: 2, textxalign: 'center', includetext: !dvod && $('#tekstKoda').checked, textsize: 9 };
  if (!dvod) opcije.height = vrsta === 'itf14' ? 14 : 12;
  if (vrsta === 'itf14') opcije.showborder = false;
  if (vrsta === 'qrcode') opcije.eclevel = 'M';
  const s = bwipjs.toSVG(opcije);
  predmemorija.set(kljuc, s);
  if (predmemorija.size > 3000) predmemorija.clear();
  return s;
}

// ---------------- crtanje ----------------
let stavke = [];
function nacrtaj() {
  const vrsta = $('#vrsta').value;
  const redovi = $('#kodovi').value.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
  const poruke = [];
  let dodanih = 0;
  stavke = [];
  for (const r of redovi) {
    const [kod, ...opis] = r.split(';');
    const p = pripremi(vrsta, kod);
    if (p.greska) { poruke.push(p.greska); continue; }
    if (p.dodano) dodanih++;
    stavke.push({ kod: p.kod, opis: opis.join(';').trim() });
  }
  if (dodanih) poruke.unshift(`Kontrolna znamenka dodana na ${dodanih} ${AB.mn(dodanih, 'kod', 'koda', 'kodova')}.`);
  $('#kodoviInfo').textContent = stavke.length ? `${stavke.length} ${AB.mn(stavke.length, 'ispravan kod', 'ispravna koda', 'ispravnih kodova')}` : '';
  $('#poruke').innerHTML = poruke.slice(0, 8).map((t, i) => `<div class="poruka ${i === 0 && dodanih ? 'info' : 'upoz'}">${ikona(i === 0 && dodanih ? 'info' : 'oprez')}<span>${esc(t)}</span></div>`).join('')
    + (poruke.length > 8 ? `<p class="napomena">…i još ${poruke.length - 8}.</p>` : '');

  // veliki prikaz prvog koda
  try { $('#jedan').innerHTML = stavke[0] ? svg(vrsta, stavke[0].kod) : ''; }
  catch (e) { $('#jedan').innerHTML = `<p class="poruka greska">${esc(e.message)}</p>`; }
  ['#ispisi', '#png', '#svg'].forEach(s => { $(s).disabled = !stavke.length; });

  // arci
  const a = arak();
  $('.vlastito').hidden = $('#arak').value !== 'vlastito';
  if (a.preveliko) poruke.push('Naljepnice s tim mjerama ne stanu na A4.');
  const kopija = Math.max(1, Math.min(500, +$('#kopija').value || 1));
  const preskoci = Math.max(0, +$('#preskoci').value || 0);
  const naljepnice = [...Array(preskoci).fill(null), ...stavke.flatMap(s => Array(kopija).fill(s))];
  const poArku = a.s * a.r;
  const brojAraka = Math.max(1, Math.ceil(naljepnice.length / poArku));
  if (brojAraka > 60) { $('#arci').innerHTML = `<div class="poruka upoz">${ikona('oprez')}<span>To je ${brojAraka} araka — smanji broj kopija ili kodova (najviše 60 araka odjednom).</span></div>`; return; }
  const okvir = $('#okvir').checked ? ' okvir' : '';
  let html = '';
  for (let p = 0; p < brojAraka; p++) {
    let cel = '';
    for (let i = 0; i < poArku; i++) {
      const n = naljepnice[p * poArku + i];
      const st = i % a.s, rd = Math.floor(i / a.s);
      const poz = `left:${a.mx + st * (a.w + a.gx)}mm;top:${a.my + rd * (a.h + a.gy)}mm;width:${a.w}mm;height:${a.h}mm`;
      if (n === undefined) continue;
      if (n === null) { cel += `<div class="naljepnica prazna" style="${poz}"></div>`; continue; }
      let s;
      try { s = svg(vrsta, n.kod); } catch (e) { cel += `<div class="naljepnica greska${okvir}" style="${poz}">${esc(e.message)}</div>`; continue; }
      cel += `<div class="naljepnica${okvir}" style="${poz}">${s}${n.opis ? `<div class="opis">${esc(n.opis)}</div>` : ''}</div>`;
    }
    html += `<div class="arak-omot"><div class="arak">${cel}</div></div>`;
  }
  $('#arci').innerHTML = stavke.length ? html : '';
  skaliraj();
}

function skaliraj() {
  const mmPx = 96 / 25.4;
  $$('.arak-omot').forEach(o => {
    const k = Math.min(1, o.clientWidth / (210 * mmPx));
    o.firstElementChild.style.transform = `scale(${k})`;
    o.style.height = 297 * mmPx * k + 'px';
  });
}
window.addEventListener('resize', skaliraj);

let tajmer;
const osvjezi = () => { clearTimeout(tajmer); tajmer = setTimeout(nacrtaj, 150); };
document.querySelector('main').addEventListener('input', e => { if (!e.target.closest('.generator')) osvjezi(); });

$('#generiraj').onclick = () => {
  const od = Math.trunc(+$('#gOd').value || 0), n = Math.max(1, Math.min(2000, Math.trunc(+$('#gKoliko').value || 1))), z = Math.max(1, Math.min(12, +$('#gZnam').value || 1));
  const niz = Array.from({ length: n }, (_, i) => $('#gPrefiks').value + String(od + i).padStart(z, '0') + $('#gSufiks').value);
  const t = $('#kodovi');
  t.value = (t.value.trim() ? t.value.trim() + '\n' : '') + niz.join('\n');
  nacrtaj();
};
$('#ispisi').onclick = () => { window.print(); };
$('#svg').onclick = () => stavke[0] && spremi(new Blob([svg($('#vrsta').value, stavke[0].kod)], { type: 'image/svg+xml' }), `barkod-${stavke[0].kod.replace(/[^\w-]/g, '_')}.svg`);
$('#png').onclick = () => {
  if (!stavke[0]) return;
  const c = document.createElement('canvas');
  try { bwipjs.toCanvas(c, { bcid: $('#vrsta').value, text: stavke[0].kod, scale: 5, includetext: $('#tekstKoda').checked && !['qrcode', 'datamatrix'].includes($('#vrsta').value), textxalign: 'center', height: 15, paddingwidth: 8, paddingheight: 8, backgroundcolor: 'FFFFFF' }); }
  catch (e) { return obavijest(e.message); }
  c.toBlob(b => spremi(b, `barkod-${stavke[0].kod.replace(/[^\w-]/g, '_')}.png`));
};
if (!$('#kodovi').value) $('#kodovi').value = 'INV-0001; Laptop\nINV-0002; Monitor\nINV-0003; Pisač';
nacrtaj();
