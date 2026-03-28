(() => {
  'use strict'

  try {
    const canvas = document.getElementById('lamp-canvas')
    const errorBanner = document.getElementById('error-banner')
    const lavaColorInput = document.getElementById('lava-color')
    const liquidColorInput = document.getElementById('liquid-color')
    const lavaColorValue = document.getElementById('lava-color-value')
    const liquidColorValue = document.getElementById('liquid-color-value')
    const heatLevelInput = document.getElementById('heat-level')
    const blobCountInput = document.getElementById('blob-count')
    const shufflePaletteBtn = document.getElementById('shuffle-palette')

    if (!canvas) {
      throw new Error('Canvas element not found.')
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('2D canvas context is unavailable.')
    }

    const palettes = [
      { lava: '#ff6b3d', liquid: '#4b2a8f' },
      { lava: '#ff4f8b', liquid: '#2a3f8f' },
      { lava: '#ffd166', liquid: '#234e70' },
      { lava: '#8aff80', liquid: '#244b5a' },
      { lava: '#ff7b72', liquid: '#3d246c' }
    ]

    const state = {
      width: 0,
      height: 0,
      dpr: 1,
      time: 0,
      heat: 1,
      targetBlobCount: 10,
      lavaColor: lavaColorInput ? lavaColorInput.value : '#ff6b3d',
      liquidColor: liquidColorInput ? liquidColorInput.value : '#4b2a8f',
      blobs: [],
      animationFrame: null,
      lastFrameTime: 0,
      backgroundDots: []
    }

    function showError(message) {
      console.error(message)
      if (errorBanner) {
        errorBanner.textContent = message
        errorBanner.classList.remove('hidden')
      }
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value))
    }

    function randomBetween(min, max) {
      return min + Math.random() * (max - min)
    }

    function hexToRgb(hex) {
      const safe = String(hex || '#ffffff').replace('#', '')
      const full = safe.length === 3 ? safe.split('').map((char) => char + char).join('') : safe
      return {
        r: parseInt(full.slice(0, 2), 16) || 255,
        g: parseInt(full.slice(2, 4), 16) || 255,
        b: parseInt(full.slice(4, 6), 16) || 255
      }
    }

    function rgba(hex, alpha) {
      const rgb = hexToRgb(hex)
      return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
    }

    function resize() {
      try {
        state.width = window.innerWidth || document.documentElement.clientWidth || 800
        state.height = window.innerHeight || document.documentElement.clientHeight || 600
        state.dpr = state.width <= 720 ? 1 : Math.min(1.6, Math.max(1, window.devicePixelRatio || 1))
        canvas.width = Math.max(1, Math.floor(state.width * state.dpr))
        canvas.height = Math.max(1, Math.floor(state.height * state.dpr))
        canvas.style.width = `${state.width}px`
        canvas.style.height = `${state.height}px`
        ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0)
        buildBackgroundDots()
      } catch (e) {
        showError(`Resize error: ${e.message}`)
      }
    }

    function buildBackgroundDots() {
      const dotCount = state.width <= 720 ? 10 : 18
      state.backgroundDots = Array.from({ length: dotCount }, (_, i) => ({
        x: (i * 137.31) % Math.max(1, state.width),
        y: (i * 89.17) % Math.max(1, state.height),
        r: state.width <= 720 ? 1 + (i % 2) * 0.6 : (i % 3) + 1,
        speed: 8 + (i % 5) * 5
      }))
    }

    function getLampMetrics() {
      const isMobile = state.width <= 720
      const cx = isMobile ? state.width * 0.34 : state.width * 0.5
      const topY = state.height * 0.11
      const bottomPadding = isMobile ? 120 : 86
      const bottomY = Math.min(state.height * 0.8, state.height - bottomPadding)
      const bodyWidth = Math.min(isMobile ? 220 : 320, state.width * (isMobile ? 0.34 : 0.34))
      const neckWidth = bodyWidth * 0.42
      const baseWidth = bodyWidth * 0.7
      const lampHeight = bottomY - topY
      return { cx, topY, bottomY, bodyWidth, neckWidth, baseWidth, lampHeight }
    }

    function getLampHalfWidthAt(y) {
      const metrics = getLampMetrics()
      const t = clamp((y - metrics.topY) / (metrics.bottomY - metrics.topY), 0, 1)
      if (t < 0.58) {
        return metrics.neckWidth * 0.5 + (metrics.bodyWidth * 0.52 - metrics.neckWidth * 0.5) * Math.sin(t * Math.PI * 0.55)
      }
      return metrics.bodyWidth * 0.52 + (metrics.baseWidth * 0.5 - metrics.bodyWidth * 0.52) * ((t - 0.58) / 0.42)
    }

    function createBlob(fromBottom) {
      const metrics = getLampMetrics()
      const y = fromBottom
        ? metrics.bottomY - randomBetween(metrics.lampHeight * 0.02, metrics.lampHeight * 0.1)
        : randomBetween(metrics.topY + metrics.lampHeight * 0.18, metrics.bottomY - metrics.lampHeight * 0.18)
      const halfWidth = getLampHalfWidthAt(y)
      const radius = randomBetween(24, 54)
      return {
        x: metrics.cx + randomBetween(-halfWidth * 0.28, halfWidth * 0.28),
        y,
        radius,
        baseRadius: radius,
        vx: randomBetween(-0.1, 0.1),
        vy: randomBetween(-0.45, -0.1),
        wobble: randomBetween(0, Math.PI * 2),
        wobbleSpeed: randomBetween(0.01, 0.025),
        stretch: randomBetween(0.9, 1.14),
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
      const metrics = getLampMetrics()
      for (let i = 0; i < state.blobs.length; i += 1) {
        const blob = state.blobs[i]
        blob.wobble += blob.wobbleSpeed
        blob.heat -= blob.cooling * (1 / Math.max(0.4, state.heat))
        if (blob.heat < 0.45) blob.vy += 0.012
        else blob.vy -= 0.006 * state.heat

        blob.vx += Math.sin(blob.wobble) * 0.003
        blob.vx *= 0.994
        blob.vy *= 0.998
        blob.x += blob.vx * 1.2
        blob.y += blob.vy * 1.2

        const horizontalLimit = Math.max(24, getLampHalfWidthAt(blob.y) - blob.radius * 0.42)
        const dx = blob.x - metrics.cx
        if (dx < -horizontalLimit || dx > horizontalLimit) {
          blob.vx *= -0.9
          blob.x = metrics.cx + clamp(dx, -horizontalLimit, horizontalLimit)
        }

        if (blob.y < metrics.topY + blob.radius * 0.9) {
          blob.y = metrics.topY + blob.radius * 0.9
          blob.vy = Math.abs(blob.vy) * 0.35
          blob.heat = randomBetween(0.35, 0.6)
        }

        if (blob.y > metrics.bottomY - blob.radius * 0.6) {
          blob.y = metrics.bottomY - blob.radius * 0.6
          blob.vy = -randomBetween(0.3, 0.9) * state.heat
          blob.heat = randomBetween(0.9, 1.35)
        }

        blob.radius = blob.baseRadius * (0.9 + ((Math.sin(blob.wobble * 1.2) + 1) * 0.5) * 0.26)
        blob.stretch = 0.84 + ((Math.cos(blob.wobble * 0.9) + 1) * 0.5) * 0.34
        blob.splitTimer -= 1
      }

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
          }
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

      for (let i = 0; i < state.backgroundDots.length; i += 1) {
        const dot = state.backgroundDots[i]
        const y = (dot.y + state.time * dot.speed) % Math.max(1, state.height + 24)
        ctx.fillStyle = 'rgba(255,255,255,0.035)'
        ctx.beginPath()
        ctx.arc(dot.x, y - 12, dot.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    function traceLampPath() {
      const metrics = getLampMetrics()
      ctx.beginPath()
      ctx.moveTo(metrics.cx - metrics.neckWidth * 0.5, metrics.topY)
      ctx.quadraticCurveTo(metrics.cx - metrics.bodyWidth * 0.52, state.height * 0.28, metrics.cx - metrics.bodyWidth * 0.42, state.height * 0.55)
      ctx.quadraticCurveTo(metrics.cx - metrics.bodyWidth * 0.34, state.height * 0.82, metrics.cx - metrics.baseWidth * 0.5, metrics.bottomY)
      ctx.lineTo(metrics.cx + metrics.baseWidth * 0.5, metrics.bottomY)
      ctx.quadraticCurveTo(metrics.cx + metrics.bodyWidth * 0.34, state.height * 0.82, metrics.cx + metrics.bodyWidth * 0.42, state.height * 0.55)
      ctx.quadraticCurveTo(metrics.cx + metrics.bodyWidth * 0.52, state.height * 0.28, metrics.cx + metrics.neckWidth * 0.5, metrics.topY)
      ctx.closePath()
    }

    function drawBlob(blob) {
      const outer = ctx.createRadialGradient(blob.x, blob.y, blob.radius * 0.15, blob.x, blob.y, blob.radius * 1.25)
      outer.addColorStop(0, rgba('#fff8ef', 0.95))
      outer.addColorStop(0.24, rgba(state.lavaColor, 0.92))
      outer.addColorStop(1, rgba(state.lavaColor, 0.08))
      ctx.fillStyle = outer
      ctx.beginPath()
      ctx.ellipse(blob.x, blob.y, blob.radius * blob.stretch, blob.radius / blob.stretch, Math.sin(blob.wobble) * 0.35, 0, Math.PI * 2)
      ctx.fill()

      const inner = ctx.createRadialGradient(blob.x - blob.radius * 0.2, blob.y - blob.radius * 0.22, 1, blob.x, blob.y, blob.radius)
      inner.addColorStop(0, 'rgba(255,255,255,0.38)')
      inner.addColorStop(0.22, rgba(state.lavaColor, 0.82))
      inner.addColorStop(1, rgba(state.lavaColor, 0.14))
      ctx.fillStyle = inner
      ctx.beginPath()
      ctx.ellipse(blob.x, blob.y, blob.radius * blob.stretch * 0.98, (blob.radius / blob.stretch) * 0.94, Math.sin(blob.wobble) * 0.35, 0, Math.PI * 2)
      ctx.fill()
    }

    function drawRoundedRect(x, y, width, height, radius) {
      const r = Math.min(radius, width * 0.5, height * 0.5)
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + width - r, y)
      ctx.quadraticCurveTo(x + width, y, x + width, y + r)
      ctx.lineTo(x + width, y + height - r)
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
      ctx.lineTo(x + r, y + height)
      ctx.quadraticCurveTo(x, y + height, x, y + height - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
    }

    function drawLampCaps() {
      const metrics = getLampMetrics()
      const topCap = ctx.createLinearGradient(0, metrics.topY - 34, 0, metrics.topY + 14)
      topCap.addColorStop(0, '#d8b57d')
      topCap.addColorStop(0.45, '#8d6330')
      topCap.addColorStop(1, '#4b2d10')
      ctx.fillStyle = topCap
      drawRoundedRect(metrics.cx - metrics.neckWidth * 0.72, metrics.topY - 32, metrics.neckWidth * 1.44, 30, 16)
      ctx.fill()

      const base = ctx.createLinearGradient(0, metrics.bottomY - 18, 0, metrics.bottomY + 76)
      base.addColorStop(0, '#d39a46')
      base.addColorStop(0.42, '#8a5524')
      base.addColorStop(1, '#2a1308')
      ctx.fillStyle = base
      ctx.beginPath()
      ctx.moveTo(metrics.cx - metrics.baseWidth * 0.72, metrics.bottomY)
      ctx.lineTo(metrics.cx + metrics.baseWidth * 0.72, metrics.bottomY)
      ctx.lineTo(metrics.cx + metrics.baseWidth * 0.52, metrics.bottomY + 62)
      ctx.lineTo(metrics.cx - metrics.baseWidth * 0.52, metrics.bottomY + 62)
      ctx.closePath()
      ctx.fill()

      const heaterGlow = ctx.createRadialGradient(metrics.cx, metrics.bottomY + 18, 10, metrics.cx, metrics.bottomY + 18, metrics.baseWidth * 0.46)
      heaterGlow.addColorStop(0, rgba(state.lavaColor, 0.75))
      heaterGlow.addColorStop(0.42, rgba(state.lavaColor, 0.26))
      heaterGlow.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = heaterGlow
      ctx.beginPath()
      ctx.ellipse(metrics.cx, metrics.bottomY + 18, metrics.baseWidth * 0.4, 24, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    function drawLamp() {
      const metrics = getLampMetrics()
      ctx.save()
      traceLampPath()
      ctx.clip()

      const liquid = ctx.createLinearGradient(0, metrics.topY, 0, metrics.bottomY)
      liquid.addColorStop(0, rgba(state.liquidColor, 0.92))
      liquid.addColorStop(0.45, rgba(state.liquidColor, 0.72))
      liquid.addColorStop(1, rgba('#12081e', 0.98))
      ctx.fillStyle = liquid
      ctx.fillRect(metrics.cx - metrics.bodyWidth, metrics.topY, metrics.bodyWidth * 2, metrics.bottomY - metrics.topY)

      const innerGlow = ctx.createRadialGradient(metrics.cx, state.height * 0.56, 10, metrics.cx, state.height * 0.56, metrics.bodyWidth * 1.05)
      innerGlow.addColorStop(0, rgba(state.lavaColor, 0.28))
      innerGlow.addColorStop(0.55, rgba(state.lavaColor, 0.08))
      innerGlow.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = innerGlow
      ctx.fillRect(metrics.cx - metrics.bodyWidth, metrics.topY, metrics.bodyWidth * 2, metrics.bottomY - metrics.topY)

      for (let i = 0; i < state.blobs.length; i += 1) {
        drawBlob(state.blobs[i])
      }

      const caustic = ctx.createLinearGradient(metrics.cx - metrics.bodyWidth * 0.5, metrics.topY, metrics.cx + metrics.bodyWidth * 0.5, metrics.bottomY)
      caustic.addColorStop(0, 'rgba(255,255,255,0.08)')
      caustic.addColorStop(0.5, 'rgba(255,255,255,0.015)')
      caustic.addColorStop(1, 'rgba(255,255,255,0.06)')
      ctx.fillStyle = caustic
      ctx.fillRect(metrics.cx - metrics.bodyWidth, metrics.topY, metrics.bodyWidth * 2, metrics.bottomY - metrics.topY)

      ctx.restore()

      ctx.strokeStyle = 'rgba(255,255,255,0.34)'
      ctx.lineWidth = 3
      traceLampPath()
      ctx.stroke()

      const leftShine = ctx.createLinearGradient(metrics.cx - metrics.bodyWidth * 0.58, 0, metrics.cx - metrics.bodyWidth * 0.16, 0)
      leftShine.addColorStop(0, 'rgba(255,255,255,0.3)')
      leftShine.addColorStop(0.3, 'rgba(255,255,255,0.08)')
      leftShine.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = leftShine
      ctx.fillRect(metrics.cx - metrics.bodyWidth * 0.45, metrics.topY + 12, metrics.bodyWidth * 0.2, metrics.bottomY - metrics.topY - 24)

      const rightReflection = ctx.createLinearGradient(metrics.cx + metrics.bodyWidth * 0.1, 0, metrics.cx + metrics.bodyWidth * 0.44, 0)
      rightReflection.addColorStop(0, 'rgba(255,255,255,0.02)')
      rightReflection.addColorStop(0.5, 'rgba(255,255,255,0.12)')
      rightReflection.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = rightReflection
      ctx.fillRect(metrics.cx + metrics.bodyWidth * 0.16, metrics.topY + 40, metrics.bodyWidth * 0.13, metrics.bottomY - metrics.topY - 90)

      drawLampCaps()
    }

    function drawFrame(deltaSeconds) {
      state.time += deltaSeconds
      drawBackground()
      updateBlobs()
      drawLamp()
    }

    function render(now) {
      try {
        if (!state.lastFrameTime) state.lastFrameTime = now
        const deltaMs = Math.min(32, now - state.lastFrameTime)
        state.lastFrameTime = now
        drawFrame(deltaMs / 1000)
      } catch (e) {
        showError(`Render error: ${e.message}`)
      }
      state.animationFrame = window.requestAnimationFrame(render)
    }

    function syncLabels() {
      if (lavaColorValue) lavaColorValue.textContent = state.lavaColor
      if (liquidColorValue) liquidColorValue.textContent = state.liquidColor
    }

    function bindEvents() {
      try {
        window.addEventListener('resize', resize)

        if (lavaColorInput) {
          lavaColorInput.addEventListener('input', () => {
            try {
              state.lavaColor = lavaColorInput.value
              syncLabels()
            } catch (e) {
              showError(`Lava color error: ${e.message}`)
            }
          })
        }

        if (liquidColorInput) {
          liquidColorInput.addEventListener('input', () => {
            try {
              state.liquidColor = liquidColorInput.value
              syncLabels()
            } catch (e) {
              showError(`Liquid color error: ${e.message}`)
            }
          })
        }

        if (heatLevelInput) {
          heatLevelInput.addEventListener('input', () => {
            try {
              state.heat = Number(heatLevelInput.value) || 1
            } catch (e) {
              showError(`Heat error: ${e.message}`)
            }
          })
        }

        if (blobCountInput) {
          blobCountInput.addEventListener('input', () => {
            try {
              state.targetBlobCount = Number(blobCountInput.value) || 10
              ensureBlobCount()
            } catch (e) {
              showError(`Blob count error: ${e.message}`)
            }
          })
        }

        if (shufflePaletteBtn) {
          shufflePaletteBtn.addEventListener('click', () => {
            try {
              const palette = palettes[Math.floor(Math.random() * palettes.length)]
              state.lavaColor = palette.lava
              state.liquidColor = palette.liquid
              if (lavaColorInput) lavaColorInput.value = palette.lava
              if (liquidColorInput) liquidColorInput.value = palette.liquid
              syncLabels()
            } catch (e) {
              showError(`Shuffle error: ${e.message}`)
            }
          })
        }
      } catch (e) {
        showError(`Event binding error: ${e.message}`)
      }
    }

    function init() {
      try {
        resize()
        bindEvents()
        syncLabels()
        ensureBlobCount()
        render(0)
      } catch (e) {
        showError(`Init error: ${e.message}`)
      }
    }

    init()
  } catch (fatalError) {
    console.error('Fatal app error:', fatalError)
  }
})()