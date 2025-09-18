function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

export async function startStudyAutoclick() {
  await autoclickStudy()
  return { success: true }
}

async function autoclickStudy(): Promise<void> {
  // Activity Completed dialog: click Yes (second button)
  const activityCompletedYes = document.querySelector(
    '.cdk-overlay-pane mat-dialog-container .mat-dialog-actions button:nth-child(2)'
  ) as HTMLElement | null
  if (activityCompletedYes) {
    activityCompletedYes.click()
    return
  }

  // Next button in study flow
  const next = document.querySelector(
    'kp-nav-footer kp-content-lane .nav-section:nth-child(3) button'
  ) as HTMLElement | null
  if (!next) return
  next.click()
  await sleep(1000)
  return autoclickStudy()
}

