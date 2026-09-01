import fs from "node:fs";
import path from "node:path";
const required=["src/main.jsx","src/App.jsx","src/routes/AppRoutes.jsx","src/data/services.js","src/animations/gsapConfig.js","src/components/effects/ThreeBackground.jsx","existing-original/index-original.html","README.md","CONTENT_GUIDE.md"];
let failed=false;
for(const file of required){if(!fs.existsSync(path.resolve(file))){console.error("Missing:",file);failed=true}}
const services=fs.readFileSync("src/data/services.js","utf8");
for(const slug of ["ai-automation","web-engineering","mobile-applications","enterprise-software","cloud-infrastructure","data-analytics","api-integrations","ui-ux","devops","cybersecurity","quality-engineering","digital-transformation"]){if(!services.includes(slug)){console.error("Missing service:",slug);failed=true}}
if(failed) process.exit(1);
console.log("Offline structural verification passed.");
