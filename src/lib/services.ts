export type CatalogService = {
  providerId: number;
  slug: string;
  name: string;
};

export const CATALOG_SERVICES: CatalogService[] = [
  { providerId: 8, slug: "netflix", name: "Netflix" },
  { providerId: 9, slug: "prime", name: "Amazon Prime Video" },
  { providerId: 337, slug: "disney", name: "Disney+" },
  { providerId: 1899, slug: "max", name: "HBO Max" },
];

export function watchUrlForTitle(slug: string, title: string): string | null {
  const query = encodeURIComponent(title.trim());
  if (!query) {
    return null;
  }

  switch (slug) {
    case "netflix":
      return `https://www.netflix.com/search?q=${query}`;
    case "prime":
      return `https://www.primevideo.com/search?phrase=${query}`;
    case "disney":
      return `https://www.disneyplus.com/browse/search?q=${query}`;
    case "max":
      return `https://play.max.com/search?q=${query}`;
    default:
      return null;
  }
}

export const NETFLIX_PROVIDER_ID = 8;

export function getServiceBySlug(slug: string): CatalogService | undefined {
  return CATALOG_SERVICES.find((service) => service.slug === slug);
}

export function getServiceByProviderId(providerId: number): CatalogService | undefined {
  return CATALOG_SERVICES.find((service) => service.providerId === providerId);
}

export function resolveServices(slugs?: string[]): CatalogService[] {
  if (!slugs?.length) {
    return [...CATALOG_SERVICES];
  }

  return slugs.map((slug) => {
    const service = getServiceBySlug(slug);
    if (!service) {
      throw new Error(`Unknown service "${slug}". Use netflix, prime, disney, or max.`);
    }
    return service;
  });
}
