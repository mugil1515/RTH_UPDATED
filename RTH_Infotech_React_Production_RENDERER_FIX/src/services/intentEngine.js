// Local website-guide intent matcher. No external AI — just keyword matching against
// src/data/services.js (source of truth for service facts) and src/data/chatbot.js
// (editable copy + navigation phrases). See chatService.js for the local/backend switch.
import { services, getServiceBySlug } from "@/data/services";
import { company } from "@/data/company";
import { chatbotConfig } from "@/data/chatbot";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesPhrase(text, phrase) {
  const p = phrase.toLowerCase();
  if (p.includes(" ") || p.includes("/")) return text.includes(p);
  return new RegExp(`\\b${escapeRegExp(p)}\\b`).test(text);
}

function matchesAny(text, phrases) {
  return phrases.some((phrase) => includesPhrase(text, phrase));
}

function normalize(raw) {
  return String(raw || "").toLowerCase().trim();
}

function findServiceForText(text) {
  return services.find((service) => {
    const candidates = [
      service.title,
      service.shortTitle,
      service.slug.replace(/-/g, " "),
      ...(chatbotConfig.serviceIntentKeywords[service.id] || []),
    ];
    return candidates.some((candidate) => candidate && includesPhrase(text, candidate.toLowerCase()));
  }) || null;
}

function defaultRelatedSlugs(slug) {
  const index = services.findIndex((service) => service.slug === slug);
  if (index === -1) return [];
  return [1, 2, 3].map((offset) => services[(index + offset) % services.length].slug);
}

function contactSuggestion() {
  return { id: "contact", label: "Contact RTH", action: { type: "goto-contact" } };
}

function servicesSuggestion() {
  return { id: "services", label: "Explore Services", action: { type: "goto-services" } };
}

export function serviceResponse(service) {
  if (!service) return unknownResponse();
  const features = (service.primaryFeatures?.length ? service.primaryFeatures : service.features || []).slice(0, 4);
  return {
    text: [service.title, service.description, features.length ? `Key capabilities: ${features.join(", ")}.` : null].filter(Boolean),
    suggestions: [
      { id: `explore-${service.slug}`, label: `Explore ${service.shortTitle || service.title}`, action: { type: "explore-service", slug: service.slug } },
      { id: `related-${service.slug}`, label: "Related Services", action: { type: "show-related", slug: service.slug } },
      contactSuggestion(),
    ],
  };
}

export function relatedResponse(slug) {
  const service = getServiceBySlug(slug);
  const relatedSlugs = chatbotConfig.relatedServices[slug] || defaultRelatedSlugs(slug);
  const related = relatedSlugs.map(getServiceBySlug).filter(Boolean);
  return {
    text: [service ? `Related to ${service.title}:` : "Related services:"],
    suggestions: [
      ...related.map((r) => ({ id: `show-${r.slug}`, label: r.shortTitle || r.title, action: { type: "show-service", slug: r.slug } })),
      contactSuggestion(),
    ],
  };
}

export function servicesListResponse() {
  return {
    text: [chatbotConfig.servicesIntro],
    dense: true,
    suggestions: services.map((s) => ({ id: `show-${s.slug}`, label: s.shortTitle || s.title, action: { type: "show-service", slug: s.slug } })),
  };
}

export function analyzerResponse() {
  return {
    text: [chatbotConfig.analyzerIntro],
    suggestions: [{ id: "analyze", label: "Analyze My Business", action: { type: "goto-analyzer" } }],
  };
}

export function contactResponse() {
  return { text: [chatbotConfig.contactIntro], suggestions: [contactSuggestion()] };
}

export function aboutResponse() {
  return {
    text: [
      `${company.name} — ${company.location}.`,
      company.description,
      company.concepts?.length ? `Focus areas: ${company.concepts.join(", ")}.` : null,
    ].filter(Boolean),
    suggestions: [servicesSuggestion(), contactSuggestion()],
  };
}

export function intelligenceCoreResponse() {
  return { text: [chatbotConfig.coreIntro], suggestions: [servicesSuggestion()] };
}

export function greetingResponse() {
  return { text: [chatbotConfig.greeting], suggestions: chatbotConfig.initialSuggestions };
}

export function noDataResponse() {
  return { text: [chatbotConfig.fallback.noData], suggestions: [contactSuggestion()] };
}

export function unknownResponse() {
  return { text: [chatbotConfig.fallback.unknown], suggestions: chatbotConfig.initialSuggestions };
}

export function resolveAction(action) {
  switch (action?.type) {
    case "show-service":
      return serviceResponse(getServiceBySlug(action.slug));
    case "show-related":
      return relatedResponse(action.slug);
    case "show-services-list":
      return servicesListResponse();
    case "show-about":
      return aboutResponse();
    default:
      return unknownResponse();
  }
}

export function resolveMessage(rawText) {
  const text = normalize(rawText);
  if (!text) return unknownResponse();

  const k = chatbotConfig.keywords;
  if (matchesAny(text, k.greeting)) return greetingResponse();
  if (matchesAny(text, k.noData)) return noDataResponse();
  if (matchesAny(text, k.about)) return aboutResponse();
  if (matchesAny(text, k.intelligenceCore)) return intelligenceCoreResponse();
  if (matchesAny(text, k.servicesList)) return servicesListResponse();
  if (matchesAny(text, k.analyzer)) return analyzerResponse();
  if (matchesAny(text, k.contact)) return contactResponse();

  const service = findServiceForText(text);
  if (service) return serviceResponse(service);

  return unknownResponse();
}
