// Renders the app icons from scripts/icon/*.svg. Run from the repo root:
//   NODE_PATH=../mental-note/node_modules node scripts/icon/render-icons.cjs
// icon.svg (green felt) -> public/, icon-dev.svg (orange felt) -> public-dev/,
// which vite.config.js copies over the green ones in dev builds.
const { webkit } = require('playwright')
const fs = require('fs')
const path = require('path')

const sizes = [
  ['apple-touch-icon.png', 180],
  ['icon.png', 512],
  ['icons/icon-192.png', 192],
  ['icons/icon-512.png', 512],
]
const sets = [
  ['icon.svg', 'public'],
  ['icon-dev.svg', 'public-dev'],
]

;(async () => {
  const browser = await webkit.launch()
  for (const [src, dir] of sets) {
    const svg = fs.readFileSync(path.join(__dirname, src), 'utf8')
    for (const [file, size] of sizes) {
      const page = await browser.newPage({ viewport: { width: size, height: size } })
      await page.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`)
      await page.screenshot({ path: path.join(dir, file) })
      await page.close()
      console.log(path.join(dir, file), size)
    }
  }
  await browser.close()
})()
