async (page) => {
  const sizes = [
    [1920, 1080], [1440, 900], [1366, 768], [1024, 768], [768, 1024],
    [430, 932], [390, 844], [375, 812], [360, 800],
  ];
  const results = [];

  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(120);
    results.push(await page.evaluate(() => ({
      viewport: `${innerWidth}x${innerHeight}`,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      routeClass: document.documentElement.classList.contains("service-detail-route"),
      canvasPointerEvents: getComputedStyle(document.querySelector(".three-background")).pointerEvents,
      codeOpacity: getComputedStyle(document.querySelector(".code-stream")).opacity,
      titleVisible: Boolean(document.querySelector(".service-detail-grid h1")),
      systemCards: document.querySelectorAll(".vis-api .endpoint").length,
    })));
  }

  return results;
}
