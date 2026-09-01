// Editable content + local intent keywords for the RTH AI website guide.
// Service facts (title/description/features) always come from src/data/services.js —
// nothing about a service is duplicated here, only navigation/matching phrases.
export const chatbotConfig = {
  name: "RTH AI",
  subtitle: "INTELLIGENCE ASSISTANT",
  triggerLabel: "ASK RTH AI",
  discoveryLabel: "Need help exploring RTH?",
  onlineLabel: "ONLINE",
  inputPlaceholder: "Ask RTH AI...",
  typingLabel: "ANALYZING REQUEST...",

  welcome: [
    "Hi. I'm RTH AI.",
    "I can guide you through RTH Infotech's services, AI automation capabilities and technology solutions.",
    "What would you like to explore?",
  ],

  initialSuggestions: [
    { id: "services", label: "Explore Services", action: { type: "goto-services" } },
    { id: "automation", label: "What Can You Automate?", action: { type: "goto-analyzer" } },
    { id: "ai", label: "AI & Automation", action: { type: "show-service", slug: "ai-automation" } },
    { id: "contact", label: "Contact RTH", action: { type: "goto-contact" } },
  ],

  servicesIntro:
    "RTH Infotech provides solutions across AI, software engineering, infrastructure, quality and digital transformation.",
  analyzerIntro:
    "RTH's Business Analyzer can help identify where automation or software can improve your workflow.",
  contactIntro: "I can connect you with RTH Infotech directly.",
  coreIntro:
    "The Intelligence Core is RTH's live map of every service we offer — click any node to explore it.",
  greeting:
    "Hi there! I'm RTH AI — here to help you explore services, automation and how to reach the team.",

  fallback: {
    unknown:
      "I can help you explore RTH's services, automation capabilities, or connect you with the team. Try one of these:",
    noData:
      "I don't have that information in the website data yet. I can take you to the Contact section.",
  },

  // Explicit related-service pairings from the spec. Any service without an entry
  // here falls back to the next few services in catalogue order (see intentEngine.js).
  relatedServices: {
    "ai-automation": ["data-analytics", "api-integrations", "digital-transformation"],
    "web-engineering": ["ui-ux", "api-integrations", "quality-engineering"],
  },

  // Fixed-intent phrases. Multi-word phrases match as substrings; single words are
  // matched on word boundaries in intentEngine.js to avoid false positives.
  keywords: {
    greeting: ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"],
    about: [
      "who is rth",
      "what is rth",
      "about rth",
      "tell me about rth",
      "what does rth do",
      "who are you",
    ],
    intelligenceCore: [
      "intelligence core",
      "show intelligence core",
      "show me the intelligence core",
    ],
    servicesList: [
      "show services",
      "what services",
      "services list",
      "explore services",
      "what do you offer",
    ],
    analyzer: [
      "what can i automate",
      "what can you automate",
      "i don't know which service",
      "i dont know which service",
      "analyze my business",
      "analyzer",
    ],
    contact: [
      "contact",
      "get in touch",
      "reach you",
      "talk to someone",
      "how can i contact you",
      "phone number",
      "email you",
    ],
    noData: [
      "price",
      "pricing",
      "cost",
      "how much",
      "quote",
      "guarantee",
      "warranty",
      "certification",
      "certified",
      "timeline",
      "deadline",
      "discount",
      "free trial",
      "client name",
      "case study",
      "testimonial",
    ],
  },

  // Per-service navigation synonyms layered on top of each service's own
  // title / shortTitle / slug (already matched automatically).
  serviceIntentKeywords: {
    "ai-automation": ["automation", "i need automation", "automate my business", "ai"],
    "web-engineering": ["website", "i need a website", "web app", "web development"],
    "mobile-applications": [
      "mobile app development",
      "i need mobile app development",
      "mobile app",
      "android app",
      "ios app",
    ],
    cybersecurity: ["cybersecurity", "i need cybersecurity", "security"],
    devops: ["devops", "i need devops", "ci/cd"],
    "data-analytics": ["analytics", "i need analytics", "data analytics", "business intelligence"],
    "ui-ux": ["ui ux", "ui/ux", "i need ui ux", "product design"],
    "api-integrations": ["api", "i need an api", "integration", "integrations"],
    "cloud-infrastructure": ["cloud", "infrastructure", "aws", "azure", "gcp"],
    "enterprise-software": ["erp", "crm", "enterprise software"],
    "digital-transformation": ["digital transformation", "modernize", "legacy system"],
    "quality-engineering": ["testing", "qa", "quality engineering", "test automation"],
  },
};
