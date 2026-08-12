const TAU = Math.PI * 2

export function createGaussian(seed = 90210) {
  let state = seed >>> 0
  let spare = null

  const random = () => {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return () => {
    if (spare !== null) {
      const result = spare
      spare = null
      return result
    }
    const u = Math.max(random(), 1e-7)
    const v = random()
    const radius = Math.sqrt(-2 * Math.log(u))
    const angle = TAU * v
    spare = radius * Math.sin(angle)
    return radius * Math.cos(angle)
  }
}
