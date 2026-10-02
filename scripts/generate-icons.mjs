/**
 * Генератор иконок приложения: скруглённый квадрат с градиентом и галочкой.
 * Пишет PNG напрямую (IHDR/IDAT/IEND + zlib), чтобы не тянуть графическую
 * библиотеку ради нескольких файлов.
 *
 * Запуск: npm run icons
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'build', 'icons')
const SIZES = [16, 24, 32, 48, 64, 128, 256, 512]

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData), 0)
  return Buffer.concat([length, typeAndData, crc])
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1)
    raw[rowStart] = 0 // фильтр None
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // бит на канал
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Знаковое расстояние до скруглённого прямоугольника (отрицательное — внутри). */
function sdRoundRect(px, py, halfW, halfH, radius) {
  const qx = Math.abs(px) - halfW + radius
  const qy = Math.abs(py) - halfH + radius
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
  )
}

function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax
  const pay = py - ay
  const bax = bx - ax
  const bay = by - ay
  const denominator = bax * bax + bay * bay
  const h = denominator === 0 ? 0 : Math.min(1, Math.max(0, (pax * bax + pay * bay) / denominator))
  return Math.hypot(pax - bax * h, pay - bay * h)
}

const GRADIENT_FROM = [0x4a, 0xde, 0x80] // зелёный
const GRADIENT_TO = [0x22, 0xd3, 0xee] // бирюзовый

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4)
  const samples = 4 // сглаживание суперсэмплингом
  const step = 1 / samples
  const margin = 0.045
  const half = 0.5 - margin
  const radius = 0.22
  const strokeHalf = 0.062
  const checkA = [-0.235, 0.02]
  const checkB = [-0.07, 0.185]
  const checkC = [0.245, -0.2]

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let inside = 0
      let mark = 0
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = (x + (sx + 0.5) * step) / size - 0.5
          const py = (y + (sy + 0.5) * step) / size - 0.5
          if (sdRoundRect(px, py, half, half, radius) <= 0) inside += 1
          const d = Math.min(
            sdSegment(px, py, checkA[0], checkA[1], checkB[0], checkB[1]),
            sdSegment(px, py, checkB[0], checkB[1], checkC[0], checkC[1]),
          )
          if (d <= strokeHalf) mark += 1
        }
      }
      const total = samples * samples
      const bgAlpha = inside / total
      const markAlpha = mark / total
      // Диагональный градиент по всей плашке
      const t = Math.min(1, Math.max(0, (x / size + y / size) * 0.75))
      const bg = [
        Math.round(GRADIENT_FROM[0] + (GRADIENT_TO[0] - GRADIENT_FROM[0]) * t),
        Math.round(GRADIENT_FROM[1] + (GRADIENT_TO[1] - GRADIENT_FROM[1]) * t),
        Math.round(GRADIENT_FROM[2] + (GRADIENT_TO[2] - GRADIENT_FROM[2]) * t),
      ]
      const alpha = bgAlpha
      // Галочка белая, поверх плашки
      const m = markAlpha
      const r = Math.round(bg[0] * (1 - m) + 255 * m)
      const g = Math.round(bg[1] * (1 - m) + 255 * m)
      const b = Math.round(bg[2] * (1 - m) + 255 * m)
      const offset = (y * size + x) * 4
      pixels[offset] = r
      pixels[offset + 1] = g
      pixels[offset + 2] = b
      pixels[offset + 3] = Math.round(alpha * 255)
    }
  }
  return encodePng(size, size, pixels)
}

mkdirSync(OUT_DIR, { recursive: true })
for (const size of SIZES) {
  writeFileSync(path.join(OUT_DIR, `icon-${size}.png`), drawIcon(size))
}
writeFileSync(path.join(OUT_DIR, 'icon.png'), drawIcon(512))
writeFileSync(path.join(OUT_DIR, 'tray.png'), drawIcon(64))
writeFileSync(path.join(OUT_DIR, 'tray@2x.png'), drawIcon(128))
console.log(`Иконки записаны в ${path.relative(process.cwd(), OUT_DIR)}: ${SIZES.join(', ')} px`)