"use strict";
/**
 * Zmensena verzia karty pre prehliadac (bez zmeny spravania):
 *   www/smart-heating-card.js          zdrojak - jediny subor, ktory sa upravuje a testuje
 *   www/smart-heating-card.min.js      minifikovany (terser), 1. riadok nesie sha256 zdrojaka
 *   www/smart-heating-card.min.js.gz   gzip - HA (aiohttp) ho posle sam, ked prehliadac podporuje gzip
 *
 * Integracia pri starte overi sha256: ked min verzia nesedi so zdrojakom (niekto upravil
 * kartu a zabudol `npm run build`), servuje sa zdrojak - nikdy nie stara karta.
 *
 *   npm run build          vytvori subory
 *   npm run build -- --check   len overi, ze su aktualne (CI)
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const { minify } = require("terser");

const WWW = path.join(__dirname, "..", "custom_components", "smart_heating", "www");
const SRC = path.join(WWW, "smart-heating-card.js");
const MIN = path.join(WWW, "smart-heating-card.min.js");
const GZ = MIN + ".gz";

function header(hash) {
  const ver = (fs.readFileSync(SRC, "utf8").match(/const CARD_VERSION = "([^"]+)"/) || [])[1] || "?";
  return `/*! smart-heating-card ${ver} | src-sha256:${hash} | zdrojak: smart-heating-card.js */`;
}

async function build() {
  const src = fs.readFileSync(SRC);
  const hash = crypto.createHash("sha256").update(src).digest("hex");
  const out = await minify(src.toString("utf8"), {
    ecma: 2020,
    compress: { passes: 2 },
    mangle: true,                 // len lokalne mena; globalne funkcie a triedy ostavaju
    format: { comments: false, preamble: header(hash) },
  });
  const min = Buffer.from(out.code + "\n", "utf8");
  const gz = zlib.gzipSync(min, { level: 9 });
  return { hash, min, gz, srcLen: src.length };
}

(async () => {
  const check = process.argv.includes("--check");
  const { hash, min, gz, srcLen } = await build();
  if (check) {
    const cur = fs.existsSync(MIN) ? fs.readFileSync(MIN) : Buffer.alloc(0);
    const curGz = fs.existsSync(GZ) ? zlib.gunzipSync(fs.readFileSync(GZ)) : Buffer.alloc(0);
    if (!cur.equals(min) || !curGz.equals(min)) {
      console.error("smart-heating-card.min.js nie je aktualny - spusti: npm run build");
      process.exit(1);
    }
    console.log(`OK - min verzia zodpoveda zdrojaku (sha256 ${hash.slice(0, 12)}…)`);
    return;
  }
  fs.writeFileSync(MIN, min);
  fs.writeFileSync(GZ, gz);
  const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
  console.log(`zdrojak ${kb(srcLen)} -> min ${kb(min.length)} -> gzip ${kb(gz.length)}`);
})().catch((e) => { console.error(e); process.exit(1); });
