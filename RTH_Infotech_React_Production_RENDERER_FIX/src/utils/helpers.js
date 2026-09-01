export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
