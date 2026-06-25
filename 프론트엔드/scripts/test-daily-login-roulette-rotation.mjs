import assert from 'node:assert/strict'

const SEGMENTS = [1, 5, 8, 10, 15, 20, 50]
const SEGMENT_COUNT = SEGMENTS.length
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT
const WHEEL_IMAGE_OFFSET_DEG = -SEGMENT_ANGLE / 2

function getSegmentCenterDeg(segmentIndex) {
  return segmentIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2 + WHEEL_IMAGE_OFFSET_DEG
}

function getNextRotation(segmentIndex, currentRotationDeg, extraTurns = 6) {
  const segmentCenter = getSegmentCenterDeg(segmentIndex)
  const targetMod = ((segmentCenter % 360) + 360) % 360
  const currentMod = ((currentRotationDeg % 360) + 360) % 360
  let delta = targetMod - currentMod
  if (delta < 0) delta += 360
  return currentRotationDeg + extraTurns * 360 + delta
}

function getSegmentIndexAtPointer(pointerRotationDeg) {
  const adjusted = ((pointerRotationDeg % 360) + 360) % 360
  const index = Math.round(adjusted / SEGMENT_ANGLE)
  return ((index % SEGMENT_COUNT) + SEGMENT_COUNT) % SEGMENT_COUNT
}

for (let segmentIndex = 0; segmentIndex < SEGMENT_COUNT; segmentIndex += 1) {
  const rotation = getNextRotation(segmentIndex, 0, 0)
  const atPointer = getSegmentIndexAtPointer(rotation)
  assert.equal(
    atPointer,
    segmentIndex,
    `${SEGMENTS[segmentIndex]}잔(index ${segmentIndex}) → pointer ${atPointer} (${SEGMENTS[atPointer]}잔)`,
  )
}

let current = 0
for (const cups of [1, 5, 10, 15, 20, 50, 1]) {
  const segmentIndex = SEGMENTS.indexOf(cups)
  const next = getNextRotation(segmentIndex, current, 6)
  assert.ok(next > current)
  assert.equal(getSegmentIndexAtPointer(next), segmentIndex, `${cups}잔 respin chain`)
  current = next
}

console.log('daily login roulette rotation tests passed')
