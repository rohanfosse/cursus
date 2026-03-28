#!/usr/bin/env node
// ─── Génération des icônes Cursus ────────────────────────────────────────────
// Usage: node scripts/generate-icons.js
//
// Prend l'icône originale (resources/icon-original.png) et génère :
// - Master 1024x1024 avec fond carré arrondi dégradé
// - Toutes les tailles pour Electron (16→1024)
// - Icônes PWA (192, 512)
// - Variante monochrome blanche pour le tray
// - Fichier .ico pour Windows

const sharp = require('sharp')
const { join } = require('path')
const { writeFileSync, mkdirSync } = require('fs')

const ROOT = join(__dirname, '..')
const RESOURCES = join(ROOT, 'resources')
const ICONS_DIR = join(RESOURCES, 'icons')
const WEB_ASSETS = join(ROOT, 'src', 'web', 'public', 'assets')

const SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
const ICO_SIZES = [16, 32, 48, 256]

// Couleurs du dégradé (bleu → vert, du logo existant)
const BG_COLOR_TOP = { r: 26, g: 80, b: 180 }     // bleu foncé
const BG_COLOR_BOTTOM = { r: 40, g: 190, b: 100 }  // vert

async function createRoundedBackground(size, cornerRadius) {
  // Créer un dégradé vertical via SVG
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="rgb(${BG_COLOR_TOP.r},${BG_COLOR_TOP.g},${BG_COLOR_TOP.b})" />
        <stop offset="100%" stop-color="rgb(${BG_COLOR_BOTTOM.r},${BG_COLOR_BOTTOM.g},${BG_COLOR_BOTTOM.b})" />
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" rx="${cornerRadius}" ry="${cornerRadius}" fill="url(#bg)" />
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function main() {
  mkdirSync(ICONS_DIR, { recursive: true })

  const originalPath = join(RESOURCES, 'icon-original.png')
  console.log('📦 Chargement et nettoyage de l\'icône originale...')

  // 1a. Trimmer les pixels transparents/blancs autour de l'oiseau
  const trimmed = await sharp(originalPath)
    .trim({ threshold: 20 })
    .png()
    .toBuffer()
  console.log('  ✓ Trim des marges transparentes')

  // 1b. Supprimer le halo blanc (fringe) : rendre transparents les pixels quasi-blancs
  //     en reduisant l'opacite des pixels clairs proches du contour
  const { width: tw, height: th } = await sharp(trimmed).metadata()
  const { data, info } = await sharp(trimmed)
    .raw()
    .toBuffer({ resolveWithObject: true })

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
    // Pixels presque blancs avec alpha partiel = fringe
    if (a > 0 && r > 220 && g > 220 && b > 220) {
      // Rendre completement transparent
      data[i + 3] = 0
    }
    // Pixels semi-transparents clairs = reduire leur opacite
    if (a > 0 && a < 200 && r > 180 && g > 180 && b > 180) {
      data[i + 3] = Math.max(0, a - 80)
    }
  }

  const cleaned = await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png()
    .toBuffer()
  console.log('  ✓ Suppression du halo blanc (fringe)')

  const masterSize = 1024
  const cornerRadius = Math.round(masterSize * 0.22) // ~22% arrondi (style iOS/macOS)
  const padding = Math.round(masterSize * 0.12)       // 12% padding (reduit pour plus de presence)

  // 2. Créer le fond dégradé arrondi
  console.log('🎨 Création du fond dégradé arrondi...')
  const bg = await createRoundedBackground(masterSize, cornerRadius)

  // 3. Redimensionner l'icône nettoyée avec padding
  const iconSize = masterSize - padding * 2
  const resizedIcon = await sharp(cleaned)
    .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  // 4. Composer : fond + icône centrée
  console.log('🔧 Composition master 1024x1024...')
  const master = await sharp(bg)
    .composite([{ input: resizedIcon, top: padding, left: padding }])
    .png()
    .toBuffer()

  // 4. Sauvegarder le master
  const masterPath = join(ICONS_DIR, '1024x1024.png')
  writeFileSync(masterPath, master)
  console.log(`  ✓ ${masterPath}`)

  // 5. Générer toutes les tailles
  console.log('📐 Génération des tailles multiples...')
  const icoBuffers = []

  for (const size of SIZES) {
    const buf = await sharp(master).resize(size, size).png().toBuffer()
    const outPath = join(ICONS_DIR, `${size}x${size}.png`)
    writeFileSync(outPath, buf)
    console.log(`  ✓ ${size}x${size}`)

    if (ICO_SIZES.includes(size)) {
      icoBuffers.push({ size, buf })
    }

    // Copies spéciales
    if (size === 512) {
      writeFileSync(join(RESOURCES, 'icon.png'), buf)
      writeFileSync(join(WEB_ASSETS, 'icon-512.png'), buf)
    }
    if (size === 192) {
      // Générer 192 même si pas dans SIZES standard
    }
  }

  // 6. Générer 192x192 pour PWA
  const pwa192 = await sharp(master).resize(192, 192).png().toBuffer()
  writeFileSync(join(WEB_ASSETS, 'icon-192.png'), pwa192)
  console.log('  ✓ PWA 192x192')

  // 7. Générer variante tray monochrome (blanc sur transparent)
  console.log('🔲 Génération variante tray monochrome...')
  const traySize = 32
  // Reconstruire : blanc avec l'alpha de l'icône nettoyée
  const whiteTray = await sharp({
    create: { width: traySize, height: traySize, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } },
  })
    .composite([{
      input: await sharp(cleaned)
        .resize(traySize, traySize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .tint({ r: 255, g: 255, b: 255 })
        .png()
        .toBuffer(),
      top: 0,
      left: 0,
    }])
    .png()
    .toBuffer()

  writeFileSync(join(RESOURCES, 'icon-tray.png'), whiteTray)
  console.log('  ✓ icon-tray.png (32x32 blanc)')

  // 8. Générer badge de notification (pastille rouge avec contour blanc)
  console.log('🔴 Génération badge notification...')
  const badgeSize = 32
  const badgeSvg = `<svg width="${badgeSize}" height="${badgeSize}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${badgeSize / 2}" cy="${badgeSize / 2}" r="${badgeSize / 2 - 1}" fill="#E74C3C" />
    <circle cx="${badgeSize / 2}" cy="${badgeSize / 2}" r="${badgeSize / 2 - 3}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" />
  </svg>`
  const badge = await sharp(Buffer.from(badgeSvg)).png().toBuffer()
  writeFileSync(join(RESOURCES, 'badge-notif.png'), badge)
  console.log('  ✓ badge-notif.png (32x32 pastille rouge)')

  // 9. Générer splash-logo.png (128x128 avec fond dégradé)
  console.log('🖼️  Génération splash-logo.png...')
  const splashLogo = await sharp(master).resize(128, 128).png().toBuffer()
  writeFileSync(join(RESOURCES, 'splash-logo.png'), splashLogo)
  console.log('  ✓ splash-logo.png (128x128)')

  // 10. Générer bannières installer NSIS (BMP 24 bits)
  console.log('🪟 Génération bannières installer...')

  // Header banner : 150x57 — petit logo + dégradé horizontal
  const headerW = 150, headerH = 57
  const headerSvg = `<svg width="${headerW}" height="${headerH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="hbg" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="rgb(${BG_COLOR_TOP.r},${BG_COLOR_TOP.g},${BG_COLOR_TOP.b})" />
        <stop offset="100%" stop-color="rgb(${BG_COLOR_BOTTOM.r},${BG_COLOR_BOTTOM.g},${BG_COLOR_BOTTOM.b})" />
      </linearGradient>
    </defs>
    <rect width="${headerW}" height="${headerH}" fill="url(#hbg)" />
    <text x="75" y="34" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
          font-size="16" font-weight="700" fill="white" opacity="0.95">Cursus</text>
  </svg>`
  const headerPng = await sharp(Buffer.from(headerSvg))
    .flatten({ background: { r: 26, g: 80, b: 180 } })
    .png()
    .toBuffer()
  writeFileSync(join(RESOURCES, 'installer-header.bmp'), headerPng)
  console.log('  ✓ installer-header.bmp (150x57)')

  // Sidebar banner : 164x314 — logo centré + dégradé vertical
  const sideW = 164, sideH = 314
  const sideLogoSize = 64
  const sideLogoY = Math.round(sideH * 0.3 - sideLogoSize / 2)
  const sideTextY = Math.round(sideH * 0.3 + sideLogoSize / 2 + 24)
  const sideSubY = sideTextY + 18
  const sidebarSvg = `<svg width="${sideW}" height="${sideH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sbg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgb(${BG_COLOR_TOP.r},${BG_COLOR_TOP.g},${BG_COLOR_TOP.b})" />
        <stop offset="100%" stop-color="rgb(${BG_COLOR_BOTTOM.r},${BG_COLOR_BOTTOM.g},${BG_COLOR_BOTTOM.b})" />
      </linearGradient>
    </defs>
    <rect width="${sideW}" height="${sideH}" fill="url(#sbg)" />
    <text x="${sideW / 2}" y="${sideTextY}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
          font-size="20" font-weight="800" fill="white">Cursus</text>
    <text x="${sideW / 2}" y="${sideSubY}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
          font-size="9" fill="rgba(255,255,255,0.5)" letter-spacing="1.5">PLATEFORME DE FORMATION</text>
  </svg>`

  // Composer le SVG sidebar + logo icône
  const sidebarBg = await sharp(Buffer.from(sidebarSvg)).png().toBuffer()
  const sidebarLogoIcon = await sharp(master)
    .resize(sideLogoSize, sideLogoSize)
    .png()
    .toBuffer()
  const sidebarComposed = await sharp(sidebarBg)
    .composite([{
      input: sidebarLogoIcon,
      top: sideLogoY,
      left: Math.round((sideW - sideLogoSize) / 2),
    }])
    .flatten({ background: { r: 26, g: 80, b: 180 } })
    .png()
    .toBuffer()
  writeFileSync(join(RESOURCES, 'installer-sidebar.bmp'), sidebarComposed)
  console.log('  ✓ installer-sidebar.bmp (164x314)')

  // 11. Générer .ico
  console.log('🪟 Génération icon.ico...')
  try {
    const icoPngs = icoBuffers.map(b => b.buf)
    const { default: pngToIco } = await import('png-to-ico')
    const ico = await pngToIco(icoPngs)
    writeFileSync(join(ICONS_DIR, 'icon.ico'), ico)
    writeFileSync(join(RESOURCES, 'icon.ico'), ico)
    console.log('  ✓ icon.ico')
  } catch (err) {
    console.error('  ✗ Erreur ICO:', err.message)
  }

  console.log('\n✅ Génération terminée !')
}

main().catch(err => {
  console.error('Erreur:', err)
  process.exit(1)
})
