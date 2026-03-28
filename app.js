(() => {
  'use strict'

  const canvas = document.getElementById('lamp-canvas')
  const ctx = canvas.getContext('2d')

  const lavaColorInput = document.getElementById('lava-color')
  const liquidColorInput = document.getElementById('liquid-color')
  const lavaColorValue = document.getElementById('lava-color-value')
  const liquidColorValue = document.getElementById('liquid-color-value')
  const heatLevelInput = document.getElementById('heat-level')
  const blobCountInput = document.getElementById('blob-count')
  const shufflePaletteBtn = document.getElementById('shuffle-palette')

  const palettes = [
    { lava: '#ff6b3d', liquid: '#4b2a8f' },
    { lava: '#ff4f8b', liquid: '#2a3f8f' },
    { lava: '#ffd166', liquid: '#234e70' },
    { lava: '#8aff80', liquid: '#244b5a' },
    { lava: '#ff7b72', liquid: '#3d246c' }
  ]

  const state = {
    dpr: Math.max(1, window.devicePixelRatio || 1),
    width: window.innerWidth,
    height: window.innerHeight,
    time: 0,
    heat: 1,
    targetBlobCount: 12,
    lavaColor: lavaColorInput.value,
    liquidColor: liquidColorInput.value,
    blobs: []
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
  }

  function hexToRgb(hex) {
    const safe = String(hex || '#ffffff').replace('#', '')
    const full = safe.length === 3 ? safe.split('').map((char) => char + char).join('') : safe
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16)
    }
  }

  function rgba(hex, alpha) {
    const { r, g, b } = hexToRgb(hex)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  function lerp(a, b, t) {
    return a + (b - a) * t
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min)
  }

  function resize() {
    state.width = window.innerWidth
    state.height = window.innerHeight
    state.dpr = Math.max(1, window.devicePixelRatio || 1)
    canvas.width = Math.floor(state.width * state.dpr)
    canvas.height = Math.floor(state.height * state.dpr)
    canvas.style.width = `${state.width}px`
    canvas.style.height = `${state.height}px`
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0)
    ensureBlobCount()
  }

  function getLampMetrics() {
    const cx = state.width * 0.5
    const topY = state.height * 0.11
    const bottomY = state.height * 0.89
    const bodyWidth = Math.min(320, state.width * 0.34)
    const neckWidth = bodyWidth * 0.42
    const baseWidth = bodyWidth * 0.7
    const lampHeight = bottomY - topY
    return { cx, topY, bottomY, bodyWidth, neckWidth, baseWidth, lampHeight }
  }

  function getLampHalfWidthAt(y) {
    const { topY, bottomY, bodyWidth, neckWidth, baseWidth } = getLampMetrics()
    const t = clamp((y - topY) / (bottomY - topY), 0, 1)
    const widthA = lerp(neckWidth * 0.5, bodyWidth * 0.52, Math.sin(t * Math.PI * 0.55))
    const widthB = lerp(bodyWidth * 0.52, baseWidth * 0.5, Math.max(0, (t - 0.58) / 0.42))
    return t < 0.58 ? widthA : widthB
  }

  function createBlob(fromBottom = false) {
    const { cx, topY, bottomY, lampHeight } = getLampMetrics()
    const y = fromBottom
      ? bottomY - randomBetween(lampHeight * 0.02, lampHeight * 0.1)
      : randomBetween(topY + lampHeight * 0.18, bottomY - lampHeight * 0.18)
    const halfWidth = getLampHalfWidthAt(y)
    const radius = randomBetween(26, 60)

    return {
      x: cx + randomBetween(-halfWidth * 0.32, halfWidth * 0.32),
      y,
      radius,
      baseRadius: radius,
      vx: randomBetween(-0.12, 0.12),
      vy: randomBetween(-0.5, -0.1),
      wobble: randomBetween(0, Math.PI * 2),
      wobbleSpeed: randomBetween(0.012, 0.03),
      stretch: randomBetween(0.88, 1.16),
      heat: randomBetween(0.75, 1.2),
      cooling: randomBetween(0.0012, 0.0026),
      splitTimer: randomBetween(220, 520)
    }
  }

  function ensureBlobCount() {
    while (state.blobs.length < state.targetBlobCount) {
      state.blobs.push(createBlob(true))
    }
    while (state.blobs.length > state.targetBlobCount) {
      state.blobs.pop()
    }
  }

  function updateBlobs() {
    const { cx, topY, bottomY } = getLampMetrics()

    state.blobs.forEach((blob) => {
      blob.wobble += blob.wobbleSpeed
      blob.heat -= blob.cooling * (1 / state.heat)
      if (blob.heat < 0.45) blob.vy += 0.012
      else blob.vy -= 0.006 * state.heat

      blob.vx += Math.sin(blob.wobble) * 0.003
      blob.vx *= 0.994
      blob.vy *= 0.998
      blob.x += blob.vx * 1.2
      blob.y += blob.vy * 1.2

      const horizontalLimit = getLampHalfWidthAt(blob.y) - blob.radius * 0.42
      const dx = blob.x - cx
      if (dx < -horizontalLimit || dx > horizontalLimit) {
        blob.vx *= -0.9
        blob.x = cx + clamp(dx, -horizontalLimit, horizontalLimit)
      }

      if (blob.y < topY + blob.radius * 0.9) {
        blob.y = topY + blob.radius * 0.9
        blob.vy = Math.abs(blob.vy) * 0.35
        blob.heat = randomBetween(0.35, 0.6)
      }

      if (blob.y > bottomY - blob.radius * 0.6) {
        blob.y = bottomY - blob.radius * 0.6
        blob.vy = -randomBetween(0.3, 0.9) * state.heat
        blob.heat = randomBetween(0.9, 1.35)
      }

      blob.radius = blob.baseRadius * lerp(0.9, 1.16, (Math.sin(blob.wobble * 1.2) + 1) * 0.5)
      blob.stretch = lerp(0.82, 1.24, (Math.cos(blob.wobble * 0.9) + 1) * 0.5)
      blob.splitTimer -= 1
    })

    handleBlobInteractions()
    maybeSplitBlob()
  }

  function handleBlobInteractions() {
    for (let i = 0; i < state.blobs.length; i += 1) {
      for (let j = i + 1; j < state.blobs.length; j += 1) {
        const a = state.blobs[i]
        const b = state.blobs[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.hypot(dx, dy) || 0.001
        const target = (a.radius + b.radius) * 0.82

        if (dist < target) {
          const overlap = (target - dist) / target
          const pull = overlap * 0.024
          a.vx += dx * pull * 0.018
          a.vy += dy * pull * 0.018
          b.vx -= dx * pull * 0.018
          b.vy -= dy * pull * 0.018

          if (overlap > 0.34 && state.blobs.length > 6) {
            const mergedRadius = Math.sqrt(a.baseRadius * a.baseRadius + b.baseRadius * b.baseRadius) * 0.94
            a.x = (a.x + b.x) * 0.5
            a.y = (a.y + b.y) * 0.5
            a.vx = (a.vx + b.vx) * 0.5
            a.vy = (a.vy + b.vy) * 0.5
            a.baseRadius = clamp(mergedRadius, 28, 82)
            a.radius = a.baseRadius
            a.heat = Math.max(a.heat, b.heat)
            a.splitTimer = randomBetween(180, 420)
            state.blobs.splice(j, 1)
            ensureBlobCount()
            j -= 1
          }
        }
      }
    }
  }

  function maybeSplitBlob() {
    for (let i = 0; i < state.blobs.length; i += 1) {
      const blob = state.blobs[i]
      if (blob.baseRadius > 50 && blob.splitTimer <= 0 && state.blobs.length < 18) {
        const childRadius = blob.baseRadius * 0.58
        blob.baseRadius *= 0.72
        blob.radius = blob.baseRadius
        blob.splitTimer = randomBetween(220, 420)

        const child = {
          ...createBlob(false),
          x: blob.x + randomBetween(-16, 16),
          y: blob.y + randomBetween(-10, 10),
          baseRadius: childRadius,
          radius: childRadius,
          vx: blob.vx + randomBetween(-0.35, 0.35),
          vy: blob.vy + randomBetween(-0.28, 0.28),
          heat: blob.heat * randomBetween(0.88, 1.08),
          splitTimer: randomBetween(260, 520)
        }

        state.blobs.push(child)
        break
      }
    }
  }

  function drawBackground() {
    const bg = ctx.createLinearGradient(0, 0, 0, state.height)
    bg.addColorStop(0, '#1b0a2a')
    bg.addColorStop(0.4, '#0f0618')
    bg.addColorStop(1, '#040109')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, state.width, state.height)

    for (let i = 0; i < 28; i += 1) {
      const x = (i * 137.31) % state.width
      const y = (i * 89.17 + state.time * 2) % state.height
      ctx.fillStyle = 'rgba(255,255,255,0.035)'
      ctx.beginPath()
      ctx.arc(x, y, (i % 3) + 1, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  function traceLampPath() {
    const { cx, topY, bottomY, bodyWidth, neckWidth, baseWidth } = getLampMetrics()
    ctx.beginPath()
    ctx.moveTo(cx - neckWidth * 0.5, topY)
    ctx.quadraticCurveTo(cx - bodyWidth * 0.52, state.height * 0.28, cx - bodyWidth * 0.42, state.height * 0.55)
    ctx.quadraticCurveTo(cx - bodyWidth * 0.34, state.height * 0.82, cx - baseWidth * 0.5, bottomY)
    ctx.lineTo(cx + baseWidth * 0.5, bottomY)
    ctx.quadraticCurveTo(cx + bodyWidth * 0.34, state.height * 0.82, cx + bodyWidth * 0.42, state.height * 0.55)
    ctx.quadraticCurveTo(cx + bodyWidth * 0.52, state.height * 0.28, cx + neckWidth * 0.5, topY)
    ctx.closePath()
  }

  function drawBlobsMetaball() {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.filter = 'blur(18px) saturate(1.15)'

    state.blobs.forEach((blob) => {
      const glow = ctx.createRadialGradient(blob.x, blob.y, blob.radius * 0.12, blob.x, blob.y, blob.radius * 1.2)
      glow.addColorStop(0, rgba('#ffffff', 0.88))
      glow.addColorStop(0.16, rgba(state.lavaColor, 0.98))
      glow.addColorStop(0.7, rgba(state.lavaColor, 0.78))
      glow.addColorStop(1, rgba(state.lavaColor, 0.05))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.ellipse(blob.x, blob.y, blob.radius * blob.stretch, blob.radius / blob.stretch, Math.sin(blob.wobble) * 0.35, 0, Math.PI * 2)
      ctx.fill()
    })

    ctx.restore()

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    state.blobs.forEach((blob) => {
      const core = ctx.createRadialGradient(blob.x - blob.radius * 0.18, blob.y - blob.radius * 0.24, 2, blob.x, blob.y, blob.radius)
      core.addColorStop(0, 'rgba(255,255,255,0.42)')
      core.addColorStop(0.18, rgba(state.lavaColor, 0.92))
      core.addColorStop(1, rgba(state.lavaColor, 0.12))
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.ellipse(blob.x, blob.y, blob.radius * blob.stretch * 0.92, blob.radius / blob.stretch * 0.92, Math.sin(blob.wobble) * 0.35, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.restore()
  }

  function drawLampGlass() {
    const { cx, topY, bottomY, bodyWidth, neckWidth, baseWidth } = getLampMetrics()

    ctx.save()
    traceLampPath()
    ctx.clip()

    const liquid = ctx.createLinearGradient(0, topY, 0, bottomY)
    liquid.addColorStop(0, rgba(state.liquidColor, 0.92))
    liquid.addColorStop(0.45, rgba(state.liquidColor, 0.72))
    liquid.addColorStop(1, rgba('#12081e', 0.98))
    ctx.fillStyle = liquid
    ctx.fillRect(cx - bodyWidth, topY, bodyWidth * 2, bottomY - topY)

    const innerGlow = ctx.createRadialGradient(cx, state.height * 0.56, 10, cx, state.height * 0.56, bodyWidth * 1.05)
    innerGlow.addColorStop(0, rgba(state.lavaColor, 0.28))
    innerGlow.addColorStop(0.55, rgba(state.lavaColor, 0.08))
    innerGlow.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = innerGlow
    ctx.fillRect(cx - bodyWidth, topY, bodyWidth * 2, bottomY - topY)

    drawBlobsMetaball()

    const caustic = ctx.createLinearGradient(cx - bodyWidth * 0.5, topY, cx + bodyWidth * 0.5, bottomY)
    caustic.addColorStop(0, 'rgba(255,255,255,0.08)')
    caustic.addColorStop(0.5, 'rgba(255,255,255,0.015)')
    caustic.addColorStop(1, 'rgba(255,255,255,0.06)')
    ctx.fillStyle = caustic
    ctx.fillRect(cx - bodyWidth, topY, bodyWidth * 2, bottomY - topY)

    ctx.restore()

    ctx.save()
    ctx.shadowColor = rgba('#ffffff', 0.18)
    ctx.shadowBlur = 18
    ctx.strokeStyle = 'rgba(255,255,255,0.36)'
    ctx.lineWidth = 3
    traceLampPath()
    ctx.stroke()
    ctx.restore()

    const leftShine = ctx.createLinearGradient(cx - bodyWidth * 0.58, 0, cx - bodyWidth * 0.16, 0)
    leftShine.addColorStop(0, 'rgba(255,255,255,0.3)')
    leftShine.addColorStop(0.3, 'rgba(255,255,255,0.08)')
    leftShine.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = leftShine
    ctx.fillRect(cx - bodyWidth * 0.45, topY + 12, bodyWidth * 0.2, bottomY - topY - 24)

    const rightReflection = ctx.createLinearGradient(cx + bodyWidth * 0.1, 0, cx + bodyWidth * 0.44, 0)
    rightReflection.addColorStop(0, 'rgba(255,255,255,0.02)')
    rightReflection.addColorStop(0.5, 'rgba(255,255,255,0.12)')
    rightReflection.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = rightReflection
    ctx.fillRect(cx + bodyWidth * 0.16, topY + 40, bodyWidth * 0.13, bottomY - topY - 90)

    const rimGlow = ctx.createLinearGradient(0, topY, 0, topY + 42)
    rimGlow.addColorStop(0, 'rgba(255,255,255,0.2)')
    rimGlow.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = rimGlow
    ctx.fillRect(cx - neckWidth * 0.7, topY - 2, neckWidth * 1.4, 42)

    drawLampCaps(cx, topY, bottomY, neckWidth, baseWidth)
  }

  function drawLampCaps(cx, topY, bottomY, neckWidth, baseWidth) {
    const topCap = ctx.createLinearGradient(0, topY - 34, 0, topY + 14)
    topCap.addColorStop(0, '#d8b57d')
    topCap.addColorStop(0.45, '#8d6330')
    topCap.addColorStop(1, '#4b2d10')
    ctx.fillStyle = topCap
    ctx.beginPath()
    ctx.roundRect(cx - neckWidth * 0.72, topY - 32, neckWidth * 1.44, 30, 16)
    ctx.fill()

    const base = ctx.createLinearGradient(0, bottomY - 18, 0, bottomY + 76)
    base.addColorStop(0, '#d39a46')
    base.addColorStop(0.42, '#8a5524')
    base.addColorStop(1, '#2a1308')
    ctx.fillStyle = base
    ctx.beginPath()
    ctx.moveTo(cx - baseWidth * 0.72, bottomY)
    ctx.lineTo(cx + baseWidth * 0.72, bottomY)
    ctx.lineTo(cx + baseWidth * 0.52, bottomY + 62)
    ctx.lineTo(cx - baseWidth * 0.52, bottomY + 62)
    ctx.closePath()
    ctx.fill()

    const heaterGlow = ctx.createRadialGradient(cx, bottomY + 18, 10, cx, bottomY + 18, baseWidth * 0.46)
    heaterGlow.addColorStop(0, rgba(state.lavaColor, 0.75))
    heaterGlow.addColorStop(0.42, rgba(state.lavaColor, 0.26))
    heaterGlow.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = heaterGlow
    ctx.beginPath()
    ctx.ellipse(cx, bottomY + 18, baseWidth * 0.4, 24, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  function render() {
    try {
      state.time += 0.016
      drawBackground()
      updateBlobs()
      drawLampGlass()
      requestAnimationFrame(render)
    } catch (error) {
      console.error('Render error:', error.message, error.stack)
    }
  }

  function syncLabels() {
    lavaColorValue.textContent = state.lavaColor
    liquidColorValue.textContent = state.liquidColor
  }

  function bindEvents() {
    window.addEventListener('resize', () => {
      try {
        resize()
      } catch (error) {
        console.error('Resize error:', error.message)
      }
    })

    lavaColorInput.addEventListener('input', () => {
      try {
        state.lavaColor = lavaColorInput.value
        syncLabels()
      } catch (error) {
        console.error('Lava color error:', error.message)
      }
    })

    liquidColorInput.addEventListener('input', () => {
      try {
        state.liquidColor = liquidColorInput.value
        syncLabels()
      } catch (error) {
        console.error('Liquid color error:', error.message)
      }
    })

    heatLevelInput.addEventListener('input', () => {
      try {
        state.heat = Number(heatLevelInput.value)
      } catch (error) {
        console.error('Heat error:', error.message)
      }
    })

    blobCountInput.addEventListener('input', () => {
      try {
        state.targetBlobCount = Number(blobCountInput.value)
        ensureBlobCount()
      } catch (error) {
        console.error('Blob count error:', error.message)
      }
    })

    shufflePaletteBtn.addEventListener('click', () => {
      try {
        const palette = palettes[Math.floor(Math.random() * palettes.length)]
        state.lavaColor = palette.lava
        state.liquidColor = palette.liquid
        lavaColorInput.value = palette.lava
        liquidColorInput.value = palette.liquid
        syncLabels()
      } catch (error) {
        console.error('Shuffle error:', error.message)
      }
    })
  }

  function init() {
    try {
      resize()
      bindEvents()
      syncLabels()
      ensureBlobCount()
      render()
    } catch (error) {
      console.error('Init error:', error.message, error.stack)
    }
  }

  init()
})()
