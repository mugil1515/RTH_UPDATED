async (page) => {
  const phases = [0.08, 0.285, 0.40, 0.55, 0.70, 0.84, 0.95];
  const shots = new Set([0.08, 0.285, 0.40, 0.70, 0.95]);
  const results = [];

  const inspectAt = async (phase, direction, viewportName) => {
    const targetY = await page.evaluate((p) => {
      const section = document.querySelector("#agent");
      const rect = section.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const start = top - window.innerHeight * 0.82;
      const end = top + rect.height - window.innerHeight * 0.28;
      return start + (end - start) * p;
    }, phase);

    await page.evaluate((y) => window.scrollTo(0, y), targetY);
    await page.waitForTimeout(1100);

    const state = await page.evaluate(({ p, dir, name }) => {
      const action = window.__rth?.automation?.parts?.action;
      const hand = window.__rth?.automation?.parts?.hand;
      const root = document.documentElement;
      const agent = document.querySelector("#agent");
      const log = document.querySelector("#agent .agent-log")?.getBoundingClientRect();
      return {
        viewport: name,
        direction: dir,
        requestedPhase: p,
        actualPhase: Number((action?.state?.phase ?? -1).toFixed(3)),
        reach: Number((action?.state?.reach ?? -1).toFixed(3)),
        pressed: Number((action?.state?.pressed ?? -1).toFixed(3)),
        core: Number((action?.state?.core ?? -1).toFixed(3)),
        handVisible: Boolean(hand?.root?.visible),
        agentVisible: Boolean(agent && agent.getBoundingClientRect().bottom > 0 && agent.getBoundingClientRect().top < innerHeight),
        logRect: log ? { left: Math.round(log.left), top: Math.round(log.top), right: Math.round(log.right), bottom: Math.round(log.bottom) } : null,
        scrimA: getComputedStyle(root).getPropertyValue("--scrim-a-core").trim(),
        scrimB: getComputedStyle(root).getPropertyValue("--scrim-b-core").trim(),
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    }, { p: phase, dir: direction, name: viewportName });

    if (direction === "forward" && shots.has(phase)) {
      await page.screenshot({
        path: `output/playwright/execution-${viewportName}-${String(phase).replace(".", "-")}.png`,
        type: "png",
      });
    }
    return state;
  };

  for (const [viewportName, width, height] of [["desktop", 1440, 900], ["mobile", 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.reload();
    await page.waitForTimeout(1500);

    for (const phase of phases) results.push(await inspectAt(phase, "forward", viewportName));
    for (const phase of [...phases].reverse()) results.push(await inspectAt(phase, "reverse", viewportName));
  }

  return results;
}
